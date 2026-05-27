import { MousePointer } from "lucide-react"
import type { ToolAdapter } from "./types"
import { registerNode } from "../canvas/registry"

export const imageCoordinatesAdapter: ToolAdapter = {
  type: "image-coordinates",
  category: "image",
  label: "Image Coordinates",
  icon: MousePointer,
  inputs: [
    { id: "file", name: "File", dataType: "bytes", required: true },
  ],
  outputs: [
    { id: "coordinates", name: "Coordinates", dataType: "json" },
  ],
  config: [],
  async execute(inputs, config) {
    const file = inputs.file as File | null
    if (!file) {
      throw new Error("No file provided")
    }

    return {
      coordinates: {
        fileName: file.name,
        note: "Coordinate picking requires interactive canvas. File info returned.",
      },
    }
  },
}

export function registerImageCoordinatesAdapter(): void {
  registerNode(imageCoordinatesAdapter)
}
