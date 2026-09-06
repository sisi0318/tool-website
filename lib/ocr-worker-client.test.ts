// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest"
import { recognizeImage } from "./ocr-worker-client"
import { OCR_LIMITS, type OcrResponse } from "./ocr-shared"
class FakeWorker {
  onmessage: ((event: MessageEvent<OcrResponse>) => void) | null = null
  onerror: ((event: ErrorEvent) => void) | null = null
  terminate = vi.fn(); postMessage = vi.fn()
  reply(data: OcrResponse) { this.onmessage?.({ data } as MessageEvent<OcrResponse>) }
}
const file = new File(["image"], "sample.png")
const done: OcrResponse = { type: "done", result: { text: "hello", lines: [], preview: new Blob(), info: { width: 10, height: 10, rotation: 0, tiles: 1, elapsedMs: 1, animated: false } } }
afterEach(() => vi.useRealTimers())
describe("OCR worker lifecycle", () => {
  it("passes progress and returns text while releasing the model worker", async () => {
    const worker = new FakeWorker(), onProgress = vi.fn(), pending = recognizeImage(file, {}, { onProgress }, () => worker as unknown as Worker)
    worker.reply({ type: "progress", progress: { stage: "models", completed: 500, total: 1000 } }); worker.reply(done)
    expect((await pending).text).toBe("hello"); expect(onProgress).toHaveBeenCalledWith({ stage: "models", completed: 500, total: 1000 }); expect(worker.terminate).toHaveBeenCalledOnce()
  })
  it("terminates in-flight models and ignores late completion after cancellation", async () => {
    const worker = new FakeWorker(), controller = new AbortController(), onProgress = vi.fn()
    const pending = recognizeImage(file, {}, { signal: controller.signal, onProgress }, () => worker as unknown as Worker)
    const late = worker.onmessage!, rejected = expect(pending).rejects.toMatchObject({ code: "cancelled" })
    controller.abort(); await rejected; late({ data: done } as MessageEvent<OcrResponse>)
    expect(onProgress).not.toHaveBeenCalled(); expect(worker.terminate).toHaveBeenCalledOnce()
  })
  it("handles model errors, bounds total lifetime, and avoids spawning on invalid input", async () => {
    const worker = new FakeWorker(), factory = vi.fn(() => worker as unknown as Worker)
    const pending = recognizeImage(file, {}, {}, factory), rejected = expect(pending).rejects.toMatchObject({ code: "model" })
    worker.reply({ type: "error", code: "model" }); await rejected
    vi.useFakeTimers()
    const timed = recognizeImage(file, {}, {}, factory), timeout = expect(timed).rejects.toMatchObject({ code: "timeout" })
    await vi.advanceTimersByTimeAsync(OCR_LIMITS.timeout); await timeout
    factory.mockClear()
    await expect(recognizeImage({ size: OCR_LIMITS.fileBytes + 1 } as File, {}, {}, factory)).rejects.toMatchObject({ code: "fileLimit" })
    await expect(recognizeImage(file, { rotation: 25 as 90 }, {}, factory)).rejects.toMatchObject({ code: "options" })
    expect(factory).not.toHaveBeenCalled()
  })
})
