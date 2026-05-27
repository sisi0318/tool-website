import { ScanLine } from "lucide-react"
import type { ToolAdapter } from "./types"
import { registerNode } from "../canvas/registry"

export const qrcodeDecodeAdapter: ToolAdapter = {
  type: "qrcode-decode",
  category: "image",
  label: "QRCode Decode",
  icon: ScanLine,
  inputs: [
    { id: "file", name: "File", dataType: "bytes", required: true },
  ],
  outputs: [
    { id: "data", name: "Data", dataType: "string" },
  ],
  config: [],
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
