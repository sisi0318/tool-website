import { FileJson } from "lucide-react"
import yaml from "js-yaml"
import type { ToolAdapter } from "./types"
import { registerNode } from "../canvas/registry"

export const jsonToYamlAdapter: ToolAdapter = {
  type: "json-to-yaml",
  category: "data",
  label: "JSON to YAML",
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
    { id: "yaml", name: "YAML", dataType: "string" },
  ],
  async execute(inputs, config) {
    const json = inputs.json ?? config.json ?? {}
    try {
      return { yaml: yaml.dump(json) }
    } catch {
      throw new Error("Failed to convert JSON to YAML")
    }
  },
}

export function registerJsonToYamlAdapter(): void {
  registerNode(jsonToYamlAdapter)
}
