import React, { type ReactElement } from "react"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import ToolsPage from "./page"

const toast = vi.fn()
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast }) }))
// Every tool renders a stub that keeps its own state, so a remount would be visible
vi.mock("./tool-components", async () => {
  const { useState } = await import("react")
  function StubTool() {
    const [value, setValue] = useState("")
    return <input aria-label="stub tool input" value={value} onChange={(event) => setValue(event.target.value)} />
  }
  const entry = { icon: () => null, load: StubTool }
  return { TOOL_COMPONENTS: new Proxy({}, { get: () => entry }) }
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
