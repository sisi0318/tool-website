import React from "react"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import PdfDocumentPanel from "./pdf-document-panel"
import { PdfToolError } from "@/lib/pdf-shared"

const mocks = vi.hoisted(() => ({ sample: vi.fn(), compose: vi.fn() }))
vi.mock("@/lib/pdf-worker-client", () => ({ samplePdfFile: mocks.sample, composePdfFiles: mocks.compose, inspectPdfFiles: vi.fn() }))
vi.mock("@/hooks/use-translations", () => { const translate = (key: string) => key; return { useTranslations: () => translate } })
vi.mock("next/dynamic", () => ({ default: () => () => null }))
vi.mock("@/hooks/use-object-url", () => ({ useObjectUrl: (file: File | null) => file ? "blob:pdf-test" : null }))
vi.mock("@/components/tools/send-to-menu", () => ({ SendToMenu: () => null }))

beforeEach(() => {
  vi.clearAllMocks()
  mocks.sample.mockResolvedValue({ file: new File(["fixture"], "sample.pdf"), info: { name: "sample.pdf", pages: [0, 1, 2].map((page) => ({ page, width: 300, height: 400, rotation: 0, userUnit: 1 })), formFields: 0, signed: false, outlines: false, unsupportedForm: false } })
  const file = new File(["output"], "processed.pdf", { type: "application/pdf" })
  mocks.compose.mockResolvedValue({ files: [{ file, pages: 2 }], download: file, pages: 2, flattenedForms: false, retainedForms: false, droppedOutlines: false, changedSignatures: false })
})
describe("PDF document workbench", () => {
  it("applies page selection, per-page rotation and numbering to the generated result", async () => {
    render(<PdfDocumentPanel />)
    fireEvent.click(screen.getByRole("button", { name: "sample" }))
    await screen.findByRole("button", { name: "previewOriginal 3" })
    fireEvent.change(screen.getByRole("textbox", { name: "orderInput" }), { target: { value: "3,1" } })
    fireEvent.click(screen.getByRole("button", { name: "applyOrder" }))
    await waitFor(() => expect(screen.getAllByRole("checkbox", { name: /includePage/ })).toHaveLength(2))
    fireEvent.click(screen.getByRole("button", { name: "rotatePage 1" }))
    fireEvent.click(screen.getByRole("switch", { name: "addNumbers" }))
    fireEvent.click(screen.getByRole("button", { name: "generatePdf" }))
    await screen.findByRole("link", { name: "downloadPdf" })
    expect(mocks.compose).toHaveBeenCalledWith(expect.any(Array), expect.objectContaining({ pages: [{ source: 0, page: 2, rotation: 90 }, { source: 0, page: 0, rotation: 0 }], numbering: expect.objectContaining({ enabled: true }), flattenForms: false }), expect.objectContaining({ signal: expect.any(AbortSignal) }))
    fireEvent.click(screen.getByRole("checkbox", { name: "includePage 1" }))
    expect(screen.queryByRole("link", { name: "downloadPdf" })).not.toBeInTheDocument()
  })
  it("keeps flattening opt-in for interactive forms", async () => {
    const value = await mocks.sample()
    mocks.sample.mockResolvedValue({ ...value, info: { ...value.info, formFields: 1 } })
    mocks.compose.mockRejectedValueOnce(new PdfToolError("flattenRequired"))
    render(<PdfDocumentPanel />)
    fireEvent.click(screen.getByRole("button", { name: "sample" }))
    expect(await screen.findByRole("checkbox", { name: "flattenForms" })).not.toBeChecked()
    fireEvent.click(screen.getByRole("button", { name: "generatePdf" }))
    await screen.findByRole("alert")
    expect(mocks.compose.mock.calls[0][1].flattenForms).toBe(false)
    fireEvent.click(screen.getByRole("checkbox", { name: "flattenForms" }))
    fireEvent.click(screen.getByRole("button", { name: "generatePdf" }))
    await screen.findByRole("link", { name: "downloadPdf" })
    expect(mocks.compose.mock.calls[1][1].flattenForms).toBe(true)
  })
})
