import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { recognizePdf } from "./pdf-ocr-client"
import { PdfToolError } from "./pdf-shared"

const mocks = vi.hoisted(() => ({ getDocument: vi.fn(), recognize: vi.fn(), dispose: vi.fn(), render: vi.fn(), destroy: vi.fn(), preflight: vi.fn() }))
vi.mock("./pdf-worker-client", () => ({ preflightPdfOcrFile: mocks.preflight }))
vi.mock("./pdfjs-runtime", async importOriginal => ({
  ...await importOriginal<typeof import("./pdfjs-runtime")>(),
  loadPdfJs: async () => ({ version: "test", PDFWorker: { create: () => ({ destroy: vi.fn() }) }, getDocument: mocks.getDocument }),
}))
vi.mock("./ocr-worker-client", () => ({ createOcrSession: () => ({ recognize: mocks.recognize, dispose: mocks.dispose }) }))

beforeEach(() => {
  vi.clearAllMocks()
  mocks.preflight.mockResolvedValue(undefined)
  const canvas = { width: 0, height: 0, toBlob: (callback: (blob: Blob) => void) => callback(new Blob(["png"], { type: "image/png" })) }
  vi.spyOn(document, "createElement").mockReturnValue(canvas as unknown as HTMLCanvasElement)
  mocks.destroy.mockResolvedValue(undefined)
  mocks.getDocument.mockReturnValue({ promise: Promise.resolve({ numPages: 1, getPage: async () => ({ rotate: 0, getViewport: ({ scale }: { scale: number }) => ({ width: 600 * scale, height: 600 * scale }), render: mocks.render, cleanup: vi.fn() }) }), destroy: mocks.destroy })
  mocks.recognize.mockResolvedValue({ lines: [], preview: new Blob(["preview"]) })
})
afterEach(() => vi.restoreAllMocks())
const input = () => ({ size: 100, arrayBuffer: async () => new ArrayBuffer(100) } as File)

describe("PDF OCR rendering integrity", () => {
  it("stops before PDF.js or OCR when source-image preflight fails", async () => {
    mocks.preflight.mockRejectedValue(new PdfToolError("sourceImageLimit"))
    await expect(recognizePdf(input(), { selection: "1", dpi: 200, rotation: 0 })).rejects.toMatchObject({ code: "sourceImageLimit" })
    expect(mocks.getDocument).not.toHaveBeenCalled()
    expect(mocks.recognize).not.toHaveBeenCalled()
    expect(mocks.dispose).toHaveBeenCalledOnce()
  })
  it("rejects an oversized source image instead of accepting a blank page", async () => {
    mocks.render.mockImplementation(() => ({ promise: Promise.reject(new Error("Image exceeded maximum allowed size and was removed.")), cancel: vi.fn() }))
    await expect(recognizePdf(input(), { selection: "", dpi: 200, rotation: 0 })).rejects.toMatchObject({ code: "sourceImageLimit" })
    expect(mocks.getDocument).toHaveBeenCalledWith(expect.objectContaining({ maxImageSize: 20_000_000, stopAtErrors: true }))
    expect(mocks.recognize).not.toHaveBeenCalled()
    expect(mocks.destroy).toHaveBeenCalledOnce()
    expect(mocks.dispose).toHaveBeenCalledOnce()
  })
  it("continues recognizing valid rendered pages in strict mode", async () => {
    mocks.render.mockReturnValue({ promise: Promise.resolve(), cancel: vi.fn() })
    const pages = await recognizePdf(input(), { selection: "", dpi: 200, rotation: 0 })
    expect(pages).toHaveLength(1)
    expect(pages[0]).toMatchObject({ sourcePage: 1, width: 600, height: 600 })
    expect(mocks.recognize).toHaveBeenCalledOnce()
  })
})
