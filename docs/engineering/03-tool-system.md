---
description: 工具页面的标签页架构、动态导入、URL 状态同步与持久化方案
type: Permanent
---

# 工具系统架构

## 概述

所有 35+ 工具运行在单一 `/tools` 路由下，通过**标签页系统**多开管理。核心思路：SPA 风格的多工具界面 + SSR 友好的 URL 状态同步。

## 架构图

```mermaid
flowchart TD
    URL[URL Search Params<br/>?tool=hash,json] --> PAGE[/tools/page.tsx]
    PAGE --> TS[Tab State<br/>useState]
    TS --> TABS[M3Tabs 组件]
    TS --> CONTENT[Tab Content Panel]
    
    TS <--> SYNC[URL Sync<br/>useSearchParams]
    TS <--> LS[localStorage<br/>持久化]
    
    TABS -->|打开/关闭/排序| TS
    CONTENT -->|Swipe 手势| TS
    
    subgraph Tool Loading
        DI[Dynamic Import<br/>next/dynamic]
        LC[LazyContent<br/>IntersectionObserver]
    end
    
    CONTENT --> DI
    DI --> TC[Tool Component]
    LC --> TC
```

## 关键技术决策

### 1. 动态导入 (Code Splitting)
每个工具使用 `next/dynamic` + `ssr: false` 懒加载：
```typescript
const HashTool = dynamic(() => import('@/app/tools/hash/page'), { ssr: false })
```
- 首屏只加载当前打开的标签页
- 35+ 工具不会产生 35+ 独立的 chunk 吗？—— 每个目录下的 `page.tsx` 作为独立 chunk

### 2. URL 状态同步
- 标签页顺序和激活状态编码在 `?tool=hash,json&active=1`
- 支持分享多标签页状态链接
- 使用 `useSearchParams` 双向同步

### 3. localStorage 持久化
- 关闭页面后恢复上次的标签页状态
- 语言偏好也持久化

### 4. 手势支持
- `use-swipe` hook 实现标签页切换的滑动手势
- Tab 关闭带退出动画

### 5. 搜索系统
- `search-utils.ts` (~1224行) 构建全文搜索索引
- 搜索范围和工具名称、描述、标签

## 工具目录约定

每个工具是 `app/tools/<tool-name>/` 下的一个目录：
```
app/tools/hash/
├── page.tsx     # 工具组件 (默认导出)
```

Tab 标题、图标、分类通过注册表定义在 `page.tsx` 的元数据中。

## 相关文档

- [[02-frontend-architecture]]
- [[07-performance]]
