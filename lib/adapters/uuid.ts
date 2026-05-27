import { Fingerprint } from "lucide-react"
import type { ToolAdapter } from "./types"
import { registerNode } from "../canvas/registry"
import { randomUUID } from "crypto"

export const uuidAdapter: ToolAdapter = {
  type: "uuid",
  category: "utility",
  label: "UUID",
  icon: Fingerprint,
  inputs: [],
  outputs: [{ id: "uuid", name: "UUID", dataType: "string" }],
  config: [
    {
      id: "version",
      name: "Version",
      dataType: "string",
      defaultValue: "v4",
      options: [
        { label: "v4 (Random)", value: "v4" },
        { label: "v1 (Time-based)", value: "v1" },
      ],
    },
    {
      id: "uppercase",
      name: "Uppercase",
      dataType: "boolean",
      defaultValue: false,
    },
    {
      id: "withHyphens",
      name: "Hyphens",
      dataType: "boolean",
      defaultValue: true,
    },
  ],
  async execute(inputs, config) {
    return { uuid: randomUUID() }
  },
}

export function registerUuidAdapter(): void {
  registerNode(uuidAdapter)
}
