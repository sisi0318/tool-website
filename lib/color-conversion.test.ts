import { describe, expect, it } from "vitest"
import { lchToRgb, parseColorInput, rgbToLch } from "./color-conversion"

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

  it("inverts precise CIELCH values exactly", () => {
    expect(lchToRgb(54.2943, 106.8518, 40.855)).toEqual([255, 0, 0])
    expect(lchToRgb(29.5647, 131.1876, 301.3687)).toEqual([0, 0, 255])
    expect(lchToRgb(87.8177, 113.3269, 134.3789)).toEqual([0, 255, 0])
    expect(lchToRgb(0.504, 0.5058, 250.6456)).toEqual([1, 2, 3])
  })

  it("round-trips the rounded values the picker displays to within two steps", () => {
    // rgbToLch shows hue to 0.1°; at high chroma that moves a gamut-edge channel by a byte or two.
    const samples: Array<[number, number, number]> = [[16, 106, 47], [255, 0, 0], [0, 0, 255], [128, 128, 128], [255, 255, 255], [0, 0, 0], [18, 52, 86]]
    for (const rgb of samples) {
      lchToRgb(...rgbToLch(...rgb)).forEach((channel, index) => {
        expect(Math.abs(channel - rgb[index])).toBeLessThanOrEqual(2)
      })
    }
  })
})

describe("parseColorInput", () => {
  it("accepts 3- and 6-digit hex with or without #", () => {
    expect(parseColorInput("hex", "#106A2F")).toBe("#106a2f")
    expect(parseColorInput("hex", " 106a2f ")).toBe("#106a2f")
    expect(parseColorInput("hex", "#fff")).toBe("#ffffff")
    expect(parseColorInput("hex", "#12345")).toBeNull()
    expect(parseColorInput("hex", "#106a2g")).toBeNull()
  })

  it("parses the rgb() spellings people paste", () => {
    for (const input of ["rgb(16, 106, 47)", "rgb(16 106 47)", "rgba(16, 106, 47, 0.5)", "rgb(16 106 47 / 50%)", "16, 106, 47", "RGB( 16 , 106 , 47 )"]) {
      expect(parseColorInput("rgb", input)).toBe("#106a2f")
    }
    expect(parseColorInput("rgb", "rgb(100%, 0%, 0%)")).toBe("#ff0000")
  })

  it("rejects incomplete, out-of-range or mismatched rgb input", () => {
    for (const input of ["rgb(16, 106, 47", "rgb(16, 106)", "rgb(256, 0, 0)", "rgb(-1, 0, 0)", "hsl(0, 100%, 50%)", "rgb(16 106 47 / 1 / 2)", "rgb(16 106 47 50)", ""]) {
      expect(parseColorInput("rgb", input)).toBeNull()
    }
  })

  it("parses hsl() with degrees, negative hues and legacy alpha", () => {
    expect(parseColorInput("hsl", "hsl(0, 100%, 50%)")).toBe("#ff0000")
    expect(parseColorInput("hsl", "hsl(120deg 100% 25%)")).toBe("#008000")
    expect(parseColorInput("hsl", "hsla(240, 100%, 50%, 0.3)")).toBe("#0000ff")
    expect(parseColorInput("hsl", "hsl(-120, 100%, 50%)")).toBe("#0000ff")
    expect(parseColorInput("hsl", "hsl(0, 101%, 50%)")).toBeNull()
  })

  it("parses hwb() including the white + black >= 100% gray case", () => {
    expect(parseColorInput("hwb", "hwb(0 0% 0%)")).toBe("#ff0000")
    expect(parseColorInput("hwb", "hwb(120 0% 50%)")).toBe("#008000")
    expect(parseColorInput("hwb", "hwb(0 60% 60%)")).toBe("#808080")
    expect(parseColorInput("hwb", "hwb(0 0% 0% 0%)")).toBeNull()
  })

  it("parses device-cmyk() percentages, fractions and bare percentages", () => {
    expect(parseColorInput("cmyk", "device-cmyk(0% 100% 100% 0%)")).toBe("#ff0000")
    expect(parseColorInput("cmyk", "device-cmyk(0 1 1 0)")).toBe("#ff0000")
    expect(parseColorInput("cmyk", "device-cmyk(85 0 56 58)")).toBe("#106b2f")
    expect(parseColorInput("cmyk", "cmyk(0%, 0%, 0%, 100%)")).toBe("#000000")
    expect(parseColorInput("cmyk", "device-cmyk(0% 100% 100%)")).toBeNull()
  })

  it("parses lch() written the way the picker displays it", () => {
    const [lightness, chroma, hue] = rgbToLch(16, 106, 47)
    expect(parseColorInput("lch", `lch(${lightness}% ${chroma} ${hue})`)).toBe("#106a2f")
    expect(parseColorInput("lch", "lch(50% 0 0)")).toBe("#777777")
    expect(parseColorInput("lch", "lch(101% 0 0)")).toBeNull()
  })
})
