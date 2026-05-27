import * as React from "react"
import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { SliderInput } from "./SliderInput"

describe("SliderInput", () => {
  it("renders slider with correct attributes", () => {
    render(<SliderInput min={0} max={100} step={1} value={50} onChange={vi.fn()} disabled={false} />)
    const slider = screen.getByRole("slider")
    expect(slider).toHaveAttribute("min", "0")
    expect(slider).toHaveAttribute("max", "100")
    expect(slider).toHaveAttribute("step", "1")
    expect(slider).toHaveAttribute("value", "50")
  })

  it("displays current value", () => {
    render(<SliderInput min={0} max={100} step={1} value={75} onChange={vi.fn()} disabled={false} />)
    expect(screen.getByText("75")).toBeInTheDocument()
  })

  it("calls onChange when value changes", () => {
    const onChange = vi.fn()
    render(<SliderInput min={0} max={100} step={1} value={50} onChange={onChange} disabled={false} />)
    fireEvent.change(screen.getByRole("slider"), { target: { value: "80" } })
    expect(onChange).toHaveBeenCalledWith(80)
  })

  it("disables slider when disabled is true", () => {
    render(<SliderInput min={0} max={100} step={1} value={50} onChange={vi.fn()} disabled={true} />)
    expect(screen.getByRole("slider")).toBeDisabled()
  })

  it("has correct test id", () => {
    render(<SliderInput min={0} max={100} step={1} value={50} onChange={vi.fn()} disabled={false} />)
    expect(screen.getByTestId("slider-input")).toBeInTheDocument()
  })
})
