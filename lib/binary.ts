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

  return Uint8Array.from(normalized.match(/../g) ?? [], (pair) => Number.parseInt(pair, 16))
}

export function bytesToHex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("")
}
