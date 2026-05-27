import { Braces } from "lucide-react"
import type { ToolAdapter } from "./types"
import { registerNode } from "../canvas/registry"

export const jsonPreviewAdapter: ToolAdapter = {
  type: "json-preview",
  category: "viewer",
  label: "JSON Preview",
  icon: Braces,
  config: [
    {
      id: "json",
      name: "JSON",
      dataType: "string",
      defaultValue: "{}",
      multiline: true,
      hasInput: true,
      hasOutput: false,
    },
  ],
  outputs: [],
  async execute(inputs, config) {
    const jsonStr = String(inputs.json ?? config.json ?? "{}")
    try {
      const parsed = JSON.parse(jsonStr)
      return { parsed }
    } catch {
      throw new Error("Invalid JSON")
    }
  },
}

export function registerJsonPreviewAdapter(): void {
  registerNode(jsonPreviewAdapter)
}
