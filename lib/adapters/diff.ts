import { GitCompare } from "lucide-react"
import type { ToolAdapter } from "./types"
import { registerNode } from "../canvas/registry"
import { computeLineDiff } from "../text-diff"

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

    const result = computeLineDiff(text1, text2, "quick")
    const changes = result.lines.map((line, index) => ({
      type: line.type === "added"
        ? "add" as const
        : line.type === "removed"
          ? "remove" as const
          : "same" as const,
      line: line.content,
      lineNum: index + 1,
    }))

    return {
      added: result.added,
      removed: result.removed,
      unchanged: result.unchanged,
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
