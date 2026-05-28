import { Minimize2 } from "lucide-react"
import type { ToolAdapter } from "./types"
import { registerNode } from "../canvas/registry"

export const imageCompressAdapter: ToolAdapter = {
  type: "image-compress",
  category: "image",
  label: "Image Compress",
  icon: Minimize2,
  config: [
    {
      id: "file",
      name: "File",
      dataType: "bytes",
      hasInput: true,
      hasOutput: false,
    },
    {
      id: "quality",
      name: "Quality",
      dataType: "number",
      defaultValue: 80,
      slider: { min: 10, max: 100, step: 5 },
      hasInput: true,
      hasOutput: true,
    },
    {
      id: "outputFormat",
      name: "Format",
      dataType: "string",
      defaultValue: "original",
      options: [
        { label: "Original", value: "original" },
        { label: "JPEG", value: "jpeg" },
        { label: "WebP", value: "webp" },
        { label: "PNG", value: "png" },
      ],
      hasInput: true,
      hasOutput: true,
    },
  ],
  outputs: [
    { id: "file", name: "File", dataType: "bytes" },
    { id: "info", name: "Info", dataType: "json" },
  ],
  async execute(inputs, config) {
    const file = (inputs.file ?? config.file) as File | null
    if (!file) {
      throw new Error("No file provided")
    }

    const quality = Number(inputs.quality ?? config.quality ?? 80) / 100
    const format = String(inputs.outputFormat ?? config.outputFormat ?? "original")
    const originalSize = file.size

    const bitmap = await createImageBitmap(file)
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
    const ctx = canvas.getContext("2d")!
    ctx.drawImage(bitmap, 0, 0)
    bitmap.close()

    const mimeType = format === "original"
      ? (file.type === "image/png" ? "image/png" : file.type === "image/webp" ? "image/webp" : "image/jpeg")
      : `image/${format}`

    const blob = await canvas.convertToBlob({ type: mimeType, quality })
    const ext = mimeType.split("/")[1]
    const outFile = new File([blob], file.name.replace(/\.[^.]+$/, `.${ext}`), { type: mimeType })

    return {
      file: outFile,
      info: {
        originalSize,
        compressedSize: outFile.size,
        ratio: `${((1 - outFile.size / originalSize) * 100).toFixed(1)}%`,
        dimensions: `${canvas.width}x${canvas.height}`,
        format: mimeType,
      },
    }
  },
}

export function registerImageCompressAdapter(): void {
  registerNode(imageCompressAdapter)
}
