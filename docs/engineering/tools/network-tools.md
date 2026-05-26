---
description: 网络工具实现 - WHOIS、HTTP Tester、Device Info 的核心逻辑和使用方式
type: Permanent
---

# 网络工具实现

## 工具列表

| 工具 | 目录 | 核心依赖 |
|------|------|----------|
| WHOIS 查询 | `app/tools/whois/` | IANA RDAP API |
| HTTP Tester | `app/tools/http-tester/` | Proxy API |
| 设备信息 | `app/tools/device/` | Browser APIs |

## WHOIS 查询 (`whois/`)

### 核心逻辑

使用 RDAP（Registration Data Access Protocol）协议查询域名/IP 信息，通过 IANA 引导查找正确的 RDAP 服务器。

**查询流程**：

```mermaid
flowchart TD
    Q[输入 domain/IP] --> ET[自动检测类型<br/>domain / IPv4 / IPv6]
    ET --> IANA[查询 IANA dns.json<br/>https://data.iana.org/rdap/dns.json]
    IANA --> RS[获取 RDAP Server URL]
    RS --> FETCH[GET {server}/domain/{domain}]
    FETCH --> P[解析 RDAP JSON]
    P --> F[格式化输出]
```

**类型检测规则**：
- 域名：包含字母 + 点，如 `example.com`
- IPv4：4 段数字，如 `8.8.8.8`
- IPv6：冒号分隔，如 `2001:4860:4860::8888`

**IANA DNS JSON**：`https://data.iana.org/rdap/dns.json`
- 包含 TLD（如 .com, .org）与对应 RDAP 服务器的映射
- 对于 IP，使用 CIDR 覆盖范围查找 RDAP 服务器

**RDAP 响应解析**：
```typescript
interface RDAPResponse {
  handles: string[]
  names: string[]
  entities: Entity[]      // 注册人信息
  events: Event[]        // 创建/到期时间
  links: Link[]          // 相关链接
  remarks: Remark[]     // 备注
  // ... 其他字段
}
```

**vCard 解析**：RDAP 的 entities 使用 vCard 格式存储联系信息，需要解析 vCard 数组：
```
BEGIN:VCARD
VERSION:3.0
FN:John Doe
ORG:Example Inc.
EMAIL:john@example.com
END:VCARD
```

**缓存**：12 小时缓存，避免重复查询

### UI 布局

4 列布局：
1. 侧边栏：查询历史、设置
2. 主内容：域名/IP 输入 + 查询按钮
3. 结果区：折叠式展示（基本信息、注册人、DNS 等）
4. Raw 标签：原始 JSON 输出

## HTTP Tester (`http-tester/`)

### 核心逻辑

通过代理 API 发送 HTTP 请求，解决浏览器 CORS 限制。

**代理 API**：`https://web-proxy.apifox.cn/api/v1/request`

**请求格式**（代理需要的信息）：
```typescript
interface ProxyRequest {
  apiMethod: 'GET' | 'POST' | 'PUT' | 'DELETE' | ...
  apiUrl: string           // 目标 URL
  apiHeaders: string      // JSON 格式的 headers
  apiBody: string          // 请求体
  apiEncoding: string      // 响应编码
}
```

**请求头转换**：
- 用户自定义 headers 放在 `apiHeaders` 中
- 代理会在请求时转发这些 headers
- 特殊 headers：`api-h0`(method), `api-o0`(headers), `api-u`(url)

**功能列表**：

| 功能 | 说明 |
|------|------|
| HTTP Methods | GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS |
| Headers 编辑 | key-value 形式添加自定义头 |
| Body 编辑 | raw / JSON / form-data |
| URL Params | 自动同步到 URL 查询参数 |
| 环境变量 | `{{variable}}` 语法支持变量替换 |
| 请求模板 | 保存/加载请求配置 |
| 历史记录 | 最近 50 条请求记录 |
| cURL 导入 | 解析 cURL 命令生成请求 |
| cURL 导出 | 当前请求导出为 cURL 命令 |

**URL 同步**：输入 URL 时，自动同步 query params 到 UI（1 秒防抖）

**响应显示**：
- 状态码 + 状态文本
- 响应时间
- 响应大小
- Headers 查看
- Body 查看（格式化 JSON/XML/HTML）

## 设备信息 (`device/`)

### 核心逻辑

使用浏览器原生 API 收集设备和环境信息。

**信息类别**（6 个标签页）：

### 1. Basic（基本信息）
```typescript
navigator.userAgent        // User Agent 字符串
navigator.platform         // 平台信息
navigator.language         // 语言
navigator.cookieEnabled    // Cookie 启用状态
screen.width / height       // 屏幕分辨率
screen.colorDepth           // 色彩深度
screen.pixelDepth           // 像素深度
window.devicePixelRatio     // DPR
```

### 2. Network（网络信息）
```typescript
navigator.connection?.effectiveType  // 4g/3g/2g
navigator.connection?.downlink       // 下行带宽 (Mbps)
navigator.connection?.rtt            // 往返延迟 (ms)
// IP 地理位置通过 API 获取
fetch('https://api-ipv4.ip.sb/geoip')
```

### 3. System（操作系统）
- 检测方法：解析 User Agent
- Windows / macOS / Linux / Android / iOS
- Windows 10/11, macOS Ventura 等具体版本

### 4. Hardware（硬件信息）
```typescript
navigator.hardwareConcurrency   // CPU 核心数
navigator.deviceMemory          // 设备内存 (GB)
navigator.maxTouchPoints        // 触摸点数
```

### 5. Features（浏览器特性）
```typescript
Notification.permission          // 通知权限
MediaDevices?.enumerateDevices() // 媒体设备
WebGLRenderingContext           // WebGL 支持
SharedArrayBuffer              // SAB 支持
```

### 6. Fingerprint（指纹）
```typescript
// Canvas 指纹
const canvas = document.createElement('canvas')
const ctx = canvas.getContext('2d')
ctx.textBaseline = 'top'
ctx.font = '14px Arial'
ctx.fillText('fingerprint', 2, 2)
// canvas.toDataURL() 哈希后作为指纹

// WebGL 指纹
const gl = canvas.getContext('webgl')
gl.getParameter(gl.RENDERER)     // GPU 渲染器
gl.getParameter(gl.VENDOR)        // GPU 厂商

// Audio 指纹
const ctx = new AudioContext()
const oscillator = ctx.createOscillator()
const analyser = ctx.createAnalyser()
```

**IP 缓存**：localStorage 存储，3 小时有效期

**导出**：单条复制 / 整体 JSON 导出

## 相关文档

- [[02-frontend-architecture]]
- [[05-pwa-offline]]