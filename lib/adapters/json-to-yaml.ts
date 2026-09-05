import { FileJson } from "lucide-react"
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
    // 重依赖按需加载:适配器随 registerAllAdapters() 全量打进画布与旅程页,静态引入会把整个库拖进首屏
    const yaml = (await import("js-yaml")).default
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
