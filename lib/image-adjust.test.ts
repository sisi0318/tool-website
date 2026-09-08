import { describe, expect, it } from "vitest"
import { adjustImagePixels } from "./image-adjust-shared"
const defaults = { brightness: 100, contrast: 100, saturation: 100, grayscale: false }
describe("image adjustment pixels", () => {
  it("applies zero brightness without changing transparency", () => {
    const bytes = new Uint8ClampedArray([245, 34, 12, 255, 80, 120, 200, 64])
    adjustImagePixels(bytes, { ...defaults, brightness: 0 })
    expect([...bytes]).toEqual([0, 0, 0, 255, 0, 0, 0, 64])
  })
  it("grayscale and zero saturation remove color, while defaults preserve pixels", () => {
    const original = new Uint8ClampedArray([245, 34, 12, 127]), unchanged = new Uint8ClampedArray(original)
    adjustImagePixels(unchanged, defaults); expect(unchanged).toEqual(original)
    for (const options of [{ ...defaults, grayscale: true }, { ...defaults, saturation: 0 }]) { const bytes = new Uint8ClampedArray(original); adjustImagePixels(bytes, options); expect(bytes[0]).toBe(bytes[1]); expect(bytes[1]).toBe(bytes[2]); expect(bytes[3]).toBe(127); expect(bytes[0]).toBeGreaterThan(0) }
  })
  it("validates effect parameters instead of silently ignoring them", () => {
    expect(() => adjustImagePixels(new Uint8ClampedArray(4), { ...defaults, brightness: NaN })).toThrow()
    expect(() => adjustImagePixels(new Uint8ClampedArray(4), { ...defaults, saturation: 201 })).toThrow()
  })
})
