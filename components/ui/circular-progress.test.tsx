import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { CircularProgress } from "./circular-progress"

describe("CircularProgress", () => {
  it("暴露 progressbar 语义并按比例设置弧长", () => {
    render(<CircularProgress value={25} aria-label="剩余" />)
    const bar = screen.getByRole("progressbar", { name: "剩余" })
    expect(bar).toHaveAttribute("aria-valuenow", "25")
    expect(bar).toHaveAttribute("aria-valuemax", "100")

    const indicator = bar.querySelectorAll("circle")[1]
    const circumference = 2 * Math.PI * 18
    expect(Number.parseFloat(indicator.style.strokeDashoffset)).toBeCloseTo(circumference * 0.75, 3)
  })

  it("越界的值被夹到 0 到 max 之间", () => {
    render(<CircularProgress value={150} max={60} aria-label="a" />)
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "60")
  })
})
