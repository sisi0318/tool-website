import { Fingerprint } from "lucide-react"
import type { ToolAdapter } from "./types"
import { registerNode } from "../canvas/registry"
import { generateTotp, getTotpTimeRemaining } from "../totp-tools"

export const totpAdapter: ToolAdapter = {
  type: "totp",
  category: "utility",
  label: "TOTP",
  icon: Fingerprint,
  config: [
    {
      id: "secret",
      name: "Secret",
      dataType: "string",
      defaultValue: "",
      hasInput: true,
      hasOutput: false,
      sensitive: true,
    },
    {
      id: "digits",
      name: "Digits",
      dataType: "string",
      defaultValue: "6",
      options: [
        { label: "6", value: "6" },
        { label: "8", value: "8" },
      ],
      hasInput: false,
      hasOutput: false,
    },
    {
      id: "period",
      name: "Period (s)",
      dataType: "number",
      defaultValue: 30,
      hasInput: false,
      hasOutput: false,
    },
  ],
  outputs: [
    { id: "code", name: "Code", dataType: "string" },
    { id: "remaining", name: "Remaining", dataType: "number" },
  ],
  async execute(inputs, config) {
    const secret = String(inputs.secret ?? config.secret ?? "")

    if (!secret) {
      throw new Error("Secret is required")
    }

    const digits = Number(config.digits ?? 6) === 8 ? 8 : 6
    const periodValue = Number(config.period ?? 30)
    const period = Number.isFinite(periodValue) && periodValue > 0 ? Math.floor(periodValue) : 30
    const timestampSeconds = Math.floor(Date.now() / 1000)

    const code = await generateTotp(secret.replace(/\s/g, ""), period, digits, timestampSeconds)

    return {
      code,
      remaining: getTotpTimeRemaining(timestampSeconds, period),
    }
  },
}

export function registerTotpAdapter(): void {
  registerNode(totpAdapter)
}
