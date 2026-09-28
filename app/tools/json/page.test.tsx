import React from "react"
import { act, fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import JsonTool from "./page"

vi.mock("@/hooks/use-translations", () => { const translate = (key: string) => key; return { useTranslations: () => translate } })
vi.mock("@/components/json-tree-view", () => ({ JsonTreeView: () => null }))
const download = vi.hoisted(() => vi.fn())
vi.mock("@/lib/object-url", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/object-url")>()), downloadBlob: download }))

function editor() {
  return screen.getByPlaceholderText("inputPlaceholder") as HTMLTextAreaElement
}

function type(value: string) {
  fireEvent.change(editor(), { target: { value } })
}

describe("JSON tool history", () => {
  it("undoes and redoes a transform from the toolbar", () => {
    render(<JsonTool />)
    type('{"b":1,"a":[1,2]}')
    fireEvent.click(screen.getByRole("button", { name: "format" }))
    expect(editor().value).toBe('{\n  "b": 1,\n  "a": [\n    1,\n    2\n  ]\n}')

    fireEvent.click(screen.getByRole("button", { name: "undo" }))
    expect(editor().value).toBe('{"b":1,"a":[1,2]}')
    fireEvent.click(screen.getByRole("button", { name: "redo" }))
    expect(editor().value).toContain('"a": [')
  })

  it("undoes a transform with Ctrl+Z in the editor", () => {
    render(<JsonTool />)
    type('{"a":1}')
    fireEvent.click(screen.getByRole("button", { name: "jsonToYaml" }))
    expect(editor().value).toBe("a: 1\n")
    fireEvent.keyDown(editor(), { key: "z", ctrlKey: true })
    expect(editor().value).toBe('{"a":1}')
  })

  it("brings back cleared content", () => {
    render(<JsonTool />)
    type('{"keep":true}')
    fireEvent.click(screen.getByRole("button", { name: "clear" }))
    expect(editor().value).toBe("")
    fireEvent.click(screen.getByRole("button", { name: "undo" }))
    expect(editor().value).toBe('{"keep":true}')
  })

  it("does not let expand overwrite edits made after collapsing", () => {
    render(<JsonTool />)
    type('{"a":{"b":1},"c":2}')
    fireEvent.click(screen.getByRole("button", { name: "collapse" }))
    expect(editor().value).toBe('{\n  "a": "{...}",\n  "c": 2\n}')
    expect(screen.getByRole("button", { name: "expand" })).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "expand" }))
    expect(editor().value).toBe('{"a":{"b":1},"c":2}')

    fireEvent.click(screen.getByRole("button", { name: "collapse" }))
    type('{\n  "a": "{...}",\n  "c": 3\n}')
    expect(screen.queryByRole("button", { name: "expand" })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "collapse" })).toBeInTheDocument()
  })

  it("points at the error even when the engine gives no position", async () => {
    render(<JsonTool />)
    type('{\n  "a": }')
    fireEvent.click(await screen.findByRole("button", { name: "revealError" }))
    expect(editor()).toHaveFocus()
    expect(editor().selectionStart).toBe(9)
  })
})

/** 实时校验有 300 ms 防抖 */
const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 350)))
const kindBadge = () => screen.getByTitle("contentKind")

describe("JSON tool content kinds", () => {
  it("validates YAML as YAML after converting, names the download after it, and goes back to JSON on undo", async () => {
    download.mockClear()
    render(<JsonTool />)
    type('{"a":1}')
    fireEvent.click(screen.getByRole("button", { name: "jsonToYaml" }))
    expect(kindBadge()).toHaveTextContent("yaml")
    await settle()
    expect(screen.queryByText("parseError")).not.toBeInTheDocument()
    expect(screen.getByText("treeJsonOnly")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "downloadFile" }))
    expect(download).toHaveBeenLastCalledWith(expect.objectContaining({ type: "application/yaml" }), "data.yaml")

    type("a: [1,\n")
    await settle()
    expect(screen.getByText("parseError")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "undo" }))
    expect(editor().value).toBe('{"a":1}')
    expect(kindBadge()).toHaveTextContent("json")
  })

  it("does not report escaped text as broken JSON, and unescaping brings JSON back", async () => {
    render(<JsonTool />)
    type('{"a":1}')
    fireEvent.click(screen.getByRole("button", { name: /^\W*escape$/ }))
    expect(editor().value).toBe('{\\"a\\":1}')
    expect(kindBadge()).toHaveTextContent("kindText")
    await settle()
    expect(screen.queryByText("parseError")).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: /^\W*unescape$/ }))
    expect(kindBadge()).toHaveTextContent("json")
  })

  it("converts JSON to CSV and XML with matching download names", () => {
    download.mockClear()
    render(<JsonTool />)
    type('[{"a":1,"b":"x"}]')
    fireEvent.click(screen.getByRole("button", { name: "jsonToCsv" }))
    expect(editor().value).toBe("a,b\n1,x")
    fireEvent.click(screen.getByRole("button", { name: "downloadFile" }))
    expect(download).toHaveBeenLastCalledWith(expect.any(Blob), "data.csv")

    type('{"a":1,"b":2}')
    fireEvent.click(screen.getByRole("button", { name: "jsonToXml" }))
    expect(editor().value).toMatch(/^<root>/)
    expect(kindBadge()).toHaveTextContent("xml")
  })
})
