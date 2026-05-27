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
    { id: "characters", name: "Characters", dataType: "number" },
    { id: "words", name: "Words", dataType: "number" },
    { id: "lines", name: "Lines", dataType: "number" },
    { id: "sentences", name: "Sentences", dataType: "number" },
    { id: "paragraphs", name: "Paragraphs", dataType: "number" },
    { id: "bytes", name: "Bytes", dataType: "number" },
  ],
  async execute(inputs, config) {
    const text = String(inputs.text ?? config.text ?? "")

    const characters = text.length
    const words = text.trim() ? text.trim().split(/\s+/).length : 0
    const lines = text.split("\n").length
    const sentences = text.trim() ? text.split(/[.!?]+/).filter((s) => s.trim()).length : 0
    const paragraphs = text.trim() ? text.split(/\n\s*\n/).filter((p) => p.trim()).length : 0
    const bytes = new TextEncoder().encode(text).length

    return { characters, words, lines, sentences, paragraphs, bytes }
  },
}

export function registerTextStatsAdapter(): void {
  registerNode(textStatsAdapter)
}
