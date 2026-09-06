// @vitest-environment node
import { describe, expect, it, vi } from "vitest"
import { imageBatchZip, runImageBatch, transformBatchImage } from "./image-batch"
import { batchCombinedText, batchOcrResult, batchOptions, DEFAULT_BATCH_OPTIONS, uniqueImageBase, type BatchImageJob, type BatchImageResult } from "./image-batch-shared"
import { unzipSync, strFromU8 } from "fflate"

const makeJob = (id: string): BatchImageJob => ({ id, base: id, file: new File([id], `${id}.png`), status: "ready" })
const makeResult = (name: string): BatchImageResult => ({ files: [new File([name], `${name}.webp`, { type: "image/webp" })], width: 10, height: 10, animated: false })
describe("batch image processing", () => {
  it("allocates stable portable names across extensions, suffixes, case and Unicode", () => {
    const names = new Set<string>()
    expect(["scan.png", "scan.jpg", "scan-2.png", "SCAN.webp", "../CON.png", "CON.png", "é.png", "e\u0301.png"].map(name => uniqueImageBase(name, names))).toEqual(["scan", "scan-2", "scan-2-2", "SCAN-3", "_CON", "_CON-2", "é", "é-2"])
  })
  it("continues after a bad file and keeps successful neighbors in order", async () => {
    const updates: Array<[string, Partial<BatchImageJob>]> = [], dispose = vi.fn(), process = vi.fn(async (job: BatchImageJob) => { if (job.id === "bad") throw new Error("ocr:format"); return makeResult(job.id) })
    await runImageBatch([makeJob("first"), makeJob("bad"), makeJob("last")], DEFAULT_BATCH_OPTIONS, { onUpdate: (id, value) => updates.push([id, value]) }, () => ({ process, dispose }))
    expect(updates.filter(([, value]) => value.status !== "running").map(([id, value]) => [id, value.status])).toEqual([["first", "done"], ["bad", "error"], ["last", "done"]])
    expect(updates[3][1].error).toBe("ocr:format"); expect(dispose).toHaveBeenCalledOnce()
  })
  it("stops between files after cancellation and always releases the processor", async () => {
    const controller = new AbortController(), dispose = vi.fn(), process = vi.fn(async (job: BatchImageJob) => makeResult(job.id))
    const updates: Array<[string, Partial<BatchImageJob>]> = []
    await expect(runImageBatch([makeJob("first"), makeJob("last")], DEFAULT_BATCH_OPTIONS, { signal: controller.signal, onUpdate: (id, update) => { updates.push([id, update]); if (update.status === "done") controller.abort() } }, () => ({ process, dispose }))).rejects.toMatchObject({ code: "cancelled" })
    expect(process).toHaveBeenCalledOnce(); expect(updates.at(-1)?.[1].status).toBe("done"); expect(dispose).toHaveBeenCalledOnce()
  })
  it("exports reviewed OCR text and a manifest without colliding with source names", async () => {
    const result = batchOcrResult({ text: "原文", lines: [], preview: new Blob(), info: { width: 10, height: 10, rotation: 0, tiles: 1, elapsedMs: 1, animated: false } }, "manifest", "校对后")
    const jobs: BatchImageJob[] = [{ ...makeJob("manifest"), status: "done", result }, { ...makeJob("bad"), status: "error", error: "ocr:format" }, makeJob("pending")]
    const zip = unzipSync(new Uint8Array(await (await imageBatchZip(jobs, DEFAULT_BATCH_OPTIONS)).arrayBuffer()))
    expect(Object.keys(zip).sort()).toEqual(["data/manifest.json", "manifest.json", "text/manifest.txt"])
    expect(strFromU8(zip["text/manifest.txt"])).toBe("校对后")
    expect(JSON.parse(strFromU8(zip["data/manifest.json"]))).toMatchObject({ text: "校对后", originalText: "原文" })
    expect(JSON.parse(strFromU8(zip["manifest.json"])).files.map((file: { status: string }) => file.status)).toEqual(["done", "error", "ready"])
    expect(batchCombinedText(jobs)).toBe("--- manifest.png ---\n校对后")
  })
  it("terminates an in-flight conversion on abort and ignores late completion", async () => {
    const worker = { onmessage: null as null | ((event: MessageEvent) => void), onerror: null, terminate: vi.fn(), postMessage: vi.fn() }, controller = new AbortController()
    const pending = transformBatchImage(makeJob("image").file, "image", DEFAULT_BATCH_OPTIONS, controller.signal, () => worker as unknown as Worker)
    const late = worker.onmessage!, rejection = expect(pending).rejects.toMatchObject({ code: "cancelled" }); controller.abort(); await rejection
    late({ data: { result: makeResult("stale") } } as MessageEvent)
    expect(worker.terminate).toHaveBeenCalledOnce()
  })
  it("sends work only after the converter is ready and releases it after success", async () => {
    const worker = { onmessage: null as null | ((event: MessageEvent) => void), onerror: null, terminate: vi.fn(), postMessage: vi.fn() }
    const pending = transformBatchImage(makeJob("image").file, "image", DEFAULT_BATCH_OPTIONS, undefined, () => worker as unknown as Worker)
    expect(worker.postMessage).not.toHaveBeenCalled()
    worker.onmessage!({ data: { ready: true } } as MessageEvent)
    worker.onmessage!({ data: { ready: true } } as MessageEvent)
    expect(worker.postMessage).toHaveBeenCalledOnce()
    worker.onmessage!({ data: { result: makeResult("image") } } as MessageEvent)
    expect((await pending).files[0].name).toBe("image.webp"); expect(worker.terminate).toHaveBeenCalledOnce()
  })
  it("rejects unbounded dimensions and invalid quality", () => {
    expect(() => batchOptions({ maxWidth: Infinity })).toThrow("options")
    expect(() => batchOptions({ quality: NaN })).toThrow("options")
    expect(() => batchOptions({ maxHeight: -1 })).toThrow("options")
  })
})
