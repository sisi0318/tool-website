import { describe, expect, it } from "vitest"
import { processXml } from "./xml-tools"

const XML = '<root id="1"><item>A</item><item>B</item></root>'

describe("XML tools", () => {
  it("formats and minifies XML", () => {
    expect(processXml(XML, "format")).toContain("\n  <item>A</item>")
    expect(processXml(XML, "minify")).toBe(XML)
  })

  it("converts XML to JSON and back", () => {
    const json = processXml(XML, "to-json")
    expect(JSON.parse(json).root["@id"]).toBe(1)
    expect(processXml(json, "from-json")).toContain('<root id="1">')
  })

  it("gives JSON with several top-level keys a single root element", () => {
    const xml = processXml('{"person":{"name":"Ada"},"company":"Acme","tags":["a","b"]}', "from-json")
    expect(xml.startsWith("<root>")).toBe(true)
    expect(xml.endsWith("</root>")).toBe(true)
    expect(processXml('{"tags":["a","b"]}', "from-json")).toMatch(/^<root>\s*<tags>a<\/tags>/)
  })

  it("wraps a root JSON array with valid XML element names", () => {
    const xml = processXml('[{"name":"Ada"},{"name":"Linus"}]', "from-json")
    expect(xml).toContain("<root>")
    expect(xml.match(/<item>/g)).toHaveLength(2)
    expect(xml).not.toMatch(/<\d+>/)
  })

  it("queries XML with XPath", () => {
    expect(processXml(XML, "xpath", "string(/root/item[2])")).toBe("B")
  })

  it("reports malformed XML", () => {
    expect(() => processXml("<root>", "validate")).toThrow("Invalid XML")
  })
})
