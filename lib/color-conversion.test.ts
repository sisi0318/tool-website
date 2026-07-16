import { describe, expect, it } from "vitest"
import { rgbToLch } from "./color-conversion"

describe("color conversion", () => {
  it("converts sRGB red to CIELCH instead of approximating it with HSL", () => {
    const [lightness, chroma, hue] = rgbToLch(255, 0, 0)
    expect(lightness).toBeCloseTo(54.29, 1)
    expect(chroma).toBeCloseTo(106.84, 1)
    expect(hue).toBeCloseTo(40.9, 0)
  })

  it("returns zero chroma for neutral gray", () => {
    const [, chroma] = rgbToLch(128, 128, 128)
    expect(chroma).toBeLessThan(0.03)
  })
})
