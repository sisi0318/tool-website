import React from "react"
import { act, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import CrontabPage from "./page"

const toast = vi.fn()
vi.mock("@/hooks/use-translations", () => { const translate = (key: string) => key; return { useTranslations: () => translate } })
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast }) }))

function openTab(index: number) {
  fireEvent.mouseDown(screen.getAllByRole("tab")[index], { button: 0, ctrlKey: false })
}

describe("crontab expression handling", () => {
  beforeEach(() => { vi.useFakeTimers(); toast.mockClear() })
  afterEach(() => { vi.useRealTimers() })

  it("reads a pasted Quartz expression with its seconds field", () => {
    render(<CrontabPage />)
    openTab(1)
    fireEvent.change(screen.getByLabelText("expression"), { target: { value: "0 0 9 * * ?" } })
    act(() => { vi.advanceTimersByTime(400) })
    expect(screen.getByRole("switch", { name: "includeSeconds" })).toHaveAttribute("aria-checked", "true")
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "secondsFieldDetected" }))
    expect(screen.getByLabelText("expression")).toHaveAttribute("aria-invalid", "false")
  })

  it("does not overwrite a typed expression when switching back to the visual tab", () => {
    render(<CrontabPage />)
    openTab(1)
    fireEvent.change(screen.getByLabelText("expression"), { target: { value: "30 8 * * 1-5" } })
    act(() => { vi.advanceTimersByTime(400) })
    openTab(0)
    act(() => { vi.advanceTimersByTime(50) })
    expect(screen.getByLabelText("generatedExpression")).toHaveValue("30 8 * * 1-5")
  })

  it("rebuilds the expression once a visual selection is actually changed", () => {
    render(<CrontabPage />)
    openTab(1)
    fireEvent.change(screen.getByLabelText("expression"), { target: { value: "0 9 * * *" } })
    act(() => { vi.advanceTimersByTime(400) })
    openTab(0)
    fireEvent.click(screen.getAllByRole("button", { name: "30" })[0])
    act(() => { vi.advanceTimersByTime(50) })
    expect(screen.getByLabelText("generatedExpression")).toHaveValue("0,30 9 * * *")
  })
})
