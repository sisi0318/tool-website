import { ImageVectorError, rasterHeader } from "./image-vector-shared"

export const OCR_ROOT = "/ocr/v1"
export const OCR_LIMITS = { fileBytes: 20 * 1024 * 1024, pixels: 20_000_000, side: 32768, timeout: 5 * 60_000, lines: 4000 } as const
export const OCR_LOW_CONFIDENCE = 0.9
export type OcrErrorCode = "fileLimit" | "imageLimit" | "format" | "decode" | "options" | "unsupported" | "model" | "engine" | "cancelled" | "timeout" | "outputLimit"
export class OcrError extends Error { constructor(public code: OcrErrorCode) { super(code); this.name = "OcrError" } }
export interface OcrOptions { rotation: 0 | 90 | 180 | 270; enhanceSmallText: boolean }
export const DEFAULT_OCR_OPTIONS: OcrOptions = { rotation: 0, enhanceSmallText: true }
export type OcrPoint = [number, number]
export interface OcrLine { id: number; text: string; score: number; poly: OcrPoint[] }
export interface OcrInfo { width: number; height: number; rotation: number; tiles: number; elapsedMs: number; animated: boolean }
export interface OcrResult { text: string; lines: OcrLine[]; info: OcrInfo; preview: Blob }
export type OcrProgress = { stage: "reading" | "runtime" | "models" | "recognizing" | "finishing"; completed?: number; total?: number }
export type OcrRequest = { file: File; options: OcrOptions }
export type OcrResponse = { type: "progress"; progress: OcrProgress } | { type: "done"; result: OcrResult } | { type: "error"; code: OcrErrorCode }
export function ocrOptions(input: Partial<OcrOptions> = {}): OcrOptions {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new OcrError("options")
  const options = { ...DEFAULT_OCR_OPTIONS, ...input }
  if (![0, 90, 180, 270].includes(options.rotation) || typeof options.enhanceSmallText !== "boolean") throw new OcrError("options")
  return options
}
export function ocrImageHeader(bytes: Uint8Array) {
  try { return rasterHeader(bytes) } catch (error) { throw new OcrError(error instanceof ImageVectorError ? error.code as OcrErrorCode : "decode") }
}
export function checkOcrDimensions(width: number, height: number) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > OCR_LIMITS.side || height > OCR_LIMITS.side || width * height > OCR_LIMITS.pixels) throw new OcrError("imageLimit")
}
export interface OcrTile { x: number; y: number; width: number; height: number; left: number; top: number; right: number; bottom: number }
function sections(length: number, edge: number, overlap: number) {
  if (length <= edge) return [{ start: 0, end: length, low: 0, high: length }]
  const count = Math.ceil((length - edge) / (edge - overlap)) + 1
  const starts = Array.from({ length: count }, (_, i) => Math.round(i * (length - edge) / (count - 1)))
  return starts.map((start, i) => ({ start, end: start + edge, low: i === 0 ? 0 : (start + starts[i - 1] + edge) / 2, high: i === count - 1 ? length : (starts[i + 1] + start + edge) / 2 }))
}
/** Overlapping crops retain the original pixels of long screenshots. Each center has one owner. */
export function ocrTiles(width: number, height: number): OcrTile[] {
  checkOcrDimensions(width, height)
  return sections(height, 1280, 192).flatMap(y => sections(width, 1920, 256).map(x => ({ x: x.start, y: y.start, width: x.end - x.start, height: y.end - y.start, left: x.low, right: x.high, top: y.low, bottom: y.high })))
}
export function lineBounds(poly: OcrPoint[]) {
  const xs = poly.map(p => p[0]), ys = poly.map(p => p[1])
  return { left: Math.min(...xs), top: Math.min(...ys), right: Math.max(...xs), bottom: Math.max(...ys) }
}
export function mapOcrLine(raw: { text: string; score: number; poly: OcrPoint[] }, tile: OcrTile, scaleX: number, scaleY: number, width: number, height: number): Omit<OcrLine, "id"> | null {
  if (typeof raw.text !== "string" || !raw.text.trim() || !Number.isFinite(raw.score) || !Array.isArray(raw.poly) || raw.poly.length !== 4 || raw.poly.some(p => !Array.isArray(p) || p.length !== 2 || p.some(n => !Number.isFinite(n)))) return null
  const poly: OcrPoint[] = raw.poly.map(([x, y]) => [Math.max(0, Math.min(width, x / scaleX + tile.x)), Math.max(0, Math.min(height, y / scaleY + tile.y))])
  const b = lineBounds(poly), cx = (b.left + b.right) / 2, cy = (b.top + b.bottom) / 2
  if (b.right <= b.left || b.bottom <= b.top || cx < tile.left || cx >= tile.right || cy < tile.top || cy >= tile.bottom) return null
  return { text: raw.text.trim(), score: Math.max(0, Math.min(1, raw.score)), poly }
}
export function orderOcrLines(input: Array<Omit<OcrLine, "id">>): OcrLine[] {
  if (input.length > OCR_LIMITS.lines) throw new OcrError("outputLimit")
  const rows: Array<{ top: number; bottom: number; lines: Array<Omit<OcrLine, "id">> }> = []
  const unique: Array<Omit<OcrLine, "id">> = []
  for (const line of [...input].sort((a, b) => b.score - a.score)) {
    const a = lineBounds(line.poly)
    const duplicate = unique.some(existing => {
      if (existing.text !== line.text) return false
      const b = lineBounds(existing.poly), intersection = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top))
      return intersection / Math.min((a.right - a.left) * (a.bottom - a.top), (b.right - b.left) * (b.bottom - b.top)) > 0.65
    })
    if (!duplicate) unique.push(line)
  }
  for (const line of unique.sort((a, b) => lineBounds(a.poly).top - lineBounds(b.poly).top)) {
    const b = lineBounds(line.poly)
    const row = rows.find(r => Math.min(r.bottom, b.bottom) - Math.max(r.top, b.top) > Math.min(r.bottom - r.top, b.bottom - b.top) * 0.5)
    if (row) row.lines.push(line)
    else rows.push({ top: b.top, bottom: b.bottom, lines: [line] })
  }
  return rows.flatMap(r => r.lines.sort((a, b) => lineBounds(a.poly).left - lineBounds(b.poly).left)).map((line, id) => ({ ...line, id }))
}
export function ocrExport(result: OcrResult, editedText: string) {
  return JSON.stringify({ engine: "PaddleOCR PP-OCRv6_small", coordinateSpace: "rotated-image-pixels", info: result.info, text: editedText, originalText: result.text, lines: result.lines }, null, 2)
}
export function ocrFileName(name: string, extension: "txt" | "json") { return `${name.replace(/\.[^.]*$/, "").replace(/[\\/\u0000-\u001f]/g, "_").trim().slice(0, 100) || "ocr"}.${extension}` }
