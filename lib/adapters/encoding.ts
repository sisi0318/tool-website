import { ArrowLeftRight } from "lucide-react"
import type { ToolAdapter } from "./types"
import { registerNode } from "../canvas/registry"

const ENCODING_TYPES = [
  { label: "Base64", value: "base64" },
  { label: "URL", value: "url" },
  { label: "HEX", value: "hex" },
  { label: "HTML", value: "html" },
  { label: "Unicode", value: "unicode" },
  { label: "UTF-8", value: "utf8" },
  { label: "ASCII", value: "ascii" },
  { label: "Base32", value: "base32" },
  { label: "Binary", value: "binary" },
  { label: "Morse", value: "morse" },
  { label: "ROT13", value: "rot13" },
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
  config: [
    {
      id: "input",
      name: "Input",
      dataType: "string",
      defaultValue: "",
      hasInput: true,
      hasOutput: false,
    },
    {
      id: "encoding",
      name: "Encoding",
      dataType: "string",
      defaultValue: "base64",
      options: ENCODING_TYPES,
      hasInput: true,
      hasOutput: true,
    },
    {
      id: "mode",
      name: "Mode",
      dataType: "string",
      defaultValue: "encode",
      options: [
        { label: "Encode", value: "encode" },
        { label: "Decode", value: "decode" },
      ],
      hasInput: true,
      hasOutput: true,
    },
  ],
  outputs: [
    { id: "output", name: "Output", dataType: "string" },
  ],
  async execute(inputs, config) {
    const input = String(inputs.input ?? config.input ?? "")
    const encoding = String(inputs.encoding ?? config.encoding ?? "base64")
    const mode = String(inputs.mode ?? config.mode ?? "encode")

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
