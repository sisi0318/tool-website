import { FileJson } from "lucide-react"
import type { ToolAdapter } from "./types"
import { registerNode } from "../canvas/registry"

export const jsonStringifyAdapter: ToolAdapter = {
  type: "json-stringify",
  category: "data",
  label: "JSON Stringify",
  icon: FileJson,
  config: [
    {
      id: "json",
      name: "JSON",
      dataType: "json",
      defaultValue: {},
      multiline: true,
      hasInput: true,
      hasOutput: false,
    },
  ],
  outputs: [
    { id: "string", name: "String", dataType: "string" },
  ],
  async execute(inputs, config) {
    const json = inputs.json ?? config.json ?? {}
    try {
      return { string: JSON.stringify(json) }
    } catch {
      throw new Error("Failed to stringify JSON")
    }
  },
}

export function registerJsonStringifyAdapter(): void {
  registerNode(jsonStringifyAdapter)
}
