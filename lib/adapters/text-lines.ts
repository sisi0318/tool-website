import { ListFilter } from "lucide-react"
import { registerNode } from "../canvas/registry"
import type { ToolAdapter } from "./types"
import type { TextLineOptions } from "../text-line-tools"

export const textLinesAdapter: ToolAdapter = {
  type: "text-lines", category: "text", label: "Text Lines", icon: ListFilter,
  description: "Clean, deduplicate, sort, extract columns and compare sets of text lines",
  config: [
    { id: "input", name: "Text A", dataType: "string", defaultValue: "", multiline: true, hasInput: true },
    { id: "other", name: "Text B (set operations)", dataType: "string", defaultValue: "", multiline: true, hasInput: true },
    { id: "operation", name: "Operation", dataType: "string", defaultValue: "dedupe", options: [{ label: "Deduplicate", value: "dedupe" }, { label: "Clean whitespace", value: "clean" }, { label: "Sort", value: "sort" }, { label: "Prefix / suffix", value: "affix" }, { label: "Extract columns", value: "columns" }, { label: "Union", value: "union" }, { label: "Intersection", value: "intersection" }, { label: "A minus B", value: "difference" }, { label: "Symmetric difference", value: "symmetric-difference" }] },
    { id: "trim", name: "Trim each line", dataType: "boolean", defaultValue: false },
    { id: "removeEmpty", name: "Remove empty lines", dataType: "boolean", defaultValue: true },
    { id: "ignoreCase", name: "Ignore case", dataType: "boolean", defaultValue: false },
    { id: "sortMode", name: "Sort mode", dataType: "string", defaultValue: "lexical", options: [{ label: "Lexical", value: "lexical" }, { label: "Natural", value: "natural" }, { label: "Exact numeric", value: "numeric" }], visible: (config) => config.operation === "sort" },
    { id: "descending", name: "Descending", dataType: "boolean", defaultValue: false, visible: (config) => config.operation === "sort" },
    { id: "prefix", name: "Prefix", dataType: "string", defaultValue: "", visible: (config) => config.operation === "affix" },
    { id: "suffix", name: "Suffix", dataType: "string", defaultValue: "", visible: (config) => config.operation === "affix" },
    { id: "delimiter", name: "Column delimiter (literal; \\t = tab)", dataType: "string", defaultValue: "\\t", visible: (config) => config.operation === "columns" },
    { id: "whitespaceDelimiter", name: "Split on whitespace", dataType: "boolean", defaultValue: false, visible: (config) => config.operation === "columns" },
    { id: "columns", name: "Columns (1-based, e.g. 3,1-2)", dataType: "string", defaultValue: "1", visible: (config) => config.operation === "columns" },
    { id: "outputDelimiter", name: "Output column delimiter (\\t = tab)", dataType: "string", defaultValue: "\\t", visible: (config) => config.operation === "columns" },
    { id: "missingColumn", name: "Missing column", dataType: "string", defaultValue: "empty", options: [{ label: "Empty value", value: "empty" }, { label: "Error", value: "error" }], visible: (config) => config.operation === "columns" },
    { id: "newline", name: "Output line endings", dataType: "string", defaultValue: "lf", options: [{ label: "LF", value: "lf" }, { label: "CRLF", value: "crlf" }] },
    { id: "trailingNewline", name: "Final newline", dataType: "boolean", defaultValue: false },
  ],
  outputs: [{ id: "output", name: "Output", dataType: "string" }, { id: "lines", name: "Lines", dataType: "json" }, { id: "count", name: "Result lines", dataType: "number" }],
  async execute(inputs, config) {
    const { processTextLines } = await import("../text-line-tools")
    const result = processTextLines(String(inputs.input ?? config.input ?? ""), { ...config, other: String(inputs.other ?? config.other ?? ""), delimiter: config.delimiter === "\\t" ? "\t" : config.delimiter ?? "\t", outputDelimiter: config.outputDelimiter === "\\t" ? "\t" : config.outputDelimiter ?? "\t" } as TextLineOptions)
    return { output: result.output, lines: result.lines, count: result.lines.length }
  },
}
export function registerTextLinesAdapter(): void { registerNode(textLinesAdapter) }
