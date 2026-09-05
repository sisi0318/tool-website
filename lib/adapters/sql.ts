import { Database } from "lucide-react"

import { registerNode } from "../canvas/registry"
import type { SqlDialect, SqlOperation } from "../sql-tools"
import type { ToolAdapter } from "./types"

export const sqlAdapter: ToolAdapter = {
  type: "sql",
  category: "dev",
  label: "SQL",
  description: "Format or minify SQL using the selected database dialect",
  icon: Database,
  config: [
    { id: "input", name: "SQL", dataType: "string", defaultValue: "", multiline: true, hasInput: true },
    { id: "operation", name: "Operation", dataType: "string", defaultValue: "format", options: [
      { label: "Format", value: "format" }, { label: "Minify", value: "minify" },
    ], hasInput: true },
    { id: "dialect", name: "Dialect", dataType: "string", defaultValue: "sql", options: [
      { label: "Standard SQL", value: "sql" }, { label: "PostgreSQL", value: "postgresql" },
      { label: "MySQL", value: "mysql" }, { label: "SQLite", value: "sqlite" },
      { label: "SQL Server", value: "transactsql" }, { label: "BigQuery", value: "bigquery" },
    ], hasInput: true },
  ],
  outputs: [{ id: "output", name: "SQL", dataType: "string" }],
  async execute(inputs, config) {
    // 重依赖按需加载:适配器随 registerAllAdapters() 全量打进画布与旅程页,静态引入会把整个库拖进首屏
    const { processSql } = await import("../sql-tools")
    return {
      output: processSql(
        String(inputs.input ?? config.input ?? ""),
        String(inputs.operation ?? config.operation ?? "format") as SqlOperation,
        { language: String(inputs.dialect ?? config.dialect ?? "sql") as SqlDialect }
      ),
    }
  },
}

export function registerSqlAdapter(): void {
  registerNode(sqlAdapter)
}
