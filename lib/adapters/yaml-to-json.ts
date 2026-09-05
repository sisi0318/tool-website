import { FileJson } from "lucide-react"
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
    // 重依赖按需加载:适配器随 registerAllAdapters() 全量打进画布与旅程页,静态引入会把整个库拖进首屏
    const yaml = (await import("js-yaml")).default
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
