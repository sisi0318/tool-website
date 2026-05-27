import * as React from "react"
import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { ColorInput } from "./ColorInput"

describe("ColorInput", () => {
  it("renders color picker and text input", () => {
    render(<ColorInput value="#ff0000" onChange={vi.fn()} disabled={false} />)
    const container = screen.getByTestId("color-input")
    expect(container).toBeInTheDocument()
    const inputs = container.querySelectorAll("input")
    expect(inputs.length).toBe(2)
  })

  it("calls onChange when color picker changes", () => {
    const onChange = vi.fn()
    render(<ColorInput value="#ff0000" onChange={onChange} disabled={false} />)
    const colorPicker = screen.getByTestId("color-input").querySelector("input[type='color']")
    fireEvent.change(colorPicker!, { target: { value: "#00ff00" } })
    expect(onChange).toHaveBeenCalled()
  })

  it("calls onChange when text input changes", () => {
    const onChange = vi.fn()
    render(<ColorInput value="#ff0000" onChange={onChange} disabled={false} />)
    const textInput = screen.getByTestId("color-input").querySelector("input[type='text']")
    fireEvent.change(textInput!, { target: { value: "#00ff00" } })
    expect(onChange).toHaveBeenCalled()
  })

  it("disables inputs when disabled is true", () => {
    render(<ColorInput value="#ff0000" onChange={vi.fn()} disabled={true} />)
    const inputs = screen.getByTestId("color-input").querySelectorAll("input")
    inputs.forEach((input) => {
      expect(input).toBeDisabled()
    })
  })

  it("has correct test id", () => {
    render(<ColorInput value="#ff0000" onChange={vi.fn()} disabled={false} />)
    expect(screen.getByTestId("color-input")).toBeInTheDocument()
  })
})
