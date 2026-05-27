import * as React from "react"
import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { SwitchInput } from "./SwitchInput"

describe("SwitchInput", () => {
  it("renders switch", () => {
    render(<SwitchInput checked={false} onChange={vi.fn()} disabled={false} />)
    expect(screen.getByRole("checkbox")).toBeInTheDocument()
  })

  it("shows checked state", () => {
    render(<SwitchInput checked={true} onChange={vi.fn()} disabled={false} />)
    expect(screen.getByRole("checkbox")).toBeChecked()
  })

  it("shows unchecked state", () => {
    render(<SwitchInput checked={false} onChange={vi.fn()} disabled={false} />)
    expect(screen.getByRole("checkbox")).not.toBeChecked()
  })

  it("calls onChange when toggled", () => {
    const onChange = vi.fn()
    render(<SwitchInput checked={false} onChange={onChange} disabled={false} />)
    fireEvent.click(screen.getByRole("checkbox"))
    expect(onChange).toHaveBeenCalledWith(true)
  })

  it("disables switch when disabled is true", () => {
    render(<SwitchInput checked={false} onChange={vi.fn()} disabled={true} />)
    expect(screen.getByRole("checkbox")).toBeDisabled()
  })

  it("has correct test id", () => {
    render(<SwitchInput checked={false} onChange={vi.fn()} disabled={false} />)
    expect(screen.getByTestId("switch-input")).toBeInTheDocument()
  })
})
