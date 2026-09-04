import { FileDown } from "lucide-react"
import type { ToolAdapter } from "./types"
import { registerNode } from "../canvas/registry"
import { asFile } from "../canvas/persist"

export const fileToBase64Adapter: ToolAdapter = {
  type: "file-to-base64",
  category: "data",
  label: "File To Base64",
  icon: FileDown,
  config: [
    {
      id: "file",
      name: "File",
      dataType: "bytes",
      hasInput: true,
      hasOutput: false,
    },
  ],
  outputs: [
    { id: "base64", name: "Base64", dataType: "string" },
  ],
  async execute(inputs, config) {
    const file = asFile(inputs.file ?? config.file)
    if (!file) throw new Error("No file provided")

    const arrayBuffer = await file.arrayBuffer()
    const bytes = new Uint8Array(arrayBuffer)
    let binary = ""
    for (const byte of bytes) {
      binary += String.fromCharCode(byte)
    }
    const base64 = btoa(binary)
    return { base64 }
  },
}

export function registerFileToBase64Adapter(): void {
  registerNode(fileToBase64Adapter)
}
