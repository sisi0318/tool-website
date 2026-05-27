import { KeyRound } from "lucide-react"
import type { ToolAdapter } from "./types"
import { registerNode } from "../canvas/registry"

function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/")
  while (base64.length % 4) base64 += "="
  return atob(base64)
}

export const jwtAdapter: ToolAdapter = {
  type: "jwt",
  category: "crypto",
  label: "JWT",
  icon: KeyRound,
  config: [
    {
      id: "token",
      name: "Token",
      dataType: "string",
      defaultValue: "",
      multiline: true,
      hasInput: true,
      hasOutput: false,
    },
  ],
  outputs: [
    { id: "header", name: "Header", dataType: "json" },
    { id: "payload", name: "Payload", dataType: "json" },
    { id: "signature", name: "Signature", dataType: "string" },
  ],
  async execute(inputs, config) {
    const token = String(inputs.token ?? config.token ?? "")

    if (!token) throw new Error("Token is required")

    try {
      const parts = token.split(".")
      if (parts.length !== 3) throw new Error("Invalid JWT format")

      const header = JSON.parse(base64UrlDecode(parts[0]))
      const payload = JSON.parse(base64UrlDecode(parts[1]))
      const signature = parts[2]

      return { header, payload, signature }
    } catch (error) {
      throw new Error(`JWT decode error: ${error}`)
    }
  },
}

export function registerJwtAdapter(): void {
  registerNode(jwtAdapter)
}
