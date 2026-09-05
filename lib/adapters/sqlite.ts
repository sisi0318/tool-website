import { Database } from "lucide-react"
import { registerNode } from "../canvas/registry"
import { asFile } from "../canvas/persist"
import type { ToolAdapter } from "./types"

export const sqliteAdapter: ToolAdapter = {
  type: "sqlite", category: "data", label: "SQLite Viewer", icon: Database,
  description: "Read SQLite files and run bounded read-only SQL queries in a local worker",
  config: [
    { id: "file", name: "SQLite file", dataType: "bytes", hasInput: true },
    { id: "operation", name: "Operation", dataType: "string", defaultValue: "inspect", options: [{ label: "Inspect schema", value: "inspect" }, { label: "Query", value: "query" }] },
    { id: "sql", name: "Read-only SQL", dataType: "string", defaultValue: "SELECT type, name FROM sqlite_schema ORDER BY name", multiline: true, visible: (config) => config.operation === "query" },
    { id: "rowLimit", name: "Maximum rows (1–10000)", dataType: "number", defaultValue: 1000, visible: (config) => config.operation === "query" },
    { id: "exportFormat", name: "Export format", dataType: "string", defaultValue: "json", options: [{ label: "JSON", value: "json" }, { label: "CSV", value: "csv" }], visible: (config) => config.operation === "query" },
  ],
  outputs: [{ id: "result", name: "Result", dataType: "json" }, { id: "output", name: "Export text", dataType: "string" }, { id: "rowCount", name: "Rows", dataType: "number" }, { id: "truncated", name: "Row limit reached", dataType: "boolean" }],
  async execute(inputs, config, context) {
    const { SqliteWorkerClient } = await import("../sqlite-worker-client")
    const { exportSqliteResult, SqliteToolError } = await import("../sqlite-tools")
    const file = asFile(inputs.file ?? config.file)
    if (!file) throw new SqliteToolError("invalidFile")
    const client = new SqliteWorkerClient(file)
    try {
      const info = await client.open(context?.signal)
      if ((config.operation ?? "inspect") === "inspect") return { result: info, output: JSON.stringify(info, null, 2), rowCount: info.objects.length, truncated: info.truncated }
      if (config.operation !== "query" || !["json", "csv"].includes(String(config.exportFormat ?? "json"))) throw new SqliteToolError("queryFailed")
      const result = await client.query(String(config.sql ?? "SELECT type, name FROM sqlite_schema ORDER BY name"), Number(config.rowLimit ?? 1000), context?.signal)
      return { result, output: exportSqliteResult(result, String(config.exportFormat ?? "json") as "json" | "csv"), rowCount: result.rows.length, truncated: result.truncated }
    } finally { client.close() }
  },
}
export function registerSqliteAdapter(): void { registerNode(sqliteAdapter) }
