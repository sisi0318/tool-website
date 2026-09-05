// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest"
import { runPdfWorker, type PdfTaskResponse } from "./pdf-worker-client"

class FakeWorker {
  onmessage: ((event: MessageEvent<PdfTaskResponse>) => void) | null = null
  onerror: ((event: ErrorEvent) => void) | null = null
  terminate = vi.fn()
  postMessage = vi.fn()
  reply(data: PdfTaskResponse) { this.onmessage?.({ data } as MessageEvent<PdfTaskResponse>) }
}
afterEach(() => vi.useRealTimers())
describe("PDF worker lifecycle", () => {
  it("reports progress and terminates after a successful result", async () => {
    const worker = new FakeWorker(), progress = vi.fn()
    const pending = runPdfWorker({ type: "sample" }, { onProgress: progress }, () => worker as unknown as Worker)
    worker.reply({ type: "progress", progress: { stage: "reading", completed: 1, total: 2 } })
    worker.reply({ type: "done", value: { pages: 3 } })
    expect(await pending).toEqual({ pages: 3 }); expect(progress).toHaveBeenCalledWith({ stage: "reading", completed: 1, total: 2 }); expect(worker.terminate).toHaveBeenCalledOnce()
    expect(worker.onmessage).toBeNull()
  })
  it("rejects aborted work and ignores late replies", async () => {
    const worker = new FakeWorker(), controller = new AbortController()
    const pending = runPdfWorker({ type: "sample" }, { signal: controller.signal }, () => worker as unknown as Worker)
    const rejected = expect(pending).rejects.toMatchObject({ code: "cancelled" })
    controller.abort(); await rejected
    worker.reply({ type: "done", value: "stale" }); expect(worker.terminate).toHaveBeenCalledOnce()
  })
  it("bounds worker lifetime and rejects errors with their original code", async () => {
    vi.useFakeTimers()
    const worker = new FakeWorker(), pending = runPdfWorker({ type: "sample" }, {}, () => worker as unknown as Worker)
    const rejected = expect(pending).rejects.toMatchObject({ code: "timeout" })
    await vi.advanceTimersByTimeAsync(60000); await rejected
    expect(worker.terminate).toHaveBeenCalledOnce()
    const next = new FakeWorker(), failed = runPdfWorker({ type: "sample" }, {}, () => next as unknown as Worker)
    const denied = expect(failed).rejects.toMatchObject({ code: "flattenRequired" })
    next.reply({ type: "error", error: { code: "flattenRequired", detail: "form.pdf" } }); await denied
  })
})
