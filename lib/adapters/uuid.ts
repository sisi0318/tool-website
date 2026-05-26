import { UUID } from "lucide-react"
import type { ToolAdapter } from "./types"
import { registerNode } from "../canvas/registry"
import { randomUUID } from "crypto"

export const uuidAdapter: ToolAdapter = {
  type: "uuid",
  category: "utility",
  label: "UUID",
  icon: UUID,
  inputs: [],
  outputs: [{ id: "uuid", name: "UUID", dataType: "string" }],
  config: [
    {
      id: "version",
      name: "Version",
      dataType: "string",
      defaultValue: "v4",
      options: [
        { label: "v4", value: "v4" },
        { label: "v1", value: "v1" },
      ],
    },
  ],
  async execute(inputs, config) {
    return { uuid: randomUUID() }
  },
}

export function registerUuidAdapter(): void {
  registerNode(uuidAdapter)
}
