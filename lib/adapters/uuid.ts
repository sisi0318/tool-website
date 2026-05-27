import { Fingerprint } from "lucide-react"
import type { ToolAdapter } from "./types"
import { registerNode } from "../canvas/registry"
import { randomUUID } from "crypto"

export const uuidAdapter: ToolAdapter = {
  type: "uuid",
  category: "utility",
  label: "UUID",
  icon: Fingerprint,
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
      hasInput: true,
      hasOutput: true,
    },
    {
      id: "uppercase",
      name: "Uppercase",
      dataType: "boolean",
      defaultValue: false,
      hasInput: true,
      hasOutput: true,
    },
    {
      id: "withHyphens",
      name: "Hyphens",
      dataType: "boolean",
      defaultValue: true,
      hasInput: true,
      hasOutput: true,
    },
  ],
  outputs: [
    { id: "uuid", name: "UUID", dataType: "string" },
  ],
  async execute(inputs, config) {
    const uppercase = inputs.uppercase ?? config.uppercase ?? false
    const withHyphens = inputs.withHyphens ?? config.withHyphens ?? true

    let uuid = randomUUID()
    if (!withHyphens) uuid = uuid.replace(/-/g, "")
    if (uppercase) uuid = uuid.toUpperCase()

    return { uuid }
  },
}

export function registerUuidAdapter(): void {
  registerNode(uuidAdapter)
}
