import React, { type ReactElement } from "react"
import { act, fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import CaseConverterPage from "./page"

const toast = vi.fn()
vi.mock("@/hooks/use-translations", () => { const translate = (key: string) => key; return { useTranslations: () => translate } })
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast }) }))

function lastUndo() {
  return toast.mock.calls.at(-1)![0].action as ReactElement<{ onClick: () => void }>
}

describe("CaseConverterPage", () => {
  beforeEach(() => toast.mockClear())

  it("converts again when another case is picked", () => {
    render(<CaseConverterPage />)
    fireEvent.change(screen.getByRole("textbox", { name: "inputText" }), { target: { value: "Hello World" } })
    expect(screen.getByRole("textbox", { name: "result" })).toHaveValue("HELLO WORLD")
    fireEvent.click(screen.getByRole("radio", { name: "options.lowercase" }))
    expect(screen.getByRole("textbox", { name: "result" })).toHaveValue("hello world")
  })

  it("lets the input replaced by the result be restored", () => {
    render(<CaseConverterPage />)
    const input = screen.getByRole("textbox", { name: "inputText" })
    fireEvent.change(input, { target: { value: "Hello World" } })
    fireEvent.click(screen.getByRole("button", { name: "swap" }))
    expect(input).toHaveValue("HELLO WORLD")
    expect(toast).toHaveBeenLastCalledWith(expect.objectContaining({ title: "inputReplacedByResult" }))

    act(() => { lastUndo().props.onClick() })
    expect(input).toHaveValue("Hello World")
    expect(screen.getByRole("textbox", { name: "result" })).toHaveValue("HELLO WORLD")
  })

  it("lets cleared text be restored and stays quiet when nothing was typed", () => {
    render(<CaseConverterPage />)
    fireEvent.click(screen.getByRole("button", { name: "clear" }))
    expect(toast).not.toHaveBeenCalled()

    const input = screen.getByRole("textbox", { name: "inputText" })
    fireEvent.change(input, { target: { value: "keep me" } })
    fireEvent.click(screen.getByRole("button", { name: "clear" }))
    expect(input).toHaveValue("")
    act(() => { lastUndo().props.onClick() })
    expect(input).toHaveValue("keep me")
  })
})
