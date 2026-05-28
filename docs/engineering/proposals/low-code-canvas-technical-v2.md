---
description: 低代码节点化画布 V2 技术方案 - 内联编辑与全量工具注册
type: proposal
references:
  - "[[low-code-canvas]]"
  - "[[low-code-canvas-technical]]"
---

# 低代码画布 V2 技术方案

## 1. 变更概述

基于 PR #1 review 反馈，需要对基础节点的交互方式进行重构。

### 核心变更

| 变更项 | V1 实现 | V2 方案 |
|--------|---------|---------|
| 基础节点编辑 | 值展示在节点，编辑在右侧面板 | **节点内嵌编辑框** |
| input 连接后 | 无特殊处理 | **禁用编辑框** |
| JSON 节点 | 单行 input | **多行 textarea** |
| File 节点 | 仅上传 | **上传 + 下载按钮** |
| 工具注册 | 5 个工具 | **全部 34 个工具** |

---

## 2. 新增组件设计

### 2.1 组件结构

```
components/canvas/nodes/
├── BaseNode.tsx          # 修改：集成 InlineEditor
├── InlineEditor.tsx      # 新增：编辑器容器
└── editors/
    ├── StringEditor.tsx  # 新增：单行输入框
    ├── NumberEditor.tsx  # 新增：数字输入框
    ├── JsonEditor.tsx    # 新增：多行 textarea
    └── FileEditor.tsx    # 新增：上传 + 下载
```

### 2.2 InlineEditor 容器

```tsx
// components/canvas/nodes/InlineEditor.tsx

interface InlineEditorProps {
  nodeId: string
  definition: NodeDefinition
}

export function InlineEditor({ nodeId, definition }: InlineEditorProps) {
  const edges = useCanvasStore((s) => s.edges)
  const config = useCanvasStore((s) => 
    s.nodes.find(n => n.id === nodeId)?.config ?? {}
  )
  const updateConfig = useCanvasStore((s) => s.updateNodeConfig)

  // 检查 input 端口是否已连接
  const isInputConnected = (portId: string) => {
    return edges.some((e) => e.target === nodeId && e.targetPort === portId)
  }

  // 根据节点类型渲染编辑器
  switch (definition.type) {
    case "string":
      return (
        <StringEditor
          value={config.value ?? ""}
          disabled={isInputConnected("input")}
          onChange={(v) => updateConfig(nodeId, { ...config, value: v })}
        />
      )
    case "number":
      return (
        <NumberEditor
          value={config.value ?? 0}
          disabled={isInputConnected("input")}
          onChange={(v) => updateConfig(nodeId, { ...config, value: v })}
        />
      )
    case "json":
      return (
        <JsonEditor
          value={config.value ?? "{}"}
          disabled={isInputConnected("input")}
          onChange={(v) => updateConfig(nodeId, { ...config, value: v })}
        />
      )
    case "file":
      return (
        <FileEditor
          disabled={isInputConnected("input")}
          file={config.file ?? null}
          onFileChange={(f) => updateConfig(nodeId, { ...config, file: f })}
        />
      )
    default:
      return null
  }
}
```

### 2.3 StringEditor

```tsx
// components/canvas/nodes/editors/StringEditor.tsx

interface StringEditorProps {
  value: string
  disabled: boolean
  onChange: (value: string) => void
}

export function StringEditor({ value, disabled, onChange }: StringEditorProps) {
  return (
    <div className="px-3 py-2 border-t border-outline-variant">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder="输入文本..."
        className="w-full px-2 py-1 text-xs bg-surface-container-low rounded 
                   border border-outline-variant 
                   disabled:opacity-50 disabled:cursor-not-allowed"
      />
    </div>
  )
}
```

### 2.4 NumberEditor

```tsx
// components/canvas/nodes/editors/NumberEditor.tsx

interface NumberEditorProps {
  value: number
  disabled: boolean
  onChange: (value: number) => void
}

export function NumberEditor({ value, disabled, onChange }: NumberEditorProps) {
  return (
    <div className="px-3 py-2 border-t border-outline-variant">
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        disabled={disabled}
        className="w-full px-2 py-1 text-xs bg-surface-container-low rounded 
                   border border-outline-variant 
                   disabled:opacity-50 disabled:cursor-not-allowed"
      />
    </div>
  )
}
```

### 2.5 JsonEditor

```tsx
// components/canvas/nodes/editors/JsonEditor.tsx

interface JsonEditorProps {
  value: string
  disabled: boolean
  onChange: (value: string) => void
}

export function JsonEditor({ value, disabled, onChange }: JsonEditorProps) {
  return (
    <div className="px-3 py-2 border-t border-outline-variant">
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        rows={4}
        placeholder='{"key": "value"}'
        className="w-full px-2 py-1 text-xs font-mono 
                   bg-surface-container-low rounded 
                   border border-outline-variant 
                   disabled:opacity-50 disabled:cursor-not-allowed
                   resize-y"
      />
    </div>
  )
}
```

### 2.6 FileEditor

```tsx
// components/canvas/nodes/editors/FileEditor.tsx

interface FileEditorProps {
  disabled: boolean
  file: File | null
  onFileChange: (file: File | null) => void
}

export function FileEditor({ disabled, file, onFileChange }: FileEditorProps) {
  const handleDownload = () => {
    if (!file) return
    const url = URL.createObjectURL(file)
    const a = document.createElement("a")
    a.href = url
    a.download = file.name
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="px-3 py-2 border-t border-outline-variant space-y-2">
      {/* 上传区域 */}
      {!disabled ? (
        <div className="border-2 border-dashed border-outline-variant rounded p-2 text-center">
          <input
            type="file"
            onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
            className="hidden"
            id={`file-upload`}
          />
          <label
            htmlFor={`file-upload`}
            className="cursor-pointer text-xs text-on-surface-variant"
          >
            点击或拖拽上传文件
          </label>
        </div>
      ) : (
        <div className="text-xs text-on-surface-variant">
          {file?.name ?? "无文件"}
        </div>
      )}

      {/* 下载按钮 - 始终可用 */}
      <button
        onClick={handleDownload}
        disabled={!file}
        className="w-full px-2 py-1 text-xs bg-primary text-on-primary rounded
                   disabled:opacity-50 disabled:cursor-not-allowed"
      >
        ⬇ 下载
      </button>
    </div>
  )
}
```

### 2.7 BaseNode 集成

```tsx
// components/canvas/nodes/BaseNode.tsx (修改)

export function BaseNode({ id, data, type }: NodeProps) {
  // ... existing code ...

  return (
    <div className="...">
      {/* Header */}
      <div className="...">...</div>

      {/* Inputs */}
      <div className="px-3 py-2 space-y-1">
        {definition.inputs.map((input) => (
          <div key={input.id} className="flex items-center gap-2 relative">
            <Handle type="target" position={Position.Left} id={input.id} />
            <span>{input.name}</span>
          </div>
        ))}
      </div>

      {/* 内联编辑器 - 新增 */}
      <InlineEditor nodeId={id} definition={definition} />

      {/* Outputs */}
      <div className="px-3 py-2 space-y-1 border-t border-outline-variant">
        {definition.outputs.map((output) => (
          <div key={output.id} className="flex items-center justify-end gap-2 relative">
            <span>{output.name}</span>
            <Handle type="source" position={Position.Right} id={output.id} />
          </div>
        ))}
      </div>

      {/* Error */}
      {error && <div className="...">...</div>}
    </div>
  )
}
```

---

## 3. 工具注册机制

### 3.1 注册表

```typescript
// lib/canvas/registry.ts

const nodeRegistry = new Map<string, NodeDefinition>()

export function registerNode(definition: NodeDefinition): void {
  nodeRegistry.set(definition.type, definition)
}

export function getNodeDefinition(type: string): NodeDefinition | undefined {
  return nodeRegistry.get(type)
}

export function getAllNodes(): NodeDefinition[] {
  return Array.from(nodeRegistry.values())
}

export function getNodesByCategory(category: string): NodeDefinition[] {
  return Array.from(nodeRegistry.values()).filter((n) => n.category === category)
}
```

### 3.2 统一注册入口

```typescript
// lib/adapters/index.ts

export function registerAllAdapters(): void {
  // 基础节点
  registerBasicNodes()
  
  // 编码加密 (6)
  registerHashAdapter()
  registerHmacAdapter()
  registerCryptoAdapter()
  registerEncodingAdapter()
  registerClassicCipherAdapter()
  registerJwtAdapter()
  
  // 数据格式 (3)
  registerJsonFormatAdapter()
  registerProtobufAdapter()
  registerJceAdapter()
  
  // 图片处理 (8)
  registerImageToBase64Adapter()
  registerExifViewerAdapter()
  registerImageCompressAdapter()
  registerImageEditorAdapter()
  registerQrcodeAdapter()
  registerQrcodeDecodeAdapter()
  registerMemeSplitterAdapter()
  registerImageCoordinatesAdapter()
  
  // 文本处理 (4)
  registerTextStatsAdapter()
  registerCaseConverterAdapter()
  registerRegexAdapter()
  registerDiffAdapter()
  
  // 开发工具 (4)
  registerHttpTesterAdapter()
  registerCrontabAdapter()
  registerDockerConverterAdapter()
  registerWhoisAdapter()
  
  // 实用工具 (7)
  registerUuidAdapter()
  registerTotpAdapter()
  registerColorAdapter()
  registerBaseConverterAdapter()
  registerTemperatureConverterAdapter()
  registerCurrencyAdapter()
  registerBmiAdapter()
  
  // 查看器 (3)
  registerDeviceInfoAdapter()
  registerOfficeViewerAdapter()
  registerTimeAdapter()
}
// 总计: 4 + 6 + 3 + 8 + 4 + 4 + 7 + 3 = 39 个注册函数
```

---

## 4. 基础节点适配器修改

```typescript
// lib/adapters/basic.ts (修改)

export const stringNode: ToolAdapter = {
  type: "string",
  category: "basic",
  label: "String",
  icon: Type,
  inputs: [
    { id: "input", name: "输入", dataType: "string" },  // 新增
  ],
  outputs: [
    { id: "output", name: "输出", dataType: "string" },
  ],
  config: [],
  execute: async (inputs, config) => {
    // 如果有输入连接，使用输入值；否则使用节点配置值
    return { output: inputs.input ?? config.value ?? "" }
  },
}

export const numberNode: ToolAdapter = {
  type: "number",
  category: "basic",
  label: "Number",
  icon: Hash,
  inputs: [
    { id: "input", name: "输入", dataType: "number" },  // 新增
  ],
  outputs: [
    { id: "output", name: "输出", dataType: "number" },
  ],
  config: [],
  execute: async (inputs, config) => {
    return { output: inputs.input ?? config.value ?? 0 }
  },
}

export const jsonNode: ToolAdapter = {
  type: "json",
  category: "basic",
  label: "JSON",
  icon: FileJson,
  inputs: [
    { id: "input", name: "输入", dataType: "json" },  // 新增
  ],
  outputs: [
    { id: "output", name: "输出", dataType: "json" },
  ],
  config: [
    { id: "typename", name: "Typename", dataType: "string", defaultValue: "" },
  ],
  execute: async (inputs, config) => {
    if (inputs.input !== undefined) {
      return { output: inputs.input }
    }
    // 从节点配置的 value 解析 JSON
    return { output: JSON.parse(config.value ?? "{}") }
  },
}

export const fileNode: ToolAdapter = {
  type: "file",
  category: "basic",
  label: "File",
  icon: File,
  inputs: [
    { id: "input", name: "输入", dataType: "bytes" },  // 新增
  ],
  outputs: [
    { id: "output", name: "输出", dataType: "bytes" },
  ],
  config: [],
  execute: async (inputs, config) => {
    return { output: inputs.input ?? config.file ?? null }
  },
}
```

---

## 5. 测试方案

### 5.1 组件测试

```typescript
// components/canvas/nodes/editors/StringEditor.test.tsx

describe("StringEditor", () => {
  it("渲染输入框", () => {
    render(<StringEditor value="hello" disabled={false} onChange={vi.fn()} />)
    expect(screen.getByDisplayValue("hello")).toBeInTheDocument()
  })

  it("disabled 时不可编辑", () => {
    render(<StringEditor value="hello" disabled={true} onChange={vi.fn()} />)
    expect(screen.getByDisplayValue("hello")).toBeDisabled()
  })

  it("输入时触发 onChange", () => {
    const onChange = vi.fn()
    render(<StringEditor value="" disabled={false} onChange={onChange} />)
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "world" } })
    expect(onChange).toHaveBeenCalledWith("world")
  })
})
```

### 5.2 E2E 测试

```typescript
// e2e/canvas.spec.ts (新增)

test("节点内编辑框显示", async ({ page }) => {
  // 添加 String 节点
  // 验证节点内有输入框
})

test("input 连接后编辑框禁用", async ({ page }) => {
  // 添加 String 节点和 Hash 节点
  // 连接 String.output -> Hash.data
  // 验证 Hash 节点的 data 输入框被禁用
})
```

---

## 6. 依赖项

无新增依赖，使用现有技术栈：
- React
- Tailwind CSS
- Zustand
- @xyflow/react
