---
description: 2026-11-10 升级到 Next.js 16.4.5 与 React 19.3.1：为什么升、版本怎么选、改了什么、哪些大版本没有跟着升及理由
type: Permanent
---

# 升级到 Next.js 16 与 React 19

接在 [[13-review-20261110]] 之后做，分支 `chore/upgrade-next16-react19`。维护者的要求只有一条：用的版本必须是安全的。所以这一轮按“哪个版本没有已知漏洞、还在维护期”来选，不追最新。

## 为什么现在升

- **Next.js 15 的安全维护到 2027-01-31 为止**，之后不再有补丁。
- **`@ducanh2912/next-pwa` 从 2024-09 起没有发布过新版本**，它依赖链上的 7 个 low 级公告没有修复版本。这一项这次没能解决，原因见下。

## 版本怎么选

| 包 | 选用 | 依据 |
|---|---|---|
| next | 16.4.5（2026-11-03 发布） | 16.4.0 及以下有多个 critical（未授权远程代码执行），16.4.1 修复；16.4.5 又修了 7 个 moderate。16.4.6 只回移了缺陷修复，升级当天发布还不到一天，没有选它 |
| react、react-dom | 19.3.1（2026-10-14 发布） | 这两个包没有针对 19.x 的公告。React 19 的公告都在 `react-server-dom-*` 上，最高修到 19.2.8，19.3 系列不在受影响范围内 |
| eslint-config-next | 16.4.5 | 与 next 同步 |
| @types/react、@types/react-dom | 19.3.0 | 与 react 同步 |

Dependabot 加了 7 天的等待期（`cooldown`）：新版本发布满 7 天才会被提出来，安全更新不受限制。

## 改了什么

- **构建与开发都加 `--webpack`**。Next 16 默认用 Turbopack，而 next-pwa 是 webpack 插件；检测到 webpack 配置时默认构建会直接失败。
- **ESLint 配置改成 flat config 的原生写法**。`eslint-config-next` 16 直接导出 flat config，原来经 `@eslint/eslintrc` 的 `FlatCompat` 转换的写法会在校验时崩溃，`@eslint/eslintrc` 也随之移除。
- **关掉 5 条新带进来的规则**：`react-hooks/set-state-in-effect`、`refs`、`preserve-manual-memoization`、`immutability`、`static-components`。它们是 React Compiler 的诊断，本站没有启用编译器。升级当天在 62 个文件里报出 110 处既有写法，逐处改是单独一轮重构。各条的数量写在 `eslint.config.mjs` 的注释里。
- **`next-env.d.ts` 不再入库**。Next 16 的 `dev` 和 `build` 输出到不同目录，会轮流改写这个文件；官方文档要求把它加进 `.gitignore`。
- **类型检查前先跑 `next typegen`**（约 2 秒）。CI 的检查任务不做构建，以前那里的类型检查没有页面与布局的属性校验，现在和本地一致。
- **`tsconfig.json` 由 Next 自动改了两处**：`jsx` 变为 `react-jsx`，`include` 增加 `.next/dev/types`。

应用代码没有改动：React 19 的类型下零错误，Next 16 移除的同步请求 API、AMP、`next lint`、运行时配置这些，本站都没有用到。

## 没有跟着升的

- **Turbopack**。只影响构建速度，与安全无关；本站有 14 个 Web Worker 和多份 wasm 资源，换打包器要单独验证，而且要先解决 next-pwa。
- **换 Serwist**。本来想借此清掉那 7 个 low，但最新的 Serwist 9.5.13 把 `glob` 固定在 13.0.6，落在一个 moderate 公告的范围内，换过去公告反而升级。等它更新依赖后再看。这 7 个 low 都在构建期工具里，不进浏览器。
- **Tailwind 4**。Tailwind 3.4 没有任何公告，而它只在构建时运行；升级要改主题配置和大量类名，全站 60 个工具的样式没有视觉回归测试兜底。
- **ESLint 10、TypeScript 7、vite 8、vitest 5、jsdom、lucide-react 1.x 等**。都是开发工具或图标库的大版本，现用版本没有 high 以上的公告。

## 验证

| 项目 | 结果 |
|---|---|
| `npm run typecheck`（含 `next typegen`） | 通过，React 19 类型下零错误 |
| `npm run lint -- --max-warnings 0` | 通过 |
| `npm test` | 231 个文件、1659 条全部通过，没有 React 19 的运行时警告 |
| `npm run build`（PWA 开启） | 通过，Service Worker 正常生成 |
| e2e（PWA 关闭，按 CI 的方式） | 310 条全部通过 |
| `npm run dev` | 冒烟通过：工具页、旅程、画布、WHOIS 接口 |
| `npm audit --omit=dev --audit-level=high` | 通过；运行时依赖剩 7 个 low（next-pwa 链） |

开发依赖里还有 8 个 moderate，都来自 `@typescript-eslint/typescript-estree` 依赖的 `minimatch` 10.x，修复版本在 11.x，要等 typescript-eslint 更新依赖。它只在跑 lint 时用到。

## 之后要留意

- `next dev` 会在仓库根目录生成 `AGENTS.md`（提醒读 `node_modules/next/dist/docs/` 里随包附带的文档）。根目录的 `*.md` 已被忽略，不会进版本库；不想要可以在 `next.config.mjs` 里设 `agentRules: false`。
- `next dev` 现在输出到 `.next/dev`，和 `next build` 的 `.next` 互不覆盖，可以同时开着开发服务器做构建。
- 关掉的 5 条规则里，`static-components` 的 5 处都在定时任务页，是在渲染函数里定义组件，每次渲染都会重新挂载，值得优先看。
