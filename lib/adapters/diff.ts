import { GitCompare } from "lucide-react"
import type { ToolAdapter } from "./types"
import { registerNode } from "../canvas/registry"
import { computeLineDiff } from "../text-diff"
import { compareStructuredText } from "../structured-diff"

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
    { id: "mode", name: "Comparison", dataType: "string", defaultValue: "text", options: [{ label: "Text", value: "text" }, { label: "JSON", value: "json" }, { label: "YAML", value: "yaml" }], hasInput: false, hasOutput: false },
    { id: "ignorePaths", name: "Ignore paths (one per line; * / ** supported)", dataType: "string", defaultValue: "", multiline: true, hasInput: false, hasOutput: false, visible: (config) => config.mode === "json" || config.mode === "yaml" },
    { id: "arrayKey", name: "Array key (empty = by position)", dataType: "string", defaultValue: "", hasInput: false, hasOutput: false, visible: (config) => config.mode === "json" || config.mode === "yaml" },
  ],
  outputs: [
    { id: "added", name: "Added", dataType: "number" },
    { id: "removed", name: "Removed", dataType: "number" },
    { id: "unchanged", name: "Unchanged", dataType: "number" },
    { id: "diff", name: "Diff", dataType: "json" },
    { id: "changes", name: "Changes", dataType: "json" },
    { id: "changed", name: "Changed fields", dataType: "number" },
  ],
  async execute(inputs, config) {
    const text1 = String(inputs.text1 ?? config.text1 ?? "")
    const text2 = String(inputs.text2 ?? config.text2 ?? "")
    const mode = String(config.mode ?? "text")
    if (mode === "json" || mode === "yaml") {
      const result = await compareStructuredText(text1, text2, mode, { ignorePaths: String(config.ignorePaths ?? "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean), arrayKey: String(config.arrayKey ?? "") })
      return { added: result.added, removed: result.removed, unchanged: result.unchanged, changed: result.changed, changes: result.changes, diff: { text1, text2, ...result } }
    }

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
      changed: 0,
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
