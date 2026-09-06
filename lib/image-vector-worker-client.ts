import { ImageVectorError, VECTOR_LIMITS, svgFileName, vectorOptions, type ImageVectorOptions, type ImageVectorResult, type VectorStage, type VectorWorkerRequest, type VectorWorkerResponse } from "./image-vector-shared"

export interface ImageVectorContext { signal?: AbortSignal; onProgress?: (stage: VectorStage) => void }
export function vectorizeImage(file: File, input: Partial<ImageVectorOptions> = {}, context: ImageVectorContext = {}, createWorker: () => Worker = () => new Worker(new URL("../workers/image-vector.worker.ts", import.meta.url), { type: "module" })): Promise<ImageVectorResult> {
  if (context.signal?.aborted) return Promise.reject(new ImageVectorError("cancelled"))
  let options: ImageVectorOptions
  try { options = vectorOptions(input) } catch (error) { return Promise.reject(error) }
  if (!file || file.size < 1 || file.size > VECTOR_LIMITS.fileBytes) return Promise.reject(new ImageVectorError("fileLimit"))
  let worker: Worker
  try { worker = createWorker() } catch { return Promise.reject(new ImageVectorError("unsupported")) }
  return new Promise((resolve, reject) => {
    let done = false
    const cleanup = () => { clearTimeout(timer); context.signal?.removeEventListener("abort", abort); worker.onmessage = null; worker.onerror = null; worker.terminate() }
    const fail = (error: ImageVectorError) => { if (done) return; done = true; cleanup(); reject(error) }
    const abort = () => fail(new ImageVectorError("cancelled"))
    const timer = setTimeout(() => fail(new ImageVectorError("timeout")), VECTOR_LIMITS.timeout)
    context.signal?.addEventListener("abort", abort, { once: true })
    worker.onerror = (event) => { event.preventDefault(); fail(new ImageVectorError("engine")) }
    worker.onmessage = ({ data }: MessageEvent<VectorWorkerResponse>) => {
      if (done) return
      if (data.type === "progress") { context.onProgress?.(data.stage); return }
      if (data.type === "error") { fail(new ImageVectorError(data.code)); return }
      done = true; cleanup()
      resolve({ svg: data.svg, info: data.info, file: new File([data.svg], svgFileName(file.name), { type: "image/svg+xml" }) })
    }
    try { worker.postMessage({ file, options } satisfies VectorWorkerRequest) } catch { fail(new ImageVectorError("engine")) }
    if (context.signal?.aborted) abort()
  })
}
