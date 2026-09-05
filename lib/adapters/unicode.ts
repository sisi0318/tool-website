import { CaseSensitive } from "lucide-react"
import { registerNode } from "../canvas/registry"
import type { ToolAdapter } from "./types"
import type { UnicodeOperation } from "../unicode-tools"

export const unicodeAdapter: ToolAdapter = {
  type: "unicode", category: "text", label: "Unicode Inspector", icon: CaseSensitive,
  description: "Inspect code points, invisible characters and UTF-8; normalize Unicode text",
  config: [
    { id: "input", name: "Text", dataType: "string", defaultValue: "", multiline: true, hasInput: true },
    { id: "operation", name: "Operation", dataType: "string", defaultValue: "inspect", options: [{ label: "Inspect", value: "inspect" }, ...["NFC", "NFD", "NFKC", "NFKD"].map((value) => ({ label: value, value }))] },
  ],
  outputs: [{ id: "output", name: "Output", dataType: "string" }, { id: "report", name: "Character report", dataType: "json" }, { id: "codePoints", name: "Code points", dataType: "number" }, { id: "wellFormed", name: "Valid UTF-16", dataType: "boolean" }],
  async execute(inputs, config) {
    const { processUnicode } = await import("../unicode-tools")
    const result = processUnicode(String(inputs.input ?? config.input ?? ""), String(config.operation ?? "inspect") as UnicodeOperation)
    return { output: result.output, report: result.report, codePoints: result.report.codePoints, wellFormed: result.report.wellFormed }
  },
}
export function registerUnicodeAdapter(): void { registerNode(unicodeAdapter) }
