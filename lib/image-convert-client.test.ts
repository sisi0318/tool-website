// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest"
import { convertImageInWorker } from "./image-convert-client"
import { WORKER_CANVAS_UNAVAILABLE, type ImageConvertResult } from "./image-convert"

const mainThread = vi.hoisted(() => vi.fn())
vi.mock("./image-convert", async (importOriginal) => ({ ...(await importOriginal<typeof import("./image-convert")>()), convertImageFile: mainThread }))

const file = new File(["x"], "photo.png", { type: "image/png" })
const options = { format: "gif" as const, quality: 0.8 }
const result: ImageConvertResult = { file: new File(["gif"], "photo.gif", { type: "image/gif" }), width: 2, height: 2, originalWidth: 2, originalHeight: 2, mimeType: "image/gif" }

function fakeWorker() {
  return { onmessage: null as null | ((event: MessageEvent) => void), onerror: null, postMessage: vi.fn(), terminate: vi.fn() }
}

beforeEach(() => {
  mainThread.mockReset()
  mainThread.mockResolvedValue(result)
})

describe("image conversion in a worker", () => {
  it("converts in the worker without touching the main-thread converter", async () => {
    const worker = fakeWorker()
    const pending = convertImageInWorker(file, options, {}, () => worker as unknown as Worker)
    worker.onmessage!({ data: { ready: true } } as MessageEvent)
    expect(worker.postMessage).toHaveBeenCalledWith({ file, options }, [])
    worker.onmessage!({ data: { result } } as MessageEvent)
    await expect(pending).resolves.toBe(result)
    expect(mainThread).not.toHaveBeenCalled()
  })

  it("falls back to the main thread when the worker cannot draw, or cannot be created at all", async () => {
    const worker = fakeWorker()
    const pending = convertImageInWorker(file, options, {}, () => worker as unknown as Worker)
    worker.onmessage!({ data: { ready: true } } as MessageEvent)
    worker.onmessage!({ data: { error: WORKER_CANVAS_UNAVAILABLE } } as MessageEvent)
    await expect(pending).resolves.toBe(result)

    await expect(convertImageInWorker(file, options, {}, () => { throw new ReferenceError("Worker is not defined") })).resolves.toBe(result)
    expect(mainThread).toHaveBeenCalledTimes(2)
  })

  it("reports real conversion errors instead of retrying them", async () => {
    const worker = fakeWorker()
    const pending = convertImageInWorker(file, { format: "avif", quality: 0.8 }, {}, () => worker as unknown as Worker)
    worker.onmessage!({ data: { ready: true } } as MessageEvent)
    worker.onmessage!({ data: { error: "FORMAT_NOT_SUPPORTED" } } as MessageEvent)
    await expect(pending).rejects.toThrow("FORMAT_NOT_SUPPORTED")
    expect(mainThread).not.toHaveBeenCalled()
  })
})
