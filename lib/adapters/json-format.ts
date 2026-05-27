import { FileJson } from "lucide-react"
import type { ToolAdapter } from "./types"
import { registerNode } from "../canvas/registry"

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
    const data = String(inputs.data ?? config.data ?? "")
    const indent = Number(inputs.indent ?? config.indent ?? 2)
    const sortKeys = inputs.sortKeys ?? config.sortKeys ?? false

    try {
      const parsed = JSON.parse(data)
      const replacer = sortKeys ? Object.keys(parsed).sort() : undefined
      return {
        formatted: JSON.stringify(parsed, replacer, indent),
        minified: JSON.stringify(parsed, replacer),
      }
    } catch (error) {
      throw new Error(`JSON format error: ${error}`)
    }
  },
}

export function registerJsonFormatAdapter(): void {
  registerNode(jsonFormatAdapter)
}
