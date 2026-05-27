import * as React from "react"
import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { ConfigInput } from "./ConfigInput"
import type { ConfigField } from "@/lib/canvas/types"

describe("ConfigInput", () => {
  it("renders SwitchInput for boolean type", () => {
    const field: ConfigField = { id: "test", name: "Test", dataType: "boolean", defaultValue: false }
    render(<ConfigInput field={field} value={false} onChange={vi.fn()} disabled={false} allConfig={{}} />)
    expect(screen.getByTestId("switch-input")).toBeInTheDocument()
  })

  it("renders ColorInput when color=true", () => {
    const field: ConfigField = { id: "test", name: "Test", dataType: "string", color: true, defaultValue: "#000000" }
    render(<ConfigInput field={field} value="#ff0000" onChange={vi.fn()} disabled={false} allConfig={{}} />)
    expect(screen.getByTestId("color-input")).toBeInTheDocument()
  })

  it("renders SelectInput when options exist", () => {
    const field: ConfigField = {
      id: "test", name: "Test", dataType: "string", defaultValue: "a",
      options: [{ label: "A", value: "a" }, { label: "B", value: "b" }],
    }
    render(<ConfigInput field={field} value="a" onChange={vi.fn()} disabled={false} allConfig={{}} />)
    expect(screen.getByTestId("select-input")).toBeInTheDocument()
  })

  it("renders SliderInput when slider config exists", () => {
    const field: ConfigField = {
      id: "test", name: "Test", dataType: "number", defaultValue: 50,
      slider: { min: 0, max: 100, step: 1 },
    }
    render(<ConfigInput field={field} value={50} onChange={vi.fn()} disabled={false} allConfig={{}} />)
    expect(screen.getByTestId("slider-input")).toBeInTheDocument()
  })

  it("renders number input for number type without slider", () => {
    const field: ConfigField = { id: "test", name: "Test", dataType: "number", defaultValue: 0 }
    render(<ConfigInput field={field} value={42} onChange={vi.fn()} disabled={false} allConfig={{}} />)
    expect(screen.getByTestId("number-input")).toBeInTheDocument()
    expect(screen.getByDisplayValue("42")).toBeInTheDocument()
  })

  it("renders textarea when multiline=true", () => {
    const field: ConfigField = { id: "test", name: "Test", dataType: "string", multiline: true, defaultValue: "" }
    render(<ConfigInput field={field} value="hello" onChange={vi.fn()} disabled={false} allConfig={{}} />)
    expect(screen.getByTestId("textarea-input")).toBeInTheDocument()
  })

  it("renders text input for string type", () => {
    const field: ConfigField = { id: "test", name: "Test", dataType: "string", defaultValue: "" }
    render(<ConfigInput field={field} value="hello" onChange={vi.fn()} disabled={false} allConfig={{}} />)
    expect(screen.getByTestId("text-input")).toBeInTheDocument()
    expect(screen.getByDisplayValue("hello")).toBeInTheDocument()
  })

  it("renders dynamic options from dependsOn", () => {
    const field: ConfigField = {
      id: "variant", name: "Variant", dataType: "string", defaultValue: "v1",
      dependsOn: "algorithm",
      dynamicOptions: (algorithm) => {
        if (algorithm === "sha3") return [{ label: "SHA3-256", value: "sha3-256" }]
        return []
      },
    }
    const { rerender } = render(
      <ConfigInput field={field} value="v1" onChange={vi.fn()} disabled={false} allConfig={{ algorithm: "md5" }} />
    )
    // Should return null when dynamicOptions returns empty
    expect(screen.queryByTestId("select-input")).not.toBeInTheDocument()

    // Should render when dynamicOptions returns options
    rerender(
      <ConfigInput field={field} value="sha3-256" onChange={vi.fn()} disabled={false} allConfig={{ algorithm: "sha3" }} />
    )
    expect(screen.getByTestId("select-input")).toBeInTheDocument()
  })
})
