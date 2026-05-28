import { Image } from "lucide-react"
import type { ToolAdapter } from "./types"
import { registerNode } from "../canvas/registry"

export const imagePreviewAdapter: ToolAdapter = {
  type: "image-preview",
  category: "viewer",
  label: "Image Preview",
  icon: Image,
  config: [
    {
      id: "file",
      name: "File",
      dataType: "bytes",
      hasInput: true,
      hasOutput: false,
    },
  ],
  outputs: [],
  async execute(inputs, config) {
    const file = (inputs.file ?? config.file) as File | null
    if (!file) throw new Error("No file provided")

    if (!file.type.startsWith("image/")) {
      throw new Error("File is not an image")
    }

    return { file, size: file.size, type: file.type }
  },
}

export function registerImagePreviewAdapter(): void {
  registerNode(imagePreviewAdapter)
}
