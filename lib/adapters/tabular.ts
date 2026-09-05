import { Table2 } from "lucide-react"
import { registerNode } from "../canvas/registry"
import { asFile } from "../canvas/persist"
import type { ToolAdapter } from "./types"
import type { TabularFilter } from "../tabular-tools"

function makeAdapter(fileInput: boolean): ToolAdapter {
  return {
    type: fileInput ? "tabular-file" : "tabular", category: "data", label: fileInput ? "CSV / JSONL File" : "CSV / JSONL Query", icon: Table2,
    description: "Filter, select columns, sort and count groups with source line diagnostics",
    config: [
      { id: "input", name: fileInput ? "File" : "Input", dataType: fileInput ? "bytes" : "string", hasInput: true, ...(fileInput ? {} : { defaultValue: "", multiline: true }) },
      { id: "format", name: "Input format", dataType: "string", defaultValue: "auto", options: [{ label: "Auto", value: "auto" }, { label: "CSV / TSV", value: "csv" }, { label: "JSONL", value: "jsonl" }] },
      { id: "delimiter", name: "CSV delimiter (empty = auto)", dataType: "string", defaultValue: "" },
      { id: "header", name: "CSV first row is header", dataType: "boolean", defaultValue: true },
      { id: "filters", name: 'Filters: [{"column":"status","operator":"gte","value":"500"}]', dataType: "json", defaultValue: [] },
      { id: "columns", name: "Columns (empty array = all)", dataType: "json", defaultValue: [] },
      { id: "groupBy", name: "Group columns (empty array = no grouping)", dataType: "json", defaultValue: [] },
      { id: "sortColumn", name: "Sort column (empty = source order)", dataType: "string", defaultValue: "" },
      { id: "descending", name: "Descending", dataType: "boolean", defaultValue: false },
      { id: "outputFormat", name: "Export format", dataType: "string", defaultValue: "json", options: [{ label: "JSON", value: "json" }, { label: "JSONL", value: "jsonl" }, { label: "CSV", value: "csv" }] },
    ],
    outputs: [{ id: "rows", name: "Rows", dataType: "json" }, { id: "output", name: "Export text", dataType: "string" }, { id: "rowCount", name: "Result rows", dataType: "number" }, { id: "errorCount", name: "Invalid records", dataType: "number" }, { id: "errors", name: "Line errors (up to 1,000)", dataType: "json" }, { id: "lines", name: "Source lines", dataType: "json" }],
    async execute(inputs, config, context) {
      const { parseTabular, queryTabular, exportTabular, TabularError } = await import("../tabular-tools")
      const source = fileInput ? asFile(inputs.input ?? config.input) : String(inputs.input ?? config.input ?? "")
      if (source === null) throw new TabularError("invalidQuery")
      const prefix = typeof source === "string" ? source.slice(0, 1024) : await source.slice(0, 1024).text()
      const requested = String(config.format ?? "auto")
      const format = requested === "auto" ? prefix.trimStart().startsWith("{") ? "jsonl" : "csv" : requested
      if (format !== "csv" && format !== "jsonl") throw new TabularError("invalidQuery")
      const arrayConfig = (key: string): unknown[] => { const value = config[key] ?? []; const parsed: unknown = typeof value === "string" ? JSON.parse(value) : value; if (!Array.isArray(parsed)) throw new TabularError("invalidQuery", key); return parsed }
      const filters = arrayConfig("filters"), columns = arrayConfig("columns"), groupBy = arrayConfig("groupBy")
      if ([...columns, ...groupBy].some((value) => typeof value !== "string")) throw new TabularError("invalidQuery")
      const data = await parseTabular(source, { format, delimiter: String(config.delimiter ?? ""), header: config.header !== false, signal: context?.signal })
      const result = await queryTabular(data, { filters: filters as TabularFilter[], columns: columns.length ? columns as string[] : undefined, groupBy: groupBy as string[], sortColumn: String(config.sortColumn ?? "") || undefined, descending: config.descending === true }, context?.signal)
      return { rows: result.rows, output: exportTabular(result, String(config.outputFormat ?? "json") as "json" | "csv" | "jsonl"), rowCount: result.rows.length, errorCount: data.errorCount, errors: data.issues, lines: result.lines }
    },
  }
}
export const tabularAdapter = makeAdapter(false)
export const tabularFileAdapter = makeAdapter(true)
export function registerTabularAdapters(): void { registerNode(tabularAdapter); registerNode(tabularFileAdapter) }
