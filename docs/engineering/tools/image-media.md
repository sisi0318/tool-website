---
description: 图片与媒体工具实现 - QR码、图片处理、EXIF、Color Picker 的核心逻辑和使用方式
type: Permanent
---

# 图片与媒体工具实现

## 工具列表

| 工具 | 目录 | 核心依赖 |
|------|------|----------|
| QR 码生成 | `app/tools/qrcode/` | `qrcode.react` |
| QR 码解码 | `app/tools/qrcode-decode/` | `jsqr` |
| 图片转 Base64 | `app/tools/image-to-base64/` | FileReader API |
| 图片压缩 | `app/tools/image-compress/` | Browser Canvas API |
| 图片编辑 | `app/tools/image-editor/` | Browser Canvas API |
| 图片坐标 | `app/tools/image-coordinates/` | Browser Canvas API |
| EXIF 查看器 | `app/tools/exif-viewer/` | `exifr` |
| 表情包分割 | `app/tools/meme-splitter/` | Browser Canvas API + `jszip` |
| 取色器 | `app/tools/color/` | 自定义算法 |

## QR 码生成 (`qrcode/`)

### 核心逻辑

使用 `qrcode.react` 库（基于 `qrcode`）生成二维码。

**支持的类型**：

| 类型 | 数据格式 |
|------|----------|
| 文本 | 任意字符串 |
| URL | http/https 链接 |
| vCard | 名片格式（姓名、电话、邮件等） |
| 电话 | `tel:+...` |
| 邮件 | `mailto:...` |
| SMS | `sms:+...?body=...` |
| 位置 | `geo:lat,lng?q=name` |
| 事件 | `BEGIN:VEVENT...` |
| WiFi | `WIFI:T:WPA;S:SSID;P:password;;` |
| 支付 | 支付宝/微信支付参数 |

**自定义选项**：
- 尺寸（像素）
- 错误纠正级别（L/M/Q/H）
- 前景/背景颜色
- Logo 叠加
- 圆角样式

### 实现要点

```typescript
import { QRCodeSVG } from 'qrcode.react'
// 使用 SVG 渲染，支持任意缩放
```

**数据编码**：自动选择最紧凑的编码模式（Numeric/Alphanumeric/Byte/Kanji）

## QR 码解码 (`qrcode-decode/`)

### 核心逻辑

使用 `jsqr` 库（纯 JS QR 码检测和解码）。

**输入方式**：
1. 文件上传（支持拖拽）
2. 摄像头实时扫描（`navigator.mediaDevices.getUserMedia`）

**处理流程**：
1. 读取图片为 ImageData
2. `jsqr()` 检测 QR 码位置
3. 解码得到字符串内容
4. 根据内容类型自动识别（URL/TEXT/VCARD 等）

**摄像头模式**：
- 实时预览流
- 自动对焦和曝光调整
- 支持前置/后置摄像头切换

## 图片转 Base64 (`image-to-base64/`)

### 核心逻辑

使用浏览器原生 `FileReader` API，无需服务器。

**输入**：用户选择文件或拖拽文件

**输出**：
- Data URL：`data:image/png;base64,iVBORw0KGgo...`
- 纯 Base64 字符串（无前缀）

**图片格式支持**：PNG, JPEG, GIF, WebP, SVG, BMP, ICO, TIFF

**预览**：原图缩略图 + Base64 文本 + 复制按钮

## 图片压缩 (`image-compress/`)

### 核心逻辑

使用 Browser Canvas API 进行图片压缩和质量调整。

**压缩参数**：
- 输出格式：JPEG / PNG / WebP
- 质量：1-100（滑块控制）
- 宽高比锁定（可选）
- 最大尺寸限制

**压缩原理**：
```typescript
const canvas = document.createElement('canvas')
const ctx = canvas.getContext('2d')
ctx.drawImage(imageElement, 0, 0, width, height)
const blob = await new Promise(r => canvas.toBlob(r, mimeType, quality))
```

**实时预览**：调整参数时实时显示压缩效果和预估文件大小

## 图片编辑 (`image-editor/`)

### 核心逻辑

基于 Canvas API 的完整图片编辑器。

**编辑功能**：

| 功能 | 实现 |
|------|------|
| 裁剪 | 绘制裁剪框 + `drawImage` 局部绘制 |
| 旋转 | `ctx.rotate()` + 重新绘制 |
| 翻转 | `ctx.scale(-1, 1)` 或 `ctx.scale(1, -1)` |
| 镜像 | 同翻转 |
| 亮度 | `ctx.filter = 'brightness(n)'` |
| 对比度 | `ctx.filter = 'contrast(n)'` |
| 饱和度 | `ctx.filter = 'saturate(n)'` |
| 灰度 | `ctx.filter = 'grayscale(n)'` |

**历史记录**：操作栈，支持撤销/重做（Ctrl+Z / Ctrl+Shift+Z）

**导出**：下载为 PNG/JPEG，支持质量设置

## 图片坐标 (`image-coordinates/`)

### 核心逻辑

Canvas 事件监听 + 坐标转换。

**功能**：
1. 上传图片
2. 鼠标悬停/点击获取像素坐标
3. 支持多种坐标格式输出：

| 格式 | 示例 |
|------|------|
| 像素 | `x: 100, y: 200` |
| 百分比 | `x: 12.5%, y: 25.0%` |
| 千分比 | `x: 125‰, y: 250‰` |
| 万分比 | `x: 1250‱, y: 2500‱` |

**坐标转换公式**：
```
percent = (coordinate / dimension) * 100
permille = (coordinate / dimension) * 1000
permyriad = (coordinate / dimension) * 10000
```

## EXIF 查看器 (`exif-viewer/`)

### 核心逻辑

使用 `exifr` 库解析 JPEG/PNG/TIFF 等图片的 EXIF 元数据。

**提取的信息类别**：

| 类别 | 内容 |
|------|------|
| 基本 | 相机品牌、型号、软件 |
| 拍摄参数 | ISO、光圈、快门、闪光灯 |
| 图像 | 分辨率、方向、色彩空间 |
| GPS | 纬度、经度、海拔、GPS 时间 |
| 时间 | 原始时间、数字化时间 |
| 镜头 | 焦距、等效焦距 |
| 版权 | 版权信息、艺术家 |

**GPS 解析**：
- 转换 DMS（度分秒）格式为十进制
- 显示在嵌入地图中（如有经纬度）

### 依赖

```typescript
import exifr from 'exifr'
const data = await exifr.parse(file, { gps: true })
```

## 表情包分割 (`meme-splitter/`)

### 核心逻辑

基于 Canvas API 的网格自动检测和图片分割。

**检测算法**：
1. 灰度化图片
2. 边缘检测（ Sobel 或 Canny）
3. 霍夫变换检测直线
4. 计算直线交点确定网格
5. 根据网格线裁剪各区块

**使用场景**：
- 电视剧/动漫台词截图（一行一句）
- 九宫格/多格表情包
- 漫画分镜分割

**输出**：逐个输出分割后的图片，可打包下载（使用 `jszip`）

## 取色器 (`color/`)

### 核心逻辑

自建颜色空间转换算法，支持多种颜色表示互转。

**支持的色彩空间**：

| 格式 | 示例 |
|------|------|
| HEX | `#4CAF50` |
| RGB | `rgb(76, 175, 80)` |
| RGBA | `rgba(76, 175, 80, 1)` |
| HSL | `hsl(122, 39%, 49%)` |
| HSLA | `hsla(122, 39%, 49%, 1)` |
| HWB | `hwb(122, 30%, 31%)` |
| LCH | `lch(58.4, 41.8, 136.9)` |
| CMYK | `cmyk(0%, 54%, 50%, 31%)` |
| CSS 命名 | `green`, `goldenrod` 等 |

**转换链**：
```
HEX ↔ RGB ↔ HSL ↔ LCH
           ↓
         HWB
           ↓
        CMYK
```

**取色方式**：
- 输入 HEX 值
- RGB 滑块
- HSL 滑块
- 吸管工具（点击图片取色）
- 预设色板

**转换算法**：
- HSL ↔ RGB：标准公式
- LCH ↔ Lab ↔ XYZ ↔ RGB：需要白点参考 D65

## 相关文档

- [[07-performance]]
- [[01-design-system]]