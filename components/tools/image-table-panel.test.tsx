import { act, fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, expect, it, vi } from "vitest"
import ImageTablePanel from "./image-table-panel"
const mocks = vi.hoisted(() => ({ run: vi.fn(), ocr: vi.fn() }))
vi.mock("@/lib/image-table", () => ({ runImageTable: mocks.run, createTableSample: vi.fn() }))
vi.mock("@/lib/ocr-worker-client", () => ({ recognizeImage: mocks.ocr }))
vi.mock("@/hooks/use-translations", () => { const t = (key: string) => key; return { useTranslations: () => t } })
vi.mock("@/lib/object-url", () => ({ createObjectUrl: () => "blob:preview", revokeObjectUrl: vi.fn() }))
vi.mock("@/components/tools/send-to-menu", () => ({ SendToMenu: () => null }))
const image = { width: 200, height: 100, preview: new Blob(), animated: false, rules: { x: [0, 100, 200], y: [0, 50, 100] } }
const result = { info: { width: 200, height: 100 }, lines: [{ id: 0, text: "00123", score: 0.98, poly: [[10, 10], [60, 10], [60, 30], [10, 30]] }] }
const upload = () => fireEvent.change(screen.getByLabelText("upload", { selector: "input" }), { target: { files: [new File(["image"], "table.png")] } })
beforeEach(() => { vi.clearAllMocks(); mocks.run.mockResolvedValue({ image }); mocks.ocr.mockResolvedValue(result) })
it("exports reviewed cells and invalidates downloads on edits and grid changes", async () => {
  render(<ImageTablePanel />); upload(); await screen.findByRole("heading", { name: "structure" })
  fireEvent.click(screen.getByRole("button", { name: "recognize" })); await screen.findByLabelText("cell A1")
  fireEvent.change(screen.getByLabelText("cell A1"), { target: { value: "edited" } })
  mocks.run.mockResolvedValue({ output: new Blob(["xlsx"]) }); fireEvent.click(screen.getByRole("button", { name: "xlsx" }))
  await screen.findByRole("link", { name: "download XLSX" })
  expect(mocks.run.mock.calls[1][0]).toMatchObject({ cells: [["edited", ""], ["", ""]], numbers: false })
  fireEvent.change(screen.getByLabelText("xEdges"), { target: { value: "0, 200" } })
  expect(screen.queryByRole("link", { name: "download XLSX" })).not.toBeInTheDocument(); expect(screen.getByRole("button", { name: "xlsx" })).toBeDisabled()
  fireEvent.click(screen.getByRole("button", { name: "rebuild" })); expect(screen.getByLabelText("cell A1")).toHaveValue("00123"); expect(screen.queryByLabelText("cell B1")).not.toBeInTheDocument()
})
it("ignores a cancelled recognition result after clearing the image", async () => {
  let finish!: (value: unknown) => void
  mocks.ocr.mockImplementation(() => new Promise(resolve => { finish = resolve }))
  render(<ImageTablePanel />); upload(); await screen.findByRole("heading", { name: "structure" })
  fireEvent.click(screen.getByRole("button", { name: "recognize" })); fireEvent.click(screen.getByRole("button", { name: "clear" }))
  await act(async () => finish(result))
  expect(screen.queryByLabelText("cell A1")).not.toBeInTheDocument(); expect(mocks.ocr.mock.calls[0][2].signal.aborted).toBe(true)
})
