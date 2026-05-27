import { QrCode } from "lucide-react"
import type { ToolAdapter } from "./types"
import { registerNode } from "../canvas/registry"

export const qrcodeAdapter: ToolAdapter = {
  type: "qrcode",
  category: "image",
  label: "QRCode",
  icon: QrCode,
  inputs: [
    { id: "data", name: "Data", dataType: "string", required: true },
  ],
  outputs: [
    { id: "image", name: "Image", dataType: "bytes" },
    { id: "dataUri", name: "Data URI", dataType: "string" },
  ],
  config: [
    {
      id: "size",
      name: "Size",
      dataType: "number",
      defaultValue: 200,
      slider: { min: 100, max: 500, step: 10 },
    },
    {
      id: "errorCorrection",
      name: "Error Correction",
      dataType: "string",
      defaultValue: "M",
      options: [
        { label: "Low (7%)", value: "L" },
        { label: "Medium (15%)", value: "M" },
        { label: "Quartile (25%)", value: "Q" },
        { label: "High (30%)", value: "H" },
      ],
    },
    {
      id: "fgColor",
      name: "Foreground",
      dataType: "string",
      defaultValue: "#000000",
      color: true,
    },
    {
      id: "bgColor",
      name: "Background",
      dataType: "string",
      defaultValue: "#FFFFFF",
      color: true,
    },
  ],
  async execute(inputs, config) {
    const data = String(inputs.data ?? "")
    if (!data) {
      throw new Error("No data provided")
    }

    return {
      image: null,
      dataUri: `qr:${data}`,
      note: "QR code generation requires a QR library. Placeholder returned.",
    }
  },
}

export function registerQrcodeAdapter(): void {
  registerNode(qrcodeAdapter)
}
