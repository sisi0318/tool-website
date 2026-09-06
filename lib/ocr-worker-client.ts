import { OcrError, OCR_LIMITS, ocrOptions, type OcrOptions, type OcrProgress, type OcrRequest, type OcrResponse, type OcrResult } from "./ocr-shared"

type Context = { signal?: AbortSignal; onProgress?: (progress: OcrProgress) => void }
const defaultWorker = () => new Worker(new URL("../workers/ocr.worker.ts", import.meta.url), { type: "module" })

/** Sequential jobs share one model; dispose also rejects an in-flight job. */
export function createOcrSession(createWorker: () => Worker = defaultWorker) {
  let worker: Worker | undefined, closed = false, cancel: (() => void) | undefined
  const terminate = () => { closed = true; worker?.terminate(); worker = undefined }
  return {
    dispose() { if (cancel) cancel(); else terminate() },
    recognize(file: File, input: Partial<OcrOptions> = {}, context: Context = {}): Promise<OcrResult> {
      if (closed || context.signal?.aborted) return Promise.reject(new OcrError("cancelled"))
      if (cancel) return Promise.reject(new OcrError("engine"))
      let options: OcrOptions
      try { options = ocrOptions(input) } catch (error) { return Promise.reject(error) }
      if (!file || file.size < 1 || file.size > OCR_LIMITS.fileBytes) return Promise.reject(new OcrError("fileLimit"))
      try { worker ??= createWorker() } catch { return Promise.reject(new OcrError("unsupported")) }
      const current = worker
      return new Promise((resolve, reject) => {
        let done = false
        const cleanup = () => { clearTimeout(timer); context.signal?.removeEventListener("abort", abort); current.onmessage = null; current.onerror = null; cancel = undefined }
        const fail = (code: ConstructorParameters<typeof OcrError>[0]) => { if (done) return; done = true; cleanup(); terminate(); reject(new OcrError(code)) }
        const abort = () => fail("cancelled")
        cancel = abort
        const timer = setTimeout(() => fail("timeout"), OCR_LIMITS.timeout)
        context.signal?.addEventListener("abort", abort, { once: true })
        current.onerror = event => { event.preventDefault(); fail("engine") }
        current.onmessage = ({ data }: MessageEvent<OcrResponse>) => {
          if (done) return
          if (data.type === "progress") { context.onProgress?.(data.progress); return }
          if (data.type === "error") { fail(data.code); return }
          if (data.type !== "done") { fail("engine"); return }
          done = true; cleanup(); resolve(data.result)
        }
        try { current.postMessage({ file, options } satisfies OcrRequest) } catch { fail("engine") }
        if (context.signal?.aborted) abort()
      })
    },
  }
}
export async function recognizeImage(file: File, input: Partial<OcrOptions> = {}, context: Context = {}, createWorker: () => Worker = defaultWorker): Promise<OcrResult> {
  const session = createOcrSession(createWorker)
  try { return await session.recognize(file, input, context) } finally { session.dispose() }
}
