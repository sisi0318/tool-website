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
  if (!/^(?:[0-9a-fA-F]{2})*$/.test(normalized)) {
    throw new Error("Invalid hexadecimal input")
  }

  const bytes = new Uint8Array(normalized.length / 2)
  const nibble = (code: number) => code >= 97 ? code - 87 : code >= 65 ? code - 55 : code - 48
  for (let index = 0; index < bytes.length; index++) bytes[index] = nibble(normalized.charCodeAt(index * 2)) * 16 + nibble(normalized.charCodeAt(index * 2 + 1))
  return bytes
}

const HEX_BYTES = Array.from({ length: 256 }, (_, value) => value.toString(16).padStart(2, "0"))
export function bytesToHex(bytes: Uint8Array): string {
  const chunks: string[] = []
  for (let offset = 0; offset < bytes.length; offset += 32768) { let chunk = ""; for (let index = offset; index < Math.min(bytes.length, offset + 32768); index++) chunk += HEX_BYTES[bytes[index]]; chunks.push(chunk) }
  return chunks.join("")
}
