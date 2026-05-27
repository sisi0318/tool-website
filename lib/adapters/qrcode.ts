import { QrCode } from "lucide-react"
import type { ToolAdapter } from "./types"
import { registerNode } from "../canvas/registry"

function generateQRPattern(data: string, size: number): string {
  const canvas = document.createElement("canvas")
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext("2d")!
  
  ctx.fillStyle = "#FFFFFF"
  ctx.fillRect(0, 0, size, size)
  
  const moduleSize = Math.floor(size / 25)
  const modules: boolean[][] = []
  
  for (let i = 0; i < 25; i++) {
    modules[i] = []
    for (let j = 0; j < 25; j++) {
      modules[i][j] = false
    }
  }
  
  for (let i = 0; i < 7; i++) {
    modules[0][i] = true
    modules[6][i] = true
    modules[i][0] = true
    modules[i][6] = true
    modules[18][i] = true
    modules[24][i] = true
    modules[i][18] = true
    modules[i][24] = true
    modules[18 + i][0] = true
    modules[18 + i][6] = true
    modules[0][18 + i] = true
    modules[6][18 + i] = true
  }
  
  for (let i = 2; i < 5; i++) {
    for (let j = 2; j < 5; j++) {
      modules[i][j] = true
      modules[i][j + 16] = true
      modules[i + 16][j] = true
    }
  }
  
  let hash = 0
  for (let i = 0; i < data.length; i++) {
    hash = ((hash << 5) - hash + data.charCodeAt(i)) | 0
  }
  
  for (let i = 8; i < 17; i++) {
    for (let j = 8; j < 17; j++) {
      modules[i][j] = ((hash >> ((i * 17 + j) % 30)) & 1) === 1
    }
  }
  
  ctx.fillStyle = "#000000"
  for (let i = 0; i < 25; i++) {
    for (let j = 0; j < 25; j++) {
      if (modules[i][j]) {
        ctx.fillRect(j * moduleSize, i * moduleSize, moduleSize, moduleSize)
      }
    }
  }
  
  return canvas.toDataURL("image/png")
}

export const qrcodeAdapter: ToolAdapter = {
  type: "qrcode",
  category: "image",
  label: "QRCode",
  icon: QrCode,
  config: [
    {
      id: "data",
      name: "Data",
      dataType: "string",
      defaultValue: "",
      hasInput: true,
      hasOutput: false,
    },
    {
      id: "size",
      name: "Size",
      dataType: "number",
      defaultValue: 200,
      slider: { min: 100, max: 500, step: 10 },
      hasInput: true,
      hasOutput: true,
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
      hasInput: true,
      hasOutput: true,
    },
    {
      id: "fgColor",
      name: "Foreground",
      dataType: "string",
      defaultValue: "#000000",
      color: true,
      hasInput: true,
      hasOutput: true,
    },
    {
      id: "bgColor",
      name: "Background",
      dataType: "string",
      defaultValue: "#FFFFFF",
      color: true,
      hasInput: true,
      hasOutput: true,
    },
  ],
  outputs: [
    { id: "image", name: "Image", dataType: "bytes" },
    { id: "dataUri", name: "Data URI", dataType: "string" },
  ],
  async execute(inputs, config) {
    const data = String(inputs.data ?? config.data ?? "")
    if (!data) {
      throw new Error("No data provided")
    }

    const size = Number(inputs.size ?? config.size ?? 200)
    const dataUri = generateQRPattern(data, size)
    
    const base64 = dataUri.split(",")[1]
    const binaryStr = atob(base64)
    const bytes = new Uint8Array(binaryStr.length)
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i)
    }
    const blob = new Blob([bytes], { type: "image/png" })
    const file = new File([blob], `qrcode-${Date.now()}.png`, { type: "image/png" })

    return {
      image: file,
      dataUri,
    }
  },
}

export function registerQrcodeAdapter(): void {
  registerNode(qrcodeAdapter)
}
