import { ArrowLeftRight } from "lucide-react"
import type { ToolAdapter } from "./types"
import { registerNode } from "../canvas/registry"

const ENCODING_TYPES = [
  { label: "Base64", value: "base64" },
  { label: "URL", value: "url" },
  { label: "HEX", value: "hex" },
  { label: "HTML", value: "html" },
]

function encode(input: string, encoding: string): string {
  switch (encoding) {
    case "base64":
      return Buffer.from(input, "utf-8").toString("base64")
    case "url":
      return encodeURIComponent(input)
    case "hex":
      return Buffer.from(input, "utf-8").toString("hex")
    case "html":
      return input
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;")
    default:
      return input
  }
}

function decode(input: string, encoding: string): string {
  switch (encoding) {
    case "base64":
      return Buffer.from(input, "base64").toString("utf-8")
    case "url":
      return decodeURIComponent(input)
    case "hex":
      return Buffer.from(input, "hex").toString("utf-8")
    case "html":
      return input
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#039;/g, "'")
    default:
      return input
  }
}

export const encodingAdapter: ToolAdapter = {
  type: "encoding",
  category: "crypto",
  label: "Encoding",
  icon: ArrowLeftRight,
  inputs: [
    { id: "input", name: "Input", dataType: "string", required: true },
    { id: "mode", name: "Mode", dataType: "string" },
  ],
  outputs: [{ id: "output", name: "Output", dataType: "string" }],
  config: [
    {
      id: "encoding",
      name: "Encoding",
      dataType: "string",
      defaultValue: "base64",
      options: ENCODING_TYPES,
    },
  ],
  async execute(inputs, config) {
    const input = String(inputs.input ?? "")
    const encoding = String(config.encoding ?? "base64")
    const mode = String(inputs.mode ?? "encode")

    try {
      if (mode === "decode") {
        return { output: decode(input, encoding) }
      }
      return { output: encode(input, encoding) }
    } catch (error) {
      throw new Error(`Encoding error: ${error}`)
    }
  },
}

export function registerEncodingAdapter(): void {
  registerNode(encodingAdapter)
}
