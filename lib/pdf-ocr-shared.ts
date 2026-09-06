import type { OcrLine, OcrProgress } from "./ocr-shared"
export const PDF_OCR_LIMITS = { pages: 30, pagePixels: 8_000_000, totalPixels: 120_000_000, imageBytes: 60 * 1024 * 1024, textChars: 2_000_000 } as const
export interface PdfOcrPage {
  sourcePage: number
  width: number
  height: number
  pixelWidth: number
  pixelHeight: number
  image: Blob
  preview: Blob
  lines: OcrLine[]
}
export interface PdfOcrProgress { stage: "reading" | "rendering" | "recognizing" | "writing"; completed: number; total: number; sourcePage?: number; ocr?: OcrProgress }
export function pdfOcrText(pages: PdfOcrPage[]) { return pages.map(page => page.lines.map(line => line.text).join("\n")).join("\n\n\f\n\n") }
export function pdfOcrJson(pages: PdfOcrPage[]) {
  return JSON.stringify({ engine: "PaddleOCR PP-OCRv6_small", coordinateSpace: "rendered-page-pixels", pages: pages.map(({ image: _image, preview: _preview, ...page }) => page) }, null, 2)
}
