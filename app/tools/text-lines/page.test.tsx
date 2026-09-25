import React, { type ReactElement } from "react"
import { act, fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import TextLinesPage from "./page"

const toast = vi.fn()
vi.mock("@/hooks/use-translations", () => { const translate = (key: string) => key; return { useTranslations: () => translate } })
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast }) }))
vi.mock("@/hooks/use-object-url", () => ({ useObjectUrl: (file: File | null) => file ? "blob:text-lines" : null }))
vi.mock("@/components/tools/send-to-menu", () => ({ SendToMenu: () => null }))

describe("TextLinesPage", () => {
  beforeEach(() => {
    toast.mockClear()
    window.sessionStorage.clear()
  })

  it("lets the input replaced by the result be restored", async () => {
    render(<TextLinesPage />)
    const input = screen.getByRole("textbox", { name: "input" })
    fireEvent.change(input, { target: { value: "b\na\nb" } })
    fireEvent.click(screen.getByRole("button", { name: "run" }))
    fireEvent.click(await screen.findByRole("button", { name: "useResult" }))
    expect(input).toHaveValue("b\na")
    expect(toast).toHaveBeenLastCalledWith(expect.objectContaining({ title: "inputReplacedByResult" }))

    const action = toast.mock.calls.at(-1)![0].action as ReactElement<{ onClick: () => void }>
    act(() => { action.props.onClick() })
    expect(input).toHaveValue("b\na\nb")
  })
})
