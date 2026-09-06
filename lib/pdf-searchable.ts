import { PDFDocument, PDFHexString, PDFName, beginText, endText, setFontAndSize, setTextMatrix, setTextRenderingMode, showText, TextRenderingMode, type PDFRef } from "pdf-lib"
import { PDF_LIMITS, PdfToolError, pdfImageDimensions } from "./pdf-shared"
import { PDF_OCR_LIMITS, type PdfOcrPage } from "./pdf-ocr-shared"

function hex(value: number, length: number) { return value.toString(16).padStart(length, "0").toUpperCase() }
function unicodeHex(value: string) { return Array.from({ length: value.length }, (_, i) => hex(value.charCodeAt(i), 4)).join("") }

/** A blank Type 3 font with a Unicode mapping needs no downloaded CJK font.
 * Geometry stays selectable; Tr=3 and empty glyph procedures never paint over the scan. */
function textFonts(pdf: PDFDocument, text: string) {
  const characters = [...new Set(Array.from(text))], map = new Map<string, { font: number; code: number }>(), fonts: PDFRef[] = []
  const blank = pdf.context.register(pdf.context.flateStream("1000 0 0 -200 1000 800 d1\n"))
  for (let offset = 0; offset < characters.length; offset += 255) {
    const group = characters.slice(offset, offset + 255), glyphs: Record<string, PDFRef> = {}
    const entries = group.map((character, i) => { glyphs[`g${i + 1}`] = blank; map.set(character, { font: fonts.length, code: i + 1 }); return `<${hex(i + 1, 2)}> <${unicodeHex(character)}>` })
    const chunks: string[] = []
    for (let i = 0; i < entries.length; i += 100) { const chunk = entries.slice(i, i + 100); chunks.push(`${chunk.length} beginbfchar\n${chunk.join("\n")}\nendbfchar`) }
    const cmap = `/CIDInit /ProcSet findresource begin\n12 dict begin\nbegincmap\n/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def\n/CMapName /OCRUnicode${fonts.length} def\n/CMapType 2 def\n1 begincodespacerange\n<00> <FF>\nendcodespacerange\n${chunks.join("\n")}\nendcmap\nCMapName currentdict /CMap defineresource pop\nend\nend`
    fonts.push(pdf.context.register(pdf.context.obj({ Type: "Font", Subtype: "Type3", Name: `OCR${fonts.length}`, FontBBox: [0, -200, 1000, 800], FontMatrix: [.001, 0, 0, .001, 0, 0], CharProcs: glyphs, Resources: {}, Encoding: { Type: "Encoding", Differences: [1, ...group.map((_, i) => PDFName.of(`g${i + 1}`))] }, FirstChar: 1, LastChar: group.length, Widths: group.map(() => 1000), ToUnicode: pdf.context.register(pdf.context.flateStream(cmap)) })))
  }
  return { fonts, map }
}

export async function searchablePdf(pages: PdfOcrPage[]): Promise<Uint8Array<ArrayBuffer>> {
  if (!pages.length || pages.length > PDF_OCR_LIMITS.pages) throw new PdfToolError("pageLimit")
  if (pages.reduce((sum, p) => sum + p.image.size, 0) > PDF_OCR_LIMITS.imageBytes) throw new PdfToolError("outputLimit")
  let length = 0
  for (const p of pages) for (const line of p.lines) {
    length += line.text.length
    if (length > PDF_OCR_LIMITS.textChars || line.text.includes("\u0000")) throw new PdfToolError("outputLimit")
    if (line.poly.length !== 4 || line.poly.some(point => point.length !== 2 || point.some(n => !Number.isFinite(n)))) throw new PdfToolError("invalidOptions")
  }
  const pdf = await PDFDocument.create()
  pdf.setProducer("Tool Station · local PDF OCR"); pdf.setCreator("Tool Station")
  const { fonts, map } = textFonts(pdf, pages.flatMap(p => p.lines.map(l => l.text)).join(""))
  for (const source of pages) {
    if (![source.width, source.height, source.pixelWidth, source.pixelHeight].every(v => Number.isFinite(v) && v > 0) || source.width > 14400 || source.height > 14400 || source.pixelWidth * source.pixelHeight > PDF_OCR_LIMITS.pagePixels) throw new PdfToolError("imageLimit")
    const bytes = new Uint8Array(await source.image.arrayBuffer()), info = pdfImageDimensions(bytes)
    if (info.width !== source.pixelWidth || info.height !== source.pixelHeight) throw new PdfToolError("invalidImage")
    const image = info.format === "png" ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes)
    const page = pdf.addPage([source.width, source.height]), names = fonts.map(ref => page.node.newFontDictionary("OCR", ref))
    page.drawImage(image, { x: 0, y: 0, width: source.width, height: source.height })
    for (const line of source.lines) {
      const characters = Array.from(line.text)
      if (!characters.length) continue
      const [tl, tr, , bl] = line.poly.map(([x, y]) => [Math.max(0, Math.min(source.pixelWidth, x)) * source.width / source.pixelWidth, source.height - Math.max(0, Math.min(source.pixelHeight, y)) * source.height / source.pixelHeight])
      const a = (tr[0] - tl[0]) / characters.length, b = (tr[1] - tl[1]) / characters.length, c = tl[0] - bl[0], d = tl[1] - bl[1]
      if (Math.hypot(a, b) < .001 || Math.hypot(c, d) < .001) continue
      page.pushOperators(beginText(), setTextRenderingMode(TextRenderingMode.Invisible), setTextMatrix(a, b, c, d, bl[0] + c * .2, bl[1] + d * .2))
      let run = "", font = -1
      const flush = () => { if (run) page.pushOperators(setFontAndSize(names[font], 1), showText(PDFHexString.of(run))) }
      for (const character of characters) {
        const entry = map.get(character)!
        if (font !== entry.font) { flush(); font = entry.font; run = "" }
        run += hex(entry.code, 2)
      }
      flush(); page.pushOperators(endText())
    }
  }
  const bytes = await pdf.save()
  if (bytes.length > PDF_LIMITS.outputBytes) throw new PdfToolError("outputLimit")
  return new Uint8Array(bytes)
}
