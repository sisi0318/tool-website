export const RADIX_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz+/"
const BIGINT_ZERO = BigInt(0)

function validateBase(base: number): void {
  if (!Number.isInteger(base) || base < 2 || base > RADIX_ALPHABET.length) {
    throw new Error(`进制必须是 2 到 ${RADIX_ALPHABET.length} 之间的整数`)
  }
}

function digitValue(character: string, base: number): number {
  if (base <= 36 && /[a-z]/.test(character)) {
    return RADIX_ALPHABET.indexOf(character.toUpperCase())
  }
  return RADIX_ALPHABET.indexOf(character)
}

export function parseBigIntInBase(value: string, base: number): bigint {
  validateBase(base)

  const compact = value.trim().replace(/[\s,_]/g, "")
  if (!compact) throw new Error("请输入要转换的整数")

  const negative = compact.startsWith("-")
  const digits = negative || compact.startsWith("+") ? compact.slice(1) : compact
  if (!digits) throw new Error("请输入有效的整数")

  const bigintBase = BigInt(base)
  let result = BIGINT_ZERO

  for (const character of digits) {
    const digit = digitValue(character, base)
    if (digit < 0 || digit >= base) {
      throw new Error(`字符“${character}”不是有效的 ${base} 进制数字`)
    }
    result = result * bigintBase + BigInt(digit)
  }

  return negative ? -result : result
}

export function formatBigIntInBase(value: bigint, base: number): string {
  validateBase(base)
  if (value === BIGINT_ZERO) return "0"

  const negative = value < BIGINT_ZERO
  const bigintBase = BigInt(base)
  let remaining = negative ? -value : value
  let result = ""

  while (remaining > BIGINT_ZERO) {
    result = RADIX_ALPHABET[Number(remaining % bigintBase)] + result
    remaining /= bigintBase
  }

  return negative ? `-${result}` : result
}

export function convertIntegerBase(value: string, fromBase: number, toBase: number): string {
  return formatBigIntInBase(parseBigIntInBase(value, fromBase), toBase)
}
