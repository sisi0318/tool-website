import { Eye } from "lucide-react"
import type { ToolAdapter } from "./types"
import { registerNode } from "../canvas/registry"

export const exifViewerAdapter: ToolAdapter = {
  type: "exif-viewer",
  category: "image",
  label: "EXIF Viewer",
  icon: Eye,
  inputs: [
    { id: "file", name: "File", dataType: "bytes", required: true },
  ],
  outputs: [
    { id: "exif", name: "EXIF Data", dataType: "json" },
  ],
  config: [],
  async execute(inputs, config) {
    const file = inputs.file as File | null
    if (!file) {
      throw new Error("No file provided")
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const exif: Record<string, unknown> = {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
    }

    if (buffer[0] === 0xff && buffer[1] === 0xd8) {
      exif.format = "JPEG"
      for (let i = 2; i < buffer.length - 1; i++) {
        if (buffer[i] === 0xff && buffer[i + 1] === 0xe1) {
          exif.hasEXIF = true
          break
        }
      }
    } else if (buffer[0] === 0x89 && buffer[1] === 0x50) {
      exif.format = "PNG"
    } else if (buffer[0] === 0x47 && buffer[1] === 0x49) {
      exif.format = "GIF"
    } else if (buffer[0] === 0x42 && buffer[1] === 0x4d) {
      exif.format = "BMP"
    } else if (buffer[0] === 0x52 && buffer[1] === 0x49) {
      exif.format = "WEBP"
    }

    return { exif }
  },
}

export function registerExifViewerAdapter(): void {
  registerNode(exifViewerAdapter)
}
