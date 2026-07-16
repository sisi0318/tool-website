import { FileText } from "lucide-react"
import type { ToolAdapter } from "./types"
import { registerNode } from "../canvas/registry"
import { calculateTextStatistics } from "../text-statistics"

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
    const stats = calculateTextStatistics(text)
    const bytes = new TextEncoder().encode(text).length

    return {
      characters: stats.characters,
      words: stats.words,
      lines: text.split("\n").length,
      sentences: stats.sentences,
      paragraphs: stats.paragraphs,
      bytes,
    }
  },
}

export function registerTextStatsAdapter(): void {
  registerNode(textStatsAdapter)
}
