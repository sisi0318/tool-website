import { FileCode2 } from "lucide-react"

import { registerNode } from "../canvas/registry"
import type { XmlOperation } from "../xml-tools"
import type { ToolAdapter } from "./types"

export const xmlAdapter: ToolAdapter = {
  type: "xml",
  category: "data",
  label: "XML Tools",
  description: "Format, validate, query and convert XML",
  icon: FileCode2,
  config: [
    { id: "input", name: "Input", dataType: "string", defaultValue: "", multiline: true, hasInput: true },
    { id: "operation", name: "Operation", dataType: "string", defaultValue: "format", options: [
      { label: "Format", value: "format" },
      { label: "Minify", value: "minify" },
      { label: "XML to JSON", value: "to-json" },
      { label: "JSON to XML", value: "from-json" },
      { label: "XPath", value: "xpath" },
      { label: "Validate", value: "validate" },
    ], hasInput: true },
    { id: "xpath", name: "XPath", dataType: "string", defaultValue: "//*", hasInput: true },
  ],
  outputs: [{ id: "output", name: "Output", dataType: "string" }],
  async execute(inputs, config) {
    // 重依赖按需加载:适配器随 registerAllAdapters() 全量打进画布与旅程页,静态引入会把整个库拖进首屏
    const { processXml } = await import("../xml-tools")
    return {
      output: processXml(
        String(inputs.input ?? config.input ?? ""),
        String(inputs.operation ?? config.operation ?? "format") as XmlOperation,
        String(inputs.xpath ?? config.xpath ?? "//*")
      ),
    }
  },
}

export function registerXmlAdapter(): void {
  registerNode(xmlAdapter)
}

