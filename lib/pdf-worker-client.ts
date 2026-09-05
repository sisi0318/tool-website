import { PDF_LIMITS, PdfToolError, type PdfComposeOptions, type PdfComposition, type PdfImageOptions, type PdfInfo, type PdfProgress, type PdfProgressCallback, type PdfSource } from "./pdf-shared"

export type PdfTaskRequest = { type: "sample" } | { type: "inspect"; sources: PdfSource[] } | { type: "compose"; sources: PdfSource[]; options: PdfComposeOptions } | { type: "images"; sources: PdfSource[]; options: PdfImageOptions }
export type PdfTaskResponse = { type: "progress"; progress: PdfProgress } | { type: "done"; value: unknown } | { type: "error"; error: { code: PdfToolError["code"]; detail: string } }
export interface PdfTaskContext { signal?: AbortSignal; onProgress?: PdfProgressCallback }
export interface PdfFileResult extends Omit<PdfComposition, "files"> { files: Array<{ file: File; pages: number }>; download: File }

export function runPdfWorker<T>(request: PdfTaskRequest, context: PdfTaskContext = {}, createWorker: () => Worker = () => new Worker(new URL("../workers/pdf.worker.ts", import.meta.url), { type: "module" })): Promise<T> {
  if (context.signal?.aborted) return Promise.reject(new PdfToolError("cancelled"))
  let worker: Worker
  try { worker = createWorker() } catch { return Promise.reject(new PdfToolError("workerFailed")) }
  return new Promise<T>((resolve, reject) => {
    let done = false
    const cleanup = () => { clearTimeout(timer); context.signal?.removeEventListener("abort", abort); worker.onmessage = null; worker.onerror = null; worker.terminate() }
    const fail = (error: PdfToolError) => { if (done) return; done = true; cleanup(); reject(error) }
    const abort = () => fail(new PdfToolError("cancelled"))
    const timer = setTimeout(() => fail(new PdfToolError("timeout")), 60000)
    context.signal?.addEventListener("abort", abort, { once: true })
    worker.onerror = (event) => { event.preventDefault(); fail(new PdfToolError("workerFailed", event.message)) }
    worker.onmessage = ({ data }: MessageEvent<PdfTaskResponse>) => {
      if (done) return
      if (data.type === "progress") { context.onProgress?.(data.progress); return }
      if (data.type === "error") { fail(new PdfToolError(data.error.code, data.error.detail)); return }
      done = true; cleanup(); resolve(data.value as T)
    }
    try { worker.postMessage(request, request.type === "sample" ? [] : request.sources.map((source) => source.bytes.buffer as ArrayBuffer)) }
    catch (cause) { fail(new PdfToolError("workerFailed", cause instanceof Error ? cause.message : "")) }
  })
}
async function sourcesFromFiles(files: File[], context: PdfTaskContext): Promise<PdfSource[]> {
  if (!files.length || files.length > PDF_LIMITS.files || files.reduce((size, file) => size + file.size, 0) > PDF_LIMITS.inputBytes) throw new PdfToolError("inputLimit")
  const sources: PdfSource[] = []
  for (const file of files) { context.signal?.throwIfAborted(); const bytes = new Uint8Array(await file.arrayBuffer()); context.signal?.throwIfAborted(); sources.push({ name: file.name, bytes }) }
  return sources
}
export async function inspectPdfFiles(files: File[], context: PdfTaskContext = {}): Promise<PdfInfo[]> { return runPdfWorker({ type: "inspect", sources: await sourcesFromFiles(files, context) }, context) }
export async function samplePdfFile(context: PdfTaskContext = {}): Promise<{ file: File; info: PdfInfo }> {
  const result = await runPdfWorker<{ name: string; bytes: Uint8Array<ArrayBuffer>; info: PdfInfo }>({ type: "sample" }, context)
  return { file: new File([result.bytes], result.name, { type: "application/pdf" }), info: result.info }
}
async function resultFiles(result: PdfComposition, context: PdfTaskContext): Promise<PdfFileResult> {
  context.signal?.throwIfAborted()
  const files = result.files.map((output) => ({ file: new File([new Uint8Array(output.bytes)], output.name, { type: "application/pdf" }), pages: output.pages }))
  let download = files[0].file
  if (files.length > 1) {
    const { createZip } = await import("./zip-tools")
    try { const bytes = await createZip(result.files.map((output) => ({ name: output.name, data: output.bytes as Uint8Array<ArrayBuffer> })), { level: 0, signal: context.signal }); if (bytes.length > PDF_LIMITS.outputBytes) throw new PdfToolError("outputLimit"); download = new File([bytes], "split-pages.zip", { type: "application/zip" }) }
    catch (cause) { context.signal?.throwIfAborted(); throw new PdfToolError("outputLimit", cause instanceof Error ? cause.message : "") }
  }
  return { ...result, files, download }
}
export async function composePdfFiles(files: File[], options: PdfComposeOptions, context: PdfTaskContext = {}): Promise<PdfFileResult> {
  const result = await runPdfWorker<PdfComposition>({ type: "compose", sources: await sourcesFromFiles(files, context), options }, context)
  return resultFiles(result, context)
}
export async function imageFilesToPdf(files: File[], options: PdfImageOptions, context: PdfTaskContext = {}): Promise<PdfFileResult> {
  const result = await runPdfWorker<PdfComposition>({ type: "images", sources: await sourcesFromFiles(files, context), options }, context)
  return resultFiles(result, context)
}
