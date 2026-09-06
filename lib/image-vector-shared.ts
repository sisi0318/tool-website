export const VECTOR_RUNTIME_PATH = "/vtracer/1.0.0-alpha.4/vtracer-browser.mjs"
export const VECTOR_LIMITS = { fileBytes: 20 * 1024 * 1024, sourcePixels: 20_000_000, sourceSide: 32768, tracePixels: 2048 * 2048, runs: 360000, svgBytes: 24 * 1024 * 1024, paths: 250000, timeout: 45000 } as const
export type VectorErrorCode = "fileLimit" | "imageLimit" | "format" | "decode" | "options" | "complexity" | "outputLimit" | "cancelled" | "timeout" | "unsupported" | "engine"
export class ImageVectorError extends Error {
  constructor(public code: VectorErrorCode, public detail = "") { super(code); this.name = "ImageVectorError" }
}
export interface ImageVectorOptions {
  tracing: "faithful" | "smooth"
  mode: "color" | "monochrome"
  detail: "high" | "balanced" | "simple"
  colorPrecision: "fine" | "balanced" | "simple"
  maxEdge: number
  alpha: "transparent" | "white"
  threshold: number
}
export const DEFAULT_VECTOR_OPTIONS: ImageVectorOptions = { tracing: "faithful", mode: "color", detail: "high", colorPrecision: "fine", maxEdge: 1024, alpha: "transparent", threshold: 160 }
export type VectorStage = "reading" | "decoding" | "preparing" | "tracing" | "finishing"
export interface ImageVectorInfo { sourceWidth: number; sourceHeight: number; width: number; height: number; paths: number; bytes: number; elapsedMs: number; semiTransparentPixels: number; animated: boolean }
export interface ImageVectorResult { svg: string; file: File; info: ImageVectorInfo }
export type VectorWorkerRequest = { file: File; options: ImageVectorOptions }
export type VectorWorkerResponse = { type: "progress"; stage: VectorStage } | { type: "done"; svg: string; info: ImageVectorInfo } | { type: "error"; code: VectorErrorCode }

export function vectorOptions(input: Partial<ImageVectorOptions> = {}): ImageVectorOptions {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new ImageVectorError("options")
  const options = { ...DEFAULT_VECTOR_OPTIONS, ...input }
  if (!["faithful", "smooth"].includes(options.tracing) || !["color", "monochrome"].includes(options.mode) || !["high", "balanced", "simple"].includes(options.detail) || !["fine", "balanced", "simple"].includes(options.colorPrecision) || ![512, 768, 1024, 1600, 2048].includes(options.maxEdge) || !["transparent", "white"].includes(options.alpha) || !Number.isInteger(options.threshold) || options.threshold < 0 || options.threshold > 255) throw new ImageVectorError("options")
  return options
}
function dimensions(width: number, height: number) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) throw new ImageVectorError("decode")
  if (width > VECTOR_LIMITS.sourceSide || height > VECTOR_LIMITS.sourceSide || width * height > VECTOR_LIMITS.sourcePixels) throw new ImageVectorError("imageLimit")
  return { width, height }
}
export function rasterHeader(bytes: Uint8Array): { width: number; height: number; mime: string; animated: boolean } {
  if (bytes.length > VECTOR_LIMITS.fileBytes) throw new ImageVectorError("fileLimit")
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const ascii = (start: number, length: number) => String.fromCharCode(...bytes.subarray(start, start + length))
  if (bytes.length >= 33 && [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value) && ascii(12, 4) === "IHDR") {
    let animated = false
    for (let p = 8, chunks = 0; p + 12 <= bytes.length && chunks < 10000; chunks++) {
      const length = view.getUint32(p), type = ascii(p + 4, 4)
      if (type === "acTL") animated = true
      if (type === "IDAT" || p + length + 12 > bytes.length) break
      p += length + 12
    }
    return { ...dimensions(view.getUint32(16), view.getUint32(20)), mime: "image/png", animated }
  }
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    let position = 2
    const frames = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf])
    while (position + 3 < bytes.length) {
      if (bytes[position++] !== 0xff) break
      while (bytes[position] === 0xff) position++
      const marker = bytes[position++]
      if (marker === 0xda || marker === 0xd9) break
      if (marker === 0x01 || marker >= 0xd0 && marker <= 0xd8) continue
      if (position + 2 > bytes.length) break
      const length = view.getUint16(position)
      if (length < 2 || position + length > bytes.length) break
      if (frames.has(marker) && length >= 8) return { ...dimensions(view.getUint16(position + 5), view.getUint16(position + 3)), mime: "image/jpeg", animated: false }
      position += length
    }
    throw new ImageVectorError("decode")
  }
  if (bytes.length >= 20 && ascii(0, 4) === "RIFF" && ascii(8, 4) === "WEBP") {
    for (let p = 12; p + 8 <= bytes.length;) {
      const type = ascii(p, 4), length = view.getUint32(p + 4, true), start = p + 8
      if (start + length > bytes.length) break
      if (type === "VP8X" && length >= 10) {
        const u24 = (offset: number) => bytes[offset] | bytes[offset + 1] << 8 | bytes[offset + 2] << 16
        return { ...dimensions(u24(start + 4) + 1, u24(start + 7) + 1), mime: "image/webp", animated: Boolean(bytes[start] & 2) }
      }
      if (type === "VP8 " && length >= 10 && bytes[start + 3] === 0x9d && bytes[start + 4] === 1 && bytes[start + 5] === 0x2a) return { ...dimensions(view.getUint16(start + 6, true) & 0x3fff, view.getUint16(start + 8, true) & 0x3fff), mime: "image/webp", animated: false }
      if (type === "VP8L" && length >= 5 && bytes[start] === 0x2f) { const bits = view.getUint32(start + 1, true); return { ...dimensions((bits & 0x3fff) + 1, (bits >>> 14 & 0x3fff) + 1), mime: "image/webp", animated: false } }
      p = start + length + (length % 2)
    }
    throw new ImageVectorError("decode")
  }
  throw new ImageVectorError("format")
}
export function traceDimensions(width: number, height: number, maxEdge: number) {
  dimensions(width, height)
  if (![512, 768, 1024, 1600, 2048].includes(maxEdge)) throw new ImageVectorError("options")
  const scale = Math.min(1, maxEdge / Math.max(width, height))
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) }
}
export function prepareVectorPixels(source: Uint8Array | Uint8ClampedArray, width: number, height: number, input: Partial<ImageVectorOptions> = {}) {
  const options = vectorOptions(input)
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width * height > VECTOR_LIMITS.tracePixels || source.length !== width * height * 4) throw new ImageVectorError("imageLimit")
  const rgba = new Uint8Array(source), step = options.colorPrecision === "fine" ? 2 : options.colorPrecision === "simple" ? 16 : 8
  let semiTransparentPixels = 0, runs = 0
  for (let i = 0; i < rgba.length; i += 4) {
    const alpha = rgba[i + 3]
    if (alpha > 0 && alpha < 255) semiTransparentPixels++
    if (options.alpha === "transparent" && alpha < 128) rgba.fill(0, i, i + 4)
    else {
      for (let channel = 0; channel < 3; channel++) {
        const value = options.alpha === "white" ? Math.round(rgba[i + channel] * alpha / 255 + 255 - alpha) : rgba[i + channel]
        rgba[i + channel] = options.mode === "color" ? Math.min(255, Math.round(value / step) * step) : value
      }
      rgba[i + 3] = 255
      if (options.mode === "monochrome") { const value = rgba[i] * 0.2126 + rgba[i + 1] * 0.7152 + rgba[i + 2] * 0.0722 < options.threshold ? 0 : 255; rgba.fill(value, i, i + 3) }
    }
    if (i % (width * 4) === 0 || rgba[i] !== rgba[i - 4] || rgba[i + 1] !== rgba[i - 3] || rgba[i + 2] !== rgba[i - 2] || rgba[i + 3] !== rgba[i - 1]) runs++
    if (runs > VECTOR_LIMITS.runs) throw new ImageVectorError("complexity")
  }
  return { rgba, semiTransparentPixels }
}
export function vectorEngineOptions(options: ImageVectorOptions) {
  return { mode: options.tracing === "faithful" ? "pixel" : "spline", hierarchical: "stacked", colorPrecision: 8, layerDifference: 0, filterSpeckle: options.tracing === "faithful" || options.detail === "high" ? 0 : options.detail === "balanced" ? 2 : 8, simplify: options.detail === "high" ? 0.25 : options.detail === "balanced" ? 0.65 : 1.2, pathPrecision: 2, optimize: 2 }
}
export function finishVectorSvg(value: string, width: number, height: number, sourceWidth: number, sourceHeight: number) {
  if (value.length > VECTOR_LIMITS.svgBytes) throw new ImageVectorError("outputLimit")
  dimensions(sourceWidth, sourceHeight)
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width * height > VECTOR_LIMITS.tracePixels) throw new ImageVectorError("imageLimit")
  if (!/<svg\b/.test(value) || !/<\/svg>\s*$/.test(value) || /<(?:image|script|foreignObject|use|style|a)\b|\bon\w+\s*=|\b(?:href|xlink:href)\s*=/i.test(value)) throw new ImageVectorError("engine")
  const paths = (value.match(/<path\b/g) ?? []).length
  if (paths > VECTOR_LIMITS.paths) throw new ImageVectorError("outputLimit")
  const svg = value.replace(/<svg\b[^>]*>/, `<svg xmlns="http://www.w3.org/2000/svg" width="${sourceWidth}" height="${sourceHeight}" viewBox="0 0 ${width} ${height}">`)
  const bytes = new TextEncoder().encode(svg).byteLength
  if (bytes > VECTOR_LIMITS.svgBytes) throw new ImageVectorError("outputLimit")
  return { svg, paths, bytes }
}
export function svgFileName(name: string): string { return `${name.replace(/\.[^.]*$/, "").replace(/[\\/\u0000-\u001f]/g, "_").trim().slice(0, 100) || "image"}.svg` }
