/**
 * 全站工具目录 —— 单一事实来源。
 *
 * 同一批工具此前散在 7 处手写维护（SEO 元数据、工作台搜索索引、路由栏翻译键、
 * 分类映射、sitemap、首页精选、47 个 layout.tsx），任何一处漏改都会静默出问题：
 * 搜索索引就曾漏掉 currency 与 time，导致搜「汇率」「时间戳」永远没有结果。
 *
 * 本文件只放纯数据，不引入 React —— 服务端的 sitemap / layout 与客户端都能直接用。
 * 图标与动态加载的组件属于 React 关注点，放在 app/tools/tool-components.tsx，
 * 由 lib/tool-registry.test.ts 断言两边覆盖同一批 id。
 */

export type ToolCategoryId = "developer" | "security" | "image" | "text" | "network" | "life"

/** 工作台搜索的功能点：[展示名, 说明] */
export type ToolSearchFeature = readonly [name: string, description?: string]

export interface ToolCatalogEntry {
  /** 路由片段，同时是画布之外全站使用的工具 id */
  id: string
  /** lib/translations.ts 中 tools.<translationKey>.name 的键 */
  translationKey: string
  category: ToolCategoryId
  /** 独立工具页的 SEO 标题与描述（站点主语言为中文） */
  seo: { title: string; description: string }
  features: readonly ToolSearchFeature[]
}

export const TOOL_CATALOG: readonly ToolCatalogEntry[] = [
  {
    id: "base-converter",
    translationKey: "baseConverter",
    category: "developer",
    seo: {
      title: "进制转换器",
      description: "在线进制转换工具，支持二进制、八进制、十进制、十六进制及 2-64 任意进制互转，BigInt 大数精确计算。",
    },
    features: [
      ["二进制", "Base 2 conversion"],
      ["十六进制", "Base 16 conversion"],
      ["Base58 / Base62", "扩展进制转换"],
      ["任意进制", "Base 2 至 Base 64"],
    ],
  },
  {
    id: "bmi",
    translationKey: "bmi",
    category: "life",
    seo: {
      title: "BMI 计算器",
      description: "在线 BMI 身体质量指数计算器，输入身高体重即可计算 BMI 并查看健康范围参考。",
    },
    features: [
      ["BMI", "Body mass index"],
      ["身体质量指数", "身高与体重计算"],
    ],
  },
  {
    id: "case-converter",
    translationKey: "caseConverter",
    category: "text",
    seo: {
      title: "大小写转换",
      description: "在线文本大小写转换工具，支持大写、小写、标题格式、camelCase、snake_case、kebab-case 等命名风格互转。",
    },
    features: [
      ["大小写转换", "Uppercase and lowercase"],
      ["camelCase", "Camel and Pascal case"],
      ["snake_case", "Snake and kebab case"],
    ],
  },
  {
    id: "certificate",
    translationKey: "certificateTools",
    category: "security",
    seo: {
      title: "证书解析",
      description: "在线 X.509 证书解析工具，支持 PEM、CSR、JWK/JWKS，查看签名算法、有效期与公钥信息。",
    },
    features: [
      ["X.509 证书", "Inspect certificate"],
      ["PEM / CSR", "Certificate signing request"],
      ["JWK / JWKS", "JSON web keys"],
    ],
  },
  {
    id: "classic-cipher",
    translationKey: "classicCipher",
    category: "security",
    seo: {
      title: "古典密码",
      description: "在线古典密码加解密工具，支持凯撒密码、ROT13、埃特巴什码、摩斯电码等经典算法。",
    },
    features: [
      ["凯撒密码", "Caesar cipher"],
      ["维吉尼亚密码", "Vigenère cipher"],
      ["摩斯密码", "Morse code"],
    ],
  },
  {
    id: "color",
    translationKey: "color",
    category: "life",
    seo: {
      title: "颜色转换器",
      description: "在线颜色格式转换工具，HEX、RGB、HSL、CMYK 互转，附取色器与最近使用调色板。",
    },
    features: [
      ["HEX", "HEX 颜色"],
      ["RGB", "RGB / RGBA"],
      ["HSL", "HSL / HSLA"],
      ["CMYK", "CMYK 色彩转换"],
      ["取色器", "颜色选择与转换"],
    ],
  },
  {
    id: "compression",
    translationKey: "compression",
    category: "developer",
    seo: {
      title: "压缩解压",
      description: "在线数据压缩解压工具，支持 GZip、Zlib、Deflate、Brotli 与 ZIP 归档，本地处理不上传。",
    },
    features: [
      ["GZip", "GZip compress and decompress"],
      ["Zlib / Deflate", "Zlib and Deflate"],
      ["Brotli", "Brotli compression"],
      ["ZIP 目录", "Browse ZIP folders and preview individual files"],
      ["选择性提取", "Extract selected files, verify CRC32 and download binary results"],
      ["多文件打包", "Create ZIP archives from files and folders"],
    ],
  },
  {
    id: "crontab",
    translationKey: "crontab",
    category: "developer",
    seo: {
      title: "Cron 表达式",
      description: "在线 Crontab 表达式生成与解析工具，可视化编辑并预览下次执行时间。",
    },
    features: [
      ["Cron 表达式", "Cron expression generator"],
      ["执行时间", "Next runs and schedule"],
      ["定时任务", "Linux / Unix crontab"],
    ],
  },
  {
    id: "crypto",
    translationKey: "crypto",
    category: "security",
    seo: {
      title: "加密解密",
      description: "在线 AES、DES、3DES、RC4、Rabbit 加密解密工具，支持自定义密钥、IV 与输出格式，本地计算。",
    },
    features: [
      ["AES", "AES 加密与解密"],
      ["DES / 3DES", "DES 与 Triple DES"],
      ["RC4 / Rabbit", "流加密算法"],
      ["加密解密", "密钥、IV 与输出格式"],
    ],
  },
  {
    id: "csv",
    translationKey: "csvTools",
    category: "developer",
    seo: {
      title: "CSV / JSONL 日志工具",
      description: "浏览器本地 CSV、TSV、JSONL 日志处理，支持筛选、排序、分组计数、错误行定位、结果导出及 JSON 互转。",
    },
    features: [
      ["CSV / TSV", "Delimited table data"],
      ["JSONL / NDJSON", "逐行 JSON 日志"],
      ["筛选 / 分组", "Filter, sort, select columns and count groups"],
      ["CSV / JSON", "Convert CSV and JSON"],
      ["分隔符", "Comma, tab and custom delimiter"],
    ],
  },
  {
    id: "currency",
    translationKey: "currency",
    category: "life",
    seo: {
      title: "汇率换算",
      description: "在线汇率换算工具，支持 27 种常用货币实时汇率查询与批量换算。",
    },
    features: [
      ["汇率换算", "Convert between currencies"],
      ["实时汇率", "Live exchange rates"],
      ["多币种", "Convert to several currencies at once"],
    ],
  },
  {
    id: "data-detector",
    translationKey: "dataDetector",
    category: "developer",
    seo: {
      title: "数据识别",
      description: "在线智能数据格式识别工具，自动检测 JSON、JWT、Base64、时间戳、UUID 等常见格式。",
    },
    features: [
      ["智能识别", "Detect data format"],
      ["JSON / JWT / Base64", "常见数据类型检测"],
      ["时间戳 / UUID", "Timestamp and identifier detection"],
    ],
  },
  {
    id: "device",
    translationKey: "device",
    category: "life",
    seo: {
      title: "设备信息",
      description: "在线查看浏览器与设备信息，包括 User Agent、屏幕分辨率、WebGL 指纹与网络地址。",
    },
    features: [
      ["设备指纹", "Browser and device fingerprint"],
      ["User Agent", "浏览器与系统识别"],
      ["屏幕信息", "Screen, viewport and pixel ratio"],
      ["WebGL", "GPU 与渲染器信息"],
    ],
  },
  {
    id: "diff",
    translationKey: "diff",
    category: "text",
    seo: {
      title: "文本与结构化数据对比",
      description: "对比文本、JSON 和 YAML，逐行高亮或按字段路径显示差异，支持忽略字段和数组按 id 对齐。",
    },
    features: [
      ["文本对比", "Compare two texts"],
      ["差异高亮", "Added, removed and changed lines"],
      ["JSON / YAML 结构化比较", "Structured JSON / YAML diff, ignored paths, arrays matched by id"],
    ],
  },
  {
    id: "docker-converter",
    translationKey: "dockerConverter",
    category: "developer",
    seo: {
      title: "Docker 命令转换",
      description: "在线 docker run 命令与 docker-compose.yml 互转工具，自动解析端口、卷与环境变量。",
    },
    features: [
      ["Docker Run", "解析 docker run 命令"],
      ["Docker Compose", "生成 docker-compose.yml"],
      ["容器参数", "端口、卷、环境变量"],
    ],
  },
  {
    id: "encoding",
    translationKey: "encoding",
    category: "developer",
    seo: {
      title: "编码转换",
      description: "在线编码解码工具，支持 Base64、URL、Unicode、HTML 实体、Hex、Base58、Punycode 等 16+ 格式。",
    },
    features: [
      ["Base64", "Base64 编码与解码"],
      ["URL 编码", "Percent encode / decode"],
      ["Unicode", "Unicode 转义与文本"],
      ["HTML 实体", "HTML entity encode / decode"],
      ["十六进制", "Hex 与文本互转"],
    ],
  },
  {
    id: "exif-viewer",
    translationKey: "exifViewer",
    category: "image",
    seo: {
      title: "EXIF 查看器",
      description: "在线图片 EXIF 元数据查看工具，读取相机型号、拍摄参数与 GPS 位置信息，本地解析不上传。",
    },
    features: [
      ["EXIF", "图片元数据"],
      ["相机信息", "Camera and lens metadata"],
      ["GPS", "照片定位信息"],
    ],
  },
  {
    id: "hash",
    translationKey: "hash",
    category: "security",
    seo: {
      title: "哈希计算",
      description: "在线哈希计算工具，支持 MD5、SHA-1、SHA-2、SHA-3、SM3、BLAKE2、CRC32，支持文本与大文件。",
    },
    features: [
      ["MD5", "MD5 摘要与校验"],
      ["SHA-1", "SHA1 哈希"],
      ["SHA-2", "SHA-224 / SHA-256 / SHA-384 / SHA-512"],
      ["SHA-3", "SHA3 与 Keccak"],
      ["CRC32", "CRC32 校验和"],
    ],
  },
  {
    id: "hex-binary",
    translationKey: "hexBinaryTools",
    category: "developer",
    seo: {
      title: "Hex 查看器",
      description: "在线十六进制查看与转换工具，Hex Dump、文件签名识别与二进制/Base64 互转。",
    },
    features: [
      ["Hex Dump", "十六进制查看器"],
      ["文件头", "Magic bytes and file signatures"],
      ["二进制 / Base64", "Binary data conversion"],
    ],
  },
  {
    id: "hmac",
    translationKey: "hmac",
    category: "security",
    seo: {
      title: "HMAC 计算",
      description: "在线 HMAC 消息认证码计算与验证工具，支持 SHA-256、SHA-512 等算法与多种密钥格式。",
    },
    features: [
      ["HMAC", "带密钥的消息认证码"],
      ["HMAC-SHA256", "SHA-256 HMAC"],
      ["HMAC-SHA512", "SHA-512 HMAC"],
      ["HMAC 验证", "验证签名是否匹配"],
    ],
  },
  {
    id: "http-tester",
    translationKey: "httpTester",
    category: "network",
    seo: {
      title: "HTTP 测试",
      description: "在线 HTTP 接口测试工具，支持 GET/POST 等方法、自定义请求头、FormData 与 cURL 导入导出。",
    },
    features: [
      ["HTTP 请求", "GET / POST / PUT / DELETE"],
      ["请求头", "Headers and authentication"],
      ["环境变量", "Template variables in URL and body"],
      ["cURL", "Import and export cURL"],
      ["响应分析", "Status, headers and timing"],
    ],
  },
  {
    id: "image-compress",
    translationKey: "imageCompress",
    category: "image",
    seo: {
      title: "图片压缩",
      description: "在线图片压缩工具，支持 JPEG、WebP 质量调节与批量压缩，本地处理不上传。",
    },
    features: [
      ["图片压缩", "Reduce image file size"],
      ["压缩质量", "JPEG / WebP quality"],
      ["批量压缩", "Compress multiple images"],
    ],
  },
  {
    id: "image-convert",
    translationKey: "imageConvert",
    category: "image",
    seo: {
      title: "图片格式转换",
      description: "在线图片格式转换工具，PNG、JPEG、WebP 批量互转并可调整尺寸，本地处理不上传。",
    },
    features: [
      ["图片格式转换", "PNG、JPEG、WebP、AVIF"],
      ["批量转换", "Batch image conversion"],
      ["调整尺寸", "Resize images"],
    ],
  },
  {
    id: "image-coordinates",
    translationKey: "imageCoordinates",
    category: "image",
    seo: {
      title: "图片坐标",
      description: "在线图片坐标拾取工具，点击获取像素坐标与百分比位置，适合标注与前端定位。",
    },
    features: [
      ["坐标拾取", "Pick pixel coordinates"],
      ["百分比坐标", "Percent, permille and permyriad"],
    ],
  },
  {
    id: "image-editor",
    translationKey: "imageEditor",
    category: "image",
    seo: {
      title: "图片编辑",
      description: "在线图片编辑工具，支持裁剪、旋转、翻转与亮度、对比度、饱和度调节，本地处理。",
    },
    features: [
      ["图片裁剪", "Crop image"],
      ["旋转翻转", "Rotate, flip and mirror"],
      ["滤镜", "Brightness, contrast and saturation"],
    ],
  },
  {
    id: "image-to-base64",
    translationKey: "imageToBase64",
    category: "image",
    seo: {
      title: "图片转 Base64",
      description: "在线图片转 Base64 编码工具，生成 Data URL 便于内嵌网页与样式表，本地转换。",
    },
    features: [
      ["图片转 Base64", "Image to Base64"],
      ["Data URL", "生成可嵌入的数据 URL"],
    ],
  },
  {
    id: "jce",
    translationKey: "jce",
    category: "developer",
    seo: {
      title: "JCE 解析",
      description: "在线 JCE/Tars 二进制协议解析与编码工具，支持腾讯 Tars 数据结构查看。",
    },
    features: [
      ["JCE 解析", "Decode JCE / Tars binary"],
      ["JCE 编码", "Encode JCE / Tars data"],
      ["腾讯 Tars", "Binary protocol"],
    ],
  },
  {
    id: "json",
    translationKey: "json",
    category: "developer",
    seo: {
      title: "JSON 工具",
      description: "在线 JSON 格式化、压缩、校验与转换工具，支持 YAML 互转、Unicode 转义与树形视图。",
    },
    features: [
      ["JSON 格式化", "Format and pretty print JSON"],
      ["JSON 压缩", "Minify JSON"],
      ["JSON 校验", "Validate and repair JSON"],
      ["JSON / YAML", "JSON 与 YAML 互转"],
      ["转义", "Escape / unescape Unicode 与字符串"],
    ],
  },
  {
    id: "json-schema",
    translationKey: "jsonSchemaTools",
    category: "developer",
    seo: {
      title: "JSON Schema 校验",
      description: "在线 JSON Schema 校验工具，按 Schema 验证数据并支持从 JSON 推导 Schema。",
    },
    features: [
      ["JSON Schema 校验", "Validate JSON with schema"],
      ["推导 Schema", "Infer schema from JSON"],
    ],
  },
  {
    id: "jwt",
    translationKey: "jwt",
    category: "security",
    seo: {
      title: "JWT 解析",
      description: "在线 JWT 解析工具，解码 Header 与 Payload，检查签名算法与过期时间。",
    },
    features: [
      ["JWT 解析", "Decode header and payload"],
      ["JWT 验证", "Token signature and claims"],
    ],
  },
  {
    id: "markdown",
    translationKey: "markdownTools",
    category: "text",
    seo: {
      title: "Markdown 工具",
      description: "在线 Markdown 编辑预览工具，支持实时渲染、HTML 互转与目录生成。",
    },
    features: [
      ["Markdown 预览", "Render Markdown"],
      ["Markdown / HTML", "Convert Markdown and HTML"],
      ["目录", "Table of contents"],
    ],
  },
  {
    id: "meme-splitter",
    translationKey: "memeSplitter",
    category: "image",
    seo: {
      title: "表情包切图",
      description: "在线九宫格切图工具，自动检测分隔线并切分表情包图片，支持打包下载。",
    },
    features: [
      ["表情包切图", "Split image grids"],
      ["九宫格", "Detect and slice grid images"],
    ],
  },
  {
    id: "office-viewer",
    translationKey: "officeViewer",
    category: "text",
    seo: {
      title: "Office 预览",
      description: "在线 Office 文档预览工具，支持 Word、Excel、PowerPoint（DOCX/XLSX/PPTX）本地查看。",
    },
    features: [
      ["Office 预览", "Word、Excel、PowerPoint"],
      ["文档查看", "DOCX、XLSX、PPTX"],
    ],
  },
  {
    id: "password-generator",
    translationKey: "passwordGenerator",
    category: "security",
    seo: {
      title: "密码生成器",
      description: "在线安全密码生成器，自定义长度与字符集，支持口令短语与强度评估。",
    },
    features: [
      ["密码生成", "Secure random password"],
      ["口令短语", "Readable passphrase"],
      ["密码强度", "Entropy and strength"],
    ],
  },
  {
    id: "protobuf",
    translationKey: "protobuf",
    category: "developer",
    seo: {
      title: "Protobuf 解析",
      description: "在线 Protobuf 编解码工具，支持无 Schema 解码、.proto 解析与 JSON 互转。",
    },
    features: [
      ["Protobuf 解码", "Decode binary Protobuf"],
      ["Protobuf 编码", "Encode JSON to Protobuf"],
      ["Proto Schema", ".proto schema parsing"],
    ],
  },
  {
    id: "qrcode",
    translationKey: "qrcode",
    category: "image",
    seo: {
      title: "二维码生成",
      description: "在线二维码生成器，支持文本、网址、Wi-Fi、名片等类型，可自定义颜色与 Logo。",
    },
    features: [
      ["二维码生成", "QR code generator"],
      ["Wi-Fi 二维码", "Wi-Fi QR payload"],
      ["vCard", "联系人二维码"],
    ],
  },
  {
    id: "qrcode-decode",
    translationKey: "qrcodeDecoder",
    category: "image",
    seo: {
      title: "二维码识别",
      description: "在线二维码识别工具，上传或粘贴图片即可解码内容，支持批量与增强识别。",
    },
    features: [
      ["二维码识别", "Decode QR code image"],
      ["扫码", "QR scanner and reader"],
    ],
  },
  {
    id: "regex",
    translationKey: "regex",
    category: "developer",
    seo: {
      title: "正则测试",
      description: "在线正则表达式测试工具，实时高亮匹配、捕获分组与替换，附常用示例库。",
    },
    features: [
      ["正则测试", "Regular expression tester"],
      ["匹配", "Find matches and capture groups"],
      ["替换", "Regex search and replace"],
      ["常用示例", "Email、URL、手机号等模式"],
    ],
  },
  {
    id: "sql",
    translationKey: "sqlTools",
    category: "developer",
    seo: {
      title: "SQL 格式化",
      description: "在线 SQL 格式化与压缩工具，支持 MySQL、PostgreSQL、SQLite 等方言。",
    },
    features: [
      ["SQL 格式化", "MySQL、PostgreSQL、SQLite"],
      ["SQL 压缩", "Minify SQL"],
    ],
  },
  {
    id: "subnet",
    translationKey: "subnetTools",
    category: "network",
    seo: {
      title: "子网计算",
      description: "在线 IP 子网计算器，支持 IPv4/IPv6 CIDR、掩码、网络地址与主机范围计算。",
    },
    features: [
      ["CIDR", "IPv4 and IPv6 CIDR"],
      ["子网计算", "Network, broadcast and host range"],
      ["掩码", "Netmask and prefix"],
    ],
  },
  {
    id: "temperature-converter",
    translationKey: "temperatureConverter",
    category: "life",
    seo: {
      title: "温度换算",
      description: "在线温度单位换算工具，摄氏度、华氏度、开尔文及科学温标互转。",
    },
    features: [
      ["摄氏度", "Celsius °C"],
      ["华氏度", "Fahrenheit °F"],
      ["开尔文", "Kelvin K"],
      ["温度换算", "常用、科学与历史温标"],
    ],
  },
  {
    id: "text-stats",
    translationKey: "textStats",
    category: "text",
    seo: {
      title: "字数统计",
      description: "在线字数统计工具，统计字符、单词、行数、句子与预计阅读时间。",
    },
    features: [
      ["字数统计", "Characters, words and lines"],
      ["文本分析", "Sentences and reading time"],
    ],
  },
  {
    id: "time",
    translationKey: "time",
    category: "life",
    seo: {
      title: "时间工具",
      description: "在线时间工具，世界时钟、时间戳转换、秒表与倒计时。",
    },
    features: [
      ["时间戳转换", "Unix timestamp and date"],
      ["世界时钟", "World clock and time zones"],
      ["秒表", "Stopwatch"],
      ["倒计时", "Countdown timer"],
    ],
  },
  {
    id: "totp",
    translationKey: "totp",
    category: "security",
    seo: {
      title: "TOTP 验证码",
      description: "在线 TOTP 两步验证码生成器，兼容 Google Authenticator，支持导入 otpauth 链接。",
    },
    features: [
      ["TOTP", "Time-based one-time password"],
      ["2FA", "Authenticator compatible code"],
      ["二维码导入", "Import otpauth QR code"],
    ],
  },
  {
    id: "uuid",
    translationKey: "uuid",
    category: "security",
    seo: {
      title: "UUID 生成器",
      description: "在线 UUID 生成器，支持 v1、v4、v7 与批量生成。",
    },
    features: [
      ["UUID v4", "Random UUID"],
      ["UUID v1 / v7", "Time based UUID"],
      ["批量 UUID", "Generate multiple identifiers"],
    ],
  },
  {
    id: "whois",
    translationKey: "whois",
    category: "network",
    seo: {
      title: "WHOIS 查询",
      description: "在线 WHOIS/RDAP 域名与 IP 查询工具，查看注册商、注册时间与 DNS 信息。",
    },
    features: [
      ["WHOIS 查询", "Domain registration lookup"],
      ["域名信息", "Registrar, dates and nameservers"],
    ],
  },
  {
    id: "xml",
    translationKey: "xmlTools",
    category: "developer",
    seo: {
      title: "XML 工具",
      description: "在线 XML 格式化、压缩、校验工具，支持 XPath 查询与 JSON 互转。",
    },
    features: [
      ["XML 格式化", "Format and minify XML"],
      ["XPath", "Query XML with XPath"],
      ["XML / JSON", "Convert XML and JSON"],
    ],
  },
]

export const TOOL_IDS: readonly string[] = TOOL_CATALOG.map((entry) => entry.id)

const BY_ID = new Map(TOOL_CATALOG.map((entry) => [entry.id, entry]))

export function getToolEntry(id: string): ToolCatalogEntry | undefined {
  return BY_ID.get(id)
}

export function isKnownToolId(id: string): boolean {
  return BY_ID.has(id)
}
