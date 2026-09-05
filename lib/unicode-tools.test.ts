import { describe, expect, it } from "vitest"
import { inspectUnicode, processUnicode, UNICODE_LIMITS } from "./unicode-tools"

describe("Unicode inspector", () => {
  it("distinguishes code points, UTF-16 units, UTF-8 bytes and grapheme clusters", () => {
    const result = inspectUnicode("A中😀e\u0301👩‍💻")
    expect(result.codePoints).toBe(8); expect(result.utf16Units).toBe(11); expect(result.graphemes).toBe(5)
    expect(result.utf8Bytes).toBe(new TextEncoder().encode("A中😀e\u0301👩‍💻").length)
    expect(result.characters[2]).toMatchObject({ codePoint: "U+1F600", utf16Offset: 2, utf16: ["D83D", "DE00"], utf8: "F0 9F 98 80", escape: "\\u{1F600}", grapheme: 2 })
    expect(result.characters.slice(5).map((entry) => entry.grapheme)).toEqual([4, 4, 4])
  })
  it("labels whitespace, bidi controls, joiners and supplementary variation selectors", () => {
    const result = inspectUnicode(" \t\r\n\u00A0\u200B\u200D\u202E\uFEFF\u{E0100}")
    expect(result.characters.map((entry) => entry.label)).toEqual(["SPACE", "TAB", "CR", "LF", "NBSP", "ZWSP", "ZWJ", "RLO", "BOM / ZWNBSP", "VS17"])
    expect(result.characters[7].flags).toContain("bidi"); expect(result.characters[9].flags).toContain("variation"); expect(result.flagged).toBe(10)
  })
  it("marks lone surrogates without inventing UTF-8 bytes", () => {
    const result = inspectUnicode("a\uD800b\uDC00")
    expect(result.wellFormed).toBe(false); expect(result.utf8Bytes).toBeNull()
    expect(result.characters[1]).toMatchObject({ codePoint: "U+D800", utf8: null, category: "Surrogate", flags: ["surrogate"] })
    expect(() => processUnicode("\uD800", "NFC")).toThrow("illFormed")
  })
  it("applies canonical and compatibility normalization separately", () => {
    expect(processUnicode("e\u0301", "NFC").output).toBe("é")
    expect(processUnicode("é", "NFD").output).toBe("e\u0301")
    expect(processUnicode("Ａ①ﬃ", "NFC").output).toBe("Ａ①ﬃ")
    expect(processUnicode("Ａ①ﬃ", "NFKC").output).toBe("A1ffi")
    expect(processUnicode("é①", "NFKD").output).toBe("e\u03011")
    expect(inspectUnicode("e\u0301").normalized).toEqual({ NFC: false, NFD: true, NFKC: false, NFKD: true })
  })
  it("handles empty input and enforces limits before and after normalization", () => {
    expect(inspectUnicode("")).toMatchObject({ codePoints: 0, graphemes: 0, utf16Units: 0, utf8Bytes: 0, wellFormed: true })
    expect(() => inspectUnicode("x".repeat(UNICODE_LIMITS.units + 1))).toThrow("inputLimit")
    expect(() => inspectUnicode("x".repeat(UNICODE_LIMITS.codePoints + 1))).toThrow("pointLimit")
    expect(() => processUnicode("\uFDFA".repeat(2000), "NFKD")).toThrow("pointLimit")
  })
})
