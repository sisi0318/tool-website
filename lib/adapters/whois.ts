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
    const domain = String(inputs.domain ?? config.domain ?? "").trim()

    if (!domain) {
      throw new Error("Domain is required")
    }

    try {
      const response = await fetch(`/api/whois?domain=${encodeURIComponent(domain)}`)
      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        throw new Error(err.error ?? `Lookup failed (${response.status})`)
      }
      return { result: await response.json() }
    } catch (error) {
      if (error instanceof TypeError && error.message.includes("fetch")) {
        throw new Error("Network error — cannot reach whois API")
      }
      throw error
    }
  },
}

export function registerWhoisAdapter(): void {
  registerNode(whoisAdapter)
}
