import { FileJson } from "lucide-react"
import yaml from "js-yaml"
import type { ToolAdapter } from "./types"
import { registerNode } from "../canvas/registry"

export const yamlToJsonAdapter: ToolAdapter = {
  type: "yaml-to-json",
  category: "data",
  label: "YAML to JSON",
  icon: FileJson,
  config: [
    {
      id: "yaml",
      name: "YAML",
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
    const yamlStr = String(inputs.yaml ?? config.yaml ?? "")
    try {
      const parsed = yaml.load(yamlStr)
      return { json: parsed }
    } catch {
      throw new Error("Invalid YAML string")
    }
  },
}

export function registerYamlToJsonAdapter(): void {
  registerNode(yamlToJsonAdapter)
}
