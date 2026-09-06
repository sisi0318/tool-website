import React from "react"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import ImageToSvgPage from "./page"
import type { ImageVectorResult } from "@/lib/image-vector-shared"

const mocks = vi.hoisted(() => ({ run: vi.fn(), sample: vi.fn(), objectUrl: vi.fn(), staleUrl: false }))
vi.mock("@/lib/image-vector-worker-client", () => ({ vectorizeImage: mocks.run }))
vi.mock("@/lib/image-vector-samples", () => ({ createVectorSample: mocks.sample }))
vi.mock("@/hooks/use-translations", () => { const translate = (key: string) => key; return { useTranslations: () => translate } })
vi.mock("@/hooks/use-object-url", () => ({ useObjectUrl: (file: File | null) => { mocks.objectUrl(file); return file ? `blob:test-${file.name}` : mocks.staleUrl ? "blob:previous-result" : null } }))
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }))
vi.mock("@/components/tools/send-to-menu", () => ({ SendToMenu: () => null }))
vi.mock("@/components/ui/select", () => ({
  Select: ({ value, onValueChange, disabled, children }: { value: string; onValueChange: (value: string) => void; disabled?: boolean; children: React.ReactNode }) => <select value={value} disabled={disabled} onChange={event => onValueChange(event.target.value)}>{children}</select>,
  SelectTrigger: () => null, SelectValue: () => null,
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) => <option value={value}>{children}</option>,
}))
function file(width = 16, height = 16) {
  const bytes = new Uint8Array(33), view = new DataView(bytes.buffer)
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10]); view.setUint32(8, 13); bytes.set([73, 72, 68, 82], 12); view.setUint32(16, width); view.setUint32(20, height)
  const image = new File([bytes], "test.png", { type: "image/png" })
  Object.defineProperty(image, "arrayBuffer", { value: async () => bytes.buffer })
  return image
}
const output: ImageVectorResult = { svg: "<svg/>", file: new File(["<svg/>"], "test.svg", { type: "image/svg+xml" }), info: { sourceWidth: 16, sourceHeight: 16, width: 16, height: 16, paths: 1, bytes: 6, elapsedMs: 4, semiTransparentPixels: 0, animated: false } }
beforeEach(() => { vi.clearAllMocks(); mocks.staleUrl = false; mocks.sample.mockResolvedValue(file()); mocks.run.mockResolvedValue(output) })
describe("image vector workbench", () => {
  it("exports completed work and invalidates it when tracing options change", async () => {
    render(<ImageToSvgPage />)
    fireEvent.click(screen.getByRole("button", { name: "sample_icon" }))
    await waitFor(() => expect(screen.getByRole("button", { name: "convert" })).toBeEnabled())
    fireEvent.click(screen.getByRole("button", { name: "convert" }))
    expect(await screen.findByRole("link", { name: "download" })).toHaveAttribute("download", "test.svg")
    expect(mocks.run).toHaveBeenCalledWith(expect.any(File), expect.objectContaining({ tracing: "faithful", colorPrecision: "fine" }), expect.objectContaining({ signal: expect.any(AbortSignal) }))
    mocks.staleUrl = true
    fireEvent.change(screen.getAllByRole("combobox")[0], { target: { value: "smooth" } })
    expect(screen.queryByRole("link", { name: "download" })).not.toBeInTheDocument()
    expect(screen.queryByRole("img", { name: "svgPreview" })).not.toBeInTheDocument()
  })
  it("does not create an image URL for oversized pixel dimensions", async () => {
    const huge = file(100000, 100000); mocks.sample.mockResolvedValue(huge)
    render(<ImageToSvgPage />); fireEvent.click(screen.getByRole("button", { name: "sample_icon" }))
    expect(await screen.findByRole("alert")).toHaveTextContent("error_imageLimit")
    expect(mocks.objectUrl).not.toHaveBeenCalledWith(huge)
    expect(screen.getByRole("button", { name: "convert" })).toBeDisabled()
  })
  it("cancels processing and ignores a late successful result", async () => {
    let finish!: (value: ImageVectorResult) => void
    mocks.run.mockImplementation(() => new Promise(resolve => { finish = resolve }))
    render(<ImageToSvgPage />); fireEvent.click(screen.getByRole("button", { name: "sample_icon" }))
    await waitFor(() => expect(screen.getByRole("button", { name: "convert" })).toBeEnabled())
    fireEvent.click(screen.getByRole("button", { name: "convert" })); fireEvent.click(screen.getByRole("button", { name: "cancel" }))
    expect(mocks.run.mock.calls[0][2].signal.aborted).toBe(true)
    await act(async () => finish(output))
    expect(screen.queryByRole("link", { name: "download" })).not.toBeInTheDocument()
  })
})
