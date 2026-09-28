import fc from "fast-check"
import { describe, expect, it } from "vitest"

import { computeLineDiff, diffChangeStarts, diffLineNumbers, unifiedDiff } from "./text-diff"

describe("diff presentation", () => {
  it("ignores whitespace-only changes on request but shows the original lines", () => {
    const oldText = "if (a) {\n  run()\n}"
    const newText = "if (a)  {\n    run()\n}"
    expect(computeLineDiff(oldText, newText).added).toBe(2)
    const ignored = computeLineDiff(oldText, newText, "precise", { ignoreWhitespace: true })
    expect(ignored.added + ignored.removed).toBe(0)
    expect(ignored.lines.map((line) => line.content)).toEqual(["if (a)  {", "    run()", "}"])
    expect(computeLineDiff(oldText, `${newText}\nextra`, "quick", { ignoreWhitespace: true }).lines.at(-1)).toEqual({ type: "added", content: "extra" })
  })

  it("numbers lines by their position in each file and finds where changes start", () => {
    const { lines } = computeLineDiff("a\nb\nc\nd", "a\nB\nc\nd\ne")
    expect(diffLineNumbers(lines)).toEqual([
      { old: 1, new: 1 },
      { old: 2, new: null },
      { old: null, new: 2 },
      { old: 3, new: 3 },
      { old: 4, new: 4 },
      { old: null, new: 5 },
    ])
    expect(diffChangeStarts(lines)).toEqual([1, 5])
  })

  it("writes a standard unified diff with context, merging nearby changes", () => {
    expect(unifiedDiff(computeLineDiff("a\nb\nc", "a\nB\nc").lines)).toBe("--- original\n+++ modified\n@@ -1,3 +1,3 @@\n a\n-b\n+B\n c\n")
    expect(unifiedDiff(computeLineDiff("", "x").lines, { oldName: "a.txt", newName: "b.txt" })).toBe("--- a.txt\n+++ b.txt\n@@ -0,0 +1,1 @@\n+x\n")
    expect(unifiedDiff(computeLineDiff("same", "same").lines)).toBe("")

    const oldLines = Array.from({ length: 20 }, (_, index) => `line ${index + 1}`)
    const far = [...oldLines]
    far[1] = "changed 2"
    far[17] = "changed 18"
    const hunks = unifiedDiff(computeLineDiff(oldLines.join("\n"), far.join("\n")).lines).split("\n").filter((line) => line.startsWith("@@"))
    expect(hunks).toEqual(["@@ -1,5 +1,5 @@", "@@ -15,6 +15,6 @@"])
    const near = [...oldLines]
    near[1] = "changed 2"
    near[7] = "changed 8"
    expect(unifiedDiff(computeLineDiff(oldLines.join("\n"), near.join("\n")).lines).split("\n").filter((line) => line.startsWith("@@"))).toEqual(["@@ -1,11 +1,11 @@"])
  })
})

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
