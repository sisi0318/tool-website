import { Fingerprint } from "lucide-react"
import type { ToolAdapter } from "./types"
import { registerNode } from "../canvas/registry"

export const totpAdapter: ToolAdapter = {
  type: "totp",
  category: "utility",
  label: "TOTP",
  icon: Fingerprint,
  inputs: [
    { id: "secret", name: "Secret", dataType: "string", required: true },
  ],
  outputs: [
    { id: "code", name: "Code", dataType: "string" },
    { id: "remaining", name: "Remaining", dataType: "number" },
  ],
  config: [],
  async execute(inputs, config) {
    const secret = String(inputs.secret ?? "")

    if (!secret) {
      throw new Error("Secret is required")
    }

    const time = Math.floor(Date.now() / 1000)
    const remaining = 30 - (time % 30)

    return {
      code: "000000",
      remaining,
      note: "TOTP generation requires crypto HMAC. Placeholder returned.",
    }
  },
}

export function registerTotpAdapter(): void {
  registerNode(totpAdapter)
}
