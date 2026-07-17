import { decodeBinaryInput, encodeBinaryOutput, type BinaryEncoding } from "./compression"

export type HexBinaryOperation = "hexdump" | "signature" | "to-text" | "to-hex" | "to-base64"

export interface FileSignature {
  id: string
  name: string
  mime: string
  extension: string
  confidence: "high" | "medium" | "unknown"
}

export interface HexBinaryResult {
  output: string
  byteLength: number
  signature: FileSignature
}

function startsWith(bytes: Uint8Array, pattern: number[], offset = 0): boolean {
  return pattern.every((byte, index) => bytes[offset + index] === byte)
}

function ascii(value: string): number[] {
  return [...value].map((character) => character.charCodeAt(0))
}

export function detectFileSignature(bytes: Uint8Array): FileSignature {
  const known: Array<{ id: string; pattern: number[]; name: string; mime: string; extension: string; offset?: number }> = [
    { id: "png", pattern: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], name: "PNG image", mime: "image/png", extension: ".png" },
    { id: "jpeg", pattern: [0xff, 0xd8, 0xff], name: "JPEG image", mime: "image/jpeg", extension: ".jpg" },
    { id: "gif", pattern: ascii("GIF87a"), name: "GIF image", mime: "image/gif", extension: ".gif" },
    { id: "gif", pattern: ascii("GIF89a"), name: "GIF image", mime: "image/gif", extension: ".gif" },
    { id: "pdf", pattern: ascii("%PDF-"), name: "PDF document", mime: "application/pdf", extension: ".pdf" },
    { id: "zip", pattern: [0x50, 0x4b, 0x03, 0x04], name: "ZIP archive", mime: "application/zip", extension: ".zip" },
    { id: "emptyZip", pattern: [0x50, 0x4b, 0x05, 0x06], name: "Empty ZIP archive", mime: "application/zip", extension: ".zip" },
    { id: "gzip", pattern: [0x1f, 0x8b], name: "GZip stream", mime: "application/gzip", extension: ".gz" },
    { id: "sevenZip", pattern: [0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c], name: "7-Zip archive", mime: "application/x-7z-compressed", extension: ".7z" },
    { id: "rar", pattern: [0x52, 0x61, 0x72, 0x21, 0x1a, 0x07], name: "RAR archive", mime: "application/vnd.rar", extension: ".rar" },
    { id: "elf", pattern: [0x7f, 0x45, 0x4c, 0x46], name: "ELF executable", mime: "application/x-elf", extension: "" },
    { id: "bitmap", pattern: ascii("BM"), name: "Bitmap image", mime: "image/bmp", extension: ".bmp" },
    { id: "tiff", pattern: [0x49, 0x49, 0x2a, 0x00], name: "TIFF image", mime: "image/tiff", extension: ".tif" },
    { id: "tiff", pattern: [0x4d, 0x4d, 0x00, 0x2a], name: "TIFF image", mime: "image/tiff", extension: ".tif" },
    { id: "sqlite", pattern: ascii("SQLite format 3\0"), name: "SQLite database", mime: "application/vnd.sqlite3", extension: ".sqlite" },
  ]
  const match = known.find((candidate) => startsWith(bytes, candidate.pattern, candidate.offset ?? 0))
  if (match) return { id: match.id, name: match.name, mime: match.mime, extension: match.extension, confidence: "high" }
  if (startsWith(bytes, ascii("RIFF")) && startsWith(bytes, ascii("WEBP"), 8)) return { id: "webp", name: "WebP image", mime: "image/webp", extension: ".webp", confidence: "high" }
  if (startsWith(bytes, ascii("MZ"))) {
    if (bytes.byteLength >= 0x40) {
      const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
      const peOffset = view.getUint32(0x3c, true)
      if (peOffset + 4 <= bytes.byteLength && startsWith(bytes, [0x50, 0x45, 0, 0], peOffset)) return { id: "windowsPe", name: "Windows PE executable", mime: "application/vnd.microsoft.portable-executable", extension: ".exe", confidence: "high" }
    }
    return { id: "dosWindows", name: "DOS/Windows executable", mime: "application/octet-stream", extension: ".exe", confidence: "medium" }
  }
  return { id: "unknown", name: "Unknown binary data", mime: "application/octet-stream", extension: "", confidence: "unknown" }
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
