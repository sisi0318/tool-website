import React from "react"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import PdfOcrPanel from "./pdf-ocr-panel"
import type { PdfOcrPage } from "@/lib/pdf-ocr-shared"
import { PdfToolError } from "@/lib/pdf-shared"

const mocks = vi.hoisted(() => ({ sample: vi.fn(), inspect: vi.fn(), recognize: vi.fn(), export: vi.fn() }))
vi.mock("@/lib/pdf-ocr-client", () => ({ sampleOcrPdf: mocks.sample, recognizePdf: mocks.recognize, exportSearchablePdf: mocks.export }))
vi.mock("@/lib/pdf-worker-client", () => ({ inspectPdfFiles: mocks.inspect }))
vi.mock("@/hooks/use-translations", () => { const translate = (key: string) => key; return { useTranslations: () => translate } })
vi.mock("@/hooks/use-object-url", () => ({ useObjectUrl: (blob: Blob | null) => blob ? "blob:pdf-test" : null }))
vi.mock("@/components/tools/send-to-menu", () => ({ SendToMenu: () => null }))
vi.mock("./pdf-preview", () => ({ default: () => null }))
const download = vi.hoisted(() => vi.fn())
vi.mock("@/lib/object-url", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/object-url")>()), downloadBlob: download }))
const page: PdfOcrPage = { sourcePage: 2, width: 300, height: 200, pixelWidth: 600, pixelHeight: 400, image: new Blob(), preview: new Blob(), lines: [{ id: 0, text: "校对前", score: .87, poly: [[10, 10], [200, 10], [200, 30], [10, 30]] }] }
beforeEach(() => {
  vi.clearAllMocks()
  mocks.sample.mockResolvedValue(new File(["scan"], "scan.pdf"))
  mocks.inspect.mockResolvedValue([{ name: "scan.pdf", pages: [{ page: 0 }, { page: 1 }], unsupportedForm: false }])
  mocks.recognize.mockResolvedValue([page])
  mocks.export.mockResolvedValue(new Blob(["searchable"], { type: "application/pdf" }))
})
async function load() { fireEvent.click(screen.getByRole("button", { name: "sample" })); await waitFor(() => expect(screen.getByRole("button", { name: "recognize" })).toBeEnabled()) }
describe("PDF OCR review", () => {
  it("explains an oversized source scan and offers no export", async () => {
    mocks.recognize.mockRejectedValue(new PdfToolError("sourceImageLimit"))
    render(<PdfOcrPanel />); await load()
    fireEvent.click(screen.getByRole("button", { name: "recognize" }))
    expect(await screen.findByRole("alert")).toHaveTextContent("error_sourceImageLimit")
    expect(screen.queryByRole("button", { name: "generate" })).not.toBeInTheDocument()
    expect(screen.queryByRole("link", { name: "download" })).not.toBeInTheDocument()
  })
  it("exports corrected text and invalidates stale downloads after editing", async () => {
    render(<PdfOcrPanel />); await load()
    fireEvent.change(screen.getByRole("textbox", { name: "selection" }), { target: { value: "2,1" } })
    fireEvent.click(screen.getByRole("button", { name: "recognize" }))
    const line = await screen.findByRole("textbox", { name: "1" })
    expect(mocks.recognize.mock.calls[0][1]).toEqual({ selection: "2,1", dpi: 200, rotation: 0 })
    fireEvent.change(line, { target: { value: "校对后 1280.50" } })
    expect(screen.getByRole("textbox", { name: "allText" })).toHaveValue("校对后 1280.50")
    fireEvent.click(screen.getByRole("button", { name: "generate" }))
    await screen.findByRole("link", { name: "download" })
    expect(download).toHaveBeenCalledWith(expect.any(Blob), "scan-searchable.pdf")
    expect(mocks.export.mock.calls[0][0][0].lines[0].text).toBe("校对后 1280.50")
    fireEvent.change(line, { target: { value: "再校对" } })
    expect(screen.queryByRole("link", { name: "download" })).not.toBeInTheDocument()
    fireEvent.change(screen.getByRole("textbox", { name: "selection" }), { target: { value: "3" } })
    expect(screen.getByRole("button", { name: "recognize" })).toBeDisabled()
    // 改页码不再清掉已识别和校对过的结果，只标成过期
    expect(screen.getByRole("textbox", { name: "allText" })).toHaveValue("再校对")
    expect(screen.getByText("staleResult")).toBeInTheDocument()
  })
  it("asks before recognizing again would discard corrections", async () => {
    render(<PdfOcrPanel />); await load()
    fireEvent.click(screen.getByRole("button", { name: "recognize" }))
    fireEvent.change(await screen.findByRole("textbox", { name: "1" }), { target: { value: "已校对" } })
    fireEvent.change(screen.getByLabelText("resolution"), { target: { value: "300" } })
    fireEvent.click(screen.getByRole("button", { name: "recognize" }))
    expect(screen.getByRole("alert")).toHaveTextContent("confirmRerun")
    expect(mocks.recognize).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole("button", { name: "keepEdits" }))
    expect(screen.getByRole("textbox", { name: "allText" })).toHaveValue("已校对")
    fireEvent.click(screen.getByRole("button", { name: "recognize" }))
    fireEvent.click(screen.getByRole("button", { name: "rerunAnyway" }))
    await waitFor(() => expect(mocks.recognize).toHaveBeenCalledTimes(2))
    expect(mocks.recognize.mock.calls[1][1]).toMatchObject({ dpi: 300 })
    await waitFor(() => expect(screen.getByRole("textbox", { name: "allText" })).toHaveValue("校对前"))
  })
  it("keeps recognizing while its tab is hidden and reports that it is busy", async () => {
    let resolve: (value: PdfOcrPage[]) => void = () => {}
    mocks.recognize.mockImplementation(() => new Promise<PdfOcrPage[]>(done => { resolve = done }))
    const onBusyChange = vi.fn()
    const view = render(<PdfOcrPanel onBusyChange={onBusyChange} />); await load()
    fireEvent.click(screen.getByRole("button", { name: "recognize" }))
    const signal = mocks.recognize.mock.calls[0][2].signal as AbortSignal
    view.rerender(<PdfOcrPanel isActive={false} onBusyChange={onBusyChange} />)
    expect(signal.aborted).toBe(false)
    expect(onBusyChange).toHaveBeenLastCalledWith(true)
    await act(async () => resolve([page]))
    expect(onBusyChange).toHaveBeenLastCalledWith(false)
    view.rerender(<PdfOcrPanel isActive onBusyChange={onBusyChange} />)
    expect(screen.getByRole("textbox", { name: "allText" })).toHaveValue("校对前")
  })
})
