import { describe, expect, it } from "vitest"
import { findJsonErrorOffset, jsonErrorLocation, locationAt, locationFromMessage, LocatedError, offsetOf, parseJsonLocated } from "./text-location"

describe("text locations", () => {
  it("converts between offsets and line/column", () => {
    const text = "ab\ncde\n\nf"
    expect(locationAt(text, 0)).toEqual({ line: 1, column: 1 })
    expect(locationAt(text, 4)).toEqual({ line: 2, column: 2 })
    expect(locationAt(text, 8)).toEqual({ line: 4, column: 1 })
    expect(offsetOf(text, { line: 2, column: 2 })).toBe(4)
    expect(offsetOf(text, { line: 2, column: 99 })).toBe(6)
    expect(offsetOf(text, { line: 99, column: 1 })).toBe(text.length)
  })

  it("reads positions from common error messages", () => {
    expect(locationFromMessage("Invalid XML at line 3, column 7: bad")).toEqual({ line: 3, column: 7 })
    expect(locationFromMessage("Parse error at token: ) at line 2 column 9")).toEqual({ line: 2, column: 9 })
    expect(locationFromMessage("Unexpected token (4:12)")).toEqual({ line: 4, column: 12 })
    expect(locationFromMessage("Unexpected token } in JSON at position 5", "{\n\"a\"}")).toEqual({ line: 2, column: 4 })
    expect(locationFromMessage("something went wrong")).toBeNull()
  })
})

describe("JSON error locations", () => {
  it("finds the first syntax error when the engine gives no position", () => {
    expect(findJsonErrorOffset('{"a":}')).toBe(5)
    expect(findJsonErrorOffset('{"a":1,}')).toBe(7)
    expect(findJsonErrorOffset("{'a':1}")).toBe(1)
    expect(findJsonErrorOffset('{"a')).toBe(3)
    expect(findJsonErrorOffset('[1, 2] x')).toBe(7)
    expect(findJsonErrorOffset('"bad \\q escape"')).toBe(5)
    expect(findJsonErrorOffset("")).toBe(0)
    expect(findJsonErrorOffset('{"ok": [1, -2.5e3, true, null, "\\u00e9"]}')).toBeNull()
  })

  it("agrees with JSON.parse about what is valid", () => {
    for (const text of ["1", "[]", '{"a":[{}]}', "01", "1.", "[1,]", "{\"a\" 1}", "tru", "\"\t\"", "-", "1e", "  null  "]) {
      let valid = true
      try { JSON.parse(text) } catch { valid = false }
      expect(findJsonErrorOffset(text) === null, text).toBe(valid)
    }
  })

  it("prefers the engine's position and falls back to scanning", () => {
    const text = '{\n  "a": 1,\n  "b": }'
    expect(jsonErrorLocation(text, new SyntaxError("Unexpected token '}', \"...\" is not valid JSON"))).toEqual({ line: 3, column: 8 })
    expect(jsonErrorLocation(text, new SyntaxError("Unexpected token } in JSON at position 19"))).toEqual({ line: 3, column: 8 })
  })

  it("throws a located error with the engine message", () => {
    try {
      parseJsonLocated('{"a":1,}')
      expect.unreachable()
    } catch (error) {
      expect(error).toBeInstanceOf(LocatedError)
      expect((error as LocatedError).location).toEqual({ line: 1, column: 8 })
      expect((error as LocatedError).message).toMatch(/JSON/)
    }
  })
})
