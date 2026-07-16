export interface ParsedTotpAccount {
  name: string
  issuer: string
  secret: string
  digits: number
  period: number
}

export function decodeBase32(encoded: string): Uint8Array {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"
  const cleanedInput = encoded.toUpperCase().replace(/[^A-Z2-7]/g, "")
  let bits = ""

  for (const character of cleanedInput) {
    const value = alphabet.indexOf(character)
    if (value >= 0) bits += value.toString(2).padStart(5, "0")
  }

  const bytes = new Uint8Array(Math.floor(bits.length / 8))
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(bits.slice(index * 8, (index + 1) * 8), 2)
  }
  return bytes
}

function normalizePositiveInteger(value: number, fallback: number): number {
  return Number.isInteger(value) && value > 0 ? value : fallback
}

export function getTotpTimeRemaining(timestampSeconds: number, period = 30): number {
  const normalizedPeriod = normalizePositiveInteger(period, 30)
  const elapsed = Math.floor(timestampSeconds) % normalizedPeriod
  return normalizedPeriod - (elapsed < 0 ? elapsed + normalizedPeriod : elapsed)
}

export async function generateTotp(
  secret: string,
  period = 30,
  digits = 6,
  timestampSeconds = Math.floor(Date.now() / 1000),
  subtleCrypto: SubtleCrypto = globalThis.crypto.subtle,
): Promise<string> {
  const normalizedPeriod = normalizePositiveInteger(period, 30)
  const normalizedDigits = normalizePositiveInteger(digits, 6)
  let counter = Math.floor(timestampSeconds / normalizedPeriod)
  const counterBytes = new Uint8Array(8)

  for (let index = counterBytes.length - 1; index >= 0; index -= 1) {
    counterBytes[index] = counter % 256
    counter = Math.floor(counter / 256)
  }

  const keyBytes = decodeBase32(secret)
  if (keyBytes.length === 0) throw new Error("TOTP secret is empty or invalid")

  const cryptoKey = await subtleCrypto.importKey(
    "raw",
    keyBytes.slice().buffer,
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  )
  const signature = await subtleCrypto.sign("HMAC", cryptoKey, counterBytes.slice().buffer)
  const hmac = new Uint8Array(signature)
  const offset = hmac[hmac.length - 1] & 0x0f
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff)
  const otp = binary % (10 ** normalizedDigits)

  return otp.toString().padStart(normalizedDigits, "0")
}

export function parseOtpauthUri(uri: string): ParsedTotpAccount | null {
  try {
    const url = new URL(uri)
    if (url.protocol !== "otpauth:" || url.host !== "totp") return null

    const path = decodeURIComponent(url.pathname.slice(1))
    const secret = url.searchParams.get("secret")?.toUpperCase().replace(/[^A-Z2-7]/g, "") ?? ""
    if (!path || !secret) return null

    const separatorIndex = path.indexOf(":")
    const pathIssuer = separatorIndex >= 0 ? path.slice(0, separatorIndex) : ""
    const name = separatorIndex >= 0 ? path.slice(separatorIndex + 1) : path
    const digits = normalizePositiveInteger(Number.parseInt(url.searchParams.get("digits") ?? "6", 10), 6)
    const period = normalizePositiveInteger(Number.parseInt(url.searchParams.get("period") ?? "30", 10), 30)

    return {
      name,
      issuer: url.searchParams.get("issuer") || pathIssuer,
      secret,
      digits,
      period,
    }
  } catch {
    return null
  }
}
