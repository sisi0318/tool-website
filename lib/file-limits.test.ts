import { describe, expect, it } from "vitest"

import {
  FILE_SIZE_LIMITS,
  MEBIBYTE,
  formatFileSizeLimit,
  isFileWithinLimit,
} from "./file-limits"

describe("file limits", () => {
  it("accepts files exactly at the limit", () => {
    expect(isFileWithinLimit({ size: 10 * MEBIBYTE }, 10 * MEBIBYTE)).toBe(true)
  })

  it("rejects files above the limit", () => {
    expect(isFileWithinLimit({ size: FILE_SIZE_LIMITS.certificate + 1 }, FILE_SIZE_LIMITS.certificate)).toBe(false)
  })

  it("formats limits for user-facing messages", () => {
    expect(formatFileSizeLimit(FILE_SIZE_LIMITS.officeDocument)).toBe("50 MB")
  })
})
