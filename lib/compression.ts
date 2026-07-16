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
import { base64ToBytes, bytesToBase64, bytesToHex, hexToBytes } from "./binary"

export { base64ToBytes, bytesToBase64, bytesToHex, hexToBytes } from "./binary"

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
  entries?: Record<string, string>
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
  let extractedEntries: Record<string, Uint8Array> | undefined

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
        extractedEntries = unzipSync(source)
        files = Object.keys(extractedEntries)
        if (files.length === 0) throw new Error("ZIP archive is empty")
        transformed = extractedEntries[files[0]]
        break
      }
    }
  }

  const inputBytes = source.byteLength
  const entries = extractedEntries
    ? Object.fromEntries(
        Object.entries(extractedEntries).map(([filename, bytes]) => [
          filename,
          encodeBinaryOutput(bytes, options.outputEncoding),
        ]),
      )
    : undefined
  const outputBytes = extractedEntries
    ? Object.values(extractedEntries).reduce((total, bytes) => total + bytes.byteLength, 0)
    : transformed.byteLength
  const output = entries && files && files.length > 1
    ? JSON.stringify(entries, null, 2)
    : encodeBinaryOutput(transformed, options.outputEncoding)

  return {
    output,
    inputBytes,
    outputBytes,
    ratio: inputBytes === 0 ? 0 : outputBytes / inputBytes,
    files,
    entries,
  }
}
