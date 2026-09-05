import { describe, expect, it } from "vitest"

import { formatCanvasValue, previewCanvasValue } from "./format-value"

describe("formatCanvasValue", () => {
  it("二进制与 Blob 只给摘要,嵌在对象里也一样", () => {
    expect(formatCanvasValue(new Uint8Array(2048))).toBe("bytes (2.0 KB)")
    expect(formatCanvasValue(new ArrayBuffer(10))).toBe("bytes (10 B)")
    expect(formatCanvasValue(new Blob(["abc"]))).toBe("Blob (3 B)")
    expect(formatCanvasValue(new File(["x"], "a.bin"))).toBe("a.bin (1 B)")
    expect(formatCanvasValue({ data: new Uint8Array(3) })).toBe('{"data":"bytes (3 B)"}')
  })

  it("循环引用不会抛错", () => {
    const value: Record<string, unknown> = { name: "loop" }
    value.self = value
    expect(formatCanvasValue(value)).toBe('{"name":"loop","self":"[Circular]"}')
  })
})

describe("previewCanvasValue", () => {
  const fixtures: unknown[] = [
    { a: 1, b: [1, "two", null, true], c: { d: "quote\"and\\slash", e: {} }, f: [] },
    [[], {}, [[1]], "s", 2.5, false, null],
    { nested: { deeper: { deepest: [{ x: 1 }, { y: [2, 3] }] } } },
    { date: new Date(Date.UTC(2024, 0, 1)), skipped: undefined, fn: () => 1, keep: 0 },
    [undefined, () => 1, 10],
    "plain",
    42,
    null,
  ]

  it("预算够用时与 JSON.stringify 逐字一致(紧凑与美化两种)", () => {
    for (const value of fixtures) {
      if (typeof value === "string") continue
      const compact = previewCanvasValue(value, 10_000)
      expect(compact.text, JSON.stringify(value)).toBe(JSON.stringify(value) ?? "")
      expect(compact.truncated).toBe(false)
      const pretty = previewCanvasValue(value, 10_000, true)
      expect(pretty.text, JSON.stringify(value)).toBe(JSON.stringify(value, null, 2) ?? "")
    }
  })

  it("字符串直接按预算截断并报告总长度", () => {
    expect(previewCanvasValue("hello", 10)).toEqual({ text: "hello", truncated: false, fullLength: 5 })
    expect(previewCanvasValue("hello world", 5)).toEqual({ text: "hello", truncated: true, fullLength: 11 })
  })

  it("大对象在预算处停下,产出正好 maxChars 个字符且是 JSON 的前缀", () => {
    const big = Array.from({ length: 100_000 }, (_, i) => ({ id: i, label: `item-${i}` }))
    const preview = previewCanvasValue(big, 200)
    expect(preview.truncated).toBe(true)
    expect(preview.text).toHaveLength(200)
    expect(JSON.stringify(big).startsWith(preview.text)).toBe(true)
    expect(preview.fullLength).toBeUndefined()
  })

  it("对象里嵌着超长字符串时同样只产出预算内的字符", () => {
    const preview = previewCanvasValue({ text: "x".repeat(5_000_000) }, 50)
    expect(preview.truncated).toBe(true)
    expect(preview.text).toBe(`{"text":"${"x".repeat(41)}`)
  })

  it("刚好写满预算不算截断", () => {
    const value = { a: 1 }
    const exact = JSON.stringify(value).length
    expect(previewCanvasValue(value, exact)).toEqual({ text: '{"a":1}', truncated: false, fullLength: exact })
    expect(previewCanvasValue(value, exact - 1).truncated).toBe(true)
  })

  it("循环引用、BigInt 与二进制在预览里都有稳定的表示", () => {
    const value: Record<string, unknown> = { n: BigInt(10), bytes: new Uint8Array(4) }
    value.self = value
    expect(previewCanvasValue(value, 1000).text).toBe('{"n":10,"bytes":"bytes (4 B)","self":"[Circular]"}')
  })

  it("同一对象被引用两次(非循环)不会被误判为循环", () => {
    const shared = { k: 1 }
    expect(previewCanvasValue([shared, shared], 1000).text).toBe('[{"k":1},{"k":1}]')
  })
})
