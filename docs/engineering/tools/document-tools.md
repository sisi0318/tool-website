---
description: 文档查看工具实现 - Office Viewer 和 Doc Viewer 的核心逻辑和使用方式
type: Permanent
---

# 文档查看工具实现

## 工具列表

| 工具 | 目录 | 核心依赖 |
|------|------|----------|
| Office 预览 | `app/tools/office-viewer/` | `mammoth`, `xlsx`, `pptx-preview` |
| 文档查看 | `app/tools/doc-viewer/` | `docx-preview`, `xlsx` |

## Office 预览 (`office-viewer/`)

### 核心逻辑

使用专门的库分别处理 Word、Excel、PowerPoint 文件。

**支持的格式**：

| 格式 | 库 | 方法 |
|------|-----|------|
| .doc, .docx | `mammoth` | `mammoth.convertToHtml()` |
| .xls, .xlsx, .csv | `xlsx` | `XLSX.read()` + `sheet_to_json()` |
| .ppt, .pptx | `pptx-preview` | `pptxPreview.init()` + `preview()` |

### Word 预览

```typescript
import mammoth from 'mammoth'

const result = await mammoth.convertToHtml({ arrayBuffer: fileBuffer })
document.getElementById('preview').innerHTML = result.value
```

- 支持文本、段落、标题、列表、表格
- 图片提取为 Base64 内嵌
- 样式映射到 CSS

### Excel 预览

```typescript
import * as XLSX from 'xlsx'

const workbook = XLSX.read(arrayBuffer, { type: 'array' })
const sheet = workbook.Sheets[workbook.SheetNames[0]]
const data = XLSX.utils.sheet_to_json(sheet, { header: 1 })
```

- 以表格形式渲染
- 支持多 Sheet 切换
- 显示 Sheet 名称列表
- 支持显示原始数据（不解释公式）

### PowerPoint 预览

```typescript
import pptxPreview from 'pptx-preview'

await pptxPreview.init()
const pptx = new pptxPreview()
await pptx.preview(arrayBuffer, containerElement, {
  progress: (percent) => console.log(percent)
})
```

- 渲染每一页为图片
- 页面导航（上一页/下一页/跳转）
- 缩放控制（50%-200%）
- 全屏模式

### UI 布局

4 列布局：
1. 侧边栏：文件信息（大小、页数/ Sheet 数）、缩放控制
2. 预览区：渲染结果
3. 工具栏：下载、打印、全屏
4. 状态栏：当前页/总页数、渲染进度

### 支持格式检测

```typescript
function detectFormat(filename: string): 'word' | 'excel' | 'ppt' | 'unknown' {
  const ext = filename.split('.').pop().toLowerCase()
  if (['doc', 'docx'].includes(ext)) return 'word'
  if (['xls', 'xlsx', 'csv'].includes(ext)) return 'excel'
  if (['ppt', 'pptx'].includes(ext)) return 'ppt'
  return 'unknown'
}
```

## 文档查看 (`doc-viewer/`)

### 核心逻辑

比 Office Viewer 更轻量的文档查看器，专注 docx/xlsx/xls。

**支持的格式**：.docx, .xlsx, .xls

**Word 处理**：
```typescript
import { renderAsync } from 'docx-preview'

const container = document.getElementById('doc-container')
await renderAsync(fileBuffer, container, undefined, {
  className: 'doc-preview',
  inlinerWorkaround: true,
})
```

- `docx-preview` 专为浏览器设计
- 比 `mammoth` 更适合复杂文档

**Excel 处理**：与 Office Viewer 相同，使用 `xlsx` 库

### UI 设计

- 单列布局
- 上方拖拽上传区域
- 下方预览区
- 不支持多格式混排

## 限制与注意事项

1. **文件大小限制**：大文件可能导致浏览器卡顿，建议 < 10MB
2. **格式兼容**：仅支持 Office Open XML 格式（.docx/.xlsx/.pptx），旧 .doc/.xls 可能无法完美渲染
3. **安全限制**：浏览器无法访问本地文件系统，必须通过文件选择器上传
4. **隐私**：文件在客户端处理，不会上传到服务器

## 相关文档

- [[02-frontend-architecture]]
- [[07-performance]]