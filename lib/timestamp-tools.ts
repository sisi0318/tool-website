export type TimestampUnit = "seconds" | "milliseconds" | "microseconds" | "nanoseconds"
export type TimestampUnitChoice = TimestampUnit | "auto"

export const TIMESTAMP_UNITS: readonly TimestampUnit[] = ["seconds", "milliseconds", "microseconds", "nanoseconds"]

export type TimestampParseResult =
  | { ok: true; date: Date; unit: TimestampUnit; milliseconds: number }
  | { ok: false; error: "empty" | "invalid" | "outOfRange" }

// tsconfig 目标是 ES6,不能写 1n 这类字面量
const NANOS_PER_MILLISECOND = BigInt(1_000_000)
const NANOS_PER_UNIT: Record<TimestampUnit, bigint> = {
  seconds: BigInt(1_000_000_000),
  milliseconds: NANOS_PER_MILLISECOND,
  microseconds: BigInt(1_000),
  nanoseconds: BigInt(1),
}

/** Date 能表示的范围:距纪元 ±1 亿天 */
const MAX_DATE_MS = 8.64e15

/**
 * 按整数位数猜单位:10 位秒、13 位毫秒、16 位微秒、19 位纳秒是最常见的写法。
 * 边界取在相邻写法之间 —— 秒级时间戳要到公元 5138 年才长到 12 位,
 * 所以 ≤11 位按秒,12–14 位毫秒,15–17 位微秒,更长按纳秒。
 */
export function detectTimestampUnit(integerDigits: number): TimestampUnit {
  if (integerDigits <= 11) return "seconds"
  if (integerDigits <= 14) return "milliseconds"
  if (integerDigits <= 17) return "microseconds"
  return "nanoseconds"
}

/**
 * 解析 Unix 时间戳。允许正负号、小数,以及复制来的千分位、空格和下划线。
 * 换算走 BigInt:19 位纳秒戳已超出 double 的整数精度。
 */
export function parseTimestamp(input: string, unit: TimestampUnitChoice = "auto"): TimestampParseResult {
  const text = input.trim().replace(/[\s,_']/g, "")
  if (!text) return { ok: false, error: "empty" }
  const match = /^([+-]?)(\d+)(?:\.(\d+))?$/.exec(text)
  if (!match) return { ok: false, error: "invalid" }

  const [, sign, integer, fraction = ""] = match
  const resolved = unit === "auto" ? detectTimestampUnit(integer.replace(/^0+(?=\d)/, "").length) : unit
  const scale = NANOS_PER_UNIT[resolved]
  const fractionNanos = fraction ? BigInt(fraction) * scale / BigInt(`1${"0".repeat(fraction.length)}`) : BigInt(0)
  const nanos = BigInt(integer) * scale + fractionNanos
  const milliseconds = Number((sign === "-" ? -nanos : nanos) / NANOS_PER_MILLISECOND)
  if (!Number.isFinite(milliseconds) || Math.abs(milliseconds) > MAX_DATE_MS) return { ok: false, error: "outOfRange" }

  return { ok: true, date: new Date(milliseconds), unit: resolved, milliseconds }
}

/** 当前时刻按指定单位写成时间戳文本 */
export function formatTimestamp(milliseconds: number, unit: TimestampUnit): string {
  const nanos = BigInt(Math.trunc(milliseconds)) * NANOS_PER_MILLISECOND
  return (nanos / NANOS_PER_UNIT[unit]).toString()
}

const RELATIVE_UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ["year", 365 * 24 * 3600],
  ["month", 30 * 24 * 3600],
  ["week", 7 * 24 * 3600],
  ["day", 24 * 3600],
  ["hour", 3600],
  ["minute", 60],
  ["second", 1],
]

/** "3 分钟前" / "in 2 days" 这类相对时间,取能用整数表达的最大单位 */
export function formatRelativeTime(date: Date, now: Date, locale: string): string {
  const diffSeconds = Math.round((date.getTime() - now.getTime()) / 1000)
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: "auto" })
  for (const [unit, seconds] of RELATIVE_UNITS) {
    if (Math.abs(diffSeconds) >= seconds || unit === "second") {
      return formatter.format(Math.round(diffSeconds / seconds), unit)
    }
  }
  return formatter.format(0, "second")
}
