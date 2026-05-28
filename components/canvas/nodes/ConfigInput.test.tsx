import * as React from "react"
import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { ConfigInput } from "./ConfigInput"
import type { ConfigField } from "@/lib/canvas/types"

describe("ConfigInput", () => {
  it("renders SwitchInput for boolean type", () => {
    const field: ConfigField = { id: "test", name: "Test", dataType: "boolean", defaultValue: false }
    render(<ConfigInput field={field} value={false} onChange={vi.fn()} disabled={false} allConfig={{}} />)
    expect(screen.getByRole("checkbox")).toBeInTheDocument()
  })

  it("renders SelectInput when options exist", () => {
    const field: ConfigField = {
      id: "test", name: "Test", dataType: "string", defaultValue: "a",
      options: [{ label: "A", value: "a" }, { label: "B", value: "b" }],
    }
    render(<ConfigInput field={field} value="a" onChange={vi.fn()} disabled={false} allConfig={{}} />)
    expect(screen.getByRole("combobox")).toBeInTheDocument()
  })

  it("renders SliderInput when slider config exists", () => {
    const field: ConfigField = {
      id: "test", name: "Test", dataType: "number", defaultValue: 50,
      slider: { min: 0, max: 100, step: 1 },
    }
    render(<ConfigInput field={field} value={50} onChange={vi.fn()} disabled={false} allConfig={{}} />)
    expect(screen.getByRole("slider")).toBeInTheDocument()
  })

  it("renders number input for number type without slider", () => {
    const field: ConfigField = { id: "test", name: "Test", dataType: "number", defaultValue: 0 }
    render(<ConfigInput field={field} value={42} onChange={vi.fn()} disabled={false} allConfig={{}} />)
    expect(screen.getByDisplayValue("42")).toBeInTheDocument()
  })

  it("renders textarea when multiline=true", () => {
    const field: ConfigField = { id: "test", name: "Test", dataType: "string", multiline: true, defaultValue: "" }
    render(<ConfigInput field={field} value="hello" onChange={vi.fn()} disabled={false} allConfig={{}} />)
    expect(screen.getByRole("textbox")).toBeInTheDocument()
  })

  it("renders text input for string type", () => {
    const field: ConfigField = { id: "test", name: "Test", dataType: "string", defaultValue: "" }
    render(<ConfigInput field={field} value="hello" onChange={vi.fn()} disabled={false} allConfig={{}} />)
    expect(screen.getByDisplayValue("hello")).toBeInTheDocument()
  })

  it("renders file input for bytes type", () => {
    const field: ConfigField = { id: "test", name: "Test", dataType: "bytes" }
    const { container } = render(<ConfigInput field={field} value={null} onChange={vi.fn()} disabled={false} allConfig={{}} />)
    const input = container.querySelector("input[type='file']")
    expect(input).toBeInTheDocument()
  })

  it("hides field when dependsOn returns empty options", () => {
    const field: ConfigField = {
      id: "variant", name: "Variant", dataType: "string", defaultValue: "v1",
      dependsOn: "algorithm",
      dynamicOptions: (algorithm) => {
        if (algorithm === "sha3") return [{ label: "SHA3-256", value: "sha3-256" }]
        return []
      },
    }
    const { container } = render(
      <ConfigInput field={field} value="v1" onChange={vi.fn()} disabled={false} allConfig={{ algorithm: "md5" }} />
    )
    expect(container.firstChild).toBeNull()
  })
})
