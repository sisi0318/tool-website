"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { ChevronLeft, ChevronRight, Database, Download, FileUp, Loader2, Play, Square, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { BinaryFileResult } from "@/components/tools/binary-file-result"
import { SendToMenu } from "@/components/tools/send-to-menu"
import { JsonTreeView } from "@/components/json-tree-view"
import { useTranslations } from "@/hooks/use-translations"
import { useObjectUrl } from "@/hooks/use-object-url"
import { base64ToBytes } from "@/lib/binary"
import { createBinaryFile } from "@/lib/file-signature"
import { exportSqliteResult, quoteSqliteIdentifier, sqliteCellText, SqliteToolError, type SqliteCell, type SqliteInfo, type SqliteObject, type SqliteQueryResult } from "@/lib/sqlite-tools"
import { SqliteWorkerClient } from "@/lib/sqlite-worker-client"

export default function SqlitePage() {
  const t = useTranslations("sqliteTools")
  const client = useRef<SqliteWorkerClient | null>(null)
  const fileInput = useRef<HTMLInputElement | null>(null)
  const controller = useRef<AbortController | null>(null)
  const version = useRef(0)
  const [file, setFile] = useState<File | null>(null)
  const [info, setInfo] = useState<SqliteInfo | null>(null)
  const [selected, setSelected] = useState<SqliteObject | null>(null)
  const [schema, setSchema] = useState<SqliteQueryResult | null>(null)
  const [schemaPage, setSchemaPage] = useState(0)
  const [sql, setSql] = useState("")
  const [limit, setLimit] = useState("1000")
  const [query, setQuery] = useState("")
  const [objectPage, setObjectPage] = useState(0)
  const [result, setResult] = useState<SqliteQueryResult | null>(null)
  const [page, setPage] = useState(0)
  const [row, setRow] = useState<SqliteCell[] | null>(null)
  const [binary, setBinary] = useState<File | null>(null)
  const [format, setFormat] = useState<"json" | "csv">("json")
  const [running, setRunning] = useState(false)
  const [error, setError] = useState("")
  useEffect(() => () => { version.current++; controller.current?.abort(); client.current?.close() }, [])
  const cancel = () => { version.current++; controller.current?.abort(); controller.current = null; setRunning(false) }
  const clearResult = () => { setResult(null); setRow(null); setBinary(null); setPage(0) }
  const start = () => { cancel(); const abort = new AbortController(); controller.current = abort; setRunning(true); setError(""); clearResult(); return { signal: abort.signal, id: version.current } }
  const failure = (cause: unknown, id: number, signal: AbortSignal) => { if (id === version.current && !signal.aborted) setError(cause instanceof SqliteToolError ? [t("errors." + cause.code), cause.detail].filter(Boolean).join(" · ") : t("errors.loadFailed")) }
  const finish = (id: number) => { if (id === version.current) { setRunning(false); controller.current = null } }
  const readObject = async (database: SqliteWorkerClient, object: SqliteObject, id: number, signal: AbortSignal) => {
    setSelected(object); setSchema(null); setSchemaPage(0)
    const table = object.type === "view" ? object.name : object.tableName
    const statement = "SELECT * FROM " + quoteSqliteIdentifier(table)
    setSql(statement)
    const columns = await database.columns(table, signal)
    if (id !== version.current) return
    setSchema(columns)
    const rows = await database.query(statement, Number(limit), signal)
    if (id === version.current) setResult(rows)
  }
  const open = async (source: File | null) => {
    const { id, signal } = start()
    client.current?.close(); const database = new SqliteWorkerClient(source); client.current = database
    setFile(source); setInfo(null); setSelected(null); setSchema(null); setQuery(""); setObjectPage(0); setSql("")
    try {
      const next = await database.open(signal)
      if (id !== version.current) return
      setInfo(next); setFile(database.sourceFile)
      const first = next.objects.find((object) => object.type === "table" && !object.name.startsWith("sqlite_")) ?? next.objects.find((object) => object.type === "view")
      if (first) await readObject(database, first, id, signal)
      else setSql("SELECT type, name FROM sqlite_schema ORDER BY name")
    } catch (cause) { failure(cause, id, signal) }
    finally { finish(id) }
  }
  const selectObject = async (object: SqliteObject) => { if (!client.current) return; const { id, signal } = start(); try { await readObject(client.current, object, id, signal) } catch (cause) { failure(cause, id, signal) } finally { finish(id) } }
  const run = async () => { if (!client.current) return; const { id, signal } = start(); try { const next = await client.current.query(sql, Number(limit), signal); if (id === version.current) setResult(next) } catch (cause) { failure(cause, id, signal) } finally { finish(id) } }
  const close = () => { cancel(); client.current?.close(); client.current = null; setFile(null); setInfo(null); setSelected(null); setSchema(null); setSql(""); setError(""); clearResult() }
  const objects = useMemo(() => info?.objects.filter((object) => (object.name + " " + object.type).toLowerCase().includes(query.toLowerCase())) ?? [], [info, query])
  const objectPages = Math.max(1, Math.ceil(objects.length / 100)), pages = Math.max(1, Math.ceil((result?.rows.length ?? 0) / 100))
  const outputFile = useMemo(() => result ? new File([exportSqliteResult(result, format)], `sqlite-result.${format}`, { type: format === "csv" ? "text/csv;charset=utf-8" : "application/json" }) : null, [result, format])
  const outputUrl = useObjectUrl(outputFile)
  const inspectBinary = (value: string, rowIndex: number, columnIndex: number) => { setRow(null); setBinary(createBinaryFile(new Uint8Array(base64ToBytes(value)), `row-${rowIndex + 1}-column-${columnIndex + 1}.bin`)) }
  const cell = (value: SqliteCell, rowIndex: number, columnIndex: number) => {
    if (value === null) return <span className="italic text-md-on-surface-variant">NULL</span>
    if (typeof value === "object" && ("$binary" in value || "$textBytes" in value)) { const data = "$binary" in value ? value.$binary : value.$textBytes; const bytes = data.length * 3 / 4 - (data.endsWith("==") ? 2 : data.endsWith("=") ? 1 : 0); return <Button size="sm" variant="outline" className="h-8 font-mono text-xs" onClick={() => inspectBinary(data, rowIndex, columnIndex)}>{"$binary" in value ? "BLOB" : "TEXT bytes"} · {bytes} B</Button> }
    const text = sqliteCellText(value)
    return <span className="whitespace-pre-wrap break-all">{text.slice(0, 240)}{text.length > 240 ? "…" : ""}</span>
  }

  return <div className="mx-auto max-w-7xl space-y-5 px-1 pb-8 sm:px-3">
    <div className="flex items-center gap-3"><Database className="h-7 w-7 shrink-0 text-md-primary" /><div><h1 className="text-2xl font-semibold">{t("title")}</h1><p className="mt-1 text-sm text-md-on-surface-variant">{t("description")}</p></div></div>
    <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-md-outline-variant p-4">
      <div className="min-w-0 flex-1 basis-64 space-y-2">
        <Label htmlFor="sqlite-file-trigger">{t("chooseFile")}</Label>
        <div className="flex h-12 items-center gap-3 rounded-[--md-sys-shape-corner-extra-small] bg-md-surface-container-highest px-3">
          <input ref={fileInput} type="file" className="hidden" accept=".sqlite,.sqlite3,.db,.db3,.s3db" onChange={(event) => { const selectedFile = event.target.files?.[0]; event.target.value = ""; if (selectedFile) void open(selectedFile) }} />
          <Button id="sqlite-file-trigger" type="button" variant="secondary" size="sm" className="h-8 shrink-0 px-3 leading-5" onClick={() => fileInput.current?.click()}><FileUp />{t("selectFile")}</Button>
          <span className="min-w-0 truncate text-sm leading-5 text-md-on-surface-variant" title={file?.name}>{file?.name ?? t("noFile")}</span>
        </div>
      </div>
      <Button variant="outline" className="h-12" onClick={() => void open(null)}>{t("sample")}</Button>
      {file && <Button variant="ghost" className="h-12" onClick={close}><X />{t("close")}</Button>}
    </div>
    {file && <p className="break-all font-mono text-xs text-md-on-surface-variant">{file.name} · {(file.size / 1024 / 1024).toFixed(2)} MB{info && ` · SQLite ${info.version} · ${info.pageCount} × ${info.pageSize} B · user_version ${info.userVersion}`}</p>}
    {info?.wal && <p className="rounded-xl bg-md-tertiary-container p-3 text-sm text-md-on-tertiary-container">{t("walNotice")}</p>}
    {error && <p role="alert" className="break-words rounded-xl bg-md-error-container p-3 text-sm text-md-on-error-container">{error}</p>}
    <div className="grid min-w-0 gap-4 lg:grid-cols-[15rem_minmax(0,1fr)]">
      <aside className="min-w-0 space-y-3 rounded-2xl border border-md-outline-variant p-4"><h2 className="font-semibold">{t("objects")} · {info?.objects.length ?? 0}</h2><Input aria-label={t("search")} placeholder={t("search")} value={query} onChange={(event) => { setQuery(event.target.value); setObjectPage(0) }} disabled={!info} /><div className="max-h-80 space-y-1 overflow-auto lg:max-h-[36rem]">{objects.slice(objectPage * 100, (objectPage + 1) * 100).map((object) => <Button key={object.type + ":" + object.name} variant={selected?.name === object.name && selected.type === object.type ? "secondary" : "ghost"} className="h-auto w-full justify-start gap-2 px-2 py-2 text-left" onClick={() => void selectObject(object)}><span className="shrink-0 text-[10px] text-md-on-surface-variant">{t("types." + object.type)}</span><span className="min-w-0 break-all font-mono text-xs">{object.name}</span></Button>)}</div>{objectPages > 1 && <div className="flex items-center justify-between text-xs"><Button size="icon" variant="ghost" aria-label={t("previousObjects")} disabled={objectPage === 0} onClick={() => setObjectPage(objectPage - 1)}><ChevronLeft /></Button><span>{objectPage + 1} / {objectPages}</span><Button size="icon" variant="ghost" aria-label={t("nextObjects")} disabled={objectPage + 1 >= objectPages} onClick={() => setObjectPage(objectPage + 1)}><ChevronRight /></Button></div>}{info?.truncated && <p className="text-xs text-md-on-surface-variant">{t("objectLimit")}</p>}</aside>
      <div className="min-w-0 space-y-4">
        {selected && <details className="min-w-0 rounded-2xl border border-md-outline-variant p-4"><summary className="cursor-pointer break-all text-sm font-semibold">{t("schema")} · {selected.name}{schema && ` · ${schema.rows.length} ${t("columns")}`}</summary><pre className="my-3 max-h-48 overflow-auto whitespace-pre-wrap break-all rounded-xl bg-md-surface-container-low p-3 font-mono text-xs">{selected.sql || "—"}</pre>{schema && <><div className="overflow-x-auto"><table className="w-full text-left text-xs [&_th]:align-middle [&_td]:align-middle"><thead><tr>{[t("columnName"), t("columnType"), "NOT NULL", "PK", t("defaultValue")].map((label) => <th className="p-2" key={label}>{label}</th>)}</tr></thead><tbody>{schema.rows.slice(schemaPage * 100, (schemaPage + 1) * 100).map((item, index) => <tr className="border-t border-md-outline-variant" key={index}><td className="p-2 font-mono">{String(item[1])}</td><td className="p-2 font-mono">{String(item[2] || "—")}</td><td className="p-2">{Number(item[3]) ? "✓" : "—"}</td><td className="p-2">{Number(item[5]) || "—"}</td><td className="max-w-60 break-all p-2 font-mono">{item[4] === null ? "—" : sqliteCellText(item[4])}</td></tr>)}</tbody></table></div>{schema.rows.length > 100 && <div className="flex items-center justify-end gap-2 text-xs"><Button size="icon" variant="ghost" aria-label={t("previousColumns")} disabled={schemaPage === 0} onClick={() => setSchemaPage(schemaPage - 1)}><ChevronLeft /></Button><span>{schemaPage + 1} / {Math.ceil(schema.rows.length / 100)}</span><Button size="icon" variant="ghost" aria-label={t("nextColumns")} disabled={(schemaPage + 1) * 100 >= schema.rows.length} onClick={() => setSchemaPage(schemaPage + 1)}><ChevronRight /></Button></div>}</>}</details>}
        <section className="space-y-3 rounded-2xl border border-md-outline-variant p-4"><Label htmlFor="sqlite-query">{t("query")}</Label><Textarea id="sqlite-query" value={sql} onChange={(event) => { cancel(); clearResult(); setError(""); setSql(event.target.value) }} disabled={!info} placeholder="SELECT * FROM events WHERE status >= 500" className="min-h-40 font-mono text-sm" spellCheck={false} /><div className="flex flex-wrap items-center gap-3"><div className="flex items-center gap-2 text-xs"><Label>{t("rowLimit")}</Label><Select value={limit} disabled={running} onValueChange={(value) => { cancel(); clearResult(); setLimit(value) }}><SelectTrigger aria-label={t("rowLimit")} className="w-28"><SelectValue /></SelectTrigger><SelectContent>{["100", "1000", "10000"].map((value) => <SelectItem value={value} key={value}>{value}</SelectItem>)}</SelectContent></Select></div>{running ? <Button variant="outline" onClick={cancel}><Square />{t("cancel")}</Button> : <Button onClick={() => void run()} disabled={!info || !sql.trim()}><Play />{t("run")}</Button>}{running && <span role="status" className="flex items-center gap-2 text-xs text-md-on-surface-variant"><Loader2 className="h-4 w-4 animate-spin" />{t("working")}</span>}</div><p className="text-xs leading-relaxed text-md-on-surface-variant">{t("limits")}</p></section>
        {result && <section className="min-w-0 space-y-3"><div className="flex flex-wrap items-center justify-between gap-3"><p role="status" className="text-sm text-md-on-surface-variant">{result.rows.length} {t("rows")} · {result.columns.length} {t("columns")} · {result.durationMs} ms</p><div className="flex flex-wrap items-center gap-2"><Select value={format} onValueChange={(value) => setFormat(value as "json" | "csv")}><SelectTrigger aria-label={t("exportFormat")} className="w-24"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="json">JSON</SelectItem><SelectItem value="csv">CSV</SelectItem></SelectContent></Select>{outputUrl && outputFile && <Button asChild variant="outline" size="sm"><a href={outputUrl} download={outputFile.name}><Download />{t("download")}</a></Button>}<SendToMenu value={{ columns: result.columns, rows: result.rows }} source={t("result")} /></div></div>{result.truncated && <p className="rounded-xl bg-md-tertiary-container p-3 text-xs text-md-on-tertiary-container">{t("truncated").replaceAll("{count}", String(result.rowLimit))}</p>}<div className="overflow-x-auto rounded-xl border border-md-outline-variant"><table className="w-full text-left text-xs [&_th]:align-middle [&_td]:align-middle"><thead className="bg-md-surface-container"><tr><th className="p-3">#</th>{result.columns.slice(0, 20).map((name, index) => <th className="min-w-28 max-w-60 break-all p-3 font-mono" key={index}>{name}</th>)}</tr></thead><tbody>{result.rows.slice(page * 100, (page + 1) * 100).map((item, index) => <tr className="border-t border-md-outline-variant" key={index}><td className="p-2"><Button variant="ghost" size="sm" className="h-8 min-w-8 px-2 font-mono text-xs" aria-label={`${t("inspectRow")} ${page * 100 + index + 1}`} onClick={() => { setBinary(null); setRow(item) }}>{page * 100 + index + 1}</Button></td>{item.slice(0, 20).map((value, column) => <td className="max-w-60 p-3 font-mono" key={column}>{cell(value, page * 100 + index, column)}</td>)}</tr>)}</tbody></table></div><div className="flex flex-wrap items-center justify-between gap-2 text-xs text-md-on-surface-variant"><span>{t("previewHelp")}</span><div className="flex items-center gap-2"><Button size="icon" variant="ghost" aria-label={t("previousPage")} disabled={page === 0} onClick={() => setPage(page - 1)}><ChevronLeft /></Button><span>{page + 1} / {pages}</span><Button size="icon" variant="ghost" aria-label={t("nextPage")} disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}><ChevronRight /></Button></div></div><p className="text-xs text-md-on-surface-variant">{t("exportHelp")}</p>{row && <JsonTreeView jsonText={JSON.stringify({ columns: result.columns, values: row })} />}{binary && <BinaryFileResult file={binary} source={t("blob")} />}</section>}
      </div>
    </div>
  </div>
}
