import React from "react"
import { render } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { useFileDropGuard } from "./use-file-drop-guard"

function dragEvent(type: "dragover" | "drop", types: string[]) {
  const event = new Event(type, { bubbles: true, cancelable: true }) as DragEvent
  Object.defineProperty(event, "dataTransfer", { value: { types, dropEffect: "copy" } })
  return event
}

function Page() {
  useFileDropGuard()
  return (
    <div>
      <div data-testid="zone" onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "copy" }} onDrop={(event) => event.preventDefault()} />
      <p data-testid="outside">text</p>
    </div>
  )
}

describe("useFileDropGuard", () => {
  it("stops a file dropped outside every drop zone from navigating away", () => {
    const { getByTestId } = render(<Page />)
    const over = dragEvent("dragover", ["Files"])
    getByTestId("outside").dispatchEvent(over)
    expect(over.defaultPrevented).toBe(true)
    expect(over.dataTransfer!.dropEffect).toBe("none")

    const drop = dragEvent("drop", ["Files"])
    getByTestId("outside").dispatchEvent(drop)
    expect(drop.defaultPrevented).toBe(true)
  })

  it("leaves drop zones and plain text drags alone", () => {
    const { getByTestId } = render(<Page />)
    const over = dragEvent("dragover", ["Files"])
    getByTestId("zone").dispatchEvent(over)
    expect(over.dataTransfer!.dropEffect).toBe("copy")

    const text = dragEvent("drop", ["text/plain"])
    getByTestId("outside").dispatchEvent(text)
    expect(text.defaultPrevented).toBe(false)
  })
})
