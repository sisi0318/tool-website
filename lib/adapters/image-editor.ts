import { Crop } from "lucide-react"
import type { ToolAdapter } from "./types"
import { registerNode } from "../canvas/registry"
import { asFile } from "../canvas/persist"
import { MISSING_FILE_ERROR } from "../canvas/node-errors"

export const imageEditorAdapter: ToolAdapter = {
  type: "image-editor",
  category: "image",
  label: "Image Editor",
  description: "Adjust brightness, contrast, saturation and grayscale; export PNG (20 MB / 20 MP input, first frame)",
  icon: Crop,
  config: [
    {
      id: "file",
      name: "File",
      dataType: "bytes",
      hasInput: true,
      hasOutput: false,
    },
    {
      id: "brightness",
      name: "Brightness",
      dataType: "number",
      defaultValue: 100,
      slider: { min: 0, max: 200, step: 1 },
      hasInput: true,
      hasOutput: true,
    },
    {
      id: "contrast",
      name: "Contrast",
      dataType: "number",
      defaultValue: 100,
      slider: { min: 0, max: 200, step: 1 },
      hasInput: true,
      hasOutput: true,
    },
    {
      id: "saturation",
      name: "Saturation",
      dataType: "number",
      defaultValue: 100,
      slider: { min: 0, max: 200, step: 1 },
      hasInput: true,
      hasOutput: true,
    },
    {
      id: "grayscale",
      name: "Grayscale",
      dataType: "boolean",
      defaultValue: false,
      hasInput: true,
      hasOutput: true,
    },
  ],
  outputs: [
    { id: "file", name: "File", dataType: "bytes" },
  ],
  async execute(inputs, config, context) {
    const file = asFile(inputs.file ?? config.file)
    if (!file) {
      throw new Error(MISSING_FILE_ERROR)
    }

    const { adjustImageFile } = await import("../image-adjust")
    return { file: await adjustImageFile(file, {
      brightness: Number(inputs.brightness ?? config.brightness ?? 100),
      contrast: Number(inputs.contrast ?? config.contrast ?? 100),
      saturation: Number(inputs.saturation ?? config.saturation ?? 100),
      grayscale: (inputs.grayscale ?? config.grayscale ?? false) as boolean,
    }, context?.signal) }
  },
}

export function registerImageEditorAdapter(): void {
  registerNode(imageEditorAdapter)
}
