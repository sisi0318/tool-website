import { describe, expect, it } from "vitest"
import { compareImagePixels, DEFAULT_IMAGE_DIFF_OPTIONS, imageDiffLayout } from "./image-diff-shared"
const options = { ...DEFAULT_IMAGE_DIFF_OPTIONS, threshold: 0 }
const pixels = (width: number, height: number, rgba = [0, 0, 0, 255]) => ({ width, height, data: new Uint8ClampedArray(Array.from({ length: width * height }, () => rgba).flat()) })
describe("original-pixel image comparison", () => {
  it("locates exact changed pixels and inclusive bounds", () => {
    const a = pixels(4, 3), b = pixels(4, 3); b.data.set([200, 0, 0, 255], (1 * 4 + 2) * 4)
    const diff = compareImagePixels(a, b, options)
    expect(diff.stats).toEqual({ compared: 12, changed: 1, overlap: 12, onlyA: 0, onlyB: 0, bounds: { x: 2, y: 1, width: 1, height: 1 } })
    expect([...diff.pixels.slice(24, 28)]).toEqual([239, 68, 68, 255])
    expect(compareImagePixels(a, b, { ...options, threshold: 200 }).stats.changed).toBe(0)
  })
  it("ignores hidden transparent RGB but counts alpha changes", () => {
    const a = pixels(2, 1, [255, 0, 0, 0]), b = pixels(2, 1, [0, 255, 0, 0])
    expect(compareImagePixels(a, b, options).stats.changed).toBe(0)
    b.data[3] = 1; expect(compareImagePixels(a, b, options).stats.changed).toBe(1)
  })
  it("counts source coverage separately from empty canvas padding even at threshold 255", () => {
    const diff = compareImagePixels(pixels(2, 2), pixels(2, 2), { ...options, offsetX: -3, offsetY: 3, threshold: 255 })
    expect(diff.layout).toEqual({ width: 5, height: 5, ax: 3, ay: 0, bx: 0, by: 3 })
    expect(diff.stats).toMatchObject({ compared: 8, overlap: 0, changed: 8, onlyA: 4, onlyB: 4 })
    expect(diff.pixels[(2 * 5 + 2) * 4 + 3]).toBe(0)
  })
  it("centers differently sized images without resampling and bounds resource use", () => {
    expect(imageDiffLayout(pixels(10, 8), pixels(6, 4), { ...options, alignment: "center" })).toEqual({ width: 10, height: 8, ax: 0, ay: 0, bx: 2, by: 2 })
    expect(() => imageDiffLayout({ width: 5000, height: 4000 }, { width: 5000, height: 4000 }, { ...options, offsetX: 1 })).toThrow("imageLimit")
    expect(() => imageDiffLayout(pixels(1, 1), pixels(1, 1), { ...options, offsetX: 0.5 })).toThrow("options")
  })
})
