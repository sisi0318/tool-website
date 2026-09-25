import React from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import JsonTool from "./page"

vi.mock("@/hooks/use-translations", () => { const translate = (key: string) => key; return { useTranslations: () => translate } })
vi.mock("@/components/json-tree-view", () => ({ JsonTreeView: () => null }))

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
})
