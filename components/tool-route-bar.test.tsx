import React from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { findPrimaryField, ToolRouteBar } from "./tool-route-bar"

vi.mock("next/navigation", () => ({
  usePathname: () => "/tools/data-detector",
}))

vi.mock("@/hooks/use-translations", () => ({
  useTranslations: (namespace: string) => (key: string) => {
    const translations: Record<string, string> = {
      "tools.dataDetector.name": "Smart Data Detector",
      "tools.addFavorite": "Add to favorites",
      "tools.removeFavorite": "Remove from favorites",
      "common.backToTools": "Back to tools",
      "common.focusInputHint": "Focus input",
      "common.copyToolLink": "Copy tool link",
      "common.linkCopied": "Link copied",
      "common.openInWorkspace": "Open in workspace",
    }
    return translations[`${namespace}.${key}`] ?? key
  },
}))

beforeEach(() => window.localStorage.clear())

describe("ToolRouteBar", () => {
  it("exposes newly added tools to the mobile route actions", () => {
    render(<ToolRouteBar />)

    expect(screen.getByText("Smart Data Detector")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Back to tools" })).toHaveAttribute("href", "/tools")
    expect(screen.getByRole("link", { name: "Open in workspace" })).toHaveAttribute(
      "href",
      "/tools?tool=data-detector",
    )
    expect(screen.getByRole("button", { name: "Copy tool link" })).toBeInTheDocument()
  })

  it("counts a direct visit as recent use and lets the tool be starred", () => {
    render(<ToolRouteBar />)
    expect(JSON.parse(window.localStorage.getItem("tool_recent_ids")!)).toEqual(["data-detector"])

    fireEvent.click(screen.getByRole("button", { name: "Add to favorites" }))
    expect(screen.getByRole("button", { name: "Remove from favorites" })).toHaveAttribute("aria-pressed", "true")
    expect(JSON.parse(window.localStorage.getItem("tool_favorite_ids")!)).toEqual(["data-detector"])
  })
})

describe("the / shortcut target", () => {
  it("skips hidden file inputs and prefers the declared primary input", () => {
    document.body.innerHTML = `
      <main>
        <input type="file" class="hidden" />
        <div class="hidden"><input aria-label="collapsed settings" /></div>
        <input aria-label="first visible" />
        <textarea aria-label="main text" data-primary-input></textarea>
      </main>`
    expect(findPrimaryField()?.getAttribute("aria-label")).toBe("main text")
    document.querySelector("[data-primary-input]")!.remove()
    expect(findPrimaryField()?.getAttribute("aria-label")).toBe("first visible")
    document.body.innerHTML = ""
  })

  it("moves focus with / from outside a field", () => {
    render(<><ToolRouteBar /><main><input type="file" className="hidden" /><textarea aria-label="editor" /></main></>)
    fireEvent.keyDown(document.body, { key: "/" })
    expect(screen.getByLabelText("editor")).toHaveFocus()
  })
})
