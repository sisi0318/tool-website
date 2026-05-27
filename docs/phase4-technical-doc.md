# 优化四期技术文档

## 概述

本文档描述低代码画布系统第四期优化的技术方案，包括新增节点、修复问题和交互优化。

---

## 一、新增节点

### 1.1 Boolean 基础类型节点

**节点定义：**
- 类型：`boolean`
- 分类：`basic`
- 图标：`ToggleLeft` (lucide-react)
- 配置字段：
  - `value`: boolean 类型，带输入端口和输出端口，默认值 `false`
- 输出：无（通过配置字段的 `hasOutput: true` 输出）

**实现方案：**
```typescript
// lib/adapters/basic.ts
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
```

**UI 渲染：**
- 使用 SwitchInput 组件渲染开关
- 支持连线输入和连线输出

**测试：**
- 单元测试：验证类型定义、execute 返回值
- E2E 测试：拖拽节点、切换开关、连线

---

### 1.2 JSON Path 节点

**节点定义：**
- 类型：`json-path`
- 分类：`data`
- 图标：`Braces` (lucide-react)
- 配置字段：
  - `json`: JSON 输入，`dataType: "string"`，带输入端口，支持多行
  - `path`: JSONPath 表达式，`dataType: "string"`，带输入端口
- 输出：
  - `result`: 根据 JSONPath 查询结果类型输出（Boolean/String/Number/JSON/Array）

**JSONPath 实现：**
使用简单路径解析（如 `$.store.book[0].title`），不依赖第三方库：
```typescript
function getByPath(obj: unknown, path: string): unknown {
  if (path === "$") return obj
  
  const parts = path
    .replace(/^\$\.?/, "")
    .split(/\.|\[|\]/)
    .filter(Boolean)
  
  let current = obj
  for (const part of parts) {
    if (current == null) return undefined
    if (/^\d+$/.test(part)) {
      current = (current as unknown[])[parseInt(part)]
    } else {
      current = (current as Record<string, unknown>)[part]
    }
  }
  return current
}
```

**输出类型判断：**
```typescript
function getDataType(value: unknown): DataType {
  if (value === null || value === undefined) return "string"
  if (typeof value === "boolean") return "boolean"
  if (typeof value === "number") return "number"
  if (Array.isArray(value)) return "json"
  if (typeof value === "object") return "json"
  return "string"
}
```

**实现方案：**
```typescript
// lib/adapters/json-path.ts
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
```

**测试：**
- 单元测试：验证各种 JSONPath 查询（根路径、嵌套、数组索引）
- E2E 测试：连接 JSON 节点输入、查询结果验证

---

### 1.3 File 转换节点（4个）

#### 1.3.1 Base64 To File

**节点定义：**
- 类型：`base64-to-file`
- 分类：`data`
- 图标：`FileUp` (lucide-react)
- 配置字段：
  - `base64`: Base64 字符串输入，`dataType: "string"`，带输入端口
  - `filename`: 文件名，`dataType: "string"`，带输入端口
  - `mimeType`: MIME 类型，`dataType: "string"`，带输入端口，默认 `application/octet-stream`
- 输出：
  - `file`: File 对象，`dataType: "bytes"`

**实现方案：**
```typescript
async execute(inputs, config) {
  const base64 = String(inputs.base64 ?? config.base64 ?? "")
  const filename = String(inputs.filename ?? config.filename ?? "file")
  const mimeType = String(inputs.mimeType ?? config.mimeType ?? "application/octet-stream")
  
  const binaryStr = atob(base64)
  const bytes = new Uint8Array(binaryStr.length)
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i)
  }
  
  const file = new File([bytes], filename, { type: mimeType })
  return { file }
}
```

#### 1.3.2 File To Base64

**节点定义：**
- 类型：`file-to-base64`
- 分类：`data`
- 图标：`FileDown` (lucide-react)
- 配置字段：
  - `file`: File 输入，`dataType: "bytes"`，带输入端口
- 输出：
  - `base64`: Base64 字符串，`dataType: "string"`

**实现方案：**
```typescript
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
}
```

#### 1.3.3 File To String

**节点定义：**
- 类型：`file-to-string`
- 分类：`data`
- 图标：`FileType` (lucide-react)
- 配置字段：
  - `file`: File 输入，`dataType: "bytes"`，带输入端口
  - `encoding`: 编码方式，`dataType: "string"`，选项 `utf-8`/`ascii`/`latin1`，默认 `utf-8`
- 输出：
  - `content`: 字符串内容，`dataType: "string"`

**实现方案：**
```typescript
async execute(inputs, config) {
  const file = (inputs.file ?? config.file) as File | null
  if (!file) throw new Error("No file provided")
  
  const encoding = String(inputs.encoding ?? config.encoding ?? "utf-8")
  const text = await file.text()
  return { content: text }
}
```

#### 1.3.4 String To File

**节点定义：**
- 类型：`string-to-file`
- 分类：`data`
- 图标：`FileOutput` (lucide-react)
- 配置字段：
  - `content`: 字符串内容，`dataType: "string"`，带输入端口，支持多行
  - `filename`: 文件名，`dataType: "string"`，带输入端口，默认 `file.txt`
  - `mimeType`: MIME 类型，`dataType: "string"`，带输入端口，默认 `text/plain`
- 输出：
  - `file`: File 对象，`dataType: "bytes"`

**实现方案：**
```typescript
async execute(inputs, config) {
  const content = String(inputs.content ?? config.content ?? "")
  const filename = String(inputs.filename ?? config.filename ?? "file.txt")
  const mimeType = String(inputs.mimeType ?? config.mimeType ?? "text/plain")
  
  const file = new File([content], filename, { type: mimeType })
  return { file }
}
```

---

### 1.4 Preview 节点（3个）

Preview 节点特性：**只支持输入，不支持输出**

#### 1.4.1 String Preview

**节点定义：**
- 类型：`string-preview`
- 分类：`viewer`
- 图标：`Eye` (lucide-react)
- 配置字段：
  - `content`: 字符串内容，`dataType: "string"`，带输入端口，支持多行，无输出端口
- 输出：无

**UI 渲染：**
- 使用 `<pre>` 标签显示文本
- 支持自动换行
- 最大高度限制，超出滚动

#### 1.4.2 JSON Preview

**节点定义：**
- 类型：`json-preview`
- 分类：`viewer`
- 图标：`Braces` (lucide-react)
- 配置字段：
  - `json`: JSON 输入，`dataType: "string"`，带输入端口，支持多行，无输出端口
- 输出：无

**UI 渲染：**
- 解析 JSON 并以树形结构显示
- 支持折叠/展开 JSON 属性
- 使用缩进表示层级
- 颜色区分类型（字符串=绿色，数字=蓝色，布尔=紫色，null=灰色）

**实现方案：**
```tsx
function JsonTreeNode({ data, depth = 0 }: { data: unknown; depth?: number }) {
  const [expanded, setExpanded] = useState(depth < 2)
  
  if (data === null) return <span className="text-gray-400">null</span>
  if (typeof data === "boolean") return <span className="text-purple-400">{String(data)}</span>
  if (typeof data === "number") return <span className="text-blue-400">{data}</span>
  if (typeof data === "string") return <span className="text-green-400">"{data}"</span>
  
  if (Array.isArray(data)) {
    return (
      <div>
        <button onClick={() => setExpanded(!expanded)}>
          {expanded ? "▼" : "▶"} [{data.length}]
        </button>
        {expanded && (
          <div style={{ marginLeft: 16 }}>
            {data.map((item, i) => (
              <div key={i}>
                <span className="text-gray-400">{i}: </span>
                <JsonTreeNode data={item} depth={depth + 1} />
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }
  
  if (typeof data === "object") {
    const entries = Object.entries(data)
    return (
      <div>
        <button onClick={() => setExpanded(!expanded)}>
          {expanded ? "▼" : "▶"} {`{${entries.length}}`}
        </button>
        {expanded && (
          <div style={{ marginLeft: 16 }}>
            {entries.map(([key, value]) => (
              <div key={key}>
                <span className="text-yellow-400">"{key}"</span>: 
                <JsonTreeNode data={value} depth={depth + 1} />
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

#### 1.4.3 Image Preview

**节点定义：**
- 类型：`image-preview`
- 分类：`viewer`
- 图标：`Image` (lucide-react)
- 配置字段：
  - `file`: 图片文件，`dataType: "bytes"`，带输入端口，无输出端口
- 输出：无

**UI 渲染：**
- 使用 `<img>` 标签显示图片
- 支持 `URL.createObjectURL` 显示 File 对象
- 最大宽度/高度限制
- 显示图片尺寸信息

**实现方案：**
```typescript
async execute(inputs, config) {
  const file = (inputs.file ?? config.file) as File | null
  if (!file) throw new Error("No file provided")
  
  // 验证是否为图片
  if (!file.type.startsWith("image/")) {
    throw new Error("File is not an image")
  }
  
  // 返回文件信息供 UI 使用
  return { 
    file,
    width: 0,  // 实际尺寸在 UI 中获取
    height: 0,
    size: file.size,
    type: file.type,
  }
}
```

---

## 二、修复 QRCode Decode

**问题：** QRCode Decode 节点无法正常解码 QR 码

**原因：** 原实现使用 placeholder，没有实际解码逻辑

**解决方案：** 使用浏览器原生 `BarcodeDetector` API

```typescript
// lib/adapters/qrcode-decode.ts
async function decodeQRFromImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    
    img.onload = async () => {
      try {
        const canvas = document.createElement("canvas")
        canvas.width = img.width
        canvas.height = img.height
        const ctx = canvas.getContext("2d")!
        ctx.drawImage(img, 0, 0)
        
        // 优先使用 BarcodeDetector API
        if ("BarcodeDetector" in window) {
          try {
            const detector = new (window as any).BarcodeDetector({ 
              formats: ["qr_code"] 
            })
            const results = await detector.detect(canvas)
            if (results.length > 0) {
              URL.revokeObjectURL(url)
              resolve(results[0].rawValue)
              return
            }
          } catch {
            // BarcodeDetector failed, fall through
          }
        }
        
        // 其他浏览器的降级方案
        URL.revokeObjectURL(url)
        reject(new Error("QR code detection not supported in this browser"))
      } catch (error) {
        URL.revokeObjectURL(url)
        reject(error)
      }
    }
    
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error("Failed to load image"))
    }
    
    img.src = url
  })
}
```

**浏览器兼容性：**
- Chrome 83+ ✓
- Edge 83+ ✓
- Opera 69+ ✓
- Firefox ✗（需要 polyfill）
- Safari ✗（需要 polyfill）

**测试：**
- 单元测试：验证配置字段定义
- E2E 测试：使用真实 QR 码图片测试解码

---

## 三、交互优化

### 3.1 Slider 点击不拖动画布

**问题：** 点击 Slider 组件时，画布会跟随鼠标拖动

**原因：** Slider 的鼠标事件冒泡到画布，触发画布拖动

**解决方案：** 在 SliderInput 组件中阻止事件冒泡

```tsx
// components/canvas/nodes/SliderInput.tsx
export function SliderInput({ value, onChange, config }: SliderInputProps) {
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()  // 阻止事件冒泡到画布
  }, [])
  
  return (
    <div onMouseDown={handleMouseDown}>
      <input
        type="range"
        min={config.slider?.min ?? 0}
        max={config.slider?.max ?? 100}
        step={config.slider?.step ?? 1}
        value={value ?? 0}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  )
}
```

**实现位置：**
- `components/canvas/nodes/SliderInput.tsx`
- `components/canvas/nodes/ColorInput.tsx`（同样需要阻止冒泡）

---

### 3.2 Delete 键删除选中的 Node/Edge

**问题：** 选中 Node 或 Edge 后，按 Delete 键无法删除

**解决方案：** 在 Canvas 组件中监听键盘事件

```tsx
// components/canvas/Canvas.tsx
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Delete" || e.key === "Backspace") {
      // 检查是否在输入框中
      const target = e.target as HTMLElement
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) {
        return
      }
      
      const { selectedNodeId, removeNode, edges, removeEdge } = useCanvasStore.getState()
      
      if (selectedNodeId) {
        removeNode(selectedNodeId)
      }
    }
  }
  
  window.addEventListener("keydown", handleKeyDown)
  return () => window.removeEventListener("keydown", handleKeyDown)
}, [])
```

**Edge 删除：**
使用 ReactFlow 的 `onEdgesDelete` 回调：

```tsx
const onEdgesDelete = useCallback((deletedEdges: Edge[]) => {
  for (const edge of deletedEdges) {
    removeEdge(edge.id)
  }
}, [removeEdge])

return (
  <ReactFlow
    ...
    onEdgesDelete={onEdgesDelete}
    selectionKeyCode={null}  // 禁用默认的多选键
  />
)
```

**实现位置：**
- `components/canvas/Canvas.tsx`

---

## 四、文件结构变更

```
lib/adapters/
├── basic.ts              # 新增 booleanNode
├── json-path.ts          # 新增 JSON Path 节点
├── base64-to-file.ts     # 新增 Base64 To File
├── file-to-base64.ts     # 新增 File To Base64
├── file-to-string.ts     # 新增 File To String
├── string-to-file.ts     # 新增 String To File
├── string-preview.ts     # 新增 String Preview
├── json-preview.ts       # 新增 JSON Preview
├── image-preview.ts      # 新增 Image Preview
├── qrcode-decode.ts      # 修复解码逻辑
└── index.ts              # 注册新节点

components/canvas/
├── Canvas.tsx             # 新增 Delete 键支持
├── nodes/
│   ├── SliderInput.tsx    # 修复事件冒泡
│   ├── ColorInput.tsx     # 修复事件冒泡
│   └── JsonTreeViewer.tsx # 新增 JSON 树形组件
```

---

## 五、测试计划

### 5.1 单元测试

| 节点 | 测试内容 |
|------|----------|
| Boolean | 类型定义、execute 返回值 |
| JSON Path | 各种路径查询、边界情况 |
| Base64 To File | Base64 解码、File 创建 |
| File To Base64 | File 读取、Base64 编码 |
| File To String | File 读取、文本转换 |
| String To File | 字符串转 File |
| String Preview | 配置验证 |
| JSON Preview | JSON 解析验证 |
| Image Preview | 图片类型验证 |
| QRCode Decode | 配置验证 |

### 5.2 E2E 测试

| 场景 | 测试步骤 |
|------|----------|
| Boolean 节点 | 拖拽→切换开关→连线→验证输出 |
| JSON Path 节点 | 拖拽→连接 JSON→设置路径→验证结果 |
| File 转换节点 | 拖拽→输入 Base64→验证 File 输出 |
| Preview 节点 | 拖拽→连接输入→验证显示 |
| Delete 键 | 选中节点→按 Delete→验证删除 |
| Slider 点击 | 点击 Slider→验证画布不拖动 |

---

## 六、实施顺序

1. **Phase 1：基础节点** (1-2h)
   - Boolean 节点
   - JSON Path 节点
   - 单元测试

2. **Phase 2：File 转换节点** (2-3h)
   - 4 个 File 转换节点
   - 单元测试

3. **Phase 3：Preview 节点** (3-4h)
   - String Preview
   - JSON Preview（含树形组件）
   - Image Preview
   - 单元测试

4. **Phase 4：交互优化** (1-2h)
   - Slider 事件冒泡修复
   - Delete 键支持
   - E2E 测试

5. **Phase 5：QRCode 修复** (1h)
   - 解码逻辑实现
   - E2E 测试

6. **Phase 6：文档完善** (1h)
   - API 文档
   - 使用示例

**预计总时间：** 9-13 小时

---

## 七、风险与注意事项

1. **QRCode Decode 兼容性**
   - BarcodeDetector API 不支持所有浏览器
   - 需要降级方案或提示用户

2. **JSON Path 性能**
   - 大型 JSON 对象查询可能较慢
   - 考虑添加查询超时机制

3. **Preview 节点内存**
   - Image Preview 需要创建 Object URL
   - 需要在节点删除时释放 URL

4. **Delete 键冲突**
   - 需要排除输入框中的 Delete 操作
   - Edge 删除需要同步 Zustand 状态

5. **测试环境**
   - jsdom 不支持 Image 加载
   - QRCode 测试需要 mock 或 E2E 测试

---

## 八、验收标准

1. ✅ Boolean 节点可切换 true/false 并正确输出
2. ✅ JSON Path 节点支持基本路径查询
3. ✅ 4 个 File 转换节点正常工作
5. ✅ Preview 节点只显示输入，无输出端口
6. ✅ JSON Preview 支持折叠/展开
7. ✅ 点击 Slider 不触动画布拖动
8. ✅ 按 Delete 键可删除选中节点/边
9. ✅ 所有单元测试通过
10. ✅ 所有 E2E 测试通过
11. ✅ Build 成功
