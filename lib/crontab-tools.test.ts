import { describe, expect, it } from "vitest"
import { expandCronField, generateCronDescription, getNextExecutionTimes } from "./crontab-tools"

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

  it("describes ranges and lists as selections rather than literal values", () => {
    expect(generateCronDescription("0 1-3 * * *")).toContain("1点到3点")
    expect(generateCronDescription("0 1,3,5 * * *")).toContain("1点、3点、5点")
    expect(generateCronDescription("0 0 1 1-3 *")).toContain("1月到3月")
  })
})
