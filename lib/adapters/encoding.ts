import { ArrowLeftRight } from "lucide-react"
import type { ToolAdapter } from "./types"
import { registerNode } from "../canvas/registry"

const ENCODING_TYPES = [
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
  { label: "Base58", value: "base58" },
  { label: "Base85", value: "base85" },
  { label: "Octal", value: "octal" },
  { label: "Punycode", value: "punycode" },
  { label: "Quoted-Printable", value: "quoted-printable" },
]

const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"

function encodeBase58(bytes: Uint8Array): string {
  let num = BigInt(0)
  for (const byte of bytes) {
    num = num * BigInt(256) + BigInt(byte)
  }

  let result = ""
  while (num > 0) {
    result = BASE58_ALPHABET[Number(num % BigInt(58))] + result
    num = num / BigInt(58)
  }

  for (const byte of bytes) {
    if (byte === 0) result = BASE58_ALPHABET[0] + result
    else break
  }

  return result || BASE58_ALPHABET[0]
}

function decodeBase58(text: string): Uint8Array {
  let num = BigInt(0)
  for (const char of text) {
    const index = BASE58_ALPHABET.indexOf(char)
    if (index === -1) throw new Error("Invalid character")
    num = num * BigInt(58) + BigInt(index)
  }

  const bytes: number[] = []
  while (num > 0) {
    bytes.unshift(Number(num % BigInt(256)))
    num = num / BigInt(256)
  }

  for (const char of text) {
    if (char === BASE58_ALPHABET[0]) bytes.unshift(0)
    else break
  }

  return new Uint8Array(bytes)
}

function encodeBase85(bytes: Uint8Array): string {
  let result = ""
  for (let i = 0; i < bytes.length; i += 4) {
    let value = 0
    for (let j = 0; j < 4 && i + j < bytes.length; j++) {
      value = value * 256 + (bytes[i + j] || 0)
    }

    if (value === 0 && i + 4 <= bytes.length) {
      result += "z"
    } else {
      const chars = []
      for (let k = 0; k < 5; k++) {
        chars.unshift(String.fromCharCode(33 + (value % 85)))
        value = Math.floor(value / 85)
      }
      result += chars.join("")
    }
  }

  return result
}

function decodeBase85(text: string): Uint8Array {
  const result: number[] = []

  for (let i = 0; i < text.length; i += 5) {
    if (text[i] === "z") {
      result.push(0, 0, 0, 0)
      i -= 4
      continue
    }

    let value = 0
    for (let j = 0; j < 5 && i + j < text.length; j++) {
      const charCode = text.charCodeAt(i + j) - 33
      if (charCode < 0 || charCode >= 85) throw new Error("Invalid character")
      value = value * 85 + charCode
    }

    for (let k = 3; k >= 0; k--) {
      result.push((value >>> (k * 8)) & 255)
    }
  }

  return new Uint8Array(result)
}

function encodePunycode(text: string): string {
  return text.split('').map(char => {
    const code = char.charCodeAt(0)
    return code > 127 ? `xn--${code.toString(36)}` : char
  }).join('')
}

function decodePunycode(text: string): string {
  return text.replace(/xn--([a-z0-9]+)/g, (match, code) => {
    const charCode = parseInt(code, 36)
    return String.fromCharCode(charCode)
  })
}

function encodeQuotedPrintable(text: string): string {
  const utf8Bytes = new TextEncoder().encode(text)
  let result = ""
  for (const byte of utf8Bytes) {
    if (byte >= 0x20 && byte <= 0x7E && byte !== 0x3D) {
      result += String.fromCharCode(byte)
    } else {
      result += `=${byte.toString(16).toUpperCase().padStart(2, '0')}`
    }
  }
  return result.replace(/ $/gm, '=20')
}

function decodeQuotedPrintable(text: string): string {
  const bytes = []
  let i = 0
  while (i < text.length) {
    if (text[i] === '=' && i + 2 < text.length) {
      const hex = text.substring(i + 1, i + 3)
      if (/^[0-9A-F]{2}$/i.test(hex)) {
        bytes.push(parseInt(hex, 16))
        i += 3
      } else {
        bytes.push(text.charCodeAt(i))
        i += 1
      }
    } else {
      bytes.push(text.charCodeAt(i))
      i += 1
    }
  }
  return new TextDecoder().decode(new Uint8Array(bytes))
}

function encode(input: string, encoding: string): string {
  switch (encoding) {
    case "base64":
      return Buffer.from(input, "utf-8").toString("base64")
    case "url":
      return encodeURIComponent(input)
    case "hex":
      return Buffer.from(input, "utf-8").toString("hex")
    case "html":
      return input
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;")
    case "base58":
      return encodeBase58(new TextEncoder().encode(input))
    case "base85":
      return encodeBase85(new TextEncoder().encode(input))
    case "octal":
      return Array.from(new TextEncoder().encode(input))
        .map(byte => byte.toString(8).padStart(3, '0'))
        .join(' ')
    case "punycode":
      return encodePunycode(input)
    case "quoted-printable":
      return encodeQuotedPrintable(input)
    default:
      return input
  }
}

function decode(input: string, encoding: string): string {
  switch (encoding) {
    case "base64":
      return Buffer.from(input, "base64").toString("utf-8")
    case "url":
      return decodeURIComponent(input)
    case "hex":
      return Buffer.from(input, "hex").toString("utf-8")
    case "html":
      return input
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#039;/g, "'")
    case "base58":
      return new TextDecoder().decode(decodeBase58(input))
    case "base85":
      return new TextDecoder().decode(decodeBase85(input.trim()))
    case "octal":
      return new TextDecoder().decode(
        new Uint8Array(input.trim().split(/\s+/).map(oct => parseInt(oct, 8)))
      )
    case "punycode":
      return decodePunycode(input)
    case "quoted-printable":
      return decodeQuotedPrintable(input)
    default:
      return input
  }
}

export const encodingAdapter: ToolAdapter = {
  type: "encoding",
  category: "crypto",
  label: "Encoding",
  icon: ArrowLeftRight,
  config: [
    {
      id: "input",
      name: "Input",
      dataType: "string",
      defaultValue: "",
      hasInput: true,
      hasOutput: false,
    },
    {
      id: "encoding",
      name: "Encoding",
      dataType: "string",
      defaultValue: "base64",
      options: ENCODING_TYPES,
      hasInput: true,
      hasOutput: true,
    },
    {
      id: "mode",
      name: "Mode",
      dataType: "string",
      defaultValue: "encode",
      options: [
        { label: "Encode", value: "encode" },
        { label: "Decode", value: "decode" },
      ],
      hasInput: true,
      hasOutput: true,
    },
  ],
  outputs: [
    { id: "output", name: "Output", dataType: "string" },
  ],
  async execute(inputs, config) {
    const input = String(inputs.input ?? config.input ?? "")
    const encoding = String(inputs.encoding ?? config.encoding ?? "base64")
    const mode = String(inputs.mode ?? config.mode ?? "encode")

    try {
      if (mode === "decode") {
        return { output: decode(input, encoding) }
      }
      return { output: encode(input, encoding) }
    } catch (error) {
      throw new Error(`Encoding error: ${error}`)
    }
  },
}

export function registerEncodingAdapter(): void {
  registerNode(encodingAdapter)
}
