import { act, fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import ImageRedactPanel from "./image-redact-panel"
const mocks = vi.hoisted(() => ({ run: vi.fn(), ocr: vi.fn() }))
vi.mock("@/lib/image-redact", () => ({ runRedactImage: mocks.run, createRedactSample: vi.fn() }))
vi.mock("@/lib/ocr-worker-client", () => ({ recognizeImage: mocks.ocr }))
vi.mock("@/hooks/use-translations", () => { const t = (key: string) => key; return { useTranslations: () => t } })
vi.mock("@/hooks/use-object-url", () => ({ useObjectUrl: (value: unknown) => value ? "blob:preview" : null }))
vi.mock("@/components/tools/send-to-menu", () => ({ SendToMenu: () => null }))
const prepared = { width: 200, height: 100, preview: new Blob(), animated: false }
const upload = () => fireEvent.change(screen.getByLabelText("upload", { selector: "input" }), { target: { files: [new File(["image"], "image.png")] } })
beforeEach(() => { vi.clearAllMocks(); mocks.run.mockResolvedValue(prepared) })

describe("redaction review and export", () => {
  it("requires confirmation and invalidates a previous export when selection changes", async () => {
    render(<ImageRedactPanel />); upload(); await screen.findByRole("button", { name: "manual" })
    fireEvent.click(screen.getByRole("button", { name: "manual" }))
    expect(mocks.run).toHaveBeenCalledTimes(1)
    mocks.run.mockResolvedValue({ ...prepared, output: new File(["redacted"], "image-redacted.png") })
    fireEvent.click(screen.getByRole("button", { name: "apply (1)" }))
    await screen.findByRole("link", { name: "download" })
    expect(mocks.run.mock.calls[1][0]).toMatchObject({ action: "render", color: "black", regions: [{ x: 60, y: 30, width: 80, height: 10 }] })
    fireEvent.click(screen.getByLabelText("selectRegion 1"))
    expect(screen.queryByRole("link", { name: "download" })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "apply (0)" })).toBeDisabled()
    fireEvent.click(screen.getByRole("button", { name: "undo" })); expect(screen.getByRole("button", { name: "apply (1)" })).toBeEnabled()
  })
  it("keeps manual masks after detection and never accepts a cancelled late scan", async () => {
    let resolve: (value: unknown) => void = () => {}, signal: AbortSignal | undefined
    mocks.ocr.mockImplementation((_file, _options, context) => { signal = context.signal; return new Promise(done => { resolve = done }) })
    render(<ImageRedactPanel />); upload(); await screen.findByRole("button", { name: "manual" })
    fireEvent.click(screen.getByRole("button", { name: "manual" }))
    const result = { info: { width: 200, height: 100 }, lines: [{ id: 1, text: "hello@example.com", poly: [[0, 50], [190, 50], [190, 70], [0, 70]] }] }
    fireEvent.click(screen.getByRole("button", { name: "detect" })); await act(async () => resolve(result))
    expect(screen.getByRole("button", { name: "apply (2)" })).toBeEnabled()
    fireEvent.click(screen.getByRole("button", { name: "detect" })); fireEvent.click(screen.getByRole("button", { name: "cancel" }))
    expect(signal?.aborted).toBe(true)
    await act(async () => resolve({ ...result, lines: [] }))
    expect(screen.getByRole("button", { name: "apply (2)" })).toBeEnabled()
  })
})
