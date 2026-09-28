import { XMLBuilder, XMLParser, XMLValidator } from "fast-xml-parser"
import { LocatedError, parseJsonLocated } from "@/lib/text-location"

export type XmlOperation = "format" | "minify" | "to-json" | "from-json" | "xpath" | "validate"

function assertValidXml(input: string): void {
  const validation = XMLValidator.validate(input)
  if (validation !== true) {
    throw new LocatedError(`Invalid XML: ${validation.err.msg}`, { line: validation.err.line, column: validation.err.col })
  }
}

export function formatXml(input: string, formatted = true): string {
  assertValidXml(input)
  const parser = new XMLParser({
    ignoreAttributes: false,
    preserveOrder: true,
    commentPropName: "#comment",
  })
  const builder = new XMLBuilder({
    ignoreAttributes: false,
    preserveOrder: true,
    commentPropName: "#comment",
    format: formatted,
    indentBy: "  ",
    suppressEmptyNode: false,
  })
  return builder.build(parser.parse(input)).trim()
}

export function xmlToJson(input: string): string {
  assertValidXml(input)
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@",
    textNodeName: "#text",
    parseTagValue: true,
    parseAttributeValue: true,
    trimValues: true,
  })
  return JSON.stringify(parser.parse(input), null, 2)
}

export function jsonToXml(input: string): string {
  const parsed = parseJsonLocated(input)
  // XML 只能有一个根元素：对象恰好一个键（值不是数组）时它就是根，否则外面包一层 root。
  // 以前多个顶层键会生成多个并列的根元素，不是合法的 XML
  const keys = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? Object.keys(parsed) : []
  const singleRoot = keys.length === 1 && !keys[0].startsWith("@") && !Array.isArray((parsed as Record<string, unknown>)[keys[0]])
  const normalized = Array.isArray(parsed)
    ? { root: { item: parsed } }
    : singleRoot
      ? parsed
      : { root: parsed }
  const builder = new XMLBuilder({
    ignoreAttributes: false,
    attributeNamePrefix: "@",
    textNodeName: "#text",
    format: true,
    indentBy: "  ",
    suppressEmptyNode: false,
  })
  return builder.build(normalized).trim()
}

export function queryXml(input: string, xpath: string): string {
  assertValidXml(input)
  if (typeof DOMParser === "undefined" || typeof XPathResult === "undefined") {
    throw new Error("XPath is not available in this environment")
  }
  const document = new DOMParser().parseFromString(input, "application/xml")
  const result = document.evaluate(xpath, document, null, XPathResult.ANY_TYPE, null)
  if (result.resultType === XPathResult.STRING_TYPE) return result.stringValue
  if (result.resultType === XPathResult.NUMBER_TYPE) return String(result.numberValue)
  if (result.resultType === XPathResult.BOOLEAN_TYPE) return String(result.booleanValue)

  const serializer = new XMLSerializer()
  const values: string[] = []
  let node = result.iterateNext()
  while (node) {
    values.push(node.nodeType === Node.ATTRIBUTE_NODE || node.nodeType === Node.TEXT_NODE
      ? node.nodeValue ?? ""
      : serializer.serializeToString(node))
    node = result.iterateNext()
  }
  return values.join("\n")
}

export function processXml(input: string, operation: XmlOperation, xpath = "//*"): string {
  switch (operation) {
    case "format":
      return formatXml(input, true)
    case "minify":
      return formatXml(input, false)
    case "to-json":
      return xmlToJson(input)
    case "from-json":
      return jsonToXml(input)
    case "xpath":
      return queryXml(input, xpath)
    case "validate":
      assertValidXml(input)
      return "XML is well-formed."
  }
}
