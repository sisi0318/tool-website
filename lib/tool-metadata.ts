import type { Metadata } from "next"

interface ToolSeoEntry {
  title: string
  description: string
}

// 每个工具页的 SEO 标题与描述（站点主语言为中文）。
// 标题会经根布局的 title.template 追加 “| 工具站”。
export const TOOL_SEO: Record<string, ToolSeoEntry> = {
  "base-converter": {
    title: "进制转换器",
    description: "在线进制转换工具，支持二进制、八进制、十进制、十六进制及 2-64 任意进制互转，BigInt 大数精确计算。",
  },
  bmi: {
    title: "BMI 计算器",
    description: "在线 BMI 身体质量指数计算器，输入身高体重即可计算 BMI 并查看健康范围参考。",
  },
  "case-converter": {
    title: "大小写转换",
    description: "在线文本大小写转换工具，支持大写、小写、标题格式、camelCase、snake_case、kebab-case 等命名风格互转。",
  },
  certificate: {
    title: "证书解析",
    description: "在线 X.509 证书解析工具，支持 PEM、CSR、JWK/JWKS，查看签名算法、有效期与公钥信息。",
  },
  "classic-cipher": {
    title: "古典密码",
    description: "在线古典密码加解密工具，支持凯撒密码、ROT13、埃特巴什码、摩斯电码等经典算法。",
  },
  color: {
    title: "颜色转换器",
    description: "在线颜色格式转换工具，HEX、RGB、HSL、CMYK 互转，附取色器与最近使用调色板。",
  },
  compression: {
    title: "压缩解压",
    description: "在线数据压缩解压工具，支持 GZip、Zlib、Deflate、Brotli 与 ZIP 归档，本地处理不上传。",
  },
  crontab: {
    title: "Cron 表达式",
    description: "在线 Crontab 表达式生成与解析工具，可视化编辑并预览下次执行时间。",
  },
  crypto: {
    title: "加密解密",
    description: "在线 AES、DES、3DES、RC4、Rabbit 加密解密工具，支持自定义密钥、IV 与输出格式，本地计算。",
  },
  csv: {
    title: "CSV 工具",
    description: "在线 CSV/TSV 处理工具，支持与 JSON 互转、自定义分隔符与表格预览。",
  },
  currency: {
    title: "汇率换算",
    description: "在线汇率换算工具，支持 27 种常用货币实时汇率查询与批量换算。",
  },
  "data-detector": {
    title: "数据识别",
    description: "在线智能数据格式识别工具，自动检测 JSON、JWT、Base64、时间戳、UUID 等常见格式。",
  },
  device: {
    title: "设备信息",
    description: "在线查看浏览器与设备信息，包括 User Agent、屏幕分辨率、WebGL 指纹与网络地址。",
  },
  diff: {
    title: "文本对比",
    description: "在线文本差异对比工具，逐行高亮新增、删除与修改内容。",
  },
  "docker-converter": {
    title: "Docker 命令转换",
    description: "在线 docker run 命令与 docker-compose.yml 互转工具，自动解析端口、卷与环境变量。",
  },
  encoding: {
    title: "编码转换",
    description: "在线编码解码工具，支持 Base64、URL、Unicode、HTML 实体、Hex、Base58、Punycode 等 16+ 格式。",
  },
  "exif-viewer": {
    title: "EXIF 查看器",
    description: "在线图片 EXIF 元数据查看工具，读取相机型号、拍摄参数与 GPS 位置信息，本地解析不上传。",
  },
  hash: {
    title: "哈希计算",
    description: "在线哈希计算工具，支持 MD5、SHA-1、SHA-2、SHA-3、SM3、BLAKE2、CRC32，支持文本与大文件。",
  },
  "hex-binary": {
    title: "Hex 查看器",
    description: "在线十六进制查看与转换工具，Hex Dump、文件签名识别与二进制/Base64 互转。",
  },
  hmac: {
    title: "HMAC 计算",
    description: "在线 HMAC 消息认证码计算与验证工具，支持 SHA-256、SHA-512 等算法与多种密钥格式。",
  },
  "http-tester": {
    title: "HTTP 测试",
    description: "在线 HTTP 接口测试工具，支持 GET/POST 等方法、自定义请求头、FormData 与 cURL 导入导出。",
  },
  "image-compress": {
    title: "图片压缩",
    description: "在线图片压缩工具，支持 JPEG、WebP 质量调节与批量压缩，本地处理不上传。",
  },
  "image-convert": {
    title: "图片格式转换",
    description: "在线图片格式转换工具，PNG、JPEG、WebP 批量互转并可调整尺寸，本地处理不上传。",
  },
  "image-coordinates": {
    title: "图片坐标",
    description: "在线图片坐标拾取工具，点击获取像素坐标与百分比位置，适合标注与前端定位。",
  },
  "image-editor": {
    title: "图片编辑",
    description: "在线图片编辑工具，支持裁剪、旋转、翻转与亮度、对比度、饱和度调节，本地处理。",
  },
  "image-to-base64": {
    title: "图片转 Base64",
    description: "在线图片转 Base64 编码工具，生成 Data URL 便于内嵌网页与样式表，本地转换。",
  },
  jce: {
    title: "JCE 解析",
    description: "在线 JCE/Tars 二进制协议解析与编码工具，支持腾讯 Tars 数据结构查看。",
  },
  json: {
    title: "JSON 工具",
    description: "在线 JSON 格式化、压缩、校验与转换工具，支持 YAML 互转、Unicode 转义与树形视图。",
  },
  "json-schema": {
    title: "JSON Schema 校验",
    description: "在线 JSON Schema 校验工具，按 Schema 验证数据并支持从 JSON 推导 Schema。",
  },
  jwt: {
    title: "JWT 解析",
    description: "在线 JWT 解析工具，解码 Header 与 Payload，检查签名算法与过期时间。",
  },
  markdown: {
    title: "Markdown 工具",
    description: "在线 Markdown 编辑预览工具，支持实时渲染、HTML 互转与目录生成。",
  },
  "meme-splitter": {
    title: "表情包切图",
    description: "在线九宫格切图工具，自动检测分隔线并切分表情包图片，支持打包下载。",
  },
  "office-viewer": {
    title: "Office 预览",
    description: "在线 Office 文档预览工具，支持 Word、Excel、PowerPoint（DOCX/XLSX/PPTX）本地查看。",
  },
  "password-generator": {
    title: "密码生成器",
    description: "在线安全密码生成器，自定义长度与字符集，支持口令短语与强度评估。",
  },
  protobuf: {
    title: "Protobuf 解析",
    description: "在线 Protobuf 编解码工具，支持无 Schema 解码、.proto 解析与 JSON 互转。",
  },
  qrcode: {
    title: "二维码生成",
    description: "在线二维码生成器，支持文本、网址、Wi-Fi、名片等类型，可自定义颜色与 Logo。",
  },
  "qrcode-decode": {
    title: "二维码识别",
    description: "在线二维码识别工具，上传或粘贴图片即可解码内容，支持批量与增强识别。",
  },
  regex: {
    title: "正则测试",
    description: "在线正则表达式测试工具，实时高亮匹配、捕获分组与替换，附常用示例库。",
  },
  sql: {
    title: "SQL 格式化",
    description: "在线 SQL 格式化与压缩工具，支持 MySQL、PostgreSQL、SQLite 等方言。",
  },
  subnet: {
    title: "子网计算",
    description: "在线 IP 子网计算器，支持 IPv4/IPv6 CIDR、掩码、网络地址与主机范围计算。",
  },
  "temperature-converter": {
    title: "温度换算",
    description: "在线温度单位换算工具，摄氏度、华氏度、开尔文及科学温标互转。",
  },
  "text-stats": {
    title: "字数统计",
    description: "在线字数统计工具，统计字符、单词、行数、句子与预计阅读时间。",
  },
  time: {
    title: "时间工具",
    description: "在线时间工具，世界时钟、时间戳转换、秒表与倒计时。",
  },
  totp: {
    title: "TOTP 验证码",
    description: "在线 TOTP 两步验证码生成器，兼容 Google Authenticator，支持导入 otpauth 链接。",
  },
  uuid: {
    title: "UUID 生成器",
    description: "在线 UUID 生成器，支持 v1、v4、v7 与批量生成。",
  },
  whois: {
    title: "WHOIS 查询",
    description: "在线 WHOIS/RDAP 域名与 IP 查询工具，查看注册商、注册时间与 DNS 信息。",
  },
  xml: {
    title: "XML 工具",
    description: "在线 XML 格式化、压缩、校验工具，支持 XPath 查询与 JSON 互转。",
  },
}

export const TOOL_IDS = Object.keys(TOOL_SEO)

export function toolPageMetadata(toolId: string): Metadata {
  const entry = TOOL_SEO[toolId]
  if (!entry) return {}

  return {
    title: entry.title,
    description: entry.description,
    alternates: {
      canonical: `/tools/${toolId}`,
    },
    openGraph: {
      title: entry.title,
      description: entry.description,
      url: `/tools/${toolId}`,
    },
  }
}
