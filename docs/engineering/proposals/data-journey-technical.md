---
description: 数据旅程技术方案 - 值状态树模型、建议引擎、回放与序列化、与画布互通
type: Permanent
---

# 数据旅程 技术方案

产品定义见 product/10-data-journey.md。核心工程决策:**复用适配器注册表,新增一层"值状态树 + 建议引擎",不触碰 canvas store。**

## 模块划分

```
lib/journey/
├── types.ts       # Journey / JourneyNode / JourneyStep / 建议与回放类型
├── tree.ts        # 纯函数树操作:创建/追加/取路径/取子节点/删子树
├── engine.ts      # applyStep(单步执行) + replaySteps(路径回放),带超时
├── suggest.ts     # 识别驱动建议(精选矩阵)+ 类型兼容兜底
├── serialize.ts   # 路径 ↔ URL hash;旅程 ↔ localStorage(值按可序列化性降级)
└── to-canvas.ts   # 当前路径 → canvas workflow(写入 canvas-state 后跳转)
```

## 数据模型

```ts
interface JourneyStep {            // 一次变换(树的"边")
  tool: string                     // 适配器 type
  config: Record<string, unknown>  // 应用时的配置快照
  outputPort: string               // 传递给下一节点的输出端口
}

interface JourneyNode {            // 一个数据状态(树的"节点")
  id: string
  parentId: string | null          // null = 根(用户输入)
  via: JourneyStep | null          // 从父节点到本节点经过的变换
  value: unknown                   // string | number | File | object | boolean
  valueType: DataType              // 复用 canvas DataType
  label: string                    // 展示名(工具 label 或 "输入")
  createdAt: number
}

interface Journey {
  version: 1
  name: string
  rootId: string
  activeId: string
  nodes: Record<string, JourneyNode>
}
```

- 值在内存中原样持有(含 File);**识别结果不入模型**,由 UI 对当前值即时调用 `detectData`(纯函数、微秒级),避免状态同步问题。

## 执行(engine.ts)

- `applyStep(value, step)`:
  1. `getNodeDefinition(step.tool)`,取**主输入端口 = 第一个 `hasInput` 的 config 字段**(全部 66 个适配器均满足此约定,见 e2e-node-coverage 端口表);
  2. `inputs = { [mainPort.id]: value }`,其余参数走 `config`(适配器天然支持 `inputs.x ?? config.x` 回退);
  3. `execute` 包 30s 硬超时(同 canvas store 的 withExecutionTimeout 思路);
  4. 返回 `{ outputs, value: outputs[outputPort], valueType }`。
- `replaySteps(rootValue, steps)`:顺序 applyStep,失败即止并返回已完成前缀 + 错误。
- 值类型推断 `inferDataType(value)`:File/Blob→bytes,object→json,number→number,boolean→boolean,其余→string。

## 建议引擎(suggest.ts)

两层合并、按分数排序、去重:

1. **精选矩阵**(识别类型 → 建议 + 预设配置 + 首选输出端口),例:
   - `base64` → encoding`{encoding:"base64",mode:"decode"}`;`base64-to-file`
   - `jwt` → jwt(outputPort=payload)
   - `json` → json-format(formatted)/json-path/json-to-yaml
   - `url-encoded`/`hex` → encoding 对应 decode 预设
   - `pem` → certificate;`csv` → csv;`gzip`/`zip` → compression
   - bytes(按 MIME):image/* → exif-viewer / image-compress / image-convert / qrcode-decode / meme-splitter;通用 → file-to-base64 / file-to-string
2. **兼容兜底**:`getAllNodes()` 里主输入端口类型与当前值类型兼容(复用 validation 的 `isTypeCompatible`)的适配器,按类别给低分。

防御性原则:矩阵条目在运行时查注册表校验(存在 + 端口类型匹配),不符即丢弃——错误的猜测静默降级,不会崩。排除项:`category==="basic"`、`*-preview`、`executionMode==="manual"`(网络副作用)。

## 序列化(serialize.ts)

- **URL 分享**:`/journey#j=<base64url(JSON)>`,内容 = `{v, name, steps[], rootText?}`。只含路径步骤;`rootText` 仅在用户勾选且 ≤2KB 时携带。用 hash fragment:不进服务器日志。config 序列化前剥离 File/函数等不可序列化值。
- **localStorage**(经 lib/safe-storage):
  - 旅程列表存 `journey-saves`(name → JourneyPersisted);
  - 值的降级策略:字符串 ≤64KB 原样存;File/Blob/超限值存 `{__missing:true}` 占位,加载后 UI 提示"从根重新执行"恢复(根为文本时可自动恢复)。

## 与画布互通(to-canvas.ts)

当前路径 → `{nodes, edges}`:根值为文本 → `string` 基础节点(config.value),文件 → `file` 节点(需重新选择文件);每步 → 对应工具节点,边 = 上一节点 outputPort → 本节点主输入端口;纵向自动布局。写入 `canvas-state`(与 store.loadFromLocalStorage 的格式一致)后 `router.push("/canvas")`。

## UI 组件(components/journey/)

`JourneyTrail`(足迹条)· `ValueCard`(当前数据卡 + 识别芯片 + 智能预览)· `SuggestionChips` · `StepSheet`(步骤配置查看/修改→沿路径重跑)· `BranchDrawer`(分支树)· `ToolPickerSheet`(全量兼容选择器)。页面 `app/journey/page.tsx`("use client",模块级 `registerAllAdapters()`,同 canvas-content)。

## 测试

tree / engine / suggest / serialize / to-canvas 全部纯函数,常规单测覆盖:分叉与路径提取、回放错误前缀、建议排序与防御降级、URL 往返、File 剥离、to-canvas 边端口正确性。

相关:[[03-tool-system]] · [[low-code-canvas-technical-v3]]
