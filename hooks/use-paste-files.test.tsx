import React from "react"
import { render } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { ToolActivityProvider } from "@/components/tool-activity"
import { usePasteFiles } from "./use-paste-files"

function paste(target: EventTarget, data: { files?: File[]; types?: string[] }) {
  const event = new Event("paste", { bubbles: true, cancelable: true })
  Object.defineProperty(event, "clipboardData", { value: { files: data.files ?? [], types: data.types ?? (data.files?.length ? ["Files"] : []), items: [] } })
  target.dispatchEvent(event)
  return event
}

function Receiver({ onFiles, enabled }: { onFiles: (files: File[]) => void; enabled?: boolean }) {
  usePasteFiles(onFiles, enabled)
  return <div><button type="button">focus me</button><textarea aria-label="notes" /></div>
}

const image = new File(["png"], "image.png", { type: "image/png" })

describe("usePasteFiles", () => {
  it("takes files pasted anywhere on the page", () => {
    const onFiles = vi.fn()
    const { getByRole } = render(<Receiver onFiles={onFiles} />)
    const event = paste(getByRole("button"), { files: [image] })
    expect(onFiles).toHaveBeenCalledWith([image])
    expect(event.defaultPrevented).toBe(true)
  })

  it("only listens while the tool or panel is the active one", () => {
    const hidden = vi.fn()
    const shown = vi.fn()
    render(<>
      <ToolActivityProvider active={false}><Receiver onFiles={hidden} /></ToolActivityProvider>
      <ToolActivityProvider active><Receiver onFiles={shown} /></ToolActivityProvider>
    </>)
    paste(document.body, { files: [image] })
    expect(hidden).not.toHaveBeenCalled()
    expect(shown).toHaveBeenCalledTimes(1)
  })

  it("leaves text pastes and busy tools alone", () => {
    const onFiles = vi.fn()
    const { getByRole, rerender } = render(<Receiver onFiles={onFiles} />)
    const text = paste(getByRole("textbox"), { files: [image], types: ["Files", "text/plain"] })
    expect(onFiles).not.toHaveBeenCalled()
    expect(text.defaultPrevented).toBe(false)
    paste(document.body, { types: ["text/plain"] })
    expect(onFiles).not.toHaveBeenCalled()

    rerender(<Receiver onFiles={onFiles} enabled={false} />)
    paste(document.body, { files: [image] })
    expect(onFiles).not.toHaveBeenCalled()
  })

  it("skips pastes an element already handled", () => {
    const onFiles = vi.fn()
    const { getByRole } = render(<Receiver onFiles={onFiles} />)
    const button = getByRole("button")
    button.addEventListener("paste", (event) => event.preventDefault())
    paste(button, { files: [image] })
    expect(onFiles).not.toHaveBeenCalled()
  })
})
