import { describe, expect, it } from "vitest"
import {
  HttpRequestUrlError,
  buildRequestUrl,
  encodeUrlEncodedBody,
  parseCurlCommand,
} from "./http-request-tools"

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

  it("replaces URL parameters represented by editable rows instead of duplicating them", () => {
    expect(buildRequestUrl("https://example.com/api?q=old&keep=1", [
      { name: "q", value: "new", enabled: true },
    ])).toBe("https://example.com/api?keep=1&q=new")
  })

  it("rejects malformed and non-HTTP URLs with a useful error", () => {
    expect(() => buildRequestUrl("not a url")).toThrowError(
      expect.objectContaining({ code: "INVALID_URL" }),
    )
    expect(() => buildRequestUrl("file:///tmp/test")).toThrowError(
      expect.objectContaining({ code: "UNSUPPORTED_PROTOCOL" }),
    )
  })

  it("builds URL-encoded request bodies independently from query params", () => {
    expect(encodeUrlEncodedBody(params)).toBe("q=hello+world&empty=")
  })

  it("parses common single-line cURL commands", () => {
    expect(parseCurlCommand(
      `curl 'https://example.com/api' -H 'Content-Type: application/json' --data-raw '{"ok":true}'`,
    )).toEqual({
      method: "POST",
      url: "https://example.com/api",
      headers: [{ name: "Content-Type", value: "application/json" }],
      body: '{"ok":true}',
    })
  })

  it("parses multiline cURL commands and explicit methods", () => {
    expect(parseCurlCommand(
      "curl --request PATCH \\\n  --url https://example.com/items/1 \\\n  --header \"Accept: application/json\"",
    )).toMatchObject({
      method: "PATCH",
      url: "https://example.com/items/1",
      headers: [{ name: "Accept", value: "application/json" }],
    })
  })
})
