import React from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import TimePage from "./page"

vi.mock("@/hooks/use-translations", () => { const translate = (key: string) => key; return { useTranslations: () => translate } })

function openTimestampTab() {
  render(<TimePage />)
  fireEvent.mouseDown(screen.getByRole("tab", { name: "timestamp" }), { button: 0, ctrlKey: false })
}

describe("timestamp converter", () => {
  it("converts as you type and detects a millisecond timestamp", () => {
    openTimestampTab()
    fireEvent.change(screen.getByLabelText("enterTimestamp"), { target: { value: "1700000000000" } })
    expect(screen.getByText("2023-11-14T22:13:20.000Z")).toBeInTheDocument()
    expect(screen.getByText("detectedUnit")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "copy ISO 8601" })).toBeInTheDocument()
  })

  it("explains input it cannot read instead of failing silently", () => {
    openTimestampTab()
    fireEvent.change(screen.getByLabelText("enterTimestamp"), { target: { value: "2023-11-14" } })
    expect(screen.getByLabelText("enterTimestamp")).toHaveAttribute("aria-invalid", "true")
    expect(screen.getByText("invalidTimestamp")).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText("enterDate"), { target: { value: "not a date" } })
    fireEvent.click(screen.getAllByRole("button", { name: "convert" })[0])
    expect(screen.getByText("invalidDate")).toBeInTheDocument()
  })

  it("fills the current time in seconds", () => {
    openTimestampTab()
    fireEvent.click(screen.getByRole("button", { name: "now" }))
    const value = (screen.getByLabelText("enterTimestamp") as HTMLInputElement).value
    expect(value).toMatch(/^\d{10}$/)
    expect(Math.abs(Number(value) - Date.now() / 1000)).toBeLessThan(5)
  })
})
