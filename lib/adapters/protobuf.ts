import { Binary } from "lucide-react"
import type { ToolAdapter } from "./types"
import { registerNode } from "../canvas/registry"

export const protobufAdapter: ToolAdapter = {
  type: "protobuf",
  category: "data",
  label: "Protobuf",
  icon: Binary,
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
      id: "mode",
      name: "Mode",
      dataType: "string",
      defaultValue: "decode",
      options: [
        { label: "Decode", value: "decode" },
        { label: "Encode", value: "encode" },
      ],
      hasInput: true,
      hasOutput: true,
    },
    {
      id: "indentSize",
      name: "Indent",
      dataType: "number",
      defaultValue: 2,
      slider: { min: 0, max: 8, step: 1 },
      hasInput: true,
      hasOutput: true,
    },
  ],
  outputs: [
    { id: "decoded", name: "Decoded", dataType: "json" },
  ],
  async execute(inputs, config) {
    const data = String(inputs.data ?? config.data ?? "")
    const mode = String(inputs.mode ?? config.mode ?? "decode")

    if (mode === "decode") {
      try {
        const bytes = Buffer.from(data, "hex")
        const result: Record<string, unknown> = {}
        let i = 0
        while (i < bytes.length) {
          const tag = bytes[i]
          const fieldNumber = tag >> 3
          const wireType = tag & 0x07
          i++
          if (wireType === 0) {
            let value = 0
            let shift = 0
            while (i < bytes.length && bytes[i] >= 0x80) {
              value |= (bytes[i] & 0x7f) << shift
              shift += 7
              i++
            }
            if (i < bytes.length) {
              value |= bytes[i] << shift
              i++
            }
            result[`field_${fieldNumber}`] = value
          } else if (wireType === 2) {
            let length = 0
            let shift = 0
            while (i < bytes.length && bytes[i] >= 0x80) {
              length |= (bytes[i] & 0x7f) << shift
              shift += 7
              i++
            }
            if (i < bytes.length) {
              length |= bytes[i] << shift
              i++
            }
            result[`field_${fieldNumber}`] = bytes.slice(i, i + length).toString("hex")
            i += length
          } else {
            break
          }
        }
        return { decoded: result }
      } catch (error) {
        throw new Error(`Protobuf decode error: ${error}`)
      }
    } else {
      throw new Error("Protobuf encode requires schema definition")
    }
  },
}

export function registerProtobufAdapter(): void {
  registerNode(protobufAdapter)
}
