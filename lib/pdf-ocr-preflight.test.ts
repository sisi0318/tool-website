// @vitest-environment node
import { PDFDocument, PDFName } from "pdf-lib"
import sharp from "sharp"
import { describe, expect, it } from "vitest"
import { preflightPdfOcr } from "./pdf-ocr-preflight"

async function scanPdf(oversized: boolean, softMask = false) {
  const pdf = await PDFDocument.create()
  const image = await pdf.embedPng(await sharp({ create: { width: 400, height: 300, channels: 3, background: "#bde3ff" } }).png().toBuffer())
  pdf.addPage([400, 300]).drawImage(image, { x: 0, y: 0, width: 400, height: 300 })
  if (oversized) {
    const large = pdf.context.register(pdf.context.stream(new Uint8Array([0]), { Type: "XObject", Subtype: "Image", Width: 5000, Height: 5000, BitsPerComponent: 8, ColorSpace: "DeviceGray" }))
    const second = pdf.addPage([400, 300])
    const target = softMask ? pdf.context.register(pdf.context.stream(new Uint8Array([0]), { Type: "XObject", Subtype: "Image", Width: 1, Height: 1, BitsPerComponent: 8, ColorSpace: "DeviceGray", SMask: large })) : large
    const form = pdf.context.register(pdf.context.stream(new Uint8Array(), { Type: "XObject", Subtype: "Form", BBox: [0, 0, 400, 300], Resources: { XObject: { Scan: target } } }))
    second.node.set(PDFName.of("Resources"), pdf.context.obj({ XObject: { Nested: form } }))
  }
  return { name: "scan.pdf", bytes: await pdf.save() }
}

describe("PDF OCR image preflight", () => {
  it("accepts a valid normal scan without decoding image pixels", async () => {
    await expect(preflightPdfOcr(await scanPdf(false), "")).resolves.toBeUndefined()
  })
  it("rejects oversized images nested in a selected form while allowing other selected pages", async () => {
    const source = await scanPdf(true)
    await expect(preflightPdfOcr(source, "1")).resolves.toBeUndefined()
    await expect(preflightPdfOcr(source, "2")).rejects.toMatchObject({ code: "sourceImageLimit" })
  })
  it("also checks oversized image soft masks", async () => {
    await expect(preflightPdfOcr(await scanPdf(true, true), "2")).rejects.toMatchObject({ code: "sourceImageLimit" })
  })
})
