import React from "react"
import { fireEvent, render, screen } from "@testing-library/react"
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
