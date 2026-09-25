import React from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { useSwipe } from "./use-swipe"

function Harness({ onSwipeLeft }: { onSwipeLeft: () => void }) {
  const { handlers } = useSwipe({ threshold: 50, onSwipeLeft })
  return (
    <div data-testid="area" {...handlers}>
      <p data-testid="text">text</p>
      <input aria-label="field" />
      <div role="slider" aria-label="level" aria-valuenow={1} data-testid="slider" />
      <div data-testid="scroller" style={{ overflowX: "auto" }}><span data-testid="cell">cell</span></div>
    </div>
  )
}

function swipe(element: Element, from: [number, number], to: [number, number]) {
  fireEvent.touchStart(element, { touches: [{ clientX: from[0], clientY: from[1] }] })
  fireEvent.touchMove(element, { touches: [{ clientX: to[0], clientY: to[1] }] })
  fireEvent.touchEnd(element, { changedTouches: [{ clientX: to[0], clientY: to[1] }] })
}

describe("useSwipe", () => {
  it("switches on a clear horizontal swipe over plain content", () => {
    const onSwipeLeft = vi.fn()
    render(<Harness onSwipeLeft={onSwipeLeft} />)
    swipe(screen.getByTestId("text"), [200, 100], [100, 110])
    expect(onSwipeLeft).toHaveBeenCalledTimes(1)
  })

  it("ignores diagonal movement that is mostly a scroll", () => {
    const onSwipeLeft = vi.fn()
    render(<Harness onSwipeLeft={onSwipeLeft} />)
    swipe(screen.getByTestId("text"), [200, 100], [120, 160])
    expect(onSwipeLeft).not.toHaveBeenCalled()
  })

  it("leaves drags that start on inputs, sliders or horizontal scrollers to them", () => {
    const onSwipeLeft = vi.fn()
    render(<Harness onSwipeLeft={onSwipeLeft} />)
    const scroller = screen.getByTestId("scroller")
    Object.defineProperty(scroller, "scrollWidth", { value: 600 })
    Object.defineProperty(scroller, "clientWidth", { value: 200 })

    swipe(screen.getByRole("textbox", { name: "field" }), [200, 100], [100, 100])
    swipe(screen.getByRole("slider", { name: "level" }), [200, 100], [100, 100])
    swipe(screen.getByTestId("cell"), [200, 100], [100, 100])
    expect(onSwipeLeft).not.toHaveBeenCalled()
  })
})
