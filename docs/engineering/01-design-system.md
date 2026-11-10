---
description: M3 Expressive 设计系统 - 颜色/字体/形状/动效 Token 的技术实现
type: Permanent
---

# M3 Expressive 设计系统

## 概述

项目实现了手搓版 **Material You 3 Expressive** 设计系统，无需任何外部 UI 库（如 MUI）。设计语言以 **Matcha（抹茶绿）** 为种子色，构建完整的语义化主题系统。

## 架构

```mermaid
flowchart TD
    ST[Seed Color] --> CP[Tonal Palette 生成]
    CP --> CS[M3ColorScheme]
    CS --> TP[ThemeProvider]
    TP --> CTX[M3ThemeContext]
    CTX --> CMP[各组件消费]
    
    subgraph Tokens
        CT[Color Tokens]
        TT[Typography Tokens]
        ST2[Shape Tokens]
        MT[Motion Tokens]
    end
    
    CS --> CT
    TT --> CMP
    ST2 --> CMP
    MT --> CMP
```

## 目录结构

```
lib/m3/
├── theme/
│   ├── context.ts      # M3ThemeContext + useM3Theme/useM3ColorScheme hooks
│   ├── provider.tsx    # M3ThemeProvider (next-themes + M3 动态颜色生成)
│   └── index.ts
├── tokens/
│   ├── color.ts        # M3ColorScheme, tonal palette 生成, WCAG 对比度
│   ├── typography.ts   # 15-style M3 type scale, WCAG 对比度工具
│   ├── shape.ts        # 圆角 Token + 组件形状推荐
│   ├── motion.ts       # 时长/缓动 Token + 过渡预设 + reduced motion
│   └── *.test.ts       # 属性测试 (fast-check)
└── performance/
    ├── animation-utils.ts  # GPU 加速动画辅助
    ├── lazy-icon.tsx       # 惰性加载图标
    ├── lazy-image.tsx      # 惰性加载图片
    └── index.ts
```

## Token 系统

### 颜色
- 基于种子色生成 6 阶主色 + 中性色 tonal palette
- 包含状态层 (state layers): hover/focus/pressed/dragged
- 内置 WCAG AA/AAA 对比度校验

**在 Tailwind 类名里不能给令牌加透明度。** `tailwind.config.ts` 里的 `md-*` 颜色是裸的 `var(--md-sys-color-…)`，Tailwind 3 没法给它套透明度：`bg-md-primary/10`、`bg-[var(--md-sys-color-on-surface)]/[0.08]` 这类写法整条规则都不会生成，也没有警告。悬停和按下的状态层用 `hover:bg-md-hover`、`active:bg-md-pressed`；其他半透明颜色用 `color-mix()` 写全，或者用 Tailwind 自带的颜色（遮罩用 `bg-black/50`）。来龙去脉和全站还没改的地方见 [[16-canvas-floating-chrome]]。

### 字体
- 15-style type scale: display/small...body/medium...label/small
- 使用 CSS 变量注入，支持运行时切换

### 形状
- Expressive 风格圆角: xs/sm/md/lg/xl/full
- 每个圆角值对应不同的组件推荐

### 动效
- 16 种持续时间 Token
- 6 种缓动曲线 (emphasized/standard/accelerate/decelerate 等)
- 过渡预设 (Transitions Presets)

## 组件体系

共有两套组件库，共存互补：

| 组件库 | 数量 | 基础 | 用途 |
|--------|------|------|------|
| `components/ui/` | 24 文件 | Radix UI 原语 | 通用 UI 控件 (源自 shadcn/ui)，全站主力 |
| `components/m3/` | 6 个模块 | 手搓 M3 样式 | card / chip / slider / progress / tabs / bottom-sheet；其余未接入的模块已清理 |

## 相关文档

- [[02-frontend-architecture]]
- [[07-performance]]
