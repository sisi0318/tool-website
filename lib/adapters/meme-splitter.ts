import { Scissors } from "lucide-react"
import type { ToolAdapter } from "./types"
import { registerNode } from "../canvas/registry"

export const memeSplitterAdapter: ToolAdapter = {
  type: "meme-splitter",
  category: "image",
  label: "Meme Splitter",
  icon: Scissors,
  config: [
    {
      id: "file",
      name: "File",
      dataType: "bytes",
      hasInput: true,
      hasOutput: false,
    },
    {
      id: "rows",
      name: "Rows",
      dataType: "number",
      defaultValue: 4,
      slider: { min: 1, max: 10, step: 1 },
      hasInput: true,
      hasOutput: true,
    },
    {
      id: "cols",
      name: "Cols",
      dataType: "number",
      defaultValue: 6,
      slider: { min: 1, max: 10, step: 1 },
      hasInput: true,
      hasOutput: true,
    },
  ],
  outputs: [
    { id: "parts", name: "Parts", dataType: "json" },
  ],
  async execute(inputs, config) {
    const file = inputs.file as File | null
    if (!file) {
      throw new Error("No file provided")
    }

    const rows = Number(inputs.rows ?? config.rows ?? 4)
    const cols = Number(inputs.cols ?? config.cols ?? 6)

    return {
      parts: {
        fileName: file.name,
        rows,
        cols,
        note: "Image splitting requires canvas API. Configuration returned.",
      },
    }
  },
}

export function registerMemeSplitterAdapter(): void {
  registerNode(memeSplitterAdapter)
}
