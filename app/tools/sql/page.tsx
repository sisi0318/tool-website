"use client"

import { useState } from "react"
import { Database } from "lucide-react"

import { UtilityWorkbench, workbenchError, type WorkbenchError } from "@/components/tools/utility-workbench"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useTranslations } from "@/hooks/use-translations"
import type { SqlDialect, SqlOperation } from "@/lib/sql-tools"
import { useToolDraft } from "@/hooks/use-tool-draft"

const SAMPLE = "select u.id,u.name,count(o.id) as orders from users u left join orders o on o.user_id=u.id where u.active=true group by u.id,u.name order by orders desc;"

const DIALECTS: Array<[SqlDialect, string]> = [
  ["sql", "Standard SQL"], ["postgresql", "PostgreSQL"], ["mysql", "MySQL"],
  ["mariadb", "MariaDB"], ["sqlite", "SQLite"], ["transactsql", "SQL Server"],
  ["bigquery", "BigQuery"], ["plsql", "PL/SQL"], ["snowflake", "Snowflake"],
  ["spark", "Spark SQL"], ["duckdb", "DuckDB"], ["clickhouse", "ClickHouse"],
]

export default function SqlPage() {
  const t = useTranslations("sqlTools")
  const [input, setInput] = useToolDraft("sql")
  const [output, setOutput] = useState("")
  const [operation, setOperation] = useState<SqlOperation>("format")
  const [dialect, setDialect] = useState<SqlDialect>("sql")
  const [error, setError] = useState<string | WorkbenchError>("")

  // sql-formatter 较大，第一次运行时才加载，不进首屏
  const run = async () => {
    try {
      const { processSql } = await import("@/lib/sql-tools")
      setOutput(processSql(input, operation, { language: dialect, keywordCase: "upper", tabWidth: 2 }))
      setError("")
    } catch (cause) {
      setOutput("")
      setError(workbenchError(t("failed"), cause))
    }
  }

  return (
    <UtilityWorkbench textFile autoRun autoRunKey={dialect}
      title={t("title")}
      description={t("description")}
      icon={<Database className="h-6 w-6" />}
      input={input}
      output={output}
      operation={operation}
      operations={[{ value: "format", label: t("format") }, { value: "minify", label: t("minify") }]}
      onInputChange={setInput}
      onOperationChange={(value) => { setOperation(value as SqlOperation); setOutput("") }}
      onRun={run}
      onClear={() => { setInput(""); setOutput(""); setError("") }}
      onSample={() => { setInput(SAMPLE); setOutput("") }}
      error={error}
      inputLabel="SQL"
      inputPlaceholder={t("placeholder")}
      controls={operation === "format" ? (
        <div>
          <Label>{t("dialect")}</Label>
          <Select value={dialect} onValueChange={(value) => setDialect(value as SqlDialect)}>
            <SelectTrigger className="mt-2 min-h-11" aria-label={t("dialect")}><SelectValue /></SelectTrigger>
            <SelectContent>{DIALECTS.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      ) : undefined}
    />
  )
}
