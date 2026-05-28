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

    if (pattern.length > 1000) {
      throw new Error("Pattern too long (max 1000 characters)")
    }

    let regex: RegExp
    try {
      regex = new RegExp(pattern, flags)
    } catch (error) {
      throw new Error(`Invalid regex: ${error instanceof Error ? error.message : String(error)}`)
    }

    try {
      const matches: string[] = []
      let match: RegExpExecArray | null
      const maxMatches = 10000
      let count = 0

      while ((match = regex.exec(text)) !== null) {
        matches.push(match[0])
        if (!flags.includes("g")) break
        if (match[0].length === 0) {
          regex.lastIndex++
        }
        if (++count >= maxMatches) break
      }

      const replaced = replacement ? text.replace(regex, replacement) : text

      return {
        matches,
        test: replaced,
      }
    } catch (error) {
      throw new Error(`Regex execution failed: ${error instanceof Error ? error.message : String(error)}`)
    }
  },
}

export function registerRegexAdapter(): void {
  registerNode(regexAdapter)
}
