# Phase 4 实现计划

## 实施步骤

### Step 1: Boolean 基础类型节点

**文件变更：**
- `lib/adapters/basic.ts` - 添加 booleanNode
- `lib/adapters/basic.test.ts` - 添加 Boolean 测试
- `lib/adapters/execute.test.ts` - 添加 Boolean execute 测试
- `e2e/canvas-pipelines.spec.ts` - 添加 E2E 测试

**实现细节：**

```typescript
// lib/adapters/basic.ts - 新增 booleanNode
import { Type, Hash, FileJson, File, ToggleLeft } from "lucide-react"

export const booleanNode: ToolAdapter = {
  type: "boolean",
  category: "basic",
  label: "Boolean",
  icon: ToggleLeft,
  config: [
    {
      id: "value",
      name: "Value",
      dataType: "boolean",
      defaultValue: false,
      hasInput: true,
      hasOutput: true,
    },
  ],
  outputs: [],
  async execute(inputs, config) {
    return { value: Boolean(inputs.value ?? config.value ?? false) }
  },
}

// 注册函数更新
export function registerBasicNodes(): void {
  registerNode(stringNode)
  registerNode(numberNode)
  registerNode(jsonNode)
  registerNode(fileNode)
  registerNode(booleanNode)  // 新增
}
```

**Canvas.tsx 更新：**
```typescript
// 更新 isBasic 判断
const isBasic = ["string", "number", "json", "file", "boolean"].includes(node.type)
```

**测试：**
```typescript
// lib/adapters/basic.test.ts
describe("booleanNode", () => {
  it("定义正确", () => {
    expect(booleanNode.type).toBe("boolean")
    expect(booleanNode.category).toBe("basic")
    expect(booleanNode.config).toHaveLength(1)
    expect(booleanNode.config[0].dataType).toBe("boolean")
    expect(booleanNode.config[0].hasInput).toBe(true)
    expect(booleanNode.config[0].hasOutput).toBe(true)
  })

  it("execute 返回布尔值", async () => {
    const result = await booleanNode.execute({}, { value: true })
    expect(result).toEqual({ value: true })
  })

  it("execute 默认值 false", async () => {
    const result = await booleanNode.execute({}, {})
    expect(result).toEqual({ value: false })
  })
})
```

---

### Step 2: JSON Path 节点

**文件变更：**
- `lib/adapters/json-path.ts` - 新建文件
- `lib/adapters/index.ts` - 注册
- `lib/adapters/execute.test.ts` - 测试
- `e2e/canvas-pipelines.spec.ts` - E2E 测试

**实现细节：**

```typescript
// lib/adapters/json-path.ts
import { Braces } from "lucide-react"
import type { ToolAdapter } from "./types"
import { registerNode } from "../canvas/registry"

function getByPath(obj: unknown, path: string): unknown {
  if (path === "$") return obj
  if (!path.startsWith("$")) throw new Error("Path must start with $")
  
  const parts = path
    .replace(/^\$\.?/, "")
    .split(/\.|\[|\]/)
    .filter(Boolean)
  
  let current = obj
  for (const part of parts) {
    if (current == null) return undefined
    if (/^\d+$/.test(part)) {
      const index = parseInt(part)
      if (!Array.isArray(current)) throw new Error("Cannot index non-array")
      current = current[index]
    } else {
      if (typeof current !== "object") throw new Error("Cannot access property of non-object")
      current = (current as Record<string, unknown>)[part]
    }
  }
  return current
}

export const jsonPathAdapter: ToolAdapter = {
  type: "json-path",
  category: "data",
  label: "JSON Path",
  icon: Braces,
  config: [
    {
      id: "json",
      name: "JSON",
      dataType: "string",
      defaultValue: "{}",
      multiline: true,
      hasInput: true,
      hasOutput: false,
    },
    {
      id: "path",
      name: "Path",
      dataType: "string",
      defaultValue: "$",
      hasInput: true,
      hasOutput: false,
    },
  ],
  outputs: [
    { id: "result", name: "Result", dataType: "json" },
  ],
  async execute(inputs, config) {
    const jsonStr = String(inputs.json ?? config.json ?? "{}")
    const path = String(inputs.path ?? config.path ?? "$")
    
    let parsed: unknown
    try {
      parsed = JSON.parse(jsonStr)
    } catch {
      throw new Error("Invalid JSON")
    }
    
    const result = getByPath(parsed, path)
    return { result }
  },
}

export function registerJsonPathAdapter(): void {
  registerNode(jsonPathAdapter)
}
```

**测试：**
```typescript
// lib/adapters/execute.test.ts
describe("JSON Path", () => {
  it("查询根路径", async () => {
    const def = getNodeDefinition("json-path")!
    const result = await def.execute({}, { json: '{"a":1}', path: "$" })
    expect(result.result).toEqual({ a: 1 })
  })

  it("查询嵌套路径", async () => {
    const def = getNodeDefinition("json-path")!
    const result = await def.execute({}, { json: '{"a":{"b":2}}', path: "$.a.b" })
    expect(result.result).toBe(2)
  })

  it("查询数组索引", async () => {
    const def = getNodeDefinition("json-path")!
    const result = await def.execute({}, { json: '{"arr":[1,2,3]}', path: "$.arr[1]" })
    expect(result.result).toBe(2)
  })

  it("无效 JSON 抛出错误", async () => {
    const def = getNodeDefinition("json-path")!
    await expect(def.execute({}, { json: "invalid", path: "$" })).rejects.toThrow("Invalid JSON")
  })
})
```

---

### Step 3: File 转换节点（4个）

**文件变更：**
- `lib/adapters/base64-to-file.ts` - 新建
- `lib/adapters/file-to-base64.ts` - 新建
- `lib/adapters/file-to-string.ts` - 新建
- `lib/adapters/string-to-file.ts` - 新建
- `lib/adapters/index.ts` - 注册
- `lib/adapters/execute.test.ts` - 测试

**实现细节：**

```typescript
// lib/adapters/base64-to-file.ts
import { FileUp } from "lucide-react"
import type { ToolAdapter } from "./types"
import { registerNode } from "../canvas/registry"

export const base64ToFileAdapter: ToolAdapter = {
  type: "base64-to-file",
  category: "data",
  label: "Base64 To File",
  icon: FileUp,
  config: [
    {
      id: "base64",
      name: "Base64",
      dataType: "string",
      defaultValue: "",
      hasInput: true,
      hasOutput: false,
    },
    {
      id: "filename",
      name: "Filename",
      dataType: "string",
      defaultValue: "file",
      hasInput: true,
      hasOutput: false,
    },
    {
      id: "mimeType",
      name: "MIME Type",
      dataType: "string",
      defaultValue: "application/octet-stream",
      hasInput: true,
      hasOutput: false,
    },
  ],
  outputs: [
    { id: "file", name: "File", dataType: "bytes" },
  ],
  async execute(inputs, config) {
    const base64 = String(inputs.base64 ?? config.base64 ?? "")
    const filename = String(inputs.filename ?? config.filename ?? "file")
    const mimeType = String(inputs.mimeType ?? config.mimeType ?? "application/octet-stream")
    
    try {
      const binaryStr = atob(base64)
      const bytes = new Uint8Array(binaryStr.length)
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i)
      }
      const file = new File([bytes], filename, { type: mimeType })
      return { file }
    } catch {
      throw new Error("Invalid Base64 string")
    }
  },
}

export function registerBase64ToFileAdapter(): void {
  registerNode(base64ToFileAdapter)
}
```

```typescript
// lib/adapters/file-to-base64.ts
import { FileDown } from "lucide-react"
import type { ToolAdapter } from "./types"
import { registerNode } from "../canvas/registry"

export const fileToBase64Adapter: ToolAdapter = {
  type: "file-to-base64",
  category: "data",
  label: "File To Base64",
  icon: FileDown,
  config: [
    {
      id: "file",
      name: "File",
      dataType: "bytes",
      hasInput: true,
      hasOutput: false,
    },
  ],
  outputs: [
    { id: "base64", name: "Base64", dataType: "string" },
  ],
  async execute(inputs, config) {
    const file = (inputs.file ?? config.file) as File | null
    if (!file) throw new Error("No file provided")
    
    const arrayBuffer = await file.arrayBuffer()
    const bytes = new Uint8Array(arrayBuffer)
    let binary = ""
    for (const byte of bytes) {
      binary += String.fromCharCode(byte)
    }
    const base64 = btoa(binary)
    return { base64 }
  },
}

export function registerFileToBase64Adapter(): void {
  registerNode(fileToBase64Adapter)
}
```

```typescript
// lib/adapters/file-to-string.ts
import { FileType } from "lucide-react"
import type { ToolAdapter } from "./types"
import { registerNode } from "../canvas/registry"

export const fileToStringAdapter: ToolAdapter = {
  type: "file-to-string",
  category: "data",
  label: "File To String",
  icon: FileType,
  config: [
    {
      id: "file",
      name: "File",
      dataType: "bytes",
      hasInput: true,
      hasOutput: false,
    },
  ],
  outputs: [
    { id: "content", name: "Content", dataType: "string" },
  ],
  async execute(inputs, config) {
    const file = (inputs.file ?? config.file) as File | null
    if (!file) throw new Error("No file provided")
    
    const content = await file.text()
    return { content }
  },
}

export function registerFileToStringAdapter(): void {
  registerNode(fileToStringAdapter)
}
```

```typescript
// lib/adapters/string-to-file.ts
import { FileOutput } from "lucide-react"
import type { ToolAdapter } from "./types"
import { registerNode } from "../canvas/registry"

export const stringToFileAdapter: ToolAdapter = {
  type: "string-to-file",
  category: "data",
  label: "String To File",
  icon: FileOutput,
  config: [
    {
      id: "content",
      name: "Content",
      dataType: "string",
      defaultValue: "",
      multiline: true,
      hasInput: true,
      hasOutput: false,
    },
    {
      id: "filename",
      name: "Filename",
      dataType: "string",
      defaultValue: "file.txt",
      hasInput: true,
      hasOutput: false,
    },
  ],
  outputs: [
    { id: "file", name: "File", dataType: "bytes" },
  ],
  async execute(inputs, config) {
    const content = String(inputs.content ?? config.content ?? "")
    const filename = String(inputs.filename ?? config.filename ?? "file.txt")
    
    const file = new File([content], filename, { type: "text/plain" })
    return { file }
  },
}

export function registerStringToFileAdapter(): void {
  registerNode(stringToFileAdapter)
}
```

---

### Step 4: Preview 节点（3个）

**文件变更：**
- `lib/adapters/string-preview.ts` - 新建
- `lib/adapters/json-preview.ts` - 新建
- `lib/adapters/image-preview.ts` - 新建
- `lib/adapters/index.ts` - 注册
- `components/canvas/nodes/JsonTreeViewer.tsx` - 新建（JSON 树形组件）

**实现细节：**

```typescript
// lib/adapters/string-preview.ts
import { Eye } from "lucide-react"
import type { ToolAdapter } from "./types"
import { registerNode } from "../canvas/registry"

export const stringPreviewAdapter: ToolAdapter = {
  type: "string-preview",
  category: "viewer",
  label: "String Preview",
  icon: Eye,
  config: [
    {
      id: "content",
      name: "Content",
      dataType: "string",
      defaultValue: "",
      multiline: true,
      hasInput: true,
      hasOutput: false,  // 只输入，无输出
    },
  ],
  outputs: [],
  async execute(inputs, config) {
    return { content: String(inputs.content ?? config.content ?? "") }
  },
}

export function registerStringPreviewAdapter(): void {
  registerNode(stringPreviewAdapter)
}
```

```typescript
// lib/adapters/json-preview.ts
import { Braces } from "lucide-react"
import type { ToolAdapter } from "./types"
import { registerNode } from "../canvas/registry"

export const jsonPreviewAdapter: ToolAdapter = {
  type: "json-preview",
  category: "viewer",
  label: "JSON Preview",
  icon: Braces,
  config: [
    {
      id: "json",
      name: "JSON",
      dataType: "string",
      defaultValue: "{}",
      multiline: true,
      hasInput: true,
      hasOutput: false,  // 只输入，无输出
    },
  ],
  outputs: [],
  async execute(inputs, config) {
    const jsonStr = String(inputs.json ?? config.json ?? "{}")
    try {
      const parsed = JSON.parse(jsonStr)
      return { parsed }
    } catch {
      throw new Error("Invalid JSON")
    }
  },
}

export function registerJsonPreviewAdapter(): void {
  registerNode(jsonPreviewAdapter)
}
```

```typescript
// lib/adapters/image-preview.ts
import { Image } from "lucide-react"
import type { ToolAdapter } from "./types"
import { registerNode } from "../canvas/registry"

export const imagePreviewAdapter: ToolAdapter = {
  type: "image-preview",
  category: "viewer",
  label: "Image Preview",
  icon: Image,
  config: [
    {
      id: "file",
      name: "File",
      dataType: "bytes",
      hasInput: true,
      hasOutput: false,  // 只输入，无输出
    },
  ],
  outputs: [],
  async execute(inputs, config) {
    const file = (inputs.file ?? config.file) as File | null
    if (!file) throw new Error("No file provided")
    
    if (!file.type.startsWith("image/")) {
      throw new Error("File is not an image")
    }
    
    return { file, size: file.size, type: file.type }
  },
}

export function registerImagePreviewAdapter(): void {
  registerNode(imagePreviewAdapter)
}
```

**JSON 树形组件：**
```tsx
// components/canvas/nodes/JsonTreeViewer.tsx
"use client"

import { useState, useCallback } from "react"

interface JsonTreeViewerProps {
  data: unknown
  depth?: number
}

export function JsonTreeViewer({ data, depth = 0 }: JsonTreeViewerProps) {
  const [expanded, setExpanded] = useState(depth < 2)
  
  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setExpanded(prev => !prev)
  }, [])
  
  if (data === null) return <span className="text-gray-400">null</span>
  if (data === undefined) return <span className="text-gray-400">undefined</span>
  if (typeof data === "boolean") return <span className="text-purple-400">{String(data)}</span>
  if (typeof data === "number") return <span className="text-blue-400">{data}</span>
  if (typeof data === "string") return <span className="text-green-400">"{data}"</span>
  
  if (Array.isArray(data)) {
    return (
      <div className="font-mono text-[10px]">
        <button
          onClick={handleClick}
          className="text-gray-500 hover:text-gray-700"
        >
          {expanded ? "▼" : "▶"} [{data.length}]
        </button>
        {expanded && (
          <div className="ml-4 border-l border-gray-200 pl-2">
            {data.map((item, i) => (
              <div key={i} className="flex gap-1">
                <span className="text-gray-400">{i}:</span>
                <JsonTreeViewer data={item} depth={depth + 1} />
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }
  
  if (typeof data === "object") {
    const entries = Object.entries(data as Record<string, unknown>)
    return (
      <div className="font-mono text-[10px]">
        <button
          onClick={handleClick}
          className="text-gray-500 hover:text-gray-700"
        >
          {expanded ? "▼" : "▶"} {"{"}{entries.length}{"}"}
        </button>
        {expanded && (
          <div className="ml-4 border-l border-gray-200 pl-2">
            {entries.map(([key, value]) => (
              <div key={key} className="flex gap-1">
                <span className="text-yellow-500">"{key}"</span>:
                <JsonTreeViewer data={value} depth={depth + 1} />
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }
  
  return <span>{String(data)}</span>
}
```

**Preview 节点 UI 渲染：**

需要在 ToolNode.tsx 中添加 Preview 节点的特殊渲染逻辑：

```typescript
// components/canvas/nodes/ToolNode.tsx - 添加 Preview 渲染
import { JsonTreeViewer } from "./JsonTreeViewer"

// 在节点内容区域添加 Preview 显示
{node.type === "string-preview" && nodeOutputs[node.id]?.content && (
  <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-900 rounded max-h-32 overflow-auto">
    <pre className="text-[10px] whitespace-pre-wrap break-words">
      {String(nodeOutputs[node.id].content)}
    </pre>
  </div>
)}

{node.type === "json-preview" && nodeOutputs[node.id]?.parsed && (
  <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-900 rounded max-h-48 overflow-auto">
    <JsonTreeViewer data={nodeOutputs[node.id].parsed} />
  </div>
)}

{node.type === "image-preview" && nodeOutputs[node.id]?.file && (
  <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-900 rounded">
    <img
      src={URL.createObjectURL(nodeOutputs[node.id].file as File)}
      alt="Preview"
      className="max-w-full max-h-48 object-contain"
    />
  </div>
)}
```

---

### Step 5: QRCode Decode 修复

**文件变更：**
- `lib/adapters/qrcode-decode.ts` - 修复解码逻辑

**实现细节：**

使用浏览器原生 BarcodeDetector API，已在 PR #10 中实现。无需额外修改。

---

### Step 6: Slider 点击不拖动画布

**文件变更：**
- `components/canvas/nodes/SliderInput.tsx` - 添加 stopPropagation

**实现细节：**

```typescript
// components/canvas/nodes/SliderInput.tsx
interface SliderInputProps {
  min: number
  max: number
  step: number
  value: number
  onChange: (value: number) => void
  disabled: boolean
}

export function SliderInput({ min, max, step, value, onChange, disabled }: SliderInputProps) {
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
  }, [])
  
  return (
    <div 
      className="flex items-center gap-2" 
      data-testid="slider-input"
      onMouseDown={handleMouseDown}
    >
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        disabled={disabled}
        className="flex-1 disabled:opacity-50"
      />
      <span className="text-xs text-gray-500 w-8 text-right">{value}</span>
    </div>
  )
}
```

**同样修复 ColorInput.tsx：**
```typescript
// components/canvas/nodes/ColorInput.tsx
const handleMouseDown = useCallback((e: React.MouseEvent) => {
  e.stopPropagation()
}, [])

return (
  <div onMouseDown={handleMouseDown}>
    <input type="color" ... />
  </div>
)
```

---

### Step 7: Delete 键删除选中的 Node/Edge

**文件变更：**
- `components/canvas/Canvas.tsx` - 添加键盘事件监听

**实现细节：**

```typescript
// components/canvas/Canvas.tsx
import { useCallback, useMemo, useEffect } from "react"

export function Canvas() {
  const {
    nodes: storeNodes,
    edges: storeEdges,
    addNode,
    addEdge: addStoreEdge,
    updateNodePosition,
    removeNode,
    removeEdge,
    selectedNodeId,
  } = useCanvasStore()
  
  // Delete 键删除选中节点
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Delete" || e.key === "Backspace") {
        // 检查是否在输入框中
        const target = e.target as HTMLElement
        if (
          target.tagName === "INPUT" || 
          target.tagName === "TEXTAREA" || 
          target.isContentEditable
        ) {
          return
        }
        
        if (selectedNodeId) {
          removeNode(selectedNodeId)
        }
      }
    }
    
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [selectedNodeId, removeNode])
  
  // Edge 删除回调
  const onEdgesDelete = useCallback(
    (deletedEdges: any[]) => {
      for (const edge of deletedEdges) {
        removeEdge(edge.id)
      }
    },
    [removeEdge]
  )
  
  return (
    <div className="w-full h-full" data-testid="canvas-drop-zone">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onEdgesDelete={onEdgesDelete}  // 新增
        nodeTypes={nodeTypes}
        fitView
      >
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>
    </div>
  )
}
```

---

## 文件变更清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `lib/adapters/basic.ts` | 修改 | 添加 booleanNode |
| `lib/adapters/json-path.ts` | 新建 | JSON Path 节点 |
| `lib/adapters/base64-to-file.ts` | 新建 | Base64 To File |
| `lib/adapters/file-to-base64.ts` | 新建 | File To Base64 |
| `lib/adapters/file-to-string.ts` | 新建 | File To String |
| `lib/adapters/string-to-file.ts` | 新建 | String To File |
| `lib/adapters/string-preview.ts` | 新建 | String Preview |
| `lib/adapters/json-preview.ts` | 新建 | JSON Preview |
| `lib/adapters/image-preview.ts` | 新建 | Image Preview |
| `lib/adapters/index.ts` | 修改 | 注册新节点 |
| `lib/adapters/execute.test.ts` | 修改 | 添加测试 |
| `lib/adapters/basic.test.ts` | 修改 | 添加 Boolean 测试 |
| `components/canvas/nodes/SliderInput.tsx` | 修改 | stopPropagation |
| `components/canvas/nodes/ColorInput.tsx` | 修改 | stopPropagation |
| `components/canvas/nodes/JsonTreeViewer.tsx` | 新建 | JSON 树形组件 |
| `components/canvas/nodes/ToolNode.tsx` | 修改 | Preview 渲染 |
| `components/canvas/Canvas.tsx` | 修改 | Delete 键支持 |
| `e2e/canvas-pipelines.spec.ts` | 修改 | E2E 测试 |

---

## 测试计划

### 单元测试

```typescript
// lib/adapters/execute.test.ts - 新增测试

describe("New nodes", () => {
  it("boolean: execute 返回布尔值", async () => {
    const def = getNodeDefinition("boolean")!
    const result = await def.execute({}, { value: true })
    expect(result.value).toBe(true)
  })

  it("json-path: 查询嵌套路径", async () => {
    const def = getNodeDefinition("json-path")!
    const result = await def.execute({}, { json: '{"a":{"b":2}}', path: "$.a.b" })
    expect(result.result).toBe(2)
  })

  it("base64-to-file: 转换 Base64 到 File", async () => {
    const def = getNodeDefinition("base64-to-file")!
    const result = await def.execute({}, { base64: btoa("test"), filename: "test.txt" })
    expect(result.file).toBeInstanceOf(File)
  })

  it("file-to-base64: 转换 File 到 Base64", async () => {
    const def = getNodeDefinition("file-to-base64")!
    const file = new File(["test"], "test.txt", { type: "text/plain" })
    const result = await def.execute({}, { file })
    expect(result.base64).toBe(btoa("test"))
  })

  it("string-preview: 配置正确", () => {
    const def = getNodeDefinition("string-preview")!
    expect(def.config).toHaveLength(1)
    expect(def.outputs).toHaveLength(0)  // 无输出
  })

  it("json-preview: 配置正确", () => {
    const def = getNodeDefinition("json-preview")!
    expect(def.config).toHaveLength(1)
    expect(def.outputs).toHaveLength(0)  // 无输出
  })

  it("image-preview: 配置正确", () => {
    const def = getNodeDefinition("image-preview")!
    expect(def.config).toHaveLength(1)
    expect(def.outputs).toHaveLength(0)  // 无输出
  })
})
```

### E2E 测试

```typescript
// e2e/canvas-pipelines.spec.ts - 新增测试

test("Boolean node: toggle switch and verify output", async ({ page }) => {
  // 拖拽 Boolean 节点
  await page.locator('[data-testid="node-boolean"]').dragTo(canvas)
  
  // 切换开关
  await page.locator('[data-testid="switch-input"]').click()
  
  // 验证输出
  await expect(page.locator('[data-testid="node-output"]')).toContainText("true")
})

test("JSON Path node: query nested path", async ({ page }) => {
  // 拖拽 JSON 和 JSON Path 节点
  await page.locator('[data-testid="node-json"]').dragTo(canvas)
  await page.locator('[data-testid="node-json-path"]').dragTo(canvas)
  
  // 连线
  await page.locator('[data-testid="port-json-parsed"]').dragTo(
    page.locator('[data-testid="port-json-path-json"]')
  )
  
  // 设置路径
  await page.locator('[data-testid="input-path"]').fill("$.store.book[0].title")
  
  // 验证结果
  await expect(page.locator('[data-testid="output-result"]')).toContainText("value")
})

test("Delete key removes selected node", async ({ page }) => {
  // 拖拽节点
  await page.locator('[data-testid="node-string"]').dragTo(canvas)
  
  // 选中节点
  await page.locator('[data-testid="node-string"]').click()
  
  // 按 Delete 键
  await page.keyboard.press("Delete")
  
  // 验证节点已删除
  await expect(page.locator('[data-testid="node-string"]')).not.toBeVisible()
})
```

---

## 实施顺序

1. **Phase 1: Boolean 节点** (30min)
   - 修改 `lib/adapters/basic.ts`
   - 更新 `Canvas.tsx` 的 isBasic 判断
   - 添加单元测试

2. **Phase 2: JSON Path 节点** (1h)
   - 新建 `lib/adapters/json-path.ts`
   - 更新 `lib/adapters/index.ts`
   - 添加单元测试

3. **Phase 3: File 转换节点** (1.5h)
   - 新建 4 个文件
   - 更新 `lib/adapters/index.ts`
   - 添加单元测试

4. **Phase 4: Preview 节点** (2h)
   - 新建 3 个文件
   - 新建 `JsonTreeViewer.tsx`
   - 更新 `ToolNode.tsx` 渲染逻辑
   - 添加单元测试

5. **Phase 5: 交互优化** (1h)
   - 修改 `SliderInput.tsx`
   - 修改 `ColorInput.tsx`
   - 修改 `Canvas.tsx`

6. **Phase 6: 测试完善** (1h)
   - 添加 E2E 测试
   - 运行所有测试
   - Build 验证

**总计：约 7 小时**
