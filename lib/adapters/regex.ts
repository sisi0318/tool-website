import { Regex } from "lucide-react"
import type { ToolAdapter } from "./types"
import { registerNode } from "../canvas/registry"

export const regexAdapter: ToolAdapter = {
  type: "regex",
  category: "text",
  label: "Regex",
  icon: Regex,
  inputs: [
    { id: "text", name: "Text", dataType: "string", required: true },
  ],
  outputs: [
    { id: "matches", name: "Matches", dataType: "json" },
    { id: "test", name: "Test", dataType: "string" },
  ],
  config: [
    {
      id: "pattern",
      name: "Pattern",
      dataType: "string",
      defaultValue: "",
    },
    {
      id: "flags",
      name: "Flags",
      dataType: "string",
      defaultValue: "g",
    },
    {
      id: "replacement",
      name: "Replacement",
      dataType: "string",
      defaultValue: "",
      multiline: true,
    },
  ],
  async execute(inputs, config) {
    const text = String(inputs.text ?? "")
    const pattern = String(config.pattern ?? "")
    const flags = String(config.flags ?? "g")
    const replacement = String(config.replacement ?? "")

    if (!pattern) {
      return { matches: [], test: text }
    }

    try {
      const regex = new RegExp(pattern, flags)
      const matches: string[] = []
      let match: RegExpExecArray | null

      while ((match = regex.exec(text)) !== null) {
        matches.push(match[0])
        if (!flags.includes("g")) break
      }

      const replaced = replacement ? text.replace(regex, replacement) : text

      return {
        matches,
        test: replaced,
      }
    } catch (error) {
      throw new Error(`Regex error: ${error}`)
    }
  },
}

export function registerRegexAdapter(): void {
  registerNode(regexAdapter)
}
