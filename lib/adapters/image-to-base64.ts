import { Image } from "lucide-react"
import type { ToolAdapter } from "./types"
import { registerNode } from "../canvas/registry"

export const imageToBase64Adapter: ToolAdapter = {
  type: "image-to-base64",
  category: "image",
  label: "Image to Base64",
  icon: Image,
  config: [
    {
      id: "file",
      name: "File",
      dataType: "bytes",
      hasInput: true,
      hasOutput: false,
    },
    {
      id: "outputFormat",
      name: "Output",
      dataType: "string",
      defaultValue: "base64",
      options: [
        { label: "Base64", value: "base64" },
        { label: "Data URL", value: "dataUrl" },
        { label: "CSS", value: "css" },
        { label: "HTML", value: "html" },
      ],
      hasInput: true,
      hasOutput: true,
    },
  ],
  outputs: [
    { id: "base64", name: "Base64", dataType: "string" },
    { id: "dataUri", name: "Data URI", dataType: "string" },
  ],
  async execute(inputs, config) {
    const file = inputs.file as File | null
    if (!file) {
      throw new Error("No file provided")
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const base64 = buffer.toString("base64")
    const mimeType = file.type || "application/octet-stream"

    return {
      base64,
      dataUri: `data:${mimeType};base64,${base64}`,
    }
  },
}

export function registerImageToBase64Adapter(): void {
  registerNode(imageToBase64Adapter)
}
