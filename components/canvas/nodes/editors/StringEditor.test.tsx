import * as React from "react"
import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { StringEditor } from "./StringEditor"

describe("StringEditor", () => {
  it("renders input with value", () => {
    render(<StringEditor value="hello" disabled={false} onChange={vi.fn()} />)
    expect(screen.getByDisplayValue("hello")).toBeInTheDocument()
  })

  it("renders placeholder when empty", () => {
    render(<StringEditor value="" disabled={false} onChange={vi.fn()} />)
    expect(screen.getByPlaceholderText("Enter text...")).toBeInTheDocument()
  })

  it("calls onChange when input changes", () => {
    const onChange = vi.fn()
    render(<StringEditor value="" disabled={false} onChange={onChange} />)
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "world" } })
    expect(onChange).toHaveBeenCalledWith("world")
  })

  it("disables input when disabled is true", () => {
    render(<StringEditor value="hello" disabled={true} onChange={vi.fn()} />)
    expect(screen.getByDisplayValue("hello")).toBeDisabled()
  })

  it("enables input when disabled is false", () => {
    render(<StringEditor value="hello" disabled={false} onChange={vi.fn()} />)
    expect(screen.getByDisplayValue("hello")).not.toBeDisabled()
  })

  it("has correct test id", () => {
    render(<StringEditor value="" disabled={false} onChange={vi.fn()} />)
    expect(screen.getByTestId("inline-editor-string")).toBeInTheDocument()
  })
})
