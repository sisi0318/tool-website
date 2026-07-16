import { toASCII, toUnicode } from "punycode/"

export const ENCODING_TYPE_IDS = [
  "base64",
  "url",
  "hex",
  "unicode",
  "utf8",
  "ascii",
  "base32",
  "base58",
  "base85",
  "binary",
  "octal",
  "html",
  "morse",
  "rot13",
  "punycode",
  "quoted",
] as const

export type EncodingType = (typeof ENCODING_TYPE_IDS)[number]
export type EncodingDirection = "encode" | "decode"

export interface EncodingDefinition {
  id: EncodingType
  name: string
  aliases: readonly string[]
  description: string
  usage: string
  exampleInput: string
  exampleOutput: string
}

export const ENCODING_DEFINITIONS: readonly EncodingDefinition[] = [
  {
    id: "base64",
    name: "Base64",
    aliases: ["base 64"],
    description: "将 UTF-8 字节转换为可安全放入文本协议的 Base64 字符串。",
    usage: "常用于 API、邮件附件和 Data URL；它是编码，不是加密。",
    exampleInput: "Hello",
    exampleOutput: "SGVsbG8=",
  },
  {
    id: "url",
    name: "URL",
    aliases: ["url 编码", "percent", "百分号编码"],
    description: "使用百分号转义 URL 中有特殊含义的字符。",
    usage: "适合查询参数或路径片段；不要对完整 URL 重复编码。",
    exampleInput: "hello world",
    exampleOutput: "hello%20world",
  },
  {
    id: "hex",
    name: "HEX",
    aliases: ["hexadecimal", "十六进制"],
    description: "把 UTF-8 字节表示为两位十六进制数字。",
    usage: "常用于协议调试、二进制检查和摘要展示。",
    exampleInput: "Hi",
    exampleOutput: "4869",
  },
  {
    id: "unicode",
    name: "Unicode",
    aliases: ["unicode 转义", "\\u"],
    description: "把字符转换为 JavaScript/JSON 常见的 \\uXXXX 转义形式。",
    usage: "支持补充平面字符，并会为其输出正确的 UTF-16 代理对。",
    exampleInput: "你好",
    exampleOutput: "\\u4f60\\u597d",
  },
  {
    id: "utf8",
    name: "UTF-8",
    aliases: ["utf8", "utf-8 字节"],
    description: "显示文本对应的 UTF-8 十六进制字节序列。",
    usage: "适合排查乱码、字符集和网络传输问题。",
    exampleInput: "Hi",
    exampleOutput: "48 69",
  },
  {
    id: "ascii",
    name: "ASCII",
    aliases: ["ascii 码"],
    description: "在 ASCII 字符与十进制字符码之间转换。",
    usage: "仅接受 0–127；中文、Emoji 等字符不属于 ASCII。",
    exampleInput: "Hi",
    exampleOutput: "72 105",
  },
  {
    id: "base32",
    name: "Base32",
    aliases: ["base 32"],
    description: "使用 A–Z 与 2–7 表示二进制数据，并按 RFC 4648 补齐。",
    usage: "常见于 TOTP 密钥、大小写不敏感的人工录入场景。",
    exampleInput: "foo",
    exampleOutput: "MZXW6===",
  },
  {
    id: "base58",
    name: "Base58",
    aliases: ["base 58", "bitcoin"],
    description: "去除 0/O/I/l 等易混淆字符的进制编码。",
    usage: "常用于区块链地址和需要人工抄写的短标识。",
    exampleInput: "Hello",
    exampleOutput: "9Ajdvzr",
  },
  {
    id: "base85",
    name: "Base85",
    aliases: ["ascii85", "base 85"],
    description: "以 ASCII85 规则把每 4 个字节压缩为最多 5 个可打印字符。",
    usage: "比 Base64 更紧凑，常见于 PostScript、PDF 和部分文本容器。",
    exampleInput: "Hello",
    exampleOutput: "87cURDZ",
  },
  {
    id: "binary",
    name: "Binary",
    aliases: ["二进制", "bit"],
    description: "把每个 UTF-8 字节显示为 8 位二进制。",
    usage: "适合观察字节级位模式。",
    exampleInput: "Hi",
    exampleOutput: "01001000 01101001",
  },
  {
    id: "octal",
    name: "Octal",
    aliases: ["八进制"],
    description: "把 UTF-8 字节显示为反斜杠开头的三位八进制转义。",
    usage: "常见于 Unix 工具、旧式字符串字面量和权限相关场景。",
    exampleInput: "Hi",
    exampleOutput: "\\110\\151",
  },
  {
    id: "html",
    name: "HTML",
    aliases: ["html 实体", "entity"],
    description: "在 HTML 特殊字符与实体引用之间转换。",
    usage: "用于安全展示尖括号、引号和 & 等具有语法意义的字符。",
    exampleInput: "<b>",
    exampleOutput: "&lt;b&gt;",
  },
  {
    id: "morse",
    name: "Morse",
    aliases: ["摩斯", "摩尔斯"],
    description: "在拉丁字母、数字、常见标点与摩斯电码之间转换。",
    usage: "单词空格用 / 表示；不在表内的字符会原样保留。",
    exampleInput: "SOS",
    exampleOutput: "... --- ...",
  },
  {
    id: "rot13",
    name: "ROT13",
    aliases: ["rot 13"],
    description: "将英文字母循环移动 13 位；再次转换即可还原。",
    usage: "用于轻量文本混淆，不具备任何密码学安全性。",
    exampleInput: "Hello",
    exampleOutput: "Uryyb",
  },
  {
    id: "punycode",
    name: "Punycode",
    aliases: ["国际化域名", "idn"],
    description: "在 Unicode 国际化域名与 ASCII 域名之间转换。",
    usage: "用于检查 xn-- 开头的 IDN 标签，输入应为域名而非任意文本。",
    exampleInput: "测试.com",
    exampleOutput: "xn--0zwm56d.com",
  },
  {
    id: "quoted",
    name: "Quoted-Printable",
    aliases: ["quoted printable", "qp"],
    description: "用 =HH 表示非安全字节的邮件正文编码。",
    usage: "常见于 MIME 邮件；可打印 ASCII 会尽量保持可读。",
    exampleInput: "你好",
    exampleOutput: "=E4=BD=A0=E5=A5=BD",
  },
]

const textEncoder = new TextEncoder()
const fatalUtf8Decoder = new TextDecoder("utf-8", { fatal: true })
const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"
const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"

const MORSE_BY_CHARACTER: Record<string, string> = {
  A: ".-",
  B: "-...",
  C: "-.-.",
  D: "-..",
  E: ".",
  F: "..-.",
  G: "--.",
  H: "....",
  I: "..",
  J: ".---",
  K: "-.-",
  L: ".-..",
  M: "--",
  N: "-.",
  O: "---",
  P: ".--.",
  Q: "--.-",
  R: ".-.",
  S: "...",
  T: "-",
  U: "..-",
  V: "...-",
  W: ".--",
  X: "-..-",
  Y: "-.--",
  Z: "--..",
  "0": "-----",
  "1": ".----",
  "2": "..---",
  "3": "...--",
  "4": "....-",
  "5": ".....",
  "6": "-....",
  "7": "--...",
  "8": "---..",
  "9": "----.",
  " ": "/",
  ".": ".-.-.-",
  ",": "--..--",
  "?": "..--..",
  "'": ".----.",
  "!": "-.-.--",
  "/": "-..-.",
  "(": "-.--.",
  ")": "-.--.-",
  "&": ".-...",
  ":": "---...",
  ";": "-.-.-.",
  "=": "-...-",
  "+": ".-.-.",
  "-": "-....-",
  _: "..--.-",
  '"': ".-..-.",
  $: "...-..-",
  "@": ".--.-.",
}

const CHARACTER_BY_MORSE = Object.fromEntries(
  Object.entries(MORSE_BY_CHARACTER).map(([character, morse]) => [morse, character]),
)

function decodeUtf8(bytes: Uint8Array): string {
  return fatalUtf8Decoder.decode(bytes)
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ""
  const chunkSize = 8192
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize))
  }
  return btoa(binary)
}

function base64ToBytes(value: string): Uint8Array {
  const normalized = value.replace(/\s+/g, "").replace(/-/g, "+").replace(/_/g, "/")
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(normalized)) throw new Error("Base64 包含无效字符")

  const withoutPadding = normalized.replace(/=+$/, "")
  if (withoutPadding.length % 4 === 1) throw new Error("Base64 长度无效")

  const padded = withoutPadding.padEnd(Math.ceil(withoutPadding.length / 4) * 4, "=")
  const binary = atob(padded)
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

function parseHexBytes(value: string): Uint8Array {
  const normalized = value.replace(/0x/gi, "").replace(/[\s:_-]+/g, "")
  if (!normalized || normalized.length % 2 !== 0 || !/^[0-9a-f]+$/i.test(normalized)) {
    throw new Error("请输入完整的两位十六进制字节")
  }
  return Uint8Array.from(normalized.match(/.{2}/g) ?? [], (byte) => Number.parseInt(byte, 16))
}

function encodeUnicode(value: string): string {
  return Array.from(value, (character) => {
    const codePoint = character.codePointAt(0)!
    if (codePoint <= 0xffff) return `\\u${codePoint.toString(16).padStart(4, "0")}`

    const adjusted = codePoint - 0x10000
    const high = 0xd800 + (adjusted >> 10)
    const low = 0xdc00 + (adjusted & 0x3ff)
    return `\\u${high.toString(16)}\\u${low.toString(16)}`
  }).join("")
}

function decodeUnicode(value: string): string {
  return value
    .replace(/\\u\{([0-9a-f]{1,6})\}/gi, (_, hex: string) => {
      const codePoint = Number.parseInt(hex, 16)
      if (codePoint > 0x10ffff) throw new Error("Unicode 码点超出范围")
      return String.fromCodePoint(codePoint)
    })
    .replace(/\\u([0-9a-f]{4})/gi, (_, hex: string) => String.fromCharCode(Number.parseInt(hex, 16)))
}

function encodeBase32(bytes: Uint8Array): string {
  let output = ""
  let buffer = 0
  let bits = 0

  for (const byte of bytes) {
    buffer = (buffer << 8) | byte
    bits += 8
    while (bits >= 5) {
      bits -= 5
      output += BASE32_ALPHABET[(buffer >> bits) & 31]
    }
    buffer &= (1 << bits) - 1
  }

  if (bits > 0) output += BASE32_ALPHABET[(buffer << (5 - bits)) & 31]
  return output.padEnd(Math.ceil(output.length / 8) * 8, "=")
}

function decodeBase32(value: string): Uint8Array {
  const normalized = value.replace(/\s+/g, "").replace(/=+$/, "").toUpperCase()
  let buffer = 0
  let bits = 0
  const output: number[] = []

  for (const character of normalized) {
    const index = BASE32_ALPHABET.indexOf(character)
    if (index === -1) throw new Error(`Base32 包含无效字符：${character}`)
    buffer = (buffer << 5) | index
    bits += 5
    if (bits >= 8) {
      bits -= 8
      output.push((buffer >> bits) & 255)
    }
    buffer &= (1 << bits) - 1
  }

  return new Uint8Array(output)
}

function encodeBase58(bytes: Uint8Array): string {
  if (bytes.length === 0) return ""

  let value = BigInt(0)
  for (const byte of bytes) value = value * BigInt(256) + BigInt(byte)

  let output = ""
  while (value > BigInt(0)) {
    output = BASE58_ALPHABET[Number(value % BigInt(58))] + output
    value /= BigInt(58)
  }

  let leadingZeros = 0
  while (leadingZeros < bytes.length && bytes[leadingZeros] === 0) leadingZeros += 1
  return BASE58_ALPHABET[0].repeat(leadingZeros) + output
}

function decodeBase58(value: string): Uint8Array {
  const normalized = value.trim()
  if (!normalized) return new Uint8Array()

  let numericValue = BigInt(0)
  for (const character of normalized) {
    const index = BASE58_ALPHABET.indexOf(character)
    if (index === -1) throw new Error(`Base58 包含无效字符：${character}`)
    numericValue = numericValue * BigInt(58) + BigInt(index)
  }

  const bytes: number[] = []
  while (numericValue > BigInt(0)) {
    bytes.unshift(Number(numericValue % BigInt(256)))
    numericValue /= BigInt(256)
  }

  let leadingZeros = 0
  while (leadingZeros < normalized.length && normalized[leadingZeros] === BASE58_ALPHABET[0]) {
    bytes.unshift(0)
    leadingZeros += 1
  }
  return new Uint8Array(bytes)
}

function encodeBase85(bytes: Uint8Array): string {
  let output = ""

  for (let offset = 0; offset < bytes.length; offset += 4) {
    const chunkLength = Math.min(4, bytes.length - offset)
    let value = 0
    for (let index = 0; index < 4; index += 1) {
      value = value * 256 + (bytes[offset + index] ?? 0)
    }

    if (chunkLength === 4 && value === 0) {
      output += "z"
      continue
    }

    const characters = Array<string>(5)
    for (let index = 4; index >= 0; index -= 1) {
      characters[index] = String.fromCharCode((value % 85) + 33)
      value = Math.floor(value / 85)
    }
    output += characters.slice(0, chunkLength + 1).join("")
  }

  return output
}

function decodeBase85(value: string): Uint8Array {
  const normalized = value.trim().replace(/^<~/, "").replace(/~>$/, "").replace(/\s+/g, "")
  const output: number[] = []
  let group: string[] = []

  const flushGroup = (characters: string[], outputLength = 4) => {
    let numericValue = 0
    for (const character of characters) {
      const digit = character.charCodeAt(0) - 33
      if (digit < 0 || digit >= 85) throw new Error(`Base85 包含无效字符：${character}`)
      numericValue = numericValue * 85 + digit
    }
    if (numericValue > 0xffffffff) throw new Error("Base85 分组超出 32 位范围")
    for (let index = 3; index >= 4 - outputLength; index -= 1) {
      output.push(Math.floor(numericValue / 256 ** index) % 256)
    }
  }

  for (const character of normalized) {
    if (character === "z") {
      if (group.length > 0) throw new Error("Base85 的 z 只能单独表示零分组")
      output.push(0, 0, 0, 0)
      continue
    }

    group.push(character)
    if (group.length === 5) {
      flushGroup(group)
      group = []
    }
  }

  if (group.length === 1) throw new Error("Base85 末尾分组长度无效")
  if (group.length > 1) {
    const outputLength = group.length - 1
    while (group.length < 5) group.push("u")
    flushGroup(group, outputLength)
  }

  return new Uint8Array(output)
}

function parseRadixBytes(value: string, radix: 2 | 8): Uint8Array {
  const trimmed = value.trim()
  if (!trimmed) return new Uint8Array()

  if (radix === 8 && trimmed.includes("\\")) {
    const matches = [...trimmed.matchAll(/\\([0-7]{1,3})/g)]
    const remainder = trimmed.replace(/\\[0-7]{1,3}/g, "").replace(/\s+/g, "")
    if (!matches.length || remainder) throw new Error("八进制转义格式无效")
    return Uint8Array.from(matches, (match) => {
      const byte = Number.parseInt(match[1], 8)
      if (byte > 255) throw new Error("八进制字节超出范围")
      return byte
    })
  }

  const compact = trimmed.replace(/\s+/g, "")
  const width = radix === 2 ? 8 : 3
  const pattern = radix === 2 ? /^[01]+$/ : /^[0-7]+$/
  if (!pattern.test(compact) || compact.length % width !== 0) {
    throw new Error(radix === 2 ? "二进制必须按 8 位字节分组" : "八进制必须按 3 位字节分组")
  }

  return Uint8Array.from(compact.match(new RegExp(`.{${width}}`, "g")) ?? [], (item) => {
    const byte = Number.parseInt(item, radix)
    if (byte > 255) throw new Error("字节超出范围")
    return byte
  })
}

function encodeHtml(value: string): string {
  const entities: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }
  return value.replace(/[&<>"']/g, (character) => entities[character])
}

function decodeHtml(value: string): string {
  const namedEntities: Record<string, string> = {
    amp: "&",
    lt: "<",
    gt: ">",
    quot: '"',
    apos: "'",
    nbsp: "\u00a0",
  }

  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (entity, body: string) => {
    if (body.startsWith("#x") || body.startsWith("#X")) {
      return String.fromCodePoint(Number.parseInt(body.slice(2), 16))
    }
    if (body.startsWith("#")) return String.fromCodePoint(Number.parseInt(body.slice(1), 10))
    return namedEntities[body.toLowerCase()] ?? entity
  })
}

function encodeQuotedPrintable(value: string): string {
  const bytes = textEncoder.encode(value)
  return Array.from(bytes, (byte, index) => {
    const isPrintable = byte >= 33 && byte <= 126 && byte !== 61
    const isWhitespace = byte === 32 || byte === 9
    const isTrailingWhitespace = isWhitespace && index === bytes.length - 1
    if (isPrintable || (isWhitespace && !isTrailingWhitespace)) return String.fromCharCode(byte)
    return `=${byte.toString(16).toUpperCase().padStart(2, "0")}`
  }).join("")
}

function decodeQuotedPrintable(value: string): string {
  const normalized = value.replace(/=\r?\n/g, "")
  const bytes: number[] = []

  for (let index = 0; index < normalized.length;) {
    if (normalized[index] === "=") {
      const hex = normalized.slice(index + 1, index + 3)
      if (!/^[0-9a-f]{2}$/i.test(hex)) throw new Error("Quoted-Printable 转义无效")
      bytes.push(Number.parseInt(hex, 16))
      index += 3
      continue
    }

    const character = Array.from(normalized.slice(index))[0]
    bytes.push(...textEncoder.encode(character))
    index += character.length
  }

  return decodeUtf8(new Uint8Array(bytes))
}

function transformSingle(value: string, type: EncodingType, direction: EncodingDirection): string {
  const encode = direction === "encode"

  switch (type) {
    case "base64":
      return encode ? bytesToBase64(textEncoder.encode(value)) : decodeUtf8(base64ToBytes(value))
    case "url":
      return encode ? encodeURIComponent(value) : decodeURIComponent(value)
    case "hex":
      return encode
        ? Array.from(textEncoder.encode(value), (byte) => byte.toString(16).padStart(2, "0")).join("")
        : decodeUtf8(parseHexBytes(value))
    case "unicode":
      return encode ? encodeUnicode(value) : decodeUnicode(value)
    case "utf8":
      return encode
        ? Array.from(textEncoder.encode(value), (byte) => byte.toString(16).padStart(2, "0")).join(" ")
        : decodeUtf8(parseHexBytes(value))
    case "ascii":
      if (encode) {
        return Array.from(value, (character) => {
          const code = character.codePointAt(0)!
          if (code > 127) throw new Error(`字符“${character}”不属于 ASCII`)
          return code.toString(10)
        }).join(" ")
      }
      return value.trim().split(/[\s,]+/).map((item) => {
        const code = Number(item)
        if (!Number.isInteger(code) || code < 0 || code > 127) throw new Error("ASCII 码必须在 0–127")
        return String.fromCharCode(code)
      }).join("")
    case "base32":
      return encode ? encodeBase32(textEncoder.encode(value)) : decodeUtf8(decodeBase32(value))
    case "base58":
      return encode ? encodeBase58(textEncoder.encode(value)) : decodeUtf8(decodeBase58(value))
    case "base85":
      return encode ? encodeBase85(textEncoder.encode(value)) : decodeUtf8(decodeBase85(value))
    case "binary":
      return encode
        ? Array.from(textEncoder.encode(value), (byte) => byte.toString(2).padStart(8, "0")).join(" ")
        : decodeUtf8(parseRadixBytes(value, 2))
    case "octal":
      return encode
        ? Array.from(textEncoder.encode(value), (byte) => `\\${byte.toString(8).padStart(3, "0")}`).join("")
        : decodeUtf8(parseRadixBytes(value, 8))
    case "html":
      return encode ? encodeHtml(value) : decodeHtml(value)
    case "morse":
      return encode
        ? Array.from(value.toUpperCase(), (character) => MORSE_BY_CHARACTER[character] ?? character).join(" ")
        : value.trim().split(/\s+/).map((morse) => CHARACTER_BY_MORSE[morse] ?? morse).join("")
    case "rot13":
      return value.replace(/[a-z]/gi, (character) => {
        const start = character <= "Z" ? 65 : 97
        return String.fromCharCode(((character.charCodeAt(0) - start + 13) % 26) + start)
      })
    case "punycode":
      return encode ? encodePunycodeDomain(value) : decodePunycodeDomain(value)
    case "quoted":
      return encode ? encodeQuotedPrintable(value) : decodeQuotedPrintable(value)
  }
}

export function transformEncoding(
  value: string,
  type: EncodingType,
  direction: EncodingDirection,
  multiline = false,
): string {
  if (!multiline) return transformSingle(value, type, direction)

  return value
    .split(/\r?\n/)
    .map((line, index) => {
      if (line === "") return ""
      try {
        return transformSingle(line, type, direction)
      } catch (error) {
        const message = error instanceof Error ? error.message : "输入格式无效"
        throw new Error(`第 ${index + 1} 行：${message}`)
      }
    })
    .join("\n")
}

export function findEncodingType(feature: string): EncodingType | null {
  const normalized = feature.trim().toLocaleLowerCase()
  if (!normalized) return null

  return (
    ENCODING_DEFINITIONS.find((definition) =>
      [definition.id, definition.name, ...definition.aliases].some((candidate) =>
        normalized.includes(candidate.toLocaleLowerCase()),
      ),
    )?.id ?? null
  )
}

export function encodePunycodeDomain(value: string): string {
  const domain = value.trim()
  if (!domain) return ""
  return toASCII(domain)
}

export function decodePunycodeDomain(value: string): string {
  const domain = value.trim()
  if (!domain) return ""
  return toUnicode(domain)
}
