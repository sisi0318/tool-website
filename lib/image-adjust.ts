import { IMAGE_ADJUST_LIMITS, imageAdjustOptions, type ImageAdjustOptions } from "./image-adjust-shared"

export function adjustImageFile(file: File, input: ImageAdjustOptions, signal?: AbortSignal): Promise<File> {
  const options = imageAdjustOptions(input)
  if (signal?.aborted) return Promise.reject(new DOMException("Operation cancelled", "AbortError"))
  if (!file.size || file.size > IMAGE_ADJUST_LIMITS.bytes) return Promise.reject(new Error("Image must be nonempty and at most 20 MB"))
  let worker: Worker
  try { worker = new Worker(new URL("../workers/image-adjust.worker.ts", import.meta.url), { type: "module" }) } catch { return Promise.reject(new Error("Image editing requires browser worker support")) }
  return new Promise((resolve, reject) => {
    let done = false, sent = false
    const cleanup = () => { clearTimeout(timer); signal?.removeEventListener("abort", abort); worker.onmessage = null; worker.onerror = null; worker.terminate() }
    const fail = (error: Error) => { if (done) return; done = true; cleanup(); reject(error) }
    const abort = () => fail(new DOMException("Operation cancelled", "AbortError")), timer = setTimeout(() => fail(new Error("Image editing timed out")), IMAGE_ADJUST_LIMITS.timeout)
    signal?.addEventListener("abort", abort, { once: true })
    worker.onerror = event => { event.preventDefault(); fail(new Error("Image editing failed")) }
    worker.onmessage = ({ data }: MessageEvent<{ ready?: boolean; file?: File; error?: string }>) => {
      if (done) return
      if (data.ready) { if (!sent) { sent = true; try { worker.postMessage({ file, options }) } catch { fail(new Error("Image editing failed")) } } return }
      if (!data.file || data.error) { fail(new Error(data.error ?? "Image editing failed")); return }
      done = true; cleanup(); resolve(data.file)
    }
    if (signal?.aborted) abort()
  })
}
