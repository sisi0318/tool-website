import React from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { FileDropZone, matchesAccept } from "./file-drop-zone"

vi.mock("@/hooks/use-translations", () => { const translate = (key: string) => key; return { useTranslations: () => translate } })

const png = new File(["png"], "photo.png", { type: "image/png" })
const text = new File(["txt"], "notes.txt", { type: "text/plain" })
const big = new File([new Uint8Array(2 * 1024 * 1024)], "huge.png", { type: "image/png" })

function fileInput(container: HTMLElement) {
  return container.querySelector<HTMLInputElement>('input[type="file"]')!
}

describe("matchesAccept", () => {
  it("follows the input accept rules", () => {
    expect(matchesAccept(png, "image/*")).toBe(true)
    expect(matchesAccept(png, ".jpg, .PNG")).toBe(true)
    expect(matchesAccept(text, "image/png,.png")).toBe(false)
    expect(matchesAccept(text, undefined)).toBe(true)
  })
})

describe("FileDropZone", () => {
  it("opens the picker from a real button and resets it after choosing", () => {
    const onFiles = vi.fn()
    const { container } = render(<FileDropZone title="Drop a file" onFiles={onFiles} />)
    const input = fileInput(container)
    const click = vi.spyOn(input, "click")
    fireEvent.click(screen.getByRole("button", { name: "Drop a file" }))
    expect(click).toHaveBeenCalled()

    fireEvent.change(input, { target: { files: [png] } })
    expect(onFiles).toHaveBeenCalledWith([png])
    expect(input.value).toBe("")
  })

  it("filters dropped files by type and size and lists what it skipped", () => {
    const onFiles = vi.fn()
    render(<FileDropZone title="Drop images" accept="image/*" maxBytes={1024 * 1024} multiple onFiles={onFiles} />)
    fireEvent.drop(screen.getByRole("button", { name: "Drop images" }), { dataTransfer: { files: [png, text, big] } })
    expect(onFiles).toHaveBeenCalledWith([png])
    const status = screen.getByRole("status")
    expect(status).toHaveTextContent("filesSkipped")
    expect(status).toHaveTextContent("notes.txt · skippedType")
    expect(status).toHaveTextContent("huge.png · skippedSize")
  })

  it("keeps a single-file zone to one file", () => {
    const onFiles = vi.fn()
    render(<FileDropZone title="Drop" onFiles={onFiles} />)
    fireEvent.drop(screen.getByRole("button", { name: "Drop" }), { dataTransfer: { files: [text, png] } })
    expect(onFiles).toHaveBeenCalledWith([text])
  })

  it("still accepts a replacement once a file is shown", () => {
    const onFiles = vi.fn()
    const { container } = render(
      <FileDropZone title="Drop" onFiles={onFiles}>
        {(browse) => <div><span>photo.png</span><button type="button" onClick={browse}>replace</button></div>}
      </FileDropZone>,
    )
    const click = vi.spyOn(fileInput(container), "click")
    fireEvent.click(screen.getByRole("button", { name: "replace" }))
    expect(click).toHaveBeenCalled()
    fireEvent.drop(screen.getByText("photo.png"), { dataTransfer: { files: [text] } })
    expect(onFiles).toHaveBeenCalledWith([text])
  })

  it("highlights while files are dragged over it and ignores drops when disabled", () => {
    const onFiles = vi.fn()
    const { container, rerender } = render(<FileDropZone title="Drop" onFiles={onFiles} />)
    const zone = container.firstElementChild as HTMLElement
    fireEvent.dragEnter(zone, { dataTransfer: { types: ["Files"], files: [] } })
    expect(zone).toHaveAttribute("data-dragging")
    fireEvent.dragLeave(zone, { dataTransfer: { types: ["Files"], files: [] } })
    expect(zone).not.toHaveAttribute("data-dragging")

    rerender(<FileDropZone title="Drop" onFiles={onFiles} disabled />)
    fireEvent.drop(zone, { dataTransfer: { files: [png] } })
    expect(onFiles).not.toHaveBeenCalled()
  })
})
