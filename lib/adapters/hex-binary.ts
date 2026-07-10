import { Binary } from "lucide-react"

import { registerNode } from "../canvas/registry"
import type { BinaryEncoding } from "../compression"
import { processHexBinary, type HexBinaryOperation } from "../hex-binary-tools"
import type { ToolAdapter } from "./types"

export const hexBinaryAdapter: ToolAdapter = {
  type: "hex-binary",
  category: "data",
  label: "Hex / Binary",
  description: "View bytes as a hex dump, convert encodings, and identify file signatures",
  icon: Binary,
  config: [
    { id: "input", name: "Input", dataType: "string", defaultValue: "", multiline: true, hasInput: true },
    { id: "operation", name: "Operation", dataType: "string", defaultValue: "hexdump", options: [
      { label: "Hex dump", value: "hexdump" }, { label: "Identify signature", value: "signature" },
      { label: "To text", value: "to-text" }, { label: "To hex", value: "to-hex" }, { label: "To Base64", value: "to-base64" },
    ], hasInput: true },
    { id: "inputEncoding", name: "Input encoding", dataType: "string", defaultValue: "text", options: [
      { label: "Text", value: "text" }, { label: "Hex", value: "hex" }, { label: "Base64", value: "base64" },
    ], hasInput: true },
    { id: "width", name: "Bytes per row", dataType: "number", defaultValue: 16, options: [
      { label: "8", value: "8" }, { label: "16", value: "16" }, { label: "32", value: "32" },
    ], hasInput: true },
  ],
  outputs: [
    { id: "output", name: "Output", dataType: "string" },
    { id: "byteLength", name: "Bytes", dataType: "number" },
    { id: "signature", name: "File signature", dataType: "json" },
  ],
  async execute(inputs, config) {
    return { ...processHexBinary(
      String(inputs.input ?? config.input ?? ""),
      String(inputs.operation ?? config.operation ?? "hexdump") as HexBinaryOperation,
      String(inputs.inputEncoding ?? config.inputEncoding ?? "text") as BinaryEncoding,
      Number(inputs.width ?? config.width ?? 16)
    ) }
  },
}

export function registerHexBinaryAdapter(): void {
  registerNode(hexBinaryAdapter)
}
