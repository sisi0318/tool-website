import React from "react"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import HexBinaryPage from "./page"
import { HEX_PREVIEW_BYTES } from "@/lib/hex-binary-tools"

const download = vi.hoisted(() => vi.fn())
vi.mock("@/hooks/use-translations", () => { const translate = (key: string) => key; return { useTranslations: () => translate } })
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }))
vi.mock("@/components/tools/send-to-menu", () => ({ SendToMenu: () => null }))
vi.mock("@/lib/object-url", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/object-url")>()), downloadBlob: download }))

// jsdom 的 File 没有 arrayBuffer()，和其它测试一样给对象补上
function binaryFile(name: string, size: number) {
  const data = Uint8Array.from({ length: size }, (_, index) => index % 256)
  const file = new File([data], name)
  Object.defineProperty(file, "arrayBuffer", { value: async () => data.buffer })
  return file
}

beforeEach(() => { download.mockClear(); window.sessionStorage.clear() })

describe("hex / binary files", () => {
  it("keeps a chosen file as a file and shows a bounded preview with a full download", async () => {
    const { container } = render(<HexBinaryPage />)
    const input = screen.getByRole("textbox", { name: "input" })
    fireEvent.change(container.querySelector<HTMLInputElement>('input[type="file"]')!, { target: { files: [binaryFile("dump.bin", HEX_PREVIEW_BYTES * 2)] } })

    // 以前这里会先写进约 17 万字符的 Base64
    await screen.findByText(/dump\.bin/)
    expect(input).toHaveValue("")
    expect(input).toBeDisabled()

    fireEvent.click(screen.getByRole("button", { name: "run" }))
    const output = (await waitFor(() => {
      const box = screen.getAllByRole("textbox")[1] as HTMLTextAreaElement
      expect(box.value).not.toBe("")
      return box
    }))
    expect(output.value.split("\n")).toHaveLength(HEX_PREVIEW_BYTES / 16)
    expect(screen.getByText("previewTruncated")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "downloadFull" }))
    expect(download).toHaveBeenCalledWith(expect.any(Blob), "dump.hexdump.txt")
  })
})
