import * as React from "react"
import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { NumberEditor } from "./NumberEditor"

describe("NumberEditor", () => {
  it("renders input with value", () => {
    render(<NumberEditor value={42} disabled={false} onChange={vi.fn()} />)
    expect(screen.getByDisplayValue("42")).toBeInTheDocument()
  })

  it("renders with zero value", () => {
    render(<NumberEditor value={0} disabled={false} onChange={vi.fn()} />)
    expect(screen.getByDisplayValue("0")).toBeInTheDocument()
  })

  it("calls onChange when input changes", () => {
    const onChange = vi.fn()
    render(<NumberEditor value={0} disabled={false} onChange={onChange} />)
    fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "100" } })
    expect(onChange).toHaveBeenCalledWith(100)
  })

  it("calls onChange with 0 for invalid input", () => {
    const onChange = vi.fn()
    render(<NumberEditor value={0} disabled={false} onChange={onChange} />)
    fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "" } })
    expect(onChange).toHaveBeenCalledWith(0)
  })

  it("disables input when disabled is true", () => {
    render(<NumberEditor value={42} disabled={true} onChange={vi.fn()} />)
    expect(screen.getByDisplayValue("42")).toBeDisabled()
  })

  it("enables input when disabled is false", () => {
    render(<NumberEditor value={42} disabled={false} onChange={vi.fn()} />)
    expect(screen.getByDisplayValue("42")).not.toBeDisabled()
  })

  it("has correct test id", () => {
    render(<NumberEditor value={0} disabled={false} onChange={vi.fn()} />)
    expect(screen.getByTestId("inline-editor-number")).toBeInTheDocument()
  })
})
