"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { ChevronLeft, ChevronRight, Download, FileText, Loader2, Play, Plus, Table2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { JsonTreeView } from "@/components/json-tree-view"
import { SendToMenu } from "@/components/tools/send-to-menu"
import { useObjectUrl } from "@/hooks/use-object-url"
import { useTranslations } from "@/hooks/use-translations"
import { exportTabular, parseTabular, queryTabular, tabularCellText, TabularError, type FilterOperator, type TabularData, type TabularFilter, type TabularFormat, type TabularResult, type TabularRow } from "@/lib/tabular-tools"

const SAMPLE = '{"time":"10:00","service":"api","status":200,"id":"0001"}\n{"time":"10:01","service":"api","status":500,"id":"0002"}\n{"time":"10:02","service":"web","status":502,"id":"0003"}\n{"time":"10:03","service":"api","status":503,"id":"0004"}\n{"broken":\n{"time":"10:04","service":"web","status":200,"id":"0006"}'
const OPERATORS: FilterOperator[] = ["eq", "ne", "contains", "notContains", "gt", "gte", "lt", "lte", "exists", "missing"]
function Choice({ label, value, items, onChange }: { label: string; value: string; items: Array<[string, string]>; onChange: (value: string) => void }) {
  return <div className="min-w-0 space-y-2"><Label>{label}</Label><Select value={value} onValueChange={onChange}><SelectTrigger aria-label={label} className="min-h-10"><SelectValue /></SelectTrigger><SelectContent>{items.map(([key, name]) => <SelectItem key={key} value={key}>{name}</SelectItem>)}</SelectContent></Select></div>
}

export default function TabularPanel() {
  const t = useTranslations("tabular")
  const [input, setInput] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [format, setFormat] = useState<TabularFormat>("jsonl")
  const [delimiter, setDelimiter] = useState("auto")
  const [header, setHeader] = useState(true)
  const [data, setData] = useState<TabularData | null>(null)
  const [result, setResult] = useState<TabularResult | null>(null)
  const [filters, setFilters] = useState<TabularFilter[]>([])
  const [columns, setColumns] = useState<string[]>([])
  const [sort, setSort] = useState<string | null>(null)
  const [descending, setDescending] = useState(false)
  const [group, setGroup] = useState<string | null>(null)
  const [page, setPage] = useState(0)
  const [issuePage, setIssuePage] = useState(0)
  const [row, setRow] = useState<TabularRow | null>(null)
  const [exportFormat, setExportFormat] = useState<"json" | "csv" | "jsonl">("json")
  const [running, setRunning] = useState(false)
  const [querying, setQuerying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState("")
  const controller = useRef<AbortController | null>(null)
  const version = useRef(0)
  const cancel = () => { version.current++; controller.current?.abort(); setRunning(false) }
  const reset = () => { cancel(); setData(null); setResult(null); setRow(null); setError("") }
  useEffect(() => () => { version.current++; controller.current?.abort() }, [])
  const run = async () => {
    reset()
    const current = version.current, abort = new AbortController()
    controller.current = abort; setRunning(true); setProgress(0)
    try {
      const parsed = await parseTabular(file ?? input, { format, delimiter: delimiter === "auto" ? undefined : delimiter === "tab" ? "\t" : delimiter, header, signal: abort.signal, onProgress: (read, total) => { if (current === version.current) setProgress(total ? Math.round(read / total * 100) : 100) } })
      if (current !== version.current || abort.signal.aborted) return
      setColumns(parsed.columns); setFilters([]); setSort(null); setGroup(null); setPage(0); setIssuePage(0); setData(parsed)
    } catch (cause) { if (current === version.current && !abort.signal.aborted) setError(cause instanceof TabularError ? t("errors." + cause.code) : t("errors.readFailed")) }
    finally { if (current === version.current) setRunning(false) }
  }
  useEffect(() => {
    setResult(null); setRow(null); setQuerying(false)
    if (!data) return
    const abort = new AbortController()
    setQuerying(true); setError("")
    const timer = window.setTimeout(() => {
      void queryTabular(data, { filters, columns, sortColumn: sort ?? undefined, descending, groupBy: group === null ? [] : [group] }, abort.signal)
        .then((next) => { if (!abort.signal.aborted) { setResult(next); setPage(0) } })
        .catch((cause) => { if (!abort.signal.aborted) setError(cause instanceof TabularError ? t("errors." + cause.code) : t("errors.invalidQuery")) })
        .finally(() => { if (!abort.signal.aborted) setQuerying(false) })
    }, 200)
    return () => { window.clearTimeout(timer); abort.abort() }
  }, [data, filters, columns, sort, descending, group, t])
  const exported = useMemo(() => {
    if (!result) return { file: null, error: "" }
    try { return { file: new File([exportTabular(result, exportFormat)], `table-result.${exportFormat}`, { type: exportFormat === "csv" ? "text/csv;charset=utf-8" : exportFormat === "jsonl" ? "application/x-ndjson" : "application/json" }), error: "" } }
    catch { return { file: null, error: "outputLimit" } }
  }, [result, exportFormat])
  const exportFile = exported.file
  const exportUrl = useObjectUrl(exportFile)
  const pages = Math.max(1, Math.ceil((result?.rows.length ?? 0) / 50))
  const issuePages = Math.max(1, Math.ceil((data?.issues.length ?? 0) / 20))
  const columnItems = (list: string[]): Array<[string, string]> => list.map((name, index) => [String(index), name || t("emptyColumn")])
  const updateFilter = (index: number, patch: Partial<TabularFilter>) => setFilters(filters.map((filter, i) => i === index ? { ...filter, ...patch } : filter))
  const outputColumns = group === null ? columns : [group, group === "count" ? "_count" : "count"]

  return <div className="mx-auto max-w-6xl space-y-5 px-1 pb-8 sm:px-3" data-testid="tabular-panel">
    <div className="flex items-center gap-3"><Table2 className="h-6 w-6 text-md-primary" /><div><h1 className="text-xl font-semibold">{t("title")}</h1><p className="mt-1 text-sm text-md-on-surface-variant">{t("description")}</p></div></div>
    <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="min-w-0 space-y-2"><div className="flex flex-wrap items-center justify-between gap-2"><Label htmlFor="tabular-input">{t("input")}</Label><Button variant="ghost" size="sm" onClick={() => { reset(); setFile(null); setInput(SAMPLE); setFormat("jsonl") }}><FileText />{t("sample")}</Button></div><Textarea id="tabular-input" value={input} disabled={file !== null} onChange={(event) => { reset(); setInput(event.target.value) }} className="h-56 font-mono text-xs" spellCheck={false} placeholder={t("placeholder")} />{file && <div className="flex min-w-0 items-center gap-2 text-sm"><span className="min-w-0 flex-1 break-all">{file.name} · {(file.size / 1024).toFixed(1)} KB</span><Button variant="ghost" size="icon" aria-label={t("removeFile")} onClick={() => { reset(); setFile(null) }}><X /></Button></div>}</div>
      <div className="space-y-4 rounded-xl bg-md-surface-container-low p-4">
        <Choice label={t("format")} value={format} onChange={(value) => { reset(); setFormat(value as TabularFormat) }} items={[["jsonl", "JSONL / NDJSON"], ["csv", "CSV / TSV"]]} />
        {format === "csv" && <><Choice label={t("delimiter")} value={delimiter} onChange={(value) => { reset(); setDelimiter(value) }} items={[["auto", t("auto")], [",", t("comma")], ["tab", "Tab"], [";", ";"], ["|", "|"]]} /><div className="flex items-center justify-between gap-2"><Label htmlFor="tabular-header">{t("header")}</Label><Switch id="tabular-header" checked={header} onCheckedChange={(value) => { reset(); setHeader(value) }} /></div></>}
        <div className="space-y-2"><Label htmlFor="tabular-file">{t("file")}</Label><Input id="tabular-file" type="file" accept=".csv,.tsv,.jsonl,.ndjson,.log,.txt" className="text-xs" onChange={(event) => { const selected = event.target.files?.[0]; if (selected) { reset(); setFile(selected); setFormat(/\.(csv|tsv)$/i.test(selected.name) ? "csv" : "jsonl") }; event.target.value = "" }} /></div>
        <p className="text-xs leading-relaxed text-md-on-surface-variant">{t("limits")}</p>
        {running ? <Button variant="outline" onClick={cancel}><Loader2 className="animate-spin" />{t("cancel")} · {progress}%</Button> : <Button onClick={() => void run()} disabled={!file && !input.trim()}><Play />{t("parse")}</Button>}
      </div>
    </div>
    {error && <p role="alert" className="rounded-xl bg-md-error-container p-3 text-sm text-md-on-error-container">{error}</p>}
    {exported.error && <p role="alert" className="rounded-xl bg-md-error-container p-3 text-sm text-md-on-error-container">{t("errors." + exported.error)}</p>}
    {data && <>
      <div className="space-y-4 rounded-xl border border-md-outline-variant p-4">
        <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">{t("query")}</h2><Button size="sm" variant="outline" disabled={!data.columns.length || filters.length >= 50} onClick={() => setFilters([...filters, { column: data.columns[0], operator: "eq", value: "" }])}><Plus />{t("addFilter")}</Button></div>
        <p className="text-xs text-md-on-surface-variant">{t("filterHelp")}</p>
        {filters.map((filter, index) => <div className="grid items-end gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]" key={index}><Choice label={`${t("filterColumn")} ${index + 1}`} value={String(data.columns.indexOf(filter.column))} items={columnItems(data.columns)} onChange={(value) => updateFilter(index, { column: data.columns[Number(value)] })} /><Choice label={`${t("operator")} ${index + 1}`} value={filter.operator} items={OPERATORS.map((operator) => [operator, t("operators." + operator)])} onChange={(value) => updateFilter(index, { operator: value as FilterOperator })} /><div className="space-y-2"><Label htmlFor={`tabular-value-${index}`}>{t("value")}</Label><Input id={`tabular-value-${index}`} aria-label={`${t("value")} ${index + 1}`} value={filter.value ?? ""} disabled={["exists", "missing"].includes(filter.operator)} onChange={(event) => updateFilter(index, { value: event.target.value })} /></div><Button size="icon" variant="ghost" aria-label={`${t("removeFilter")} ${index + 1}`} onClick={() => setFilters(filters.filter((_, i) => i !== index))}><X /></Button></div>)}
        <div className="grid gap-3 sm:grid-cols-3"><Choice label={t("groupBy")} value={group === null ? "none" : String(data.columns.indexOf(group))} items={[["none", t("noGroup")], ...columnItems(data.columns)]} onChange={(value) => { setGroup(value === "none" ? null : data.columns[Number(value)]); setSort(null) }} /><Choice label={t("sortBy")} value={sort === null ? "none" : String(outputColumns.indexOf(sort))} items={[["none", t("sourceOrder")], ...columnItems(outputColumns)]} onChange={(value) => setSort(value === "none" ? null : outputColumns[Number(value)])} /><Choice label={t("direction")} value={descending ? "desc" : "asc"} items={[["asc", t("ascending")], ["desc", t("descending")]]} onChange={(value) => setDescending(value === "desc")} /></div>
        {group === null && <fieldset><legend className="mb-2 text-sm font-medium">{t("columns")}</legend><div className="flex max-h-36 flex-wrap gap-x-4 gap-y-2 overflow-auto">{data.columns.map((column) => <label className="flex min-w-0 max-w-full items-center gap-2 text-xs" key={column}><input type="checkbox" checked={columns.includes(column)} onChange={(event) => { setColumns(event.target.checked ? data.columns.filter((item) => item === column || columns.includes(item)) : columns.filter((item) => item !== column)); if (!event.target.checked && sort === column) setSort(null) }} /><span className="break-all">{column || t("emptyColumn")}</span></label>)}</div></fieldset>}
      </div>
      <div role="status" className="text-sm text-md-on-surface-variant">{t("summary").replace("{valid}", String(data.rows.length)).replace("{errors}", String(data.errorCount)).replace("{matched}", String(result?.matchedRows ?? "…")).replace("{rows}", String(result?.rows.length ?? "…"))}{querying && <Loader2 className="ml-2 inline h-4 w-4 animate-spin" />}</div>
      {result && <section className="min-w-0 space-y-3" aria-label={t("result")}>
        <div className="flex flex-wrap items-end justify-between gap-3"><Choice label={t("exportFormat")} value={exportFormat} items={[["json", "JSON"], ["jsonl", "JSONL"], ["csv", "CSV"]]} onChange={(value) => setExportFormat(value as typeof exportFormat)} /><div className="flex flex-wrap gap-2">{exportUrl && exportFile && <Button asChild size="sm"><a href={exportUrl} download={exportFile.name}><Download />{t("download")}</a></Button>}<SendToMenu value={result.rows} source={t("result")} /></div></div>
        <div className="overflow-x-auto rounded-xl border border-md-outline-variant"><table className="w-full text-left text-xs"><thead className="bg-md-surface-container"><tr><th className="whitespace-nowrap p-3">{group === null ? t("sourceLine") : t("firstLine")}</th>{result.columns.slice(0, 20).map((column) => <th key={column} className="min-w-28 max-w-64 break-all p-3">{column || t("emptyColumn")}</th>)}</tr></thead><tbody>{result.rows.slice(page * 50, (page + 1) * 50).map((item, index) => <tr key={index} className="border-t border-md-outline-variant"><td className="p-2"><Button variant="ghost" size="sm" aria-label={`${t("inspectRow")} ${result.lines[page * 50 + index]}`} onClick={() => setRow(item)}>{result.lines[page * 50 + index]}</Button></td>{result.columns.slice(0, 20).map((column) => <td key={column} className="max-w-64 whitespace-pre-wrap break-all p-3 font-mono">{Object.hasOwn(item, column) ? tabularCellText(item[column]).slice(0, 240) + (tabularCellText(item[column]).length > 240 ? "…" : "") : <span className="text-md-on-surface-variant">—</span>}</td>)}</tr>)}</tbody></table></div>
        {!result.rows.length && <p className="py-4 text-center text-sm text-md-on-surface-variant">{t("empty")}</p>}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-md-on-surface-variant"><span>{t("previewHelp")}</span><div className="flex items-center gap-2"><Button size="icon" variant="ghost" aria-label={t("previousPage")} disabled={page === 0} onClick={() => setPage(page - 1)}><ChevronLeft /></Button><span>{page + 1} / {pages}</span><Button size="icon" variant="ghost" aria-label={t("nextPage")} disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}><ChevronRight /></Button></div></div>
        {row && <div className="space-y-2 rounded-xl border border-md-outline-variant p-3"><div className="flex items-center justify-between"><h3 className="text-sm font-medium">{t("rowJson")}</h3><Button size="icon" variant="ghost" aria-label={t("closeRow")} onClick={() => setRow(null)}><X /></Button></div><JsonTreeView jsonText={JSON.stringify(row)} /></div>}
      </section>}
      {data.issues.length > 0 && <details className="rounded-xl bg-md-error-container p-4 text-sm text-md-on-error-container"><summary className="cursor-pointer">{t("errorsTitle")} · {data.errorCount}</summary><p className="my-3 text-xs">{t("errorsHelp")}</p><ul className="space-y-2">{data.issues.slice(issuePage * 20, (issuePage + 1) * 20).map((issue, index) => <li key={index}>{t("sourceLine")} {issue.line} · {t("issues." + issue.code)}{issue.detail ? " · " + issue.detail : ""}</li>)}</ul><div className="mt-2 flex items-center justify-end gap-2"><Button size="icon" variant="ghost" aria-label={t("previousErrors")} disabled={issuePage === 0} onClick={() => setIssuePage(issuePage - 1)}><ChevronLeft /></Button><span>{issuePage + 1} / {issuePages}</span><Button size="icon" variant="ghost" aria-label={t("nextErrors")} disabled={issuePage + 1 >= issuePages} onClick={() => setIssuePage(issuePage + 1)}><ChevronRight /></Button></div></details>}
    </>}
  </div>
}
