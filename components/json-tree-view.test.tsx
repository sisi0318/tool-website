import React from "react"
import { act, fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { JsonTreeView } from "./json-tree-view"
import { zh } from "@/lib/translations/zh"

const clipboard = vi.hoisted(() => vi.fn(async () => true))
vi.mock("@/lib/clipboard", () => ({ copyTextToClipboard: clipboard }))
vi.mock("@/components/tools/send-to-menu", () => ({ SendToMenu: () => null }))
vi.mock("@/hooks/use-translations", () => ({ useTranslations: () => (key: string) => (zh.jsonTree as Record<string, string>)[key] ?? key }))
beforeEach(() => clipboard.mockClear())

function openNodeActions(path: string) {
  fireEvent.pointerDown(screen.getByRole("button", { name: "节点操作 " + path }), { button: 0, ctrlKey: false })
}

describe("JSON tree interaction", () => {
  it("searches collapsed descendants and can focus a subtree then return to the root", () => {
    const { container } = render(<JsonTreeView jsonText={JSON.stringify({ users: [{ name: "Ada" }], hidden: "other" })} />)
    expect(container.querySelector('[data-tree-path="/users/0/name"]')).not.toBeInTheDocument()
    fireEvent.change(screen.getByRole("textbox", { name: "搜索键或值…" }), { target: { value: "ada" } })
    expect(container.querySelector('[data-tree-path="/users/0/name"]')).toBeInTheDocument()
    expect(container.querySelector('[data-tree-path="/hidden"]')).not.toBeInTheDocument()
    openNodeActions("$.users[0]")
    fireEvent.click(screen.getByRole("menuitem", { name: "只看此子树" }))
    expect(screen.getByRole("button", { name: "返回根节点" })).toBeInTheDocument()
    expect(screen.getByRole("textbox", { name: "搜索键或值…" })).toHaveValue("")
    expect(container.querySelector('[data-tree-path="/hidden"]')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "返回根节点" }))
    expect(container.querySelector('[data-tree-path="/hidden"]')).toBeInTheDocument()
  })
  it("copies exact paths and full values even when a string preview is shortened", async () => {
    const long = "x".repeat(400)
    render(<JsonTreeView jsonText={JSON.stringify({ "a.b": { "x/y": long } })} />)
    openNodeActions('$["a.b"]["x/y"]')
    await act(async () => fireEvent.click(screen.getByRole("menuitem", { name: "复制 JSON Pointer" })))
    expect(clipboard).toHaveBeenLastCalledWith("/a.b/x~1y")
    await act(async () => fireEvent.click(screen.getByRole("button", { name: '复制 $["a.b"]["x/y"]' })))
    expect(clipboard).toHaveBeenLastCalledWith(long)
  })
  it("shares depth controls between compact and card views and keeps large renders paged", async () => {
    const { container } = render(<JsonTreeView jsonText={JSON.stringify(Array.from({ length: 250 }, (_, index) => ({ id: index })))} />)
    expect(container.querySelectorAll("[data-tree-path]")).toHaveLength(100)
    fireEvent.click(screen.getByRole("button", { name: "下一页节点" }))
    expect(container.querySelectorAll("[data-tree-path]")).toHaveLength(100)
    fireEvent.click(screen.getByRole("button", { name: "折叠全部" }))
    expect(container.querySelectorAll("[data-tree-path]")).toHaveLength(1)
    await act(async () => fireEvent.click(screen.getByRole("radio", { name: "卡片" })))
    expect(container.querySelectorAll("[data-tree-path]")).toHaveLength(1)
    fireEvent.change(screen.getByRole("combobox", { name: "展开层级" }), { target: { value: "1" } })
    expect(container.querySelectorAll("[data-tree-path]").length).toBeLessThanOrEqual(101)
  })
  it("preserves null, false and zero roots", async () => {
    const { rerender } = render(<JsonTreeView jsonText="null" />)
    expect(screen.getByRole("button", { name: "复制 $" })).toBeInTheDocument()
    rerender(<JsonTreeView jsonText="false" />)
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "复制 $" })))
    expect(clipboard).toHaveBeenLastCalledWith("false")
    rerender(<JsonTreeView jsonText="0" />)
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "复制 $" })))
    expect(clipboard).toHaveBeenLastCalledWith("0")
  })
})
