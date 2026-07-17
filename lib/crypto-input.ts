export type CryptoInputFormat = "raw" | "hex" | "base64"
export type CryptoRawEncoding = "utf8" | "latin1"

export class CryptoInputError extends Error {
  constructor(
    public readonly code:
      | "invalid-hex"
      | "invalid-base64"
      | "invalid-latin1",
  ) {
    super(code)
    this.name = "CryptoInputError"
  }
}

function parseHex(value: string): Uint8Array {
  const normalized = value.trim()
  if (normalized.length % 2 !== 0 || !/^[0-9a-fA-F]*$/.test(normalized)) {
    throw new CryptoInputError("invalid-hex")
  }

  const bytes = new Uint8Array(normalized.length / 2)
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(normalized.slice(index * 2, index * 2 + 2), 16)
  }
  return bytes
}

function parseBase64(value: string): Uint8Array {
  const compact = value.replace(/\s/g, "")
  if (
    compact.length % 4 === 1 ||
    !/^[A-Za-z0-9+/]*={0,2}$/.test(compact) ||
    /=/.test(compact.slice(0, -2))
  ) {
    throw new CryptoInputError("invalid-base64")
  }

  const padded = compact.padEnd(Math.ceil(compact.length / 4) * 4, "=")
  let binary: string
  try {
    binary = atob(padded)
  } catch {
    throw new CryptoInputError("invalid-base64")
  }

  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}

function parseLatin1(value: string): Uint8Array {
  const bytes = new Uint8Array(value.length)
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index)
    if (code > 255) throw new CryptoInputError("invalid-latin1")
    bytes[index] = code
  }
  return bytes
}

export function parseCryptoInput(
  value: string,
  format: CryptoInputFormat,
  rawEncoding: CryptoRawEncoding = "utf8",
): Uint8Array {
  if (format === "hex") return parseHex(value)
  if (format === "base64") return parseBase64(value)
  return rawEncoding === "latin1"
    ? parseLatin1(value)
    : new TextEncoder().encode(value)
}

export function cryptoInputByteLength(
  value: string,
  format: CryptoInputFormat,
  rawEncoding: CryptoRawEncoding = "utf8",
): number | null {
  try {
    return parseCryptoInput(value, format, rawEncoding).length
  } catch {
    return null
  }
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")
}

export function safeCryptoDownloadName(fileName: string): string {
  const sanitized = fileName
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120)
  return sanitized || "result.bin"
}
