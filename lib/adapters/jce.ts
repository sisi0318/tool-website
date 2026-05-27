import { Database } from "lucide-react"
import type { ToolAdapter } from "./types"
import { registerNode } from "../canvas/registry"

export const jceAdapter: ToolAdapter = {
  type: "jce",
  category: "data",
  label: "JCE",
  icon: Database,
  inputs: [
    { id: "data", name: "Data", dataType: "string", required: true },
  ],
  outputs: [
    { id: "decoded", name: "Decoded", dataType: "json" },
  ],
  config: [
    {
      id: "mode",
      name: "Mode",
      dataType: "string",
      defaultValue: "decode",
      options: [
        { label: "Decode", value: "decode" },
        { label: "Encode", value: "encode" },
      ],
    },
  ],
  async execute(inputs, config) {
    const data = String(inputs.data ?? "")
    const mode = String(config.mode ?? "decode")

    if (mode === "decode") {
      try {
        const bytes = Buffer.from(data, "hex")
        const result: Record<string, unknown> = {}
        let i = 0
        while (i < bytes.length) {
          const tag = bytes[i]
          const fieldNumber = tag >> 4
          const type = tag & 0x0f
          i++
          if (type === 0) {
            result[`field_${fieldNumber}`] = bytes[i]
            i++
          } else if (type === 1) {
            result[`field_${fieldNumber}`] = bytes.slice(i, i + 2).readUInt16BE(0)
            i += 2
          } else if (type === 2) {
            const length = bytes.slice(i, i + 4).readUInt32BE(0)
            i += 4
            result[`field_${fieldNumber}`] = bytes.slice(i, i + length).toString("hex")
            i += length
          } else {
            break
          }
        }
        return { decoded: result }
      } catch (error) {
        throw new Error(`JCE decode error: ${error}`)
      }
    } else {
      throw new Error("JCE encode requires schema definition")
    }
  },
}

export function registerJceAdapter(): void {
  registerNode(jceAdapter)
}
