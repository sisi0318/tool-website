import { ImageDown } from "lucide-react"

import { registerNode } from "../canvas/registry"
import { asFile } from "../canvas/persist"
import type { ImageOutputFormat } from "../image-convert"
import { convertImageInWorker } from "../image-convert-client"
import type { ToolAdapter } from "./types"
import { MISSING_FILE_ERROR } from "../canvas/node-errors"

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
        { label: "GIF (single frame)", value: "gif" },
      ],
      hasInput: true,
      hasOutput: true,
    },
    { id: "quality", name: "Quality", dataType: "number", defaultValue: 82, slider: { min: 10, max: 100, step: 1 }, visible: (config) => config.format !== "png" && config.format !== "gif", hasInput: true, hasOutput: true },
    { id: "maxWidth", name: "Max width", dataType: "number", defaultValue: 0, hasInput: true, hasOutput: false },
    { id: "maxHeight", name: "Max height", dataType: "number", defaultValue: 0, hasInput: true, hasOutput: false },
  ],
  outputs: [
    { id: "file", name: "File", dataType: "bytes" },
    { id: "info", name: "Info", dataType: "json" },
  ],
  async execute(inputs, config, context) {
    const file = asFile(inputs.file ?? config.file)
    if (!file) throw new Error(MISSING_FILE_ERROR)

    // 在 Worker 里转换，大图不再卡住画布
    const result = await convertImageInWorker(file, {
      format: String(inputs.format ?? config.format ?? "webp") as ImageOutputFormat,
      quality: Number(inputs.quality ?? config.quality ?? 82) / 100,
      maxWidth: Number(inputs.maxWidth ?? config.maxWidth) || undefined,
      maxHeight: Number(inputs.maxHeight ?? config.maxHeight) || undefined,
    }, { signal: context?.signal })
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
