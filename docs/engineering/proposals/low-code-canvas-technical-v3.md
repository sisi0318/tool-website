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
| 新增控件 | — | **开关、颜色选择器** |
| 联动选项 | 无 | **参数间动态联动** |

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
  dataType: "string" | "number" | "json" | "bytes" | "boolean"
  defaultValue?: unknown
  options?: Array<{ label: string; value: string }>
  slider?: SliderConfig
  multiline?: boolean                    // 新增：多行文本
  color?: boolean                        // 新增：颜色选择器
  dependsOn?: string                     // 新增：依赖的参数 ID
  dynamicOptions?: (dependentValue: string) => Array<{ label: string; value: string }>
  portId?: string                        // 新增：关联的端口 ID
}
```

### 2.2 控件选择逻辑

```
if (dataType === "boolean")           → 开关 (Switch)
if (color === true)                   → 颜色选择器 (ColorPicker)
if (options 存在)                     → 下拉单选 (Select)
if (dataType === "number" && slider)  → 滑块 (Slider)
if (dataType === "number")            → 数字输入 (NumberInput)
if (multiline === true)               → 多行文本 (Textarea)
else                                  → 文本输入 (TextInput)
```

---

## 3. 组件设计

### 3.1 组件结构

```
components/canvas/nodes/
├── BaseNode.tsx              # 重构：使用 ParameterRow
├── InlineEditor.tsx          # 删除：被 ParameterRow 替代
├── editors/                  # 删除：被 ParameterRow 替代
├── ParameterRow.tsx          # 新增：参数行容器
├── ConfigInput.tsx           # 新增：配置输入分发
├── SelectInput.tsx           # 新增：下拉单选
├── SliderInput.tsx           # 新增：滑块
├── SwitchInput.tsx           # 新增：开关
├── ColorInput.tsx            # 新增：颜色选择器
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
  allConfig: Record<string, unknown>
}

export function ParameterRow({ nodeId, field, value, onChange, disabled, allConfig }: ParameterRowProps) {
  const edges = useCanvasStore((s) => s.edges)
  
  // 处理联动选项
  if (field.dependsOn && field.dynamicOptions) {
    const dependentValue = allConfig[field.dependsOn]
    const dynamicOpts = field.dynamicOptions(String(dependentValue ?? ""))
    if (dynamicOpts.length === 0) return null  // 空 = 隐藏
  }

  // 检查关联端口是否已连接
  const isPortConnected = field.portId
    ? edges.some((e) => e.target === nodeId && e.targetPort === field.portId)
    : false

  return (
    <div className="flex items-center gap-2 px-3 py-1">
      {/* 左侧端口 */}
      {field.portId && (
        <Handle type="target" position={Position.Left} id={field.portId} />
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
          allConfig={allConfig}
        />
      </div>
    </div>
  )
}
```

### 3.3 ConfigInput 组件

```tsx
// components/canvas/nodes/ConfigInput.tsx

export function ConfigInput({ field, value, onChange, disabled, allConfig }: ConfigInputProps) {
  // 处理联动选项
  let options = field.options
  if (field.dependsOn && field.dynamicOptions) {
    const dependentValue = allConfig[field.dependsOn]
    const dynamicOpts = field.dynamicOptions(String(dependentValue ?? ""))
    if (dynamicOpts.length > 0) options = dynamicOpts
  }

  // boolean → 开关
  if (field.dataType === "boolean") {
    return (
      <SwitchInput
        checked={Boolean(value ?? field.defaultValue ?? false)}
        onChange={onChange}
        disabled={disabled}
      />
    )
  }

  // 颜色选择器
  if (field.color) {
    return (
      <ColorInput
        value={String(value ?? field.defaultValue ?? "#000000")}
        onChange={onChange}
        disabled={disabled}
      />
    )
  }

  // 有 options → 下拉单选
  if (options) {
    return (
      <SelectInput
        options={options}
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

  // multiline → 多行文本
  if (field.multiline) {
    return (
      <textarea
        value={String(value ?? field.defaultValue ?? "")}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        rows={3}
        className="w-full px-2 py-1 text-xs font-mono bg-gray-50 dark:bg-gray-900 rounded border border-gray-300 dark:border-gray-600 resize-y"
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

### 3.4 新增组件

#### SwitchInput
```tsx
interface SwitchInputProps {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled: boolean
}

export function SwitchInput({ checked, onChange, disabled }: SwitchInputProps) {
  return (
    <label className="relative inline-flex items-center cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className="sr-only peer"
      />
      <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:bg-blue-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all" />
    </label>
  )
}
```

#### ColorInput
```tsx
interface ColorInputProps {
  value: string
  onChange: (value: string) => void
  disabled: boolean
}

export function ColorInput({ value, onChange, disabled }: ColorInputProps) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-8 h-8 rounded cursor-pointer"
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="flex-1 px-2 py-1 text-xs font-mono bg-gray-50 dark:bg-gray-900 rounded border border-gray-300 dark:border-gray-600"
      />
    </div>
  )
}
```

---

## 4. 全量适配器配置

### 4.1 需要修改的适配器

| 适配器 | 修改内容 |
|--------|----------|
| hash | 添加 variant (联动), outputFormat |
| hmac | 添加 keyFormat, outputFormat |
| crypto | 重构: algorithm, mode, keySize, keyFormat, ivFormat |
| encoding | 扩展 encoding 选项 |
| classic-cipher | 重构: 添加联动参数 |
| json-format | 添加 slider, sortKeys |
| protobuf | 添加 indentSize |
| image-to-base64 | 添加 outputFormat |
| exif-viewer | 添加 category |
| image-compress | 添加 slider, outputFormat |
| image-editor | 重构: 添加 saturation, 重构 slider |
| qrcode | 添加颜色选择, 重构 slider |
| qrcode-decode | 添加 slider |
| meme-splitter | 重构: rows/cols 改为 slider |
| regex | 添加 multiline |
| http-tester | 添加 headers multiline |
| uuid | 添加 uppercase, withHyphens |
| base-converter | 扩展 fromBase 选项 |
| temperature-converter | 添加 precision |
| time | 保持不变 |

### 4.2 完整配置

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
  {
    id: "outputFormat",
    name: "Output",
    dataType: "string",
    defaultValue: "hex",
    options: [
      { label: "Hex", value: "hex" },
      { label: "Base64", value: "base64" },
    ],
  },
]
```

#### classic-cipher
```typescript
config: [
  {
    id: "algorithm",
    name: "Algorithm",
    dataType: "string",
    defaultValue: "caesar",
    options: [
      { label: "Caesar", value: "caesar" },
      { label: "ROT13", value: "rot13" },
      { label: "Atbash", value: "atbash" },
      { label: "Vigenere", value: "vigenere" },
      { label: "Playfair", value: "playfair" },
      { label: "Rail Fence", value: "rail-fence" },
      { label: "Columnar", value: "columnar" },
      { label: "Affine", value: "affine" },
    ],
  },
  {
    id: "shift",
    name: "Shift",
    dataType: "number",
    defaultValue: 3,
    dependsOn: "algorithm",
    dynamicOptions: (algorithm) => algorithm === "caesar" ? [{ label: "1-25", value: "1-25" }] : [],
  },
  {
    id: "key",
    name: "Key",
    dataType: "string",
    defaultValue: "",
    dependsOn: "algorithm",
    dynamicOptions: (algorithm) => ["vigenere", "playfair"].includes(algorithm) ? [{ label: "Key", value: "key" }] : [],
  },
  {
    id: "railCount",
    name: "Rails",
    dataType: "number",
    defaultValue: 3,
    dependsOn: "algorithm",
    dynamicOptions: (algorithm) => algorithm === "rail-fence" ? [{ label: "2-10", value: "2-10" }] : [],
  },
  {
    id: "colKey",
    name: "Column Key",
    dataType: "string",
    defaultValue: "",
    dependsOn: "algorithm",
    dynamicOptions: (algorithm) => algorithm === "columnar" ? [{ label: "Key", value: "key" }] : [],
  },
  {
    id: "affineA",
    name: "Affine A",
    dataType: "number",
    defaultValue: 5,
    dependsOn: "algorithm",
    dynamicOptions: (algorithm) => algorithm === "affine" ? [{ label: "1-25", value: "1-25" }] : [],
  },
  {
    id: "affineB",
    name: "Affine B",
    dataType: "number",
    defaultValue: 8,
    dependsOn: "algorithm",
    dynamicOptions: (algorithm) => algorithm === "affine" ? [{ label: "0-25", value: "0-25" }] : [],
  },
]
```

#### crypto
```typescript
config: [
  {
    id: "algorithm",
    name: "Algorithm",
    dataType: "string",
    defaultValue: "aes",
    options: [
      { label: "AES", value: "aes" },
      { label: "DES", value: "des" },
      { label: "TripleDES", value: "tripledes" },
      { label: "Blowfish", value: "blowfish" },
      { label: "RC4", value: "rc4" },
      { label: "Rabbit", value: "rabbit" },
    ],
  },
  {
    id: "mode",
    name: "Mode",
    dataType: "string",
    defaultValue: "CBC",
    dependsOn: "algorithm",
    dynamicOptions: (algorithm) => {
      if (["rc4", "rabbit"].includes(algorithm)) return [{ label: "Stream", value: "stream" }]
      return [
        { label: "CBC", value: "CBC" },
        { label: "ECB", value: "ECB" },
        { label: "CFB", value: "CFB" },
        { label: "OFB", value: "OFB" },
        { label: "CTR", value: "CTR" },
      ]
    },
  },
  {
    id: "keySize",
    name: "Key Size",
    dataType: "string",
    defaultValue: "256",
    dependsOn: "algorithm",
    dynamicOptions: (algorithm) => {
      const sizes: Record<string, Array<{ label: string; value: string }>> = {
        aes: [{ label: "128", value: "128" }, { label: "192", value: "192" }, { label: "256", value: "256" }],
        des: [{ label: "64", value: "64" }],
        tripledes: [{ label: "192", value: "192" }],
        blowfish: [{ label: "32-448", value: "448" }],
        rc4: [{ label: "Variable", value: "variable" }],
        rabbit: [{ label: "128", value: "128" }],
      }
      return sizes[algorithm] ?? []
    },
  },
  {
    id: "keyFormat",
    name: "Key Format",
    dataType: "string",
    defaultValue: "hex",
    options: [
      { label: "Hex", value: "hex" },
      { label: "Base64", value: "base64" },
      { label: "Raw", value: "raw" },
    ],
  },
]
```

#### encoding
```typescript
config: [
  {
    id: "encoding",
    name: "Encoding",
    dataType: "string",
    defaultValue: "base64",
    options: [
      { label: "Base64", value: "base64" },
      { label: "URL", value: "url" },
      { label: "HEX", value: "hex" },
      { label: "HTML", value: "html" },
      { label: "Unicode", value: "unicode" },
      { label: "UTF-8", value: "utf8" },
      { label: "ASCII", value: "ascii" },
      { label: "Base32", value: "base32" },
      { label: "Binary", value: "binary" },
      { label: "Morse", value: "morse" },
      { label: "ROT13", value: "rot13" },
    ],
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
  {
    id: "sortKeys",
    name: "Sort Keys",
    dataType: "boolean",
    defaultValue: false,
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
    slider: { min: 10, max: 100, step: 5 },
  },
  {
    id: "outputFormat",
    name: "Format",
    dataType: "string",
    defaultValue: "original",
    options: [
      { label: "Original", value: "original" },
      { label: "JPEG", value: "jpeg" },
      { label: "WebP", value: "webp" },
      { label: "PNG", value: "png" },
    ],
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
    id: "saturation",
    name: "Saturation",
    dataType: "number",
    defaultValue: 100,
    slider: { min: 0, max: 200, step: 1 },
  },
  {
    id: "grayscale",
    name: "Grayscale",
    dataType: "boolean",
    defaultValue: false,
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
      { label: "Low (7%)", value: "L" },
      { label: "Medium (15%)", value: "M" },
      { label: "Quartile (25%)", value: "Q" },
      { label: "High (30%)", value: "H" },
    ],
  },
  {
    id: "fgColor",
    name: "Foreground",
    dataType: "string",
    defaultValue: "#000000",
    color: true,
  },
  {
    id: "bgColor",
    name: "Background",
    dataType: "string",
    defaultValue: "#FFFFFF",
    color: true,
  },
]
```

#### meme-splitter
```typescript
config: [
  {
    id: "rows",
    name: "Rows",
    dataType: "number",
    defaultValue: 4,
    slider: { min: 1, max: 10, step: 1 },
  },
  {
    id: "cols",
    name: "Cols",
    dataType: "number",
    defaultValue: 6,
    slider: { min: 1, max: 10, step: 1 },
  },
]
```

#### uuid
```typescript
config: [
  {
    id: "version",
    name: "Version",
    dataType: "string",
    defaultValue: "v4",
    options: [
      { label: "v4 (Random)", value: "v4" },
      { label: "v1 (Time-based)", value: "v1" },
    ],
  },
  {
    id: "uppercase",
    name: "Uppercase",
    dataType: "boolean",
    defaultValue: false,
  },
  {
    id: "withHyphens",
    name: "Hyphens",
    dataType: "boolean",
    defaultValue: true,
  },
]
```

#### base-converter
```typescript
config: [
  {
    id: "fromBase",
    name: "Input Base",
    dataType: "string",
    defaultValue: "10",
    options: [
      { label: "Binary (2)", value: "2" },
      { label: "Octal (8)", value: "8" },
      { label: "Decimal (10)", value: "10" },
      { label: "Hex (16)", value: "16" },
      { label: "Base32", value: "32" },
      { label: "Base36", value: "36" },
      { label: "Base58", value: "58" },
      { label: "Base62", value: "62" },
      { label: "Base64", value: "64" },
    ],
  },
]
```

#### temperature-converter
```typescript
config: [
  {
    id: "fromUnit",
    name: "From",
    dataType: "string",
    defaultValue: "celsius",
    options: [
      { label: "Kelvin", value: "kelvin" },
      { label: "Celsius", value: "celsius" },
      { label: "Fahrenheit", value: "fahrenheit" },
      { label: "Rankine", value: "rankine" },
      { label: "Delisle", value: "delisle" },
      { label: "Newton", value: "newton" },
      { label: "Réaumur", value: "reaumur" },
      { label: "Rømer", value: "romer" },
    ],
  },
  {
    id: "precision",
    name: "Precision",
    dataType: "string",
    defaultValue: "2",
    options: [
      { label: "0", value: "0" },
      { label: "1", value: "1" },
      { label: "2", value: "2" },
      { label: "3", value: "3" },
      { label: "4", value: "4" },
    ],
  },
]
```

---

## 5. 单元测试

### 5.1 测试文件

```
components/canvas/nodes/
├── ConfigInput.test.tsx
├── SelectInput.test.tsx
├── SliderInput.test.tsx
├── SwitchInput.test.tsx
├── ColorInput.test.tsx
├── TextInput.test.tsx
└── ParameterRow.test.tsx
```

### 5.2 测试覆盖

| 组件 | 测试项 |
|------|--------|
| ConfigInput | boolean → 渲染 SwitchInput |
| ConfigInput | color → 渲染 ColorInput |
| ConfigInput | options → 渲染 SelectInput |
| ConfigInput | number + slider → 渲染 SliderInput |
| ConfigInput | number → 渲染 number input |
| ConfigInput | multiline → 渲染 textarea |
| ConfigInput | string → 渲染 text input |
| ConfigInput | dependsOn + dynamicOptions → 渲染联动下拉 |
| ConfigInput | dependsOn 返回空数组 → 不渲染 |
| SelectInput | 渲染所有选项 |
| SelectInput | 选择触发 onChange |
| SelectInput | disabled 禁用选择 |
| SliderInput | 渲染 min/max/step |
| SliderInput | 拖动触发 onChange |
| SliderInput | 显示当前值 |
| SwitchInput | 切换触发 onChange |
| SwitchInput | disabled 禁用切换 |
| ColorInput | 渲染颜色选择器 |
| ColorInput | 选择触发 onChange |
| ParameterRow | 渲染端口 handle |
| ParameterRow | 端口连接时禁用输入 |
| ParameterRow | 无端口时不渲染 handle |

### 5.3 全量参数渲染测试

对每个有 config 的节点，测试参数行正确渲染。

---

## 6. 验收标准

| 检查项 | 标准 |
|--------|------|
| 参数行渲染 | 所有有 config 的节点显示参数行 |
| 下拉单选 | 42 个下拉参数正确渲染 |
| 滑块 | 14 个滑块参数正确渲染 |
| 开关 | 8 个开关参数正确渲染 |
| 颜色选择 | 2 个颜色参数正确渲染 |
| 联动选项 | Hash/Classic Cipher/Crypto 联动正确 |
| 端口同行 | 输入端口与关联参数在同一行 |
| 执行输出 | 连接基础节点 → 工具 → 基础节点，有正确输出 |
| 单元测试 | 所有参数渲染覆盖 |
