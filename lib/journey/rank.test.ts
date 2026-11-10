import { beforeEach, describe, expect, it } from "vitest"

import { clearRegistry } from "../canvas/registry"
import { registerEncodingAdapter } from "../adapters/encoding"
import { registerHashAdapter } from "../adapters/hash"
import { registerJsonFormatAdapter } from "../adapters/json-format"
import { registerXmlAdapter } from "../adapters/xml"
import { rankCompatibleTools } from "./suggest"

beforeEach(() => {
  clearRegistry()
  registerEncodingAdapter()
  registerHashAdapter()
  registerJsonFormatAdapter()
  registerXmlAdapter()
})

describe("ordering the tool picker", () => {
  const types = (definitions: Array<{ type: string }>) => definitions.map((definition) => definition.type)

  it("puts what fits this value first, then tools already used on this path, then the rest", () => {
    const ranked = rankCompatibleTools('{"a":1}', "string", ["xml", "hash"])
    // 识别为 JSON:格式化 JSON 排在通用的文本工具前面
    expect(types(ranked.recommended)[0]).toBe("json-format")
    expect(types(ranked.recommended)).toContain("hash")
    // 用过的工具即使和这份数据关系不大也提上来;最近用的在前
    const recommended = types(ranked.recommended)
    expect(recommended).toContain("xml")
    expect(types(ranked.others)).not.toContain("xml")
    expect(new Set([...recommended, ...types(ranked.others)]).size).toBe(recommended.length + ranked.others.length)
  })

  it("never recommends a tool that cannot take the value", () => {
    const ranked = rankCompatibleTools(new File(["x"], "a.bin"), "bytes", ["hash", "encoding"])
    expect(types(ranked.recommended)).not.toContain("hash")
    expect(types(ranked.others)).not.toContain("hash")
  })
})
