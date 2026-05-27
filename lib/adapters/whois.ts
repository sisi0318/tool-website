import { Search } from "lucide-react"
import type { ToolAdapter } from "./types"
import { registerNode } from "../canvas/registry"

export const whoisAdapter: ToolAdapter = {
  type: "whois",
  category: "dev",
  label: "Whois",
  icon: Search,
  config: [
    {
      id: "domain",
      name: "Domain",
      dataType: "string",
      defaultValue: "",
      hasInput: true,
      hasOutput: false,
    },
  ],
  outputs: [
    { id: "result", name: "Result", dataType: "json" },
  ],
  async execute(inputs, config) {
    const domain = String(inputs.domain ?? config.domain ?? "")

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
