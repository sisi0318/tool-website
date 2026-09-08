import { describe, expect, it } from "vitest"
import {
  HttpRequestUrlError,
  buildRequestUrl,
  encodeUrlEncodedBody,
  parseCurlCommand,
  curlRequestStart,
  curlTextBody,
  curlTextField,
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
      bodyType: "raw",
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

  it("removes disabled URL fields and supports clearing the entire editable query", () => {
    expect(buildRequestUrl("https://example.com/?token=secret&keep=1", [{ name: "token", value: "secret", enabled: false }]))
      .toBe("https://example.com/?keep=1")
    expect(buildRequestUrl("https://example.com/?token=secret#section", [], { replaceQuery: true }))
      .toBe("https://example.com/#section")
  })

  it("resolves query variables as values before encoding in both URL and row input", () => {
    const transform = (value: string) => value.replaceAll("{{token}}", "a&b=c +d")
    const url = "https://example.com/?token=%7B%7Btoken%7D%7D"
    for (const output of [
      buildRequestUrl(url, [], { transform }),
      buildRequestUrl(url, [{ name: "token", value: "{{token}}", enabled: true }], { transform, replaceQuery: true }),
    ]) {
      expect([...new URL(output).searchParams]).toEqual([["token", "a&b=c +d"]])
    }
  })

  it("rejects executable method text and quotes supported methods", () => {
    expect(() => parseCurlCommand("curl -X 'GET; echo AUDIT_MARKER #' 'https://example.com/api'"))
      .toThrow("UNSUPPORTED_HTTP_METHOD")
    expect(() => curlRequestStart("GET; echo AUDIT_MARKER #", "https://example.com/api"))
      .toThrow("UNSUPPORTED_HTTP_METHOD")
    expect(curlRequestStart("POST", "https://example.com/api")).toBe("curl -X 'POST' 'https://example.com/api'")
  })

  it("exports literal @ bodies and form values without curl file interpretation", () => {
    const request = curlRequestStart("POST", "https://example.com/api")
    expect(curlTextBody("@private.txt")).toBe("--data-raw '@private.txt'")
    expect(parseCurlCommand(`${request} ${curlTextBody("@private.txt")}`)).toMatchObject({ body: "@private.txt", bodyType: "raw" })
    expect(curlTextField("text", "@private.txt;type=text/plain")).toBe("--form-string 'text=@private.txt;type=text/plain'")
    expect(parseCurlCommand(`${request} ${curlTextField("text", "@private.txt;type=text/plain")}`)).toMatchObject({ bodyType: "form-data", formData: [{ name: "text", value: "@private.txt;type=text/plain" }] })
    expect(parseCurlCommand(`${request} ${curlTextBody("")}`)).toMatchObject({ body: "", bodyType: "raw" })
  })

  it("imports encoded form data and content type without interpreting files", () => {
    expect(parseCurlCommand("curl https://example.com/api --data-urlencode 'q=a&b=c d' -d 'page=1'"))
      .toMatchObject({ method: "POST", body: "q=a%26b%3Dc+d&page=1", bodyType: "raw", headers: [{ name: "Content-Type", value: "application/x-www-form-urlencoded" }] })
    for (const option of ["--data @file", "--data-binary @file", "--data-urlencode name@file", "-F file=@file", "--user user:password", "--json '{}'", "--unknown"]) {
      expect(() => parseCurlCommand(`curl https://example.com/api ${option}`)).toThrow(/UNSUPPORTED_CURL/)
    }
  })

  it("imports literal cookies and simple multipart fields, rejecting mixed bodies", () => {
    expect(parseCurlCommand("curl https://example.com/api -b 'session=example' -F 'name=Ada'"))
      .toMatchObject({ method: "POST", headers: [{ name: "Cookie", value: "session=example" }], bodyType: "form-data", formData: [{ name: "name", value: "Ada" }] })
    expect(() => parseCurlCommand("curl https://example.com/api -F 'name=Ada' -d 'x=1'"))
      .toThrow("CONFLICTING_CURL_BODY")
  })
})
