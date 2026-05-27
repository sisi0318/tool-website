---
description: 低代码画布 V3 技术方案 - 节点参数行与输入组件
type: proposal
references:
  - "[[low-code-canvas-v2]]"
  - "[[low-code-canvas-technical-v2]]"
---

# 低代码画布 V3 技术方案

## 1. 变更概述

### 核心变更

| 变更项 | V2 | V3 |
|--------|----|----|
| 参数展示 | 仅基础节点有内联编辑器 | **所有节点显示参数行** |
| 参数布局 | 端口和编辑器分离 | **端口与参数同行** |
| String 控件 | 仅文本输入 | **文本输入 + 下拉单选** |
| Number 控件 | 仅数字输入 | **数字输入 + 滑块** |
| 联动选项 | 无 | **参数间联动** |

---

## 2. 类型系统变更

### 2.1 ConfigField 扩展

```typescript
// lib/canvas/types.ts

interface SliderConfig {
  min: number
  max: number
  step: number
}

interface ConfigField {
  id: string
  name: string
  dataType: "string" | "number" | "json" | "bytes"
  defaultValue?: unknown
  options?: Array<{ label: string; value: string }>
  slider?: SliderConfig                    // 新增
  dependsOn?: string                       // 新增：依赖的参数 ID
  dynamicOptions?: (dependentValue: string) => Array<{ label: string; value: string }>  // 新增
}
```

### 2.2 端口与参数关联

新增 `portId` 字段，将参数与端口关联：

```typescript
interface ConfigField {
  // ... existing fields
  portId?: string  // 关联的端口 ID（输入或输出）
}
```

当 `portId` 存在时，参数行同时渲染端口 handle。

---

## 3. 组件设计

### 3.1 组件结构

```
components/canvas/nodes/
├── BaseNode.tsx              # 修改：使用 ParameterRow
├── InlineEditor.tsx          # 删除：被 ParameterRow 替代
├── editors/                  # 删除：被 ParameterRow 替代
├── ParameterRow.tsx          # 新增：参数行容器
├── ConfigInput.tsx           # 新增：配置输入组件
├── SelectInput.tsx           # 新增：下拉单选
├── SliderInput.tsx           # 新增：滑块
└── TextInput.tsx             # 新增：文本输入
```

### 3.2 ParameterRow 组件

```tsx
// components/canvas/nodes/ParameterRow.tsx

interface ParameterRowProps {
  nodeId: string
  field: ConfigField
  value: unknown
  onChange: (value: unknown) => void
  disabled: boolean
}

export function ParameterRow({ nodeId, field, value, onChange, disabled }: ParameterRowProps) {
  const edges = useCanvasStore((s) => s.edges)
  
  // 检查关联端口是否已连接
  const isPortConnected = field.portId
    ? edges.some((e) => e.target === nodeId && e.targetPort === field.portId)
    : false

  return (
    <div className="flex items-center gap-2 px-3 py-1">
      {/* 左侧端口 */}
      {field.portId && (
        <Handle
          type="target"
          position={Position.Left}
          id={field.portId}
          style={{ background: TYPE_COLORS[field.dataType] }}
        />
      )}
      
      {/* 参数标签 */}
      <span className="text-xs text-gray-500 min-w-[60px]">{field.name}</span>
      
      {/* 参数输入 */}
      <div className="flex-1">
        <ConfigInput
          field={field}
          value={value}
          onChange={onChange}
          disabled={isPortConnected || disabled}
        />
      </div>
    </div>
  )
}
```

### 3.3 ConfigInput 组件

```tsx
// components/canvas/nodes/ConfigInput.tsx

export function ConfigInput({ field, value, onChange, disabled }: ConfigInputProps) {
  // 有 options → 下拉单选
  if (field.options) {
    return (
      <SelectInput
        options={field.options}
        value={String(value ?? field.defaultValue ?? "")}
        onChange={onChange}
        disabled={disabled}
      />
    )
  }

  // number + slider → 滑块
  if (field.dataType === "number" && field.slider) {
    return (
      <SliderInput
        min={field.slider.min}
        max={field.slider.max}
        step={field.slider.step}
        value={Number(value ?? field.defaultValue ?? 0)}
        onChange={onChange}
        disabled={disabled}
      />
    )
  }

  // number → 数字输入
  if (field.dataType === "number") {
    return (
      <input
        type="number"
        value={Number(value ?? field.defaultValue ?? 0)}
        onChange={(e) => onChange(Number(e.target.value))}
        disabled={disabled}
        className="w-full px-2 py-1 text-xs bg-gray-50 dark:bg-gray-900 rounded border border-gray-300 dark:border-gray-600"
      />
    )
  }

  // string → 文本输入
  return (
    <input
      type="text"
      value={String(value ?? field.defaultValue ?? "")}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="w-full px-2 py-1 text-xs bg-gray-50 dark:bg-gray-900 rounded border border-gray-300 dark:border-gray-600"
    />
  )
}
```

### 3.4 SelectInput 组件

```tsx
// components/canvas/nodes/SelectInput.tsx

interface SelectInputProps {
  options: Array<{ label: string; value: string }>
  value: string
  onChange: (value: string) => void
  disabled: boolean
}

export function SelectInput({ options, value, onChange, disabled }: SelectInputProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="w-full px-2 py-1 text-xs bg-gray-50 dark:bg-gray-900 rounded border border-gray-300 dark:border-gray-600"
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  )
}
```

### 3.5 SliderInput 组件

```tsx
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
  return (
    <div className="flex items-center gap-2">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        disabled={disabled}
        className="flex-1"
      />
      <span className="text-xs text-gray-500 w-8 text-right">{value}</span>
    </div>
  )
}
```

---

## 4. 联动选项实现

### 4.1 Hash 节点联动

```typescript
// lib/adapters/hash.ts

export const hashAdapter: ToolAdapter = {
  // ... existing fields
  config: [
    {
      id: "algorithm",
      name: "Algorithm",
      dataType: "string",
      defaultValue: "sha256",
      options: [
        { label: "MD5", value: "md5" },
        { label: "SHA-1", value: "sha1" },
        { label: "SHA-256", value: "sha256" },
        { label: "SHA-384", value: "sha384" },
        { label: "SHA-512", value: "sha512" },
        { label: "SHA3", value: "sha3" },
        { label: "RIPEMD-160", value: "ripemd160" },
      ],
    },
    {
      id: "variant",
      name: "Variant",
      dataType: "string",
      defaultValue: "sha3-256",
      dependsOn: "algorithm",
      dynamicOptions: (algorithm) => {
        if (algorithm === "sha3") {
          return [
            { label: "SHA3-256", value: "sha3-256" },
            { label: "SHA3-384", value: "sha3-384" },
            { label: "SHA3-512", value: "sha3-512" },
            { label: "SHAKE128", value: "shake128" },
            { label: "SHAKE256", value: "shake256" },
          ]
        }
        return []  // 空数组 = 隐藏此参数
      },
    },
  ],
}
```

### 4.2 联动渲染逻辑

```tsx
// components/canvas/nodes/ConfigInput.tsx

export function ConfigInput({ field, value, onChange, disabled, allConfig }: ConfigInputProps) {
  // 处理联动选项
  if (field.dependsOn && field.dynamicOptions) {
    const dependentValue = allConfig[field.dependsOn]
    const dynamicOpts = field.dynamicOptions(String(dependentValue ?? ""))
    
    // 空选项 = 隐藏此参数
    if (dynamicOpts.length === 0) return null
    
    return (
      <SelectInput
        options={dynamicOpts}
        value={String(value ?? field.defaultValue ?? "")}
        onChange={onChange}
        disabled={disabled}
      />
    )
  }

  // ... rest of component
}
```

---

## 5. BaseNode 重构

### 5.1 新布局

```tsx
// components/canvas/nodes/BaseNode.tsx

function BaseNodeComponent({ data }: BaseNodeProps) {
  const { definition, ...node } = data
  const config = useCanvasStore((s) => {
    const n = s.nodes.find((n) => n.id === node.id)
    return n?.config ?? {}
  })
  const updateConfig = useCanvasStore((s) => s.updateNodeConfig)

  // 分离端口关联参数和独立参数
  const portFields = definition.config.filter((f) => f.portId)
  const standaloneFields = definition.config.filter((f) => !f.portId)

  return (
    <div className="...">
      {/* Header */}
      <div className="...">...</div>

      {/* 输入端口 + 关联参数 */}
      {definition.inputs.map((port) => {
        const field = portFields.find((f) => f.portId === port.id)
        return (
          <div key={port.id} className="flex items-center gap-2 px-3 py-1">
            <Handle type="target" position={Position.Left} id={port.id} />
            <span className="text-xs text-gray-500">{port.name}</span>
            {field && (
              <ConfigInput
                field={field}
                value={config[field.id]}
                onChange={(v) => updateConfig(node.id, { ...config, [field.id]: v })}
                disabled={false}
                allConfig={config}
              />
            )}
          </div>
        )
      })}

      {/* 独立参数 */}
      {standaloneFields.map((field) => (
        <ParameterRow
          key={field.id}
          nodeId={node.id}
          field={field}
          value={config[field.id]}
          onChange={(v) => updateConfig(node.id, { ...config, [field.id]: v })}
          disabled={false}
        />
      ))}

      {/* 输出端口 */}
      {definition.outputs.map((port) => (
        <div key={port.id} className="flex items-center justify-end gap-2 px-3 py-1">
          <span className="text-xs text-gray-500">{port.name}</span>
          <Handle type="source" position={Position.Right} id={port.id} />
        </div>
      ))}
    </div>
  )
}
```

---

## 6. 全量参数配置表

### 6.1 需要修改的适配器

| 适配器 | 修改内容 |
|--------|----------|
| hash | 添加 `variant` 参数 (联动), 添加 `slider` 到 `algorithm` |
| json-format | 添加 `slider` 到 `indent` |
| image-compress | 添加 `slider` 到 `quality` |
| image-editor | 添加 `slider` 到 `brightness`, `contrast` |
| qrcode | 添加 `slider` 到 `size` |

### 6.2 完整参数配置

#### hash
```typescript
config: [
  {
    id: "algorithm",
    name: "Algorithm",
    dataType: "string",
    defaultValue: "sha256",
    options: [
      { label: "MD5", value: "md5" },
      { label: "SHA-1", value: "sha1" },
      { label: "SHA-256", value: "sha256" },
      { label: "SHA-384", value: "sha384" },
      { label: "SHA-512", value: "sha512" },
      { label: "SHA3", value: "sha3" },
      { label: "RIPEMD-160", value: "ripemd160" },
    ],
  },
  {
    id: "variant",
    name: "Variant",
    dataType: "string",
    defaultValue: "sha3-256",
    dependsOn: "algorithm",
    dynamicOptions: (algorithm) => {
      if (algorithm === "sha3") {
        return [
          { label: "SHA3-256", value: "sha3-256" },
          { label: "SHA3-384", value: "sha3-384" },
          { label: "SHA3-512", value: "sha3-512" },
          { label: "SHAKE128", value: "shake128" },
          { label: "SHAKE256", value: "shake256" },
        ]
      }
      return []
    },
  },
]
```

#### json-format
```typescript
config: [
  {
    id: "indent",
    name: "Indent",
    dataType: "number",
    defaultValue: 2,
    slider: { min: 0, max: 8, step: 1 },
  },
]
```

#### image-compress
```typescript
config: [
  {
    id: "quality",
    name: "Quality",
    dataType: "number",
    defaultValue: 80,
    slider: { min: 1, max: 100, step: 1 },
  },
]
```

#### image-editor
```typescript
config: [
  {
    id: "brightness",
    name: "Brightness",
    dataType: "number",
    defaultValue: 100,
    slider: { min: 0, max: 200, step: 1 },
  },
  {
    id: "contrast",
    name: "Contrast",
    dataType: "number",
    defaultValue: 100,
    slider: { min: 0, max: 200, step: 1 },
  },
  {
    id: "grayscale",
    name: "Grayscale",
    dataType: "string",
    defaultValue: "false",
    options: [
      { label: "No", value: "false" },
      { label: "Yes", value: "true" },
    ],
  },
]
```

#### qrcode
```typescript
config: [
  {
    id: "size",
    name: "Size",
    dataType: "number",
    defaultValue: 200,
    slider: { min: 100, max: 500, step: 10 },
  },
  {
    id: "errorCorrection",
    name: "Error Correction",
    dataType: "string",
    defaultValue: "M",
    options: [
      { label: "Low", value: "L" },
      { label: "Medium", value: "M" },
      { label: "Quartile", value: "Q" },
      { label: "High", value: "H" },
    ],
  },
]
```

---

## 7. 单元测试

### 7.1 测试文件

```
components/canvas/nodes/
├── ConfigInput.test.tsx
├── SelectInput.test.tsx
├── SliderInput.test.tsx
├── TextInput.test.tsx
└── ParameterRow.test.tsx
```

### 7.2 测试覆盖

| 组件 | 测试项 |
|------|--------|
| ConfigInput | 有 options → 渲染 SelectInput |
| ConfigInput | number + slider → 渲染 SliderInput |
| ConfigInput | number → 渲染 number input |
| ConfigInput | string → 渲染 text input |
| ConfigInput | 有 dependsOn + dynamicOptions → 渲染联动下拉 |
| ConfigInput | dependsOn 返回空数组 → 不渲染 |
| SelectInput | 渲染所有选项 |
| SelectInput | 选择触发 onChange |
| SelectInput | disabled 禁用选择 |
| SliderInput | 渲染 min/max/step |
| SliderInput | 拖动触发 onChange |
| SliderInput | 显示当前值 |
| ParameterRow | 渲染端口 handle |
| ParameterRow | 端口连接时禁用输入 |
| ParameterRow | 无端口时不渲染 handle |

### 7.3 全量参数渲染测试

对每个有 config 的节点，测试参数行正确渲染：

```typescript
describe("Node Parameter Rendering", () => {
  const nodesWithConfig = [
    { type: "hash", config: { algorithm: "sha256" }, expectedControls: ["select"] },
    { type: "hmac", config: { algorithm: "sha256" }, expectedControls: ["select"] },
    { type: "crypto", config: { algorithm: "aes-256-cbc", mode: "encrypt" }, expectedControls: ["select", "select"] },
    { type: "encoding", config: { encoding: "base64" }, expectedControls: ["select"] },
    { type: "classic-cipher", config: { cipher: "caesar", shift: 3 }, expectedControls: ["select", "number"] },
    { type: "json-format", config: { indent: 2 }, expectedControls: ["slider"] },
    { type: "protobuf", config: { mode: "decode" }, expectedControls: ["select"] },
    { type: "jce", config: { mode: "decode" }, expectedControls: ["select"] },
    { type: "image-compress", config: { quality: 80 }, expectedControls: ["slider"] },
    { type: "image-editor", config: { brightness: 100, contrast: 100, grayscale: "false" }, expectedControls: ["slider", "slider", "select"] },
    { type: "qrcode", config: { size: 200, errorCorrection: "M" }, expectedControls: ["slider", "select"] },
    { type: "meme-splitter", config: { rows: 2, cols: 1 }, expectedControls: ["number", "number"] },
    { type: "regex", config: { pattern: "", flags: "g", replacement: "" }, expectedControls: ["text", "text", "text"] },
    { type: "http-tester", config: { method: "GET", headers: "{}" }, expectedControls: ["select", "text"] },
    { type: "docker-converter", config: { format: "dockerfile" }, expectedControls: ["select"] },
    { type: "uuid", config: { version: "v4" }, expectedControls: ["select"] },
    { type: "base-converter", config: { fromBase: "10" }, expectedControls: ["select"] },
    { type: "temperature-converter", config: { fromUnit: "celsius" }, expectedControls: ["select"] },
    { type: "currency", config: { from: "USD", to: "EUR" }, expectedControls: ["select", "select"] },
    { type: "time", config: { timezone: "UTC" }, expectedControls: ["select"] },
  ]
})
```

---

## 8. 依赖项

无新增依赖，使用现有技术栈。
