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
      dataType: "json",
      defaultValue: "{}",
      multiline: true,
      hasInput: true,
      hasOutput: false,
    },
  ],
  outputs: [],
  async execute(inputs, config) {
    const json = inputs.json ?? config.json ?? {}
    if (typeof json === "string") {
      try {
        return { parsed: JSON.parse(json) }
      } catch {
        throw new Error("Invalid JSON")
      }
    }
    return { parsed: json }
  },
}

export function registerJsonPreviewAdapter(): void {
  registerNode(jsonPreviewAdapter)
}
