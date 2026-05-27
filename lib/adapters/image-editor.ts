import { Crop } from "lucide-react"
import type { ToolAdapter } from "./types"
import { registerNode } from "../canvas/registry"

export const imageEditorAdapter: ToolAdapter = {
  type: "image-editor",
  category: "image",
  label: "Image Editor",
  icon: Crop,
  inputs: [
    { id: "file", name: "File", dataType: "bytes", required: true },
  ],
  outputs: [
    { id: "file", name: "File", dataType: "bytes" },
  ],
  config: [
    {
      id: "brightness",
      name: "Brightness",
      dataType: "number",
      defaultValue: 100,
      slider: { min: 0, max: 200, step: 1 },
    },
    {
      id: "contrast",
      name: "Contrast",
      dataType: "number",
      defaultValue: 100,
      slider: { min: 0, max: 200, step: 1 },
    },
    {
      id: "saturation",
      name: "Saturation",
      dataType: "number",
      defaultValue: 100,
      slider: { min: 0, max: 200, step: 1 },
    },
    {
      id: "grayscale",
      name: "Grayscale",
      dataType: "boolean",
      defaultValue: false,
    },
  ],
  async execute(inputs, config) {
    const file = inputs.file as File | null
    if (!file) {
      throw new Error("No file provided")
    }

    return { file }
  },
}

export function registerImageEditorAdapter(): void {
  registerNode(imageEditorAdapter)
}
