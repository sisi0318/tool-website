import { describe, expect, it } from "vitest"
import { convertIntegerBase, formatBigIntInBase, parseBigIntInBase } from "./base-converter-tools"

describe("base converter tools", () => {
  it("does not lose precision above Number.MAX_SAFE_INTEGER", () => {
    expect(convertIntegerBase("9007199254740993", 10, 16)).toBe("20000000000001")
    expect(convertIntegerBase("20000000000001", 16, 10)).toBe("9007199254740993")
  })

  it("supports negative values and lowercase hexadecimal input", () => {
    expect(convertIntegerBase("-ff", 16, 10)).toBe("-255")
    expect(convertIntegerBase("-255", 10, 16)).toBe("-FF")
  })

  it("round-trips numeric radix-64 without pretending it is byte Base64", () => {
    const value = (BigInt(1) << BigInt(160)) + BigInt(123456789)
    expect(parseBigIntInBase(formatBigIntInBase(value, 64), 64)).toBe(value)
  })
})
