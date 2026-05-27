import { FileJson } from "lucide-react"
import type { ToolAdapter } from "./types"
import { registerNode } from "../canvas/registry"

export const jsonParseAdapter: ToolAdapter = {
  type: "json-parse",
  category: "data",
  label: "JSON Parse",
  icon: FileJson,
  config: [
    {
      id: "string",
      name: "String",
      dataType: "string",
      defaultValue: "",
      multiline: true,
      hasInput: true,
      hasOutput: false,
    },
  ],
  outputs: [
    { id: "json", name: "JSON", dataType: "json" },
  ],
  async execute(inputs, config) {
    const str = String(inputs.string ?? config.string ?? "")
    try {
      return { json: JSON.parse(str) }
    } catch {
      throw new Error("Invalid JSON string")
    }
  },
}

export function registerJsonParseAdapter(): void {
  registerNode(jsonParseAdapter)
}
