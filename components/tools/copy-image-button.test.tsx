import React from "react"
import { act, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { CopyImageButton } from "./copy-image-button"

const toast = vi.fn()
const copy = vi.hoisted(() => ({ supported: true, copyImageToClipboard: vi.fn(async () => true) }))
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast }) }))
vi.mock("@/hooks/use-translations", () => { const translate = (key: string) => key; return { useTranslations: () => translate } })
vi.mock("@/lib/clipboard", () => ({ canCopyImages: () => copy.supported, copyImageToClipboard: copy.copyImageToClipboard }))

afterEach(() => { copy.supported = true; vi.clearAllMocks() })

describe("CopyImageButton", () => {
  it("renders nothing when images cannot be copied", () => {
    copy.supported = false
    render(<CopyImageButton image={() => new Blob()} />)
    expect(screen.queryByRole("button")).not.toBeInTheDocument()
  })

  it("asks for the image at click time and confirms the copy", async () => {
    const image = new Blob(["png"], { type: "image/png" })
    const produce = vi.fn(() => image)
    render(<CopyImageButton image={produce} />)
    expect(produce).not.toHaveBeenCalled()
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "copyImage" })) })
    expect(copy.copyImageToClipboard).toHaveBeenCalledWith(image)
    expect(toast).toHaveBeenCalledWith({ description: "imageCopied" })
  })
})
