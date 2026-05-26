---
description: 低代码节点化画布的技术架构设计
type: proposal
---

# 低代码画布技术方案

## 1. 整体架构

```
┌─────────────────────────────────────────────────────────────────┐
│                          Canvas Page                            │
│  ┌──────────┐  ┌──────────────────────────────┐  ┌──────────┐  │
│  │  Node    │  │       ReactFlow Canvas       │  │ Property │  │
│  │ Palette  │  │  ┌─────┐    ┌─────┐         │  │  Panel   │  │
│  │          │  │  │NodeA│────│NodeB│         │  │          │  │
│  │ String   │  │  └─────┘    └─────┘         │  │          │  │
│  │ Number   │  │       ┌─────┐               │  │          │  │
│  │ JSON     │  │       │NodeC│               │  │          │  │
│  │ File     │  │       └─────┘               │  │          │  │
│  │ Hash     │  │                              │  │          │  │
│  │ ...      │  │                              │  │          │  │
│  └──────────┘  └──────────────────────────────┘  └──────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        Engine Layer                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │  Type System │  │  Execution   │  │   State Manager      │  │
│  │              │  │   Engine     │  │   (Zustand Store)    │  │
│  │  DataType    │  │              │  │                      │  │
│  │  Port        │  │  Topological │  │  nodes[]             │  │
│  │  Validation  │  │  Sort + Eval │  │  edges[]             │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                       Tool Adapters                             │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐       │
│  │  Hash  │ │ Crypto │ │  JSON  │ │ Image  │ │  ...   │       │
│  │Adapter │ │Adapter │ │Adapter │ │Adapter │ │        │       │
│  └────────┘ └────────┘ └────────┘ └────────┘ └────────┘       │
└─────────────────────────────────────────────────────────────────┘
```

## 2. 目录结构

```
app/
├── canvas/
│   └── page.tsx                  # 画布页面入口
├── tools/                        # 现有工具保持不动

lib/
├── canvas/
│   ├── types.ts                  # 核心类型定义
│   ├── store.ts                  # Zustand 状态管理
│   ├── engine.ts                 # 执行引擎
│   ├── validation.ts             # 连接验证逻辑
│   ├── registry.ts               # 节点注册表
│   └── types/
│       ├── index.ts              # 类型系统入口
│       ├── primitives.ts         # string/number/json/bytes 定义
│       └── json-meta.ts          # JSON typename 机制
├── adapters/
│   ├── types.ts                  # Adapter 接口定义
│   ├── basic.ts                  # String/Number/JSON/File 节点
│   ├── hash.ts                   # Hash 工具适配器
│   ├── crypto.ts                 # Crypto 工具适配器
│   └── ...

components/
├── canvas/
│   ├── Canvas.tsx                # ReactFlow 画布容器
│   ├── NodePalette.tsx           # 左侧节点面板
│   ├── PropertyPanel.tsx         # 右侧属性面板
│   ├── nodes/
│   │   ├── BaseNode.tsx          # 通用节点外壳
│   │   ├── ports/
│   │   │   ├── InputPort.tsx     # 输入端口组件
│   │   │   ├── OutputPort.tsx    # 输出端口组件
│   │   │   └── PortTooltip.tsx   # 连接警告 Tooltip
│   │   ├── basic/
│   │   │   ├── StringNode.tsx
│   │   │   ├── NumberNode.tsx
│   │   │   ├── JsonNode.tsx
│   │   │   └── FileNode.tsx
│   │   └── tool/
│   │       └── ToolNode.tsx      # 通用工具节点壳
│   └── edges/
│       └── TypeEdge.tsx          # 带类型颜色的连线
```

## 3. 类型系统

### 3.1 核心类型定义

```typescript
// lib/canvas/types.ts

type DataType = "string" | "number" | "json" | "bytes"

interface PortDefinition {
  id: string
  name: string
  dataType: DataType
  jsonTypename?: string   // 仅 json 类型有效
  required?: boolean
  defaultValue?: unknown
}

interface NodeDefinition {
  type: string             // 节点类型标识，如 "hash", "string", "json"
  category: string         // 分类：basic, crypto, image, text, dev, utility, viewer
  label: string
  icon: React.ComponentType
  inputs: PortDefinition[]
  outputs: PortDefinition[]
  config?: PortDefinition[]  // 配置项（不参与数据流）
  execute: (inputs: Record<string, unknown>, config: Record<string, unknown>) => Promise<Record<string, unknown>>
}

interface NodeInstance {
  id: string
  type: string             // 对应 NodeDefinition.type
  position: { x: number; y: number }
  config: Record<string, unknown>
}

interface Edge {
  id: string
  source: string           // 源节点 ID
  sourcePort: string       // 源端口 ID
  target: string           // 目标节点 ID
  targetPort: string       // 目标端口 ID
}

interface PortValue {
  dataType: DataType
  jsonTypename?: string
  value: unknown
}
```

### 3.2 类型颜色映射

```typescript
// lib/canvas/types/primitives.ts

export const TYPE_COLORS: Record<DataType, string> = {
  string: "#3B82F6",
  number: "#10B981",
  json:   "#8B5CF6",
  bytes:  "#F59E0B",
}

export const TYPE_BG_COLORS: Record<DataType, string> = {
  string: "bg-blue-500",
  number: "bg-emerald-500",
  json:   "bg-violet-500",
  bytes:  "bg-amber-500",
}
```

### 3.3 JSON typename 机制

```typescript
// lib/canvas/types/json-meta.ts

export interface JsonMeta {
  typename: string
}

export function createJsonType(typename: string): PortDefinition {
  return {
    id: "",
    name: "",
    dataType: "json",
    jsonTypename: typename,
  }
}

export function validateJsonTypename(
  outputTypename: string | undefined,
  inputTypename: string | undefined
): "match" | "mismatch" | "compatible" {
  if (!inputTypename || !outputTypename) return "compatible"
  if (outputTypename === inputTypename) return "match"
  return "mismatch"
}
```

## 4. 连接验证

```typescript
// lib/canvas/validation.ts

interface ValidationResult {
  valid: boolean
  level: "ok" | "warning" | "error"
  message?: string
}

export function validateConnection(
  sourcePort: PortDefinition,
  targetPort: PortDefinition
): ValidationResult {
  // 1. 完全相同的类型
  if (sourcePort.dataType === targetPort.dataType) {
    // JSON 需要额外检查 typename
    if (sourcePort.dataType === "json") {
      const result = validateJsonTypename(
        sourcePort.jsonTypename,
        targetPort.jsonTypename
      )
      if (result === "mismatch") {
        return {
          valid: true,  // 仍然允许连接
          level: "warning",
          message: `类型不匹配: 输出 "${sourcePort.jsonTypename}" → 输入 "${targetPort.jsonTypename}"，是否继续？`,
        }
      }
    }
    return { valid: true, level: "ok" }
  }

  // 2. 兼容类型 (string <-> number)
  if (
    (sourcePort.dataType === "string" && targetPort.dataType === "number") ||
    (sourcePort.dataType === "number" && targetPort.dataType === "string")
  ) {
    return {
      valid: true,
      level: "ok",
    }
  }

  // 3. 不兼容
  return {
    valid: false,
    level: "error",
    message: `类型不兼容: ${sourcePort.dataType} → ${targetPort.dataType}`,
  }
}

export function canAcceptInput(
  existingEdge: Edge | undefined,
  newSourcePort: PortDefinition,
  targetPort: PortDefinition
): boolean {
  // 输入端口只能连接一个输出
  if (existingEdge) return false
  return validateConnection(newSourcePort, targetPort).valid
}
```

## 5. 状态管理

```typescript
// lib/canvas/store.ts

import { create } from "zustand"
import { subscribeWithSelector } from "zustand/middleware"

interface CanvasState {
  // 数据
  nodes: NodeInstance[]
  edges: Edge[]

  // 节点操作
  addNode: (type: string, position: { x: number; y: number }) => void
  removeNode: (id: string) => void
  updateNodePosition: (id: string, position: { x: number; y: number }) => void
  updateNodeConfig: (id: string, config: Record<string, unknown>) => void

  // 连线操作
  addEdge: (edge: Omit<Edge, "id">) => void
  removeEdge: (id: string) => void

  // 执行
  nodeOutputs: Record<string, Record<string, unknown>>  // nodeId -> outputs
  nodeErrors: Record<string, string>                     // nodeId -> error
  nodeRunning: Record<string, boolean>                   // nodeId -> isRunning
  executeNode: (nodeId: string) => Promise<void>
  executeAll: () => Promise<void>

  // 持久化
  saveToLocalStorage: () => void
  loadFromLocalStorage: () => void
  exportCanvas: () => string
  importCanvas: (json: string) => void
}

export const useCanvasStore = create<CanvasState>()(
  subscribeWithSelector((set, get) => ({
    nodes: [],
    edges: [],
    nodeOutputs: {},
    nodeErrors: {},
    nodeRunning: {},

    addNode: (type, position) => {
      const id = `${type}-${Date.now()}`
      const definition = getNodeDefinition(type)
      const defaultConfig = {}
      if (definition?.config) {
        for (const cfg of definition.config) {
          if (cfg.defaultValue !== undefined) {
            defaultConfig[cfg.id] = cfg.defaultValue
          }
        }
      }
      set((state) => ({
        nodes: [...state.nodes, { id, type, position, config: defaultConfig }],
      }))
    },

    removeNode: (id) => {
      set((state) => ({
        nodes: state.nodes.filter((n) => n.id !== id),
        edges: state.edges.filter((e) => e.source !== id && e.target !== id),
      }))
    },

    addEdge: (edge) => {
      const id = `edge-${Date.now()}`
      set((state) => ({
        edges: [...state.edges, { ...edge, id }],
      }))
      // 自动执行目标节点
      get().executeNode(edge.target)
    },

    removeEdge: (id) => {
      const edge = get().edges.find((e) => e.id === id)
      set((state) => ({
        edges: state.edges.filter((e) => e.id !== id),
      }))
      if (edge) {
        get().executeNode(edge.target)
      }
    },

    executeNode: async (nodeId) => {
      const state = get()
      const node = state.nodes.find((n) => n.id === nodeId)
      if (!node) return

      const definition = getNodeDefinition(node.type)
      if (!definition) return

      // 收集输入
      const inputs: Record<string, unknown> = {}
      for (const inputDef of definition.inputs) {
        const edge = state.edges.find(
          (e) => e.target === nodeId && e.targetPort === inputDef.id
        )
        if (edge) {
          const sourceOutputs = state.nodeOutputs[edge.source]
          inputs[inputDef.id] = sourceOutputs?.[edge.sourcePort]
        } else if (inputDef.defaultValue !== undefined) {
          inputs[inputDef.id] = inputDef.defaultValue
        }
      }

      set((s) => ({
        nodeRunning: { ...s.nodeRunning, [nodeId]: true },
        nodeErrors: { ...s.nodeErrors, [nodeId]: undefined },
      }))

      try {
        const outputs = await definition.execute(inputs, node.config)
        set((s) => ({
          nodeOutputs: { ...s.nodeOutputs, [nodeId]: outputs },
          nodeRunning: { ...s.nodeRunning, [nodeId]: false },
        }))

        // 传播到下游节点
        const downstreamEdges = state.edges.filter((e) => e.source === nodeId)
        for (const edge of downstreamEdges) {
          await get().executeNode(edge.target)
        }
      } catch (error) {
        set((s) => ({
          nodeErrors: {
            ...s.nodeErrors,
            [nodeId]: error instanceof Error ? error.message : "Unknown error",
          },
          nodeRunning: { ...s.nodeRunning, [nodeId]: false },
        }))
      }
    },

    executeAll: async () => {
      const state = get()
      // 拓扑排序后按序执行
      const sorted = topologicalSort(state.nodes, state.edges)
      for (const node of sorted) {
        await get().executeNode(node.id)
      }
    },

    saveToLocalStorage: () => {
      const { nodes, edges } = get()
      localStorage.setItem(
        "canvas-state",
        JSON.stringify({ nodes, edges })
      )
    },

    loadFromLocalStorage: () => {
      const json = localStorage.getItem("canvas-state")
      if (json) {
        const { nodes, edges } = JSON.parse(json)
        set({ nodes, edges })
      }
    },

    exportCanvas: () => {
      const { nodes, edges } = get()
      return JSON.stringify({ nodes, edges }, null, 2)
    },

    importCanvas: (json) => {
      const { nodes, edges } = JSON.parse(json)
      set({ nodes, edges, nodeOutputs: {}, nodeErrors: {} })
    },
  }))
)
```

## 6. 执行引擎

```typescript
// lib/canvas/engine.ts

export function topologicalSort(
  nodes: NodeInstance[],
  edges: Edge[]
): NodeInstance[] {
  const inDegree = new Map<string, number>()
  const adjacency = new Map<string, string[]>()

  for (const node of nodes) {
    inDegree.set(node.id, 0)
    adjacency.set(node.id, [])
  }

  for (const edge of edges) {
    inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1)
    adjacency.get(edge.source)?.push(edge.target)
  }

  const queue: string[] = []
  for (const [id, degree] of inDegree) {
    if (degree === 0) queue.push(id)
  }

  const sorted: NodeInstance[] = []
  while (queue.length > 0) {
    const id = queue.shift()!
    const node = nodes.find((n) => n.id === id)
    if (node) sorted.push(node)

    for (const neighbor of adjacency.get(id) || []) {
      const newDegree = (inDegree.get(neighbor) || 1) - 1
      inDegree.set(neighbor, newDegree)
      if (newDegree === 0) queue.push(neighbor)
    }
  }

  return sorted
}
```

## 7. 工具适配器

```typescript
// lib/adapters/types.ts

export interface ToolAdapter {
  type: string
  category: string
  label: string
  icon: React.ComponentType
  inputs: PortDefinition[]
  outputs: PortDefinition[]
  config?: PortDefinition[]
  execute: (inputs: Record<string, unknown>, config: Record<string, unknown>) => Promise<Record<string, unknown>>
}

// lib/adapters/hash.ts

export const hashAdapter: ToolAdapter = {
  type: "hash",
  category: "crypto",
  label: "Hash",
  icon: HashIcon,
  inputs: [
    { id: "data", name: "数据", dataType: "string", required: true },
    { id: "algorithm", name: "算法", dataType: "string", defaultValue: "sha256" },
  ],
  outputs: [
    { id: "hash", name: "哈希值", dataType: "string" },
  ],
  config: [
    {
      id: "algorithm",
      name: "算法",
      dataType: "string",
      defaultValue: "sha256",
    },
    {
      id: "format",
      name: "输出格式",
      dataType: "string",
      defaultValue: "hex",
    },
  ],
  execute: async (inputs, config) => {
    const { calculateHash } = await import("@/app/tools/hash/page")
    const result = calculateHash(
      inputs.data as string,
      config.algorithm as string,
      config.format as string
    )
    return { hash: result }
  },
}
```

## 8. ReactFlow 集成

### 8.1 自定义节点组件

```tsx
// components/canvas/nodes/BaseNode.tsx

import { Handle, Position, NodeProps } from "@xyflow/react"
import { useCanvasStore } from "@/lib/canvas/store"
import { getNodeDefinition } from "@/lib/canvas/registry"
import { TYPE_COLORS } from "@/lib/canvas/types/primitives"

export function BaseNode({ id, data, type }: NodeProps) {
  const definition = getNodeDefinition(type)
  const outputs = useCanvasStore((s) => s.nodeOutputs[id])
  const error = useCanvasStore((s) => s.nodeErrors[id])
  const running = useCanvasStore((s) => s.nodeRunning[id])

  return (
    <div className={`
      bg-surface-container-high rounded-xl shadow-md min-w-[200px]
      ${error ? "ring-2 ring-red-500" : ""}
      ${running ? "ring-2 ring-blue-500 animate-pulse" : ""}
    `}>
      {/* Header */}
      <div className="px-3 py-2 border-b border-outline-variant flex items-center gap-2">
        <definition.icon className="w-4 h-4" />
        <span className="text-sm font-medium">{definition.label}</span>
      </div>

      {/* Inputs */}
      <div className="px-3 py-2 space-y-1">
        {definition.inputs.map((input) => (
          <div key={input.id} className="flex items-center gap-2 relative">
            <Handle
              type="target"
              position={Position.Left}
              id={input.id}
              style={{ background: TYPE_COLORS[input.dataType] }}
              className="!w-3 !h-3 !border-2 !border-background"
            />
            <span className="text-xs text-on-surface-variant">{input.name}</span>
          </div>
        ))}
      </div>

      {/* Outputs */}
      <div className="px-3 py-2 space-y-1 border-t border-outline-variant">
        {definition.outputs.map((output) => (
          <div key={output.id} className="flex items-center justify-end gap-2 relative">
            <span className="text-xs text-on-surface-variant">{output.name}</span>
            <Handle
              type="source"
              position={Position.Right}
              id={output.id}
              style={{ background: TYPE_COLORS[output.dataType] }}
              className="!w-3 !h-3 !border-2 !border-background"
            />
          </div>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="px-3 py-2 border-t border-red-500 bg-red-500/10">
          <p className="text-xs text-red-500">{error}</p>
        </div>
      )}
    </div>
  )
}
```

### 8.2 连接验证 Hook

```tsx
// components/canvas/hooks/useConnectionValidator.ts

import { useCallback } from "react"
import { useCanvasStore } from "@/lib/canvas/store"
import { validateConnection } from "@/lib/canvas/validation"
import { getNodeDefinition } from "@/lib/canvas/registry"

export function useConnectionValidator() {
  const edges = useCanvasStore((s) => s.edges)

  return useCallback(
    (params: { source: string; sourceHandle: string; target: string; targetHandle: string }) => {
      const sourceDef = getNodeDefinition(/* ... */)
      const targetDef = getNodeDefinition(/* ... */)
      const sourcePort = sourceDef.outputs.find((p) => p.id === params.sourceHandle)
      const targetPort = targetDef.inputs.find((p) => p.id === params.targetHandle)

      if (!sourcePort || !targetPort) return false

      const result = validateConnection(sourcePort, targetPort)

      if (!result.valid) return false

      if (result.level === "warning") {
        return window.confirm(result.message)
      }

      return true
    },
    [edges]
  )
}
```

## 9. 实施步骤

### Phase 1: 基础框架

1. 安装依赖: `reactflow`, `zustand`
2. 创建 `lib/canvas/types.ts` 核心类型
3. 创建 `lib/canvas/store.ts` Zustand store
4. 创建 `components/canvas/Canvas.tsx` 基础画布
5. 创建 `app/canvas/page.tsx` 页面入口
6. 实现 4 个基础节点 (String/Number/JSON/File)

### Phase 2: 工具适配

1. 创建 `lib/adapters/` 适配器框架
2. 实现 `lib/canvas/registry.ts` 节点注册表
3. 逐个工具创建适配器 (共 34 个)
4. 实现工具节点通用壳 `ToolNode.tsx`

### Phase 3: 连接与执行

1. 实现 `validation.ts` 连接验证
2. 实现 `engine.ts` 拓扑排序执行
3. 实现 JSON typename 警告对话框
4. 实现节点间数据传播

### Phase 4: 体验优化

1. 实现 `NodePalette.tsx` 侧边栏面板
2. 实现 `PropertyPanel.tsx` 属性面板
3. localStorage 持久化
4. 导入/导出功能
5. 移动端适配

---

## 10. 依赖项

```json
{
  "dependencies": {
    "@xyflow/react": "^12.0.0",
    "zustand": "^4.5.0"
  }
}
```
