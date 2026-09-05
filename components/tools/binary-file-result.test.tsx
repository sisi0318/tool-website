import React from "react"
import { act, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { BinaryFileDownload } from "./binary-file-result"

vi.mock("@/components/tools/send-to-menu", () => ({ SendToMenu: () => null }))
vi.mock("@/hooks/use-translations", () => ({ useTranslations: () => (key: string) => key }))
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

describe("binary file download", () => {
  it("keeps the original File URL alive until the result leaves the page", () => {
    vi.useFakeTimers()
    const create = vi.fn(() => "blob:download-file")
    const revoke = vi.fn()
    vi.stubGlobal("URL", { createObjectURL: create, revokeObjectURL: revoke })
    const file = new File([new Uint8Array([0, 255, 1])], "payload.bin")
    const { unmount } = render(<BinaryFileDownload file={file} />)
    expect(create).toHaveBeenCalledWith(file)
    expect(screen.getByRole("link", { name: "downloadFile" })).toHaveAttribute("href", "blob:download-file")
    expect(screen.getByRole("link", { name: "downloadFile" })).toHaveAttribute("download", "payload.bin")
    act(() => vi.advanceTimersByTime(5000))
    expect(revoke).not.toHaveBeenCalled()
    unmount()
    expect(revoke).toHaveBeenCalledWith("blob:download-file")
  })
})
