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
