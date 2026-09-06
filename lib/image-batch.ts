import { createOcrSession } from "./ocr-worker-client"
import { OcrError, OCR_LIMITS, ocrImageHeader, type OcrProgress } from "./ocr-shared"
import { batchOptions, batchOcrResult, batchResultBytes, IMAGE_BATCH_LIMITS, ImageBatchError, type BatchImageJob, type BatchImageResult, type ImageBatchOptions } from "./image-batch-shared"

type Context = { signal?: AbortSignal; onProgress?: (value: { current: number; total: number; name: string; ocr?: OcrProgress }) => void; onUpdate: (id: string, update: Partial<BatchImageJob>) => void }
function check(signal?: AbortSignal) { if (signal?.aborted) throw new ImageBatchError("cancelled") }
export function batchErrorCode(error: unknown) { return error instanceof OcrError ? `ocr:${error.code}` : error instanceof ImageBatchError ? `batch:${error.code}` : error instanceof Error && /^(ocr|batch):/.test(error.message) ? error.message : "batch:convert" }
export function transformBatchImage(file: File, base: string, options: ImageBatchOptions, signal?: AbortSignal, factory = () => new Worker(new URL("../workers/image-batch.worker.ts", import.meta.url), { type: "module" })): Promise<BatchImageResult> {
  if (signal?.aborted) return Promise.reject(new ImageBatchError("cancelled"))
  let worker: Worker
  try { worker = factory() } catch { return Promise.reject(new ImageBatchError("unsupported")) }
  return new Promise((resolve, reject) => {
    let done = false, sent = false
    const cleanup = () => { clearTimeout(timer); signal?.removeEventListener("abort", abort); worker.onmessage = null; worker.onerror = null; worker.terminate() }
    const fail = (error: Error) => { if (done) return; done = true; cleanup(); reject(error) }
    const abort = () => fail(new ImageBatchError("cancelled")), timer = setTimeout(() => fail(new ImageBatchError("timeout")), 60000)
    signal?.addEventListener("abort", abort, { once: true })
    worker.onerror = event => { event.preventDefault(); fail(new ImageBatchError("convert")) }
    worker.onmessage = ({ data }: MessageEvent<{ ready?: boolean; result?: BatchImageResult; error?: string }>) => {
      if (done) return
      if (data.ready) { if (!sent) { sent = true; try { worker.postMessage({ file, base, options }) } catch { fail(new ImageBatchError("convert")) } } return }
      if (data.error || !data.result) { fail(new Error(data.error ?? "batch:convert")); return }
      done = true; cleanup(); resolve(data.result)
    }
    if (signal?.aborted) abort()
  })
}
function createProcessor(options: ImageBatchOptions, context: Context) {
  let session: ReturnType<typeof createOcrSession> | undefined
  return {
    dispose() { session?.dispose() },
    async process(job: BatchImageJob, current: number, total: number) {
      if (!job.file.size || job.file.size > OCR_LIMITS.fileBytes) throw new ImageBatchError("fileLimit")
      if (options.mode === "images") return transformBatchImage(job.file, job.base, options, context.signal)
      // Bad headers are rejected before loading (or discarding) the shared model.
      ocrImageHeader(new Uint8Array(await job.file.arrayBuffer())); check(context.signal)
      session ??= createOcrSession()
      try { return batchOcrResult(await session.recognize(job.file, { rotation: options.rotation, enhanceSmallText: options.enhanceSmallText }, { signal: context.signal, onProgress: ocr => context.onProgress?.({ current, total, name: job.file.name, ocr }) }), job.base) }
      catch (error) { session.dispose(); session = undefined; throw error }
    },
  }
}
/** Sequential processing bounds decoded-image memory; a failed image does not block its neighbors. */
export async function runImageBatch(jobs: BatchImageJob[], input: ImageBatchOptions, context: Context, factory = createProcessor, existingOutputBytes = 0) {
  check(context.signal)
  if (jobs.length > IMAGE_BATCH_LIMITS.files || jobs.reduce((sum, job) => sum + job.file.size, 0) > IMAGE_BATCH_LIMITS.inputBytes) throw new ImageBatchError("queueLimit")
  const options = batchOptions(input), processor = factory(options, context)
  let outputBytes = existingOutputBytes
  try {
    for (const [index, job] of jobs.entries()) {
      check(context.signal)
      context.onUpdate(job.id, { status: "running", error: undefined, result: undefined })
      context.onProgress?.({ current: index + 1, total: jobs.length, name: job.file.name })
      try {
        const result = await processor.process(job, index + 1, jobs.length); check(context.signal)
        const size = batchResultBytes(result)
        if (outputBytes + size > IMAGE_BATCH_LIMITS.outputBytes) throw new ImageBatchError("outputLimit")
        outputBytes += size; context.onUpdate(job.id, { status: "done", result, error: undefined })
      } catch (error) { check(context.signal); context.onUpdate(job.id, { status: "error", error: batchErrorCode(error), result: undefined }) }
    }
  } finally { processor.dispose() }
}
export async function imageBatchZip(jobs: BatchImageJob[], options: ImageBatchOptions, signal?: AbortSignal): Promise<Blob> {
  const { createZip } = await import("./zip-tools")
  check(signal)
  if (!jobs.some(job => job.status === "done")) throw new ImageBatchError("options")
  const sources: Array<{ name: string; data: Uint8Array<ArrayBuffer> }> = []
  let bytes = 0
  for (const job of jobs) if (job.status === "done" && job.result) for (const file of job.result.files) {
    check(signal); bytes += file.size
    if (bytes > IMAGE_BATCH_LIMITS.outputBytes) throw new ImageBatchError("outputLimit")
    sources.push({ name: `${file.type === "application/json" ? "data" : file.type.startsWith("text/") ? "text" : "images"}/${file.name}`, data: new Uint8Array(await file.arrayBuffer()) })
  }
  sources.push({ name: "manifest.json", data: new TextEncoder().encode(JSON.stringify({ options, files: jobs.map(job => ({ source: job.file.name, status: job.status, error: job.error, outputs: job.result?.files.map(file => file.name) ?? [] })) }, null, 2)) })
  const output = await createZip(sources, { level: options.mode === "ocr" ? 6 : 0, signal })
  check(signal)
  return new Blob([output], { type: "application/zip" })
}
