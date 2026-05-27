import { GitCompare } from "lucide-react"
import type { ToolAdapter } from "./types"
import { registerNode } from "../canvas/registry"

export const diffAdapter: ToolAdapter = {
  type: "diff",
  category: "text",
  label: "Diff",
  icon: GitCompare,
  config: [
    {
      id: "text1",
      name: "Text 1",
      dataType: "string",
      defaultValue: "",
      multiline: true,
      hasInput: true,
      hasOutput: false,
    },
    {
      id: "text2",
      name: "Text 2",
      dataType: "string",
      defaultValue: "",
      multiline: true,
      hasInput: true,
      hasOutput: false,
    },
  ],
  outputs: [
    { id: "added", name: "Added", dataType: "number" },
    { id: "removed", name: "Removed", dataType: "number" },
    { id: "unchanged", name: "Unchanged", dataType: "number" },
    { id: "diff", name: "Diff", dataType: "json" },
    { id: "changes", name: "Changes", dataType: "json" },
  ],
  async execute(inputs, config) {
    const text1 = String(inputs.text1 ?? config.text1 ?? "")
    const text2 = String(inputs.text2 ?? config.text2 ?? "")

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
        if (line1 !== undefined) changes.push({ type: "remove", line: line1, lineNum: i + 1 })
        if (line2 !== undefined) changes.push({ type: "add", line: line2, lineNum: i + 1 })
      }
    }

    const added = changes.filter((c) => c.type === "add").length
    const removed = changes.filter((c) => c.type === "remove").length
    const unchanged = changes.filter((c) => c.type === "same").length

    return {
      added,
      removed,
      unchanged,
      diff: {
        text1,
        text2,
        changes,
      },
      changes,
    }
  },
}

export function registerDiffAdapter(): void {
  registerNode(diffAdapter)
}
