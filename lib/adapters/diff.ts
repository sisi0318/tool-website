import { GitCompare } from "lucide-react"
import type { ToolAdapter } from "./types"
import { registerNode } from "../canvas/registry"

export const diffAdapter: ToolAdapter = {
  type: "diff",
  category: "text",
  label: "Diff",
  icon: GitCompare,
  inputs: [
    { id: "text1", name: "Text 1", dataType: "string", required: true },
    { id: "text2", name: "Text 2", dataType: "string", required: true },
  ],
  outputs: [
    { id: "diff", name: "Diff", dataType: "json" },
  ],
  config: [],
  async execute(inputs, config) {
    const text1 = String(inputs.text1 ?? "")
    const text2 = String(inputs.text2 ?? "")

    const lines1 = text1.split("\n")
    const lines2 = text2.split("\n")

    const changes: Array<{ type: "add" | "remove" | "same"; line: string; lineNum: number }> = []
    const maxLen = Math.max(lines1.length, lines2.length)

    for (let i = 0; i < maxLen; i++) {
      const line1 = i < lines1.length ? lines1[i] : undefined
      const line2 = i < lines2.length ? lines2[i] : undefined

      if (line1 === line2) {
        changes.push({ type: "same", line: line1 ?? "", lineNum: i + 1 })
      } else {
        if (line1 !== undefined) {
          changes.push({ type: "remove", line: line1, lineNum: i + 1 })
        }
        if (line2 !== undefined) {
          changes.push({ type: "add", line: line2, lineNum: i + 1 })
        }
      }
    }

    return {
      diff: {
        changes,
        added: changes.filter((c) => c.type === "add").length,
        removed: changes.filter((c) => c.type === "remove").length,
        unchanged: changes.filter((c) => c.type === "same").length,
      },
    }
  },
}

export function registerDiffAdapter(): void {
  registerNode(diffAdapter)
}
