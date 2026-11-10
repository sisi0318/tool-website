import { beforeEach, describe, expect, it } from "vitest"

import { clearRegistry } from "../canvas/registry"
import { registerEncodingAdapter } from "../adapters/encoding"
import { registerHashAdapter } from "../adapters/hash"
import { registerJsonFormatAdapter } from "../adapters/json-format"
import { registerTabularAdapters } from "../adapters/tabular"
import { registerTextLinesAdapter } from "../adapters/text-lines"
import { registerXmlAdapter } from "../adapters/xml"
import { describeStep, summarizeValue } from "./describe"
import { STEP_LABEL_ENTRIES, suggestNext } from "./suggest"
import { en } from "../translations/en"

const step = (tool: string, config: Record<string, unknown> = {}) => ({ tool, config, outputPort: "" })

beforeEach(() => {
  clearRegistry()
  registerEncodingAdapter()
  registerHashAdapter()
  registerJsonFormatAdapter()
  registerTabularAdapters()
  registerTextLinesAdapter()
  registerXmlAdapter()
})

describe("naming a step by what it did", () => {
  it("uses the action phrase when the configuration is one a suggestion would create", () => {
    expect(describeStep(step("encoding", { encoding: "base64", mode: "decode" }))).toEqual({ labelKey: "base64Decode", details: [] })
    expect(describeStep(step("encoding", { encoding: "url", mode: "decode" }))).toEqual({ labelKey: "urlDecode", details: [] })
    // 配置里多出默认值不影响:建议只写它关心的字段,落进旅程时会补齐
    expect(describeStep(step("encoding", { input: "", encoding: "base64", mode: "encode" })).labelKey).toBe("base64Encode")
    expect(describeStep(step("tabular", { format: "jsonl" })).labelKey).toBe("queryJsonlLogs")
    expect(describeStep(step("tabular", { format: "csv" })).labelKey).toBe("queryCsvRows")
  })

  it("matches a phrase that relies on defaults only while the step is still at those defaults", () => {
    expect(describeStep(step("hash"))).toEqual({ labelKey: "hashText", details: [] })
    expect(describeStep(step("xml"))).toEqual({ labelKey: "formatXml", details: [] })
    // “格式化 XML”没写操作类型;换成 XPath 之后再叫这个名字就是错的
    expect(describeStep(step("xml", { operation: "xpath" }))).toEqual({ labelKey: null, details: ["XPath"] })
  })

  it("falls back to the tool name with the options that differ from the defaults", () => {
    expect(describeStep(step("encoding", { encoding: "html", mode: "decode" }))).toEqual({ labelKey: null, details: ["HTML", "Decode"] })
    expect(describeStep(step("encoding", { encoding: "html" }))).toEqual({ labelKey: null, details: ["HTML"] })
    // 有上下级的下拉只留下级:分类 SHA-2 是算法 SHA-2-256 的前提,不必两个都写
    expect(describeStep(step("hash", { category: "sha2", algorithm: "sha2-256" }))).toEqual({ labelKey: null, details: ["SHA-2-256"] })
    expect(describeStep(step("text-lines", { operation: "sort" })).labelKey).toBeNull()
  })

  it("has nothing to add for a tool it does not know", () => {
    expect(describeStep(step("not-registered", { anything: 1 }))).toEqual({ labelKey: null, details: [] })
  })

  it("only points at phrases that exist, and covers every phrase a suggestion can carry", () => {
    for (const entry of STEP_LABEL_ENTRIES) {
      expect(en.journeySuggestions, entry.key).toHaveProperty(entry.key)
    }
    const known = new Set(STEP_LABEL_ENTRIES.map((entry) => entry.key))
    const samples: Array<[unknown, "string" | "bytes"]> = [
      ["aGVsbG8gd29ybGQ=", "string"],
      ['{"a":1}', "string"],
      ["https://example.com/?a=1", "string"],
      ['{"a":1}\n{"a":2}', "string"],
      ["a​b\nc", "string"],
      [new File(["x"], "data.csv", { type: "text/csv" }), "bytes"],
      [new File(["x"], "data.zip", { type: "application/zip" }), "bytes"],
    ]
    for (const [value, type] of samples) {
      for (const suggestion of suggestNext(value, type, 50)) {
        if (suggestion.labelKey) expect(known.has(suggestion.labelKey), suggestion.labelKey).toBe(true)
      }
    }
  })
})

describe("summarising a value in one line", () => {
  it("counts characters and lines of text", () => {
    expect(summarizeValue({ value: "hello" })).toEqual({ kind: "text", chars: 5, lines: 1 })
    expect(summarizeValue({ value: "a\nb\n" })).toEqual({ kind: "text", chars: 4, lines: 3 })
    expect(summarizeValue({ value: "" })).toEqual({ kind: "empty" })
  })

  it("describes files, collections and scalars", () => {
    expect(summarizeValue({ value: new File(["abc"], "note.txt") })).toEqual({ kind: "file", name: "note.txt", bytes: 3 })
    expect(summarizeValue({ value: new Blob(["abcd"]) })).toEqual({ kind: "file", name: "", bytes: 4 })
    expect(summarizeValue({ value: [1, 2, 3] })).toEqual({ kind: "list", items: 3 })
    expect(summarizeValue({ value: { a: 1, b: 2 } })).toEqual({ kind: "object", fields: 2 })
    expect(summarizeValue({ value: 42 })).toEqual({ kind: "scalar", text: "42" })
    expect(summarizeValue({ value: null })).toEqual({ kind: "empty" })
  })

  it("says so when the value was not kept", () => {
    expect(summarizeValue({ value: null, valueMissing: true })).toEqual({ kind: "missing" })
  })
})
