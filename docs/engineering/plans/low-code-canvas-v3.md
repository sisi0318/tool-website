---
description: 低代码画布 V3 实现计划 - 节点参数行与输入组件
type: plan
references:
  - "[[low-code-canvas-v3]]"
  - "[[low-code-canvas-technical-v3]]"
---

# 低代码画布 V3 实现计划

## 1. 任务总览

| Task | 内容 | 文件数 |
|------|------|--------|
| Task 1 | 新增输入组件 | 6 |
| Task 2 | 重构 BaseNode | 1 |
| Task 3 | 修改全部适配器配置 | 20 |
| Task 4 | 单元测试 | 8 |
| Task 5 | E2E 测试更新 | 1 |

---

## 2. Task 1: 新增输入组件

### 2.1 新增文件

| 文件 | 职责 |
|------|------|
| `components/canvas/nodes/ConfigInput.tsx` | 配置输入分发组件 |
| `components/canvas/nodes/SelectInput.tsx` | 下拉单选 |
| `components/canvas/nodes/SliderInput.tsx` | 滑块 |
| `components/canvas/nodes/SwitchInput.tsx` | 开关 |
| `components/canvas/nodes/ColorInput.tsx` | 颜色选择器 |
| `components/canvas/nodes/ParameterRow.tsx` | 参数行容器 |

### 2.2 删除文件

| 文件 | 原因 |
|------|------|
| `components/canvas/nodes/InlineEditor.tsx` | 被 ParameterRow 替代 |
| `components/canvas/nodes/editors/StringEditor.tsx` | 被 ConfigInput 替代 |
| `components/canvas/nodes/editors/NumberEditor.tsx` | 被 ConfigInput 替代 |
| `components/canvas/nodes/editors/JsonEditor.tsx` | 被 ConfigInput 替代 |
| `components/canvas/nodes/editors/FileEditor.tsx` | 被 ConfigInput 替代 |
| `components/canvas/nodes/editors/*.test.tsx` | 对应组件删除 |

---

## 3. Task 2: 重构 BaseNode

### 3.1 修改文件

| 文件 | 修改内容 |
|------|----------|
| `components/canvas/nodes/BaseNode.tsx` | 使用 ParameterRow 替代 InlineEditor |

### 3.2 新布局结构

```
Header (icon + label)
├── 输入端口行 (port + 关联参数)
│   ├── ● input    [输入值/控件]
│   ├── ● data     [输入值/控件]
│   └── ● key      [输入值/控件]
├── 独立参数行
│   ├── [▼ Algorithm]
│   ├── [●━━━━━━━━●━━━]
│   └── [☐ Switch]
└── 输出端口行
    ├── [输出值]  ● output
    └── [输出值]  ● result
```

---

## 4. Task 3: 修改全部适配器配置

### 4.1 basic (4 个)

#### string
```typescript
// lib/adapters/basic.ts
config: [
  { id: "value", name: "Value", dataType: "string", defaultValue: "", portId: "input" },
]
```
- 无变更

#### number
```typescript
config: [
  { id: "value", name: "Value", dataType: "number", defaultValue: 0, portId: "input" },
]
```
- 无变更

#### json
```typescript
config: [
  { id: "value", name: "Value", dataType: "string", defaultValue: "{}", multiline: true, portId: "input" },
]
```
- **修改**: 添加 `multiline: true`

#### file
```typescript
config: [
  { id: "file", name: "File", dataType: "bytes", portId: "input" },
]
```
- 无变更

---

### 4.2 crypto (6 个)

#### hash
```typescript
// lib/adapters/hash.ts
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
**修改**: 添加 variant (联动), outputFormat, 扩展 algorithm 选项

#### hmac
```typescript
// lib/adapters/hmac.ts
config: [
  {
    id: "algorithm",
    name: "Algorithm",
    dataType: "string",
    defaultValue: "sha256",
    options: [
      { label: "MD5", value: "md5" },
      { label: "SHA-1", value: "sha1" },
      { label: "SHA-224", value: "sha224" },
      { label: "SHA-256", value: "sha256" },
      { label: "SHA-384", value: "sha384" },
      { label: "SHA-512", value: "sha512" },
      { label: "SHA3-256", value: "sha3-256" },
      { label: "SHA3-512", value: "sha3-512" },
      { label: "RIPEMD-160", value: "ripemd160" },
    ],
  },
  {
    id: "keyFormat",
    name: "Key Format",
    dataType: "string",
    defaultValue: "raw",
    options: [
      { label: "Raw", value: "raw" },
      { label: "Hex", value: "hex" },
      { label: "Base64", value: "base64" },
    ],
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
**修改**: 添加 keyFormat, outputFormat, 扩展 algorithm 选项

#### crypto
```typescript
// lib/adapters/crypto.ts
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
  {
    id: "operation",
    name: "Operation",
    dataType: "string",
    defaultValue: "encrypt",
    options: [
      { label: "Encrypt", value: "encrypt" },
      { label: "Decrypt", value: "decrypt" },
    ],
  },
]
```
**修改**: 重构整个 config，添加联动

#### encoding
```typescript
// lib/adapters/encoding.ts
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
**修改**: 扩展 encoding 选项

#### classic-cipher
```typescript
// lib/adapters/classic-cipher.ts
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
**修改**: 重构整个 config，添加联动参数

#### jwt
- 无变更 (config: [])

---

### 4.3 data (3 个)

#### json-format
```typescript
// lib/adapters/json-format.ts
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
**修改**: indent 添加 slider, 添加 sortKeys

#### protobuf
```typescript
// lib/adapters/protobuf.ts
config: [
  {
    id: "mode",
    name: "Mode",
    dataType: "string",
    defaultValue: "decode",
    options: [
      { label: "Decode", value: "decode" },
      { label: "Encode", value: "encode" },
    ],
  },
  {
    id: "indentSize",
    name: "Indent",
    dataType: "number",
    defaultValue: 2,
    slider: { min: 0, max: 8, step: 1 },
  },
]
```
**修改**: 添加 indentSize

#### jce
```typescript
// lib/adapters/jce.ts
config: [
  {
    id: "mode",
    name: "Mode",
    dataType: "string",
    defaultValue: "decode",
    options: [
      { label: "Decode", value: "decode" },
      { label: "Encode", value: "encode" },
    ],
  },
]
```
- 无变更

---

### 4.4 image (8 个)

#### image-to-base64
```typescript
// lib/adapters/image-to-base64.ts
config: [
  {
    id: "outputFormat",
    name: "Output",
    dataType: "string",
    defaultValue: "base64",
    options: [
      { label: "Base64", value: "base64" },
      { label: "Data URL", value: "dataUrl" },
      { label: "CSS", value: "css" },
      { label: "HTML", value: "html" },
    ],
  },
]
```
**修改**: 添加 outputFormat

#### exif-viewer
```typescript
// lib/adapters/exif-viewer.ts
config: [
  {
    id: "category",
    name: "Category",
    dataType: "string",
    defaultValue: "all",
    options: [
      { label: "All", value: "all" },
      { label: "Camera", value: "camera" },
      { label: "Image", value: "image" },
      { label: "Location", value: "location" },
      { label: "DateTime", value: "datetime" },
      { label: "Technical", value: "technical" },
    ],
  },
]
```
**修改**: 添加 category

#### image-compress
```typescript
// lib/adapters/image-compress.ts
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
**修改**: quality 添加 slider, 添加 outputFormat

#### image-editor
```typescript
// lib/adapters/image-editor.ts
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
**修改**: 重构，添加 saturation, grayscale 改为 boolean

#### qrcode
```typescript
// lib/adapters/qrcode.ts
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
**修改**: size 添加 slider, 添加颜色选择

#### qrcode-decode
- 无变更 (config: [])

#### meme-splitter
```typescript
// lib/adapters/meme-splitter.ts
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
**修改**: rows/cols 添加 slider

#### image-coordinates
- 无变更 (config: [])

---

### 4.5 text (4 个)

#### text-stats
- 无变更 (config: [])

#### case-converter
- 无变更 (config: [])

#### regex
```typescript
// lib/adapters/regex.ts
config: [
  {
    id: "pattern",
    name: "Pattern",
    dataType: "string",
    defaultValue: "",
  },
  {
    id: "flags",
    name: "Flags",
    dataType: "string",
    defaultValue: "g",
  },
  {
    id: "replacement",
    name: "Replacement",
    dataType: "string",
    defaultValue: "",
    multiline: true,
  },
]
```
**修改**: replacement 添加 multiline

#### diff
- 无变更 (config: [])

---

### 4.6 dev (4 个)

#### http-tester
```typescript
// lib/adapters/http-tester.ts
config: [
  {
    id: "method",
    name: "Method",
    dataType: "string",
    defaultValue: "GET",
    options: [
      { label: "GET", value: "GET" },
      { label: "POST", value: "POST" },
      { label: "PUT", value: "PUT" },
      { label: "DELETE", value: "DELETE" },
      { label: "PATCH", value: "PATCH" },
    ],
  },
  {
    id: "headers",
    name: "Headers",
    dataType: "string",
    defaultValue: "{}",
    multiline: true,
  },
]
```
**修改**: headers 添加 multiline

#### crontab
- 无变更 (config: [])

#### docker-converter
```typescript
// lib/adapters/docker-converter.ts
config: [
  {
    id: "format",
    name: "Format",
    dataType: "string",
    defaultValue: "dockerfile",
    options: [
      { label: "Dockerfile", value: "dockerfile" },
      { label: "Docker Compose", value: "compose" },
    ],
  },
]
```
- 无变更

#### whois
- 无变更 (config: [])

---

### 4.7 utility (7 个)

#### uuid
```typescript
// lib/adapters/uuid.ts
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
**修改**: 添加 uppercase, withHyphens

#### totp
- 无变更 (config: [])

#### color
- 无变更 (config: [])

#### base-converter
```typescript
// lib/adapters/base-converter.ts
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
**修改**: 扩展 fromBase 选项

#### temperature-converter
```typescript
// lib/adapters/temperature-converter.ts
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
**修改**: 扩展 fromUnit 选项, 添加 precision

#### currency
```typescript
// lib/adapters/currency.ts
config: [
  {
    id: "from",
    name: "From",
    dataType: "string",
    defaultValue: "USD",
    options: [
      { label: "USD", value: "USD" },
      { label: "EUR", value: "EUR" },
      { label: "GBP", value: "GBP" },
      { label: "JPY", value: "JPY" },
      { label: "CNY", value: "CNY" },
    ],
  },
  {
    id: "to",
    name: "To",
    dataType: "string",
    defaultValue: "EUR",
    options: [
      { label: "USD", value: "USD" },
      { label: "EUR", value: "EUR" },
      { label: "GBP", value: "GBP" },
      { label: "JPY", value: "JPY" },
      { label: "CNY", value: "CNY" },
    ],
  },
]
```
- 无变更

#### bmi
- 无变更 (config: [])

---

### 4.8 viewer (3 个)

#### device-info
- 无变更 (config: [])

#### office-viewer
- 无变更 (config: [])

#### time
```typescript
// lib/adapters/time.ts
config: [
  {
    id: "timezone",
    name: "Timezone",
    dataType: "string",
    defaultValue: "UTC",
    options: [
      { label: "UTC", value: "UTC" },
      { label: "Local", value: "local" },
    ],
  },
]
```
- 无变更

---

## 5. Task 4: 单元测试

### 5.1 新增测试文件

| 文件 | 测试组件 |
|------|----------|
| `components/canvas/nodes/ConfigInput.test.tsx` | ConfigInput |
| `components/canvas/nodes/SelectInput.test.tsx` | SelectInput |
| `components/canvas/nodes/SliderInput.test.tsx` | SliderInput |
| `components/canvas/nodes/SwitchInput.test.tsx` | SwitchInput |
| `components/canvas/nodes/ColorInput.test.tsx` | ColorInput |
| `components/canvas/nodes/ParameterRow.test.tsx` | ParameterRow |
| `lib/adapters/configs.test.ts` | 全量适配器配置验证 |
| `lib/canvas/types.test.ts` | ConfigField 类型扩展 |

### 5.2 ConfigInput 测试用例

```typescript
describe("ConfigInput", () => {
  it("dataType=boolean → 渲染 SwitchInput")
  it("color=true → 渲染 ColorInput")
  it("有 options → 渲染 SelectInput")
  it("number + slider → 渲染 SliderInput")
  it("number 无 slider → 渲染 number input")
  it("string + multiline → 渲染 textarea")
  it("string 无 multiline → 渲染 text input")
  it("dependsOn + dynamicOptions → 渲染联动下拉")
  it("dependsOn 返回空数组 → 不渲染")
  it("disabled → 输入禁用")
})
```

### 5.3 SelectInput 测试用例

```typescript
describe("SelectInput", () => {
  it("渲染所有选项")
  it("默认选中 defaultValue")
  it("选择触发 onChange")
  it("disabled 禁用选择")
  it("options 更新时重新渲染")
})
```

### 5.4 SliderInput 测试用例

```typescript
describe("SliderInput", () => {
  it("渲染 min/max/step")
  it("显示当前值")
  it("拖动触发 onChange")
  it("disabled 禁用拖动")
  it("值超出范围时正确处理")
})
```

### 5.5 SwitchInput 测试用例

```typescript
describe("SwitchInput", () => {
  it("渲染开关")
  it("checked=true 显示开启状态")
  it("切换触发 onChange")
  it("disabled 禁用切换")
})
```

### 5.6 ColorInput 测试用例

```typescript
describe("ColorInput", () => {
  it("渲染颜色选择器和文本输入")
  it("选择颜色触发 onChange")
  it("文本输入触发 onChange")
  it("disabled 禁用输入")
  it("显示当前颜色值")
})
```

### 5.7 ParameterRow 测试用例

```typescript
describe("ParameterRow", () => {
  it("渲染参数标签")
  it("渲染 ConfigInput")
  it("有 portId 时渲染 Handle")
  it("无 portId 时不渲染 Handle")
  it("端口连接时禁用输入")
  it("dependsOn 返回空时隐藏行")
})
```

### 5.8 全量适配器配置测试

```typescript
describe("Adapter Config Validation", () => {
  const adapters = [
    { type: "hash", expectedConfigCount: 3, hasLinkedOptions: true },
    { type: "hmac", expectedConfigCount: 3, hasLinkedOptions: false },
    { type: "crypto", expectedConfigCount: 5, hasLinkedOptions: true },
    { type: "encoding", expectedConfigCount: 1, hasLinkedOptions: false },
    { type: "classic-cipher", expectedConfigCount: 7, hasLinkedOptions: true },
    { type: "jwt", expectedConfigCount: 0, hasLinkedOptions: false },
    { type: "json-format", expectedConfigCount: 2, hasLinkedOptions: false },
    { type: "protobuf", expectedConfigCount: 2, hasLinkedOptions: false },
    { type: "jce", expectedConfigCount: 1, hasLinkedOptions: false },
    { type: "image-to-base64", expectedConfigCount: 1, hasLinkedOptions: false },
    { type: "exif-viewer", expectedConfigCount: 1, hasLinkedOptions: false },
    { type: "image-compress", expectedConfigCount: 2, hasLinkedOptions: false },
    { type: "image-editor", expectedConfigCount: 4, hasLinkedOptions: false },
    { type: "qrcode", expectedConfigCount: 4, hasLinkedOptions: false },
    { type: "qrcode-decode", expectedConfigCount: 0, hasLinkedOptions: false },
    { type: "meme-splitter", expectedConfigCount: 2, hasLinkedOptions: false },
    { type: "image-coordinates", expectedConfigCount: 0, hasLinkedOptions: false },
    { type: "text-stats", expectedConfigCount: 0, hasLinkedOptions: false },
    { type: "case-converter", expectedConfigCount: 0, hasLinkedOptions: false },
    { type: "regex", expectedConfigCount: 3, hasLinkedOptions: false },
    { type: "diff", expectedConfigCount: 0, hasLinkedOptions: false },
    { type: "http-tester", expectedConfigCount: 2, hasLinkedOptions: false },
    { type: "crontab", expectedConfigCount: 0, hasLinkedOptions: false },
    { type: "docker-converter", expectedConfigCount: 1, hasLinkedOptions: false },
    { type: "whois", expectedConfigCount: 0, hasLinkedOptions: false },
    { type: "uuid", expectedConfigCount: 3, hasLinkedOptions: false },
    { type: "totp", expectedConfigCount: 0, hasLinkedOptions: false },
    { type: "color", expectedConfigCount: 0, hasLinkedOptions: false },
    { type: "base-converter", expectedConfigCount: 1, hasLinkedOptions: false },
    { type: "temperature-converter", expectedConfigCount: 2, hasLinkedOptions: false },
    { type: "currency", expectedConfigCount: 2, hasLinkedOptions: false },
    { type: "bmi", expectedConfigCount: 0, hasLinkedOptions: false },
    { type: "device-info", expectedConfigCount: 0, hasLinkedOptions: false },
    { type: "office-viewer", expectedConfigCount: 0, hasLinkedOptions: false },
    { type: "time", expectedConfigCount: 1, hasLinkedOptions: false },
  ]

  for (const { type, expectedConfigCount, hasLinkedOptions } of adapters) {
    it(`${type}: config count = ${expectedConfigCount}`, () => {
      const def = getNodeDefinition(type)
      expect(def.config).toHaveLength(expectedConfigCount)
    })

    if (hasLinkedOptions) {
      it(`${type}: has linked options (dependsOn + dynamicOptions)`, () => {
        const def = getNodeDefinition(type)
        const linkedFields = def.config.filter((f) => f.dependsOn)
        expect(linkedFields.length).toBeGreaterThan(0)
      })
    }
  }
})
```

### 5.9 控件类型覆盖测试

```typescript
describe("Control Type Coverage", () => {
  it("dropdown selects: 42 params", () => {
    // 遍历所有 adapter，统计有 options 的 config 字段
  })

  it("sliders: 14 params", () => {
    // 遍历所有 adapter，统计有 slider 的 config 字段
  })

  it("switches: 8 params", () => {
    // 遍历所有 adapter，统计 dataType=boolean 的 config 字段
  })

  it("color pickers: 2 params", () => {
    // 遍历所有 adapter，统计 color=true 的 config 字段
  })

  it("text inputs: 12 params", () => {
    // 遍历所有 adapter，统计 string 无 options 的 config 字段
  })

  it("number inputs: 6 params", () => {
    // 遍历所有 adapter，统计 number 无 slider 的 config 字段
  })

  it("textareas: 3 params", () => {
    // 遍历所有 adapter，统计 multiline=true 的 config 字段
  })
})
```

---

## 6. Task 5: E2E 测试

### 6.1 测试文件

| 文件 | 说明 |
|------|------|
| `e2e/canvas-nodes.spec.ts` | 修改：更新端口数量测试，添加参数渲染测试 |
| `e2e/canvas-pipelines.spec.ts` | 新增：全量工具闭环流程测试 |

### 6.2 闭环流程测试设计

每个工具节点测试一个完整的数据流：

```
输入源节点 → 工具节点 → 输出节点
设置 config   设置参数    断言输出
```

### 6.3 全量闭环流程表

#### A 组：确定性输出（精确断言）

| # | 链路 | 输入 | 工具参数 | 预期输出 |
|---|------|------|----------|----------|
| 1 | String → Hash → String | "1" | algorithm=md5 | `c4ca4238a0b923820dcc509a6f75849b` |
| 2 | String → Hash → String | "hello" | algorithm=sha256 | `2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824` |
| 3 | String → Hash → String | "hello" | algorithm=sha512 | 前 32 字符验证 |
| 4 | String → HMAC → String | "hello" | algorithm=sha256, key="secret" | 验证长度 64 |
| 5 | String → Encoding → String | "hello" | encoding=base64 | `aGVsbG8=` |
| 6 | String → Encoding → String | "hello world" | encoding=url | `hello%20world` |
| 7 | String → Encoding → String | "hi" | encoding=hex | `6869` |
| 8 | String → Encoding → String | "aGVsbG8=" | encoding=base64, mode=decode | `hello` |
| 9 | String → Classic Cipher → String | "hello" | algorithm=rot13 | `uryyb` |
| 10 | String → Classic Cipher → String | "abc" | algorithm=caesar, shift=3 | `def` |
| 11 | String → Case Converter → String | "hello world" | — | upper=`HELLO WORLD` |
| 12 | String → Base Converter → String | "255" | fromBase=10 | hex=`FF` |
| 13 | String → Base Converter → String | "5" | fromBase=10 | binary=`101` |
| 14 | String → JSON Format → String | '{"a":1}' | indent=2 | formatted=`{\n  "a": 1\n}` |
| 15 | String → JSON Format → String | '{"a": 1}' | — | minified=`{"a":1}` |
| 16 | Number → Temperature → Number | 100 | fromUnit=celsius | fahrenheit=212 |
| 17 | Number → Temperature → Number | 0 | fromUnit=celsius | kelvin=273.15 |
| 18 | Number → Temperature → Number | 100 | fromUnit=celsius | kelvin=373.15 |
| 19 | Number + Number → BMI → Number | 70, 1.75 | — | bmi≈22.86 |
| 20 | String → Color → String | "#ff0000" | — | hex="#ff0000" |
| 21 | String → Color → String | "#ff0000" | — | rgb={r:255,g:0,b:0} |
| 22 | String → JWT → JSON | valid JWT | — | header.alg="HS256" |
| 23 | String → Regex → JSON | "test123" | pattern="\\d+" | matches=["123"] |
| 24 | String + String → Diff → JSON | "abc", "abd" | — | changes.length>0 |
| 25 | String → Crontab → JSON | "* * * * *" | — | parsed.minute exists |
| 26 | String → Crontab → JSON | "0 9 * * 1-5" | — | nextRuns.length>0 |

#### B 组：格式可验证（类型/存在性断言）

| # | 链路 | 输入 | 工具参数 | 验证方式 |
|---|------|------|----------|----------|
| 27 | String → Text Stats → JSON | "hello world" | — | chars=11, words=2 |
| 28 | String → Text Stats → JSON | "a\nb\nc" | — | lines=3 |
| 29 | String → Crontab → JSON | "*/5 * * * *" | — | parsed.minute=[0,5,10,...,55] |
| 30 | String → Crontab → JSON | "0 0 1 1 *" | — | nextRuns 包含 1月1日 |

#### C 组：无输入源节点（直接 execute）

| # | 节点 | 参数 | 验证方式 |
|---|------|------|----------|
| 31 | UUID | version=v4 | 输出匹配 UUID 格式 |
| 32 | UUID | version=v1 | 输出匹配 UUID 格式 |
| 33 | Time | timezone=UTC | timestamp>0, iso 包含 T |
| 34 | Device Info | — | 输出为 object |

#### D 组：需要特殊输入（仅参数渲染测试）

| # | 节点 | 原因 |
|---|------|------|
| 35 | Image to Base64 | 需要 File 对象 |
| 36 | EXIF Viewer | 需要图片文件 |
| 37 | Image Compress | 需要图片文件 |
| 38 | Image Editor | 需要图片文件 |
| 39 | QRCode | 需要生成图片 |
| 40 | QRCode Decode | 需要图片文件 |
| 41 | Meme Splitter | 需要图片文件 |
| 42 | Image Coordinates | 需要图片文件 |
| 43 | Office Viewer | 需要文档文件 |

#### E 组：需要网络/外部服务（仅参数渲染测试）

| # | 节点 | 原因 |
|---|------|------|
| 44 | HTTP Tester | 需要网络请求 |
| 45 | Whois | 需要 whois 服务 |
| 46 | TOTP | 需要时间同步 |
| 47 | Currency | 需要汇率 API |
| 48 | Docker Converter | 输出为模板 |
| 49 | Crypto | 需要 CryptoJS 库 |
| 50 | Protobuf | 需要 protobuf 解析 |
| 51 | JCE | 需要 JCE 解析 |

---

### 6.4 完整测试代码

```typescript
// e2e/canvas-pipelines.spec.ts

import { test, expect, type Page } from "@playwright/test"

let nodeCounter = 0

function uniqueId(prefix: string) {
  return `${prefix}-${++nodeCounter}`
}

async function addNode(page: Page, type: string, config: Record<string, unknown> = {}): Promise<string> {
  const id = uniqueId(type)
  await page.evaluate(({ id, type, config }) => {
    const store = (window as any).__ZUSTAND_STORE__
    store.getState().addNode({ id, type, position: { x: 300 + Math.random() * 200, y: 200 + Math.random() * 200 }, config })
  }, { id, type, config })
  await page.waitForTimeout(300)
  return id
}

async function connectNodes(page: Page, sourceId: string, sourcePort: string, targetId: string, targetPort: string) {
  await page.evaluate(({ s, sp, t, tp }) => {
    const store = (window as any).__ZUSTAND_STORE__
    store.getState().addEdge({ id: `edge-${s}-${sp}-${t}-${tp}`, source: s, sourcePort: sp, target: t, targetPort: tp })
  }, { s: sourceId, sp: sourcePort, t: targetId, tp: targetPort })
  await page.waitForTimeout(200)
}

async function executeAll(page: Page) {
  await page.evaluate(() => {
    const store = (window as any).__ZUSTAND_STORE__
    return store.getState().executeAll()
  })
  await page.waitForTimeout(500)
}

async function getOutput(page: Page, nodeId: string, portId: string): Promise<unknown> {
  return page.evaluate(({ nodeId, portId }) => {
    const store = (window as any).__ZUSTAND_STORE__
    return store.getState().nodeOutputs[nodeId]?.[portId]
  }, { nodeId, portId })
}

// ─── A 组：确定性输出 ─────────────────────────────────────────────────────

test.describe("Pipeline: Deterministic Output", () => {
  test.beforeEach(async ({ page }) => {
    nodeCounter = 0
    await page.goto("/canvas")
    await page.waitForLoadState("networkidle")
    await page.waitForSelector(".react-flow", { timeout: 15000 })
  })

  test("String('1') → Hash(MD5) → String", async ({ page }) => {
    const src = await addNode(page, "string", { value: "1" })
    const hash = await addNode(page, "hash", { algorithm: "md5" })
    const out = await addNode(page, "string", { value: "" })
    await connectNodes(page, src, "value", hash, "data")
    await connectNodes(page, hash, "hash", out, "input")
    await executeAll(page)
    expect(await getOutput(page, out, "value")).toBe("c4ca4238a0b923820dcc509a6f75849b")
  })

  test("String('hello') → Hash(SHA-256) → String", async ({ page }) => {
    const src = await addNode(page, "string", { value: "hello" })
    const hash = await addNode(page, "hash", { algorithm: "sha256" })
    const out = await addNode(page, "string", { value: "" })
    await connectNodes(page, src, "value", hash, "data")
    await connectNodes(page, hash, "hash", out, "input")
    await executeAll(page)
    expect(await getOutput(page, out, "value")).toBe("2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824")
  })

  test("String('hello') → Hash(SHA-512) → String", async ({ page }) => {
    const src = await addNode(page, "string", { value: "hello" })
    const hash = await addNode(page, "hash", { algorithm: "sha512" })
    const out = await addNode(page, "string", { value: "" })
    await connectNodes(page, src, "value", hash, "data")
    await connectNodes(page, hash, "hash", out, "input")
    await executeAll(page)
    const result = await getOutput(page, out, "value")
    expect(typeof result).toBe("string")
    expect((result as string).length).toBe(128)
    expect(result).toMatch(/^[0-9a-f]+$/)
  })

  test("String('hello') + String('secret') → HMAC(SHA-256) → String", async ({ page }) => {
    const data = await addNode(page, "string", { value: "hello" })
    const key = await addNode(page, "string", { value: "secret" })
    const hmac = await addNode(page, "hmac", { algorithm: "sha256" })
    const out = await addNode(page, "string", { value: "" })
    await connectNodes(page, data, "value", hmac, "data")
    await connectNodes(page, key, "value", hmac, "key")
    await connectNodes(page, hmac, "hmac", out, "input")
    await executeAll(page)
    const result = await getOutput(page, out, "value")
    expect(typeof result).toBe("string")
    expect((result as string).length).toBe(64)
  })

  test("String('hello') → Encoding(Base64) → String", async ({ page }) => {
    const src = await addNode(page, "string", { value: "hello" })
    const enc = await addNode(page, "encoding", { encoding: "base64" })
    const out = await addNode(page, "string", { value: "" })
    await connectNodes(page, src, "value", enc, "input")
    await connectNodes(page, enc, "output", out, "input")
    await executeAll(page)
    expect(await getOutput(page, out, "value")).toBe("aGVsbG8=")
  })

  test("String('hello world') → Encoding(URL) → String", async ({ page }) => {
    const src = await addNode(page, "string", { value: "hello world" })
    const enc = await addNode(page, "encoding", { encoding: "url" })
    const out = await addNode(page, "string", { value: "" })
    await connectNodes(page, src, "value", enc, "input")
    await connectNodes(page, enc, "output", out, "input")
    await executeAll(page)
    expect(await getOutput(page, out, "value")).toBe("hello%20world")
  })

  test("String('hi') → Encoding(HEX) → String", async ({ page }) => {
    const src = await addNode(page, "string", { value: "hi" })
    const enc = await addNode(page, "encoding", { encoding: "hex" })
    const out = await addNode(page, "string", { value: "" })
    await connectNodes(page, src, "value", enc, "input")
    await connectNodes(page, enc, "output", out, "input")
    await executeAll(page)
    expect(await getOutput(page, out, "value")).toBe("6869")
  })

  test("String('aGVsbG8=') → Encoding(Base64-Decode) → String", async ({ page }) => {
    const src = await addNode(page, "string", { value: "aGVsbG8=" })
    const mode = await addNode(page, "string", { value: "decode" })
    const enc = await addNode(page, "encoding", { encoding: "base64" })
    const out = await addNode(page, "string", { value: "" })
    await connectNodes(page, src, "value", enc, "input")
    await connectNodes(page, mode, "value", enc, "mode")
    await connectNodes(page, enc, "output", out, "input")
    await executeAll(page)
    expect(await getOutput(page, out, "value")).toBe("hello")
  })

  test("String('hello') → Classic Cipher(ROT13) → String", async ({ page }) => {
    const src = await addNode(page, "string", { value: "hello" })
    const cipher = await addNode(page, "classic-cipher", { algorithm: "rot13" })
    const out = await addNode(page, "string", { value: "" })
    await connectNodes(page, src, "value", cipher, "data")
    await connectNodes(page, cipher, "result", out, "input")
    await executeAll(page)
    expect(await getOutput(page, out, "value")).toBe("uryyb")
  })

  test("String('abc') → Classic Cipher(Caesar, shift=3) → String", async ({ page }) => {
    const src = await addNode(page, "string", { value: "abc" })
    const cipher = await addNode(page, "classic-cipher", { algorithm: "caesar", shift: 3 })
    const out = await addNode(page, "string", { value: "" })
    await connectNodes(page, src, "value", cipher, "data")
    await connectNodes(page, cipher, "result", out, "input")
    await executeAll(page)
    expect(await getOutput(page, out, "value")).toBe("def")
  })

  test("String('hello world') → Case Converter → String(upper)", async ({ page }) => {
    const src = await addNode(page, "string", { value: "hello world" })
    const conv = await addNode(page, "case-converter")
    const out = await addNode(page, "string", { value: "" })
    await connectNodes(page, src, "value", conv, "text")
    await connectNodes(page, conv, "upper", out, "input")
    await executeAll(page)
    expect(await getOutput(page, out, "value")).toBe("HELLO WORLD")
  })

  test("String('255') → Base Converter(10→hex) → String", async ({ page }) => {
    const src = await addNode(page, "string", { value: "255" })
    const conv = await addNode(page, "base-converter", { fromBase: "10" })
    const out = await addNode(page, "string", { value: "" })
    await connectNodes(page, src, "value", conv, "value")
    await connectNodes(page, conv, "hex", out, "input")
    await executeAll(page)
    expect(await getOutput(page, out, "value")).toBe("FF")
  })

  test("String('5') → Base Converter(10→binary) → String", async ({ page }) => {
    const src = await addNode(page, "string", { value: "5" })
    const conv = await addNode(page, "base-converter", { fromBase: "10" })
    const out = await addNode(page, "string", { value: "" })
    await connectNodes(page, src, "value", conv, "value")
    await connectNodes(page, conv, "binary", out, "input")
    await executeAll(page)
    expect(await getOutput(page, out, "value")).toBe("101")
  })

  test("String('{\"a\":1}') → JSON Format(minified) → String", async ({ page }) => {
    const src = await addNode(page, "string", { value: '{"a": 1}' })
    const fmt = await addNode(page, "json-format")
    const out = await addNode(page, "string", { value: "" })
    await connectNodes(page, src, "value", fmt, "data")
    await connectNodes(page, fmt, "minified", out, "input")
    await executeAll(page)
    expect(await getOutput(page, out, "value")).toBe('{"a":1}')
  })

  test("Number(100) → Temperature(C→F) → Number", async ({ page }) => {
    const src = await addNode(page, "number", { value: 100 })
    const temp = await addNode(page, "temperature-converter", { fromUnit: "celsius" })
    const out = await addNode(page, "number", { value: 0 })
    await connectNodes(page, src, "value", temp, "value")
    await connectNodes(page, temp, "fahrenheit", out, "input")
    await executeAll(page)
    expect(await getOutput(page, out, "value")).toBe(212)
  })

  test("Number(0) → Temperature(C→K) → Number", async ({ page }) => {
    const src = await addNode(page, "number", { value: 0 })
    const temp = await addNode(page, "temperature-converter", { fromUnit: "celsius" })
    const out = await addNode(page, "number", { value: 0 })
    await connectNodes(page, src, "value", temp, "value")
    await connectNodes(page, temp, "kelvin", out, "input")
    await executeAll(page)
    expect(await getOutput(page, out, "value")).toBeCloseTo(273.15, 1)
  })

  test("Number(100) → Temperature(C→K) → Number", async ({ page }) => {
    const src = await addNode(page, "number", { value: 100 })
    const temp = await addNode(page, "temperature-converter", { fromUnit: "celsius" })
    const out = await addNode(page, "number", { value: 0 })
    await connectNodes(page, src, "value", temp, "value")
    await connectNodes(page, temp, "kelvin", out, "input")
    await executeAll(page)
    expect(await getOutput(page, out, "value")).toBeCloseTo(373.15, 1)
  })

  test("Number(70) + Number(1.75) → BMI → Number", async ({ page }) => {
    const weight = await addNode(page, "number", { value: 70 })
    const height = await addNode(page, "number", { value: 1.75 })
    const bmi = await addNode(page, "bmi")
    const out = await addNode(page, "number", { value: 0 })
    await connectNodes(page, weight, "value", bmi, "weight")
    await connectNodes(page, height, "value", bmi, "height")
    await connectNodes(page, bmi, "bmi", out, "input")
    await executeAll(page)
    expect(await getOutput(page, out, "value")).toBeCloseTo(22.86, 1)
  })

  test("String('#ff0000') → Color → String(hex)", async ({ page }) => {
    const src = await addNode(page, "string", { value: "#ff0000" })
    const color = await addNode(page, "color")
    const out = await addNode(page, "string", { value: "" })
    await connectNodes(page, src, "value", color, "color")
    await connectNodes(page, color, "hex", out, "input")
    await executeAll(page)
    expect(await getOutput(page, out, "value")).toBe("#ff0000")
  })

  test("String('#ff0000') → Color → JSON(rgb)", async ({ page }) => {
    const src = await addNode(page, "string", { value: "#ff0000" })
    const color = await addNode(page, "color")
    const out = await addNode(page, "json", { value: "{}" })
    await connectNodes(page, src, "value", color, "color")
    await connectNodes(page, color, "rgb", out, "input")
    await executeAll(page)
    const output = await getOutput(page, out, "value")
    expect(output).toHaveProperty("r", 255)
    expect(output).toHaveProperty("g", 0)
    expect(output).toHaveProperty("b", 0)
  })

  test("String(JWT) → JWT → JSON(header)", async ({ page }) => {
    const jwt = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U"
    const src = await addNode(page, "string", { value: jwt })
    const jwtNode = await addNode(page, "jwt")
    const out = await addNode(page, "json", { value: "{}" })
    await connectNodes(page, src, "value", jwtNode, "token")
    await connectNodes(page, jwtNode, "header", out, "input")
    await executeAll(page)
    expect(await getOutput(page, out, "value")).toHaveProperty("alg", "HS256")
  })

  test("String('test123') → Regex(pattern=\\d+) → JSON(matches)", async ({ page }) => {
    const src = await addNode(page, "string", { value: "test123" })
    const regex = await addNode(page, "regex", { pattern: "\\d+", flags: "g" })
    const out = await addNode(page, "json", { value: "{}" })
    await connectNodes(page, src, "value", regex, "text")
    await connectNodes(page, regex, "matches", out, "input")
    await executeAll(page)
    const output = await getOutput(page, out, "value")
    expect(Array.isArray(output)).toBe(true)
    expect(output).toContain("123")
  })

  test("String('abc') + String('abd') → Diff → JSON", async ({ page }) => {
    const src1 = await addNode(page, "string", { value: "abc" })
    const src2 = await addNode(page, "string", { value: "abd" })
    const diff = await addNode(page, "diff")
    const out = await addNode(page, "json", { value: "{}" })
    await connectNodes(page, src1, "value", diff, "text1")
    await connectNodes(page, src2, "value", diff, "text2")
    await connectNodes(page, diff, "diff", out, "input")
    await executeAll(page)
    const output = await getOutput(page, out, "value")
    expect(output).toHaveProperty("changes")
    expect(output).toHaveProperty("added")
    expect(output).toHaveProperty("removed")
  })

  test("String('* * * * *') → Crontab → JSON(parsed)", async ({ page }) => {
    const src = await addNode(page, "string", { value: "* * * * *" })
    const cron = await addNode(page, "crontab")
    const out = await addNode(page, "json", { value: "{}" })
    await connectNodes(page, src, "value", cron, "expression")
    await connectNodes(page, cron, "parsed", out, "input")
    await executeAll(page)
    const output = await getOutput(page, out, "value")
    expect(output).toHaveProperty("minute")
    expect(output).toHaveProperty("hour")
  })

  test("String('0 9 * * 1-5') → Crontab → JSON(nextRuns)", async ({ page }) => {
    const src = await addNode(page, "string", { value: "0 9 * * 1-5" })
    const cron = await addNode(page, "crontab")
    const out = await addNode(page, "json", { value: "{}" })
    await connectNodes(page, src, "value", cron, "expression")
    await connectNodes(page, cron, "nextRuns", out, "input")
    await executeAll(page)
    const output = await getOutput(page, out, "value")
    expect(Array.isArray(output)).toBe(true)
    expect((output as any[]).length).toBeGreaterThan(0)
  })

  test("String('hello world') → Text Stats → JSON", async ({ page }) => {
    const src = await addNode(page, "string", { value: "hello world" })
    const stats = await addNode(page, "text-stats")
    const out = await addNode(page, "json", { value: "{}" })
    await connectNodes(page, src, "value", stats, "text")
    await connectNodes(page, stats, "stats", out, "input")
    await executeAll(page)
    const output = await getOutput(page, out, "value")
    expect(output).toHaveProperty("characters", 11)
    expect(output).toHaveProperty("words", 2)
  })

  test("String('a\\nb\\nc') → Text Stats → JSON(lines=3)", async ({ page }) => {
    const src = await addNode(page, "string", { value: "a\nb\nc" })
    const stats = await addNode(page, "text-stats")
    const out = await addNode(page, "json", { value: "{}" })
    await connectNodes(page, src, "value", stats, "text")
    await connectNodes(page, stats, "stats", out, "input")
    await executeAll(page)
    expect(await getOutput(page, out, "value")).toHaveProperty("lines", 3)
  })
})

// ─── C 组：无输入源节点 ───────────────────────────────────────────────────

test.describe("Pipeline: Source Nodes", () => {
  test.beforeEach(async ({ page }) => {
    nodeCounter = 0
    await page.goto("/canvas")
    await page.waitForLoadState("networkidle")
    await page.waitForSelector(".react-flow", { timeout: 15000 })
  })

  test("UUID(v4) → String: format matches", async ({ page }) => {
    const uuid = await addNode(page, "uuid", { version: "v4" })
    const out = await addNode(page, "string", { value: "" })
    await connectNodes(page, uuid, "uuid", out, "input")
    await executeAll(page)
    const output = await getOutput(page, out, "value")
    expect(typeof output).toBe("string")
    if ((output as string).length > 0) {
      expect(output).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
    }
  })

  test("UUID(v1) → String: format matches", async ({ page }) => {
    const uuid = await addNode(page, "uuid", { version: "v1" })
    const out = await addNode(page, "string", { value: "" })
    await connectNodes(page, uuid, "uuid", out, "input")
    await executeAll(page)
    const output = await getOutput(page, out, "value")
    expect(typeof output).toBe("string")
    if ((output as string).length > 0) {
      expect(output).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
    }
  })

  test("Time → Number(timestamp): exists and > 0", async ({ page }) => {
    const time = await addNode(page, "time")
    const out = await addNode(page, "number", { value: 0 })
    await connectNodes(page, time, "timestamp", out, "input")
    await executeAll(page)
    const output = await getOutput(page, out, "value")
    expect(typeof output).toBe("number")
    expect(output).toBeGreaterThan(0)
  })

  test("Time → String(iso): contains T", async ({ page }) => {
    const time = await addNode(page, "time")
    const out = await addNode(page, "string", { value: "" })
    await connectNodes(page, time, "iso", out, "input")
    await executeAll(page)
    const output = await getOutput(page, out, "value")
    expect(typeof output).toBe("string")
    expect(output).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  test("Device Info → JSON: is object", async ({ page }) => {
    const device = await addNode(page, "device-info")
    const out = await addNode(page, "json", { value: "{}" })
    await connectNodes(page, device, "info", out, "input")
    await executeAll(page)
    const output = await getOutput(page, out, "value")
    expect(typeof output).toBe("object")
  })
})

// ─── D 组：参数渲染测试 ───────────────────────────────────────────────────

test.describe("Node Parameter Rendering", () => {
  test.beforeEach(async ({ page }) => {
    nodeCounter = 0
    await page.goto("/canvas")
    await page.waitForLoadState("networkidle")
    await page.waitForSelector(".react-flow", { timeout: 15000 })
  })

  test("Hash: algorithm dropdown visible", async ({ page }) => {
    await addNode(page, "hash")
    const node = page.locator(".react-flow__node").first()
    await expect(node.locator("select")).toBeVisible()
  })

  test("Classic Cipher: caesar shows shift, vigenere shows key", async ({ page }) => {
    await addNode(page, "classic-cipher", { algorithm: "caesar" })
    const node = page.locator(".react-flow__node").first()
    await expect(node.locator("input[type='number']")).toBeVisible()
    await node.locator("select").first().selectOption("vigenere")
    await expect(node.locator("input[type='text']")).toBeVisible()
  })

  test("Crypto: algorithm dropdown + mode dropdown", async ({ page }) => {
    await addNode(page, "crypto", { algorithm: "aes" })
    const node = page.locator(".react-flow__node").first()
    const selects = node.locator("select")
    await expect(selects).toHaveCount(4) // algorithm, mode, keySize, keyFormat
  })

  test("QRCode: size slider + color pickers", async ({ page }) => {
    await addNode(page, "qrcode")
    const node = page.locator(".react-flow__node").first()
    await expect(node.locator("input[type='range']")).toBeVisible()
    await expect(node.locator("input[type='color']")).toHaveCount(2)
  })

  test("Image Compress: quality slider", async ({ page }) => {
    await addNode(page, "image-compress")
    const node = page.locator(".react-flow__node").first()
    await expect(node.locator("input[type='range']")).toBeVisible()
  })

  test("Image Editor: brightness/contrast sliders + grayscale switch", async ({ page }) => {
    await addNode(page, "image-editor")
    const node = page.locator(".react-flow__node").first()
    await expect(node.locator("input[type='range']")).toHaveCount(3) // brightness, contrast, saturation
    await expect(node.locator("input[type='checkbox']")).toBeVisible() // grayscale
  })

  test("JSON Format: indent slider + sortKeys switch", async ({ page }) => {
    await addNode(page, "json-format")
    const node = page.locator(".react-flow__node").first()
    await expect(node.locator("input[type='range']")).toBeVisible()
    await expect(node.locator("input[type='checkbox']")).toBeVisible()
  })

  test("UUID: version dropdown + uppercase/hyphens switches", async ({ page }) => {
    await addNode(page, "uuid")
    const node = page.locator(".react-flow__node").first()
    await expect(node.locator("select")).toBeVisible()
    await expect(node.locator("input[type='checkbox']")).toHaveCount(2)
  })

  test("Meme Splitter: rows/cols sliders", async ({ page }) => {
    await addNode(page, "meme-splitter")
    const node = page.locator(".react-flow__node").first()
    await expect(node.locator("input[type='range']")).toHaveCount(2)
  })

  test("Temperature: fromUnit dropdown + precision dropdown", async ({ page }) => {
    await addNode(page, "temperature-converter")
    const node = page.locator(".react-flow__node").first()
    await expect(node.locator("select")).toHaveCount(2)
  })

  test("Currency: from/to dropdowns", async ({ page }) => {
    await addNode(page, "currency")
    const node = page.locator(".react-flow__node").first()
    await expect(node.locator("select")).toHaveCount(2)
  })

  test("Base Converter: fromBase dropdown", async ({ page }) => {
    await addNode(page, "base-converter")
    const node = page.locator(".react-flow__node").first()
    await expect(node.locator("select")).toBeVisible()
  })

  test("Encoding: encoding dropdown", async ({ page }) => {
    await addNode(page, "encoding")
    const node = page.locator(".react-flow__node").first()
    await expect(node.locator("select")).toBeVisible()
  })

  test("HMAC: algorithm dropdown", async ({ page }) => {
    await addNode(page, "hmac")
    const node = page.locator(".react-flow__node").first()
    await expect(node.locator("select")).toBeVisible()
  })

  test("Docker Converter: format dropdown", async ({ page }) => {
    await addNode(page, "docker-converter")
    const node = page.locator(".react-flow__node").first()
    await expect(node.locator("select")).toBeVisible()
  })

  test("HTTP Tester: method dropdown + headers textarea", async ({ page }) => {
    await addNode(page, "http-tester")
    const node = page.locator(".react-flow__node").first()
    await expect(node.locator("select")).toBeVisible()
    await expect(node.locator("textarea")).toBeVisible()
  })

  test("Regex: pattern/flags inputs + replacement textarea", async ({ page }) => {
    await addNode(page, "regex")
    const node = page.locator(".react-flow__node").first()
    await expect(node.locator("input[type='text']")).toHaveCount(2) // pattern, flags
    await expect(node.locator("textarea")).toBeVisible() // replacement
  })

  test("Time: timezone dropdown", async ({ page }) => {
    await addNode(page, "time")
    const node = page.locator(".react-flow__node").first()
    await expect(node.locator("select")).toBeVisible()
  })

  test("Protobuf: mode dropdown", async ({ page }) => {
    await addNode(page, "protobuf")
    const node = page.locator(".react-flow__node").first()
    await expect(node.locator("select")).toBeVisible()
  })

  test("JCE: mode dropdown", async ({ page }) => {
    await addNode(page, "jce")
    const node = page.locator(".react-flow__node").first()
    await expect(node.locator("select")).toBeVisible()
  })

  test("EXIF Viewer: category dropdown", async ({ page }) => {
    await addNode(page, "exif-viewer")
    const node = page.locator(".react-flow__node").first()
    await expect(node.locator("select")).toBeVisible()
  })

  test("Image to Base64: outputFormat dropdown", async ({ page }) => {
    await addNode(page, "image-to-base64")
    const node = page.locator(".react-flow__node").first()
    await expect(node.locator("select")).toBeVisible()
  })
})
```

---

## 7. 修改文件汇总

| 类型 | 文件 | 操作 |
|------|------|------|
| 新增 | `components/canvas/nodes/ConfigInput.tsx` | 创建 |
| 新增 | `components/canvas/nodes/SelectInput.tsx` | 创建 |
| 新增 | `components/canvas/nodes/SliderInput.tsx` | 创建 |
| 新增 | `components/canvas/nodes/SwitchInput.tsx` | 创建 |
| 新增 | `components/canvas/nodes/ColorInput.tsx` | 创建 |
| 新增 | `components/canvas/nodes/ParameterRow.tsx` | 创建 |
| 新增 | `components/canvas/nodes/ConfigInput.test.tsx` | 创建 |
| 新增 | `components/canvas/nodes/SelectInput.test.tsx` | 创建 |
| 新增 | `components/canvas/nodes/SliderInput.test.tsx` | 创建 |
| 新增 | `components/canvas/nodes/SwitchInput.test.tsx` | 创建 |
| 新增 | `components/canvas/nodes/ColorInput.test.tsx` | 创建 |
| 新增 | `components/canvas/nodes/ParameterRow.test.tsx` | 创建 |
| 新增 | `lib/adapters/configs.test.ts` | 创建 |
| 新增 | `lib/canvas/types.test.ts` | 创建 |
| 修改 | `components/canvas/nodes/BaseNode.tsx` | 重构 |
| 修改 | `lib/canvas/types.ts` | 扩展 ConfigField |
| 修改 | `lib/adapters/hash.ts` | 重构 config |
| 修改 | `lib/adapters/hmac.ts` | 重构 config |
| 修改 | `lib/adapters/crypto.ts` | 重构 config |
| 修改 | `lib/adapters/encoding.ts` | 扩展 options |
| 修改 | `lib/adapters/classic-cipher.ts` | 重构 config |
| 修改 | `lib/adapters/json-format.ts` | 添加 slider, boolean |
| 修改 | `lib/adapters/protobuf.ts` | 添加 indentSize |
| 修改 | `lib/adapters/image-to-base64.ts` | 添加 outputFormat |
| 修改 | `lib/adapters/exif-viewer.ts` | 添加 category |
| 修改 | `lib/adapters/image-compress.ts` | 添加 slider, outputFormat |
| 修改 | `lib/adapters/image-editor.ts` | 重构 config |
| 修改 | `lib/adapters/qrcode.ts` | 添加 slider, color |
| 修改 | `lib/adapters/meme-splitter.ts` | 添加 slider |
| 修改 | `lib/adapters/regex.ts` | 添加 multiline |
| 修改 | `lib/adapters/http-tester.ts` | 添加 multiline |
| 修改 | `lib/adapters/uuid.ts` | 添加 boolean |
| 修改 | `lib/adapters/base-converter.ts` | 扩展 options |
| 修改 | `lib/adapters/temperature-converter.ts` | 扩展 options, 添加 precision |
| 修改 | `e2e/canvas-nodes.spec.ts` | 更新端口测试 |
| 新增 | `e2e/canvas-pipelines.spec.ts` | 全量闭环流程测试 |
| 删除 | `components/canvas/nodes/InlineEditor.tsx` | 删除 |
| 删除 | `components/canvas/nodes/editors/*.tsx` | 删除 |
| 删除 | `components/canvas/nodes/editors/*.test.tsx` | 删除 |

---

## 8. 实施顺序

```mermaid
graph TD
    A["Task 1: 新增输入组件"] --> B["Task 2: 重构 BaseNode"]
    B --> C["Task 3: 修改适配器配置"]
    C --> D["Task 4: 单元测试"]
    D --> E["Task 5: E2E 测试"]
    E --> F["验收"]
```

**建议顺序**:
1. Task 1: 新增 6 个输入组件
2. Task 2: 重构 BaseNode
3. Task 3: 修改 20 个适配器配置
4. Task 4: 编写 8 个测试文件
5. Task 5: 更新 E2E 测试
