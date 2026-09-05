import { describe, expect, it } from "vitest"
import { buildUrl, inspectUrl, replaceUrlParameters } from "./url-tools"

describe("URL tools", () => {
  it("round-trips duplicate keys, flags, empty entries and exact untouched encodings", () => {
    const source = "https://example.com/a%2Fb?tag=one&tag=two&flag&empty=&=value&&q=a+b&slash=%2f#part%202"
    const result = inspectUrl(source)
    expect(result.parts.parameters.map(({ name, value, hasEquals }) => [name, value, hasEquals])).toEqual([["tag", "one", true], ["tag", "two", true], ["flag", "", false], ["empty", "", true], ["", "value", true], ["", "", false], ["q", "a b", true], ["slash", "/", true]])
    expect(buildUrl(result.parts)).toBe(source); expect(result.decodedPath).toBe("/a/b"); expect(result.decodedFragment).toBe("part 2")
    for (const suffix of ["?", "#", "?#", "?&&#"]) expect(buildUrl(inspectUrl("https://example.com/" + suffix).parts)).toBe("https://example.com/" + suffix)
  })
  it("edits a single repeated parameter and preserves its neighbors", () => {
    const { parts } = inspectUrl("https://example.com/?tag=a&tag=b&q=x+y")
    parts.parameters[1].value = "中文 &+"
    expect(buildUrl(parts)).toBe("https://example.com/?tag=a&tag=%E4%B8%AD%E6%96%87%20%26%2B&q=x+y")
    parts.parameters[0].enabled = false
    expect(buildUrl(parts)).not.toContain("tag=a")
  })
  it("handles plus interpretation independently from output space encoding", () => {
    const { parts } = inspectUrl("https://example.com/?q=a+b&plus=%2B", { plusAsSpace: false })
    expect(parts.parameters[0].value).toBe("a+b")
    expect(buildUrl(parts, { preserveEncoding: false })).toBe("https://example.com/?q=a%2Bb&plus=%2B")
    const decoded = inspectUrl("https://example.com/?q=a+b").parts
    expect(buildUrl(decoded, { preserveEncoding: false })).toBe("https://example.com/?q=a%20b")
    expect(buildUrl(decoded, { preserveEncoding: false, spaceEncoding: "plus" })).toBe("https://example.com/?q=a+b")
    expect(buildUrl(parts, { spaceEncoding: "plus" })).toBe("https://example.com/?q=a%2Bb&plus=%2B")
  })
  it("reports malformed percent/UTF-8 encodings and retains raw input for unchanged pairs", () => {
    const source = "https://example.com/%ZZ?a=%FF&b=%E4%B8#%"
    const result = inspectUrl(source)
    expect(result.issues).toHaveLength(4); expect(result.parts.parameters[0].value).toBe("%FF")
    expect(buildUrl(result.parts)).toBe(source)
  })
  it("parses IDNs, credentials, IPv6 and relative references using an explicit base", () => {
    const result = inspectUrl("https://user:p%40ss@例子.测试:8443/a")
    expect(result.unicodeHostname).toBe("例子.测试"); expect(result.decodedPassword).toBe("p@ss"); expect(buildUrl(result.parts)).toBe(result.href)
    expect(buildUrl(inspectUrl("https://[::1]:8080/a").parts)).toBe("https://[::1]:8080/a")
    expect(inspectUrl("../api?a=1", { base: "https://example.com/root/path/" }).href).toBe("https://example.com/root/api?a=1")
    expect(() => inspectUrl("../api")).toThrow("invalidUrl")
    expect(buildUrl(inspectUrl("file:///C:/data/a.txt?x=1").parts)).toBe("file:///C:/data/a.txt?x=1")
  })
  it("rejects silently ignored component edits and invalid encoding", () => {
    const parts = inspectUrl("https://example.com/").parts
    expect(() => buildUrl({ ...parts, port: "65536" })).toThrow("invalidPort")
    expect(() => buildUrl({ ...parts, hostname: "example.com/evil" })).toThrow("invalidHost")
    expect(() => buildUrl({ ...parts, hostname: "example.com:8080" })).toThrow("invalidHost")
    expect(() => buildUrl({ ...parts, pathname: "/a?x=1" })).toThrow("invalidPath")
    expect(() => buildUrl({ ...parts, protocol: "javascript:" })).toThrow("invalidProtocol")
    expect(() => buildUrl(replaceUrlParameters(parts, [{ name: "a", value: "\uD800" }]))).toThrow("invalidEncoding")
    expect(() => inspectUrl("https://example.com/\uD800")).toThrow("invalidEncoding")
    expect(() => inspectUrl("https://example.com/" + "中".repeat(8000))).toThrow("inputLimit")
  })
  it("replaces query entries explicitly, retaining repeats and accepting an empty list", () => {
    const parts = inspectUrl("https://example.com/?old=1").parts
    expect(buildUrl(replaceUrlParameters(parts, [{ name: "x", value: "a" }, { name: "x", value: "b" }, { name: "flag", value: "", hasEquals: false }]))).toBe("https://example.com/?x=a&x=b&flag")
    expect(buildUrl(replaceUrlParameters(parts, []))).toBe("https://example.com/")
    expect(() => replaceUrlParameters(parts, { x: 1 })).toThrow("invalidParameter")
  })
})
