// @vitest-environment node
import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { decodePDFRawStream, PDFArray, PDFDict, PDFDocument, PDFName, PDFNumber, PDFRawStream, PDFString, StandardFonts } from "pdf-lib"
import sharp from "sharp"
import { beforeAll, describe, expect, it } from "vitest"
import { composePdfs, createPdfSample, imagesToPdf, inspectPdfs, parsePdfSelection, pdfImageDimensions, pdfNumberPlacement, type PdfSource } from "./pdf-tools"

let sample: PdfSource
beforeAll(async () => { sample = { name: "sample.pdf", bytes: await createPdfSample() } })
async function formSource(): Promise<PdfSource> {
  const document = await PDFDocument.create(), font = await document.embedFont(StandardFonts.Helvetica)
  const first = document.addPage([420, 594]), second = document.addPage([420, 594])
  first.drawText("Interactive name field", { x: 36, y: 520, font, size: 18 })
  second.drawText("Interactive checkbox", { x: 36, y: 520, font, size: 18 })
  const name = document.getForm().createTextField("name"); name.setText("Ada"); name.addToPage(first, { x: 36, y: 450, width: 240, height: 36 })
  const agree = document.getForm().createCheckBox("agree"); agree.addToPage(second, { x: 36, y: 450, width: 24, height: 24 }); agree.check()
  return { name: "form.pdf", bytes: await document.save() }
}
async function orientedImages(): Promise<PdfSource[]> {
  const width = 240, height = 160, pixels = new Uint8Array(width * height * 3)
  const colors = [[220, 45, 45], [30, 165, 70], [35, 80, 210], [240, 205, 35]]
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) pixels.set(colors[(y >= height / 2 ? 2 : 0) + (x >= width / 2 ? 1 : 0)], (y * width + x) * 3)
  const images: PdfSource[] = []
  for (let orientation = 1; orientation <= 8; orientation++) images.push({ name: `orientation-${orientation}.jpg`, bytes: await sharp(pixels, { raw: { width, height, channels: 3 } }).withMetadata({ orientation }).jpeg({ quality: 95 }).toBuffer() })
  return images
}

describe("PDF page operations", () => {
  it("parses ordered, reversed and repeated page selections", () => {
    expect(parsePdfSelection("3,1-2,2", 3)).toEqual([2, 0, 1, 1])
    expect(parsePdfSelection("3-1", 3)).toEqual([2, 1, 0]); expect(parsePdfSelection("", 3)).toEqual([0, 1, 2])
    for (const value of ["0", "4", "1,,2", "-1", "1-4"]) expect(() => parsePdfSelection(value, 3)).toThrow("invalidSelection")
  })
  it("inspects and reorders pages with nonzero crop origins and original rotation", async () => {
    const [info] = await inspectPdfs([sample])
    expect(info.pages).toHaveLength(3); expect(info.pages[1]).toMatchObject({ rotation: 90, width: 400, height: 600 })
    const result = await composePdfs([sample], { selection: "3,1,2", rotation: 90 })
    const output = await PDFDocument.load(result.files[0].bytes)
    expect(output.getPages().map((page) => page.getRotation().angle)).toEqual([90, 90, 180])
    expect(output.getPage(2).getCropBox()).toEqual({ x: 70, y: 120, width: 600, height: 400 })
  })
  it("merges interleaved pages and keeps repeated pages independent", async () => {
    const result = await composePdfs([sample, sample], { pages: [{ source: 1, page: 2 }, { source: 0, page: 0, rotation: 90 }, { source: 1, page: 2, rotation: 180 }] })
    const output = await PDFDocument.load(result.files[0].bytes)
    expect(output.getPages().map((page) => page.getRotation().angle)).toEqual([0, 90, 180])
    expect(new Set(output.getPages().map((page) => page.ref.toString())).size).toBe(3)
  })
  it("adds only the current page number when copies share original content streams", async () => {
    const result = await composePdfs([sample], { selection: "1,1,1,1", numbering: { enabled: true } })
    const document = await PDFDocument.load(result.files[0].bytes)
    document.getPages().forEach((page, index) => {
      const contents = page.node.Contents()!
      const streams = contents instanceof PDFArray ? contents.asArray().map((reference) => document.context.lookup(reference) as PDFRawStream) : [contents as PDFRawStream]
      const text = streams.map((stream) => new TextDecoder().decode(decodePDFRawStream(stream).decode())).join("\n")
      const labels = [...text.matchAll(/<([\da-f]+)>\s*Tj/gi)].map((match) => Buffer.from(match[1], "hex").toString("latin1")).filter((value) => /\d \/ 4/.test(value))
      expect(labels).toEqual([`${index + 1} / 4`])
    })
  })
  it("splits selected pages into bounded groups", async () => {
    const result = await composePdfs([sample], { selection: "3-1", splitEvery: 2, numbering: { enabled: true } })
    expect(result.files.map((file) => [file.name, file.pages])).toEqual([["part-001.pdf", 2], ["part-002.pdf", 1]])
    expect((await PDFDocument.load(result.files[1].bytes)).getPageCount()).toBe(1)
    await expect(composePdfs([sample], { pages: [{ source: 0, page: 3 }] })).rejects.toThrow("invalidSelection")
  })
  it("preserves interactive fields on complete reordering and only flattens on explicit request", async () => {
    const source = await formSource()
    const result = await composePdfs([source], { selection: "2,1", rotation: 90, numbering: { enabled: true } })
    expect(result.retainedForms).toBe(true)
    const output = await PDFDocument.load(result.files[0].bytes), form = output.getForm()
    expect(form.getTextField("name").getText()).toBe("Ada"); expect(form.getCheckBox("agree").isChecked()).toBe(true)
    expect(form.getTextField("name").acroField.getWidgets()[0].P()?.toString()).toBe(output.getPage(1).ref.toString())
    await expect(composePdfs([source], { selection: "1" })).rejects.toThrow("flattenRequired")
    const flattened = await composePdfs([source], { selection: "1", flattenForms: true })
    const staticDocument = await PDFDocument.load(flattened.files[0].bytes)
    expect(staticDocument.catalog.has(PDFName.of("AcroForm"))).toBe(false)
    expect(staticDocument.getPage(0).node.Annots()?.size() ?? 0).toBe(0)
    expect(flattened.flattenedForms).toBe(true)
  })
  it("requires an explicit decision before rewriting a PDF with a signature value", async () => {
    const document = await PDFDocument.create(); document.addPage([300, 400])
    const signature = document.context.register(document.context.obj({ FT: PDFName.of("Sig"), T: PDFString.of("signature"), V: document.context.obj({ Type: PDFName.of("Sig"), ByteRange: [0, 0, 0, 0] }) }))
    document.catalog.set(PDFName.of("AcroForm"), document.context.obj({ Fields: [signature] }))
    const source = { name: "signed.pdf", bytes: await document.save({ updateFieldAppearances: false }) }
    await expect(composePdfs([source])).rejects.toThrow("signatureConsent")
    expect((await composePdfs([source], { allowSignatureChanges: true })).changedSignatures).toBe(true)
  })
  it("materializes inherited page resources before moving pages", async () => {
    const document = await PDFDocument.load(sample.bytes), page = document.getPage(0), parent = page.node.Parent()!
    parent.set(PDFName.of("MediaBox"), document.context.obj([0, 0, 595.28, 841.89]))
    parent.set(PDFName.of("Resources"), page.node.Resources()!)
    page.node.delete(PDFName.of("Resources")); page.node.delete(PDFName.of("MediaBox"))
    const output = await composePdfs([{ name: "inherited.pdf", bytes: await document.save() }], { selection: "3,2,1" })
    const reloaded = await PDFDocument.load(output.files[0].bytes)
    expect(reloaded.getPage(2).getWidth()).toBeCloseTo(595.28)
    expect(reloaded.getPage(2).node.Resources()).toBeInstanceOf(PDFDict)
  })
  it("uses visible crop bounds and physical font sizes for UserUnit", async () => {
    const document = await PDFDocument.create(), page = document.addPage([300, 400])
    page.setCropBox(-100, -100, 600, 700); page.node.set(PDFName.of("UserUnit"), PDFNumber.of(2))
    const source = { name: "unit.pdf", bytes: await document.save() }
    expect((await inspectPdfs([source]))[0].pages[0]).toMatchObject({ width: 600, height: 800, userUnit: 2 })
    expect((await composePdfs([source], { numbering: { enabled: true } })).files).toHaveLength(1)
  })
  it("rejects invalid files, unsupported form structures and invalid geometry settings", async () => {
    await expect(inspectPdfs([{ name: "bad.pdf", bytes: new Uint8Array([0]) }])).rejects.toThrow("invalidPdf")
    await expect(composePdfs([sample], { rotation: 45 })).rejects.toThrow("invalidRotation")
    await expect(composePdfs([sample], { numbering: { enabled: true, fontSize: 100 } })).rejects.toThrow("invalidOptions")
    const document = await PDFDocument.create(); document.addPage([300, 400]); document.catalog.set(PDFName.of("AcroForm"), document.context.obj({ XFA: PDFString.of("unsupported"), Fields: [] }))
    await expect(composePdfs([{ name: "xfa.pdf", bytes: await document.save({ updateFieldAppearances: false }) }])).rejects.toThrow("formStructure")
  })
  it("places upright page numbers in all four rotated visible coordinate systems", () => {
    const box = { x: 70, y: 120, width: 600, height: 400 }
    expect(pdfNumberPlacement(box, 0, 30, 10, 18, "bottom-right")).toEqual({ x: 622, y: 138, rotation: 0 })
    expect(pdfNumberPlacement(box, 90, 30, 10, 18, "bottom-right")).toEqual({ x: 652, y: 472, rotation: 90 })
    expect(pdfNumberPlacement(box, 180, 30, 10, 18, "bottom-right")).toEqual({ x: 118, y: 502, rotation: 180 })
    expect(pdfNumberPlacement(box, 270, 30, 10, 18, "bottom-right")).toEqual({ x: 88, y: 168, rotation: 270 })
    expect(() => pdfNumberPlacement({ x: 0, y: 0, width: 10, height: 10 }, 0, 30, 10, 18, "bottom-center")).toThrow("numberDoesNotFit")
  })
})

describe("images to PDF", () => {
  it("handles all eight EXIF orientations without re-encoding JPEG data", async () => {
    const sources = await orientedImages(), result = await imagesToPdf(sources, { pageSize: "image", margin: 0 })
    const output = await PDFDocument.load(result.files[0].bytes)
    expect(output.getPages().map((page) => page.getSize())).toEqual([...Array(4).fill({ width: 180, height: 120 }), ...Array(4).fill({ width: 120, height: 180 })])
  })
  it("embeds PNGs and rejects oversized image dimensions before decoding pixels", async () => {
    const png = await sharp({ create: { width: 32, height: 16, channels: 4, background: { r: 20, g: 100, b: 140, alpha: 0.5 } } }).png().toBuffer()
    expect(pdfImageDimensions(png)).toEqual({ width: 32, height: 16, format: "png" })
    const result = await imagesToPdf([{ name: "image.png", bytes: png }], { pageSize: "letter-landscape", numbering: { enabled: true } })
    expect((await PDFDocument.load(result.files[0].bytes)).getPage(0).getSize()).toEqual({ width: 792, height: 612 })
    const huge = new Uint8Array(png); new DataView(huge.buffer).setUint32(16, 2000000)
    expect(() => pdfImageDimensions(huge)).toThrow("imageLimit")
  })
})

it("writes visual QA proofs when requested", async () => {
  const directory = process.env.PDF_QA_DIR
  if (!directory) return
  await mkdir(directory, { recursive: true })
  const numbered = await composePdfs([sample], { pages: [{ source: 0, page: 0 }, { source: 0, page: 0, rotation: 90 }, { source: 0, page: 1, rotation: 90 }, { source: 0, page: 0, rotation: 270 }], numbering: { enabled: true, position: "bottom-right" } })
  const form = await formSource(), preserved = await composePdfs([form], { selection: "2,1", rotation: 90, numbering: { enabled: true } }), flattened = await composePdfs([form], { selection: "1", flattenForms: true, numbering: { enabled: true } })
  const images = await imagesToPdf(await orientedImages(), { pageSize: "a4", numbering: { enabled: true } })
  for (const [name, bytes] of [["source.pdf", sample.bytes], ["numbered-rotations.pdf", numbered.files[0].bytes], ["forms-preserved.pdf", preserved.files[0].bytes], ["forms-static.pdf", flattened.files[0].bytes], ["images-orientation.pdf", images.files[0].bytes]] as const) await writeFile(path.join(directory, name), bytes)
})
