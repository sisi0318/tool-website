import React from "react"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import DiffPage from "./page"

vi.mock("@/hooks/use-translations", () => { const translate = (key: string) => key; return { useTranslations: () => translate } })
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }))
vi.mock("@/components/tools/send-to-menu", () => ({ SendToMenu: () => null }))

// jsdom 的 File 没有 arrayBuffer()，和其它测试一样给对象补上
function textFile(name: string, text: string) {
  const data = new TextEncoder().encode(text)
  const file = new File([data], name, { type: "text/plain" })
  Object.defineProperty(file, "arrayBuffer", { value: async () => data.buffer })
  return file
}

describe("text diff files", () => {
  it("opens a file into each side separately", async () => {
    const { container } = render(<DiffPage />)
    expect(screen.getByRole("button", { name: "openFile · originalText" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "openFile · newText" })).toBeInTheDocument()

    const [left, right] = container.querySelectorAll<HTMLInputElement>('input[type="file"]')
    fireEvent.change(left, { target: { files: [textFile("a.txt", "one\ntwo")] } })
    await waitFor(() => expect(screen.getByLabelText("originalText")).toHaveValue("one\ntwo"))

    fireEvent.drop(screen.getByLabelText("newText"), { dataTransfer: { files: [textFile("b.txt", "one\nthree")], types: ["Files"] } })
    await waitFor(() => expect(screen.getByLabelText("newText")).toHaveValue("one\nthree"))
    expect(right.value).toBe("")
  })
})
