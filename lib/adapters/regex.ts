import { Regex } from "lucide-react"
import type { ToolAdapter } from "./types"
import { registerNode } from "../canvas/registry"

export const regexAdapter: ToolAdapter = {
  type: "regex",
  category: "text",
  label: "Regex",
  icon: Regex,
  config: [
    {
      id: "text",
      name: "Text",
      dataType: "string",
      defaultValue: "",
      hasInput: true,
      hasOutput: false,
    },
    {
      id: "pattern",
      name: "Pattern",
      dataType: "string",
      defaultValue: "",
      hasInput: true,
      hasOutput: true,
    },
    {
      id: "flags",
      name: "Flags",
      dataType: "string",
      defaultValue: "g",
      hasInput: true,
      hasOutput: true,
    },
    {
      id: "replacement",
      name: "Replacement",
      dataType: "string",
      defaultValue: "",
      multiline: true,
      hasInput: true,
      hasOutput: true,
    },
  ],
  outputs: [
    { id: "matches", name: "Matches", dataType: "json" },
    { id: "test", name: "Test", dataType: "string" },
  ],
  async execute(inputs, config) {
    const text = String(inputs.text ?? config.text ?? "")
    const pattern = String(inputs.pattern ?? config.pattern ?? "")
    const flags = String(inputs.flags ?? config.flags ?? "g")
    const replacement = String(inputs.replacement ?? config.replacement ?? "")

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
