import { QrCode } from "lucide-react"
import type { ToolAdapter } from "./types"
import { registerNode } from "../canvas/registry"

async function generateQRCode(data: string, size: number, errorCorrection: string, fgColor: string, bgColor: string): Promise<{ dataUri: string; file: File }> {
  const { QRCodeSVG } = await import("qrcode.react")
  const ReactDOM = await import("react-dom/client")

  const container = document.createElement("div")
  container.style.position = "absolute"
  container.style.left = "-9999px"
  container.style.top = "-9999px"
  document.body.appendChild(container)

  const root = ReactDOM.createRoot(container)
  const qrElement = await import("react").then(React =>
    React.createElement(QRCodeSVG, {
      value: data,
      size,
      level: errorCorrection as "L" | "M" | "Q" | "H",
      fgColor,
      bgColor,
    })
  )

  root.render(qrElement)

  await new Promise(resolve => setTimeout(resolve, 100))

  const svg = container.querySelector("svg")
  if (!svg) {
    root.unmount()
    document.body.removeChild(container)
    throw new Error("Failed to generate QR code SVG")
  }

  const svgData = new XMLSerializer().serializeToString(svg)
  root.unmount()
  document.body.removeChild(container)

  const canvas = document.createElement("canvas")
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext("2d")!

  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      ctx.drawImage(img, 0, 0)
      const dataUri = canvas.toDataURL("image/png")

      const base64 = dataUri.split(",")[1]
      const binaryStr = atob(base64)
      const bytes = new Uint8Array(binaryStr.length)
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i)
      }
      const blob = new Blob([bytes], { type: "image/png" })
      const file = new File([blob], `qrcode-${Date.now()}.png`, { type: "image/png" })

      resolve({ dataUri, file })
    }
    img.onerror = () => reject(new Error("Failed to load QR code image"))
    img.src = `data:image/svg+xml;base64,${btoa(svgData)}`
  })
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
    const errorCorrection = String(inputs.errorCorrection ?? config.errorCorrection ?? "M")
    const fgColor = String(inputs.fgColor ?? config.fgColor ?? "#000000")
    const bgColor = String(inputs.bgColor ?? config.bgColor ?? "#FFFFFF")

    const { dataUri, file } = await generateQRCode(data, size, errorCorrection, fgColor, bgColor)

    return { image: file, dataUri }
  },
}

export function registerQrcodeAdapter(): void {
  registerNode(qrcodeAdapter)
}
