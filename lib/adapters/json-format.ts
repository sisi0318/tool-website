import { FileJson } from "lucide-react"
import type { ToolAdapter } from "./types"
import { registerNode } from "../canvas/registry"
import { sortJsonKeys } from "../json-text-tools"

export const jsonFormatAdapter: ToolAdapter = {
  type: "json-format",
  category: "data",
  label: "JSON Format",
  icon: FileJson,
  config: [
    {
      id: "data",
      name: "Data",
      dataType: "string",
      defaultValue: "",
      multiline: true,
      hasInput: true,
      hasOutput: false,
    },
    {
      id: "indent",
      name: "Indent",
      dataType: "number",
      defaultValue: 2,
      slider: { min: 0, max: 8, step: 1 },
      hasInput: true,
      hasOutput: true,
    },
    {
      id: "sortKeys",
      name: "Sort Keys",
      dataType: "boolean",
      defaultValue: false,
      hasInput: true,
      hasOutput: true,
    },
  ],
  outputs: [
    { id: "formatted", name: "Formatted", dataType: "string" },
    { id: "minified", name: "Minified", dataType: "string" },
  ],
  async execute(inputs, config) {
    const raw = inputs.data ?? config.data ?? ""
    const indent = Number(inputs.indent ?? config.indent ?? 2)
    const sortKeys = inputs.sortKeys ?? config.sortKeys ?? false

    try {
      // 上游端口可能直接送来已解析的对象(json→string 被视为兼容连接),
      // 这时 String(...) 会得到 "[object Object]" 并必然解析失败。
      const parsed = typeof raw === "string" ? JSON.parse(raw) : raw
      if (parsed === undefined) throw new Error("no input")
      const value = sortKeys ? sortJsonKeys(parsed) : parsed
      return {
        formatted: JSON.stringify(value, null, indent),
        minified: JSON.stringify(value),
      }
    } catch (error) {
      throw new Error(`JSON format error: ${error instanceof Error ? error.message : String(error)}`)
    }
  },
}

export function registerJsonFormatAdapter(): void {
  registerNode(jsonFormatAdapter)
}
