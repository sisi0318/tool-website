import React from "react"
import { act, fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { CommandPalette, requestToolSearch, toolResultHref } from "./command-palette"

const nav = vi.hoisted(() => ({ pathname: "/tools/json", push: vi.fn() }))
vi.mock("next/navigation", () => ({ usePathname: () => nav.pathname, useRouter: () => ({ push: nav.push }) }))
vi.mock("@/hooks/use-translations", () => ({ useTranslations: (namespace: string) => (key: string) => `${namespace}.${key}` }))

function pressCtrlK() {
  fireEvent.keyDown(window, { key: "k", ctrlKey: true })
}

beforeEach(() => {
  nav.pathname = "/tools/json"
  nav.push.mockClear()
  window.localStorage.clear()
})

describe("CommandPalette", () => {
  it("opens with Ctrl/Cmd+K and lists favorites and recent tools before typing", () => {
    window.localStorage.setItem("tool_favorite_ids", JSON.stringify(["hash"]))
    window.localStorage.setItem("tool_recent_ids", JSON.stringify(["json", "hash"]))
    render(<CommandPalette />)
    pressCtrlK()
    const groups = screen.getAllByRole("group")
    expect(groups.map((group) => group.getAttribute("aria-label"))).toEqual(["commandPalette.favorites", "commandPalette.recents"])
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual(["tools.hash.name", "tools.json.name"])
  })

  it("searches by keyword and opens the chosen tool with the keyboard", () => {
    render(<CommandPalette />)
    act(() => requestToolSearch())
    const input = screen.getByRole("combobox")
    fireEvent.change(input, { target: { value: "md5" } })
    expect(screen.getAllByRole("option")[0]).toHaveTextContent("tools.hash.name")
    fireEvent.keyDown(input, { key: "Enter" })
    expect(nav.push).toHaveBeenCalledWith(expect.stringMatching(/^\/tools\/hash/))
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument()
  })

  it("stays out of the workspace and the canvas, which have their own Ctrl+K", () => {
    for (const pathname of ["/tools", "/canvas"]) {
      nav.pathname = pathname
      const { unmount } = render(<CommandPalette />)
      pressCtrlK()
      act(() => requestToolSearch())
      expect(screen.queryByRole("combobox")).not.toBeInTheDocument()
      unmount()
    }
  })

  it("passes feature matches on as a URL parameter", () => {
    expect(toolResultHref({ toolId: "json", featureParam: "minify" })).toBe("/tools/json?feature=minify")
    expect(toolResultHref({ toolId: "json" })).toBe("/tools/json")
  })
})
