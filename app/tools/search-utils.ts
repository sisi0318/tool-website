export interface SearchResult {
  toolId: string
  toolName: string
  featureName: string
  featureDescription?: string
}

type SearchTranslations = Record<string, { name?: string } | undefined>
type FeatureDefinition = readonly [name: string, description?: string]
type FeatureGroup = readonly [toolId: string, features: readonly FeatureDefinition[]]

const SEARCH_FEATURE_GROUPS = {
  hash: ["hash", [
    ["MD5", "MD5 摘要与校验"],
    ["SHA-1", "SHA1 哈希"],
    ["SHA-2", "SHA-224 / SHA-256 / SHA-384 / SHA-512"],
    ["SHA-3", "SHA3 与 Keccak"],
    ["CRC32", "CRC32 校验和"],
  ]],
  hmac: ["hmac", [
    ["HMAC", "带密钥的消息认证码"],
    ["HMAC-SHA256", "SHA-256 HMAC"],
    ["HMAC-SHA512", "SHA-512 HMAC"],
    ["HMAC 验证", "验证签名是否匹配"],
  ]],
  crypto: ["crypto", [
    ["AES", "AES 加密与解密"],
    ["DES / 3DES", "DES 与 Triple DES"],
    ["RC4 / Rabbit", "流加密算法"],
    ["加密解密", "密钥、IV 与输出格式"],
  ]],
  encoding: ["encoding", [
    ["Base64", "Base64 编码与解码"],
    ["URL 编码", "Percent encode / decode"],
    ["Unicode", "Unicode 转义与文本"],
    ["HTML 实体", "HTML entity encode / decode"],
    ["十六进制", "Hex 与文本互转"],
  ]],
  classicCipher: ["classic-cipher", [
    ["凯撒密码", "Caesar cipher"],
    ["维吉尼亚密码", "Vigenère cipher"],
    ["摩斯密码", "Morse code"],
  ]],
  json: ["json", [
    ["JSON 格式化", "Format and pretty print JSON"],
    ["JSON 压缩", "Minify JSON"],
    ["JSON 校验", "Validate and repair JSON"],
    ["JSON / YAML", "JSON 与 YAML 互转"],
    ["转义", "Escape / unescape Unicode 与字符串"],
  ]],
  color: ["color", [
    ["HEX", "HEX 颜色"],
    ["RGB", "RGB / RGBA"],
    ["HSL", "HSL / HSLA"],
    ["CMYK", "CMYK 色彩转换"],
    ["取色器", "颜色选择与转换"],
  ]],
  device: ["device", [
    ["设备指纹", "Browser and device fingerprint"],
    ["User Agent", "浏览器与系统识别"],
    ["屏幕信息", "Screen, viewport and pixel ratio"],
    ["WebGL", "GPU 与渲染器信息"],
  ]],
  protobuf: ["protobuf", [
    ["Protobuf 解码", "Decode binary Protobuf"],
    ["Protobuf 编码", "Encode JSON to Protobuf"],
    ["Proto Schema", ".proto schema parsing"],
  ]],
  baseConverter: ["base-converter", [
    ["二进制", "Base 2 conversion"],
    ["十六进制", "Base 16 conversion"],
    ["Base58 / Base62", "扩展进制转换"],
    ["任意进制", "Base 2 至 Base 64"],
  ]],
  temperatureConverter: ["temperature-converter", [
    ["摄氏度", "Celsius °C"],
    ["华氏度", "Fahrenheit °F"],
    ["开尔文", "Kelvin K"],
    ["温度换算", "常用、科学与历史温标"],
  ]],
  dockerConverter: ["docker-converter", [
    ["Docker Run", "解析 docker run 命令"],
    ["Docker Compose", "生成 docker-compose.yml"],
    ["容器参数", "端口、卷、环境变量"],
  ]],
  crontab: ["crontab", [
    ["Cron 表达式", "Cron expression generator"],
    ["执行时间", "Next runs and schedule"],
    ["定时任务", "Linux / Unix crontab"],
  ]],
  imageToBase64: ["image-to-base64", [
    ["图片转 Base64", "Image to Base64"],
    ["Data URL", "生成可嵌入的数据 URL"],
  ]],
  exifViewer: ["exif-viewer", [
    ["EXIF", "图片元数据"],
    ["相机信息", "Camera and lens metadata"],
    ["GPS", "照片定位信息"],
  ]],
  bmi: ["bmi", [
    ["BMI", "Body mass index"],
    ["身体质量指数", "身高与体重计算"],
  ]],
  regex: ["regex", [
    ["正则测试", "Regular expression tester"],
    ["匹配", "Find matches and capture groups"],
    ["替换", "Regex search and replace"],
    ["常用示例", "Email、URL、手机号等模式"],
  ]],
  qrcode: ["qrcode", [
    ["二维码生成", "QR code generator"],
    ["Wi-Fi 二维码", "Wi-Fi QR payload"],
    ["vCard", "联系人二维码"],
  ]],
  qrcodeDecoder: ["qrcode-decode", [
    ["二维码识别", "Decode QR code image"],
    ["扫码", "QR scanner and reader"],
  ]],
  httpTester: ["http-tester", [
    ["HTTP 请求", "GET / POST / PUT / DELETE"],
    ["请求头", "Headers and authentication"],
    ["环境变量", "Template variables in URL and body"],
    ["cURL", "Import and export cURL"],
    ["响应分析", "Status, headers and timing"],
  ]],
  whois: ["whois", [
    ["WHOIS 查询", "Domain registration lookup"],
    ["域名信息", "Registrar, dates and nameservers"],
  ]],
  passwordGenerator: ["password-generator", [
    ["密码生成", "Secure random password"],
    ["口令短语", "Readable passphrase"],
    ["密码强度", "Entropy and strength"],
  ]],
  uuid: ["uuid", [
    ["UUID v4", "Random UUID"],
    ["UUID v1 / v7", "Time based UUID"],
    ["批量 UUID", "Generate multiple identifiers"],
  ]],
  jwt: ["jwt", [
    ["JWT 解析", "Decode header and payload"],
    ["JWT 验证", "Token signature and claims"],
  ]],
  textStats: ["text-stats", [
    ["字数统计", "Characters, words and lines"],
    ["文本分析", "Sentences and reading time"],
  ]],
  imageCompress: ["image-compress", [
    ["图片压缩", "Reduce image file size"],
    ["压缩质量", "JPEG / WebP quality"],
    ["批量压缩", "Compress multiple images"],
  ]],
  imageConvert: ["image-convert", [
    ["图片格式转换", "PNG、JPEG、WebP、AVIF"],
    ["批量转换", "Batch image conversion"],
    ["调整尺寸", "Resize images"],
  ]],
  imageEditor: ["image-editor", [
    ["图片裁剪", "Crop image"],
    ["旋转翻转", "Rotate, flip and mirror"],
    ["滤镜", "Brightness, contrast and saturation"],
  ]],
  imageCoordinates: ["image-coordinates", [
    ["坐标拾取", "Pick pixel coordinates"],
    ["百分比坐标", "Percent, permille and permyriad"],
  ]],
  caseConverter: ["case-converter", [
    ["大小写转换", "Uppercase and lowercase"],
    ["camelCase", "Camel and Pascal case"],
    ["snake_case", "Snake and kebab case"],
  ]],
  totp: ["totp", [
    ["TOTP", "Time-based one-time password"],
    ["2FA", "Authenticator compatible code"],
    ["二维码导入", "Import otpauth QR code"],
  ]],
  jce: ["jce", [
    ["JCE 解析", "Decode JCE / Tars binary"],
    ["JCE 编码", "Encode JCE / Tars data"],
    ["腾讯 Tars", "Binary protocol"],
  ]],
  diff: ["diff", [
    ["文本对比", "Compare two texts"],
    ["差异高亮", "Added, removed and changed lines"],
  ]],
  dataDetector: ["data-detector", [
    ["智能识别", "Detect data format"],
    ["JSON / JWT / Base64", "常见数据类型检测"],
    ["时间戳 / UUID", "Timestamp and identifier detection"],
  ]],
  compression: ["compression", [
    ["GZip", "GZip compress and decompress"],
    ["Zlib / Deflate", "Zlib and Deflate"],
    ["Brotli", "Brotli compression"],
    ["ZIP", "ZIP archive"],
  ]],
  xmlTools: ["xml", [
    ["XML 格式化", "Format and minify XML"],
    ["XPath", "Query XML with XPath"],
    ["XML / JSON", "Convert XML and JSON"],
  ]],
  csvTools: ["csv", [
    ["CSV / TSV", "Delimited table data"],
    ["CSV / JSON", "Convert CSV and JSON"],
    ["分隔符", "Comma, tab and custom delimiter"],
  ]],
  markdownTools: ["markdown", [
    ["Markdown 预览", "Render Markdown"],
    ["Markdown / HTML", "Convert Markdown and HTML"],
    ["目录", "Table of contents"],
  ]],
  sqlTools: ["sql", [
    ["SQL 格式化", "MySQL、PostgreSQL、SQLite"],
    ["SQL 压缩", "Minify SQL"],
  ]],
  jsonSchemaTools: ["json-schema", [
    ["JSON Schema 校验", "Validate JSON with schema"],
    ["推导 Schema", "Infer schema from JSON"],
  ]],
  subnetTools: ["subnet", [
    ["CIDR", "IPv4 and IPv6 CIDR"],
    ["子网计算", "Network, broadcast and host range"],
    ["掩码", "Netmask and prefix"],
  ]],
  certificateTools: ["certificate", [
    ["X.509 证书", "Inspect certificate"],
    ["PEM / CSR", "Certificate signing request"],
    ["JWK / JWKS", "JSON web keys"],
  ]],
  hexBinaryTools: ["hex-binary", [
    ["Hex Dump", "十六进制查看器"],
    ["文件头", "Magic bytes and file signatures"],
    ["二进制 / Base64", "Binary data conversion"],
  ]],
  officeViewer: ["office-viewer", [
    ["Office 预览", "Word、Excel、PowerPoint"],
    ["文档查看", "DOCX、XLSX、PPTX"],
  ]],
  memeSplitter: ["meme-splitter", [
    ["表情包切图", "Split image grids"],
    ["九宫格", "Detect and slice grid images"],
  ]],
} as const satisfies Record<string, FeatureGroup>

export function createSearchableFeatures(translations: SearchTranslations): SearchResult[] {
  return Object.entries(SEARCH_FEATURE_GROUPS).flatMap(([translationKey, [toolId, features]]) => {
    const toolName = translations[translationKey]?.name
    if (!toolName) return []

    return features.map(([featureName, featureDescription]) => ({
      toolId,
      toolName,
      featureName,
      featureDescription,
    }))
  })
}

export function searchFeatures(features: SearchResult[], term: string): SearchResult[] {
  const normalizedTerm = term.trim().toLocaleLowerCase()
  if (!normalizedTerm) return []

  return features.filter((feature) =>
    [feature.featureName, feature.toolName, feature.featureDescription]
      .filter((value): value is string => Boolean(value))
      .some((value) => value.toLocaleLowerCase().includes(normalizedTerm)),
  )
}
