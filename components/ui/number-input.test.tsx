import React, { useState } from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { NumberInput } from "./number-input"

function Harness({ onValueChange }: { onValueChange: (value: number) => void }) {
  const [value, setValue] = useState(20)
  return (
    <>
      <NumberInput aria-label="length" min={8} max={128} value={value} onValueChange={(next) => { setValue(next); onValueChange(next) }} />
      <button type="button" onClick={() => setValue(64)}>slider</button>
    </>
  )
}

describe("NumberInput", () => {
  it("lets a value pass through out-of-range digits while typing", () => {
    const onValueChange = vi.fn()
    render(<Harness onValueChange={onValueChange} />)
    const input = screen.getByRole("spinbutton", { name: "length" })
    fireEvent.change(input, { target: { value: "1" } })
    expect(input).toHaveValue(1)
    expect(onValueChange).not.toHaveBeenCalled()
    fireEvent.change(input, { target: { value: "12" } })
    expect(onValueChange).toHaveBeenLastCalledWith(12)
    expect(input).toHaveValue(12)
  })

  it("clamps on blur or Enter and restores an emptied field", () => {
    const onValueChange = vi.fn()
    render(<Harness onValueChange={onValueChange} />)
    const input = screen.getByRole("spinbutton", { name: "length" })
    fireEvent.change(input, { target: { value: "3" } })
    fireEvent.blur(input)
    expect(onValueChange).toHaveBeenLastCalledWith(8)
    expect(input).toHaveValue(8)
    fireEvent.change(input, { target: { value: "500" } })
    fireEvent.keyDown(input, { key: "Enter" })
    expect(input).toHaveValue(128)
    fireEvent.change(input, { target: { value: "" } })
    fireEvent.blur(input)
    expect(input).toHaveValue(128)
  })

  it("follows value changes from elsewhere", () => {
    render(<Harness onValueChange={vi.fn()} />)
    fireEvent.click(screen.getByRole("button", { name: "slider" }))
    expect(screen.getByRole("spinbutton", { name: "length" })).toHaveValue(64)
  })
})
