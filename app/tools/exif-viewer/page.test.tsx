import React from "react"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import ExifViewerPage from "./page"

const toast = vi.fn()
vi.mock("@/hooks/use-translations", () => { const translate = (key: string) => key; return { useTranslations: () => translate } })
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast }) }))
vi.mock("@/components/tools/send-to-menu", () => ({ SendToMenu: () => null }))

describe("EXIF viewer intake", () => {
  beforeEach(() => toast.mockClear())

  it("tells the user when dropped files are not supported instead of ignoring them", async () => {
    render(<ExifViewerPage />)
    const notes = new File(["hello"], "notes.txt", { type: "text/plain" })
    fireEvent.drop(screen.getByRole("button", { name: "selectImage" }), { dataTransfer: { files: [notes] } })
    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "unsupportedFormatTitle" })))
  })

  it("treats a pasted file like a chosen one", async () => {
    render(<ExifViewerPage />)
    const event = new Event("paste", { bubbles: true, cancelable: true })
    Object.defineProperty(event, "clipboardData", { value: { files: [new File(["x"], "notes.txt", { type: "text/plain" })], types: ["Files"], items: [] } })
    document.body.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(true)
    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "unsupportedFormatTitle" })))
  })
})
