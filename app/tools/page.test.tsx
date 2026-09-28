import React, { type ReactElement } from "react"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import ToolsPage from "./page"
import { requestToolSearch } from "@/components/command-palette"

const toast = vi.fn()
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast }) }))
// 设了 toolId 的那个工具渲染时直接抛错
const crash = vi.hoisted(() => ({ toolId: "" }))
// Every tool renders a stub that keeps its own state, so a remount would be visible
vi.mock("./tool-components", async () => {
  const { useState } = await import("react")
  const { useWorkspace } = await import("@/components/workspace-context")
  function StubTool() {
    const [value, setValue] = useState("")
    const workspace = useWorkspace()
    return <>
      <input aria-label="stub tool input" value={value} onChange={(event) => setValue(event.target.value)} />
      <button type="button" onClick={() => workspace?.openTool("sql", { handoff: "transfer-test" })}>send to sql</button>
    </>
  }
  function BrokenTool(): never {
    throw new Error("tool exploded")
  }
  const entry = { icon: () => null, load: StubTool }
  const broken = { icon: () => null, load: BrokenTool }
  return { TOOL_COMPONENTS: new Proxy({}, { get: (_target, id) => (id === crash.toolId ? broken : entry) }) }
})

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/tools",
  useSearchParams: () => new URLSearchParams(),
}))

describe("workspace search keyboard flow", () => {
  it("ranks the named tool first and moves through results with the arrow keys", () => {
    render(<ToolsPage />)
    const input = screen.getByRole("textbox", { name: /搜索/ })
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: "json" } })

    const results = document.querySelectorAll<HTMLButtonElement>(".search-results button")
    expect(results[0]).toHaveTextContent("JSON")

    fireEvent.keyDown(input, { key: "ArrowDown" })
    expect(results[0]).toHaveFocus()
    fireEvent.keyDown(results[0], { key: "ArrowDown" })
    expect(results[1]).toHaveFocus()
    fireEvent.keyDown(results[1], { key: "ArrowUp" })
    fireEvent.keyDown(results[0], { key: "ArrowUp" })
    expect(input).toHaveFocus()
  })
})

describe("closing a workspace tab", () => {
  beforeEach(() => {
    window.localStorage.clear()
    toast.mockClear()
  })

  it("keeps the closed tool mounted so undo brings it back as it was", async () => {
    render(<ToolsPage />)
    const search = screen.getByRole("textbox", { name: /搜索/ })
    fireEvent.focus(search)
    fireEvent.change(search, { target: { value: "json" } })
    fireEvent.keyDown(search, { key: "Enter" })
    fireEvent.change(await screen.findByLabelText("stub tool input"), { target: { value: "draft" } })

    fireEvent.click(screen.getByLabelText("Close tab"))
    await waitFor(() => expect(toast).toHaveBeenCalled())
    expect(toast.mock.calls.at(-1)![0].title).toMatch(/^已关闭/)
    expect(screen.queryByLabelText("Close tab")).not.toBeInTheDocument()

    const action = toast.mock.calls.at(-1)![0].action as ReactElement<{ onClick: () => void }>
    act(() => { action.props.onClick() })
    expect(screen.getByLabelText("Close tab")).toBeInTheDocument()
    expect(screen.getByLabelText("stub tool input")).toHaveValue("draft")
  })
})

describe("opening another tool from a tab", () => {
  beforeEach(() => window.localStorage.clear())

  it("opens a new tab in place and keeps the one-time handle out of storage and the URL", async () => {
    render(<ToolsPage />)
    const search = screen.getByRole("textbox", { name: /搜索/ })
    fireEvent.focus(search)
    fireEvent.change(search, { target: { value: "json" } })
    fireEvent.keyDown(search, { key: "Enter" })
    fireEvent.change(await screen.findByLabelText("stub tool input"), { target: { value: "kept" } })

    fireEvent.click(screen.getByRole("button", { name: "send to sql" }))
    expect(screen.getAllByLabelText("Close tab")).toHaveLength(2)
    expect(screen.getAllByLabelText("stub tool input", { selector: "input" })[0]).toHaveValue("kept")
    expect(window.localStorage.getItem("tool_tabs_state")).not.toContain("handoff")
    expect(window.location.href).not.toContain("handoff")
  })
})

describe("workspace search and recent tools", () => {
  beforeEach(() => window.localStorage.clear())

  it("focuses its own search box when the header search button is used", () => {
    render(<ToolsPage />)
    act(() => requestToolSearch())
    expect(screen.getByRole("textbox", { name: /搜索/ })).toHaveFocus()
  })

  it("counts switching back to a tab as recent use", async () => {
    render(<ToolsPage />)
    const search = screen.getByRole("textbox", { name: /搜索/ })
    for (const term of ["json", "sql"]) {
      fireEvent.focus(search)
      fireEvent.change(search, { target: { value: term } })
      fireEvent.keyDown(search, { key: "Enter" })
    }
    await screen.findAllByLabelText("Close tab")
    expect(JSON.parse(window.localStorage.getItem("tool_recent_ids")!)[0]).toBe("sql")

    fireEvent.click(screen.getAllByRole("tab")[0])
    await waitFor(() => expect(JSON.parse(window.localStorage.getItem("tool_recent_ids")!)[0]).toBe("json"))
  })
})

describe("workspace tab mounting", () => {
  beforeEach(() => {
    window.localStorage.clear()
    crash.toolId = ""
  })

  function restoreTabs(active: string) {
    window.localStorage.setItem("tool_tabs_state", JSON.stringify([
      { id: "tab-json", toolId: "json", params: {} },
      { id: "tab-uuid", toolId: "uuid", params: {} },
    ]))
    window.localStorage.setItem("tool_active_tab", active)
  }

  it("mounts a restored tab only when it is first opened, and keeps it mounted afterwards", async () => {
    restoreTabs("tab-uuid")
    render(<ToolsPage />)
    await waitFor(() => expect(screen.getAllByRole("tab")).toHaveLength(2))
    expect(screen.getAllByLabelText("stub tool input")).toHaveLength(1)

    fireEvent.click(screen.getAllByRole("tab")[0])
    await waitFor(() => expect(screen.getAllByLabelText("stub tool input")).toHaveLength(2))
    fireEvent.click(screen.getAllByRole("tab")[1])
    expect(screen.getAllByLabelText("stub tool input")).toHaveLength(2)
  })

  it("keeps the other tabs when one tool crashes and offers to close it", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})
    try {
      crash.toolId = "uuid"
      restoreTabs("tab-json")
      render(<ToolsPage />)
      await waitFor(() => expect(screen.getAllByRole("tab")).toHaveLength(2))
      fireEvent.click(screen.getAllByRole("tab")[1])

      const alert = await screen.findByRole("alert")
      expect(alert).toHaveTextContent("出错了")
      expect(screen.getByRole("link", { name: "在独立页打开" })).toHaveAttribute("href", "/tools/uuid")
      expect(screen.getAllByLabelText("stub tool input")).toHaveLength(1)

      fireEvent.click(screen.getByRole("button", { name: "关闭标签" }))
      await waitFor(() => expect(screen.getAllByRole("tab")).toHaveLength(1))
    } finally {
      consoleError.mockRestore()
    }
  })
})
