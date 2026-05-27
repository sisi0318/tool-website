import * as React from "react"
import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { JsonEditor } from "./JsonEditor"

describe("JsonEditor", () => {
  it("renders textarea with value", () => {
    render(<JsonEditor value='{"key": "value"}' disabled={false} onChange={vi.fn()} />)
    expect(screen.getByDisplayValue('{"key": "value"}')).toBeInTheDocument()
  })

  it("renders placeholder when empty", () => {
    render(<JsonEditor value="" disabled={false} onChange={vi.fn()} />)
    expect(screen.getByPlaceholderText('{"key": "value"}')).toBeInTheDocument()
  })

  it("calls onChange when textarea changes", () => {
    const onChange = vi.fn()
    render(<JsonEditor value="" disabled={false} onChange={onChange} />)
    fireEvent.change(screen.getByRole("textbox"), { target: { value: '{"a": 1}' } })
    expect(onChange).toHaveBeenCalledWith('{"a": 1}')
  })

  it("disables textarea when disabled is true", () => {
    render(<JsonEditor value='{"key": "value"}' disabled={true} onChange={vi.fn()} />)
    expect(screen.getByDisplayValue('{"key": "value"}')).toBeDisabled()
  })

  it("enables textarea when disabled is false", () => {
    render(<JsonEditor value='{"key": "value"}' disabled={false} onChange={vi.fn()} />)
    expect(screen.getByDisplayValue('{"key": "value"}')).not.toBeDisabled()
  })

  it("has correct test id", () => {
    render(<JsonEditor value="" disabled={false} onChange={vi.fn()} />)
    expect(screen.getByTestId("inline-editor-json")).toBeInTheDocument()
  })

  it("has correct number of rows", () => {
    render(<JsonEditor value="" disabled={false} onChange={vi.fn()} />)
    expect(screen.getByRole("textbox")).toHaveAttribute("rows", "4")
  })
})
