import { decodeBinaryInput, encodeBinaryOutput, type BinaryEncoding } from "./compression"

export type HexBinaryOperation = "hexdump" | "signature" | "to-text" | "to-hex" | "to-base64"

import { detectFileSignature, type FileSignature } from "./file-signature"
export { detectFileSignature, type FileSignature } from "./file-signature"

export interface HexBinaryResult {
  output: string
  byteLength: number
  signature: FileSignature
}

export function createHexdump(bytes: Uint8Array, width = 16): string {
  const rowWidth = [8, 16, 32].includes(width) ? width : 16
  const offsetWidth = Math.max(8, Math.ceil(Math.log2(Math.max(bytes.byteLength, 1)) / 4))
  const rows: string[] = []
  for (let offset = 0; offset < bytes.length; offset += rowWidth) {
    const chunk = bytes.subarray(offset, offset + rowWidth)
    const hex = [...chunk].map((byte) => byte.toString(16).padStart(2, "0")).join(" ").padEnd(rowWidth * 3 - 1)
    const printable = [...chunk].map((byte) => byte >= 32 && byte <= 126 ? String.fromCharCode(byte) : ".").join("")
    rows.push(`${offset.toString(16).padStart(offsetWidth, "0")}  ${hex}  |${printable.padEnd(rowWidth)}|`)
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
