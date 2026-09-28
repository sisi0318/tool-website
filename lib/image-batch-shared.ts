import type { OcrOptions, OcrResult } from "./ocr-shared"
import { ocrExport } from "./ocr-shared"
export const IMAGE_BATCH_LIMITS = { files: 30, inputBytes: 120 * 1024 * 1024, outputBytes: 120 * 1024 * 1024, fileOutputBytes: 64 * 1024 * 1024 } as const
export type BatchErrorCode = "fileLimit" | "queueLimit" | "options" | "outputLimit" | "unsupported" | "convert" | "cancelled" | "timeout"
export class ImageBatchError extends Error { constructor(public code: BatchErrorCode) { super(code); this.name = "ImageBatchError" } }
/** auto：JPEG、WebP 保持原格式，PNG 改用 WebP（图片压缩页的“自动优化”） */
export type BatchImageFormat = "jpeg" | "png" | "webp" | "auto"
export interface ImageBatchOptions { mode: "ocr" | "images"; format: BatchImageFormat; quality: number; maxWidth: number; maxHeight: number; rotation: OcrOptions["rotation"]; enhanceSmallText: boolean }
export const DEFAULT_BATCH_OPTIONS: ImageBatchOptions = { mode: "ocr", format: "webp", quality: 82, maxWidth: 0, maxHeight: 0, rotation: 0, enhanceSmallText: true }
export function batchOptions(input: Partial<ImageBatchOptions> = {}): ImageBatchOptions {
  const value = { ...DEFAULT_BATCH_OPTIONS, ...input }
  if (!["ocr", "images"].includes(value.mode) || !["jpeg", "png", "webp", "auto"].includes(value.format) || !Number.isFinite(value.quality) || value.quality < 10 || value.quality > 100 || ![value.maxWidth, value.maxHeight].every(n => Number.isInteger(n) && n >= 0 && n <= 32768) || ![0, 90, 180, 270].includes(value.rotation) || typeof value.enhanceSmallText !== "boolean") throw new ImageBatchError("options")
  return value
}
export interface BatchImageResult { files: File[]; width: number; height: number; sourceWidth?: number; sourceHeight?: number; animated: boolean; text?: string; ocr?: OcrResult; preview?: Blob }
export interface BatchImageJob { id: string; file: File; base: string; status: "ready" | "running" | "done" | "error"; result?: BatchImageResult; error?: string }

/** Portable, stable stems prevent collisions across source extensions and retries. */
export function uniqueImageBase(name: string, used: Set<string>): string {
  const dot = name.lastIndexOf("."), stem = dot > 0 ? name.slice(0, dot) : name
  let base = Array.from(stem.normalize("NFC").replace(/[<>:"/\\|?*\u0000-\u001f\u007f]/g, "_").replace(/^[. ]+|[. ]+$/g, "")).slice(0, 70).join("") || "image"
  while (new TextEncoder().encode(base).length > 180) base = Array.from(base).slice(0, -1).join("")
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(base)) base = "_" + base
  let candidate = base, number = 2
  while (used.has(candidate.toLowerCase())) candidate = `${base}-${number++}`
  used.add(candidate.toLowerCase()); return candidate
}
export function batchOcrResult(ocr: OcrResult, base: string, text = ocr.text): BatchImageResult {
  return { width: ocr.info.width, height: ocr.info.height, animated: ocr.info.animated, ocr, text, preview: ocr.preview, files: [new File([text], `${base}.txt`, { type: "text/plain;charset=utf-8" }), new File([ocrExport(ocr, text)], `${base}.json`, { type: "application/json" })] }
}
export function batchResultBytes(result?: BatchImageResult) { return result?.files.reduce((size, file) => size + file.size, 0) ?? 0 }
export function batchCombinedText(jobs: BatchImageJob[]) { return jobs.filter(job => job.status === "done" && job.result?.text !== undefined).map(job => `--- ${job.file.name.replace(/[\r\n]/g, " ")} ---\n${job.result!.text}`).join("\n\n") }

/**
 * 按选项编码一张图。auto 时 JPEG、WebP 保持原格式，PNG 改用 WebP；
 * 浏览器编不了 WebP（部分 Safari）时退回 PNG，而不是整张失败——以前主线程的 canvas 就是这样退回的。
 */
export async function convertBatchFormat<T>(sourceMime: string, format: BatchImageFormat, convert: (format: "jpeg" | "png" | "webp") => Promise<T>): Promise<T> {
  const target = format === "auto" ? (sourceMime === "image/jpeg" ? "jpeg" : "webp") : format
  try { return await convert(target) }
  catch (error) {
    if (format !== "auto" || target === "png" || !(error instanceof Error && /NOT_SUPPORTED/.test(error.message))) throw error
    return convert("png")
  }
}
