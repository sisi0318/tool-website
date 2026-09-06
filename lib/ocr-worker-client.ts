import { OcrError, OCR_LIMITS, ocrOptions, type OcrOptions, type OcrProgress, type OcrRequest, type OcrResponse, type OcrResult } from "./ocr-shared"

export function recognizeImage(file: File, input: Partial<OcrOptions> = {}, context: { signal?: AbortSignal; onProgress?: (progress: OcrProgress) => void } = {}, createWorker: () => Worker = () => new Worker(new URL("../workers/ocr.worker.ts", import.meta.url), { type: "module" })): Promise<OcrResult> {
  if (context.signal?.aborted) return Promise.reject(new OcrError("cancelled"))
  let options: OcrOptions
  try { options = ocrOptions(input) } catch (error) { return Promise.reject(error) }
  if (!file || file.size < 1 || file.size > OCR_LIMITS.fileBytes) return Promise.reject(new OcrError("fileLimit"))
  let worker: Worker
  try { worker = createWorker() } catch { return Promise.reject(new OcrError("unsupported")) }
  return new Promise((resolve, reject) => {
    let done = false
    const cleanup = () => { clearTimeout(timer); context.signal?.removeEventListener("abort", abort); worker.onmessage = null; worker.onerror = null; worker.terminate() }
    const fail = (code: ConstructorParameters<typeof OcrError>[0]) => { if (done) return; done = true; cleanup(); reject(new OcrError(code)) }
    const abort = () => fail("cancelled")
    const timer = setTimeout(() => fail("timeout"), OCR_LIMITS.timeout)
    context.signal?.addEventListener("abort", abort, { once: true })
    worker.onerror = event => { event.preventDefault(); fail("engine") }
    worker.onmessage = ({ data }: MessageEvent<OcrResponse>) => {
      if (done) return
      if (data.type === "progress") { context.onProgress?.(data.progress); return }
      if (data.type === "error") { fail(data.code); return }
      if (data.type !== "done") { fail("engine"); return }
      done = true; cleanup(); resolve(data.result)
    }
    try { worker.postMessage({ file, options } satisfies OcrRequest) } catch { fail("engine") }
    if (context.signal?.aborted) abort()
  })
}
