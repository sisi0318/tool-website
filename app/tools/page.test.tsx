import React from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import ToolsPage from "./page"

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
