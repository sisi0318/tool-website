import { describe, expect, it } from "vitest"
import { unicodeAdapter, registerUnicodeAdapter } from "./unicode"
import { suggestNext } from "../journey/suggest"

describe("Unicode adapter", () => {
  it("returns normalized text and a report of the actual output", async () => {
    const result = await unicodeAdapter.execute({ input: "e\u0301" }, { operation: "NFC" })
    expect(result.output).toBe("é"); expect(result.codePoints).toBe(1)
    expect(result.report).toMatchObject({ utf16Units: 1, utf8Bytes: 2, wellFormed: true })
  })
  it("keeps inspection diagnostics for invalid UTF-16", async () => {
    const result = await unicodeAdapter.execute({ input: "\uD800" }, {})
    expect(result.wellFormed).toBe(false)
    expect(JSON.parse(String(result.output)).characters[0].utf8).toBeNull()
  })
  it("suggests inspection when text contains invisible characters", () => {
    registerUnicodeAdapter()
    expect(suggestNext("a\u200bb", "string").some((suggestion) => suggestion.tool === "unicode" && suggestion.outputPort === "report")).toBe(true)
  })
})
