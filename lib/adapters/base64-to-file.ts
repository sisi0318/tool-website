import { FileUp } from "lucide-react"
import type { ToolAdapter } from "./types"
import { registerNode } from "../canvas/registry"

export const base64ToFileAdapter: ToolAdapter = {
  type: "base64-to-file",
  category: "data",
  label: "Base64 To File",
  icon: FileUp,
  config: [
    {
      id: "base64",
      name: "Base64",
      dataType: "string",
      defaultValue: "",
      hasInput: true,
      hasOutput: false,
    },
    {
      id: "filename",
      name: "Filename",
      dataType: "string",
      defaultValue: "file",
      hasInput: true,
      hasOutput: false,
    },
    {
      id: "mimeType",
      name: "MIME Type",
      dataType: "string",
      defaultValue: "application/octet-stream",
      hasInput: true,
      hasOutput: false,
    },
  ],
  outputs: [
    { id: "file", name: "File", dataType: "bytes" },
  ],
  async execute(inputs, config) {
    const base64 = String(inputs.base64 ?? config.base64 ?? "")
    const filename = String(inputs.filename ?? config.filename ?? "file")
    const mimeType = String(inputs.mimeType ?? config.mimeType ?? "application/octet-stream")

    try {
      const binaryStr = atob(base64)
      const bytes = new Uint8Array(binaryStr.length)
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i)
      }
      const file = new File([bytes], filename, { type: mimeType })
      return { file }
    } catch {
      throw new Error("Invalid Base64 string")
    }
  },
}

export function registerBase64ToFileAdapter(): void {
  registerNode(base64ToFileAdapter)
}
