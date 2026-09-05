export const PDF_LIMITS = { inputBytes: 64 * 1024 * 1024, outputBytes: 64 * 1024 * 1024, files: 20, pages: 500, outputs: 100, imagePixels: 20_000_000 } as const
export class PdfToolError extends Error {
  constructor(public code: "inputLimit" | "outputLimit" | "pageLimit" | "invalidPdf" | "encrypted" | "invalidSelection" | "invalidRotation" | "invalidOptions" | "formStructure" | "flattenRequired" | "signatureConsent" | "numberDoesNotFit" | "invalidImage" | "imageLimit" | "cancelled" | "timeout" | "workerFailed", public detail = "") { super([code, detail].filter(Boolean).join(": ")); this.name = "PdfToolError" }
}
export interface PdfSource { name: string; bytes: Uint8Array }
export interface PdfPageInfo { page: number; width: number; height: number; rotation: number; userUnit: number }
export interface PdfInfo { name: string; pages: PdfPageInfo[]; formFields: number; signed: boolean; outlines: boolean; unsupportedForm: boolean }
export interface PdfPageReference { source: number; page: number; rotation?: number }
export interface PdfNumbering { enabled: boolean; position?: "bottom-center" | "bottom-right" | "top-right"; fontSize?: number; margin?: number; total?: boolean }
export interface PdfComposeOptions { pages?: PdfPageReference[]; selection?: string; rotation?: number; splitEvery?: number; numbering?: PdfNumbering; flattenForms?: boolean; allowSignatureChanges?: boolean }
export interface PdfOutput { name: string; bytes: Uint8Array; pages: number }
export interface PdfComposition { files: PdfOutput[]; pages: number; flattenedForms: boolean; retainedForms: boolean; droppedOutlines: boolean; changedSignatures: boolean }
export interface PdfProgress { stage: "reading" | "writing" | "images"; completed: number; total: number }
export interface PdfImageOptions { pageSize?: "a4" | "a4-landscape" | "letter" | "letter-landscape" | "image"; margin?: number; numbering?: PdfNumbering }
export type PdfProgressCallback = (progress: PdfProgress) => void

export function pdfRotation(rotation: number): number {
  if (!Number.isFinite(rotation) || rotation % 90 !== 0) throw new PdfToolError("invalidRotation")
  return (rotation % 360 + 360) % 360
}
export function parsePdfSelection(selection: string, count: number): number[] {
  if (!Number.isInteger(count) || count < 1 || count > PDF_LIMITS.pages || selection.length > 10000) throw new PdfToolError("invalidSelection")
  if (!selection.trim()) return Array.from({ length: count }, (_, index) => index)
  const pages: number[] = []
  for (const token of selection.split(",")) {
    const match = /^\s*(\d+)(?:\s*-\s*(\d+))?\s*$/.exec(token)
    if (!match) throw new PdfToolError("invalidSelection")
    const first = Number(match[1]), last = Number(match[2] ?? match[1])
    if (!Number.isInteger(first) || !Number.isInteger(last) || first < 1 || first > count || last < 1 || last > count || pages.length + Math.abs(last - first) + 1 > PDF_LIMITS.pages) throw new PdfToolError("invalidSelection")
    const step = first <= last ? 1 : -1
    for (let page = first; ; page += step) { pages.push(page - 1); if (page === last) break }
  }
  return pages
}
