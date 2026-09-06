// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest"
import { vectorizeImage } from "./image-vector-worker-client"
import { VECTOR_LIMITS, type VectorWorkerResponse } from "./image-vector-shared"

class FakeWorker {
  onmessage: ((event: MessageEvent<VectorWorkerResponse>) => void) | null = null
  onerror: ((event: ErrorEvent) => void) | null = null
  terminate = vi.fn()
  postMessage = vi.fn()
  reply(data: VectorWorkerResponse) { this.onmessage?.({ data } as MessageEvent<VectorWorkerResponse>) }
}
const file = new File(["image"], "source.png")
const done: VectorWorkerResponse = { type: "done", svg: '<svg xmlns="http://www.w3.org/2000/svg"/>', info: { sourceWidth: 32, sourceHeight: 24, width: 32, height: 24, bytes: 44, paths: 0, elapsedMs: 10, semiTransparentPixels: 0, animated: false } }
afterEach(() => vi.useRealTimers())
describe("image vector worker lifecycle", () => {
  it("returns a real SVG file and terminates successful jobs", async () => {
    const worker = new FakeWorker(), progress = vi.fn(), pending = vectorizeImage(file, {}, { onProgress: progress }, () => worker as unknown as Worker)
    worker.reply({ type: "progress", stage: "tracing" }); worker.reply(done)
    const result = await pending
    expect(result.file.name).toBe("source.svg"); expect(result.file.type).toBe("image/svg+xml"); expect(await result.file.text()).toContain("<svg")
    expect(progress).toHaveBeenCalledWith("tracing"); expect(worker.terminate).toHaveBeenCalledOnce()
  })
  it("aborts CPU work and ignores already queued late messages", async () => {
    const worker = new FakeWorker(), controller = new AbortController(), progress = vi.fn()
    const pending = vectorizeImage(file, {}, { signal: controller.signal, onProgress: progress }, () => worker as unknown as Worker)
    const late = worker.onmessage!, rejected = expect(pending).rejects.toMatchObject({ code: "cancelled" })
    controller.abort(); await rejected; late({ data: { type: "progress", stage: "finishing" } } as MessageEvent<VectorWorkerResponse>)
    expect(progress).not.toHaveBeenCalled(); expect(worker.terminate).toHaveBeenCalledOnce()
  })
  it("bounds lifetime and rejects invalid input before creating workers", async () => {
    vi.useFakeTimers()
    const worker = new FakeWorker(), pending = vectorizeImage(file, {}, {}, () => worker as unknown as Worker), rejected = expect(pending).rejects.toMatchObject({ code: "timeout" })
    await vi.advanceTimersByTimeAsync(VECTOR_LIMITS.timeout); await rejected; expect(worker.terminate).toHaveBeenCalledOnce()
    const factory = vi.fn()
    await expect(vectorizeImage({ size: VECTOR_LIMITS.fileBytes + 1 } as File, {}, {}, factory)).rejects.toMatchObject({ code: "fileLimit" })
    expect(factory).not.toHaveBeenCalled()
  })
})
