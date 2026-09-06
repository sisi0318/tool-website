import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import OcrPage from "./page"
import { recognizeImage } from "@/lib/ocr-worker-client"
import type { OcrResult } from "@/lib/ocr-shared"

vi.mock("@/lib/ocr-worker-client", () => ({ recognizeImage: vi.fn() }))
vi.mock("@/hooks/use-translations", () => { const t = (key: string) => key; return { useTranslations: () => t } })
vi.mock("@/hooks/use-object-url", () => ({ useObjectUrl: () => null }))
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }))
vi.mock("@/components/tools/send-to-menu", () => ({ SendToMenu: () => null }))

function file(name: string) {
  const bytes = new Uint8Array(33); bytes.set([137, 80, 78, 71, 13, 10, 26, 10]); bytes.set([73, 72, 68, 82], 12)
  new DataView(bytes.buffer).setUint32(16, 16); new DataView(bytes.buffer).setUint32(20, 16)
  const file = new File([bytes], name, { type: "image/png" })
  Object.defineProperty(file, "arrayBuffer", { value: () => Promise.resolve(bytes.buffer) })
  return file
}
const result: OcrResult = { text: "old result", lines: [], info: { width: 16, height: 16, rotation: 0, tiles: 1, elapsedMs: 1, animated: false }, preview: new Blob() }
afterEach(() => vi.clearAllMocks())
describe("OCR page stale-result guard", () => {
  it("aborts an old job and ignores its late result when another image replaces it", async () => {
    let finish!: (result: OcrResult) => void
    vi.mocked(recognizeImage).mockImplementation(() => new Promise(resolve => { finish = resolve }))
    render(<OcrPage />)
    fireEvent.change(screen.getByLabelText("chooseFile", { selector: "input" }), { target: { files: [file("first.png")] } })
    await waitFor(() => expect(screen.getByRole("button", { name: "recognize" })).toBeEnabled())
    fireEvent.click(screen.getByRole("button", { name: "recognize" }))
    const signal = vi.mocked(recognizeImage).mock.calls[0][2]!.signal!
    fireEvent.change(screen.getByLabelText("chooseFile", { selector: "input" }), { target: { files: [file("second.png")] } })
    await act(async () => { finish(result) })
    expect(signal.aborted).toBe(true)
    expect(screen.getByRole("textbox", { name: "output" })).toHaveValue("")
    expect(screen.getByText(/second.png/)).toBeInTheDocument()
  })
  it("clears a result when recognition options change", async () => {
    vi.mocked(recognizeImage).mockResolvedValue(result)
    render(<OcrPage />)
    fireEvent.change(screen.getByLabelText("chooseFile", { selector: "input" }), { target: { files: [file("first.png")] } })
    await waitFor(() => expect(screen.getByRole("button", { name: "recognize" })).toBeEnabled())
    fireEvent.click(screen.getByRole("button", { name: "recognize" }))
    await waitFor(() => expect(screen.getByRole("textbox", { name: "output" })).toHaveValue("old result"))
    fireEvent.click(screen.getByRole("checkbox", { name: "enhance" }))
    expect(screen.getByRole("textbox", { name: "output" })).toHaveValue("")
    expect(screen.getByRole("textbox", { name: "output" })).toBeDisabled()
  })
})
