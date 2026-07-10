import { Table2 } from "lucide-react"

import { registerNode } from "../canvas/registry"
import { processCsv, type CsvOperation } from "../csv-tools"
import type { ToolAdapter } from "./types"

export const csvAdapter: ToolAdapter = {
  type: "csv",
  category: "data",
  label: "CSV / TSV",
  description: "Convert and normalize delimited tabular data",
  icon: Table2,
  config: [
    { id: "input", name: "Input", dataType: "string", defaultValue: "", multiline: true, hasInput: true },
    { id: "operation", name: "Operation", dataType: "string", defaultValue: "to-json", options: [
      { label: "CSV to JSON", value: "to-json" },
      { label: "JSON to CSV", value: "from-json" },
      { label: "Normalize CSV", value: "normalize" },
      { label: "To TSV", value: "to-tsv" },
    ], hasInput: true },
    { id: "delimiter", name: "Delimiter", dataType: "string", defaultValue: "", hasInput: true },
    { id: "header", name: "First row is header", dataType: "boolean", defaultValue: true, hasInput: true },
  ],
  outputs: [
    { id: "output", name: "Output", dataType: "string" },
    { id: "rows", name: "Rows", dataType: "number" },
    { id: "columns", name: "Columns", dataType: "json" },
  ],
  async execute(inputs, config) {
    const result = processCsv(
      String(inputs.input ?? config.input ?? ""),
      String(inputs.operation ?? config.operation ?? "to-json") as CsvOperation,
      {
        delimiter: String(inputs.delimiter ?? config.delimiter ?? ""),
        header: (inputs.header ?? config.header ?? true) !== false,
      }
    )
    return { output: result.output, rows: result.rows, columns: result.columns }
  },
}

export function registerCsvAdapter(): void {
  registerNode(csvAdapter)
}

