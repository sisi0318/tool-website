import { Minimize2 } from "lucide-react"
import type { ToolAdapter } from "./types"
import { registerNode } from "../canvas/registry"

export const imageCompressAdapter: ToolAdapter = {
  type: "image-compress",
  category: "image",
  label: "Image Compress",
  icon: Minimize2,
  inputs: [
    { id: "file", name: "File", dataType: "bytes", required: true },
  ],
  outputs: [
    { id: "file", name: "File", dataType: "bytes" },
    { id: "info", name: "Info", dataType: "json" },
  ],
  config: [
    {
      id: "quality",
      name: "Quality",
      dataType: "number",
      defaultValue: 80,
    },
  ],
  async execute(inputs, config) {
    const file = inputs.file as File | null
    if (!file) {
      throw new Error("No file provided")
    }

    const quality = Number(config.quality ?? 80)
    const originalSize = file.size

    return {
      file,
      info: {
        originalSize,
        quality,
        note: "Client-side compression requires canvas API. File passed through unchanged.",
      },
    }
  },
}

export function registerImageCompressAdapter(): void {
  registerNode(imageCompressAdapter)
}
