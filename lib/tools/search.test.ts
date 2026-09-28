import { describe, expect, it } from "vitest"

import { TOOL_CATALOG } from "@/lib/tools/catalog"
import { zh } from "@/lib/translations/zh"
import { createToolSearchIndex, searchTools } from "./search"

const toolNames = (zh as unknown as { tools: Record<string, { name?: string } | undefined> }).tools
const index = createToolSearchIndex(
  Object.fromEntries(TOOL_CATALOG.map((entry) => [entry.translationKey, { name: toolNames[entry.translationKey]?.name }])),
)
const top = (term: string) => searchTools(index, term)[0]?.toolId

describe("tool search", () => {
  it("only indexes tools that have a translated name", () => {
    const partial = createToolSearchIndex({ encoding: { name: "编码工具" }, httpTester: { name: "HTTP 测试器" } })
    expect(partial.map((tool) => tool.toolId)).toEqual(expect.arrayContaining(["encoding", "http-tester"]))
    expect(partial.some((tool) => tool.toolId === "hash")).toBe(false)
  })

  it("puts the tool the query names ahead of tools that only mention it", () => {
    expect(top("json")).toBe("json")
    expect(top("csv")).toBe("csv")
    expect(top("pdf")).toBe("pdf")
    expect(top("hash")).toBe("hash")
    expect(top("sha256")).toBe("hash")
    expect(top("SHA-256")).toBe("hash")
    expect(top("密码")).toBe("password-generator")
    expect(top("base64")).toBe("encoding")
    expect(top("时间戳")).toBe("time")
    expect(top("正则")).toBe("regex")
    expect(top("2fa")).toBe("totp")
  })

  it("lists each tool once", () => {
    const results = searchTools(index, "图片")
    expect(new Set(results.map((result) => result.toolId)).size).toBe(results.length)
  })

  it("passes the value a tool understands when a feature is matched", () => {
    expect(searchTools(index, "JSON 压缩")[0]).toMatchObject({ toolId: "json", featureName: "JSON 压缩", featureParam: "minify" })
    expect(searchTools(index, "口令短语")[0]).toMatchObject({ toolId: "password-generator", featureParam: "passphrase" })
    expect(searchTools(index, "hash")[0]).toMatchObject({ featureName: "", featureParam: undefined })
  })

  it("returns no results for blank input", () => {
    expect(searchTools(index, "   ")).toEqual([])
  })
})
