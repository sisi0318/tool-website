import { act, fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, expect, it, vi } from "vitest"
import ImageDiffPanel from "./image-diff-panel"
const mocks = vi.hoisted(() => ({ run: vi.fn() }))
vi.mock("@/lib/image-diff", () => ({ runImageDiff: mocks.run, createDiffSamples: vi.fn() }))
vi.mock("@/hooks/use-translations", () => { const t = (key: string) => key; return { useTranslations: () => t } })
vi.mock("@/lib/object-url", () => ({ createObjectUrl: () => "blob:preview", revokeObjectUrl: vi.fn() }))
vi.mock("@/components/tools/send-to-menu", () => ({ SendToMenu: () => null }))
const source = { width: 100, height: 100, preview: new Blob(), animated: false }
const result = { layout: { width: 100, height: 100, ax: 0, ay: 0, bx: 0, by: 0 }, stats: { compared: 10000, changed: 0, overlap: 10000, onlyA: 0, onlyB: 0, bounds: null }, preview: new Blob(), output: new Blob() }
beforeEach(() => { vi.clearAllMocks(); mocks.run.mockResolvedValue({ source }) })
async function upload() { fireEvent.change(screen.getByLabelText("uploadA"), { target: { files: [new File(["a"], "a.png")] } }); await screen.findByAltText("previewA"); fireEvent.change(screen.getByLabelText("uploadB"), { target: { files: [new File(["b"], "b.png")] } }); await screen.findByAltText("previewB") }
it("clears stale results on option changes and supports accessible view controls", async () => {
  render(<ImageDiffPanel />); await upload(); mocks.run.mockResolvedValue({ result }); fireEvent.click(screen.getByRole("button", { name: "compare" })); await screen.findByRole("link", { name: "download" })
  fireEvent.click(screen.getByRole("button", { name: "overlay" })); expect(screen.getByRole("slider", { name: "opacity" })).toBeInTheDocument()
  fireEvent.change(screen.getByLabelText("threshold"), { target: { value: "32" } }); expect(screen.queryByRole("link", { name: "download" })).not.toBeInTheDocument(); expect(screen.queryByRole("img", { name: "comparisonPreview" })).not.toBeInTheDocument()
})
it("cancels comparison and ignores late worker output", async () => {
  render(<ImageDiffPanel />); await upload(); let finish!: (value: unknown) => void; mocks.run.mockImplementation(() => new Promise(resolve => { finish = resolve }))
  fireEvent.click(screen.getByRole("button", { name: "compare" })); fireEvent.click(screen.getByRole("button", { name: "clear" })); await act(async () => finish({ result }))
  expect(screen.queryByRole("link", { name: "download" })).not.toBeInTheDocument(); expect(mocks.run.mock.calls[2][1].signal.aborted).toBe(true)
})
