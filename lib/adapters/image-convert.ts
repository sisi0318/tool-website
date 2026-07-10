import { ImageDown } from "lucide-react"

import { registerNode } from "../canvas/registry"
import { convertImageFile, type ImageOutputFormat } from "../image-convert"
import type { ToolAdapter } from "./types"

export const imageConvertAdapter: ToolAdapter = {
  type: "image-convert",
  category: "image",
  label: "Image Convert",
  icon: ImageDown,
  config: [
    { id: "file", name: "File", dataType: "bytes", hasInput: true, hasOutput: false },
    {
      id: "format",
      name: "Format",
      dataType: "string",
      defaultValue: "webp",
      options: [
        { label: "WebP", value: "webp" },
        { label: "JPEG", value: "jpeg" },
        { label: "PNG", value: "png" },
        { label: "AVIF", value: "avif" },
      ],
      hasInput: true,
      hasOutput: true,
    },
    { id: "quality", name: "Quality", dataType: "number", defaultValue: 82, slider: { min: 10, max: 100, step: 1 }, hasInput: true, hasOutput: true },
    { id: "maxWidth", name: "Max width", dataType: "number", defaultValue: 0, hasInput: true, hasOutput: false },
    { id: "maxHeight", name: "Max height", dataType: "number", defaultValue: 0, hasInput: true, hasOutput: false },
  ],
  outputs: [
    { id: "file", name: "File", dataType: "bytes" },
    { id: "info", name: "Info", dataType: "json" },
  ],
  async execute(inputs, config) {
    const file = (inputs.file ?? config.file) as File | null
    if (!file) throw new Error("No file provided")

    const result = await convertImageFile(file, {
      format: String(inputs.format ?? config.format ?? "webp") as ImageOutputFormat,
      quality: Number(inputs.quality ?? config.quality ?? 82) / 100,
      maxWidth: Number(inputs.maxWidth ?? config.maxWidth) || undefined,
      maxHeight: Number(inputs.maxHeight ?? config.maxHeight) || undefined,
    })
    return {
      file: result.file,
      info: {
        originalSize: file.size,
        convertedSize: result.file.size,
        originalDimensions: `${result.originalWidth}x${result.originalHeight}`,
        dimensions: `${result.width}x${result.height}`,
        format: result.mimeType,
      },
    }
  },
}

export function registerImageConvertAdapter(): void {
  registerNode(imageConvertAdapter)
}
