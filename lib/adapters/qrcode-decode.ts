import { ScanLine } from "lucide-react"
import type { ToolAdapter } from "./types"
import { registerNode } from "../canvas/registry"

export const qrcodeDecodeAdapter: ToolAdapter = {
  type: "qrcode-decode",
  category: "image",
  label: "QRCode Decode",
  icon: ScanLine,
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
    { id: "data", name: "Data", dataType: "string" },
  ],
  async execute(inputs, config) {
    const file = inputs.file as File | null
    if (!file) {
      throw new Error("No file provided")
    }

    return {
      data: "",
      note: "QR code decoding requires a QR library. Placeholder returned.",
    }
  },
}

export function registerQrcodeDecodeAdapter(): void {
  registerNode(qrcodeDecodeAdapter)
}
