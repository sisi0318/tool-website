import { describe, expect, it } from "vitest"
import { validate, version } from "uuid"
import { generateUuidV1, generateUuidV4 } from "./uuid-tools"

describe("UUID tools", () => {
  it("generates a standards-compliant version 1 UUID", () => {
    const value = generateUuidV1()
    expect(validate(value)).toBe(true)
    expect(version(value)).toBe(1)
  })

  it("generates a standards-compliant version 4 UUID", () => {
    const value = generateUuidV4()
    expect(validate(value)).toBe(true)
    expect(version(value)).toBe(4)
  })
})
