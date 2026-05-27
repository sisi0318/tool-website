import { FileText } from "lucide-react"
import type { ToolAdapter } from "./types"
import { registerNode } from "../canvas/registry"

export const textStatsAdapter: ToolAdapter = {
  type: "text-stats",
  category: "text",
  label: "Text Stats",
  icon: FileText,
  config: [
    {
      id: "text",
      name: "Text",
      dataType: "string",
      defaultValue: "",
      multiline: true,
      hasInput: true,
      hasOutput: false,
    },
  ],
  outputs: [
    { id: "stats", name: "Stats", dataType: "json" },
  ],
  async execute(inputs, config) {
    const text = String(inputs.text ?? config.text ?? "")

    const chars = text.length
    const words = text.trim() ? text.trim().split(/\s+/).length : 0
    const lines = text.split("\n").length
    const sentences = text.trim() ? text.split(/[.!?]+/).filter((s) => s.trim()).length : 0
    const paragraphs = text.trim() ? text.split(/\n\s*\n/).filter((p) => p.trim()).length : 0
    const bytes = new TextEncoder().encode(text).length

    return {
      stats: {
        characters: chars,
        words,
        lines,
        sentences,
        paragraphs,
        bytes,
      },
    }
  },
}

export function registerTextStatsAdapter(): void {
  registerNode(textStatsAdapter)
}
