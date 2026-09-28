// @vitest-environment node
import { describe, expect, it, vi } from "vitest"
import { runWorkerTask } from "./worker-task"

function fakeWorker() {
  return { onmessage: null as null | ((event: MessageEvent) => void), onerror: null, postMessage: vi.fn(), terminate: vi.fn() }
}

describe("one-shot worker tasks", () => {
  it("sends the request once the worker is ready, passes progress on and releases the worker", async () => {
    const worker = fakeWorker(), onProgress = vi.fn()
    const pending = runWorkerTask<string[]>(worker as unknown as Worker, { job: 1 }, { onProgress })
    expect(worker.postMessage).not.toHaveBeenCalled()
    worker.onmessage!({ data: { ready: true } } as MessageEvent)
    worker.onmessage!({ data: { ready: true } } as MessageEvent)
    expect(worker.postMessage).toHaveBeenCalledOnce()
    expect(worker.postMessage).toHaveBeenCalledWith({ job: 1 }, [])

    worker.onmessage!({ data: { progress: 42 } } as MessageEvent)
    worker.onmessage!({ data: { result: ["a", "b"] } } as MessageEvent)
    await expect(pending).resolves.toEqual(["a", "b"])
    expect(onProgress).toHaveBeenCalledWith(42)
    expect(worker.terminate).toHaveBeenCalledOnce()
  })

  it("rejects with the worker's error message", async () => {
    const worker = fakeWorker()
    const pending = runWorkerTask(worker as unknown as Worker, {})
    worker.onmessage!({ data: { ready: true } } as MessageEvent)
    worker.onmessage!({ data: { error: "bad input" } } as MessageEvent)
    await expect(pending).rejects.toThrow("bad input")
    expect(worker.terminate).toHaveBeenCalledOnce()
  })

  it("stops the worker when cancelled and ignores whatever it sends afterwards", async () => {
    const worker = fakeWorker(), controller = new AbortController()
    const pending = runWorkerTask(worker as unknown as Worker, {}, { signal: controller.signal })
    const late = worker.onmessage!
    const rejection = expect(pending).rejects.toMatchObject({ name: "AbortError" })
    controller.abort()
    await rejection
    late({ data: { result: "stale" } } as MessageEvent)
    expect(worker.terminate).toHaveBeenCalledOnce()
  })

  it("does not start a task that was already cancelled", async () => {
    const worker = fakeWorker(), controller = new AbortController()
    controller.abort()
    await expect(runWorkerTask(worker as unknown as Worker, {}, { signal: controller.signal })).rejects.toMatchObject({ name: "AbortError" })
    expect(worker.terminate).toHaveBeenCalledOnce()
  })
})
