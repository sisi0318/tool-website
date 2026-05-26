# 前端组件布局结构

## 组件分层

```
components/
├── ui/          # 第1层: 基础 UI (shadcn/ui)
├── m3/          # 第2层: Material Design 3 组件
└── 业务组件     # 第3层: 页面级业务组件
```

## 布局架构

```
app/layout.tsx
├── M3ThemeProvider          # 主题 Provider
│   └── I18nProvider         # 国际化 Provider
│       ├── <main>           # 页面内容
│       └── BottomNav        # 底部导航栏
```

## 业务组件

| 组件 | 路径 | 用途 |
|------|------|------|
| Header | `components/header.tsx` | 顶部导航栏 |
| BottomNav | `components/bottom-nav.tsx` | 底部导航栏 |
| ToolGrid | `components/tool-grid.tsx` | 工具列表网格 |
| ToolSearch | `components/tool-search.tsx` | 工具搜索 |
| JsonTreeView | `components/json-tree-view.tsx` | JSON 树形视图 |
| I18nProvider | `components/i18n-provider.tsx` | 国际化 Provider |
| ThemeProvider | `components/theme-provider.tsx` | 主题 Provider |
| LanguageSwitcher | `components/language-switcher.tsx` | 语言切换 |

## shadcn/ui 组件 (ui/)

基础 UI 组件，基于 Radix UI：
- 布局: Card, Sheet, Dialog, Drawer, Sidebar, Resizable
- 表单: Input, Textarea, Select, Checkbox, Radio, Switch, Slider, Calendar
- 导航: Tabs, NavigationMenu, Menubar, Breadcrumb, Pagination
- 反馈: Toast, Alert, Progress, Skeleton, Loading
- 数据: Table, Badge, Avatar, Carousel, Chart

## M3 组件 (components/m3/)

Material Design 3 风格组件：
- 操作: Button, Chip, Switch, Slider
- 展示: Card, Progress
- 反馈: BottomSheet, Dialog, ContextMenu
- 导航: Tabs, Navigation, Search
- 布局: Layout, LazyContent, PullToRefresh
