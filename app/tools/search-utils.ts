import { translations } from "@/lib/translations"

export interface Tool {
  id: string
  name: string
  description: string
  keywords: string[]
  path: string
}

export function getTools(locale = "en"): Tool[] {
  const t = translations[locale as keyof typeof translations] || translations.en

  return [
    // existing tools
    {
      id: "json",
      name: t.json.title,
      description: t.json.description,
      keywords: ["json", "format", "compress", "minify", "validate", "escape", "unescape", "unicode", "chinese"],
      path: "/tools/json",
    },
    // Add color picker tool
    {
      id: "color",
      name: t.color.title,
      description: t.color.description,
      keywords: ["color", "picker", "hex", "rgb", "hsl", "hwb", "lch", "cmyk", "css", "convert"],
      path: "/tools/color",
    },
    // Add EXIF viewer tool
    // Add temperature converter tool
    {
      id: "temperature-converter",
      name: t.temperatureConverter.title,
      description: t.temperatureConverter.description,
      keywords: [
        "temperature",
        "convert",
        "kelvin",
        "celsius",
        "fahrenheit",
        "rankine",
        "delisle",
        "newton",
        "reaumur",
        "romer",
      ],
      path: "/tools/temperature-converter",
    },
    // Add Docker converter tool
    {
      id: "docker-converter",
      name: t.dockerConverter.title,
      description: t.dockerConverter.description,
      keywords: ["docker", "docker-compose", "container", "convert", "yml", "yaml", "command", "run"],
      path: "/tools/docker-converter",
    },
    // Add Crontab generator tool
    // other tools
    {
      id: "crontab",
      name: t.crontab.title,
      description: t.crontab.description,
      keywords: ["cron", "crontab", "schedule", "job", "task", "linux", "unix", "expression", "generator"],
      path: "/tools/crontab",
    },
    {
      id: "image-to-base64",
      name: t.imageToBase64.title,
      description: t.imageToBase64.description,
      keywords: ["image", "base64", "convert", "encoder", "data url", "inline", "embed"],
      path: "/tools/image-to-base64",
    },
    {
      id: "exif-viewer",
      name: t.exifViewer.title,
      description: t.exifViewer.description,
      keywords: ["exif", "image", "metadata", "photo", "camera", "gps", "location", "viewer"],
      path: "/tools/exif-viewer",
    },
    {
      id: "bmi",
      name: t.bmi.title,
      description: t.bmi.description,
      keywords: ["bmi", "body mass index", "weight", "height", "calculator", "health", "fitness"],
      path: "/tools/bmi",
    },
    {
      id: "regex",
      name: t.regex.title,
      description: t.regex.description,
      keywords: ["regex", "regular expression", "pattern", "match", "test", "validate", "search", "replace"],
      path: "/tools/regex",
    },
    // Add QR Code Decoder tool
    {
      id: "qrcode-decode",
      name: t.qrcodeDecoder?.title || "QR Code Decoder",
      description: t.qrcodeDecoder?.description || "Scan and decode QR code images",
      keywords: ["qr", "qrcode", "decode", "scan", "scanner", "reader", "barcode"],
      path: "/tools/qrcode-decode",
    },
    {
      id: "http-tester",
      name: t.httpTester.title,
      description: t.httpTester.description,
      keywords: ["http", "tester", "request", "api", "rest", "client", "test"],
      path: "/tools/http-tester",
    },
    // 在getTools函数中添加WHOIS工具
    {
      id: "whois",
      name: t.whois?.title || "WHOIS Lookup",
      description: t.whois?.description || "Look up WHOIS information for domains",
      keywords: ["whois", "domain", "lookup", "registrar", "dns", "domain info", "domain search"],
      path: "/tools/whois",
    },
    // UUID Generator
    {
      id: "uuid",
      name: t.uuid?.title || "UUID Generator",
      description: t.uuid?.description || "Generate UUIDs of various versions",
      keywords: ["uuid", "guid", "unique", "identifier", "random", "v4", "v1", "generate"],
      path: "/tools/uuid",
    },
    // JWT Parser
    {
      id: "jwt",
      name: t.jwt?.title || "JWT Parser",
      description: t.jwt?.description || "Parse and validate JWT tokens",
      keywords: ["jwt", "token", "json web token", "parse", "decode", "header", "payload", "signature", "auth"],
      path: "/tools/jwt",
    },
    // Text Statistics
    {
      id: "text-stats",
      name: t.textStats?.title || "Text Statistics",
      description: t.textStats?.description || "Count characters, words, sentences and more",
      keywords: ["text", "statistics", "count", "words", "characters", "sentences", "analyze", "chinese", "english"],
      path: "/tools/text-stats",
    },
    // Image Compress
    {
      id: "image-compress",
      name: t.imageCompress?.title || "Image Compress",
      description: t.imageCompress?.description || "Compress images online with adjustable quality",
      keywords: ["image", "compress", "optimize", "reduce", "size", "quality", "jpeg", "png", "webp", "batch"],
      path: "/tools/image-compress",
    },
    // Image Editor
    {
      id: "image-editor",
      name: t.imageEditor?.title || "Image Editor",
      description: t.imageEditor?.description || "Edit images: crop, rotate, flip, mirror, filters",
      keywords: ["image", "editor", "crop", "rotate", "flip", "mirror", "filter", "brightness", "contrast", "saturation", "edit", "photo"],
      path: "/tools/image-editor",
    },
    // Office Viewer
    {
      id: "office-viewer",
      name: t.officeViewer?.title || "Office Viewer",
      description: t.officeViewer?.description || "Preview Word, Excel, PPT documents online",
      keywords: ["office", "word", "excel", "ppt", "powerpoint", "doc", "docx", "xls", "xlsx", "preview", "viewer", "document"],
      path: "/tools/office-viewer",
    },
    // Meme Splitter
    {
      id: "meme-splitter",
      name: t.memeSplitter?.title || "Smart Splitter",
      description: t.memeSplitter?.description || "Intelligently detect and split meme grids",
      keywords: ["meme", "splitter", "split", "grid", "cut", "slice", "image", "sticker", "emoji", "表情包", "切图", "九宫格"],
      path: "/tools/meme-splitter",
    },
    // Image Coordinates
    {
      id: "image-coordinates",
      name: t.imageCoordinates?.title || "Coordinate Picker",
      description: t.imageCoordinates?.description || "Pick coordinates from image with percent, permille, permyriad formats",
      keywords: ["coordinate", "position", "pixel", "percent", "permille", "permyriad", "image", "picker", "坐标", "位置", "百分比", "千分比", "万分比"],
      path: "/tools/image-coordinates",
    },
    // Case Converter
    {
      id: "case-converter",
      name: t.caseConverter?.title || "Case Converter",
      description: t.caseConverter?.description || "Convert text case: uppercase, lowercase, title case, camelCase, etc.",
      keywords: ["case", "convert", "uppercase", "lowercase", "title", "camel", "pascal", "snake", "kebab", "text"],
      path: "/tools/case-converter",
    },
    // TOTP Authenticator
    {
      id: "totp",
      name: t.totp?.title || "TOTP Authenticator",
      description: t.totp?.description || "Time-based One-Time Password generator, compatible with Google Authenticator",
      keywords: ["totp", "otp", "authenticator", "2fa", "two-factor", "google", "security", "password", "token"],
      path: "/tools/totp",
    },
  ]
}

// 搜索结果类型
export interface SearchResult {
  toolId: string
  toolName: string
  featureName: string
  featureDescription?: string
}

// Make the function more robust by adding null checks for each translation section

// 创建可搜索的功能列表
export function createSearchableFeatures(translations: any): SearchResult[] {
  const features: SearchResult[] = []

  // Only add features if the corresponding translation section exists
  if (translations?.hash?.name) {
    // 哈希计算器功能
    features.push(
      { toolId: "hash", toolName: translations.hash.name, featureName: "MD5", featureDescription: "Message Digest 5" },
      {
        toolId: "hash",
        toolName: translations.hash.name,
        featureName: "SHA1",
        featureDescription: "Secure Hash Algorithm 1",
      },
      {
        toolId: "hash",
        toolName: translations.hash.name,
        featureName: "SHA2",
        featureDescription: "Secure Hash Algorithm 2",
      },
      {
        toolId: "hash",
        toolName: translations.hash.name,
        featureName: "SHA3",
        featureDescription: "Secure Hash Algorithm 3",
      },
      {
        toolId: "hash",
        toolName: translations.hash.name,
        featureName: "CRC32",
        featureDescription: "Cyclic Redundancy Check",
      },
    )
  }

  // Add color picker features
  if (translations?.color?.name) {
    features.push(
      {
        toolId: "color",
        toolName: translations.color.name,
        featureName: "HEX",
        featureDescription: "Hexadecimal color code",
      },
      {
        toolId: "color",
        toolName: translations.color.name,
        featureName: "RGB",
        featureDescription: "Red, Green, Blue color model",
      },
      {
        toolId: "color",
        toolName: translations.color.name,
        featureName: "HSL",
        featureDescription: "Hue, Saturation, Lightness color model",
      },
      {
        toolId: "color",
        toolName: translations.color.name,
        featureName: "HWB",
        featureDescription: "Hue, Whiteness, Blackness color model",
      },
      {
        toolId: "color",
        toolName: translations.color.name,
        featureName: "LCH",
        featureDescription: "Lightness, Chroma, Hue color model",
      },
      {
        toolId: "color",
        toolName: translations.color.name,
        featureName: "CMYK",
        featureDescription: "Cyan, Magenta, Yellow, Key (Black) color model",
      },
      {
        toolId: "color",
        toolName: translations.color.name,
        featureName: "Color Names",
        featureDescription: "CSS color names",
      },
    )
  }

  // Add EXIF viewer features
  if (translations?.exifViewer?.name) {
    features.push(
      {
        toolId: "exif-viewer",
        toolName: translations.exifViewer.name,
        featureName: "EXIF",
        featureDescription: "Extract EXIF metadata from images",
      },
      {
        toolId: "exif-viewer",
        toolName: translations.exifViewer.name,
        featureName: "GPS",
        featureDescription: "Extract GPS location from photos",
      },
      {
        toolId: "exif-viewer",
        toolName: translations.exifViewer.name,
        featureName: "Camera Info",
        featureDescription: "View camera settings from photos",
      },
      {
        toolId: "exif-viewer",
        toolName: translations.exifViewer.name,
        featureName: "Photo Metadata",
        featureDescription: "View all image metadata",
      },
    )
  }

  // Add temperature converter features
  if (translations?.temperatureConverter?.name) {
    features.push(
      {
        toolId: "temperature-converter",
        toolName: translations.temperatureConverter.name,
        featureName: "Kelvin",
        featureDescription: "Kelvin temperature scale",
      },
      {
        toolId: "temperature-converter",
        toolName: translations.temperatureConverter.name,
        featureName: "Celsius",
        featureDescription: "Celsius temperature scale",
      },
      {
        toolId: "temperature-converter",
        toolName: translations.temperatureConverter.name,
        featureName: "Fahrenheit",
        featureDescription: "Fahrenheit temperature scale",
      },
      {
        toolId: "temperature-converter",
        toolName: translations.temperatureConverter.name,
        featureName: "Rankine",
        featureDescription: "Rankine temperature scale",
      },
      {
        toolId: "temperature-converter",
        toolName: translations.temperatureConverter.name,
        featureName: "Delisle",
        featureDescription: "Delisle temperature scale",
      },
      {
        toolId: "temperature-converter",
        toolName: translations.temperatureConverter.name,
        featureName: "Newton",
        featureDescription: "Newton temperature scale",
      },
      {
        toolId: "temperature-converter",
        toolName: translations.temperatureConverter.name,
        featureName: "Réaumur",
        featureDescription: "Réaumur temperature scale",
      },
      {
        toolId: "temperature-converter",
        toolName: translations.temperatureConverter.name,
        featureName: "Rømer",
        featureDescription: "Rømer temperature scale",
      },
    )
  }

  // Add Docker converter features
  if (translations?.dockerConverter?.name) {
    features.push(
      {
        toolId: "docker-converter",
        toolName: translations.dockerConverter.name,
        featureName: "Docker Run",
        featureDescription: "Convert docker run command to docker-compose",
      },
      {
        toolId: "docker-converter",
        toolName: translations.dockerConverter.name,
        featureName: "docker-compose",
        featureDescription: "Generate docker-compose.yml from command line",
      },
      {
        toolId: "docker-converter",
        toolName: translations.dockerConverter.name,
        featureName: "Container",
        featureDescription: "Docker container configuration",
      },
    )
  }

  // Add Crontab generator features
  if (translations?.tools?.crontab?.name) {
    features.push(
      {
        toolId: "crontab",
        toolName: translations.tools.crontab.name,
        featureName: "Cron",
        featureDescription: "Cron expression generator",
      },
      {
        toolId: "crontab",
        toolName: translations.tools.crontab.name,
        featureName: "Schedule",
        featureDescription: "Job scheduling expression",
      },
      {
        toolId: "crontab",
        toolName: translations.tools.crontab.name,
        featureName: "Linux",
        featureDescription: "Linux task scheduling",
      },
      {
        toolId: "crontab",
        toolName: translations.tools.crontab.name,
        featureName: "Unix",
        featureDescription: "Unix task scheduling",
      },
    )
  }

  // Add Image to Base64 converter features
  if (translations?.imageToBase64?.name) {
    features.push(
      {
        toolId: "image-to-base64",
        toolName: translations.imageToBase64.name,
        featureName: "Image to Base64",
        featureDescription: "Convert images to Base64 encoded strings",
      },
      {
        toolId: "image-to-base64",
        toolName: translations.imageToBase64.name,
        featureName: "Data URL",
        featureDescription: "Convert images to data URLs",
      },
      {
        toolId: "image-to-base64",
        toolName: translations.imageToBase64.name,
        featureName: "Image Embed",
        featureDescription: "Create embeddable image strings",
      },
    )
  }

  if (translations?.hmac?.name) {
    // HMAC计算器功能
    features.push(
      {
        toolId: "hmac",
        toolName: translations.hmac.name,
        featureName: "HMAC",
        featureDescription: "Hash-based Message Authentication Code",
      },
      {
        toolId: "hmac",
        toolName: translations.hmac.name,
        featureName: "HMAC-MD5",
        featureDescription: "HMAC with MD5",
      },
      {
        toolId: "hmac",
        toolName: translations.hmac.name,
        featureName: "HMAC-SHA1",
        featureDescription: "HMAC with SHA1",
      },
      {
        toolId: "hmac",
        toolName: translations.hmac.name,
        featureName: "HMAC-SHA256",
        featureDescription: "HMAC with SHA256",
      },
      {
        toolId: "hmac",
        toolName: translations.hmac.name,
        featureName: "HMAC-SHA512",
        featureDescription: "HMAC with SHA512",
      },
      {
        toolId: "hmac",
        toolName: translations.hmac.name,
        featureName: "MD5",
        featureDescription: "HMAC with MD5",
      },
      {
        toolId: "hmac",
        toolName: translations.hmac.name,
        featureName: "SHA1",
        featureDescription: "HMAC with SHA1",
      },
      {
        toolId: "hmac",
        toolName: translations.hmac.name,
        featureName: "SHA256",
        featureDescription: "HMAC with SHA256",
      },
      {
        toolId: "hmac",
        toolName: translations.hmac.name,
        featureName: "SHA512",
        featureDescription: "HMAC with SHA512",
      },
    )
  }

  if (translations?.crypto?.name) {
    // 加解密工具功能
    features.push(
      {
        toolId: "crypto",
        toolName: translations.crypto.name,
        featureName: "AES",
        featureDescription: "Advanced Encryption Standard",
      },
      {
        toolId: "crypto",
        toolName: translations.crypto.name,
        featureName: "DES",
        featureDescription: "Data Encryption Standard",
      },
      { toolId: "crypto", toolName: translations.crypto.name, featureName: "3DES", featureDescription: "Triple DES" },
      {
        toolId: "crypto",
        toolName: translations.crypto.name,
        featureName: "Blowfish",
        featureDescription: "Blowfish Encryption",
      },
      {
        toolId: "crypto",
        toolName: translations.crypto.name,
        featureName: "RC4",
        featureDescription: "Rivest Cipher 4",
      },
      {
        toolId: "crypto",
        toolName: translations.crypto.name,
        featureName: "Rabbit",
        featureDescription: "Rabbit Stream Cipher",
      },
    )
  }

  if (translations?.encoding?.name) {
    // 编码解码工具功能
    features.push(
      {
        toolId: "encoding",
        toolName: translations.encoding.name,
        featureName: "Base64",
        featureDescription: "Base64 Encoding/Decoding",
      },
      {
        toolId: "encoding",
        toolName: translations.encoding.name,
        featureName: "URL",
        featureDescription: "URL Encoding/Decoding",
      },
      {
        toolId: "encoding",
        toolName: translations.encoding.name,
        featureName: "Hex",
        featureDescription: "Hexadecimal Encoding/Decoding",
      },
    )
  }

  if (translations?.classicCipher?.name) {
    // 经典密码工具功能
    features.push(
      {
        toolId: "classic-cipher",
        toolName: translations.classicCipher.name,
        featureName: "Caesar",
        featureDescription: "Caesar Cipher",
      },
      {
        toolId: "classic-cipher",
        toolName: translations.classicCipher.name,
        featureName: "Vigenère",
        featureDescription: "Vigenère Cipher",
      },
      {
        toolId: "classic-cipher",
        toolName: translations.classicCipher.name,
        featureName: "Atbash",
        featureDescription: "Atbash Cipher",
      },
    )
  }

  if (translations?.currency?.name) {
    // 汇率转换工具功能
    features.push(
      {
        toolId: "currency",
        toolName: translations.currency.name,
        featureName: "Currency",
        featureDescription: "Currency Conversion",
      },
      {
        toolId: "currency",
        toolName: translations.currency.name,
        featureName: "Exchange Rate",
        featureDescription: "Currency Exchange Rate",
      },
      {
        toolId: "currency",
        toolName: translations.currency.name,
        featureName: "USD",
        featureDescription: "US Dollar Conversion",
      },
      {
        toolId: "currency",
        toolName: translations.currency.name,
        featureName: "EUR",
        featureDescription: "Euro Conversion",
      },
      {
        toolId: "currency",
        toolName: translations.currency.name,
        featureName: "CNY",
        featureDescription: "Chinese Yuan Conversion",
      },
      {
        toolId: "currency",
        toolName: translations.currency.name,
        featureName: "JPY",
        featureDescription: "Japanese Yen Conversion",
      },
      {
        toolId: "currency",
        toolName: translations.currency.name,
        featureName: "GBP",
        featureDescription: "British Pound Conversion",
      },
    )
  }

  if (translations?.time?.name) {
    // 时间工具功能
    features.push(
      {
        toolId: "time",
        toolName: translations.time.name,
        featureName: "Current Time",
        featureDescription: "Display current time",
      },
      {
        toolId: "time",
        toolName: translations.time.name,
        featureName: "World Clock",
        featureDescription: "Time in different time zones",
      },
      {
        toolId: "time",
        toolName: translations.time.name,
        featureName: "Stopwatch",
        featureDescription: "Track elapsed time",
      },
      {
        toolId: "time",
        toolName: translations.time.name,
        featureName: "Timer",
        featureDescription: "Countdown timer",
      },
    )
  }

  if (translations?.qrcode?.name) {
    // 二维码生成器功能
    features.push(
      {
        toolId: "qrcode",
        toolName: translations.qrcode.name,
        featureName: "QR Code",
        featureDescription: "Generate QR codes",
      },
      {
        toolId: "qrcode",
        toolName: translations.qrcode.name,
        featureName: "URL QR Code",
        featureDescription: "Generate QR code for URLs",
      },
      {
        toolId: "qrcode",
        toolName: translations.qrcode.name,
        featureName: "vCard",
        featureDescription: "Generate QR code for contact information",
      },
      {
        toolId: "qrcode",
        toolName: translations.qrcode.name,
        featureName: "WiFi",
        featureDescription: "Generate QR code for WiFi networks",
      },
    )
  }

  if (translations?.json?.name) {
    // JSON工具功能
    features.push(
      {
        toolId: "json",
        toolName: translations.json.name,
        featureName: "Format",
        featureDescription: "JSON Formatting",
      },
      {
        toolId: "json",
        toolName: translations.json.name,
        featureName: "Minify",
        featureDescription: "JSON Minification",
      },
      {
        toolId: "json",
        toolName: translations.json.name,
        featureName: "Validate",
        featureDescription: "JSON Validation",
      },
      {
        toolId: "json",
        toolName: translations.json.name,
        featureName: "JSON to YAML",
        featureDescription: "Convert JSON to YAML",
      },
      {
        toolId: "json",
        toolName: translations.json.name,
        featureName: "YAML to JSON",
        featureDescription: "Convert YAML to JSON",
      },
      {
        toolId: "json",
        toolName: translations.json.name,
        featureName: "JSONPath",
        featureDescription: "Query JSON with JSONPath",
      },
    )
  }

  if (translations?.crontab?.name) {
    features.push(
      {
        toolId: "crontab",
        toolName: translations.crontab.name,
        featureName: "Cron",
        featureDescription: "Cron expression generator",
      },
      {
        toolId: "crontab",
        toolName: translations.crontab.name,
        featureName: "Schedule",
        featureDescription: "Job scheduling expression",
      },
      {
        toolId: "crontab",
        toolName: translations.crontab.name,
        featureName: "Linux",
        featureDescription: "Linux task scheduling",
      },
      {
        toolId: "crontab",
        toolName: translations.crontab.name,
        featureName: "Unix",
        featureDescription: "Unix task scheduling",
      },
    )
  }

  if (translations?.imageToBase64?.name) {
    features.push(
      {
        toolId: "image-to-base64",
        toolName: translations.imageToBase64.name,
        featureName: "Image to Base64",
        featureDescription: "Convert images to Base64 encoded strings",
      },
      {
        toolId: "image-to-base64",
        toolName: translations.imageToBase64.name,
        featureName: "Data URL",
        featureDescription: "Convert images to data URLs",
      },
      {
        toolId: "image-to-base64",
        toolName: translations.imageToBase64.name,
        featureName: "Image Embed",
        featureDescription: "Create embeddable image strings",
      },
    )
  }

  if (translations?.exifViewer?.name) {
    features.push(
      {
        toolId: "exif-viewer",
        toolName: translations.exifViewer.name,
        featureName: "EXIF",
        featureDescription: "Extract EXIF metadata from images",
      },
      {
        toolId: "exif-viewer",
        toolName: translations.exifViewer.name,
        featureName: "GPS",
        featureDescription: "Extract GPS location from photos",
      },
      {
        toolId: "exif-viewer",
        toolName: translations.exifViewer.name,
        featureName: "Camera Info",
        featureDescription: "View camera settings from photos",
      },
      {
        toolId: "exif-viewer",
        toolName: translations.exifViewer.name,
        featureName: "Photo Metadata",
        featureDescription: "View all image metadata",
      },
    )
  }

  if (translations?.bmi?.name) {
    features.push(
      {
        toolId: "bmi",
        toolName: translations.bmi.name,
        featureName: "BMI",
        featureDescription: "Body Mass Index Calculator",
      },
      {
        toolId: "bmi",
        toolName: translations.bmi.name,
        featureName: "Weight",
        featureDescription: "Calculate healthy weight range",
      },
      {
        toolId: "bmi",
        toolName: translations.bmi.name,
        featureName: "Health",
        featureDescription: "Check weight health status",
      },
    )
  }

  if (translations?.regex?.name) {
    features.push(
      {
        toolId: "regex",
        toolName: translations.regex.name,
        featureName: "Regex",
        featureDescription: "Regular Expression Tester",
      },
      {
        toolId: "regex",
        toolName: translations.regex.name,
        featureName: "Email",
        featureDescription: "Email validation pattern",
      },
      {
        toolId: "regex",
        toolName: translations.regex.name,
        featureName: "URL",
        featureDescription: "URL validation pattern",
      },
      {
        toolId: "regex",
        toolName: translations.regex.name,
        featureName: "Phone",
        featureDescription: "Phone number validation pattern",
      },
      {
        toolId: "regex",
        toolName: translations.regex.name,
        featureName: "Date",
        featureDescription: "Date validation pattern",
      },
      {
        toolId: "regex",
        toolName: translations.regex.name,
        featureName: "IP",
        featureDescription: "IP address validation pattern",
      },
      {
        toolId: "regex",
        toolName: translations.regex.name,
        featureName: "Password",
        featureDescription: "Password strength validation pattern",
      },
    )
  }

  // Add QR Code Decoder features
  if (translations?.qrcodeDecoder?.name) {
    features.push(
      {
        toolId: "qrcode-decode",
        toolName: translations.qrcodeDecoder.name,
        featureName: "QR Code",
        featureDescription: "Decode QR codes from images",
      },
      {
        toolId: "qrcode-decode",
        toolName: translations.qrcodeDecoder.name,
        featureName: "QR Scanner",
        featureDescription: "Scan QR codes with camera",
      },
      {
        toolId: "qrcode-decode",
        toolName: translations.qrcodeDecoder.name,
        featureName: "Barcode",
        featureDescription: "Read QR code content",
      },
    )
  }

  // Add HTTP Tester features
  if (translations?.httpTester?.name) {
    features.push(
      {
        toolId: "http-tester",
        toolName: translations.httpTester.name,
        featureName: "HTTP Request",
        featureDescription: "Test HTTP requests",
      },
      {
        toolId: "http-tester",
        toolName: translations.httpTester.name,
        featureName: "API Testing",
        featureDescription: "Test REST APIs",
      },
      {
        toolId: "http-tester",
        toolName: translations.httpTester.name,
        featureName: "Request Headers",
        featureDescription: "View and modify request headers",
      },
      {
        toolId: "http-tester",
        toolName: translations.httpTester.name,
        featureName: "Response",
        featureDescription: "View HTTP response",
      },
    )
  }

  // 在createSearchableFeatures函数中添加WHOIS相关的搜索功能
  // Add WHOIS lookup features
  if (translations?.whois?.name) {
    features.push(
      {
        toolId: "whois",
        toolName: translations.whois.name,
        featureName: "WHOIS",
        featureDescription: "Domain WHOIS information lookup",
      },
      {
        toolId: "whois",
        toolName: translations.whois.name,
        featureName: "Domain Info",
        featureDescription: "Check domain registration details",
      },
      {
        toolId: "whois",
        toolName: translations.whois.name,
        featureName: "Registrar",
        featureDescription: "Find domain registrar information",
      },
      {
        toolId: "whois",
        toolName: translations.whois.name,
        featureName: "Name Servers",
        featureDescription: "Check domain name servers",
      },
      {
        toolId: "whois",
        toolName: translations.whois.name,
        featureName: "Domain Expiry",
        featureDescription: "Check when a domain expires",
      },
    )
  }

  // UUID Generator features
  if (translations?.uuid?.name) {
    features.push(
      {
        toolId: "uuid",
        toolName: translations.uuid.name,
        featureName: "UUID",
        featureDescription: "Generate unique identifiers",
      },
      {
        toolId: "uuid",
        toolName: translations.uuid.name,
        featureName: "GUID",
        featureDescription: "Generate globally unique identifiers",
      },
      {
        toolId: "uuid",
        toolName: translations.uuid.name,
        featureName: "UUID v4",
        featureDescription: "Generate random UUIDs",
      },
      {
        toolId: "uuid",
        toolName: translations.uuid.name,
        featureName: "UUID v1",
        featureDescription: "Generate time-based UUIDs",
      },
      {
        toolId: "uuid",
        toolName: translations.uuid.name,
        featureName: "Batch UUID",
        featureDescription: "Generate multiple UUIDs at once",
      },
    )
  }

  // JWT Parser features
  if (translations?.jwt?.name) {
    features.push(
      {
        toolId: "jwt",
        toolName: translations.jwt.name,
        featureName: "JWT",
        featureDescription: "Parse JSON Web Tokens",
      },
      {
        toolId: "jwt",
        toolName: translations.jwt.name,
        featureName: "Token Decode",
        featureDescription: "Decode JWT token content",
      },
      {
        toolId: "jwt",
        toolName: translations.jwt.name,
        featureName: "JWT Header",
        featureDescription: "View JWT header information",
      },
      {
        toolId: "jwt",
        toolName: translations.jwt.name,
        featureName: "JWT Payload",
        featureDescription: "View JWT payload claims",
      },
      {
        toolId: "jwt",
        toolName: translations.jwt.name,
        featureName: "Token Expiry",
        featureDescription: "Check JWT expiration status",
      },
    )
  }

  // Text Statistics features
  if (translations?.textStats?.name) {
    features.push(
      {
        toolId: "text-stats",
        toolName: translations.textStats.name,
        featureName: "Text Count",
        featureDescription: "Count characters, words and sentences",
      },
      {
        toolId: "text-stats",
        toolName: translations.textStats.name,
        featureName: "Word Frequency",
        featureDescription: "Analyze word frequency in text",
      },
      {
        toolId: "text-stats",
        toolName: translations.textStats.name,
        featureName: "Reading Time",
        featureDescription: "Estimate reading time for text",
      },
      {
        toolId: "text-stats",
        toolName: translations.textStats.name,
        featureName: "Chinese Analysis",
        featureDescription: "Analyze Chinese text statistics",
      },
      {
        toolId: "text-stats",
        toolName: translations.textStats.name,
        featureName: "English Analysis",
        featureDescription: "Analyze English text statistics",
      },
    )
  }

  // Image Compress features
  if (translations?.imageCompress?.name) {
    features.push(
      {
        toolId: "image-compress",
        toolName: translations.imageCompress.name,
        featureName: "Image Compress",
        featureDescription: "Compress images with adjustable quality",
      },
      {
        toolId: "image-compress",
        toolName: translations.imageCompress.name,
        featureName: "Batch Compress",
        featureDescription: "Compress multiple images at once",
      },
      {
        toolId: "image-compress",
        toolName: translations.imageCompress.name,
        featureName: "Image Resize",
        featureDescription: "Resize images while compressing",
      },
    )
  }

  // Case Converter features
  if (translations?.caseConverter?.name) {
    features.push(
      {
        toolId: "case-converter",
        toolName: translations.caseConverter.name,
        featureName: "Uppercase",
        featureDescription: "Convert text to uppercase",
      },
      {
        toolId: "case-converter",
        toolName: translations.caseConverter.name,
        featureName: "Lowercase",
        featureDescription: "Convert text to lowercase",
      },
      {
        toolId: "case-converter",
        toolName: translations.caseConverter.name,
        featureName: "Title Case",
        featureDescription: "Convert text to title case",
      },
      {
        toolId: "case-converter",
        toolName: translations.caseConverter.name,
        featureName: "camelCase",
        featureDescription: "Convert text to camelCase",
      },
    )
  }

  // TOTP features
  if (translations?.totp?.name) {
    features.push(
      {
        toolId: "totp",
        toolName: translations.totp.name,
        featureName: "TOTP Generator",
        featureDescription: "Generate time-based one-time passwords",
      },
      {
        toolId: "totp",
        toolName: translations.totp.name,
        featureName: "2FA Authenticator",
        featureDescription: "Two-factor authentication code generator",
      },
    )
  }

  return features
}

// 搜索功能
export function searchFeatures(features: SearchResult[], term: string): SearchResult[] {
  if (!term || !term.trim()) {
    return []
  }

  const normalizedTerm = term.toLowerCase().trim()

  return features.filter(
    (feature) =>
      feature.featureName.toLowerCase().includes(normalizedTerm) ||
      feature.toolName.toLowerCase().includes(normalizedTerm) ||
      (feature.featureDescription && feature.featureDescription.toLowerCase().includes(normalizedTerm)),
  )
}
