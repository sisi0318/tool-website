import fc from "fast-check"
import { describe, expect, it } from "vitest"

import { computeLineDiff } from "./text-diff"

describe("computeLineDiff", () => {
  it("keeps unchanged lines", () => {
    const result = computeLineDiff("alpha\nbeta", "alpha\nbeta")

    expect(result.lines).toEqual([
      { type: "unchanged", content: "alpha" },
      { type: "unchanged", content: "beta" },
    ])
    expect(result.unchanged).toBe(2)
  })

  it("finds an insertion without replacing surrounding lines", () => {
    const result = computeLineDiff("alpha\ngamma", "alpha\nbeta\ngamma")

    expect(result.lines).toEqual([
      { type: "unchanged", content: "alpha" },
      { type: "added", content: "beta" },
      { type: "unchanged", content: "gamma" },
    ])
  })

  it("finds deletions and replacements", () => {
    const result = computeLineDiff("alpha\nbeta\ngamma", "alpha\ndelta")

    expect(result.lines.filter((line) => line.type === "removed")).toHaveLength(2)
    expect(result.lines.filter((line) => line.type === "added")).toHaveLength(1)
  })

  it("reconstructs both inputs from the diff", () => {
    const oldText = "one\ntwo\nthree\nfive"
    const newText = "zero\none\nthree\nfour\nfive"
    const result = computeLineDiff(oldText, newText)

    expect(
      result.lines
        .filter((line) => line.type !== "added")
        .map((line) => line.content)
        .join("\n"),
    ).toBe(oldText)
    expect(
      result.lines
        .filter((line) => line.type !== "removed")
        .map((line) => line.content)
        .join("\n"),
    ).toBe(newText)
  })

  it("falls back to the quick algorithm when the work budget is exceeded", () => {
    const result = computeLineDiff(
      "a\nb\nc\nd",
      "w\nx\ny\nz",
      "precise",
      { maxOperations: 2 },
    )

    expect(result.algorithmUsed).toBe("quick")
    expect(result.fallbackReason).toBe("work-limit")
  })

  it("falls back before allocating precise traces for extremely long input", () => {
    const result = computeLineDiff(
      "a\nb\nc",
      "a\nb\nd",
      "precise",
      { maxPreciseLines: 2 },
    )

    expect(result.algorithmUsed).toBe("quick")
    expect(result.fallbackReason).toBe("line-limit")
  })

  it("preserves both inputs for arbitrary small line sets", () => {
    fc.assert(
      fc.property(
        fc.array(fc.string({ maxLength: 8 }), { maxLength: 12 }),
        fc.array(fc.string({ maxLength: 8 }), { maxLength: 12 }),
        (oldLines, newLines) => {
          const oldText = oldLines.join("\n")
          const newText = newLines.join("\n")
          const result = computeLineDiff(oldText, newText)

          expect(
            result.lines
              .filter((line) => line.type !== "added")
              .map((line) => line.content)
              .join("\n"),
          ).toBe(oldText)
          expect(
            result.lines
              .filter((line) => line.type !== "removed")
              .map((line) => line.content)
              .join("\n"),
          ).toBe(newText)
        },
      ),
      { numRuns: 200 },
    )
  })
})
