import { Regex } from "lucide-react"
import type { ToolAdapter } from "./types"
import { registerNode } from "../canvas/registry"
import { RegexTimeoutError, runRegex } from "../regex-runner"

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

    // 在 Worker 里执行并带超时,灾难性回溯不会拖死画布所在的主线程
    try {
      const result = await runRegex({
        pattern,
        flags,
        text,
        replacement: replacement || undefined,
        maxMatches: 10000,
      })
      return {
        matches: result.matches.map((match) => match.match),
        test: result.replaced ?? text,
      }
    } catch (error) {
      if (error instanceof RegexTimeoutError) throw error
      if (error instanceof SyntaxError) {
        throw new Error(`Invalid regex: ${error.message}`)
      }
      throw new Error(`Regex execution failed: ${error instanceof Error ? error.message : String(error)}`)
    }
  },
}

export function registerRegexAdapter(): void {
  registerNode(regexAdapter)
}
