import { KeyRound } from "lucide-react"
import type { ToolAdapter } from "./types"
import { registerNode } from "../canvas/registry"

function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/")
  while (base64.length % 4) {
    base64 += "="
  }
  return Buffer.from(base64, "base64").toString("utf8")
}

export const jwtAdapter: ToolAdapter = {
  type: "jwt",
  category: "crypto",
  label: "JWT",
  icon: KeyRound,
  inputs: [
    { id: "token", name: "Token", dataType: "string", required: true },
  ],
  outputs: [
    { id: "header", name: "Header", dataType: "json" },
    { id: "payload", name: "Payload", dataType: "json" },
    { id: "signature", name: "Signature", dataType: "string" },
  ],
  config: [],
  async execute(inputs, config) {
    const token = String(inputs.token ?? "")

    try {
      const parts = token.split(".")
      if (parts.length !== 3) {
        throw new Error("Invalid JWT format")
      }

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
