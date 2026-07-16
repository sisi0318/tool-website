import { describe, expect, it } from "vitest"
import { escapeJsonText, tryRepairCommonJson, unescapeJsonText } from "./json-text-tools"

describe("JSON text tools", () => {
  it("round-trips quotes, slashes and real newlines", () => {
    const source = '{\n  "path": "C:\\\\temp",\n  "text": "你好"\n}'
    expect(unescapeJsonText(escapeJsonText(source))).toBe(source)
  })

  it("unescapes a complete quoted JSON string", () => {
    expect(unescapeJsonText('"line 1\\nline 2"')).toBe("line 1\nline 2")
  })

  it("offers a repair without mutating the original text", () => {
    const source = "{name: \"Ada\",}"
    expect(tryRepairCommonJson(source)).toEqual({ name: "Ada" })
    expect(source).toBe("{name: \"Ada\",}")
  })
})
