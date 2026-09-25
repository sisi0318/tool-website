import { describe, expect, it } from "vitest"
import { expandCronField, generateCronDescription, getNextExecutionTimes, inferCronIncludeSeconds } from "./crontab-tools"

describe("crontab tools", () => {
  it("expands ranges with steps correctly", () => {
    expect(expandCronField("1-10/3", 0, 59)).toEqual([1, 4, 7, 10])
    expect(expandCronField("5/20", 0, 59)).toEqual([5, 25, 45])
  })

  it("finds low-frequency schedules without a one-day scan limit", () => {
    const start = new Date(2026, 0, 2, 12, 0, 0)
    const [next] = getNextExecutionTimes("0 0 1 1 *", false, 1, start)
    expect(next).toEqual(new Date(2027, 0, 1, 0, 0, 0))
  })

  it("finds low-frequency schedules when seconds are enabled", () => {
    const start = new Date(2026, 0, 2, 12, 0, 0)
    const [next] = getNextExecutionTimes("0 0 0 1 1 *", true, 1, start)
    expect(next).toEqual(new Date(2027, 0, 1, 0, 0, 0))
  })

  it("uses traditional cron OR semantics for day-of-month and day-of-week", () => {
    const start = new Date(2026, 0, 2, 12, 0, 0)
    const [next] = getNextExecutionTimes("0 0 13 * 1", false, 1, start)

    expect(next).toEqual(new Date(2026, 0, 5, 0, 0, 0))
  })

  it("describes ranges and lists as selections rather than literal values", () => {
    expect(generateCronDescription("0 1-3 * * *")).toContain("1点到3点")
    expect(generateCronDescription("0 1,3,5 * * *")).toContain("1点、3点、5点")
    expect(generateCronDescription("0 0 1 1-3 *")).toContain("1月到3月")
  })

  it("uses the supplied translator for human-readable descriptions", () => {
    const english: Record<string, string> = {
      cronAt: "at {{value}}",
      cronHourLabel: "{{value}}:00",
      cronMinuteLabel: "minute {{value}}",
      cronMinutesUnit: "minutes",
      cronRange: "{{start}} through {{end}}",
      cronPartSeparator: ", ",
      cronDescriptionResult: "Run {{parts}}",
    }

    const description = generateCronDescription(
      "0 1-3 * * *",
      false,
      (key) => english[key] ?? key,
    )

    expect(description).toBe("Run at minute 0, at 1:00 through 3:00")
    expect(description).not.toMatch(/[\u3400-\u9fff]/)
  })
})

describe("inferCronIncludeSeconds", () => {
  it("reads six fields as Quartz / Spring seconds-first when that is the only sensible reading", () => {
    expect(inferCronIncludeSeconds("0 0 9 * * ?", false)).toBe(true)
    expect(inferCronIncludeSeconds("0 0 9 * * *", false)).toBe(true)
    expect(inferCronIncludeSeconds("0 0 9 * * 1-5", false)).toBe(true)
    expect(inferCronIncludeSeconds("0 0 12 * * ? 2030", false)).toBe(true)
  })

  it("keeps the five-fields-plus-year reading for AWS style and explicit years", () => {
    expect(inferCronIncludeSeconds("0 12 * * ? *", false)).toBe(false)
    expect(inferCronIncludeSeconds("0 0 1 1 * 2030", false)).toBe(false)
    expect(inferCronIncludeSeconds("*/5 * * * *", false)).toBe(false)
  })

  it("switches back to standard mode when a valid five-field expression is pasted", () => {
    expect(inferCronIncludeSeconds("*/5 * * * *", true)).toBe(false)
    expect(inferCronIncludeSeconds("0 */5 * * * *", true)).toBe(true)
    expect(inferCronIncludeSeconds("bad * * * *", true)).toBe(true)
  })

  it("schedules the Quartz example daily at 09:00:00 once read with seconds", () => {
    const start = new Date(2026, 0, 2, 12, 0, 0)
    const runs = getNextExecutionTimes("0 0 9 * * ?", true, 2, start)
    expect(runs.map((date) => [date.getDate(), date.getHours(), date.getMinutes(), date.getSeconds()])).toEqual([[3, 9, 0, 0], [4, 9, 0, 0]])
  })
})
