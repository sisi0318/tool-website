import { checkOcrDimensions, lineBounds, OcrError, type OcrLine } from "./ocr-shared"

export type SensitiveKind = "phone" | "email" | "identity"
export interface RedactRect { x: number; y: number; width: number; height: number }
export interface RedactRegion extends RedactRect { id: string; selected: boolean; source: "auto" | "manual"; text: string; kinds: SensitiveKind[] }
export interface RedactImage { width: number; height: number; preview: Blob; animated: boolean }
export const REDACT_LIMITS = { regions: 2000, outputBytes: 64 * 1024 * 1024, timeout: 60_000 }

/** Candidates only: OCR may omit or misread characters. Never claim complete detection. */
export function sensitiveKinds(text: string): SensitiveKind[] {
  const normalized = text.normalize("NFKC"), kinds: SensitiveKind[] = []
  if (/(?<![\w.])[\w.!#$%&'*+/=?^`{|}~-]+\s*@\s*(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\s*\.\s*)+[a-z]{2,63}(?![\w-])/i.test(normalized)) kinds.push("email")
  if (/(?<!\d)(?:\+?86[\s-]*)?1[3-9](?:[\s-]*\d){9}(?!\d)/.test(normalized) || /(?<![\w\d])\+[1-9](?:[ ()-]*\d){7,14}(?![ ()-]*\d)/.test(normalized)) kinds.push("phone")
  // Deliberately no checksum: a misread check digit should still be offered for review.
  if (/(?<!\d)[1-9]\d{5}(?:18|19|20)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])\d{3}[\dXx](?!\d)/.test(normalized.replace(/\s/g, ""))) kinds.push("identity")
  return kinds
}

/** Expand to complete pixels before painting; reject empty or non-finite geometry. */
export function redactRect(rect: RedactRect, width: number, height: number, padding = 0): RedactRect {
  checkOcrDimensions(width, height)
  if (![rect.x, rect.y, rect.width, rect.height, padding].every(Number.isFinite) || rect.width <= 0 || rect.height <= 0 || padding < 0 || padding > 1000) throw new OcrError("options")
  const x = Math.max(0, Math.floor(rect.x - padding)), y = Math.max(0, Math.floor(rect.y - padding))
  const right = Math.min(width, Math.ceil(rect.x + rect.width + padding)), bottom = Math.min(height, Math.ceil(rect.y + rect.height + padding))
  if (x >= right || y >= bottom) throw new OcrError("options")
  return { x, y, width: right - x, height: bottom - y }
}

export function detectRedactRegions(lines: OcrLine[], width: number, height: number, enabled: SensitiveKind[]): RedactRegion[] {
  checkOcrDimensions(width, height)
  const regions: RedactRegion[] = []
  for (const line of lines) {
    const kinds = sensitiveKinds(line.text).filter(kind => enabled.includes(kind))
    if (!kinds.length || line.poly.length !== 4 || line.poly.some(point => point.some(n => !Number.isFinite(n)))) continue
    const b = lineBounds(line.poly)
    if (b.right <= b.left || b.bottom <= b.top) continue
    const rect = redactRect({ x: b.left, y: b.top, width: b.right - b.left, height: b.bottom - b.top }, width, height, Math.max(3, Math.ceil((b.bottom - b.top) * 0.18)))
    regions.push({ ...rect, id: `auto-${line.id}`, selected: true, source: "auto", text: line.text, kinds })
  }
  if (regions.length > REDACT_LIMITS.regions) throw new OcrError("outputLimit")
  return regions
}

export type RedactRequest = { file: File; action: "prepare" } | { file: File; action: "render"; width: number; height: number; regions: RedactRect[]; color: "black" | "white"; format: "png" | "jpeg" }
export type RedactResult = RedactImage & { output?: File }
