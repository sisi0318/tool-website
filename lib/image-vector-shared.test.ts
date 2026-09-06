// @vitest-environment node
import { createRequire } from "node:module"
import { describe, expect, it } from "vitest"
import sharp from "sharp"
import { DEFAULT_VECTOR_OPTIONS, VECTOR_LIMITS, finishVectorSvg, prepareVectorPixels, rasterHeader, svgFileName, traceDimensions, vectorEngineOptions, vectorOptions } from "./image-vector-shared"

function png(width: number, height: number) {
  const bytes = new Uint8Array(33), view = new DataView(bytes.buffer)
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10]); view.setUint32(8, 13); bytes.set([73, 72, 68, 82], 12); view.setUint32(16, width); view.setUint32(20, height)
  return bytes
}
describe("raster preflight and vector options", () => {
  it("checks PNG, JPEG and WebP dimensions before image decoding", () => {
    expect(rasterHeader(png(320, 240))).toMatchObject({ width: 320, height: 240, mime: "image/png" })
    expect(rasterHeader(new Uint8Array([255, 216, 255, 192, 0, 8, 8, 0, 24, 0, 32, 1]))).toMatchObject({ width: 32, height: 24, mime: "image/jpeg" })
    const webp = new Uint8Array(30); webp.set(Buffer.from("RIFF")); webp.set(Buffer.from("WEBPVP8X"), 8); new DataView(webp.buffer).setUint32(16, 10, true); webp[20] = 2; webp[24] = 63; webp[27] = 31
    expect(rasterHeader(webp)).toEqual({ width: 64, height: 32, mime: "image/webp", animated: true })
    const lossless = new Uint8Array(26); lossless.set(Buffer.from("RIFF")); lossless.set(Buffer.from("WEBPVP8L"), 8); const view = new DataView(lossless.buffer); view.setUint32(16, 5, true); lossless[20] = 0x2f; view.setUint32(21, 99 | 49 << 14, true)
    expect(rasterHeader(lossless)).toMatchObject({ width: 100, height: 50 })
  })
  it("rejects huge dimensions, invalid signatures and truncated headers", () => {
    expect(() => rasterHeader(png(100000, 1))).toThrowError("imageLimit")
    expect(() => rasterHeader(png(10000, 10000))).toThrowError("imageLimit")
    expect(() => rasterHeader(png(0, 100))).toThrowError("decode")
    expect(() => rasterHeader(new TextEncoder().encode('<svg width="99999"/>'))).toThrowError("format")
    expect(() => rasterHeader(new Uint8Array([255, 216, 255, 192, 0, 100]))).toThrowError("decode")
  })
  it("validates modes and scales without stretching or upscaling", () => {
    expect(vectorOptions()).toEqual(DEFAULT_VECTOR_OPTIONS)
    for (const value of [{ threshold: NaN }, { threshold: -1 }, { maxEdge: 0 }, { tracing: "unknown" }, { mode: "script" }]) expect(() => vectorOptions(value as never)).toThrowError("options")
    expect(traceDimensions(3000, 2000, 1024)).toEqual({ width: 1024, height: 683 })
    expect(traceDimensions(80, 60, 2048)).toEqual({ width: 80, height: 60 })
  })
})
describe("pixel preparation", () => {
  it("retains transparent holes without mutating the input and handles white compositing", () => {
    const input = new Uint8Array([255, 0, 0, 64, 40, 90, 140, 255]), snapshot = input.slice()
    const transparent = prepareVectorPixels(input, 2, 1)
    expect([...transparent.rgba]).toEqual([0, 0, 0, 0, 40, 90, 140, 255])
    expect(input).toEqual(snapshot)
    expect(transparent.semiTransparentPixels).toBe(1)
    expect([...prepareVectorPixels(input, 2, 1, { alpha: "white" }).rgba.slice(0, 4)]).toEqual([255, 192, 192, 255])
  })
  it("produces black/white pixels and refuses pathological transition counts", () => {
    expect([...prepareVectorPixels(new Uint8Array([40, 40, 40, 255, 220, 220, 220, 255]), 2, 1, { mode: "monochrome" }).rgba]).toEqual([0, 0, 0, 255, 255, 255, 255, 255])
    const width = 1024, height = 353, noise = new Uint8Array(width * height * 4)
    for (let pixel = 0; pixel < width * height; pixel++) { noise[pixel * 4] = pixel % 2 ? 255 : 0; noise[pixel * 4 + 3] = 255 }
    expect(() => prepareVectorPixels(noise, width, height)).toThrowError("complexity")
    expect(() => prepareVectorPixels(new Uint8Array(3), 1, 1)).toThrowError("imageLimit")
  })
})
describe("SVG result integrity", () => {
  it("sets a scalable viewBox and rejects executable or embedded content", () => {
    const result = finishVectorSvg('<svg width="1" height="1"><path d="M0 0h1v1z"/></svg>', 100, 50, 200, 100)
    expect(result.svg).toContain('width="200" height="100" viewBox="0 0 100 50"')
    expect(result.paths).toBe(1)
    for (const body of ['<image href="data:image/png;base64,xx"/>', '<script>alert(1)</script>', '<path onload="x"/>']) expect(() => finishVectorSvg(`<svg>${body}</svg>`, 1, 1, 1, 1)).toThrowError("engine")
    expect(() => finishVectorSvg("x".repeat(VECTOR_LIMITS.svgBytes + 1), 1, 1, 1, 1)).toThrowError("outputLimit")
    expect(svgFileName('a/b\\c.png')).toBe('a_b_c.svg')
  })
  it("keeps continuous colors in faithful mode using the real WASM engine", async () => {
    const engine = createRequire(import.meta.url)("@visioncortex/vtracer")
    const width = 64, height = 64, pixels = new Uint8Array(width * height * 4)
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) { const i = (y * width + x) * 4; pixels.set([70 + x, 120 + y, 80 + Math.floor((x + y) / 2), 255], i) }
    const options = vectorOptions(), { rgba } = prepareVectorPixels(pixels, width, height, options)
    const result = finishVectorSvg(engine.convertPixels(rgba, width, height, vectorEngineOptions(options)), width, height, width, height)
    expect(result.paths).toBeGreaterThan(100)
    expect(result.svg).not.toMatch(/<image\b/)
    const rendered = await sharp(Buffer.from(result.svg)).ensureAlpha().raw().toBuffer()
    let error = 0
    for (let i = 0; i < pixels.length; i += 4) for (let channel = 0; channel < 3; channel++) error += Math.abs(pixels[i + channel] - rendered[i + channel])
    expect(error / (width * height * 3)).toBeLessThan(1.5)
  })
})
