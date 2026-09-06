import { checkOcrDimensions, OcrError } from "./ocr-shared"

export const IMAGE_DIFF_LIMITS = { pixels: 20_000_000, side: 32768, offset: 32768, timeout: 60_000, outputBytes: 64 * 1024 * 1024 } as const
export interface ImageDiffOptions { alignment: "top-left" | "center"; offsetX: number; offsetY: number; threshold: number }
export const DEFAULT_IMAGE_DIFF_OPTIONS: ImageDiffOptions = { alignment: "top-left", offsetX: 0, offsetY: 0, threshold: 16 }
export interface DiffSource { width: number; height: number; preview: Blob; animated: boolean }
export interface DiffLayout { width: number; height: number; ax: number; ay: number; bx: number; by: number }
export interface DiffStats { compared: number; changed: number; overlap: number; onlyA: number; onlyB: number; bounds: { x: number; y: number; width: number; height: number } | null }
export interface ImageDiffResult { layout: DiffLayout; stats: DiffStats; preview: Blob; output: Blob }
export type ImageDiffRequest = { action: "prepare"; file: File } | { action: "compare"; a: File; b: File; options: ImageDiffOptions }
export type ImageDiffResponse = { source: DiffSource } | { result: ImageDiffResult }
export type ImageDiffStage = "readingA" | "readingB" | "comparing" | "encoding"

export function imageDiffOptions(input: ImageDiffOptions): ImageDiffOptions {
  if (!input || !["top-left", "center"].includes(input.alignment) || !Number.isInteger(input.threshold) || input.threshold < 0 || input.threshold > 255 || [input.offsetX, input.offsetY].some(v => !Number.isInteger(v) || Math.abs(v) > IMAGE_DIFF_LIMITS.offset)) throw new OcrError("options")
  return { ...input }
}
export function imageDiffLayout(a: { width: number; height: number }, b: { width: number; height: number }, input: ImageDiffOptions): DiffLayout {
  checkOcrDimensions(a.width, a.height); checkOcrDimensions(b.width, b.height)
  const options = imageDiffOptions(input)
  const bx = (options.alignment === "center" ? Math.floor((a.width - b.width) / 2) : 0) + options.offsetX, by = (options.alignment === "center" ? Math.floor((a.height - b.height) / 2) : 0) + options.offsetY
  const left = Math.min(0, bx), top = Math.min(0, by), width = Math.max(a.width, bx + b.width) - left, height = Math.max(a.height, by + b.height) - top
  if (width > IMAGE_DIFF_LIMITS.side || height > IMAGE_DIFF_LIMITS.side || width * height > IMAGE_DIFF_LIMITS.pixels) throw new OcrError("imageLimit")
  return { width, height, ax: Math.abs(left), ay: Math.abs(top), bx: bx - left, by: by - top }
}
interface DiffPixels { width: number; height: number; data: Uint8ClampedArray }
/** Compare premultiplied RGB and alpha; invisible RGB in fully transparent pixels does not matter. */
export function compareImagePixels(a: DiffPixels, b: DiffPixels, options: ImageDiffOptions) {
  const layout = imageDiffLayout(a, b, options), { width, height, ax, ay, bx, by } = layout
  if (a.data.length !== a.width * a.height * 4 || b.data.length !== b.width * b.height * 4) throw new OcrError("decode")
  const pixels = new Uint8ClampedArray(width * height * 4)
  let overlap = 0, onlyA = 0, onlyB = 0, changed = 0, minX = width, minY = height, maxX = -1, maxY = -1
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const inA = x >= ax && x < ax + a.width && y >= ay && y < ay + a.height, inB = x >= bx && x < bx + b.width && y >= by && y < by + b.height
    if (!inA && !inB) continue
    const ai = inA ? ((y - ay) * a.width + x - ax) * 4 : -1, bi = inB ? ((y - by) * b.width + x - bx) * 4 : -1
    let different = inA !== inB
    if (inA && inB) {
      overlap++
      const aa = a.data[ai + 3], ba = b.data[bi + 3]
      let delta = Math.abs(aa - ba)
      for (let c = 0; c < 3; c++) delta = Math.max(delta, Math.abs(a.data[ai + c] * aa / 255 - b.data[bi + c] * ba / 255))
      different = delta > options.threshold
    } else if (inA) onlyA++; else onlyB++
    const p = (y * width + x) * 4
    if (different) {
      changed++; minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y)
      pixels[p] = 239; pixels[p + 1] = 68; pixels[p + 2] = 68; pixels[p + 3] = 255
    } else {
      // A light grayscale context keeps red differences legible on light and dark source images.
      const grey = (b.data[bi] * 0.299 + b.data[bi + 1] * 0.587 + b.data[bi + 2] * 0.114) * b.data[bi + 3] / 255 + 255 - b.data[bi + 3]
      pixels[p] = pixels[p + 1] = pixels[p + 2] = Math.round(180 + grey * 75 / 255); pixels[p + 3] = 255
    }
  }
  return { pixels, layout, stats: { compared: overlap + onlyA + onlyB, changed, overlap, onlyA, onlyB, bounds: changed ? { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 } : null } satisfies DiffStats }
}
