import {
  deflateSync,
  gzipSync,
  gunzipSync,
  inflateSync,
  strFromU8,
  strToU8,
  unzipSync,
  unzlibSync,
  zipSync,
  zlibSync,
} from "fflate"

export type CompressionFormat = "gzip" | "zlib" | "deflate" | "brotli" | "zip"
export type CompressionOperation = "compress" | "decompress"
export type BinaryEncoding = "text" | "base64" | "hex"
type FflateLevel = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9

export interface CompressionOptions {
  operation: CompressionOperation
  format: CompressionFormat
  inputEncoding: BinaryEncoding
  outputEncoding: BinaryEncoding
  level?: number
  filename?: string
}

export interface CompressionResult {
  output: string
  inputBytes: number
  outputBytes: number
  ratio: number
  files?: string[]
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = ""
  const chunkSize = 0x8000
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize))
  }
  return btoa(binary)
}

export function base64ToBytes(value: string): Uint8Array {
  const normalized = value.replace(/\s+/g, "")
  try {
    const binary = atob(normalized)
    return Uint8Array.from(binary, (character) => character.charCodeAt(0))
  } catch {
    throw new Error("Invalid Base64 input")
  }
}

export function hexToBytes(value: string): Uint8Array {
  const normalized = value.replace(/\s+/g, "")
  if (!/^(?:[0-9a-fA-F]{2})*$/.test(normalized)) throw new Error("Invalid hexadecimal input")
  return Uint8Array.from(normalized.match(/../g) ?? [], (pair) => Number.parseInt(pair, 16))
}

export function bytesToHex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("")
}

export function decodeBinaryInput(value: string, encoding: BinaryEncoding): Uint8Array {
  if (encoding === "base64") return base64ToBytes(value)
  if (encoding === "hex") return hexToBytes(value)
  return strToU8(value)
}

export function encodeBinaryOutput(bytes: Uint8Array, encoding: BinaryEncoding): string {
  if (encoding === "base64") return bytesToBase64(bytes)
  if (encoding === "hex") return bytesToHex(bytes)
  try {
    return strFromU8(bytes)
  } catch {
    return new TextDecoder().decode(bytes)
  }
}

async function runBrotli(bytes: Uint8Array, operation: CompressionOperation, level: number) {
  const module = await import("brotli-wasm")
  const brotli = await module.default
  return operation === "compress"
    ? brotli.compress(bytes, { quality: Math.min(11, Math.max(1, level)) })
    : brotli.decompress(bytes)
}

export async function transformCompression(
  input: string,
  options: CompressionOptions
): Promise<CompressionResult> {
  const source = decodeBinaryInput(input, options.inputEncoding)
  const level = Math.min(9, Math.max(0, Math.round(options.level ?? 6))) as FflateLevel
  let transformed: Uint8Array
  let files: string[] | undefined

  if (options.format === "brotli") {
    transformed = await runBrotli(source, options.operation, options.level ?? 6)
  } else if (options.operation === "compress") {
    switch (options.format) {
      case "gzip":
        transformed = gzipSync(source, { level })
        break
      case "zlib":
        transformed = zlibSync(source, { level })
        break
      case "deflate":
        transformed = deflateSync(source, { level })
        break
      case "zip":
        transformed = zipSync({ [options.filename?.trim() || "data.txt"]: source }, { level })
        break
    }
  } else {
    switch (options.format) {
      case "gzip":
        transformed = gunzipSync(source)
        break
      case "zlib":
        transformed = unzlibSync(source)
        break
      case "deflate":
        transformed = inflateSync(source)
        break
      case "zip": {
        const entries = unzipSync(source)
        files = Object.keys(entries)
        if (files.length === 0) throw new Error("ZIP archive is empty")
        transformed = entries[files[0]]
        break
      }
    }
  }

  const inputBytes = source.byteLength
  const outputBytes = transformed.byteLength
  return {
    output: encodeBinaryOutput(transformed, options.outputEncoding),
    inputBytes,
    outputBytes,
    ratio: inputBytes === 0 ? 0 : outputBytes / inputBytes,
    files,
  }
}
