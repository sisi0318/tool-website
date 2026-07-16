import { describe, expect, it } from "vitest"

import { buildRegexHighlightSegments } from "./regex-highlight"

describe("buildRegexHighlightSegments", () => {
  it("keeps untrusted HTML as plain text data", () => {
    const payload = '<img src=x onerror="alert(1)">'
    const text = `${payload} safe`
    const segments = buildRegexHighlightSegments(text, [
      { index: 0, length: payload.length, match: payload },
    ])

    expect(segments[0]).toEqual({
      type: "match",
      text: payload,
      matchIndex: 0,
      start: 0,
    })
  })

  it("preserves the original match index after sorting", () => {
    const segments = buildRegexHighlightSegments("one two", [
      { index: 4, length: 3, match: "two" },
      { index: 0, length: 3, match: "one" },
    ])

    expect(segments.filter((segment) => segment.type === "match")).toEqual([
      { type: "match", text: "one", matchIndex: 1, start: 0 },
      { type: "match", text: "two", matchIndex: 0, start: 4 },
    ])
  })
})
