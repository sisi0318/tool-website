import { describe, expect, it } from "vitest"
import { getModularInverse } from "./classic-cipher-tools"

describe("classic cipher tools", () => {
  it("returns a valid modular inverse", () => {
    expect(getModularInverse(5, 26)).toBe(21)
  })

  it("rejects an affine key without an inverse", () => {
    expect(() => getModularInverse(13, 26)).toThrow("不互质")
  })
})
