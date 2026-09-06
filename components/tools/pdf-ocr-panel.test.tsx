import React from "react"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import PdfOcrPanel from "./pdf-ocr-panel"
import type { PdfOcrPage } from "@/lib/pdf-ocr-shared"

const mocks = vi.hoisted(() => ({ sample: vi.fn(), inspect: vi.fn(), recognize: vi.fn(), export: vi.fn() }))
vi.mock("@/lib/pdf-ocr-client", () => ({ sampleOcrPdf: mocks.sample, recognizePdf: mocks.recognize, exportSearchablePdf: mocks.export }))
vi.mock("@/lib/pdf-worker-client", () => ({ inspectPdfFiles: mocks.inspect }))
vi.mock("@/hooks/use-translations", () => { const translate = (key: string) => key; return { useTranslations: () => translate } })
vi.mock("@/hooks/use-object-url", () => ({ useObjectUrl: (blob: Blob | null) => blob ? "blob:pdf-test" : null }))
vi.mock("@/components/tools/send-to-menu", () => ({ SendToMenu: () => null }))
vi.mock("./pdf-preview", () => ({ default: () => null }))
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
    expect(mocks.export.mock.calls[0][0][0].lines[0].text).toBe("校对后 1280.50")
    fireEvent.change(line, { target: { value: "再校对" } })
    expect(screen.queryByRole("link", { name: "download" })).not.toBeInTheDocument()
    fireEvent.change(screen.getByRole("textbox", { name: "selection" }), { target: { value: "3" } })
    expect(screen.getByRole("button", { name: "recognize" })).toBeDisabled()
    expect(screen.queryByRole("textbox", { name: "allText" })).not.toBeInTheDocument()
  })
  it("cancels on hide and discards a completion from the old run", async () => {
    let resolve: (value: PdfOcrPage[]) => void = () => {}
    mocks.recognize.mockImplementation(() => new Promise<PdfOcrPage[]>(done => { resolve = done }))
    const view = render(<PdfOcrPanel />); await load()
    fireEvent.click(screen.getByRole("button", { name: "recognize" }))
    const signal = mocks.recognize.mock.calls[0][2].signal as AbortSignal
    view.rerender(<PdfOcrPanel isActive={false} />)
    expect(signal.aborted).toBe(true)
    await act(async () => resolve([page]))
    view.rerender(<PdfOcrPanel isActive />)
    expect(screen.queryByRole("textbox", { name: "allText" })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "recognize" })).toBeEnabled()
  })
})
