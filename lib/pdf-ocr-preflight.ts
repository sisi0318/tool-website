import { PDFArray, PDFDict, PDFDocument, PDFName, PDFNumber, PDFObject, PDFRawStream, PDFRef, PDFStream } from "pdf-lib"
import { PDF_LIMITS, PdfToolError, parsePdfSelection, type PdfSource } from "./pdf-shared"
import { PDF_OCR_LIMITS } from "./pdf-ocr-shared"
import { decodeOcrContent, rejectInlineImages } from "./pdf-ocr-content"

/** Inspect image metadata without decoding pixels. PDF.js can resolve rendering
 * after dropping an oversized XObject, even with stopAtErrors enabled. */
export async function preflightPdfOcr(source: PdfSource, selection: string): Promise<void> {
  if (!source.bytes.length || source.bytes.length > PDF_LIMITS.inputBytes) throw new PdfToolError("inputLimit")
  let pdf: PDFDocument
  try { pdf = await PDFDocument.load(source.bytes, { updateMetadata: false, throwOnInvalidObject: true }) }
  catch (error) { throw new PdfToolError(error instanceof Error && /encrypt/i.test(error.message) ? "encrypted" : "invalidPdf") }
  const selected = parsePdfSelection(selection, pdf.getPageCount())
  if (selected.length > PDF_OCR_LIMITS.pages) throw new PdfToolError("pageLimit")
  const pending: PDFObject[] = [], visited = new Set<PDFObject>()
  const content: Array<{ value: PDFObject; join: boolean }> = []
  for (const index of selected) {
    const page = pdf.getPage(index)
    const resources = page.node.getInheritableAttribute(PDFName.of("Resources")), annotations = page.node.Annots()
    if (resources) pending.push(resources)
    if (annotations) pending.push(annotations)
    const contents = page.node.Contents()
    if (contents) content.push({ value: contents, join: true })
  }
  while (pending.length) {
    const raw = pending.pop()!, value = raw instanceof PDFRef ? pdf.context.lookup(raw) : raw
    if (!value || visited.has(value)) continue
    visited.add(value)
    if (visited.size > 100_000) throw new PdfToolError("invalidPdf")
    const dict = value instanceof PDFStream ? value.dict : value instanceof PDFDict ? value : undefined
    if (dict) {
      if (value instanceof PDFStream && (dict.lookupMaybe(PDFName.of("Subtype"), PDFName) === PDFName.of("Form") || dict.lookupMaybe(PDFName.of("PatternType"), PDFNumber)?.asNumber() === 1)) content.push({ value, join: false })
      if (dict.lookupMaybe(PDFName.of("Subtype"), PDFName) === PDFName.of("Image")) {
        const width = dict.lookupMaybe(PDFName.of("Width"), PDFNumber)?.asNumber(), height = dict.lookupMaybe(PDFName.of("Height"), PDFNumber)?.asNumber()
        if (!width || !height || !Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1) throw new PdfToolError("invalidImage")
        if (width * height > PDF_LIMITS.imagePixels) throw new PdfToolError("sourceImageLimit")
      }
      // Annotation back-references must not pull unselected pages into the scan.
      for (const [key, child] of dict.entries()) {
        if (key === PDFName.of("AP") || key === PDFName.of("CharProcs")) content.push({ value: child, join: false })
        if (key !== PDFName.of("P") && key !== PDFName.of("Parent")) pending.push(child)
      }
    } else if (value instanceof PDFArray) pending.push(...value.asArray())
  }
  const budget = { bytes: 0 }, decoded = new Map<PDFRawStream, Uint8Array>()
  for (const root of content) {
    const todo = [root.value], pieces: Uint8Array[] = []
    let objects = 0, length = 0
    while (todo.length) {
      if (++objects > 100_000) throw new PdfToolError("invalidPdf")
      const raw = todo.pop()!, object = raw instanceof PDFRef ? pdf.context.lookup(raw) : raw
      if (object instanceof PDFRawStream) {
        let bytes = decoded.get(object)
        if (!bytes) { bytes = decodeOcrContent(object, budget); decoded.set(object, bytes) }
        if (root.join) { length += bytes.length; if (length > 32 * 1024 * 1024) throw new PdfToolError("contentLimit"); pieces.push(bytes) }
        else rejectInlineImages(bytes)
      } else if (object instanceof PDFArray) todo.push(...object.asArray().reverse())
      else if (object instanceof PDFDict) todo.push(...object.values())
      else throw new PdfToolError("invalidPdf")
    }
    if (root.join) {
      const bytes = new Uint8Array(length); let offset = 0
      for (const piece of pieces) { bytes.set(piece, offset); offset += piece.length }
      rejectInlineImages(bytes)
    }
  }
}
