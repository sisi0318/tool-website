"use client"

import { useState } from "react"
import { Table2 } from "lucide-react"

import { UtilityWorkbench } from "@/components/tools/utility-workbench"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { useTranslations } from "@/hooks/use-translations"
import { processCsv, type CsvOperation, type CsvResult } from "@/lib/csv-tools"

const SAMPLE = "name,language,stars\nTool Website,TypeScript,5\nCyberChef,JavaScript,5"

export default function CsvToolsPage() {
  const t = useTranslations("csvTools")
  const [input, setInput] = useState("")
  const [output, setOutput] = useState("")
  const [operation, setOperation] = useState<CsvOperation>("to-json")
  const [delimiter, setDelimiter] = useState("auto")
  const [header, setHeader] = useState(true)
  const [result, setResult] = useState<CsvResult | null>(null)
  const [error, setError] = useState("")

  const run = () => {
    try {
      const next = processCsv(input, operation, {
        delimiter: delimiter === "auto" ? "" : delimiter === "tab" ? "\t" : delimiter,
        header,
      })
      setResult(next)
      setOutput(next.output)
      setError("")
    } catch (cause) {
      setResult(null)
      setOutput("")
      setError(cause instanceof Error ? cause.message : t("failed"))
    }
  }

  return (
    <UtilityWorkbench
      title={t("title")}
      description={t("description")}
      icon={<Table2 className="h-6 w-6" />}
      input={input}
      output={output}
      operation={operation}
      operations={[
        { value: "to-json", label: t("toJson") },
        { value: "from-json", label: t("fromJson") },
        { value: "normalize", label: t("normalize") },
        { value: "to-tsv", label: t("toTsv") },
      ]}
      onInputChange={setInput}
      onOperationChange={(value) => { setOperation(value as CsvOperation); setOutput(""); setResult(null) }}
      onRun={run}
      onClear={() => { setInput(""); setOutput(""); setResult(null); setError("") }}
      onSample={() => { setInput(SAMPLE); setOperation("to-json") }}
      error={error}
      inputPlaceholder={operation === "from-json" ? t("jsonPlaceholder") : t("csvPlaceholder")}
      controls={(
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>{t("delimiter")}</Label>
            <Select value={delimiter} onValueChange={setDelimiter}>
              <SelectTrigger className="mt-2 min-h-11"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">{t("autoDetect")}</SelectItem>
                <SelectItem value=",">{t("comma")}</SelectItem>
                <SelectItem value="tab">{t("tab")}</SelectItem>
                <SelectItem value=";">{t("semicolon")}</SelectItem>
                <SelectItem value="|">{t("pipe")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex min-h-11 items-center justify-between self-end rounded-xl bg-[var(--md-sys-color-surface-container-low)] px-4 py-2">
            <Label htmlFor="csv-header">{t("header")}</Label>
            <Switch id="csv-header" checked={header} onCheckedChange={setHeader} />
          </div>
        </div>
      )}
      footer={result && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2 text-xs text-[var(--md-sys-color-on-surface-variant)]">
            <span className="rounded-full bg-[var(--md-sys-color-secondary-container)] px-3 py-1">{t("rows").replace("{count}", String(result.rows))}</span>
            <span className="rounded-full bg-[var(--md-sys-color-secondary-container)] px-3 py-1">{t("columns").replace("{count}", String(result.columns.length))}</span>
            <span className="rounded-full bg-[var(--md-sys-color-secondary-container)] px-3 py-1">{t("detectedDelimiter")}: {result.delimiter === "\t" ? t("tab") : result.delimiter}</span>
          </div>
          {result.errors.length > 0 && <p className="rounded-xl bg-[var(--md-sys-color-warning-container)] px-3 py-2 text-xs text-[var(--md-sys-color-on-warning-container)]">{result.errors.slice(0, 3).join(" · ")}</p>}
        </div>
      )}
    />
  )
}
