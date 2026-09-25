---
description: 2026-09-25 全站操作链路审查，包含 17 项先修问题、11 组跨工具共享层、各区域重点、首屏体积与实施顺序
type: Permanent
---

# 操作链路审查：2026-09-25

源码快照为 `94b7a1d`。[[10-audit-20260908]] 的 A01–A14 已在 [[11-audit-fixes-20260908]] 修复，所以本轮不再找一般缺陷，而是沿着用户完成一件事的整条链路检查：输入 → 运行 → 查看、复制、下载 → 交给下一个工具 → 刷新或返回后能否接着做。

## 方法与边界

- 分 6 路做静态审查：站点外壳与导航、安全编码（15 个工具）、数据文本（19 个）、图片文档（19 个）、画布、数据旅程与网络生活类（8 个）。每条结论都要求附 `path:line`。
- 汇总时逐条复核了排在前面的问题，在表中标 ✓。其中工作台搜索排序、颜色工具的正则和首屏体积是用脚本实际复现或计算的，其余是读代码确认。
- 没有打开页面，也没有做真机测试。涉及浏览器默认行为的条目（文件拖到投放区外、iOS 输入框放大、触屏手势）标为“推测”，动手前先在真机上确认。
- 以下内容不再列入：已修复的、核实后不成立的，以及维护者明确不做的（TOTP 等本地凭据加密、英文 SEO 路由、移除 `components/m3`、框架升级）。

## 结论

1. **错误结果：** 有 6 处操作会静默给出错误结果，大多几小时就能修好：
   - 颜色工具的格式输入完全不生效；
   - TOTP 忽略 otpauth 链接里的算法参数；
   - 画布上游从未运行时，下游照样显示“成功”；
   - crontab 误读 Quartz 表达式；
   - 时间戳单位选错时不提示；
   - 工作台搜索按回车会打开错误的工具。
2. **丢数据：** 主要发生在“离开当前页面”和“修改参数”两类操作上：
   - 在工作台里点“继续处理”，所有标签都会被卸载；
   - OCR 切换子标签会取消识别；
   - PDF OCR 改页码会清空已经校对过的结果；
   - 旅程刷新后，文件输入无法恢复；
   - 删除类操作没有撤销。
3. **行为不一致：** 60 个工具各自实现输入、运行和输出，同一个动作在不同工具里行为不同。建议先抽 6 个共享层：运行快捷键与过期标记、选项与草稿持久化、可撤销替换、输出动作、文件输入、错误定位。先接入 `UtilityWorkbench`，一次就能覆盖 13 个工具。
4. **跨工具流转：** 目前唯一的出口是“去数据旅程”。工具页不能接收数据；搜索只在工作台可用；中文界面里，旅程和画布的节点名都是英文。
5. **首屏体积：** 每个页面都要加载完整的中文文案（gzip 后 63 kB）；SQL、二维码识别、JSON Schema 三个页面在首屏就引入了重型库。

## 一、先修：错误结果、丢数据、卡死

| # | 问题 | 证据 | 工作量 | 复核 |
|---|---|---|---|---|
| F01 | 颜色工具的 RGB/HSL/HWB/CMYK 输入框里输什么都不生效：正则里的 `\(`、`\)` 被写成了 `$$`（两个行尾锚点），永远匹配不上。另外，复制后 2 秒内换色，格式面板会回滚成旧值 | `app/tools/color/page.tsx:423`、`:432`、`:473`、`:546`；回滚在 `:590-611` | S | ✓ node 实测 |
| F02 | TOTP 固定用 SHA-1，不读 otpauth 链接里的 `algorithm` 参数；密钥里除空格外的非法字符（如误输的 0/1/8）会被静默删除。结果是导入显示“成功”，验证码却是错的 | `lib/totp-tools.ts:11`、`:59`、`:76-97`；`app/tools/totp/page.tsx:129-138` | S | ✓ |
| F03 | 画布上新加的节点不会执行。下游连到从未运行过的上游时，会用自己的默认值算出一个“成功”结果（例如空字符串的 MD5）。A06 修的是上游失败，这里是上游根本没有输出，属于另一种情况 | `lib/canvas/store.ts:557-573`（addNode 不调度执行）、`:887-893`（连线后只运行目标节点）、`:1014-1016`（上游无输出时直接 continue） | S | ✓ |
| F04 | crontab 默认是 5 段模式，会把 Quartz 的 6 段表达式当成“5 段 + 年份”：`0 0 9 * * ?` 被算成“每月 9 日 00:00”，且不提示。切回可视化页时，还会覆盖手动输入的表达式 | `app/tools/crontab/page.tsx:425-461`、`:776-780` | S | ✓ 读码 |
| F05 | 时间戳的单位要手动选，把毫秒按秒换算会静默得到约 5.6 万年后的日期；转换失败时只打 `console.error`；结果也不能复制。画布适配器里已经有能自动识别单位的 `parseTimeInput` | `app/tools/time/page.tsx:549-570`、`:1181-1189`；`lib/adapters/time.ts:6-35` | S | ✓ |
| F06 | 工作台搜索按目录顺序做子串过滤，按回车打开第一条结果。实际效果：`json` 打开 OCR，`csv` 打开截图表格，`sha256` 打开 HMAC，`密码` 打开经典密码，`base64` 和 `时间戳` 都打开数据识别，`hash` 没有任何结果 | `app/tools/search-utils.ts:32-41`；`app/tools/page.tsx:868-871` | S–M | ✓ 脚本复现 |
| F07 | 在工作台里点“继续处理”，页面会通过 `router.push` 离开 `/tools`，所有标签里的输入、文件和结果全部丢失，返回后只剩空白工具。数据识别的“打开工具”链接也一样 | `components/tools/send-to-menu.tsx:28-29`；`app/tools/page.tsx:340-348`；`app/tools/data-detector/page.tsx:63-69` | M | ✓ |
| F08 | 全站没有 window 级的 dragover/drop 兜底。文件拖到投放区外时，浏览器会默认打开这个文件并离开站点（推测），工作台状态全部丢失 | `components/app-shell.tsx` 里没有监听；全仓 26 处拖放都是元素级的 `onDrop` | S | ✓ 读码 |
| F09 | 单图 OCR 和 PDF OCR 一切换子标签就会静默取消识别。PDF OCR 取消后不保留已完成页是已知局限，这里的问题是随手切一下就会触发，而且没有任何提示。批处理切走时会中断正在跑的项，改任何一个参数则会清空全部已完成的结果，包括手改过的 OCR 文本。PDF OCR 的页码框每敲一个字，都会清空全部结果和逐行修改 | `components/tools/pdf-ocr-panel.tsx:39`、`:75-77`；`image-ocr-panel.tsx:42`；`image-batch-panel.tsx:42`、`:60` | S | ✓ |
| F10 | 旅程的输入是文件或超过 64K 时，刷新后每个节点都显示“从头重新执行”。点下去弹出的提示却是“从根节点重新执行即可恢复”，形成死循环 | `lib/journey/serialize.ts:171-185`；`app/journey/page.tsx:357-363`；`lib/translations/zh.ts:112-113` | M | ✓ |
| F11 | 以下删除操作既没有确认，也不能撤销：TOTP 账户（删除按钮紧挨着复制按钮）、旅程的“删除此步及其后续”（会删掉整棵子树）、画布里已保存的工作流（读屏名称还写成了“删除节点”）。全站从来没有用过 `ToastAction` | `app/tools/totp/page.tsx:172-175`、`:363-379`；`components/journey/StepSheet.tsx:185-193`；`components/canvas/workflow/LoadDialog.tsx:61-67` | S | ✓ |
| F12 | HTTP 测试的历史和环境变量都只存在内存里，刷新就丢。历史里存的是变量替换后的 URL 和请求头，从历史重发会带上旧 token；失败的请求存成 `headers: {}`，重试时 Authorization 会丢失 | `app/tools/http-tester/page.tsx:260-265`、`:320-328`、`:727-739`、`:761-773` | M | ✓ |
| F13 | hex-binary 选一个 10 MB 的文件，会先把约 1400 万字符的 Base64 写进输入框，再把约 5000 万字符的 hexdump 写进输出框，页面卡死。JCE 也会把文件转成 Hex 写进文本框，而且超过 1 万字符后会静默关闭自动解析 | `app/tools/hex-binary/page.tsx:57`；`lib/hex-binary-tools.ts:14-25`；`app/tools/jce/page.tsx:536-545`、`:648` | M | ✓ |
| F14 | 画布节点里的输入控件和预览滚动区没有加 `nodrag`/`nowheel`：拖选文字或拖动滑块会把节点拖走，并写进撤销栈；在预览区滚动滚轮会缩放画布 | `components/canvas/nodes/ConfigInput.tsx:105-173`；`SliderInput.tsx:13-21`（这里的 onMouseDown 拦不住 d3-drag）；`ToolNode.tsx:229`、`:241`、`:259` | S | ✓ 读码 |
| F15 | 画布快捷键在属性面板里同样生效：选中一段输出文字按 Ctrl+C，复制的是节点而不是文字；按 Backspace 会绕过面板删除按钮的确认，直接删节点。`ExecutionLogPanel` 已经用 `data-canvas-shortcuts="off"` 避开了这个问题 | `components/canvas/Canvas.tsx:409-451`；`PropertyPanel.tsx:104` | S | ✓ 读码 |
| F16 | 手机上，工作台的横滑切标签绑定在整个内容区：画打码框、拖裁剪框、拖滑块、横向滚动表格都可能误切标签，而且拖动时内容区会跟着平移 | `app/tools/page.tsx:1122-1129`；`hooks/use-swipe.ts:81-135` | S | ✓ 读码，真机待确认 |
| F17 | 密码生成器的长度框每按一个键就强制改成至少 8：想输 12 或 16，第一个“1”刚输进去就变成了 8 | `app/tools/password-generator/page.tsx:162` | S | ✓ |

## 二、跨工具共性问题与共享层

先看全站的覆盖情况。统计方法是 grep 加逐文件核对，只算独立工具页：

| 能力 | 现状 |
|---|---|
| Ctrl/⌘+Enter 运行 | 0/60 |
| 粘贴图片 | 只有 6 处，而且都挂在元素上；8 个老图片工具不支持 |
| 持久化任何状态 | 约 7/60，而且多数存的是历史记录，不是选项 |
| “继续处理” | 约 25 个工具能发送整个结果；7 个只能从 JSON 树逐节点发送；28 个没有 |
| 工具页接收数据 | 0；交接只能发往 `/journey` |
| 复制失败时无反馈 | 至少 12 处；另有 4 处直接调 `navigator.clipboard.writeText`，没有走回退逻辑 |
| 可撤销操作（`ToastAction`） | 0 |
| 错误边界 | 0；没有 `app/tools/error.tsx`，也没有任何 ErrorBoundary |

### S1 运行：快捷键、自动运行与过期标记

现状：
- `UtilityWorkbench` 只能点按钮运行（`components/tools/utility-workbench.tsx:196-204`、`:218-231`）。
- 切换操作就会清空输出（`app/tools/xml/page.tsx:52`、`sql/page.tsx:49`、`markdown/page.tsx:53`）。
- 13 个工具里有 10 个在输入改了之后，旧输出仍然可以复制和发送（`xml/page.tsx:51`、`csv/page.tsx:78`）。
- 点“示例”只填入内容，不运行。
- JCE 输入超过 1 万字符后会静默停用自动解析，但“自动”徽章还亮着（`jce/page.tsx:639-655`）。
- 同步重算时，忙碌状态根本显示不出来。

建议：
- 抽一个 `useAutoRun(run, deps, { delay, maxAutoChars })` 钩子，并给 UW 加 `autoRun` 选项：开销小的操作默认开启，防抖 250–300 ms；输入超过阈值时，提示“按 Ctrl/⌘+Enter 运行”。
- 记录 `lastRun` 快照。输入变化后，把输出置灰，并禁用复制和发送。
- 整张卡片支持 Ctrl/⌘+Enter；单行输入框按 Enter 就提交。
- 先 `setRunning`，让出一帧再开始计算。
- 点“示例”后直接运行。

覆盖范围：UW 的 13 个工具，之后再推广到 hash、crypto、jce、encoding、classic-cipher。工作量 M。

### S2 状态：选项持久化与输入草稿

现状：
- UW 没有任何存储。
- 工作台只保存每个标签的 id、toolId 和 params（`app/tools/page.tsx:343-348`）。
- crontab 的历史只存在内存里（`crontab/page.tsx:290`）。
- 结果是：刷新页面、从工作台发送后返回、从独立页进入工作台，输入和选项都会丢。

建议：
- 新增 `useToolPrefs(toolId, defaults, guard)`，用来持久化选项：
  - 存 localStorage，键前缀用 `tool-prefs:`，并登记到 `lib/storage/app-storage.ts`，让 `/settings` 能统计和清除；
  - 沿用 `usePersistedHistory` 的写法：首帧用默认值，挂载后再读存储。
- 新增 `useToolDraft(toolId)`，用来保存主输入：
  - 存 sessionStorage，上限约 256 KB，关闭标签页后自动消失；
  - 设置页的“清除全部”也要把它清掉。
- 永远不存密钥、IV、Token、TOTP 种子和文件。

工作量 M。先接入 UW，再逐个接入偏好较多的工具：密码生成器、二维码、图片压缩、汇率的币对、温度的精度。

### S3 可撤销的替换与删除

现状：
- 清空、示例、交换、“用结果作输入”，以及 JSON 工具的 10 个变换，都直接覆盖输入内容（`app/tools/json/page.tsx:141-297`）。受控 textarea 被程序赋值后，浏览器自带的撤销也会失效。
- 删除类操作见 F11。
- 关闭工作台标签不能撤销（`app/tools/page.tsx:489-514`）。

建议：做一个 `useUndoableAction`，执行前先存快照，再弹出带“撤销”按钮的 toast（`components/ui/toast.tsx:58` 里已经有 `ToastAction` 组件）。删除操作延迟 5–10 秒再写入存储。关闭标签后延迟约 8 秒再卸载，这样撤销时状态还在。工作量 S–M。

### S4 输出：复制、下载与继续处理

现状：
- **复制没走回退：** 4 处直接调 `navigator.clipboard.writeText`：`app/tools/image-to-svg/page.tsx:74`、`components/tools/image-ocr-panel.tsx:66`、`image-batch-panel.tsx:104`、`pdf-ocr-panel.tsx:91`。其中两处在剪贴板 API 不存在时会同步抛错，按钮没有任何反馈。
- **复制失败没有反馈：** 例如 `hash/page.tsx:615`、`jwt/page.tsx:181`、`uuid/page.tsx:92`、`json/page.tsx:311`、`diff/page.tsx:75`、`color/page.tsx:594`、`components/tool-route-bar.tsx:55`。同一个复制动作，有 toast、行内文字、Alert、完全无反馈 4 种写法。
- **不能复制图片：** 全仓没有“复制图片”功能，`lib/clipboard.ts` 只处理文本。
- **导出要点两次：** 先点“打包”或“生成”，再点新出现的“下载”。见 `image-batch-panel.tsx:74-79`、`image-table-panel.tsx:64-70`、`har-panel.tsx:50-56`、`pdf-ocr-panel.tsx:64`。
- **文件名和扩展名不对：** 有的输出文件名是固定的，如 `processed.pdf`、`images.pdf`、`data.json`（`lib/pdf-tools.ts:116`、`:198`）；有的扩展名取的是请求的格式，而不是实际的 `blob.type`（`image-compress/page.tsx:156-167`、`image-editor/page.tsx:209-218`）。A08 只修了适配器，这两个页面没修。

建议：
- `useCopyFeedback` + `CopyButton`：统一回退逻辑和 toast 反馈。
- `copyImageToClipboard(blob)`：非 PNG 先转成 PNG；在点击回调里同步构造 ClipboardItem；浏览器不支持时回退为下载。
- `OutputActions`：把复制、下载、继续处理放在一起。
- `outputName(sourceName, suffix, blob)`：保留原文件名，扩展名按真实 MIME 决定。
- 生成完直接调用 `downloadBlob`（`lib/object-url.ts:47`）。

工作量 S–M。

### S5 输入：拖放、粘贴与文件

现状：
- 没有全局拖放兜底，见 F08。
- 粘贴图片只在 6 个元素级 `onPaste` 上生效。页面刚打开、或焦点在按钮上时，按 Ctrl+V 可能没反应（推测）；而 OCR 页的文案写的是“在此页面粘贴截图”（`lib/translations/zh.ts:215`）。
- hash 和 crypto 选了文件之后，拖放区就消失了（`hash/page.tsx:961`、`crypto/page.tsx:1084`）。
- hex-binary、compression、certificate 的 file input 不重置，再选同一个文件没有反应。
- 批处理不按文件类型过滤；压缩和 EXIF 拖入不支持的文件时静默丢弃；压缩页的上传区无法用键盘聚焦。
- 单文件大小上限有 10、20、25、50 MB 和不设上限五种。
- UW、diff、regex 都不能打开文本文件。

建议：
- `AppShell` 在事件未被处理（`!defaultPrevented`）时，对 dragover/drop 调用 `preventDefault`（S）。进一步可以显示全页浮层“松开以导入到 <当前工具>”，用 `useToolActivity` 把文件交给前台标签（M）。
- `usePasteFiles`：在 document 上监听 paste，只在 `useToolActivity()` 为真且面板处于激活状态时处理；焦点在输入框里、剪贴板又没有文件时，交给浏览器处理。工作台里隐藏的标签都常驻挂载，必须加这层门控，否则每个打开的图片工具都会收到粘贴。
- `FileDropZone` 组件，统一以下行为（可以从 `file-compression-panel.tsx:25-29` 的 Picker 改起）：
  - 拖入时高亮；
  - 按类型和大小过滤，并列出被跳过的文件；
  - 支持键盘操作；
  - 选择后重置 value；
  - 选了文件后仍能拖入新文件来替换。
- `useTextFileInput({ maxBytes })`：去掉 BOM、严格按 UTF-8 解码、限制大小，供 UW、diff、regex 使用。
- 二进制输入统一为：保留 File 对象、显示文件标签、禁用文本框、只做有界预览。可参照 `binary-codec/page.tsx:38`、`:53` 和 `components/tools/binary-file-result.tsx:28`、`:45`。

工作量：兜底 S；组件和钩子 M；每个工具接入 S。

### S6 跨工具接收与 URL 参数

现状：
- 交接句柄只能发往 `/journey`（`lib/tool-transfer.ts:74`）。
- 数据识别的“打开工具”只是一个 `/tools/<id>` 链接，不带数据。
- 有两套互不相通的 URL 参数：
  - UW 的 `?op/?input` 只在独立页生效；
  - whois 的 `domain` 和 5 个工具的 `feature` 只在工作台生效（`components/tool-runtime-params.tsx:9-21`）。
- “在工作台打开”只带工具 id，不带当前输入（`tool-route-bar.tsx:50`）。
- “选择下一步工具”里列出的其实是旅程节点，而且显示为英文。

建议：
- 新增 `useIncomingInput(onValue)`，依次读取工作台运行时参数里的 `input`、`?input=`、`#handoff=<id>`。其中 `#handoff` 通过 `toolTransfers.take` 取数据，可以传大数据和二进制。读完立即清理 URL。
- SendToMenu 支持“在某个工具页中打开”：
  - 在独立页上，跳转到 `/tools/<id>#handoff=`；
  - 在工作台里，直接开一个新标签，不离开当前页。这也解决了 F07 里“发往工具”的情况。
  - “发往旅程”要么用新浏览器标签页加 BroadcastChannel 取数据，要么至少先保存草稿（S2）再跳转。
- 合并成一个 `useToolUrlParams()`，同时识别 `<id>_<key>` 和裸 key。ToolRouteBar 进入工作台时带上当前参数；输入走交接句柄，不放进 URL。

工作量 M–L。

### S7 错误定位

现状：lib 已经算出了行列或具体原因，页面却换成了笼统的提示：

| 工具 | lib 给出的信息 | 页面显示 |
|---|---|---|
| XML | 行列（`lib/xml-tools.ts:8`） | 通用失败（`xml/page.tsx:27-29`） |
| SQL | sql-formatter 自带 line/column | 通用失败（`sql/page.tsx:33-35`） |
| JSON Schema | 详情（`lib/json-schema-tools.ts:18-25`） | 丢弃（`json-schema/page.tsx:34-37`） |
| encoding | 行号、非法字符 | “无效”（`encoding/page.tsx:79`） |
| 证书 | 具体原因 | 通用失败（`certificate/page.tsx:31-34`） |
| cURL 导入 | 不支持的选项、未闭合引号等 | “请检查格式”（`http-tester/page.tsx:476-507`） |

另外：
- `.proto` 的解析错误只进了 console（`protobuf/page.tsx:97-100`）。
- JSON 只识别 `at position N` 这一种格式。V8 的 `Unexpected token … is not valid JSON` 拿不到位置（`json/page.tsx:73-83`）。

建议：
- lib 统一抛带 `{ code, line, column, offset }` 的错误。
- 新增 `lib/text-location.ts`，识别常见的报错格式。JSON 在引擎没给位置时，用一个小扫描器求出错位置。
- 新增 `<ErrorLocation>` 组件：显示“第 X 行第 Y 列”，并提供“定位”按钮（调用 `setSelectionRange` 并滚动过去）。
- UW 的 `error` 属性支持结构化的值。

工作量 M。

### S8 搜索、命令面板与最近使用

现状：
- 搜索回车打开错误工具，见 F06。
- Ctrl/⌘K 只在工作台有效（`app/tools/page.tsx:583-593`），Header 上没有搜索入口。
- `recordRecent` 只在工作台里开标签时调用（`:435`、`:459`）。直接访问 `/tools/<id>`、点首页精选、打开分享链接，都不会记进“最近使用”。
- 搜索结果传给工具的 feature 是中文显示名，而工具认的是 `format/minify`、`passphrase` 这样的值，所以永远匹配不上（`lib/tools/catalog.ts:495-497` 对比 `json/page.tsx:421-436`）。
- 在独立页按 “/”：有 7 个工具的焦点会落到隐藏的文件 input 上，按键被吞掉（`tool-route-bar.tsx:31-48`、`json/page.tsx:547-553`）。

建议：
- **搜索排序：** 工具名完全匹配或前缀匹配优先，其次是功能名，最后是描述；同一个工具只显示一行；catalog 加 `keywords` 字段（中英文和缩写，如 hash、哈希、md5）；支持 ↑/↓ 选择结果。
- **feature 参数：** features 加稳定的 `key`，用它作为 feature 参数传给工具。
- **命令面板：** 在 `AppShell` 挂一个全站命令面板，由 Ctrl/⌘K 或 Header 上的搜索图标打开（`/canvas` 除外）；输入为空时列出收藏和最近使用。
- **最近使用与收藏：** 标签被激活、ToolRouteBar 挂载时都记录最近使用；路由栏和标签栏加星标按钮。
- **“/” 快捷键：** 过滤掉不可见元素和 `type=file`；支持工具用 `data-primary-input` 声明主输入框。

工作量：排序 S，命令面板 M。

### S9 移动端

现状：
- 横滑切标签误触，见 F16。
- 工具页用 `text-sm` 覆盖了基础组件的 `text-base md:text-sm`，iOS 上点进输入框会放大页面。共 11 处，如 `utility-workbench.tsx:203`、`json/page.tsx:622`。
- 底部弹层整块都绑定了“下拉关闭”，往回滚动列表也会把弹层关掉（`components/m3/bottom-sheet/bottom-sheet.tsx:142-162`）。
- 窄屏上主操作离输入很远，运行后也不滚动到结果。例如 JSON 要往下滚约两屏才能点到“格式化”。
- 关闭标签、复制等按钮的触控区域只有 24–32 px。
- 工作台的标签栏不吸顶（`app/tools/page.tsx:994-1001`）。

建议：
- `useSwipe` 在 touchstart 时忽略这些起点：input、textarea、滑块、canvas、可以横向滚动的祖先元素、`[data-no-swipe]`。松手时要求水平位移大于垂直位移的 2 倍，或者只在标签栏上响应滑动。
- 输入框字号统一改成 `text-base sm:text-sm`。
- 底部弹层只允许从把手处下拉关闭。
- 窄屏加一条吸附在底部的操作栏；运行后用 `scrollIntoView` 滚到结果。
- 触控区域至少 40 px。
- 标签栏加 `sticky top-16`。

工作量 S–M。

### S10 长任务

现状：
- 在工作台切标签时，hash、crypto、whois、meme-splitter 会静默取消正在进行的任务（`hash/page.tsx:207`、`crypto/page.tsx:285`、`whois/page.tsx:188`、`meme-splitter/page.tsx:196`），OCR 的子标签也一样（见 F09）；PDF 和批处理却在后台继续跑，行为不一致。
- 改参数就直接清空结果，而不是标记为“已过期”（`image-ocr-panel.tsx:34`、`image-to-svg/page.tsx:57`、`image-diff-panel.tsx:56`）。
- 手工成果（OCR 逐行修改、表格校对、打码选区、PDF 页面编排）没有离开保护，全仓没有 `beforeunload`。
- 单图 OCR、打码、表格识别每次都新建 Worker 并重新初始化模型（`lib/ocr-worker-client.ts:42-45`），而批处理已经复用了会话（`lib/image-batch.ts:37`）。

建议：
- 标签失活时不再取消任务，改为在标签上显示忙碌圆点（`useToolBusy`）。
- `useStaleResult`：结果和生成它的参数快照一起保存；参数变了就标“已过期”，用户点“重新处理”才替换；已有手工修改时先确认。
- `useUnsavedWork(dirty)`：关闭标签前确认，离开页面前提示。
- OCR 改为模块级共享会话：任务排队执行，空闲或页面隐藏时释放。

工作量 M。

### S11 中文界面里的英文

现状：
- 66 个节点的名称都是英文（例如 `lib/adapters/hash.ts:56` 里是 `"Hash"`）。旅程的建议芯片、足迹、StepSheet 参数和“下一步工具”选择器因此全是英文。
- 选择器只对英文 label 和 type 做子串匹配，用中文搜不到任何工具（`components/journey/ToolPickerSheet.tsx:30-36`）。
- 画布的节点库已经有中文分类加模糊搜索（`lib/canvas/node-library.ts:132`），旅程没有复用。

建议：
- 节点定义加 `labelKey`。做一个 `localizeNode` 助手，供芯片、足迹、选择器、StepSheet 和画布共用。
- 选择器改用 `searchNodeDefinitions`，并显示最近使用。

工作量：名称和搜索 M；连同全部参数字段一起翻译是 L。

## 三、各区域重点

以下只列上面没有提到的问题。

### 工作台与站点外壳

- **目录与标签管理：**
  - 一旦开了标签，分类目录、收藏、最近使用就都看不到了。
  - “+” 是一个 60 项的平铺下拉，没有搜索，按 Esc 也关不掉。
  - 没有“关闭其他 / 全部关闭”；同一个工具不能开两个标签。
  - 证据：`app/tools/page.tsx:817-834`、`:1085-1114`、`:415-438`。
  - 建议：固定一个不可关闭的“全部工具”首标签；“+” 改为打开命令面板。M
- **标签挂载与错误边界：**
  - 恢复 N 个标签时，会同时下载并挂载 N 个工具。
  - 任何一个工具渲染出错或 chunk 加载失败，都会被根级的 `app/error.tsx` 接住，整个页面连同其他标签一起丢失（`app/tools/page.tsx:1131-1140`）。
  - 建议：标签首次激活时才挂载；每个标签包一层错误边界，提供“重试 / 关闭 / 在独立页打开”；遇到 ChunkLoadError 时提示刷新。S–M
- **分享：** 分享按钮只在开了 2 个以上标签时出现，链接里也不含当前激活的标签（`:1018`、`:786-798`）。S
- **旅程页导航：** 桌面端的 `/journey` 没有 Header，底部导航又带 `md:hidden`。从工具交接过去后，只能靠浏览器后退离开（`app/journey/layout.tsx:18-20`）。S
- **PWA：** `start_url` 指向营销首页，也没有配置 shortcuts 和 share_target（`public/manifest.json:5`）。S
- **设置页：** 清除偏好后，语言和主题要刷新才回到默认；“最近使用”不能单独清除（`app/settings/settings-content.tsx:66`）。S

### 画布

- **文件结果：**
  - 属性面板只能复制，而复制文件得到的只是“文件名 (大小)”。
  - 文件参数不显示当前选的是哪个文件；导入工作流后，下游报的是英文的 “No file provided”。
  - 证据：`components/canvas/PropertyPanel.tsx:17-59`、`lib/canvas/format-value.ts:13-16`、`nodes/ConfigInput.tsx:133-161`。
  - 建议：把 `components/journey/ValueCard.tsx:58-69` 的下载逻辑抽出来共用；image/* 类型的输出显示缩略图。M
- **HTTP 节点的下游：**
  - HTTP 是唯一的手动节点，它运行完后下游不会刷新。
  - 在末端节点点“运行到此节点”时，HTTP 下游的中间节点会被跳过，末端拿到的是旧值。
  - 证据：`lib/canvas/store.ts:1234-1242`、`:1262-1269`、`:950`。
  - 建议：autoRun 开启时，在 executeToNode 结束后对下游再跑一轮。M
- **没有“当前工作流”的概念：**
  - 每次保存都要重新输入名字，也不能重命名。
  - 导出的文件名固定为 `workflow`，保存成功没有任何反馈。
  - 刚保存完点“新建”，仍然提示有未保存的内容。
  - 证据：`workflow/SaveDialog.tsx:15`、`WorkflowTransferButtons.tsx:26-42`、`WorkflowNewButton.tsx:78-84`。
  - 建议：store 记录当前工作流的名字和上次保存的快照；Ctrl+S 直接覆盖保存，只有“另存为”才弹对话框。M
- **读取和导入不确认：** 读取和导入会直接替换当前画布，而“新建”和从旅程转入都有确认（`WorkflowLoadButton.tsx:21-32`、`WorkflowTransferButtons.tsx:41-42`）。S
- **定位失败节点：**
  - 错误数不能点击；点日志条目不会移动视口；单步执行时看不出下一个要运行的是哪个节点。
  - 证据：`CanvasToolbar.tsx:227-231`、`Canvas.tsx:768-771`、`store.ts:1324-1330`。
  - 建议：加一个 `focusNode(id)`，用 `fitView({ nodes: [{ id }] })` 把视口移过去。S
- **连线提示：** 拖线时不提示能否连接（没有设置 `isValidConnection`，`Canvas.tsx:706-727`）；端口没有类型提示；自动类型转换在连线上看不出来。S
- **重算范围：**
  - 撤销一次无关的修改，会清空全部输出并整图重跑；粘贴、创建副本、切换旁路也都整图运行。
  - 所有节点统一 350 ms 防抖，whois、汇率在输入停顿时就会发请求。
  - 证据：`store.ts:489-497`、`:859-863`、`:29`。M
- **离开再回来：**
  - 离开画布再回来，撤销历史和执行结果全部清空并整图重跑，whois、汇率会再请求一次；autoRun 开关也不会被记住；画布上的结果不能“继续处理”。
  - 证据：`app/canvas/canvas-content.tsx:31-36`、`store.ts:1360-1395`。
  - 建议：如果 localStorage 的内容没变，就保留内存里的图、结果和历史；卸载时立即写盘，顺带解决已知的“最后 300 ms 的编辑未保存”问题。M
- **自动保存：** 失败时只打 `console.warn`，localStorage 写满后会静默丢数据（`store.ts:1352-1358`）。S
- **参数编辑器：**
  - 长文本框只有 2 行、10 px 字号。
  - 数字框一清空就变成 0，并且同时写撤销记录、触发执行。
  - 没有字段说明，也没有“恢复默认”。现成的 `withDefaultConfig` 可以直接用上。
  - 证据：`nodes/ConfigInput.tsx:105-131`。M
- **大图的渲染范围：** 每次改动都会为全部节点新建 data 对象；节点订阅了整个 edges；每次入撤销栈都 `structuredClone` 整张图（`Canvas.tsx:176-237`、`nodes/BaseNode.tsx:34`、`store.ts:455-461`）。M
- **移动端：** 删不了连线，也没有粘贴入口。React Flow 默认拖动即选中，所以每拖一次节点，就会弹出一个占 72dvh 的遮罩抽屉（`canvas-content.tsx:27-80`）。M
- **引导与快捷键：**
  - 空画布没有引导，也没有模板。旅程的 6 套模板可以通过 `lib/journey/to-canvas.ts:57` 的 `pathToWorkflow` 转成画布。
  - 快捷键没有清单，也缺少 F、Shift+F、Ctrl+S、Ctrl+Enter、Ctrl+F。M

### 数据旅程

- **不能取消：**
  - 单步执行、改参数重算、从头重跑都不能取消，也没有进度。点一个 OCR 芯片后整页禁用，最长可达 5 分钟。
  - 证据：`app/journey/page.tsx:320-345`，其中 `:328` 调用 `applyStep` 时没传 signal；`lib/journey/engine.ts:132-136` 的 `replayDescendants` 不接收 signal。
  - 建议：复用页面上已有的 `runController` 和进度条。M
- **“应用到新数据”丢分支：**
  - 它只回放当前路径并重建成一条单链，其他分支全部丢失；中途有一步失败时，后续步骤的配置也会被截掉。
  - 证据：`page.tsx:84-99`、`:497-510`；`engine.ts:108-121` 和 `:127-131` 是两套不一致的逻辑。
  - 建议：默认改为 `replaceNodeValue(root)` + `replayDescendants`；根节点卡片加“编辑输入”。M
- **JSON 树的“继续处理”：**
  - JSON 树每一行的“继续处理”都走 `#handoff`，结果是新开一个旅程或弹出拦截页；而用户的本意是在当前节点下提取这个字段（`ValueCard.tsx:104-110`、`json-tree-view.tsx:132`）。
  - “用 JSON Path 提取”芯片的默认路径是 `$`，返回的是整份文档（`lib/adapters/json-path.ts:139-142`）。
  - 格式化 JSON 之后，排第一的建议仍然是“格式化 JSON”（`lib/journey/suggest.ts:284-356`）。
  - 建议：JsonTreeView 加一个 `onContinue` 属性，在旅程里就地追加一个 json-path 步骤。S–M
- **交接拦截页：**
  - 选“返回原旅程”会丢掉传入的数据，因为交接句柄已经被取走；选“开始新旅程”会覆盖未保存的草稿。
  - 证据：`components/journey/TransferIntake.tsx:12-18`、`page.tsx:203-240`。
  - 建议：自动把旧草稿归档为“草稿 MM-DD HH:mm”，配一个可撤销的 toast，从而去掉这个二选一。S
- **保存与存档：**
  - 保存冲突时只能“覆盖”。
  - 回放后根节点 id 会变，用原名保存必然触发覆盖确认，一不小心就会用单链结果覆盖掉带分支的存档。
  - 存档列表没有保存时间和步数。
  - 证据：`JourneyDialogs.tsx:88-106`、`:139-211`。S–M
- **粘贴截图：** 输入页不能粘贴截图，模板页却可以；粘贴文本后还要再点一次“开始探索”（`InputStage.tsx:66-72` 对比 `TemplateStage.tsx:45`）。S
- **移动端：** 顶栏是 7 个纯图标按钮；抽屉高度用 90vh，没有处理软键盘（`dialog-style.ts:9`；viewport 没设置 `interactiveWidget`）。S

### HTTP 测试与网络、生活类工具

- **HTTP · 请求体类型：** 原始请求体没有 JSON 子类型，Content-Type 默认是 `text/plain`，导出的 cURL 里也显式写了 text/plain（`http-tester/page.tsx:139-143`、`:451-453`）。建议加子类型下拉，自动带上对应的 Content-Type，JSON 在发送前校验。S
- **HTTP · 响应：** 只能复制，不能下载、不能搜索非 JSON 文本、不能继续处理或对比。“请求头”页签显示的是编辑器里的值，而不是实际发出去的值（`:1729-1797`）。M
- **HTTP · cURL 导入：** 失败时会关掉对话框并清空输入，只提示“请检查格式”；带 `-u`、`--json`、`-k`、`-i` 的命令会整条失败；不认 bash 的 `$'…'` 写法和 cmd 的 `^` 转义（`:476-507`；`lib/http-request-tools.ts:76-123`）。M
- **HTTP · 其他：** 在地址栏按回车不会发送；参数、请求头、表单这几张表在窄屏上要横向滚动（`:1244-1250`、`:983`）。S
- **whois：** 点一条 IPv4 历史后，类型下拉会被锁成 IPv4，之后再查域名就报“类型不匹配”（`whois/page.tsx:757-761`）。独立页上的 `?domain=` 不生效，查询后也不写回 URL。S
- **汇率：** 粘贴 `1,234.56`、`¥100` 这样的金额会被静默拒绝；实时模式从不写历史；币对和金额不会被记住；拉取失败时不回退到过期的汇率（`currency/page.tsx:546-549`、`:197-201`）。S–M
- **颜色：** 没有屏幕取色（EyeDropper 图标已经导入，但没用上），也没有 WCAG 对比度检查；“同步”和“名称识别”两个开关只切换徽章，不改变任何行为（`color/page.tsx:13`、`:189-191`）。M
- **BMI / 子网 / 温度：** BMI 切换单位时不换算当前数值；子网不认点分掩码，报错也不区分是哪个输入框的问题；温度的预设放在页面最底部。S

### 数据与文本工具

- **JSON · 变换：**
  - 10 个变换都直接覆盖原文，无法撤销。
  - 转成 YAML 或转义之后，实时校验马上报解析错误。
  - 折叠后如果编辑了内容，再点“展开”会被 `originalJson` 覆盖。
  - 下载的文件名固定为 `data.json`，内容是 YAML 也一样。
  - 证据：`json/page.tsx:141-297`、`:48-99`、`:166-197`、`:327-329`。
  - 建议：改成输入、输出两栏，或者至少加一个快照栈；按内容类型决定要不要做 JSON 校验、下载用什么扩展名；格式转换改成目标格式下拉，直接复用现成的 `jsonToXml` 和 csv-tools。M
- **JSON · 树视图：** 每次按键都全量解析，还会重置展开、聚焦和搜索状态（`json/page.tsx:659`、`components/json-tree-view.tsx:32-36`、`:52-61`）。建议给树传防抖后的文本，并保留仍然存在的节点的状态。S
- **文本 diff：**
  - 显示的行号是 diff 结果的行序号，不是文件里的行号。
  - 没有 `whitespace-pre`，只改了缩进的行会显示成完全一样的两行。
  - 没有“忽略空白”、上一处/下一处跳转，也不能导出 unified diff。
  - 证据：`diff/page.tsx:133`、`:153-166`、`:306-310`；`lib/text-diff.ts:5-8`。M
- **正则：**
  - 不能导出匹配结果，画布里的正则适配器反而可以。
  - 匹配数达到 1 万个上限时，会丢掉全部结果。
  - 替换页没有 flags 选项。
  - 一次超时之后，改正过的表达式仍然显示超时。
  - 证据：`regex/page.tsx:322-326`；`lib/regex-runner.ts:47`、`:201-210`。M
- **CSV：**
  - 默认进入日志模式，格式默认是 JSONL，粘贴 CSV 前要切换两次。
  - 每次按键都会清空已解析的数据；重新解析后，筛选、排序、分组条件全部丢失。
  - 证据：`csv/page.tsx:23`；`tabular-panel.tsx:27`、`:57`、`:90`。
  - 建议：按首行自动判断格式；重新解析时，保留仍然存在的列上的条件。M
- **Protobuf：** `.proto` 每按一个键就重新解析一次，并把已选的消息类型重置为第一个；编码结果下载下来是 hex 文本（`protobuf/page.tsx:92-94`、`:275-282`、`:506-519`）。S
- **大小写转换：** 多行标识符会被拼成一个；一次只能看一种格式（`case-converter/page.tsx:63-70`、`:130-141`）。S
- **Docker：** 只支持 run 转 compose；自动转换默认关闭；`sudo docker run` 和多条命令都会报错（`docker-converter/page.tsx:88`、`:115-118`）。S–M
- **数据识别：** 解码出的值只埋在报告 JSON 里，卡片上只显示类型和置信度（`data-detector/page.tsx:29-32`、`:52-71`）。S
- **URL：** 修改输入框、基址或加号选项，都会丢掉已经编辑过的参数表（`url/page.tsx:33`、`:50`）。S

### 安全与编码工具

- **哈希 · 大文件：**
  - 文件哈希全在主线程计算。打开“显示全部”时，每个 2 MB 分块要依次经过 23 个哈希算法。
  - 文件上限 100 MB；切走标签导致中止后，结果行会一直停在“计算中”。
  - 证据：`hash/page.tsx:94`、`:437-478`。
  - 建议：新增 hash Worker，全部改用依赖里已有的 hash-wasm，按 File 分块读取。M–L
- **哈希 · 操作步数：**
  - 默认要手动点计算，换算法会清空结果。
  - “显示全部”的 23 条结果只能逐条复制。
  - 当前算法是 MD5 时贴入 SHA-256 的期望值，只会显示“不匹配”。
  - 证据：`hash/page.tsx:182`、`:752-775`、`:601-607`。
  - 建议：根据期望值的长度推断候选算法；加“复制全部”和“导出 sha256sum 格式”。S
- **crypto：**
  - 加密后想解密验证，要多 4 步，而且切换方向会清空结果；改任何参数也都会清空结果。
  - AES 不会按密钥字节数自动选择 128/192/256。
  - 解密后的下载文件名会变成 `decrypted_encrypted_x`。
  - 没有 AES-GCM。
  - 证据：`crypto/page.tsx:568-577`、`:647-654`、`:237`。
  - 建议：加“用结果作为输入并切换方向”，可参照 encoding 的“反向”（`encoding/page.tsx:121-128`）。S；GCM 为 M
- **encoding：** 解码结果不是 UTF-8 文本（例如图片、压缩包）时只报“无效”，拿不到这些字节（`lib/encoding-tools.ts:249-251`）。建议解码失败时把字节交给 `BinaryFileResult` 展示和下载。S–M
- **Hex/Base64 的宽松程度：**
  - 各工具不一致：`de ad be ef`、`0xde` 在 encoding 里能解，在 crypto、HMAC、hex-binary、JCE 里都报错。
  - 哈希和 HMAC 的数据只能是 UTF-8 文本。
  - 校验框不认 `sha256=` 前缀，也不认 sha256sum 的“值 文件名”格式。
  - 证据：`lib/binary.ts:12-33`、`lib/crypto-input.ts:16-52`。
  - 建议：在 `lib/binary.ts` 提供唯一的宽松解析函数，并抽一个 `ByteFormatSelect` 组件共用。M
- **JWT：** 粘贴 `Bearer …` 就报格式错误；页面描述写着“解析和验证”，实际上不能验签，“格式有效”的绿色徽章容易被误读为 Token 有效（`jwt/page.tsx:61`、`:64-99`）。去掉前缀是 S；用 WebCrypto 验签是 M
- **TOTP：** 不能扫二维码，也不能粘贴截图（jsQR 解码写死在 `qrcode-decode/page.tsx:222-257` 的页面组件里）；添加表单不支持按 Enter 提交；账户不能导出（`totp/page.tsx:207-277`）。M
- **证书：** DER 格式的 `.cer/.crt` 按扩展名被当成文本解析，必定失败；也不显示 SAN 和剩余天数（`certificate/page.tsx:49-50`；`lib/certificate-tools.ts:127`）。S–M
- **零散问题（均为 S）：**
  - 古典密码：清空输入后右侧仍留着旧结果；参数非法时继续显示用旧参数算出的结果；数字框删空后会跳回默认值（`classic-cipher/page.tsx:504`、`:673-675`）。
  - UUID：格式开关不作用于已经生成的结果（`uuid/page.tsx:36-88`）。
  - 进制转换：Base32/Base58 和 encoding 里的同名编码含义不同；不认 `0x` 前缀（`lib/base-converter-tools.ts:1`、`:41`）。

### 图片与文档工具

- **图片压缩：**
  - 全在主线程处理，没有数量和大小上限；调一次质量，就把全部图片重新解码、编码一遍。
  - “全部下载”会触发 N 次独立下载，容易被浏览器拦截。
  - 压缩、转换、批处理是三套各自的实现。批处理已经在 Worker 里跑同一个 `convertImageFile`，也支持 ZIP。
  - 证据：`image-compress/page.tsx:121-199`、`:451-510`；`lib/image-batch.ts:8-27`、`:63-78`。
  - 建议：先把压缩页换成批处理的 Worker 管线并加上 ZIP（M）；长期把三者合并（L）。
- **选区与缩放：**
  - 编辑器的裁剪框一按下就新建，比例也被重置为“自由”。
  - 打码框在画布上点不中，只能在列表里改 4 个数字。
  - 缩放上限只有 200%；全站没有滚轮或双指缩放；编辑器和打码也不响应 Ctrl+Z、Delete。
  - 证据：`image-editor/page.tsx:537-558`；`image-redact-panel.tsx:110-127`；`image-coordinates/page.tsx:424-446`。
  - 建议：抽 `RectEditor`（框内拖动、8 个把手、比例锁、方向键微调）和 `ImageViewport`（滚轮和双指缩放、平移、1:1）两个组件。M–L
- **PDF 合并与图片转 PDF：**
  - 不能拖放，没有缩略图，只能逐格上移或下移：把第 40 页挪到开头要点 39 次。
  - 图片转 PDF 没有“清空”，列表的 key 用的是 index。
  - 证据：`pdf-controls.tsx:16-19`；`pdf-document-panel.tsx:50-84`；`pdf-images-panel.tsx:72`。M
- **打码：** 勾选或取消“手机号 / 邮箱 / 证件号”后，要重跑整次 OCR（`image-redact-panel.tsx:51-59`）。`detectRedactRegions` 是纯函数（`lib/image-redact-shared.ts:29`），可以缓存 OCR 结果后在本地重算。S
- **Office 预览：** Excel 全表一次性渲染；列数用 `Math.max(...全部行)` 计算，行数极大时可能抛 RangeError（推测）；预览后不能导出，也不能发送到 CSV 或 SQLite 工具（`office-viewer/page.tsx:110-125`、`:590-605`）。M
- **HAR：** 不能直接粘贴 DevTools “Copy all as HAR” 复制出的文本；请求详情在 680 px 高的表格下方；改筛选条件会关掉详情；没有“复制为 cURL”（`har-panel.tsx:43-95`）。S–M
- **EXIF：** 看到 GPS 信息后，没法“去除元数据再下载”；HEIC 文件被拒收，拖入时还不提示（`exif-viewer/page.tsx:92`、`:143-152`、`:202-210`）。M
- **二维码生成：** 只能导出不超过 500 px 的 PNG，而下载函数里其实已经把 SVG 序列化好了；关掉“显示预览”会连下载按钮一起隐藏（`qrcode/page.tsx:387-389`、`:405`、`:1085-1149`）。S
- **图片对比：** 每次对比都新建 Worker、重新解码两张原图；一次拖入两张只取第一张（`lib/image-diff.ts:4-7`；`image-diff-panel.tsx:56-68`）。建议用常驻 Worker 缓存像素，两侧都有图时自动对比。M
- **移动端：** 打码、表格、对比的画布设了 `touch-none`，放大后单指不能平移；没有调用相机拍照（`capture`）的入口（`image-redact-panel.tsx:108-111`、`image-table-panel.tsx:94`）。M

## 四、性能：打开工具与执行

下表基于 9 月 8 日的生产构建（`.next`，可能略早于 `94b7a1d`），统计每个路由首屏 JS 的 gzip 体积：

| 路由 | 首屏 JS（gzip） | 说明 |
|---|---|---|
| `/journey` | 约 380 kB | 9 月初记录的优化结果是 267 kB，统计口径可能不同，需要用 `next build` 的输出复核是否回涨 |
| `/tools/sql` | 约 335 kB | 其中 sql-formatter 74 kB |
| `/tools/qrcode-decode` | 约 318 kB | 其中 jsQR 45 kB |
| `/tools/json-schema` | 约 300 kB | 其中 ajv 38 kB |
| 其他工具页 | 222–286 kB | — |
| 基线（`/_not-found`） | 约 145 kB | React 和 Next 运行时 |

- **中文文案：**
  - 整包中文文案进了所有页面共享的 chunk：原始 172 KB，gzip 后 63 kB，约 2.9 万个汉字。打开任何一个工具，都要下载全部 60 个工具以及画布、旅程的文案（`components/i18n-provider.tsx` 静态引入了 `zh`）。
  - 建议：按命名空间拆包（公共部分 + 各工具自己的），估计每个工具页能少 50 kB 左右。M
- **英文用户先看到中文：**
  - 英文用户每次整页加载，都会先看到中文。原因是服务端按中文渲染，`locale` 只存在 localStorage 里，英文文案要等挂载后才动态加载（`components/i18n-provider.tsx:39-60`）。
  - 彻底解决需要把 locale 写进 cookie、由服务端读取，代价是失去静态预渲染，需要维护者取舍。L
- **重型库懒加载：** sql-formatter、jsQR、ajv 改为首次运行或浏览器空闲时再 `import()`。每项 S
- **主线程上的重活：**
  - 涉及文件哈希、图片压缩、GIF 编码、xlsx 解析、PDF OCR 的页面渲染、jsQR、JSON 树每次按键的全量解析，以及 UW 同步处理大输入。按本机 Node 基准，格式化 2.8 MB 的 XML 约需 300 ms。
  - 建议按 S1、S10 和各区域的条目，逐步移进 Worker。
- **其他：** 工作台一次性挂载所有标签、画布大图的渲染范围，见“三”中对应的条目。

## 五、建议实施顺序

| 批次 | 内容 | 估计 |
|---|---|---|
| 1 止损 | F01–F06、F08、F09、F11、F14–F17，加上 S9 里的手势豁免和 iOS 字号 | 1–2 天，基本都是 S |
| 2 共享层 | S4 输出、S2 状态、S3 撤销、S1 运行（先在 UW 落地）、S5 输入、S7 错误定位 | 3–5 天 |
| 3 流转 | F07 与 S6（在工作台内就地发送、工具页能接收数据）、S8 搜索与命令面板、S11 中文化、F10 与旅程的交接拦截页 | 3–5 天 |
| 4 区域深化 | F12、F13；画布的结果下载、HTTP 下游刷新、当前工作流；旅程的取消与进度、保留分支；图片压缩并入批处理管线；JSON、diff、正则的操作链 | 按条目排期 |
| 5 性能 | 文案拆包、重型库懒加载、标签懒挂载加错误边界、画布渲染范围 | 2–3 天 |

第 1 批的每一项都应该补上回归测试，包括：
- 颜色格式的解析；
- TOTP 的 SHA-256 和 SHA-512 测试向量；
- crontab 的 Quartz 样例；
- 时间戳的单位识别；
- 画布“上游从未运行”的情况；
- 搜索排序：F06 里的输入和期望结果可以直接用作断言。
