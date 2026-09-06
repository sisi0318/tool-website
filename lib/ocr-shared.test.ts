// @vitest-environment node
import { describe, expect, it } from "vitest"
import { checkOcrDimensions, mapOcrLine, ocrExport, ocrImageHeader, ocrOptions, ocrTiles, orderOcrLines, type OcrPoint, type OcrResult } from "./ocr-shared"

const box = (x: number, y: number, w = 100, h = 24): OcrPoint[] => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]]
describe("OCR input and geometry", () => {
  it("rejects unsupported files and excessive dimensions before image decoding", () => {
    expect(() => ocrImageHeader(new TextEncoder().encode('<svg onload="alert(1)"/>'))).toThrow("format")
    expect(() => checkOcrDimensions(6000, 6000)).toThrow("imageLimit")
    expect(() => checkOcrDimensions(1, 32769)).toThrow("imageLimit")
    expect(() => ocrOptions({ rotation: 45 as 90 })).toThrow("options")
    expect(() => ocrOptions({ enhanceSmallText: "true" as unknown as boolean })).toThrow("options")
  })
  it("tiles long and wide images without gaps or double-owned centers", () => {
    for (const [width, height] of [[1100, 3000], [4000, 2500], [100, 32768], [640, 260]]) {
      const tiles = ocrTiles(width, height)
      for (let y = 0; y < height; y += 37) for (let x = 0; x < width; x += 43) {
        expect(tiles.filter(tile => x >= tile.left && x < tile.right && y >= tile.top && y < tile.bottom)).toHaveLength(1)
      }
      for (const tile of tiles) {
        expect(tile.width).toBeLessThanOrEqual(1920); expect(tile.height).toBeLessThanOrEqual(1280)
        expect(tile.left).toBeGreaterThanOrEqual(tile.x); expect(tile.right).toBeLessThanOrEqual(tile.x + tile.width)
        expect(tile.top).toBeGreaterThanOrEqual(tile.y); expect(tile.bottom).toBeLessThanOrEqual(tile.y + tile.height)
      }
    }
  })
  it("maps upscaled coordinates precisely and assigns overlap detections once", () => {
    const tiles = ocrTiles(1100, 3000), original = box(50, 1250)
    const candidates = tiles.map(tile => mapOcrLine({ text: "金额 1234.56", score: 0.95, poly: original.map(([x, y]) => [(x - tile.x) * 1.25, (y - tile.y) * 1.25]) }, tile, 1.25, 1.25, 1100, 3000)).filter(Boolean)
    expect(candidates).toHaveLength(1); expect(candidates[0]!.poly).toEqual(original)
    expect(mapOcrLine({ text: "bad", score: NaN, poly: original }, tiles[0], 1, 1, 1100, 3000)).toBeNull()
  })
  it("keeps repeated content on different rows, deduplicates overlaps, and orders a row left to right", () => {
    const lines = orderOcrLines([
      { text: "right", score: .9, poly: box(300, 12) }, { text: "left", score: .98, poly: box(20, 14) },
      { text: "left", score: .7, poly: box(21, 15) }, { text: "left", score: .99, poly: box(20, 70) },
    ])
    expect(lines.map(l => l.text)).toEqual(["left", "right", "left"])
    expect(lines[0].score).toBe(.98); expect(lines.map(l => l.id)).toEqual([0, 1, 2])
  })
  it("exports edits independently from original text and rotated coordinates", () => {
    const result: OcrResult = { text: "0O1l", lines: [{ id: 0, text: "0O1l", score: .5, poly: box(1, 2) }], info: { width: 300, height: 200, rotation: 90, tiles: 1, elapsedMs: 200, animated: false }, preview: new Blob() }
    const json = JSON.parse(ocrExport(result, "corrected"))
    expect(json.text).toBe("corrected"); expect(json.originalText).toBe("0O1l"); expect(json.lines[0].poly).toEqual(box(1, 2)); expect(json.coordinateSpace).toBe("rotated-image-pixels")
  })
})
