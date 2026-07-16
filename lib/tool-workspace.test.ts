import { describe, expect, it } from "vitest"

import { haveEqualToolParams, uniqueToolIds } from "./tool-workspace"

describe("tool workspace helpers", () => {
  it("treats parameter order as irrelevant when reusing a tab", () => {
    expect(haveEqualToolParams({ feature: "Base64", mode: "encode" }, { mode: "encode", feature: "Base64" }))
      .toBe(true)
    expect(haveEqualToolParams({ feature: "Base64" }, { feature: "URL" })).toBe(false)
  })

  it("deduplicates shared-link tool ids while preserving order", () => {
    expect(uniqueToolIds(["hash", "encoding", "hash", "json"])).toEqual(["hash", "encoding", "json"])
  })
})
