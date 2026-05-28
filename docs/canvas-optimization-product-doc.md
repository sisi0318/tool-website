# 画布优化产品方案

## 一、问题修复

### 1.1 Port 横向距离 Border 太远

**问题描述：**
当前 Port（端口）的圆心距离 Node Border 有较大间距，应该让 Border 穿过 Port 圆的中心。

**当前实现：**
```tsx
// BaseNode.tsx / ToolNode.tsx
<div className="w-6 flex justify-center">
  <Handle
    type="target"
    position={Position.Left}
    style={{
      position: "relative",
      left: 0,
      transform: "none",
    }}
  />
</div>
```

**问题分析：**
- Port 容器宽度 `w-6`（24px）导致 Port 与 Border 有 12px 间距
- Port 使用 `position: relative`，相对于容器定位

**解决方案：**
```tsx
<div className="w-3 flex justify-center">  {/* w-6 → w-3 */}
  <Handle
    type="target"
    position={Position.Left}
    style={{
      position: "relative",
      left: -12,  {/* 向左偏移，让 Border 穿过圆心 */}
      transform: "none",
    }}
  />
</div>
```

**视觉效果：**
```
修复前：
┌─────────────────────┐
│  ●  Label  Value  ● │  ← Port 在 Border 内侧
└─────────────────────┘

修复后：
●─────────────────────●
│   Label  Value      │  ← Border 穿过 Port 圆心
└─────────────────────┘
```

**影响文件：**
- `components/canvas/nodes/BaseNode.tsx`
- `components/canvas/nodes/ToolNode.tsx`

---

### 1.2 画布高度问题

**问题描述：**
画布使用 `h-[calc(100vh-4rem)]`，减去了 4rem。

**原因分析：**
4rem 是页面顶部导航栏的高度。画布需要减去导航栏高度才能占满可视区域。

**当前实现：**
```tsx
// app/canvas/canvas-content.tsx
<div className="flex h-[calc(100vh-4rem)]">
```

**解决方案：**
如果画布页面没有导航栏，应该使用 `h-screen`：
```tsx
<div className="flex h-screen">
```

**需要确认：**
- 画布页面是否有独立的导航栏？
- 如果有，保留 `4rem`；如果没有，改为 `h-screen`

---

### 1.3 画布内容自动保存到 localStorage

**问题描述：**
刷新页面后画布内容丢失。

**当前实现：**
```tsx
// lib/canvas/store.ts
saveToLocalStorage: () => {
  const state = get()
  localStorage.setItem(
    "canvas-state",
    JSON.stringify({ nodes: state.nodes, edges: state.edges })
  )
},
loadFromLocalStorage: () => {
  const saved = localStorage.getItem("canvas-state")
  if (saved) {
    try {
      const { nodes, edges } = JSON.parse(saved)
      set({ nodes: nodes ?? [], edges: edges ?? [] })
    } catch {}
  }
},
```

**问题：**
- `saveToLocalStorage` 已存在但未被调用
- `loadFromLocalStorage` 在页面加载时调用

**解决方案：**
在 `updateNodeConfig`、`addNode`、`removeNode`、`addEdge`、`removeEdge`、`updateNodePosition` 后自动调用 `saveToLocalStorage`。

```tsx
// lib/canvas/store.ts
addNode: (node) =>
  set((state) => {
    const newState = { nodes: [...state.nodes, node] }
    setTimeout(() => get().saveToLocalStorage(), 0)
    return newState
  }),
```

---

## 二、新增功能

### 2.1 左侧面板折叠功能

**需求描述：**
- Nodes 面板可折叠，默认展开
- 新增 Workflow 面板，排在 Nodes 上方，默认展开
- Workflow 面板包含：新建、保存、读取按钮

**UI 设计：**
```
┌─────────────────────┐
│ ▼ Workflow          │  ← 可折叠，默认展开
│  ┌─────┐ ┌─────┐   │
│  │ 新建 │ │ 保存 │   │
│  └─────┘ └─────┘   │
│  ┌─────┐           │
│  │ 读取 │           │
│  └─────┘           │
├─────────────────────┤
│ ▼ Nodes             │  ← 可折叠，默认展开
│  ▼ Basic            │
│    String           │
│    Number           │
│    Boolean          │
│  ▼ Crypto           │
│    Hash             │
│    ...              │
└─────────────────────┘
```

**实现方案：**

```tsx
// components/canvas/NodePalette.tsx
export function NodePalette() {
  const [workflowExpanded, setWorkflowExpanded] = useState(true)
  const [nodesExpanded, setNodesExpanded] = useState(true)

  return (
    <div className="w-64 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex flex-col">
      {/* Workflow Section */}
      <div>
        <button
          onClick={() => setWorkflowExpanded(!workflowExpanded)}
          className="w-full flex items-center gap-2 p-3 border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
        >
          <span className="text-xs">{workflowExpanded ? "▼" : "▶"}</span>
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Workflow</h3>
        </button>
        {workflowExpanded && (
          <div className="p-2 flex gap-2">
            <WorkflowNewButton />
            <WorkflowSaveButton />
            <WorkflowLoadButton />
          </div>
        )}
      </div>

      {/* Nodes Section */}
      <div>
        <button
          onClick={() => setNodesExpanded(!nodesExpanded)}
          className="w-full flex items-center gap-2 p-3 border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
        >
          <span className="text-xs">{nodesExpanded ? "▼" : "▶"}</span>
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Nodes</h3>
        </button>
        {nodesExpanded && (
          <ScrollArea className="flex-1">
            {/* 原有的 Nodes 列表 */}
          </ScrollArea>
        )}
      </div>
    </div>
  )
}
```

---

### 2.2 Workflow 新建

**功能描述：**
清空当前画布。如果画布有 Node，提醒用户是否保存。

**交互流程：**
```
用户点击「新建」
    ↓
检查画布是否有 Node
    ↓
有 Node → 弹出确认 Dialog
    ├─ 保存 → 执行保存流程 → 清空画布
    ├─ 不保存 → 直接清空画布
    └─ 取消 → 关闭 Dialog
    ↓
无 Node → 直接清空画布
```

**Dialog 设计：**
```
┌─────────────────────────────┐
│  新建画布                    │
├─────────────────────────────┤
│  当前画布有未保存的内容，     │
│  是否保存？                  │
│                             │
│  ┌─────┐ ┌─────┐ ┌─────┐  │
│  │ 保存 │ │不保存│ │ 取消 │  │
│  └─────┘ └─────┘ └─────┘  │
└─────────────────────────────┘
```

**实现方案：**
```tsx
function WorkflowNewButton() {
  const nodes = useCanvasStore((s) => s.nodes)
  const clearCanvas = useCanvasStore((s) => s.clearCanvas)
  const [showDialog, setShowDialog] = useState(false)

  const handleClick = () => {
    if (nodes.length > 0) {
      setShowDialog(true)
    } else {
      clearCanvas()
    }
  }

  return (
    <>
      <Button onClick={handleClick} variant="outline" size="sm">
        <FilePlus className="w-4 h-4 mr-1" /> 新建
      </Button>
      {showDialog && (
        <SaveConfirmDialog
          onSave={() => { /* 保存逻辑 */ clearCanvas(); setShowDialog(false) }}
          onDiscard={() => { clearCanvas(); setShowDialog(false) }}
          onCancel={() => setShowDialog(false)}
        />
      )}
    </>
  )
}
```

---

### 2.3 Workflow 保存

**功能描述：**
弹出 Dialog 让用户输入名字，保存到 localStorage。

**交互流程：**
```
用户点击「保存」
    ↓
弹出 Dialog，输入名字
    ↓
用户点击「确认」
    ↓
检查名字是否已存在
    ├─ 存在 → 弹出提示「是否覆盖？」
    │         ├─ 覆盖 → 保存
    │         └─ 取消 → 返回 Dialog
    └─ 不存在 → 直接保存
    ↓
保存成功，关闭 Dialog
```

**Dialog 设计：**
```
┌─────────────────────────────┐
│  保存工作流                   │
├─────────────────────────────┤
│  名字:                       │
│  ┌─────────────────────┐   │
│  │                     │   │
│  └─────────────────────┘   │
│                             │
│  ┌─────┐ ┌─────┐          │
│  │ 确认 │ │ 取消 │          │
│  └─────┘ └─────┘          │
└─────────────────────────────┘
```

**覆盖确认 Dialog：**
```
┌─────────────────────────────┐
│  工作流已存在                 │
├─────────────────────────────┤
│  名为「xxx」的工作流已存在，  │
│  是否覆盖？                  │
│                             │
│  ┌─────┐ ┌─────┐          │
│  │ 覆盖 │ │ 取消 │          │
│  └─────┘ └─────┘          │
└─────────────────────────────┘
```

**localStorage 结构：**
```typescript
// 固定 key，存储所有保存的 workflow 名字列表
const WORKFLOW_LIST_KEY = "canvas-workflow-list"

// 每个 workflow 的 key
const getWorkflowKey = (name: string) => `WORKFLOW_${name}`

// 示例：
localStorage["canvas-workflow-list"] = '["我的工作流","测试流程"]'
localStorage["WORKFLOW_我的工作流"] = '{"nodes":[...],"edges":[...]}'
localStorage["WORKFLOW_测试流程"] = '{"nodes":[...],"edges":[...]}'
```

**实现方案：**
```tsx
const WORKFLOW_LIST_KEY = "canvas-workflow-list"

function getWorkflowList(): string[] {
  const list = localStorage.getItem(WORKFLOW_LIST_KEY)
  return list ? JSON.parse(list) : []
}

function saveWorkflow(name: string, nodes: NodeInstance[], edges: Edge[]): boolean {
  const list = getWorkflowList()
  const exists = list.includes(name)
  
  // 保存 workflow 数据
  localStorage.setItem(`WORKFLOW_${name}`, JSON.stringify({ nodes, edges }))
  
  // 更新列表
  if (!exists) {
    list.push(name)
    localStorage.setItem(WORKFLOW_LIST_KEY, JSON.stringify(list))
  }
  
  return true
}

function loadWorkflow(name: string): { nodes: NodeInstance[]; edges: Edge[] } | null {
  const data = localStorage.getItem(`WORKFLOW_${name}`)
  return data ? JSON.parse(data) : null
}

function deleteWorkflow(name: string): void {
  const list = getWorkflowList()
  const newList = list.filter((n) => n !== name)
  localStorage.setItem(WORKFLOW_LIST_KEY, JSON.stringify(newList))
  localStorage.removeItem(`WORKFLOW_${name}`)
}
```

---

### 2.4 Workflow 读取

**功能描述：**
从 localStorage 读取所有保存的 workflow，弹出 Dialog 让用户选择。

**交互流程：**
```
用户点击「读取」
    ↓
弹出 Dialog，显示 workflow 列表
    ↓
用户选择一个 workflow
    ↓
加载 workflow 数据到画布
    ↓
关闭 Dialog
```

**Dialog 设计：**
```
┌─────────────────────────────────────┐
│  读取工作流                           │
├─────────────────────────────────────┤
│  ┌─────────────────────────────┐   │
│  │ 我的工作流              [删除] │   │
│  ├─────────────────────────────┤   │
│  │ 测试流程                [删除] │   │
│  ├─────────────────────────────┤   │
│  │ 另一个流程              [删除] │   │
│  └─────────────────────────────┘   │
│                                     │
│  ┌─────┐                           │
│  │ 关闭 │                           │
│  └─────┘                           │
└─────────────────────────────────────┘
```

**实现方案：**
```tsx
function WorkflowLoadButton() {
  const [showDialog, setShowDialog] = useState(false)
  const [workflows, setWorkflows] = useState<string[]>([])

  const handleOpen = () => {
    setWorkflows(getWorkflowList())
    setShowDialog(true)
  }

  const handleDelete = (name: string) => {
    deleteWorkflow(name)
    setWorkflows(getWorkflowList())
  }

  const handleLoad = (name: string) => {
    const data = loadWorkflow(name)
    if (data) {
      // 加载到画布
      useCanvasStore.setState({ nodes: data.nodes, edges: data.edges })
      setShowDialog(false)
    }
  }

  return (
    <>
      <Button onClick={handleOpen} variant="outline" size="sm">
        <FolderOpen className="w-4 h-4 mr-1" /> 读取
      </Button>
      {showDialog && (
        <WorkflowListDialog
          workflows={workflows}
          onLoad={handleLoad}
          onDelete={handleDelete}
          onClose={() => setShowDialog(false)}
        />
      )}
    </>
  )
}
```

---

## 三、文件结构变更

```
components/canvas/
├── NodePalette.tsx              # 修改：添加折叠、Workflow 面板
├── Canvas.tsx                   # 修改：Port 位置修复
├── nodes/
│   ├── BaseNode.tsx             # 修改：Port 位置修复
│   └── ToolNode.tsx             # 修改：Port 位置修复
├── workflow/
│   ├── WorkflowNewButton.tsx    # 新建：新建按钮组件
│   ├── WorkflowSaveButton.tsx   # 新建：保存按钮组件
│   ├── WorkflowLoadButton.tsx   # 新建：读取按钮组件
│   ├── SaveDialog.tsx           # 新建：保存 Dialog
│   ├── LoadDialog.tsx           # 新建：读取 Dialog
│   └── ConfirmDialog.tsx        # 新建：确认 Dialog

lib/canvas/
├── store.ts                     # 修改：自动保存逻辑
└── workflow.ts                  # 新建：workflow 存储工具函数

app/canvas/
└── canvas-content.tsx           # 修改：高度调整（如需要）
```

---

## 四、实施计划

| Step | 内容 | 预计时间 |
|------|------|----------|
| 1 | Port 位置修复 | 30min |
| 2 | 画布高度确认与修复 | 15min |
| 3 | localStorage 自动保存 | 30min |
| 4 | Workflow 工具函数 | 30min |
| 5 | Workflow Dialog 组件 | 1h |
| 6 | NodePalette 折叠 + Workflow 面板 | 1h |
| 7 | 测试 | 1h |

**总计：约 4.5 小时**

---

## 五、验收标准

1. ✅ Port 的圆心与 Node Border 对齐
2. ✅ 画布占满整个可视区域
3. ✅ 刷新页面后画布内容保留
4. ✅ 左侧面板可折叠
5. ✅ Workflow 面板包含新建、保存、读取按钮
6. ✅ 新建时如有未保存内容会提醒
7. ✅ 保存时可输入名字，支持覆盖确认
8. ✅ 读取时显示 workflow 列表，支持删除
9. ✅ 所有单元测试通过
10. ✅ Build 通过
