import { decodeBinaryInput, encodeBinaryOutput, type BinaryEncoding } from "./compression"

export type HexBinaryOperation = "hexdump" | "signature" | "to-text" | "to-hex" | "to-base64"

import { detectFileSignature, type FileSignature } from "./file-signature"
export { detectFileSignature, type FileSignature } from "./file-signature"

export interface HexBinaryResult {
  output: string
  byteLength: number
  signature: FileSignature
}

/**
 * startOffset / totalLength 用于分段生成：偏移从 startOffset 起算，偏移列的宽度按整个文件的长度定，
 * 分段拼起来和一次生成的结果完全一样。
 */
export function createHexdump(bytes: Uint8Array, width = 16, { startOffset = 0, totalLength = bytes.byteLength }: { startOffset?: number; totalLength?: number } = {}): string {
  const rowWidth = [8, 16, 32].includes(width) ? width : 16
  const offsetWidth = Math.max(8, Math.ceil(Math.log2(Math.max(totalLength, 1)) / 4))
  const rows: string[] = []
  for (let offset = 0; offset < bytes.length; offset += rowWidth) {
    const chunk = bytes.subarray(offset, offset + rowWidth)
    const hex = [...chunk].map((byte) => byte.toString(16).padStart(2, "0")).join(" ").padEnd(rowWidth * 3 - 1)
    const printable = [...chunk].map((byte) => byte >= 32 && byte <= 126 ? String.fromCharCode(byte) : ".").join("")
    rows.push(`${(startOffset + offset).toString(16).padStart(offsetWidth, "0")}  ${hex}  |${printable.padEnd(rowWidth)}|`)
  }
  return rows.join("\n")
}

export function processHexBinary(input: string, operation: HexBinaryOperation, inputEncoding: BinaryEncoding, width = 16): HexBinaryResult {
  const bytes = decodeBinaryInput(input, inputEncoding)
  const signature = detectFileSignature(bytes)
  let output: string
  if (operation === "signature") output = JSON.stringify(signature, null, 2)
  else if (operation === "hexdump") output = createHexdump(bytes, width)
  else if (operation === "to-hex") output = encodeBinaryOutput(bytes, "hex")
  else if (operation === "to-base64") output = encodeBinaryOutput(bytes, "base64")
  else output = encodeBinaryOutput(bytes, "text")
  return { output, byteLength: bytes.byteLength, signature }
}

/**
 * 输出框里最多展示这么多字节对应的结果。以前 10 MB 的文件会把约 5000 万字符的 hexdump
 * 整个写进文本框，页面直接卡死；完整结果改为下载。
 */
export const HEX_PREVIEW_BYTES = 64 * 1024

export interface HexBinaryBytesResult extends HexBinaryResult {
  /** 输出只含前 HEX_PREVIEW_BYTES 字节的结果，完整结果用 hexBinaryOutputBlob 下载 */
  truncated: boolean
}

function formatBytes(bytes: Uint8Array, operation: Exclude<HexBinaryOperation, "signature">, width: number, startOffset: number, totalLength: number): string {
  if (operation === "hexdump") return createHexdump(bytes, width, { startOffset, totalLength })
  if (operation === "to-hex") return encodeBinaryOutput(bytes, "hex")
  if (operation === "to-base64") return encodeBinaryOutput(bytes, "base64")
  return encodeBinaryOutput(bytes, "text")
}

/** 直接处理字节（文件输入不再先转成 Base64 塞进输入框），输出只保留有界预览 */
export function processHexBinaryBytes(bytes: Uint8Array, operation: HexBinaryOperation, width = 16): HexBinaryBytesResult {
  const signature = detectFileSignature(bytes)
  if (operation === "signature") return { output: JSON.stringify(signature, null, 2), byteLength: bytes.byteLength, signature, truncated: false }
  const truncated = bytes.byteLength > HEX_PREVIEW_BYTES
  const preview = truncated ? bytes.subarray(0, HEX_PREVIEW_BYTES) : bytes
  return { output: formatBytes(preview, operation, width, 0, bytes.byteLength), byteLength: bytes.byteLength, signature, truncated }
}

/** 完整结果分段生成成 Blob 供下载，避免拼出一个几千万字符的字符串 */
export function hexBinaryOutputBlob(bytes: Uint8Array, operation: Exclude<HexBinaryOperation, "signature">, width = 16): Blob {
  if (operation === "to-text") return new Blob([bytes.slice()], { type: "text/plain;charset=utf-8" })
  const rowWidth = [8, 16, 32].includes(width) ? width : 16
  // 分段边界：hexdump 按整行，Base64 按 3 字节对齐，拼接后与一次生成一致
  const chunkSize = rowWidth * 3 * 4096
  const parts: string[] = []
  for (let start = 0; start < bytes.byteLength; start += chunkSize) {
    const chunk = bytes.subarray(start, start + chunkSize)
    const text = formatBytes(chunk, operation, rowWidth, start, bytes.byteLength)
    parts.push(operation === "hexdump" && start > 0 ? `\n${text}` : text)
  }
  return new Blob(parts, { type: "text/plain;charset=utf-8" })
}
