import React from "react"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import JcePage from "./page"

vi.mock("@/hooks/use-translations", () => { const translate = (key: string) => key; return { useTranslations: () => translate } })
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }))
vi.mock("@/components/tools/send-to-menu", () => ({ SendToMenu: () => null }))

/** 页面自带的示例：字符串字段 "hello" 和几个整数字段 */
const EXAMPLE_HEX = "0001160568656c6c6f213039320001869f"
const exampleBytes = () => Uint8Array.from(EXAMPLE_HEX.match(/.{2}/g)!.map((pair) => Number.parseInt(pair, 16)))

describe("JCE input", () => {
  it("parses a chosen file from its bytes instead of pasting it into the text box as hex", async () => {
    const { container } = render(<JcePage />)
    const fileTab = screen.getByRole("tab", { name: "fileUpload" })
    fireEvent.mouseDown(fileTab)
    await waitFor(() => expect(fileTab).toHaveAttribute("aria-selected", "true"))
    fireEvent.change(container.querySelector<HTMLInputElement>('input[type="file"]')!, { target: { files: [new File([exampleBytes()], "payload.jce")] } })

    expect(await screen.findByDisplayValue(/"hello"/)).toBeInTheDocument()
    const textTab = screen.getByRole("tab", { name: "textInput" })
    fireEvent.mouseDown(textTab)
    await waitFor(() => expect(textTab).toHaveAttribute("aria-selected", "true"))
    expect(screen.getByLabelText("input")).toHaveValue("")
  })

  it("says when automatic parsing is paused for long input", () => {
    render(<JcePage />)
    expect(screen.queryByText("autoParsePaused")).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText("input"), { target: { value: "00".repeat(5000) } })
    expect(screen.getByText("autoParsePaused")).toBeInTheDocument()
  })
})
