import { Minimize2 } from "lucide-react"
import type { ToolAdapter } from "./types"
import { registerNode } from "../canvas/registry"
import { asFile } from "../canvas/persist"

/**
 * "保持原格式"应当真的保持原格式。旧实现只认 png/webp,
 * gif / bmp / avif / tiff 会被一律转成 JPEG,带透明通道的图因此变黑底。
 */
const RECOMPRESSABLE_MIME_TYPES = new Set([
  "image/png",
  "image/webp",
  "image/jpeg",
  "image/gif",
  "image/bmp",
  "image/avif",
])

function preservedMimeType(sourceType: string): string {
  // canvas 无法输出 gif 动画等格式时,浏览器会回退到 PNG(无损、保留 alpha),
  // 这比静默压成 JPEG 更安全。
  if (RECOMPRESSABLE_MIME_TYPES.has(sourceType)) return sourceType
  return "image/png"
}

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
    const file = asFile(inputs.file ?? config.file)
    if (!file) {
      throw new Error("No file provided")
    }

    const quality = Number(inputs.quality ?? config.quality ?? 80) / 100
    const format = String(inputs.outputFormat ?? config.outputFormat ?? "original")
    const originalSize = file.size
    let dimensions = ""

    const bitmap = await createImageBitmap(file)
    let blob: Blob
    let mimeType: string
    try {
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
      const ctx = canvas.getContext("2d")!
      // 有透明通道的源图必须保留 alpha,否则转 JPEG 后透明区域会变黑。
      ctx.drawImage(bitmap, 0, 0)

      mimeType = format === "original" ? preservedMimeType(file.type) : `image/${format}`
      blob = await canvas.convertToBlob({ type: mimeType, quality })
      dimensions = `${canvas.width}x${canvas.height}`
    } finally {
      // 出错路径下也要释放,否则大图会一直占着解码后的位图内存。
      bitmap.close()
    }
    const ext = mimeType.split("/")[1]
    const outFile = new File([blob], file.name.replace(/\.[^.]+$/, `.${ext}`), { type: mimeType })

    return {
      file: outFile,
      info: {
        originalSize,
        compressedSize: outFile.size,
        ratio: `${((1 - outFile.size / originalSize) * 100).toFixed(1)}%`,
        dimensions,
        format: mimeType,
      },
    }
  },
}

export function registerImageCompressAdapter(): void {
  registerNode(imageCompressAdapter)
}
