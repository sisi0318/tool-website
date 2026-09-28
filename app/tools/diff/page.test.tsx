import React from "react"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import DiffPage from "./page"

vi.mock("@/hooks/use-translations", () => { const translate = (key: string) => key; return { useTranslations: () => translate } })
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }))
vi.mock("@/components/tools/send-to-menu", () => ({ SendToMenu: () => null }))
const download = vi.hoisted(() => vi.fn())
vi.mock("@/lib/object-url", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/object-url")>()), downloadBlob: download }))

function compare(oldText: string, newText: string) {
  fireEvent.change(screen.getByLabelText("originalText"), { target: { value: oldText } })
  fireEvent.change(screen.getByLabelText("newText"), { target: { value: newText } })
}

describe("text diff result", () => {
  it("numbers lines as they are in each file and keeps indentation visible", async () => {
    const { container } = render(<DiffPage />)
    compare("a\nb\nc", "a\n  c")
    await waitFor(() => expect(container.querySelectorAll("[data-diff-index]")).toHaveLength(4))
    const rows = Array.from(container.querySelectorAll("[data-diff-index]")).map((row) => Array.from(row.children).map((cell) => cell.textContent))
    // 旧、新两列行号：删掉的行没有新行号，加进来的行没有旧行号
    expect(rows).toEqual([
      ["1", "1", "  a"],
      ["2", "", "- b"],
      ["3", "", "- c"],
      ["", "2", "+   c"],
    ])
    expect(container.querySelector('[data-diff-index="3"] > div:last-child')).toHaveClass("whitespace-pre-wrap")
  })

  it("can ignore whitespace, step through changes and export a unified diff", async () => {
    download.mockClear()
    const { container } = render(<DiffPage />)
    compare("x\n  keep\ny\nz", "X\nkeep\ny\nZ")
    await waitFor(() => expect(screen.getByText(/^6 changes$/)).toBeInTheDocument())
    fireEvent.click(screen.getByRole("button", { name: "ignoreWhitespace" }))
    await waitFor(() => expect(screen.getByText(/^4 changes$/)).toBeInTheDocument())

    fireEvent.click(screen.getByRole("button", { name: "nextChange" }))
    expect(container.querySelector('[aria-current="true"]')).toHaveAttribute("data-diff-index", "0")
    fireEvent.click(screen.getByRole("button", { name: "nextChange" }))
    expect(container.querySelector('[aria-current="true"]')?.textContent).toContain("z")
    fireEvent.click(screen.getByRole("button", { name: "previousChange" }))
    expect(container.querySelector('[aria-current="true"]')).toHaveAttribute("data-diff-index", "0")

    fireEvent.click(screen.getByRole("button", { name: "exportUnified" }))
    expect(download).toHaveBeenCalledWith(expect.any(Blob), "changes.diff")
    const patch = await new Promise<string>((resolve) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.readAsText(download.mock.calls[0][0] as Blob)
    })
    expect(patch).toBe("--- original\n+++ modified\n@@ -1,4 +1,4 @@\n-x\n+X\n keep\n y\n-z\n+Z\n")
  })
})

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
