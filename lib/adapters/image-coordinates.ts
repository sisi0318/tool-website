import { MousePointer } from "lucide-react"
import type { ToolAdapter } from "./types"
import { registerNode } from "../canvas/registry"

export const imageCoordinatesAdapter: ToolAdapter = {
  type: "image-coordinates",
  category: "image",
  label: "Image Coordinates",
  icon: MousePointer,
  description: "Reads image dimensions and maps percent positions to pixels",
  config: [
    {
      id: "file",
      name: "File",
      dataType: "bytes",
      hasInput: true,
      hasOutput: false,
    },
    {
      id: "xPercent",
      name: "X %",
      dataType: "number",
      defaultValue: 50,
      slider: { min: 0, max: 100, step: 1 },
      hasInput: true,
      hasOutput: false,
    },
    {
      id: "yPercent",
      name: "Y %",
      dataType: "number",
      defaultValue: 50,
      slider: { min: 0, max: 100, step: 1 },
      hasInput: true,
      hasOutput: false,
    },
  ],
  outputs: [
    { id: "coordinates", name: "Coordinates", dataType: "json" },
  ],
  async execute(inputs, config) {
    const file = (inputs.file ?? config.file) as File | null
    if (!file || !(file instanceof Blob)) {
      throw new Error("No file provided")
    }

    const clampPercent = (value: unknown, fallback: number) => {
      const num = Number(value ?? fallback)
      return Number.isFinite(num) ? Math.min(100, Math.max(0, num)) : fallback
    }
    const xPercent = clampPercent(inputs.xPercent ?? config.xPercent, 50)
    const yPercent = clampPercent(inputs.yPercent ?? config.yPercent, 50)

    const bitmap = await createImageBitmap(file)
    try {
      const maxX = Math.max(0, bitmap.width - 1)
      const maxY = Math.max(0, bitmap.height - 1)
      return {
        coordinates: {
          fileName: file.name,
          width: bitmap.width,
          height: bitmap.height,
          xPercent,
          yPercent,
          x: Math.min(maxX, Math.round((bitmap.width * xPercent) / 100)),
          y: Math.min(maxY, Math.round((bitmap.height * yPercent) / 100)),
        },
      }
    } finally {
      bitmap.close()
    }
  },
}

export function registerImageCoordinatesAdapter(): void {
  registerNode(imageCoordinatesAdapter)
}
