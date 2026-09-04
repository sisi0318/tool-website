import { describe, expect, it } from "vitest"
import { escapeJsonText, tryRepairCommonJson, unescapeJsonText, sortJsonKeys } from "./json-text-tools"

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

describe("sortJsonKeys", () => {
  it("递归排序而不丢失嵌套字段", () => {
    // 旧写法 JSON.stringify(v, Object.keys(v).sort()) 会把 b 变成 {}
    expect(sortJsonKeys({ b: { x: 1 }, a: 2 })).toEqual({ a: 2, b: { x: 1 } })
    expect(JSON.stringify(sortJsonKeys({ b: { x: 1 }, a: 2 }))).toBe('{"a":2,"b":{"x":1}}')
  })

  it("保留数组结构与顺序", () => {
    expect(sortJsonKeys([{ b: 1, a: 2 }, 3])).toEqual([{ a: 2, b: 1 }, 3])
    expect(JSON.stringify(sortJsonKeys(["z", "a"]))).toBe('["z","a"]')
  })

  it("原样返回标量与 null", () => {
    expect(sortJsonKeys(null)).toBeNull()
    expect(sortJsonKeys(42)).toBe(42)
    expect(sortJsonKeys("s")).toBe("s")
  })
})
