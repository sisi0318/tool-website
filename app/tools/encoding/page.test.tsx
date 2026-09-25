import React from "react"
import { fireEvent, render, screen, within } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import EncodingPage from "./page"
import { ToolRuntimeParamsProvider } from "@/components/tool-runtime-params"

vi.mock("@/hooks/use-translations", () => { const translate = (key: string) => key; return { useTranslations: () => translate } })
vi.mock("@/components/tools/send-to-menu", () => ({ SendToMenu: () => null }))

describe("encoding errors", () => {
  it("names the problem and jumps to the failing line", () => {
    render(<EncodingPage />)
    fireEvent.click(screen.getByRole("button", { name: "decode" }))
    fireEvent.click(screen.getByRole("button", { name: "expand" }))
    fireEvent.click(screen.getByLabelText("multiline"))

    const input = screen.getByRole("textbox", { name: "decodeInput" }) as HTMLTextAreaElement
    fireEvent.change(input, { target: { value: "SGVsbG8=\nbad*" } })
    const alert = screen.getByRole("alert")
    expect(alert).toHaveTextContent("Base64: errors.base64Chars")
    expect(alert).toHaveTextContent("errorAtLine")

    fireEvent.click(within(alert).getByRole("button", { name: "revealError" }))
    expect(input).toHaveFocus()
    expect(input.selectionStart).toBe(9)
  })

  it("points at the character that is not allowed", () => {
    render(<ToolRuntimeParamsProvider params={{ feature: "base32" }}><EncodingPage /></ToolRuntimeParamsProvider>)
    fireEvent.click(screen.getByRole("button", { name: "decode" }))
    const input = screen.getByRole("textbox", { name: "decodeInput" }) as HTMLTextAreaElement
    fireEvent.change(input, { target: { value: "MZXW6!" } })
    const alert = screen.getByRole("alert")
    expect(alert).toHaveTextContent("errors.invalidCharacter")
    fireEvent.click(within(alert).getByRole("button", { name: "revealError" }))
    expect([input.selectionStart, input.selectionEnd]).toEqual([5, 6])
  })
})
