import { Binary } from "lucide-react"
import { registerNode } from "../canvas/registry"
import { asFile } from "../canvas/persist"
import type { ToolAdapter } from "./types"
import type { BinaryCodecOptions } from "../binary-codec-tools"

function createAdapter(fileInput: boolean): ToolAdapter {
  return {
    type: fileInput ? "binary-codec-file" : "binary-codec", category: "data", label: fileInput ? "MessagePack / CBOR File" : "MessagePack / CBOR", icon: Binary,
    description: "Encode or decode structured binary data using extended JSON for bytes, integers, maps and tags",
    config: [
      { id: "input", name: "Input", dataType: fileInput ? "bytes" : "string", hasInput: true, ...(fileInput ? {} : { defaultValue: "", multiline: true }) },
      { id: "format", name: "Format", dataType: "string", defaultValue: "msgpack", options: [{ label: "MessagePack", value: "msgpack" }, { label: "CBOR", value: "cbor" }] },
      ...(!fileInput ? [
        { id: "operation", name: "Operation", dataType: "string" as const, defaultValue: "decode", options: [{ label: "Decode to extended JSON", value: "decode" }, { label: "Encode extended JSON", value: "encode" }] },
        { id: "encoding", name: "Binary text encoding", dataType: "string" as const, defaultValue: "hex", options: [{ label: "Hex", value: "hex" }, { label: "Base64", value: "base64" }] },
      ] : []),
    ],
    outputs: [{ id: "value", name: "Extended JSON", dataType: "json" }, { id: "output", name: "Output text", dataType: "string" }, { id: "file", name: "Binary file", dataType: "bytes" }, { id: "byteLength", name: "Bytes", dataType: "number" }],
    async execute(inputs, config, context) {
      const { processBinaryCodec } = await import("../binary-codec-tools")
      const input = fileInput ? asFile(inputs.input ?? config.input) : String(inputs.input ?? config.input ?? "")
      if (!input && fileInput) throw new Error("A binary file is required")
      return { ...await processBinaryCodec(input!, { format: String(config.format ?? "msgpack") as BinaryCodecOptions["format"], operation: fileInput ? "decode" : String(config.operation ?? "decode") as BinaryCodecOptions["operation"], encoding: String(config.encoding ?? "hex") as BinaryCodecOptions["encoding"], signal: context?.signal }) }
    },
  }
}
export const binaryCodecAdapter = createAdapter(false)
export const binaryCodecFileAdapter = createAdapter(true)
export function registerBinaryCodecAdapters(): void { registerNode(binaryCodecAdapter); registerNode(binaryCodecFileAdapter) }
