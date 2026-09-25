export type TotpAlgorithm = "SHA1" | "SHA256" | "SHA512"

export const TOTP_ALGORITHMS: readonly TotpAlgorithm[] = ["SHA1", "SHA256", "SHA512"]

export interface ParsedTotpAccount {
  name: string
  issuer: string
  secret: string
  digits: number
  period: number
  algorithm: TotpAlgorithm
}

export type OtpauthParseError = "invalidUri" | "unsupportedType" | "missingSecret" | "invalidSecret" | "unsupportedAlgorithm"

export type OtpauthParseResult =
  | { ok: true; account: ParsedTotpAccount }
  | { ok: false; error: OtpauthParseError; detail?: string }

export type Base32SecretResult = { ok: true; secret: string } | { ok: false; invalidCharacters: string[] }

/**
 * 规范化用户粘贴的 Base32 密钥：去掉分组用的空格和连字符、末尾的 = 填充，并转成大写。
 * 其余不在 A–Z / 2–7 里的字符原样报出来 —— 以前是静默删掉，
 * 误输的 0/1/8 被吃掉后照样生成验证码，只是永远对不上。
 */
export function normalizeBase32Secret(input: string): Base32SecretResult {
  const secret = input.replace(/[\s-]/g, "").replace(/=+$/, "").toUpperCase()
  const invalidCharacters = [...new Set(secret.replace(/[A-Z2-7]/g, ""))]
  if (invalidCharacters.length > 0) return { ok: false, invalidCharacters }
  return { ok: true, secret }
}

export function normalizeTotpAlgorithm(value: string | null | undefined): TotpAlgorithm | null {
  const normalized = (value ?? "SHA1").replace(/-/g, "").toUpperCase()
  return TOTP_ALGORITHMS.find((algorithm) => algorithm === normalized) ?? null
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

const WEB_CRYPTO_HASH: Record<TotpAlgorithm, string> = { SHA1: "SHA-1", SHA256: "SHA-256", SHA512: "SHA-512" }

export async function generateTotp(
  secret: string,
  period = 30,
  digits = 6,
  timestampSeconds = Math.floor(Date.now() / 1000),
  algorithm: TotpAlgorithm = "SHA1",
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
    { name: "HMAC", hash: WEB_CRYPTO_HASH[algorithm] ?? "SHA-1" },
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

export function parseOtpauthUri(uri: string): OtpauthParseResult {
  let url: URL
  try {
    url = new URL(uri.trim())
  } catch {
    return { ok: false, error: "invalidUri" }
  }
  if (url.protocol !== "otpauth:") return { ok: false, error: "invalidUri" }
  if (url.host !== "totp") return { ok: false, error: "unsupportedType", detail: url.host }

  let path: string
  try {
    path = decodeURIComponent(url.pathname.slice(1))
  } catch {
    return { ok: false, error: "invalidUri" }
  }

  const rawSecret = url.searchParams.get("secret") ?? ""
  if (!rawSecret.trim()) return { ok: false, error: "missingSecret" }
  const secret = normalizeBase32Secret(rawSecret)
  if (!secret.ok) return { ok: false, error: "invalidSecret", detail: secret.invalidCharacters.join(" ") }

  const algorithm = normalizeTotpAlgorithm(url.searchParams.get("algorithm"))
  if (!algorithm) return { ok: false, error: "unsupportedAlgorithm", detail: url.searchParams.get("algorithm") ?? "" }

  const separatorIndex = path.indexOf(":")
  const pathIssuer = separatorIndex >= 0 ? path.slice(0, separatorIndex) : ""
  const name = separatorIndex >= 0 ? path.slice(separatorIndex + 1) : path
  const digits = normalizePositiveInteger(Number.parseInt(url.searchParams.get("digits") ?? "6", 10), 6)
  const period = normalizePositiveInteger(Number.parseInt(url.searchParams.get("period") ?? "30", 10), 30)

  return {
    ok: true,
    account: {
      name: name.trim(),
      issuer: url.searchParams.get("issuer") || pathIssuer.trim(),
      secret: secret.secret,
      digits,
      period,
      algorithm,
    },
  }
}
