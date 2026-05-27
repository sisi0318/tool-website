import { Search } from "lucide-react"
import type { ToolAdapter } from "./types"
import { registerNode } from "../canvas/registry"

export const whoisAdapter: ToolAdapter = {
  type: "whois",
  category: "dev",
  label: "Whois",
  icon: Search,
  inputs: [
    { id: "domain", name: "Domain", dataType: "string", required: true },
  ],
  outputs: [
    { id: "result", name: "Result", dataType: "json" },
  ],
  config: [],
  async execute(inputs, config) {
    const domain = String(inputs.domain ?? "")

    if (!domain) {
      throw new Error("Domain is required")
    }

    return {
      result: {
        domain,
        note: "Whois lookup requires server-side API. Domain name returned.",
      },
    }
  },
}

export function registerWhoisAdapter(): void {
  registerNode(whoisAdapter)
}
