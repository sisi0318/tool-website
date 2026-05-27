import * as React from "react"
import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { SelectInput } from "./SelectInput"

describe("SelectInput", () => {
  const options = [
    { label: "Option A", value: "a" },
    { label: "Option B", value: "b" },
    { label: "Option C", value: "c" },
  ]

  it("renders all options", () => {
    render(<SelectInput options={options} value="a" onChange={vi.fn()} disabled={false} />)
    expect(screen.getByText("Option A")).toBeInTheDocument()
    expect(screen.getByText("Option B")).toBeInTheDocument()
    expect(screen.getByText("Option C")).toBeInTheDocument()
  })

  it("selects the default value", () => {
    render(<SelectInput options={options} value="b" onChange={vi.fn()} disabled={false} />)
    expect(screen.getByDisplayValue("Option B")).toBeInTheDocument()
  })

  it("calls onChange when selection changes", () => {
    const onChange = vi.fn()
    render(<SelectInput options={options} value="a" onChange={onChange} disabled={false} />)
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "c" } })
    expect(onChange).toHaveBeenCalledWith("c")
  })

  it("disables select when disabled is true", () => {
    render(<SelectInput options={options} value="a" onChange={vi.fn()} disabled={true} />)
    expect(screen.getByRole("combobox")).toBeDisabled()
  })

  it("has correct test id", () => {
    render(<SelectInput options={options} value="a" onChange={vi.fn()} disabled={false} />)
    expect(screen.getByTestId("select-input")).toBeInTheDocument()
  })
})
