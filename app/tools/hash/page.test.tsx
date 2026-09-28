import React from "react"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import HashPage from "./page"

vi.mock("@/hooks/use-translations", () => { const translate = (key: string) => key; return { useTranslations: () => translate } })
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }))
vi.mock("@/components/tools/send-to-menu", () => ({ SendToMenu: () => null }))
const hashFile = vi.hoisted(() => vi.fn())
vi.mock("@/lib/file-hash", () => ({ hashFile }))

describe("hash file input", () => {
  beforeEach(() => window.localStorage.clear())

  it("lets another file be dropped onto the chosen one to replace it", async () => {
    render(<HashPage />)
    const fileTab = screen.getByRole("tab", { name: "fileMode" })
    fireEvent.mouseDown(fileTab)
    await waitFor(() => expect(fileTab).toHaveAttribute("aria-selected", "true"))

    fireEvent.drop(screen.getByRole("button", { name: /dropFileHere/ }), { dataTransfer: { files: [new File(["a"], "first.txt")] } })
    expect(screen.getByText("first.txt")).toBeInTheDocument()

    fireEvent.drop(screen.getByText("first.txt"), { dataTransfer: { files: [new File(["b"], "second.txt")] } })
    expect(screen.getByText("second.txt")).toBeInTheDocument()
    expect(screen.queryByText("first.txt")).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "replaceFile" })).toBeInTheDocument()
  })

  it("hashes the file off the main thread, once for all algorithms when all results are shown", async () => {
    hashFile.mockReset()
    hashFile.mockImplementation(async (request: { algorithms: unknown[] }, context: { onProgress?: (percent: number) => void }) => {
      context.onProgress?.(100)
      return request.algorithms.map((_, index) => `digest-${index}`)
    })
    render(<HashPage />)
    const fileTab = screen.getByRole("tab", { name: "fileMode" })
    fireEvent.mouseDown(fileTab)
    await waitFor(() => expect(fileTab).toHaveAttribute("aria-selected", "true"))
    const file = new File(["abc"], "data.bin")
    fireEvent.drop(screen.getByRole("button", { name: /dropFileHere/ }), { dataTransfer: { files: [file] } })

    fireEvent.click(screen.getByRole("button", { name: "calculate" }))
    expect(await screen.findByText("digest-0")).toBeInTheDocument()
    expect(hashFile.mock.calls[0][0]).toMatchObject({ file, algorithms: [{ algorithm: "md5" }] })

    fireEvent.click(screen.getByRole("switch", { name: "showAllResults" }))
    fireEvent.click(screen.getByRole("button", { name: "calculate" }))
    await waitFor(() => expect(hashFile).toHaveBeenCalledTimes(2))
    const algorithms = hashFile.mock.calls[1][0].algorithms as Array<{ algorithm: string; size?: number }>
    expect(algorithms.length).toBeGreaterThan(15)
    expect(algorithms).toContainEqual({ algorithm: "sha2", size: 256 })
    expect(await screen.findByText(`digest-${algorithms.length - 1}`)).toBeInTheDocument()
  })
})
