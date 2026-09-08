import { Unzlib } from "fflate"
import { PDFArray, PDFDict, PDFName, PDFNumber, PDFRawStream, type PDFObject } from "pdf-lib"
import { PdfToolError } from "./pdf-shared"

export const PDF_OCR_CONTENT_LIMITS = { streamBytes: 8 * 1024 * 1024, totalBytes: 32 * 1024 * 1024 }

/** PDF lexical tokens: BI inside strings, hex strings, names or comments is data. */
export function rejectInlineImages(bytes: Uint8Array) {
  const white = (c: number) => c === 0 || c === 9 || c === 10 || c === 12 || c === 13 || c === 32
  const delimiter = (c: number) => white(c) || [40, 41, 60, 62, 91, 93, 123, 125, 47, 37].includes(c)
  for (let i = 0; i < bytes.length;) {
    const c = bytes[i]
    if (white(c)) { i++; continue }
    if (c === 37) { while (i < bytes.length && bytes[i] !== 10 && bytes[i] !== 13) i++; continue }
    if (c === 47) { i++; while (i < bytes.length && !delimiter(bytes[i])) i++; continue }
    if (c === 40) {
      let depth = 1; i++
      while (i < bytes.length && depth) {
        if (bytes[i] === 92) { i += 2; continue }
        if (bytes[i] === 40) depth++
        else if (bytes[i] === 41) depth--
        i++
      }
      if (depth) throw new PdfToolError("invalidPdf")
      continue
    }
    if (c === 60 && bytes[i + 1] !== 60) {
      while (++i < bytes.length && bytes[i] !== 62) { /* hexadecimal string */ }
      if (i === bytes.length) throw new PdfToolError("invalidPdf")
      i++; continue
    }
    if (c === 60 && bytes[i + 1] === 60) { i += 2; continue }
    if (delimiter(c)) { i++; continue }
    const start = i
    while (i < bytes.length && !delimiter(bytes[i])) i++
    if (i - start === 2 && bytes[start] === 66 && bytes[start + 1] === 73) throw new PdfToolError("unsupportedInline")
  }
}

/** Only the common unfiltered/Flate content encoding is accepted for inspection.
 * Small compressed input chunks cap transient inflater output before each check. */
export function decodeOcrContent(stream: PDFRawStream, budget: { bytes: number }): Uint8Array {
  let filter: PDFObject | undefined = stream.dict.lookup(PDFName.of("Filter"))
  if (filter instanceof PDFArray) { if (filter.size() !== 1) throw new PdfToolError("unsupportedContent"); filter = filter.lookup(0) }
  let params = stream.dict.lookup(PDFName.of("DecodeParms"))
  if (params instanceof PDFArray) params = params.lookup(0)
  if (params && params.toString() !== "null" && (!(params instanceof PDFDict) || (params.lookupMaybe(PDFName.of("Predictor"), PDFNumber)?.asNumber() ?? 1) !== 1)) throw new PdfToolError("unsupportedContent")
  const source = stream.getContents(), chunks: Uint8Array[] = []
  let length = 0
  const accept = (chunk: Uint8Array) => {
    length += chunk.length; budget.bytes += chunk.length
    if (length > PDF_OCR_CONTENT_LIMITS.streamBytes || budget.bytes > PDF_OCR_CONTENT_LIMITS.totalBytes) throw new PdfToolError("contentLimit")
    chunks.push(chunk)
  }
  if (!filter || filter.toString() === "null") { accept(source); return source }
  if (filter !== PDFName.of("FlateDecode") && filter !== PDFName.of("Fl")) throw new PdfToolError("unsupportedContent")
  try {
    const inflater = new Unzlib(accept)
    for (let offset = 0; offset < source.length; offset += 1024) inflater.push(source.subarray(offset, offset + 1024), offset + 1024 >= source.length)
    if (!source.length) throw new PdfToolError("invalidPdf")
  } catch (error) { if (error instanceof PdfToolError) throw error; throw new PdfToolError("invalidPdf") }
  const result = new Uint8Array(length)
  let offset = 0
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length }
  return result
}
