# 画布优化实现计划

## 实施步骤

### Step 1: Port 位置修复

**文件变更：**
- `components/canvas/nodes/BaseNode.tsx`
- `components/canvas/nodes/ToolNode.tsx`

**实现细节：**

将 Port 容器宽度从 `w-6` 改为 `w-3`，并调整 Handle 的 left 偏移量。

```tsx
// 修改前
<div className="w-6 flex justify-center">
  <Handle
    style={{
      position: "relative",
      left: 0,
      transform: "none",
    }}
  />
</div>

// 修改后
<div className="w-3 flex justify-center">
  <Handle
    style={{
      position: "relative",
      left: -12,
      transform: "none",
    }}
  />
</div>
```

**影响位置：**
- BaseNode.tsx: Input Port (line ~71)、Output Port (line ~111)、Derived Output Port (line ~149)
- ToolNode.tsx: Input Port、Output Port、Derived Output Port

---

### Step 2: 画布高度修复

**文件变更：**
- `app/canvas/canvas-content.tsx`

**实现细节：**

```tsx
// 修改前
<div className="flex h-[calc(100vh-4rem)]">

// 修改后
<div className="flex h-screen">
```

---

### Step 3: localStorage 自动保存

**文件变更：**
- `lib/canvas/store.ts`

**实现细节：**

在所有修改状态的操作后自动调用 `saveToLocalStorage`：

```tsx
// lib/canvas/store.ts

addNode: (node) =>
  set((state) => {
    setTimeout(() => get().saveToLocalStorage(), 0)
    return { nodes: [...state.nodes, node] }
  }),

removeNode: (nodeId) =>
  set((state) => {
    setTimeout(() => get().saveToLocalStorage(), 0)
    return {
      nodes: state.nodes.filter((n) => n.id !== nodeId),
      edges: state.edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
      // ... 其他清理
    }
  }),

updateNodePosition: (nodeId, position) =>
  set((state) => {
    setTimeout(() => get().saveToLocalStorage(), 0)
    return {
      nodes: state.nodes.map((n) =>
        n.id === nodeId ? { ...n, position } : n
      ),
    }
  }),

updateNodeConfig: (nodeId, config) => {
  set((state) => {
    setTimeout(() => get().saveToLocalStorage(), 0)
    return {
      nodes: state.nodes.map((n) =>
        n.id === nodeId ? { ...n, config } : n
      ),
    }
  })
  setTimeout(() => get().executeNode(nodeId), 0)
},

addEdge: (edge) =>
  set((state) => {
    setTimeout(() => get().saveToLocalStorage(), 0)
    return { edges: [...state.edges, edge] }
  }),

removeEdge: (edgeId) =>
  set((state) => {
    setTimeout(() => get().saveToLocalStorage(), 0)
    return { edges: state.edges.filter((e) => e.id !== edgeId) }
  }),
```

**新增 clearCanvas 方法：**

```tsx
clearCanvas: () => {
  set({
    nodes: [],
    edges: [],
    nodeOutputs: {},
    nodeErrors: {},
    nodeRunning: {},
    selectedNodeId: null,
  })
  setTimeout(() => get().saveToLocalStorage(), 0)
},
```

---

### Step 4: Workflow 工具函数

**文件变更：**
- `lib/canvas/workflow.ts` (新建)

**实现细节：**

```typescript
// lib/canvas/workflow.ts
import type { NodeInstance, Edge } from "./types"

const WORKFLOW_LIST_KEY = "canvas-workflow-list"

export interface WorkflowData {
  nodes: NodeInstance[]
  edges: Edge[]
}

/**
 * 获取所有保存的 workflow 名字列表
 */
export function getWorkflowList(): string[] {
  if (typeof window === "undefined") return []
  const list = localStorage.getItem(WORKFLOW_LIST_KEY)
  return list ? JSON.parse(list) : []
}

/**
 * 获取 workflow 的 localStorage key
 */
function getWorkflowKey(name: string): string {
  return `WORKFLOW_${name}`
}

/**
 * 保存 workflow 到 localStorage
 * @returns true 如果是覆盖已有 workflow
 */
export function saveWorkflow(name: string, data: WorkflowData): boolean {
  const list = getWorkflowList()
  const exists = list.includes(name)

  // 保存 workflow 数据
  localStorage.setItem(getWorkflowKey(name), JSON.stringify(data))

  // 更新列表（如果是新名字）
  if (!exists) {
    list.push(name)
    localStorage.setItem(WORKFLOW_LIST_KEY, JSON.stringify(list))
  }

  return exists
}

/**
 * 从 localStorage 加载 workflow
 */
export function loadWorkflow(name: string): WorkflowData | null {
  if (typeof window === "undefined") return null
  const data = localStorage.getItem(getWorkflowKey(name))
  if (!data) return null
  try {
    return JSON.parse(data)
  } catch {
    return null
  }
}

/**
 * 从 localStorage 删除 workflow
 */
export function deleteWorkflow(name: string): void {
  const list = getWorkflowList()
  const newList = list.filter((n) => n !== name)
  localStorage.setItem(WORKFLOW_LIST_KEY, JSON.stringify(newList))
  localStorage.removeItem(getWorkflowKey(name))
}

/**
 * 检查 workflow 名字是否存在
 */
export function workflowExists(name: string): boolean {
  return getWorkflowList().includes(name)
}
```

---

### Step 5: Workflow Dialog 组件

**文件变更：**
- `components/canvas/workflow/SaveDialog.tsx` (新建)
- `components/canvas/workflow/LoadDialog.tsx` (新建)
- `components/canvas/workflow/ConfirmDialog.tsx` (新建)

**实现细节：**

```tsx
// components/canvas/workflow/SaveDialog.tsx
"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"

interface SaveDialogProps {
  onSave: (name: string) => void
  onCancel: () => void
  existingNames: string[]
}

export function SaveDialog({ onSave, onCancel, existingNames }: SaveDialogProps) {
  const [name, setName] = useState("")
  const [showOverwrite, setShowOverwrite] = useState(false)
  const [error, setError] = useState("")

  const handleSave = () => {
    if (!name.trim()) {
      setError("请输入名字")
      return
    }
    if (existingNames.includes(name.trim())) {
      setShowOverwrite(true)
      return
    }
    onSave(name.trim())
  }

  const handleOverwrite = () => {
    onSave(name.trim())
  }

  if (showOverwrite) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 w-80">
          <h3 className="text-sm font-semibold mb-2">工作流已存在</h3>
          <p className="text-xs text-gray-500 mb-4">
            名为「{name}」的工作流已存在，是否覆盖？
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={onCancel}>取消</Button>
            <Button size="sm" onClick={handleOverwrite}>覆盖</Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 w-80">
        <h3 className="text-sm font-semibold mb-2">保存工作流</h3>
        <input
          type="text"
          value={name}
          onChange={(e) => { setName(e.target.value); setError("") }}
          placeholder="输入工作流名字"
          className="w-full px-3 py-2 text-sm border rounded-md mb-2 dark:bg-gray-900 dark:border-gray-700"
          autoFocus
        />
        {error && <p className="text-xs text-red-500 mb-2">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onCancel}>取消</Button>
          <Button size="sm" onClick={handleSave}>确认</Button>
        </div>
      </div>
    </div>
  )
}
```

```tsx
// components/canvas/workflow/LoadDialog.tsx
"use client"

import { Button } from "@/components/ui/button"
import { Trash2 } from "lucide-react"

interface LoadDialogProps {
  workflows: string[]
  onLoad: (name: string) => void
  onDelete: (name: string) => void
  onClose: () => void
}

export function LoadDialog({ workflows, onLoad, onDelete, onClose }: LoadDialogProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 w-80">
        <h3 className="text-sm font-semibold mb-2">读取工作流</h3>
        <div className="max-h-60 overflow-auto mb-4 border rounded-md dark:border-gray-700">
          {workflows.length === 0 ? (
            <p className="text-xs text-gray-500 p-4 text-center">没有保存的工作流</p>
          ) : (
            workflows.map((name) => (
              <div
                key={name}
                className="flex items-center justify-between px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-900 border-b last:border-b-0 dark:border-gray-700"
              >
                <button
                  onClick={() => onLoad(name)}
                  className="text-sm text-left flex-1 hover:text-blue-500"
                >
                  {name}
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(name) }}
                  className="text-gray-400 hover:text-red-500 p-1"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={onClose}>关闭</Button>
        </div>
      </div>
    </div>
  )
}
```

```tsx
// components/canvas/workflow/ConfirmDialog.tsx
"use client"

import { Button } from "@/components/ui/button"

interface ConfirmDialogProps {
  title: string
  message: string
  onConfirm: () => void
  onCancel: () => void
  confirmLabel?: string
}

export function ConfirmDialog({ title, message, onConfirm, onCancel, confirmLabel = "确认" }: ConfirmDialogProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 w-80">
        <h3 className="text-sm font-semibold mb-2">{title}</h3>
        <p className="text-xs text-gray-500 mb-4">{message}</p>
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onCancel}>取消</Button>
          <Button size="sm" onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      </div>
    </div>
  )
}
```

---

### Step 6: Workflow 按钮组件

**文件变更：**
- `components/canvas/workflow/WorkflowNewButton.tsx` (新建)
- `components/canvas/workflow/WorkflowSaveButton.tsx` (新建)
- `components/canvas/workflow/WorkflowLoadButton.tsx` (新建)

**实现细节：**

```tsx
// components/canvas/workflow/WorkflowNewButton.tsx
"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { FilePlus } from "lucide-react"
import { useCanvasStore } from "@/lib/canvas/store"
import { SaveDialog } from "./SaveDialog"
import { saveWorkflow, getWorkflowList } from "@/lib/canvas/workflow"

export function WorkflowNewButton() {
  const nodes = useCanvasStore((s) => s.nodes)
  const edges = useCanvasStore((s) => s.edges)
  const clearCanvas = useCanvasStore((s) => s.clearCanvas)
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const handleClick = () => {
    if (nodes.length > 0) {
      setShowConfirm(true)
    } else {
      clearCanvas()
    }
  }

  const handleSave = (name: string) => {
    saveWorkflow(name, { nodes, edges })
    setShowSaveDialog(false)
    clearCanvas()
    setShowConfirm(false)
  }

  const handleDiscard = () => {
    clearCanvas()
    setShowConfirm(false)
  }

  if (showSaveDialog) {
    return (
      <SaveDialog
        onSave={handleSave}
        onCancel={() => setShowSaveDialog(false)}
        existingNames={getWorkflowList()}
      />
    )
  }

  if (showConfirm) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 w-80">
          <h3 className="text-sm font-semibold mb-2">新建画布</h3>
          <p className="text-xs text-gray-500 mb-4">
            当前画布有未保存的内容，是否保存？
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowConfirm(false)}>取消</Button>
            <Button variant="outline" size="sm" onClick={handleDiscard}>不保存</Button>
            <Button size="sm" onClick={() => { setShowConfirm(false); setShowSaveDialog(true) }}>保存</Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <Button onClick={handleClick} variant="outline" size="sm" className="flex-1">
      <FilePlus className="w-4 h-4 mr-1" /> 新建
    </Button>
  )
}
```

```tsx
// components/canvas/workflow/WorkflowSaveButton.tsx
"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Save } from "lucide-react"
import { useCanvasStore } from "@/lib/canvas/store"
import { SaveDialog } from "./SaveDialog"
import { saveWorkflow, getWorkflowList } from "@/lib/canvas/workflow"

export function WorkflowSaveButton() {
  const nodes = useCanvasStore((s) => s.nodes)
  const edges = useCanvasStore((s) => s.edges)
  const [showDialog, setShowDialog] = useState(false)

  const handleSave = (name: string) => {
    saveWorkflow(name, { nodes, edges })
    setShowDialog(false)
  }

  if (showDialog) {
    return (
      <SaveDialog
        onSave={handleSave}
        onCancel={() => setShowDialog(false)}
        existingNames={getWorkflowList()}
      />
    )
  }

  return (
    <Button onClick={() => setShowDialog(true)} variant="outline" size="sm" className="flex-1">
      <Save className="w-4 h-4 mr-1" /> 保存
    </Button>
  )
}
```

```tsx
// components/canvas/workflow/WorkflowLoadButton.tsx
"use client"

import { useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { FolderOpen } from "lucide-react"
import { useCanvasStore } from "@/lib/canvas/store"
import { LoadDialog } from "./LoadDialog"
import { getWorkflowList, loadWorkflow, deleteWorkflow } from "@/lib/canvas/workflow"

export function WorkflowLoadButton() {
  const [showDialog, setShowDialog] = useState(false)
  const [workflows, setWorkflows] = useState<string[]>([])

  const handleOpen = useCallback(() => {
    setWorkflows(getWorkflowList())
    setShowDialog(true)
  }, [])

  const handleDelete = useCallback((name: string) => {
    deleteWorkflow(name)
    setWorkflows(getWorkflowList())
  }, [])

  const handleLoad = useCallback((name: string) => {
    const data = loadWorkflow(name)
    if (data) {
      useCanvasStore.setState({
        nodes: data.nodes,
        edges: data.edges,
        nodeOutputs: {},
        nodeErrors: {},
        nodeRunning: {},
        selectedNodeId: null,
      })
      setShowDialog(false)
    }
  }, [])

  if (showDialog) {
    return (
      <LoadDialog
        workflows={workflows}
        onLoad={handleLoad}
        onDelete={handleDelete}
        onClose={() => setShowDialog(false)}
      />
    )
  }

  return (
    <Button onClick={handleOpen} variant="outline" size="sm" className="flex-1">
      <FolderOpen className="w-4 h-4 mr-1" /> 读取
    </Button>
  )
}
```

---

### Step 7: NodePalette 折叠 + Workflow 面板

**文件变更：**
- `components/canvas/NodePalette.tsx`

**实现细节：**

```tsx
// components/canvas/NodePalette.tsx
"use client"

import { useState, useMemo } from "react"
import { getAllNodes } from "@/lib/canvas/registry"
import { ScrollArea } from "@/components/ui/scroll-area"
import { WorkflowNewButton } from "./workflow/WorkflowNewButton"
import { WorkflowSaveButton } from "./workflow/WorkflowSaveButton"
import { WorkflowLoadButton } from "./workflow/WorkflowLoadButton"

const CATEGORIES = [
  { id: "basic", label: "Basic" },
  { id: "crypto", label: "Crypto" },
  { id: "data", label: "Data" },
  { id: "image", label: "Image" },
  { id: "text", label: "Text" },
  { id: "dev", label: "Dev" },
  { id: "utility", label: "Utility" },
  { id: "viewer", label: "Viewer" },
]

export function NodePalette() {
  const [workflowExpanded, setWorkflowExpanded] = useState(true)
  const [nodesExpanded, setNodesExpanded] = useState(true)

  const nodesByCategory = useMemo(() => {
    const allNodes = getAllNodes()
    const grouped: Record<string, typeof allNodes> = {}
    for (const cat of CATEGORIES) {
      grouped[cat.id] = allNodes.filter((n) => n.category === cat.id)
    }
    return grouped
  }, [])

  const handleDragStart = (type: string, e: React.DragEvent) => {
    e.dataTransfer.setData("application/canvas-node", type)
    e.dataTransfer.effectAllowed = "move"
  }

  return (
    <div className="w-64 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex flex-col">
      {/* Workflow Section */}
      <div>
        <button
          onClick={() => setWorkflowExpanded(!workflowExpanded)}
          className="w-full flex items-center gap-2 p-3 border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
        >
          <span className="text-xs text-gray-500">{workflowExpanded ? "▼" : "▶"}</span>
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Workflow</h3>
        </button>
        {workflowExpanded && (
          <div className="p-2 flex gap-2 border-b border-gray-200 dark:border-gray-700">
            <WorkflowNewButton />
            <WorkflowSaveButton />
            <WorkflowLoadButton />
          </div>
        )}
      </div>

      {/* Nodes Section */}
      <div className="flex-1 flex flex-col min-h-0">
        <button
          onClick={() => setNodesExpanded(!nodesExpanded)}
          className="w-full flex items-center gap-2 p-3 border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
        >
          <span className="text-xs text-gray-500">{nodesExpanded ? "▼" : "▶"}</span>
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Nodes</h3>
        </button>
        {nodesExpanded && (
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-3">
              {CATEGORIES.map((cat) => {
                const nodes = nodesByCategory[cat.id]
                if (!nodes || nodes.length === 0) return null
                return (
                  <div key={cat.id}>
                    <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase px-2 mb-1">
                      {cat.label}
                    </h4>
                    <div className="space-y-1">
                      {nodes.map((node) => {
                        const Icon = node.icon
                        return (
                          <div
                            key={node.type}
                            draggable
                            onDragStart={(e) => handleDragStart(node.type, e)}
                            className="flex items-center gap-2 px-2 py-1.5 rounded-md cursor-grab hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                          >
                            <Icon className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                            <span className="text-sm text-gray-700 dark:text-gray-300">
                              {node.label}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  )
}
```

---

## 文件变更清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `components/canvas/nodes/BaseNode.tsx` | 修改 | Port 位置修复 |
| `components/canvas/nodes/ToolNode.tsx` | 修改 | Port 位置修复 |
| `app/canvas/canvas-content.tsx` | 修改 | h-screen |
| `lib/canvas/store.ts` | 修改 | 自动保存 + clearCanvas |
| `lib/canvas/workflow.ts` | 新建 | workflow 工具函数 |
| `components/canvas/NodePalette.tsx` | 修改 | 折叠 + Workflow 面板 |
| `components/canvas/workflow/SaveDialog.tsx` | 新建 | 保存 Dialog |
| `components/canvas/workflow/LoadDialog.tsx` | 新建 | 读取 Dialog |
| `components/canvas/workflow/ConfirmDialog.tsx` | 新建 | 确认 Dialog |
| `components/canvas/workflow/WorkflowNewButton.tsx` | 新建 | 新建按钮 |
| `components/canvas/workflow/WorkflowSaveButton.tsx` | 新建 | 保存按钮 |
| `components/canvas/workflow/WorkflowLoadButton.tsx` | 新建 | 读取按钮 |

---

## 测试计划

### 单元测试

```typescript
// lib/canvas/workflow.test.ts
describe("workflow", () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it("getWorkflowList: returns empty array initially", () => {
    expect(getWorkflowList()).toEqual([])
  })

  it("saveWorkflow: saves and updates list", () => {
    const data = { nodes: [], edges: [] }
    saveWorkflow("test", data)
    expect(getWorkflowList()).toEqual(["test"])
  })

  it("saveWorkflow: returns true when overwriting", () => {
    const data = { nodes: [], edges: [] }
    saveWorkflow("test", data)
    expect(saveWorkflow("test", data)).toBe(true)
  })

  it("loadWorkflow: loads saved data", () => {
    const data = { nodes: [{ id: "1" }], edges: [] }
    saveWorkflow("test", data)
    expect(loadWorkflow("test")).toEqual(data)
  })

  it("loadWorkflow: returns null for non-existent", () => {
    expect(loadWorkflow("nonexistent")).toBeNull()
  })

  it("deleteWorkflow: removes from list", () => {
    saveWorkflow("test", { nodes: [], edges: [] })
    deleteWorkflow("test")
    expect(getWorkflowList()).toEqual([])
  })

  it("workflowExists: checks existence", () => {
    saveWorkflow("test", { nodes: [], edges: [] })
    expect(workflowExists("test")).toBe(true)
    expect(workflowExists("other")).toBe(false)
  })
})
```

### E2E 测试

```typescript
// e2e/canvas-workflow.spec.ts
test("Workflow: save and load", async ({ page }) => {
  // 添加节点
  await addNode(page, "string", { value: "hello" })
  
  // 保存
  await page.click("text=保存")
  await page.fill("input[placeholder='输入工作流名字']", "测试流程")
  await page.click("text=确认")
  
  // 清空画布
  await page.click("text=新建")
  await page.click("text=不保存")
  
  // 读取
  await page.click("text=读取")
  await page.click("text=测试流程")
  
  // 验证节点恢复
  const nodes = await page.evaluate(() => {
    const store = (window as any).__ZUSTAND_STORE__
    return store.getState().nodes
  })
  expect(nodes).toHaveLength(1)
})

test("Workflow: delete from list", async ({ page }) => {
  // 保存一个 workflow
  await page.click("text=保存")
  await page.fill("input[placeholder='输入工作流名字']", "要删除的流程")
  await page.click("text=确认")
  
  // 打开读取 Dialog
  await page.click("text=读取")
  
  // 删除
  await page.locator("text=要删除的流程").locator("..").locator("button:has(svg)").click()
  
  // 验证列表为空
  await expect(page.locator("text=没有保存的工作流")).toBeVisible()
})
```

---

## 实施顺序

1. **Step 1: Port 位置修复** (30min)
   - 修改 BaseNode.tsx
   - 修改 ToolNode.tsx

2. **Step 2: 画布高度修复** (15min)
   - 修改 canvas-content.tsx

3. **Step 3: localStorage 自动保存** (30min)
   - 修改 store.ts
   - 添加 clearCanvas 方法

4. **Step 4: Workflow 工具函数** (30min)
   - 新建 workflow.ts

5. **Step 5: Workflow Dialog 组件** (1h)
   - 新建 SaveDialog.tsx
   - 新建 LoadDialog.tsx
   - 新建 ConfirmDialog.tsx

6. **Step 6: Workflow 按钮组件** (1h)
   - 新建 WorkflowNewButton.tsx
   - 新建 WorkflowSaveButton.tsx
   - 新建 WorkflowLoadButton.tsx

7. **Step 7: NodePalette 更新** (1h)
   - 修改 NodePalette.tsx

8. **Step 8: 测试** (1h)
   - 单元测试 workflow.ts
   - E2E 测试

**总计：约 5.5 小时**
