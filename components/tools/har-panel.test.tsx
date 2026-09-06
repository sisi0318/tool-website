import { fireEvent, render, screen, within } from "@testing-library/react"
import { beforeEach, expect, it, vi } from "vitest"
import HarPanel from "./har-panel"
import { parseHar } from "@/lib/har-shared"
const mocks = vi.hoisted(() => ({ run: vi.fn(), dispose: vi.fn() }))
vi.mock("@/lib/har-client", () => ({ createHarSession: () => mocks, createHarSample: () => new File(["{}"], "example.har") }))
vi.mock("@/hooks/use-translations", () => { const t = (key: string) => key; return { useTranslations: () => t } })
vi.mock("@/lib/object-url", () => ({ createObjectUrl: () => "blob:export", revokeObjectUrl: vi.fn() }))
const data = parseHar({ log: { entries: [200, 500, 0].map((status, index) => ({ request: { method: "GET", url: `https://example.com/${index}?secret=value` }, response: { status }, time: index * 1000 })) } })
beforeEach(() => { vi.clearAllMocks(); mocks.run.mockImplementation(async request => request.action === "load" ? { data } : { output: new Blob(["export"]) }) })
it("filters failures and exports all matching ids, invalidating stale downloads on filter changes", async () => {
  render(<HarPanel />); fireEvent.click(screen.getByRole("button", { name: "sample" })); await screen.findByRole("button", { name: "filter_failed (2)" })
  fireEvent.click(screen.getByRole("button", { name: "filter_failed (2)" })); expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(3)
  fireEvent.click(screen.getByRole("button", { name: "exportJson" })); await screen.findByRole("link", { name: "download JSON" }); expect(mocks.run.mock.calls.at(-1)?.[0]).toMatchObject({ action: "export", ids: [1, 2], reveal: false })
  fireEvent.change(screen.getByLabelText("search"), { target: { value: "/1" } }); expect(screen.queryByRole("link", { name: "download JSON" })).not.toBeInTheDocument()
})
it("closes the archive worker on clear and resets visible sensitive values", async () => {
  render(<HarPanel />); fireEvent.click(screen.getByRole("button", { name: "sample" })); await screen.findByRole("table")
  fireEvent.click(screen.getByLabelText("reveal")); expect(screen.getByLabelText("reveal")).toBeChecked()
  fireEvent.click(screen.getByRole("button", { name: "clear" })); expect(mocks.dispose).toHaveBeenCalled(); expect(screen.queryByRole("table")).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole("button", { name: "sample" })); await screen.findByRole("table"); expect(screen.getByLabelText("reveal")).not.toBeChecked()
})
