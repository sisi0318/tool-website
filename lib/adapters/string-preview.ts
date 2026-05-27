import { Eye } from "lucide-react"
import type { ToolAdapter } from "./types"
import { registerNode } from "../canvas/registry"

export const stringPreviewAdapter: ToolAdapter = {
  type: "string-preview",
  category: "viewer",
  label: "String Preview",
  icon: Eye,
  config: [
    {
      id: "content",
      name: "Content",
      dataType: "string",
      defaultValue: "",
      multiline: true,
      hasInput: true,
      hasOutput: false,
    },
  ],
  outputs: [],
  async execute(inputs, config) {
    return { content: String(inputs.content ?? config.content ?? "") }
  },
}

export function registerStringPreviewAdapter(): void {
  registerNode(stringPreviewAdapter)
}
