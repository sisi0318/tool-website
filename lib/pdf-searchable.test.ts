// @vitest-environment node
import { mkdir, writeFile } from "node:fs/promises"
import sharp from "sharp"
import { describe, expect, it } from "vitest"
import { searchablePdf } from "./pdf-searchable"
import { pdfOcrText, type PdfOcrPage } from "./pdf-ocr-shared"

async function page(text = "中文识别 Hello 1,280.50 𠮷 🙂"): Promise<PdfOcrPage> {
  const png = await sharp({ create: { width: 600, height: 400, channels: 3, background: "#fff" } }).composite([{ input: Buffer.from('<svg width="600" height="400"><rect x="30" y="20" width="540" height="80" fill="#d9e8d0"/><text x="50" y="65" font-size="22">PDF OCR visual check 1280.50</text><rect x="30" y="150" width="200" height="120" fill="#29563a"/></svg>') }]).png().toBuffer()
  const image = new Blob([new Uint8Array(png)], { type: "image/png" })
  return { sourcePage: 1, width: 300, height: 200, pixelWidth: 600, pixelHeight: 400, image, preview: image, lines: [{ id: 0, text, score: .98, poly: [[50, 43], [520, 43], [520, 67], [50, 67]] }] }
}
describe("searchable scan PDF", () => {
  it("extracts CJK, non-BMP Unicode, punctuation and more than 255 distinct characters in PDF.js", async () => {
    const first = await page(), alphabet = Array.from({ length: 320 }, (_, i) => String.fromCodePoint(0x4e00 + i)).join("")
    const second = await page(alphabet), bytes = await searchablePdf([first, second, { ...first, lines: [] }])
    const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs")
    const loading = getDocument({ data: bytes }), document = await loading.promise
    try {
      expect(document.numPages).toBe(3)
      const content = await (await document.getPage(1)).getTextContent()
      expect(content.items.map(item => "str" in item ? item.str : "").join("")).toBe(first.lines[0].text)
      const next = await (await document.getPage(2)).getTextContent()
      expect(next.items.map(item => "str" in item ? item.str : "").join("")).toBe(alphabet)
      expect((await (await document.getPage(3)).getTextContent()).items).toHaveLength(0)
      const textItem = content.items.find(item => "str" in item && item.str.startsWith("中文"))!
      expect("transform" in textItem && textItem.transform.slice(4)).toEqual([25, 168.9])
    } finally { await loading.destroy() }
  })
  it("exports reviewed text in order and creates samples for independent rendering", async () => {
    const original = await page(), corrected = { ...original, lines: original.lines.map(line => ({ ...line, text: "已校对 Corrected 1280.50" })) }
    expect(pdfOcrText([original, corrected])).toContain("\f")
    expect(pdfOcrText([corrected])).toBe("已校对 Corrected 1280.50")
    await mkdir("tmp/pdfs", { recursive: true })
    await writeFile("tmp/pdfs/ocr-text-layer.pdf", await searchablePdf([original, { ...corrected, width: 400, height: 200 }]))
    await writeFile("tmp/pdfs/ocr-image-only.pdf", await searchablePdf([{ ...original, lines: [] }, { ...corrected, width: 400, height: 200, lines: [] }]))
  })
  it("rejects invalid page geometry, malformed polygons and image mismatches", async () => {
    const original = await page()
    await expect(searchablePdf([])).rejects.toMatchObject({ code: "pageLimit" })
    await expect(searchablePdf([{ ...original, width: Infinity }])).rejects.toMatchObject({ code: "imageLimit" })
    await expect(searchablePdf([{ ...original, pixelWidth: 500 }])).rejects.toMatchObject({ code: "invalidImage" })
    await expect(searchablePdf([{ ...original, lines: [{ ...original.lines[0], poly: [[NaN, 1]] }] }])).rejects.toMatchObject({ code: "invalidOptions" })
  })
})
