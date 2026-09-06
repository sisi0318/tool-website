import type { PDFDocumentLoadingTask, PDFWorker, RenderTask } from "pdfjs-dist"
import { loadPdfJs, pdfJsOptions } from "./pdfjs-runtime"
import { createOcrSession } from "./ocr-worker-client"
import { OCR_LIMITS, OcrError, type OcrOptions } from "./ocr-shared"
import { PDF_LIMITS, PdfToolError, parsePdfSelection } from "./pdf-shared"
import { PDF_OCR_LIMITS, type PdfOcrPage, type PdfOcrProgress } from "./pdf-ocr-shared"

export async function recognizePdf(file: File, options: { selection: string; dpi: number; rotation: OcrOptions["rotation"] }, context: { signal?: AbortSignal; onProgress?: (value: PdfOcrProgress) => void } = {}): Promise<PdfOcrPage[]> {
  if (context.signal?.aborted) throw new PdfToolError("cancelled")
  if (!file.size || file.size > PDF_LIMITS.inputBytes) throw new PdfToolError("inputLimit")
  if (![144, 200, 300].includes(options.dpi) || ![0, 90, 180, 270].includes(options.rotation)) throw new PdfToolError("invalidOptions")
  let task: PDFDocumentLoadingTask | undefined, worker: PDFWorker | undefined, render: RenderTask | undefined, timedOut = false, encrypted = false
  let timer: ReturnType<typeof setTimeout> | undefined
  const session = createOcrSession(), canvas = document.createElement("canvas")
  const stop = () => { render?.cancel(); session.dispose(); void task?.destroy().catch(() => {}); worker?.destroy() }
  const deadline = () => { clearTimeout(timer); timer = setTimeout(() => { timedOut = true; stop() }, 30000) }
  const check = () => { if (timedOut) throw new PdfToolError("timeout"); if (context.signal?.aborted) throw new PdfToolError("cancelled") }
  context.signal?.addEventListener("abort", stop, { once: true })
  try {
    deadline(); context.onProgress?.({ stage: "reading", completed: 0, total: 0 })
    const [pdfjs, buffer] = await Promise.all([loadPdfJs(), file.arrayBuffer()]); check()
    worker = pdfjs.PDFWorker.create({ name: "local-pdf-ocr" })
    task = pdfjs.getDocument({ data: new Uint8Array(buffer), worker, ...pdfJsOptions(pdfjs) })
    // Reject password-protected inputs promptly instead of leaving a password request open.
    task.onPassword = () => { encrypted = true; void task?.destroy().catch(() => {}) }
    const pdf = await task.promise; check(); clearTimeout(timer)
    const selection = parsePdfSelection(options.selection, pdf.numPages)
    if (selection.length > PDF_OCR_LIMITS.pages) throw new PdfToolError("pageLimit")
    const pages: PdfOcrPage[] = []
    let pixels = 0, imageBytes = 0
    for (const [index, pageIndex] of selection.entries()) {
      check(); deadline()
      context.onProgress?.({ stage: "rendering", completed: index, total: selection.length, sourcePage: pageIndex + 1 })
      const page = await pdf.getPage(pageIndex + 1); check()
      const rotation = (page.rotate + options.rotation) % 360, base = page.getViewport({ scale: 1, rotation })
      if (![base.width, base.height].every(n => Number.isFinite(n) && n > 0 && n <= 14400)) throw new PdfToolError("imageLimit")
      const scale = Math.min(options.dpi / 72, Math.sqrt((PDF_OCR_LIMITS.pagePixels - 16384) / (base.width * base.height)), 8191 / Math.max(base.width, base.height))
      const viewport = page.getViewport({ scale, rotation })
      canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height)
      pixels += canvas.width * canvas.height
      if (pixels > PDF_OCR_LIMITS.totalPixels) throw new PdfToolError("imageLimit")
      render = page.render({ canvas, viewport, background: "rgb(255,255,255)" })
      await render.promise; check(); render = undefined
      const png = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new PdfToolError("invalidImage")), "image/png")); check()
      // PNG keeps small text and line art sharp in the exported page image.
      imageBytes += png.size
      if (imageBytes > PDF_OCR_LIMITS.imageBytes || png.size > OCR_LIMITS.fileBytes) throw new PdfToolError("outputLimit")
      clearTimeout(timer)
      const result = await session.recognize(new File([png], `page-${pageIndex + 1}.png`, { type: "image/png" }), { enhanceSmallText: true }, { signal: context.signal, onProgress: ocr => context.onProgress?.({ stage: "recognizing", completed: index, total: selection.length, sourcePage: pageIndex + 1, ocr }) })
      check()
      pages.push({ sourcePage: pageIndex + 1, width: base.width, height: base.height, pixelWidth: canvas.width, pixelHeight: canvas.height, image: png, preview: result.preview, lines: result.lines })
      canvas.width = canvas.height = 1; page.cleanup()
    }
    return pages
  } catch (error) {
    check()
    if (encrypted) throw new PdfToolError("encrypted")
    if (error instanceof PdfToolError || error instanceof OcrError) throw error
    throw new PdfToolError("invalidPdf")
  } finally { clearTimeout(timer); context.signal?.removeEventListener("abort", stop); stop(); canvas.width = canvas.height = 1 }
}

export function exportSearchablePdf(pages: PdfOcrPage[], signal?: AbortSignal, factory = () => new Worker(new URL("../workers/pdf-ocr.worker.ts", import.meta.url), { type: "module" })): Promise<Blob> {
  if (signal?.aborted) return Promise.reject(new PdfToolError("cancelled"))
  let worker: Worker
  try { worker = factory() } catch { return Promise.reject(new PdfToolError("workerFailed")) }
  return new Promise((resolve, reject) => {
    let done = false
    const cleanup = () => { clearTimeout(timer); signal?.removeEventListener("abort", abort); worker.onmessage = null; worker.onerror = null; worker.terminate() }
    const fail = (code: PdfToolError["code"]) => { if (done) return; done = true; cleanup(); reject(new PdfToolError(code)) }
    const abort = () => fail("cancelled"), timer = setTimeout(() => fail("timeout"), 60000)
    signal?.addEventListener("abort", abort, { once: true })
    worker.onerror = event => { event.preventDefault(); fail("workerFailed") }
    worker.onmessage = ({ data }: MessageEvent<{ error?: PdfToolError["code"]; bytes?: Uint8Array<ArrayBuffer> }>) => {
      if (done) return
      if (data.error || !data.bytes) { fail(data.error ?? "workerFailed"); return }
      done = true; cleanup(); resolve(new Blob([data.bytes], { type: "application/pdf" }))
    }
    try { worker.postMessage(pages) } catch { fail("workerFailed") }
    if (signal?.aborted) abort()
  })
}

export async function sampleOcrPdf(): Promise<File> {
  const [{ PDFDocument }, { createOcrSample }] = await Promise.all([import("pdf-lib"), import("./ocr-samples")])
  const pdf = await PDFDocument.create()
  for (const kind of ["document", "small"] as const) {
    const sample = await createOcrSample(kind), image = await pdf.embedPng(await sample.arrayBuffer())
    const scale = 595 / image.width, page = pdf.addPage([595, image.height * scale])
    page.drawImage(image, { x: 0, y: 0, width: page.getWidth(), height: page.getHeight() })
  }
  return new File([new Uint8Array(await pdf.save())], "ocr-scanned-sample.pdf", { type: "application/pdf" })
}
