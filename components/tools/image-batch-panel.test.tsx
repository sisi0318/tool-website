import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import ImageBatchPanel from "./image-batch-panel"
import type { BatchImageJob } from "@/lib/image-batch-shared"
const mocks = vi.hoisted(() => ({ run: vi.fn() }))
vi.mock("@/lib/image-batch", () => ({ runImageBatch: mocks.run, imageBatchZip: vi.fn(), batchErrorCode: () => "batch:convert" }))
vi.mock("@/hooks/use-translations", () => { const t = (key: string) => key; return { useTranslations: () => t } })
vi.mock("@/hooks/use-object-url", () => ({ useObjectUrl: () => null }))
vi.mock("@/components/tools/send-to-menu", () => ({ SendToMenu: () => null }))
beforeEach(() => vi.clearAllMocks())
describe("batch queue UI", () => {
  it("retains completed files on cancel and resumes only the remaining files", async () => {
    let release: () => void = () => {}, signal: AbortSignal | undefined
    mocks.run.mockImplementation(async (jobs: BatchImageJob[], _options, context) => {
      signal = context.signal
      context.onUpdate(jobs[0].id, { status: "done", result: { files: [new File(["ok"], "one.txt")], width: 10, height: 10, animated: false } })
      context.onUpdate(jobs[1].id, { status: "running" })
      await new Promise<void>(done => { release = done })
      context.onUpdate(jobs[1].id, { status: "error", error: "ocr:engine" })
    })
    render(<ImageBatchPanel />)
    fireEvent.change(screen.getByLabelText("add", { selector: "input" }), { target: { files: [new File(["one"], "one.png"), new File(["two"], "two.png")] } })
    fireEvent.click(screen.getByRole("button", { name: "run (2)" }))
    await screen.findByRole("button", { name: "cancel" })
    fireEvent.click(screen.getByRole("button", { name: "cancel" }))
    await act(async () => release())
    expect(signal?.aborted).toBe(true)
    expect(screen.getByRole("button", { name: "run (1)" })).toBeEnabled()
    expect(screen.getByText("status_done")).toBeInTheDocument()
    expect(screen.queryByText("error_engine")).not.toBeInTheDocument()
    mocks.run.mockResolvedValue(undefined)
    fireEvent.click(screen.getByRole("button", { name: "run (1)" }))
    await waitFor(() => expect(mocks.run).toHaveBeenCalledTimes(2))
    expect(mocks.run.mock.calls[1][0].map((job: BatchImageJob) => job.file.name)).toEqual(["two.png"])
  })
})
