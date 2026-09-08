// @vitest-environment node
import { PDFDocument, PDFName, PDFRawStream } from "pdf-lib"
import { describe, expect, it } from "vitest"
import { rejectInlineImages } from "./pdf-ocr-content"
import { preflightPdfOcr } from "./pdf-ocr-preflight"

const bytes = (text: string) => new TextEncoder().encode(text)
async function source(parts: string[], compressed = true, location: "page" | "form" | "appearance" = "page", unsupported = false) {
  const pdf = await PDFDocument.create(), page = pdf.addPage([100, 100])
  const refs = parts.map(text => pdf.context.register(compressed ? pdf.context.flateStream(bytes(text)) : pdf.context.stream(bytes(text), unsupported ? { Filter: "ASCIIHexDecode" } : {})))
  if (location === "page") page.node.set(PDFName.of("Contents"), pdf.context.obj(refs))
  else if (location === "appearance") page.node.set(PDFName.of("Annots"), pdf.context.obj([pdf.context.register(pdf.context.obj({ Type: "Annot", Subtype: "Stamp", Rect: [0, 0, 100, 100], AP: { N: refs[0] } }))]))
  else {
    const stream = pdf.context.lookup(refs[0])
    if (!(stream instanceof PDFRawStream)) throw new Error("Expected a raw content stream")
    stream.dict.set(PDFName.of("Subtype"), PDFName.of("Form"))
    page.node.set(PDFName.of("Resources"), pdf.context.obj({ XObject: { Form: refs[0] } }))
  }
  return { name: "content.pdf", bytes: await pdf.save() }
}
describe("bounded PDF content inspection", () => {
  it("ignores BI in strings, escaped nested strings, comments, names and hex data", () => {
    expect(() => rejectInlineImages(bytes("(BI (nested\\) BI) end) Tj % BI\r\n /BI /B#49 <4249> << /Label (BI) >> q Q"))).not.toThrow()
    expect(() => rejectInlineImages(bytes("q BI /W 1 /H 1 ID x EI Q"))).toThrow("unsupportedInline")
  })
  it("rejects small and large inline images in plain and compressed page content", async () => {
    for (const compressed of [false, true]) for (const side of [1, 5000]) await expect(preflightPdfOcr(await source([`BI /W ${side} /H ${side} ID x EI`], compressed), "")).rejects.toMatchObject({ code: "unsupportedInline" })
  })
  it("checks forms, appearance streams and operators split across content streams", async () => {
    for (const location of ["form", "appearance"] as const) await expect(preflightPdfOcr(await source(["BI /W 1 /H 1 ID x EI"], true, location), "")).rejects.toMatchObject({ code: "unsupportedInline" })
    await expect(preflightPdfOcr(await source(["B", "I /W 1 /H 1 ID x EI"]), "")).rejects.toMatchObject({ code: "unsupportedInline" })
  })
  it("refuses unsupported filters and stops excessive stream or total expansion", async () => {
    await expect(preflightPdfOcr(await source(["71"], false, "page", true), "")).rejects.toMatchObject({ code: "unsupportedContent" })
    await expect(preflightPdfOcr(await source([" ".repeat(8 * 1024 * 1024 + 1)]), "")).rejects.toMatchObject({ code: "contentLimit" })
    await expect(preflightPdfOcr(await source(Array.from({ length: 5 }, () => " ".repeat(7 * 1024 * 1024))), "")).rejects.toMatchObject({ code: "contentLimit" })
  })
})
