import { describe, expect, it } from "vitest"

import { createSearchableFeatures, searchFeatures } from "./search-utils"

describe("tool search utilities", () => {
  const features = createSearchableFeatures({
    encoding: { name: "编码工具" },
    httpTester: { name: "HTTP 测试器" },
    uuid: { name: "UUID 生成器" },
  })

  it("only creates features for available tool translations", () => {
    expect(features.some((feature) => feature.toolId === "encoding")).toBe(true)
    expect(features.some((feature) => feature.toolId === "http-tester")).toBe(true)
    expect(features.some((feature) => feature.toolId === "hash")).toBe(false)
  })

  it("matches names, tool names, and descriptions without case sensitivity", () => {
    expect(searchFeatures(features, "base64")[0]?.toolId).toBe("encoding")
    expect(searchFeatures(features, "http")[0]?.toolId).toBe("http-tester")
    expect(searchFeatures(features, "random uuid")[0]?.toolId).toBe("uuid")
  })

  it("returns no results for blank input", () => {
    expect(searchFeatures(features, "   ")).toEqual([])
  })
})
