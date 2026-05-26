# Engineering 目录指南

## 用途

记录 Tool Station（工具站）的技术架构和实现细节，面向开发者和维护者。

## 文档列表

| 文档 | 领域 | 覆盖内容 |
|------|------|----------|
| [[01-design-system]] | 设计系统 | M3 Expressive 主题系统、颜色/字体/形状/动效 Token |
| [[02-frontend-architecture]] | 前端架构 | Next.js 15 App Router、目录结构、数据流、状态管理 |
| [[03-tool-system]] | 工具系统 | 标签页架构、动态导入、URL 状态同步、localStorage 持久化 |
| [[04-i18n]] | 国际化 | 双语翻译系统、Context 设计、命名空间 |
| [[05-pwa-offline]] | PWA 离线 | next-pwa 配置、Service Worker、离线能力 |
| [[06-testing]] | 测试策略 | Vitest 配置、单元测试、属性测试(fast-check)、可访问性测试 |
| [[07-performance]] | 性能优化 | 代码分割、懒加载、动画 GPU 加速、预加载 |
| [[08-frontend-conventions]] | 前端规范 | 编码风格、命名约定、组件结构约定 |

## 规范

- 每个文档以 YAML front matter 开头
- 类型使用 `Permanent`（长期可引用的技术知识原子）
- 聚焦"怎么做"和"为什么这样做"
- 架构图使用 Mermaid 语法
