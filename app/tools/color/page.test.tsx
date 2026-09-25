import React from "react"
import { act, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import ColorPickerPage from "./page"

vi.mock("@/hooks/use-translations", () => { const translate = (key: string) => key; return { useTranslations: () => translate } })
vi.mock("@/lib/clipboard", () => ({ copyTextToClipboard: vi.fn(async () => true) }))

describe("color picker formats", () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it("applies a typed rgb() value to the other formats and keeps the text being typed", () => {
    render(<ColorPickerPage />)
    fireEvent.change(screen.getByLabelText("rgb"), { target: { value: "rgb(255 0 0)" } })
    act(() => { vi.advanceTimersByTime(200) })
    expect(screen.getByLabelText("hex")).toHaveValue("#ff0000")
    expect(screen.getByLabelText("hsl")).toHaveValue("hsl(0, 100%, 50%)")
    expect(screen.getByLabelText("rgb")).toHaveValue("rgb(255 0 0)")
  })

  it("accepts cmyk and lch input", () => {
    render(<ColorPickerPage />)
    fireEvent.change(screen.getByLabelText("cmyk"), { target: { value: "device-cmyk(0% 0% 100% 0%)" } })
    act(() => { vi.advanceTimersByTime(200) })
    expect(screen.getByLabelText("hex")).toHaveValue("#ffff00")
    fireEvent.change(screen.getByLabelText("lch"), { target: { value: "lch(50% 0 0)" } })
    act(() => { vi.advanceTimersByTime(200) })
    expect(screen.getByLabelText("hex")).toHaveValue("#777777")
  })

  it("marks text it cannot parse instead of ignoring it silently", () => {
    render(<ColorPickerPage />)
    fireEvent.change(screen.getByLabelText("rgb"), { target: { value: "rgb(300, 0, 0)" } })
    expect(screen.getByLabelText("rgb")).toHaveAttribute("aria-invalid", "true")
    expect(screen.getByText("invalidFormat")).toBeInTheDocument()
    act(() => { vi.advanceTimersByTime(200) })
    expect(screen.getByLabelText("hex")).toHaveValue("#106a2f")
  })

  it("does not roll the formats back when the copied badge expires", async () => {
    render(<ColorPickerPage />)
    fireEvent.click(screen.getAllByRole("button", { name: "copy" })[0])
    await act(async () => {})
    expect(screen.getByText("copiedToClipboard")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "#ff0000" }))
    act(() => { vi.advanceTimersByTime(200) })
    expect(screen.getByLabelText("hex")).toHaveValue("#ff0000")

    act(() => { vi.advanceTimersByTime(2500) })
    expect(screen.getByLabelText("hex")).toHaveValue("#ff0000")
    expect(screen.getByLabelText("rgb")).toHaveValue("rgb(255, 0, 0)")
    expect(screen.queryByText("copiedToClipboard")).not.toBeInTheDocument()
  })
})
