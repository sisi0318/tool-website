import { describe, expect, it } from "vitest"

import { mapWithConcurrency } from "./async-pool"

describe("mapWithConcurrency", () => {
  it("keeps result order while limiting active work", async () => {
    let active = 0
    let maxActive = 0

    const result = await mapWithConcurrency([1, 2, 3, 4, 5], 2, async (value) => {
      active += 1
      maxActive = Math.max(maxActive, active)
      await new Promise((resolve) => setTimeout(resolve, 5))
      active -= 1
      return value * 2
    })

    expect(result).toEqual([2, 4, 6, 8, 10])
    expect(maxActive).toBeLessThanOrEqual(2)
  })

  it("rejects invalid concurrency", async () => {
    await expect(mapWithConcurrency([1], 0, async (value) => value)).rejects.toThrow(
      "positive integer",
    )
  })
})
