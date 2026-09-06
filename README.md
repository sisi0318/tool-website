# 工具站 tool-website

无需安装、打开即用的在线工具集合：59 个开发 / 文本 / 图片 / 编码 / 网络工具，外加一个可以把工具连成工作流的低代码画布。绝大多数处理在浏览器本地完成，不上传数据。

## 功能

- **59 个独立工具**：哈希、加解密、HMAC、TOTP、编码转换、JSON/XML/CSV/SQL、正则、图片压缩 / 转换 / 编辑 / 批处理 / 隐私打码 / 对比、图片转 SVG、图片与 PDF OCR、截图转表格、PDF、SQLite、二维码生成与识别、HTTP 测试、WHOIS 等（见 `/tools`）
- **低代码画布**（`/canvas`）：66 种节点，把输入、转换与输出连成可保存 / 导入导出的工作流，支持自动执行、单步执行、节点旁路
- **PWA**：可安装、离线回退页、静态资源缓存
- **Material 3 设计系统** + 中英双语 i18n + 移动端适配

## 数据与隐私

所有哈希、加解密、编码与图片处理都在浏览器本地完成。只有下列依赖外部数据源的
功能会发出网络请求，界面上均有说明：

| 场景 | 去向 | 说明 |
|---|---|---|
| HTTP 测试 | `web-proxy.apifox.cn` | 浏览器无法跨域直连任意接口，请求（含请求头与请求体）经该第三方代理转发 |
| 设备信息：公网 IP 与归属地 | `api-ipv4.ip.sb` | 可在页面上关闭缓存；浏览器指纹本身只在本地计算 |
| 汇率换算 | `open.er-api.com` | 公开汇率数据，经本站服务端缓存后下发 |
| WHOIS | 本站 `/api/whois` → IANA 与各注册局 RDAP | 只发送查询的域名或 IP |

本地存储（localStorage）会保留工具偏好、标签页状态、画布与数据旅程。其中画布配置与
TOTP 账户以明文保存，请勿在共享设备上录入长期凭据。分享链接会携带各步骤的参数，
但不含数据本体；标记为长期凭据的字段（如 TOTP 种子）不会进入链接。

打开 `/settings` 可以看到本站在当前设备上写入的全部内容（分组、占用大小、哪些含
敏感数据），并按类别或全部清除 —— 只删本站登记过的键，不影响同域下的其它数据。

## 技术栈

Next.js 15 (App Router) · React 18 · TypeScript (strict) · Tailwind CSS + M3 design tokens · Zustand · @xyflow/react · Vitest + Playwright · ESLint 9

## 开发

```bash
npm install
npm run dev        # 开发服务器
npm run test       # 单元测试（vitest）
npm run e2e        # 端到端测试（playwright）
npm run lint       # ESLint
npm run typecheck  # tsc --noEmit
npm run build      # 生产构建（含 lint 与类型检查）
```

## 目录结构

OCR 的首次开发或生产构建会下载约 31 MB 官方模型并校验 SHA-256，之后复用本地缓存；部署后由本站按需提供。用户首次识别需加载约 70 MB 模型与运行文件，图片不上传。详见 [浏览器 OCR](docs/engineering/tools/02-browser-ocr.md)。

```
app/            路由（tools/* 各工具页、canvas 画布、api/*）
components/     业务组件（canvas/、m3/、tools/、ui/）
lib/            纯逻辑与工具函数（*.test.ts 同目录存放）
lib/adapters/   画布节点适配器（每个工具一个）
lib/canvas/     画布引擎：store / engine / validation / workflow
hooks/          共享 React hooks
docs/           产品与工程文档（Zettelkasten 风格）
scripts/        辅助脚本（如 PWA 图标生成）
```

## 文档

- 产品说明：`docs/product/`
- 工程实现（设计系统 / 架构 / 工具系统 / i18n / PWA / 测试 / 性能）：`docs/engineering/`

## 部署

标准 Next.js 应用，推荐 Vercel。可选环境变量：

- `NEXT_PUBLIC_SITE_URL`：站点绝对地址（未设置时依次回退 `VERCEL_PROJECT_PRODUCTION_URL` / `VERCEL_URL` / localhost），用于 metadata、sitemap 与 OG 链接。
