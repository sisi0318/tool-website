import React from "react"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { M3BottomSheet } from "./bottom-sheet"

describe("M3BottomSheet mobile controls", () => {
  it("renders an accessible visible close button when requested", () => {
    const onClose = vi.fn()

    render(
      <M3BottomSheet open onClose={onClose} title="Add tool" closeLabel="Close">
        <p>Sheet content</p>
      </M3BottomSheet>,
    )

    fireEvent.click(screen.getByRole("button", { name: "Close" }))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it("打开时把焦点移进弹层并圈禁,关闭后还给打开前的元素", async () => {
    function Harness() {
      const [open, setOpen] = React.useState(false)
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Open
          </button>
          <M3BottomSheet open={open} onClose={() => setOpen(false)} title="Add tool" closeLabel="Close">
            <button type="button">First</button>
            <button type="button">Second</button>
          </M3BottomSheet>
        </>
      )
    }

    render(<Harness />)
    const trigger = screen.getByRole("button", { name: "Open" })
    trigger.focus()
    fireEvent.click(trigger)

    const close = await screen.findByRole("button", { name: "Close" })
    await waitFor(() => expect(close).toHaveFocus())

    const dialog = screen.getByRole("dialog")
    const second = screen.getByRole("button", { name: "Second" })
    second.focus()
    fireEvent.keyDown(dialog, { key: "Tab" })
    expect(close).toHaveFocus()
    fireEvent.keyDown(dialog, { key: "Tab", shiftKey: true })
    expect(second).toHaveFocus()

    fireEvent.keyDown(document, { key: "Escape" })
    await waitFor(() => expect(trigger).toHaveFocus())
  })

  it("keeps scrollable content above the mobile bottom navigation", () => {
    render(
      <M3BottomSheet open onClose={() => undefined} title="Add tool">
        <p>Sheet content</p>
      </M3BottomSheet>,
    )

    expect(screen.getByText("Sheet content").parentElement).toHaveClass(
      "pb-[calc(6rem+env(safe-area-inset-bottom))]",
      "md:pb-6",
    )
  })
})
