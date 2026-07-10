import { FileText } from "lucide-react"

import { registerNode } from "../canvas/registry"
import { processMarkdown, type MarkdownOperation } from "../markdown-tools"
import type { ToolAdapter } from "./types"

export const markdownAdapter: ToolAdapter = {
  type: "markdown",
  category: "text",
  label: "Markdown",
  description: "Convert Markdown to HTML, plain text, or a table of contents",
  icon: FileText,
  config: [
    { id: "input", name: "Markdown", dataType: "string", defaultValue: "", multiline: true, hasInput: true },
    {
      id: "operation",
      name: "Operation",
      dataType: "string",
      defaultValue: "to-html",
      options: [
        { label: "Markdown to HTML", value: "to-html" },
        { label: "Table of contents", value: "toc" },
        { label: "Plain text", value: "plain-text" },
      ],
      hasInput: true,
    },
  ],
  outputs: [{ id: "output", name: "Output", dataType: "string" }],
  async execute(inputs, config) {
    const input = String(inputs.input ?? config.input ?? "")
    const operation = String(inputs.operation ?? config.operation ?? "to-html") as MarkdownOperation
    return { output: processMarkdown(input, operation) }
  },
}

export function registerMarkdownAdapter(): void {
  registerNode(markdownAdapter)
}
