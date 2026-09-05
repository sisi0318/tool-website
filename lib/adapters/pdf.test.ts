import { beforeEach, describe, expect, it, vi } from "vitest"
import { pdfAdapter, imagesToPdfAdapter, registerPdfAdapters } from "./pdf"
import { suggestNext } from "../journey/suggest"

const mocks = vi.hoisted(() => ({ inspect: vi.fn(), compose: vi.fn(), images: vi.fn() }))
vi.mock("../pdf-worker-client", () => ({ inspectPdfFiles: mocks.inspect, composePdfFiles: mocks.compose, imageFilesToPdf: mocks.images }))
beforeEach(() => vi.clearAllMocks())
describe("PDF file adapters", () => {
  it("inspects a single primary PDF without requiring the optional input", async () => {
    const file = new File(["fixture"], "input.pdf", { type: "application/pdf" })
    mocks.inspect.mockResolvedValue([{ pages: [{}, {}, {}] }])
    const result = await pdfAdapter.execute({ file }, {})
    expect(result.file).toBe(file); expect(result.pages).toBe(3)
    expect(mocks.inspect).toHaveBeenCalledWith([file], { signal: undefined })
  })
  it("passes order, rotation, splitting and explicit form choices to the shared processor", async () => {
    const file = new File(["first"], "a.pdf"), extra = new File(["second"], "b.pdf"), download = new File(["zip"], "split-pages.zip")
    mocks.compose.mockResolvedValue({ download, files: [{ file: new File(["page"], "part-001.pdf"), pages: 1 }], pages: 1, retainedForms: false, flattenedForms: true, droppedOutlines: false, changedSignatures: false })
    const result = await pdfAdapter.execute({ file, additionalFile: extra }, { operation: "split", selection: "2,1", rotation: 90, splitEvery: 1, numbering: true, flattenForms: true })
    expect(result.file).toBe(download)
    expect(mocks.compose).toHaveBeenCalledWith([file, extra], expect.objectContaining({ selection: "2,1", rotation: 90, splitEvery: 1, flattenForms: true, allowSignatureChanges: false, numbering: expect.objectContaining({ enabled: true }) }), { signal: undefined })
  })
  it("returns a PDF from image inputs and suggests compatible file operations", async () => {
    const file = new File(["image"], "image.png", { type: "image/png" }), download = new File(["PDF"], "images.pdf", { type: "application/pdf" })
    mocks.images.mockResolvedValue({ download, pages: 1 })
    expect((await imagesToPdfAdapter.execute({ file }, {})).file).toBe(download)
    registerPdfAdapters()
    expect(suggestNext(download, "bytes")[0]).toMatchObject({ tool: "pdf", outputPort: "info" })
    expect(suggestNext(file, "bytes").some((suggestion) => suggestion.tool === "images-to-pdf")).toBe(true)
  })
})
