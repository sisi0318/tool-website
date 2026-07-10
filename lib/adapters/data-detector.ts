import { ScanSearch } from "lucide-react"

import { detectData } from "../data-detector"
import { registerNode } from "../canvas/registry"
import type { ToolAdapter } from "./types"

export const dataDetectorAdapter: ToolAdapter = {
  type: "data-detector",
  category: "data",
  label: "Data Detector",
  description: "Identify common text and data formats",
  icon: ScanSearch,
  config: [
    { id: "input", name: "Input", dataType: "string", defaultValue: "", multiline: true, hasInput: true },
  ],
  outputs: [
    { id: "result", name: "Detection result", dataType: "json" },
    { id: "type", name: "Best type", dataType: "string" },
    { id: "suggestedTool", name: "Suggested tool", dataType: "string" },
    { id: "decoded", name: "Decoded preview", dataType: "string" },
  ],
  async execute(inputs, config) {
    const result = detectData(String(inputs.input ?? config.input ?? ""))
    return {
      result,
      type: result.best.type,
      suggestedTool: result.best.suggestedTool ?? "",
      decoded: result.best.decodedPreview ?? "",
    }
  },
}

export function registerDataDetectorAdapter(): void {
  registerNode(dataDetectorAdapter)
}

