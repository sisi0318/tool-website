import { Archive } from "lucide-react"

import { registerNode } from "../canvas/registry"
import { transformCompression, type BinaryEncoding, type CompressionFormat, type CompressionOperation } from "../compression"
import type { ToolAdapter } from "./types"

export const compressionAdapter: ToolAdapter = {
  type: "compression",
  category: "data",
  label: "Compression",
  description: "Compress or decompress GZip, Deflate, Zlib, Brotli and ZIP data",
  icon: Archive,
  config: [
    { id: "input", name: "Input", dataType: "string", defaultValue: "", multiline: true, hasInput: true },
    { id: "operation", name: "Operation", dataType: "string", defaultValue: "compress", options: [
      { label: "Compress", value: "compress" },
      { label: "Decompress", value: "decompress" },
    ], hasInput: true },
    { id: "format", name: "Format", dataType: "string", defaultValue: "gzip", options: [
      { label: "GZip", value: "gzip" },
      { label: "Zlib", value: "zlib" },
      { label: "Deflate", value: "deflate" },
      { label: "Brotli", value: "brotli" },
      { label: "ZIP", value: "zip" },
    ], hasInput: true },
    { id: "inputEncoding", name: "Input encoding", dataType: "string", defaultValue: "text", options: [
      { label: "Text", value: "text" },
      { label: "Base64", value: "base64" },
      { label: "Hex", value: "hex" },
    ], hasInput: true },
    { id: "outputEncoding", name: "Output encoding", dataType: "string", defaultValue: "base64", options: [
      { label: "Text", value: "text" },
      { label: "Base64", value: "base64" },
      { label: "Hex", value: "hex" },
    ], hasInput: true },
    { id: "level", name: "Level", dataType: "number", defaultValue: 6, slider: { min: 0, max: 11, step: 1 }, hasInput: true },
  ],
  outputs: [
    { id: "output", name: "Output", dataType: "string" },
    { id: "inputBytes", name: "Input bytes", dataType: "number" },
    { id: "outputBytes", name: "Output bytes", dataType: "number" },
    { id: "ratio", name: "Size ratio", dataType: "number" },
  ],
  async execute(inputs, config) {
    const result = await transformCompression(String(inputs.input ?? config.input ?? ""), {
      operation: String(inputs.operation ?? config.operation ?? "compress") as CompressionOperation,
      format: String(inputs.format ?? config.format ?? "gzip") as CompressionFormat,
      inputEncoding: String(inputs.inputEncoding ?? config.inputEncoding ?? "text") as BinaryEncoding,
      outputEncoding: String(inputs.outputEncoding ?? config.outputEncoding ?? "base64") as BinaryEncoding,
      level: Number(inputs.level ?? config.level ?? 6),
    })
    return { ...result }
  },
}

export function registerCompressionAdapter(): void {
  registerNode(compressionAdapter)
}
