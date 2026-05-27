import { FileJson } from "lucide-react"
import type { ToolAdapter } from "./types"
import { registerNode } from "../canvas/registry"

export const jsonFormatAdapter: ToolAdapter = {
  type: "json-format",
  category: "data",
  label: "JSON Format",
  icon: FileJson,
  inputs: [
    { id: "data", name: "Data", dataType: "string", required: true },
  ],
  outputs: [
    { id: "formatted", name: "Formatted", dataType: "string" },
    { id: "minified", name: "Minified", dataType: "string" },
  ],
  config: [
    {
      id: "indent",
      name: "Indent",
      dataType: "number",
      defaultValue: 2,
    },
  ],
  async execute(inputs, config) {
    const data = String(inputs.data ?? "")
    const indent = Number(config.indent ?? 2)

    try {
      const parsed = JSON.parse(data)
      return {
        formatted: JSON.stringify(parsed, null, indent),
        minified: JSON.stringify(parsed),
      }
    } catch (error) {
      throw new Error(`JSON format error: ${error}`)
    }
  },
}

export function registerJsonFormatAdapter(): void {
  registerNode(jsonFormatAdapter)
}
