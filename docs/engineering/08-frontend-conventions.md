---
description: 前端编码规范 - 命名约定、组件结构、样式体系、类型与测试要求
type: Permanent
---

# 前端编码规范

## 1. 技术选型约定

| 范畴 | 选用 | 禁用 |
|------|------|------|
| 框架 | Next.js 15 App Router | 禁止 Pages Router |
| 语言 | TypeScript 5 strict mode | 禁止 `any`（除非 `params: any` 等 Next.js 类型无法覆盖场景） |
| 样式 | Tailwind CSS + CSS 变量 | 禁止内联 `style`、禁止 CSS Modules |
| 设计系统 | M3 Token 变量 (`var(--md-sys-*)`) + `cn()` | 禁止硬编码色值/字号 |
| 图标 | `lucide-react` | 禁止 SVG 内联或 font-icon |
| 国际化 | `useTranslations(namespace)` | 禁止硬编码中文字符串 |
| 测试 | Vitest + Testing Library + fast-check | |

## 2. 命名约定

| 项目 | 规范 | 示例 |
|------|------|------|
| 文件名 (组件) | kebab-case | `tool-grid.tsx`, `json-tree-view.tsx` |
| 文件名 (工具页) | kebab-case 目录 | `app/tools/qrcode-decode/page.tsx` |
| React 组件 | PascalCase | `ToolGrid`, `JsonTreeView` |
| 函数/变量 | camelCase | `useBreakpoint`, `formatJson` |
| 常量 | UPPER_SNAKE_CASE | `MAX_FILE_SIZE` |
| CSS 变量 | `--md-sys-*` 前缀 | `--md-sys-color-primary` |
| Tailwind 扩展类 | `md-*` 前缀 | `md-surface`, `duration-md-short-1` |

## 3. 组件结构规范

### 文件组织
```
ComponentName/
├── index.ts          # re-export
├── component-name.tsx # 主组件
├── component-name.test.tsx # 测试 (可选)
└── sub-component.tsx # 子组件 (可选)
```

对于简单组件，单文件即可：
```
components/header.tsx  # 组件内联子组件 + hooks
```

### 组件编写规则

1. 每个文件顶部声明 `"use client"`（如果使用客户端能力）
2. 使用 `import * as React from "react"` 而非默认导入
3. 优先使用 `cn()` 组合类名
4. 组件 Props 定义 `interface`（不使用 `type`）
5. 复杂内联子组件：在文件内定义（component colocation），不单独建文件
6. M3 组件使用 `React.forwardRef` 转发 ref

```typescript
// ✅ 正确写法
"use client"
import * as React from "react"
import { cn } from "@/lib/utils"

interface MyComponentProps {
  title: string
  className?: string
}

export function MyComponent({ title, className }: MyComponentProps) {
  return (
    <div className={cn("md-surface", className)}>
      {title}
    </div>
  )
}
```

## 4. 样式体系

### 层叠优先级
1. Tailwind 实用类（`className="flex items-center gap-2"`)
2. M3 CSS 变量（`text-[var(--md-sys-color-primary)]`)
3. 仅在必要时使用 `@apply`（`globals.css` 中）

### M3 Token 使用
- 颜色： `text-[var(--md-sys-color-*)]` / `bg-[var(--md-sys-color-*)]`
- 圆角： `rounded-md-*` (xs/sm/md/lg/xl/full)
- 动效： `duration-md-*` + `ease-md-*`
- 不使用 shadcn/ui 的 `border`, `ring`, `background` 等旧 Token（保持向后兼容）

### 动画
- 只使用 `transform` + `opacity` 属性（触发 GPU 合成）
- 动效时长使用 M3 Token：`duration-md-short-4` / `duration-md-medium-3` 等
- 缓动使用 M3 Token：`ease-md-expressive` / `ease-md-emphasized`
- 支持 `use-reduced-motion` hook 尊重用户偏好

## 5. 国际化规则

```typescript
import { useTranslations } from "@/hooks/use-translations"

function MyComponent() {
  const t = useTranslations("myToolName")  // 对应 translations.ts 的命名空间
  return <div>{t("title")}</div>  // 渲染翻译文本
}
```

- 每个工具/领域使用独立命名空间
- 通用文案（如"搜索""取消"）放在 `common` 命名空间
- 永远不要硬编码用户可见文本

## 6. 状态管理

- 组件内状态使用 `useState` / `useReducer`
- 跨组件共享使用 React Context（Theme / I18n）
- 不要引入 Redux、Zustand 等外部状态库
- 工具间共享状态通过 URL search params + localStorage

## 7. 工具页面结构

每个工具目录结构：
```
app/tools/<tool-name>/
├── page.tsx          # 工具主组件 (默认导出)
```

- 使用 `next/dynamic` 延迟加载
- 从 `lib/translations.ts` 读取工具的标题和描述
- 所有计算逻辑放在组件内或独立的 `utils` 文件

## 8. Git 规范

- 分支命名：`feat/<name>`, `fix/<name>`, `chore/<name>`
- 提交信息：简洁英文，用动词开头
- 不提交 `node_modules`、`.next`、环境变量
- 不提交包含密钥或敏感信息的文件

## 9. 测试规范

| 测试类型 | 工具 | 覆盖场景 |
|----------|------|----------|
| 组件测试 | Vitest + testing-library | 渲染、交互、无障碍 |
| 属性测试 | fast-check | 设计 Token 不变量、工具函数 |
| Hook 测试 | Vitest + testing-library | Hook 行为验证 |
| 可访问性 | testing-library | ARIA 属性、键盘导航 |

- 测试文件与被测文件同目录：`*.test.tsx`
- 属性测试使用 `fast-check` 的 `fc.property` / `fc.assert`

## 10. 性能规则

- 工具组件使用 `next/dynamic` + `ssr: false`
- 大图片使用 `LazyImage` 组件
- 图标使用 `LazyIcon` 组件（即将 lucide import 延迟到运行时）
- 动画优先使用 `transform` 和 `opacity`
- 避免不必要的 `useEffect` 和 `useCallback`

## 相关文档

- [[01-design-system]]
- [[02-frontend-architecture]]
- [[03-tool-system]]
- [[04-i18n]]
- [[06-testing]]
- [[07-performance]]
