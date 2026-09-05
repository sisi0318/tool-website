import { Binary } from "lucide-react"
import type { ToolAdapter } from "./types"
import { registerNode } from "../canvas/registry"
import { bytesToHex, decodeProtobuf, decodeProtobufWithSchema, encodeProtobuf, encodeProtobufWithSchema, loadProtobuf, parseProtobufInput, type ProtobufObject } from "../protobuf-tools"

// Existing canvas recipes address field_1 etc.; retain those root keys without a schema.
const legacyRootKeys = (value: ProtobufObject) => Object.fromEntries(Object.entries(value).map(([key, item]) => [`field_${key}`, item]))

export const protobufAdapter: ToolAdapter = {
  type: "protobuf",
  category: "data",
  label: "Protobuf",
  icon: Binary,
  config: [
    { id: "data", name: "Data", dataType: "string", defaultValue: "", hasInput: true, hasOutput: false },
    {
      id: "mode", name: "Mode", dataType: "string", defaultValue: "decode",
      options: [{ label: "Decode", value: "decode" }, { label: "Encode", value: "encode" }],
      hasInput: true, hasOutput: true,
    },
    { id: "indentSize", name: "Indent", dataType: "number", defaultValue: 4, slider: { min: 0, max: 8, step: 1 }, hasInput: true, hasOutput: true },
    { id: "schema", name: ".proto schema", dataType: "string", defaultValue: "", multiline: true },
    { id: "messageType", name: "Message type", dataType: "string", defaultValue: "", visible: (config) => Boolean(config.schema) },
  ],
  outputs: [
    { id: "decoded", name: "Decoded", dataType: "json" },
    { id: "encoded", name: "Hex", dataType: "string" },
  ],
  async execute(inputs, config) {
    const data = String(inputs.data ?? config.data ?? "")
    const mode = String(inputs.mode ?? config.mode ?? "decode")
    const schema = String(config.schema ?? "").trim()
    const messageType = String(config.messageType ?? "").trim()
    let type
    if (schema) {
      if (schema.length > 1024 * 1024) throw new Error("Schema exceeds 1 MB")
      if (!messageType) throw new Error("Message type is required when using a schema")
      const pb = await loadProtobuf()
      type = pb.parse(schema, { keepCase: true }).root.lookupType(messageType)
    }
    let bytes: Uint8Array
    if (mode === "decode") bytes = parseProtobufInput(data)
    else if (mode === "encode") bytes = type ? encodeProtobufWithSchema(data, type) : await encodeProtobuf(data)
    else throw new Error("Unknown Protobuf operation")
    return {
      decoded: type ? decodeProtobufWithSchema(bytes, type) : legacyRootKeys(decodeProtobuf(bytes)),
      encoded: bytesToHex(bytes),
    }
  },
}

export function registerProtobufAdapter(): void {
  registerNode(protobufAdapter)
}
