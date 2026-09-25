import { describe, expect, it } from "vitest"
import { formatRelativeTime, formatTimestamp, parseTimestamp } from "./timestamp-tools"

const ISO = "2023-11-14T22:13:20.000Z"

describe("parseTimestamp", () => {
  it("detects seconds, milliseconds, microseconds and nanoseconds by length", () => {
    for (const [input, unit] of [
      ["1700000000", "seconds"],
      ["1700000000000", "milliseconds"],
      ["1700000000000000", "microseconds"],
      ["1700000000000000000", "nanoseconds"],
    ] as const) {
      const result = parseTimestamp(input)
      expect(result).toMatchObject({ ok: true, unit })
      expect(result.ok && result.date.toISOString()).toBe(ISO)
    }
  })

  it("accepts grouping separators, fractions and negative values", () => {
    expect(parseTimestamp(" 1,700,000,000 ")).toMatchObject({ ok: true, unit: "seconds", milliseconds: 1_700_000_000_000 })
    expect(parseTimestamp("1700000000.123")).toMatchObject({ ok: true, milliseconds: 1_700_000_000_123 })
    expect(parseTimestamp("-1")).toMatchObject({ ok: true, milliseconds: -1000 })
  })

  it("honors an explicit unit instead of guessing", () => {
    expect(parseTimestamp("1700000000", "milliseconds")).toMatchObject({ ok: true, milliseconds: 1_700_000_000 })
  })

  it("reports empty, malformed and out-of-range input", () => {
    expect(parseTimestamp("  ")).toEqual({ ok: false, error: "empty" })
    expect(parseTimestamp("17e8")).toEqual({ ok: false, error: "invalid" })
    expect(parseTimestamp("2023-11-14")).toEqual({ ok: false, error: "invalid" })
    expect(parseTimestamp("99999999999999999999999")).toEqual({ ok: false, error: "outOfRange" })
    expect(parseTimestamp("99999999999", "milliseconds")).toMatchObject({ ok: true })
  })
})

describe("formatTimestamp", () => {
  it("writes a moment in each unit without floating point loss", () => {
    expect(formatTimestamp(1_700_000_000_123, "seconds")).toBe("1700000000")
    expect(formatTimestamp(1_700_000_000_123, "milliseconds")).toBe("1700000000123")
    expect(formatTimestamp(1_700_000_000_123, "nanoseconds")).toBe("1700000000123000000")
  })
})

describe("formatRelativeTime", () => {
  it("uses the largest whole unit", () => {
    const now = new Date(Date.UTC(2026, 0, 1))
    expect(formatRelativeTime(new Date(now.getTime() - 3 * 60_000), now, "en")).toBe("3 minutes ago")
    expect(formatRelativeTime(new Date(now.getTime() + 2 * 86_400_000), now, "en")).toBe("in 2 days")
    expect(formatRelativeTime(now, now, "en")).toBe("now")
  })
})
