import { PDFDocument, PDFArray, PDFDict, PDFName, PDFNumber, PDFSignature, StandardFonts, degrees, rgb, type PDFPage } from "pdf-lib"

import { PDF_LIMITS, PdfToolError, pdfRotation, parsePdfSelection, pdfImageDimensions, type PdfSource, type PdfPageInfo, type PdfInfo, type PdfNumbering, type PdfComposeOptions, type PdfComposition, type PdfOutput, type PdfPageReference, type PdfProgressCallback, type PdfImageOptions } from "./pdf-shared"
export * from "./pdf-shared"

function sourceBudget(sources: PdfSource[]) {
  if (!sources.length || sources.length > PDF_LIMITS.files || sources.reduce((size, source) => size + source.bytes.length, 0) > PDF_LIMITS.inputBytes) throw new PdfToolError("inputLimit")
}
function visiblePdfBox(page: PDFPage) {
  const crop = page.getCropBox(), media = page.getMediaBox()
  const x = Math.max(crop.x, media.x), y = Math.max(crop.y, media.y), width = Math.min(crop.x + crop.width, media.x + media.width) - x, height = Math.min(crop.y + crop.height, media.y + media.height) - y
  return width > 0 && height > 0 ? { x, y, width, height } : media
}
function pageInfo(page: PDFPage, index: number): PdfPageInfo {
  const box = visiblePdfBox(page), rotation = pdfRotation(page.getRotation().angle), userUnit = page.node.lookupMaybe(PDFName.of("UserUnit"), PDFNumber)?.asNumber() ?? 1
  if (![box.x, box.y, box.width, box.height, userUnit].every(Number.isFinite) || box.width <= 0 || box.height <= 0 || userUnit <= 0 || userUnit > 75000) throw new PdfToolError("invalidPdf")
  return { page: index, width: (rotation % 180 ? box.height : box.width) * userUnit, height: (rotation % 180 ? box.width : box.height) * userUnit, rotation, userUnit }
}
function isolatePageContents(page: PDFPage, document: PDFDocument) {
  const contents = page.node.Contents()
  if (contents instanceof PDFArray) page.node.set(PDFName.of("Contents"), contents.clone(document.context))
}
async function loadPdf(source: PdfSource): Promise<{ document: PDFDocument; info: PdfInfo }> {
  let document: PDFDocument
  try { document = await PDFDocument.load(source.bytes, { updateMetadata: false, throwOnInvalidObject: true }) }
  catch (cause) { throw new PdfToolError(cause instanceof Error && /encrypt/i.test(cause.message) ? "encrypted" : "invalidPdf", source.name) }
  const pages = document.getPages()
  if (!pages.length || pages.length > PDF_LIMITS.pages) throw new PdfToolError("pageLimit", source.name)
  for (const page of pages) isolatePageContents(page, document)
  const acro = document.catalog.lookupMaybe(PDFName.of("AcroForm"), PDFDict)
  const xfa = !!acro?.has(PDFName.of("XFA"))
  let formFields = 0, signed = false, widgets = 0, orphanWidget = false
  const knownWidgets = new Set<PDFDict>()
  try {
    if (acro && !xfa) {
      const fields = document.getForm().getFields(); formFields = fields.length
      for (const field of fields) for (const widget of field.acroField.getWidgets()) knownWidgets.add(widget.dict)
      signed = fields.some((field) => field instanceof PDFSignature && field.acroField.dict.has(PDFName.of("V")))
    }
    for (const page of pages) for (const annotation of page.node.Annots()?.asArray() ?? []) {
      const dictionary = document.context.lookupMaybe(annotation, PDFDict)
      if (dictionary?.get(PDFName.of("Subtype")) === PDFName.of("Widget")) { widgets++; if (!knownWidgets.has(dictionary)) orphanWidget = true }
      if (widgets > 10000) throw new PdfToolError("formStructure", source.name)
    }
  } catch { throw new PdfToolError("formStructure", source.name) }
  return { document, info: { name: source.name, pages: pages.map(pageInfo), formFields, signed: signed || document.catalog.has(PDFName.of("Perms")), outlines: document.catalog.has(PDFName.of("Outlines")), unsupportedForm: xfa || orphanWidget || widgets > 0 && !formFields } }
}
export async function inspectPdfs(sources: PdfSource[], onProgress?: PdfProgressCallback): Promise<PdfInfo[]> {
  sourceBudget(sources)
  const infos: PdfInfo[] = []; let pages = 0
  for (let index = 0; index < sources.length; index++) { const { info } = await loadPdf(sources[index]); pages += info.pages.length; if (pages > PDF_LIMITS.pages) throw new PdfToolError("pageLimit"); infos.push(info); onProgress?.({ stage: "reading", completed: index + 1, total: sources.length }) }
  return infos
}

export function pdfNumberPlacement(box: { x: number; y: number; width: number; height: number }, rotation: number, textWidth: number, fontSize: number, margin: number, position: NonNullable<PdfNumbering["position"]>) {
  const angle = pdfRotation(rotation), width = angle % 180 ? box.height : box.width, height = angle % 180 ? box.width : box.height
  if (margin < 0 || fontSize <= 0 || textWidth + margin * 2 > width || fontSize + margin * 2 > height) throw new PdfToolError("numberDoesNotFit")
  const u = position === "bottom-center" ? (width - textWidth) / 2 : width - margin - textWidth
  const v = position === "top-right" ? height - margin - fontSize : margin
  if (angle === 90) return { x: box.x + box.width - v, y: box.y + u, rotation: angle }
  if (angle === 180) return { x: box.x + box.width - u, y: box.y + box.height - v, rotation: angle }
  if (angle === 270) return { x: box.x + v, y: box.y + box.height - u, rotation: angle }
  return { x: box.x + u, y: box.y + v, rotation: angle }
}
async function numberPages(document: PDFDocument, numbering: PdfNumbering | undefined, offset: number, total: number) {
  if (!numbering?.enabled) return
  const size = numbering.fontSize ?? 10, margin = numbering.margin ?? 18, position = numbering.position ?? "bottom-center"
  if (!Number.isFinite(size) || size < 4 || size > 72 || !Number.isFinite(margin) || margin < 0 || margin > 144 || !["bottom-center", "bottom-right", "top-right"].includes(position)) throw new PdfToolError("invalidOptions")
  const font = await document.embedFont(StandardFonts.Helvetica)
  for (const [index, page] of document.getPages().entries()) {
    const info = pageInfo(page, index), fontSize = size / info.userUnit, label = numbering.total === false ? String(offset + index + 1) : `${offset + index + 1} / ${total}`
    const placement = pdfNumberPlacement(visiblePdfBox(page), page.getRotation().angle, font.widthOfTextAtSize(label, fontSize), fontSize, margin / info.userUnit, position)
    page.drawText(label, { x: placement.x, y: placement.y, rotate: degrees(placement.rotation), size: fontSize, font, color: rgb(0.15, 0.15, 0.15) })
  }
}
export async function composePdfs(sources: PdfSource[], options: PdfComposeOptions = {}, onProgress?: PdfProgressCallback): Promise<PdfComposition> {
  sourceBudget(sources)
  const loaded: Awaited<ReturnType<typeof loadPdf>>[] = []; let totalInputPages = 0
  for (const [index, source] of sources.entries()) { const next = await loadPdf(source); totalInputPages += next.info.pages.length; if (totalInputPages > PDF_LIMITS.pages) throw new PdfToolError("pageLimit"); loaded.push(next); onProgress?.({ stage: "reading", completed: index + 1, total: sources.length }) }
  const originals: PdfPageReference[] = loaded.flatMap((source, index) => source.info.pages.map((page) => ({ source: index, page: page.page })))
  const plan: PdfPageReference[] = options.pages ?? parsePdfSelection(options.selection ?? "", originals.length).map((index) => originals[index])
  if (!plan.length || plan.length > PDF_LIMITS.pages) throw new PdfToolError("pageLimit")
  for (const page of plan) { if (!Number.isInteger(page.source) || !Number.isInteger(page.page) || !loaded[page.source]?.info.pages[page.page]) throw new PdfToolError("invalidSelection"); pdfRotation(page.rotation ?? 0) }
  const rotation = pdfRotation(options.rotation ?? 0), splitEvery = options.splitEvery ?? 0
  if (!Number.isInteger(splitEvery) || splitEvery < 0 || splitEvery > PDF_LIMITS.pages) throw new PdfToolError("invalidOptions")
  const outputCount = splitEvery ? Math.ceil(plan.length / splitEvery) : 1
  if (outputCount > PDF_LIMITS.outputs) throw new PdfToolError("outputLimit")
  const used = new Set(plan.map((page) => page.source))
  const relevant = loaded.filter((_, index) => used.has(index))
  const singleSource = relevant.length === 1 ? relevant[0] : null
  const preserve = !!singleSource && outputCount === 1 && plan.length === singleSource.info.pages.length && new Set(plan.map((page) => page.page)).size === singleSource.info.pages.length
  if (relevant.some(({ info }) => info.unsupportedForm)) throw new PdfToolError("formStructure")
  if (relevant.some(({ info }) => info.signed) && !options.allowSignatureChanges) throw new PdfToolError("signatureConsent")
  if (!preserve && relevant.some(({ info }) => info.formFields) && !options.flattenForms) throw new PdfToolError("flattenRequired")
  let flattenedForms = false
  if (options.flattenForms) for (const source of relevant) if (source.info.formFields) {
    try {
      source.document.getForm().flatten({ updateFieldAppearances: false })
      for (const page of source.document.getPages()) {
        const annotations = page.node.Annots()?.asArray().filter((reference) => {
          const annotation = source.document.context.lookupMaybe(reference, PDFDict)
          return annotation && annotation.get(PDFName.of("Subtype")) !== PDFName.of("Widget")
        }) ?? []
        if (annotations.length) page.node.set(PDFName.of("Annots"), source.document.context.obj(annotations)); else page.node.delete(PDFName.of("Annots"))
      }
      source.document.catalog.delete(PDFName.of("AcroForm"))
      flattenedForms = true
    } catch { throw new PdfToolError("formStructure", source.info.name) }
  }
  const files: PdfOutput[] = []; let outputBytes = 0
  const save = async (document: PDFDocument, index: number, offset: number) => {
    await numberPages(document, options.numbering, offset, plan.length)
    const bytes = await document.save({ updateFieldAppearances: false })
    outputBytes += bytes.length
    if (outputBytes > PDF_LIMITS.outputBytes) throw new PdfToolError("outputLimit")
    files.push({ name: outputCount === 1 ? "processed.pdf" : `part-${String(index + 1).padStart(3, "0")}.pdf`, bytes, pages: document.getPageCount() })
    onProgress?.({ stage: "writing", completed: index + 1, total: outputCount })
  }
  if (preserve) {
    const document = singleSource!.document, pages = document.getPages()
    // Detaching a page from an intermediate page-tree node must not discard
    // inherited resources or geometry. Its reference stays stable for forms.
    for (const page of pages) for (const key of ["Resources", "MediaBox", "CropBox", "Rotate"]) {
      const name = PDFName.of(key), value = page.node.getInheritableAttribute(name)
      if (value) page.node.set(name, value)
    }
    for (let index = document.getPageCount() - 1; index >= 0; index--) document.removePage(index)
    for (const reference of plan) { const page = pages[reference.page]; page.setRotation(degrees(pdfRotation(page.getRotation().angle + rotation + (reference.rotation ?? 0)))); document.addPage(page) }
    await save(document, 0, 0)
  } else for (let group = 0; group < outputCount; group++) {
    const document = await PDFDocument.create(), offset = splitEvery ? group * splitEvery : 0, pages = plan.slice(offset, splitEvery ? offset + splitEvery : undefined)
    const copied: PDFPage[] = new Array(pages.length)
    for (const source of new Set(pages.map((page) => page.source))) {
      const positions = pages.map((_, index) => index).filter((index) => pages[index].source === source)
      const batch = await document.copyPages(loaded[source].document, positions.map((index) => pages[index].page))
      positions.forEach((position, index) => { copied[position] = batch[index] })
    }
    for (const [index, reference] of pages.entries()) { const page = copied[index]; isolatePageContents(page, document); page.setRotation(degrees(pdfRotation(page.getRotation().angle + rotation + (reference.rotation ?? 0)))); document.addPage(page) }
    await save(document, group, offset)
  }
  return { files, pages: plan.length, flattenedForms, retainedForms: preserve && !flattenedForms && relevant.some(({ info }) => info.formFields > 0), droppedOutlines: !preserve && relevant.some(({ info }) => info.outlines), changedSignatures: relevant.some(({ info }) => info.signed) }
}

export async function createPdfSample(): Promise<Uint8Array> {
  const document = await PDFDocument.create(), font = await document.embedFont(StandardFonts.Helvetica)
  for (let index = 0; index < 3; index++) {
    const page = document.addPage(index === 1 ? [640, 440] : [595.28, 841.89])
    if (index === 1) { page.setMediaBox(50, 100, 640, 440); page.setCropBox(70, 120, 600, 400); page.setRotation(degrees(90)) }
    const box = page.getCropBox()
    page.drawRectangle({ x: box.x + 24, y: box.y + box.height - 110, width: box.width - 48, height: 80, color: [rgb(0.08, 0.39, 0.35), rgb(0.18, 0.28, 0.53), rgb(0.58, 0.24, 0.17)][index] })
    page.drawText(`Sample - Page ${index + 1}`, { x: box.x + 42, y: box.y + box.height - 76, size: 24, font, color: rgb(1, 1, 1) })
    page.drawText("Local PDF tools: reorder, rotate, split and number pages.", { x: box.x + 30, y: box.y + box.height - 150, size: 12, font })
    page.drawRectangle({ x: box.x + 30, y: box.y + 70, width: 100, height: 40, color: rgb(0.9, 0.8, 0.3) })
    page.drawText(`BOTTOM LEFT ${index + 1}`, { x: box.x + 34, y: box.y + 86, size: 9, font })
  }
  return document.save()
}

export function pdfImageTransform(box: { x: number; y: number; width: number; height: number }, orientation = 1) {
  const { x, y, width: w, height: h } = box
  switch (orientation) {
    case 2: return { x: x + w, y, width: -w, height: h, rotation: 0 }
    case 3: return { x: x + w, y: y + h, width: w, height: h, rotation: 180 }
    case 4: return { x, y: y + h, width: w, height: -h, rotation: 0 }
    case 5: return { x: x + w, y: y + h, width: h, height: -w, rotation: 270 }
    case 6: return { x, y: y + h, width: h, height: w, rotation: 270 }
    case 7: return { x, y, width: h, height: -w, rotation: 90 }
    case 8: return { x: x + w, y, width: h, height: w, rotation: 90 }
    default: return { x, y, width: w, height: h, rotation: 0 }
  }
}
export async function imagesToPdf(sources: PdfSource[], options: PdfImageOptions = {}, onProgress?: PdfProgressCallback): Promise<PdfComposition> {
  sourceBudget(sources)
  const margin = options.margin ?? 36, pageSize = options.pageSize ?? "a4"
  if (!Number.isFinite(margin) || margin < 0 || margin > 144 || !["a4", "a4-landscape", "letter", "letter-landscape", "image"].includes(pageSize)) throw new PdfToolError("invalidOptions")
  const document = await PDFDocument.create()
  const { orientation: readOrientation } = await import("exifr")
  for (const [index, source] of sources.entries()) {
    const metadata = pdfImageDimensions(source.bytes)
    let orientation = 1
    try { const value = await readOrientation(source.bytes); if (value && Number.isInteger(value) && value >= 1 && value <= 8) orientation = value } catch { /* Missing EXIF does not prevent image embedding. */ }
    const width = orientation >= 5 ? metadata.height : metadata.width, height = orientation >= 5 ? metadata.width : metadata.height
    const base = pageSize.startsWith("letter") ? [612, 792] : [595.28, 841.89]
    const size = pageSize === "image" ? [width * 0.75 + margin * 2, height * 0.75 + margin * 2] : pageSize.endsWith("landscape") ? [base[1], base[0]] : base
    const scale = Math.min((size[0] - margin * 2) / width, (size[1] - margin * 2) / height)
    if (!(scale > 0)) throw new PdfToolError("invalidOptions")
    const page = document.addPage([size[0], size[1]])
    let image
    try { image = metadata.format === "png" ? await document.embedPng(source.bytes) : await document.embedJpg(source.bytes) } catch { throw new PdfToolError("invalidImage", source.name) }
    const draw = pdfImageTransform({ x: (size[0] - width * scale) / 2, y: (size[1] - height * scale) / 2, width: width * scale, height: height * scale }, orientation)
    page.drawImage(image, { ...draw, rotate: degrees(draw.rotation) })
    await image.embed()
    onProgress?.({ stage: "images", completed: index + 1, total: sources.length })
  }
  await numberPages(document, options.numbering, 0, sources.length)
  const bytes = await document.save({ updateFieldAppearances: false })
  if (bytes.length > PDF_LIMITS.outputBytes) throw new PdfToolError("outputLimit")
  return { files: [{ name: "images.pdf", bytes, pages: sources.length }], pages: sources.length, flattenedForms: false, retainedForms: false, droppedOutlines: false, changedSignatures: false }
}
