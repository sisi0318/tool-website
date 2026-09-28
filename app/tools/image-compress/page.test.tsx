import React from "react"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import ImageCompressPage from "./page"
import type { BatchImageJob, ImageBatchOptions } from "@/lib/image-batch-shared"

type RunContext = { signal?: AbortSignal; onProgress?: (value: { current: number; total: number; name: string }) => void; onUpdate: (id: string, update: Partial<BatchImageJob>) => void }
interface Run { jobs: BatchImageJob[]; options: ImageBatchOptions; context: RunContext; finish: () => void }

const batch = vi.hoisted(() => ({ runs: [] as Run[], zip: vi.fn(async () => new Blob(["zip"], { type: "application/zip" })) }))
const download = vi.hoisted(() => vi.fn())
const toast = vi.hoisted(() => vi.fn())

// Worker 管线换成可控的假实现：每次调用记下来，由测试决定何时出结果
vi.mock("@/lib/image-batch", () => ({
  batchErrorCode: (error: unknown) => (error instanceof Error ? error.message : "batch:convert"),
  imageBatchZip: batch.zip,
  runImageBatch: (jobs: BatchImageJob[], options: ImageBatchOptions, context: RunContext) => new Promise<void>((resolve, reject) => {
    context.signal?.addEventListener("abort", () => reject(new Error("batch:cancelled")))
    batch.runs.push({ jobs, options, context, finish: resolve })
  }),
}))
vi.mock("@/lib/object-url", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/object-url")>()), downloadBlob: download }))
vi.mock("@/hooks/use-translations", () => { const translate = (key: string) => key; return { useTranslations: () => translate } })
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast }) }))

const png = (name: string, size = 100) => new File([new Uint8Array(size)], name, { type: "image/png" })

function finishRun(run: Run) {
  act(() => {
    for (const job of run.jobs) {
      run.context.onUpdate(job.id, { status: "running" })
      const output = new File([new Uint8Array(40)], `${job.base}.webp`, { type: "image/webp" })
      run.context.onUpdate(job.id, { status: "done", result: { files: [output], width: 10, height: 10, sourceWidth: 20, sourceHeight: 20, animated: false } })
    }
    run.finish()
  })
}

function addFiles(container: HTMLElement, files: File[]) {
  fireEvent.change(container.querySelector<HTMLInputElement>('input[type="file"]')!, { target: { files } })
}

beforeEach(() => {
  batch.runs = []
  batch.zip.mockClear()
  download.mockClear()
  toast.mockClear()
  window.localStorage.clear()
  let next = 0
  URL.createObjectURL = vi.fn(() => `blob:test-${++next}`)
  URL.revokeObjectURL = vi.fn()
})

describe("image compression", () => {
  it("compresses in the worker pipeline, keeping the format automatically, and downloads everything as one ZIP", async () => {
    const { container } = render(<ImageCompressPage />)
    addFiles(container, [png("a.png"), png("b.png")])

    expect(batch.runs).toHaveLength(1)
    expect(batch.runs[0].options).toMatchObject({ mode: "images", format: "auto", quality: 80, maxWidth: 0, maxHeight: 0 })
    expect(batch.runs[0].jobs.map((job) => job.base)).toEqual(["a_compressed", "b_compressed"])
    finishRun(batch.runs[0])

    // 统计里的压缩后总大小：两张各 40 B
    expect(await screen.findByText("80 B")).toBeInTheDocument()
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "downloadAll" })) })
    expect(batch.zip).toHaveBeenCalledTimes(1)
    expect((batch.zip.mock.calls[0] as unknown as [BatchImageJob[]])[0].map((job) => job.result?.files[0].name)).toEqual(["a_compressed.webp", "b_compressed.webp"])
    expect(download).toHaveBeenCalledWith(expect.any(Blob), "compressed-images.zip")
  })

  it("recompresses everything once after the settings settle, cancelling the run in progress", async () => {
    const { container } = render(<ImageCompressPage />)
    addFiles(container, [png("a.png"), png("b.png")])
    const first = batch.runs[0]

    fireEvent.change(screen.getByRole("spinbutton", { name: "maxWidth" }), { target: { value: "8" } })
    fireEvent.change(screen.getByRole("spinbutton", { name: "maxWidth" }), { target: { value: "800" } })
    await waitFor(() => expect(batch.runs).toHaveLength(2))
    expect(first.context.signal?.aborted).toBe(true)
    expect(batch.runs[1].options.maxWidth).toBe(800)
    expect(batch.runs[1].jobs).toHaveLength(2)
  })

  it("stops at the queue limits and can be cancelled and resumed", async () => {
    const { container } = render(<ImageCompressPage />)
    addFiles(container, Array.from({ length: 31 }, (_, index) => png(`${index}.png`)))
    expect(batch.runs[0].jobs).toHaveLength(30)
    expect(toast).toHaveBeenCalledWith({ title: "filesSkippedTitle", description: "skipped" })

    fireEvent.click(screen.getByRole("button", { name: "cancel" }))
    await waitFor(() => expect(toast).toHaveBeenLastCalledWith({ title: "cancelled" }))
    fireEvent.click(screen.getByRole("button", { name: "resume" }))
    expect(batch.runs).toHaveLength(2)
    expect(batch.runs[1].jobs).toHaveLength(30)
  })
})
