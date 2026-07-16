import { describe, expect, it } from "vitest"
import { formatExifDate, parseExifDate } from "./exif-date"

describe("EXIF date tools", () => {
  it("parses the colon-separated EXIF date format", () => {
    const date = parseExifDate("2023:10:01 12:34:56")
    expect(date?.getFullYear()).toBe(2023)
    expect(date?.getMonth()).toBe(9)
    expect(date?.getDate()).toBe(1)
    expect(date?.getHours()).toBe(12)
  })

  it("falls back to the original value for invalid dates", () => {
    expect(formatExifDate("not-a-date")).toBe("not-a-date")
  })
})
