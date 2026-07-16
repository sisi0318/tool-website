import { describe, expect, it } from "vitest"
import { buildRequestUrl, encodeUrlEncodedBody } from "./http-request-tools"

const params = [
  { name: "q", value: "hello world", enabled: true },
  { name: "empty", value: "", enabled: true },
  { name: "skip", value: "x", enabled: false },
]

describe("HTTP request tools", () => {
  it("preserves existing query parameters while adding enabled params", () => {
    expect(buildRequestUrl("https://example.com/api?existing=1", params))
      .toBe("https://example.com/api?existing=1&q=hello+world&empty=")
  })

  it("rejects malformed and non-HTTP URLs with a useful error", () => {
    expect(() => buildRequestUrl("not a url")).toThrow("有效完整 URL")
    expect(() => buildRequestUrl("file:///tmp/test")).toThrow("HTTP")
  })

  it("builds URL-encoded request bodies independently from query params", () => {
    expect(encodeUrlEncodedBody(params)).toBe("q=hello+world&empty=")
  })
})
