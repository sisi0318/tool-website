"use client"

import { useMemo, useState } from "react"
import { ArrowUpLeft, ChevronLeft, ChevronRight, Download, ListFilter } from "lucide-react"
import { UtilityWorkbench } from "@/components/tools/utility-workbench"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useTranslations } from "@/hooks/use-translations"
import { useObjectUrl } from "@/hooks/use-object-url"
import { processTextLines, SET_LINE_OPERATIONS, TextLineError, type TextLineOperation, type TextLineOptions, type TextLineResult } from "@/lib/text-line-tools"

const OPERATIONS: TextLineOperation[] = ["dedupe", "clean", "sort", "affix", "columns", ...SET_LINE_OPERATIONS]
export default function TextLinesPage() {
  const t = useTranslations("textLinesTools")
  const [input, setInput] = useState("")
  const [operation, setOperation] = useState<TextLineOperation>("dedupe")
  const [options, setOptions] = useState<TextLineOptions>({ trim: false, removeEmpty: true, ignoreCase: false, sortMode: "lexical", descending: false, prefix: "", suffix: "", delimiter: "\\t", outputDelimiter: "\\t", columns: "1", missingColumn: "empty", newline: "lf", trailingNewline: false, other: "" })
  const [result, setResult] = useState<TextLineResult | null>(null)
  const [error, setError] = useState("")
  const [page, setPage] = useState(0)
  const reset = () => { setResult(null); setError(""); setPage(0) }
  const configure = (patch: Partial<TextLineOptions>) => { reset(); setOptions((current) => ({ ...current, ...patch })) }
  const isSet = SET_LINE_OPERATIONS.includes(operation)
  const choice = (key: keyof TextLineOptions, items: Array<[string, string]>) => <div className="space-y-2"><Label>{t(key)}</Label><Select value={String(options[key] ?? "")} onValueChange={(value) => configure({ [key]: value })}><SelectTrigger aria-label={t(key)}><SelectValue /></SelectTrigger><SelectContent>{items.map(([value, label]) => <SelectItem value={value} key={value}>{label}</SelectItem>)}</SelectContent></Select></div>
  const toggle = (key: keyof TextLineOptions) => <div className="flex items-center justify-between gap-2 rounded-xl bg-md-surface-container-low px-3 py-2"><Label htmlFor={`text-lines-${key}`}>{t(key)}</Label><Switch id={`text-lines-${key}`} checked={Boolean(options[key])} onCheckedChange={(value) => configure({ [key]: value })} /></div>
  const field = (key: keyof TextLineOptions, placeholder?: string) => <div className="min-w-0 space-y-2"><Label htmlFor={`text-lines-${key}`}>{t(key)}</Label><Input id={`text-lines-${key}`} value={String(options[key] ?? "")} placeholder={placeholder} onChange={(event) => configure({ [key]: event.target.value })} className="font-mono text-sm" /></div>
  const file = useMemo(() => result ? new File([result.output], "text-lines.txt", { type: "text/plain;charset=utf-8" }) : null, [result])
  const url = useObjectUrl(file)
  const pages = Math.max(1, Math.ceil((result?.lines.length ?? 0) / 100))
  const run = () => {
    try { setResult(processTextLines(input, { ...options, operation, delimiter: options.delimiter === "\\t" ? "\t" : options.delimiter, outputDelimiter: options.outputDelimiter === "\\t" ? "\t" : options.outputDelimiter })); setError(""); setPage(0) }
    catch (cause) { setResult(null); setError(cause instanceof TextLineError ? t("errors." + cause.code) + (cause.line ? ` · ${t("sourceLine")} ${cause.line}` : "") : t("failed")) }
  }
  const sample = () => {
    reset()
    if (operation === "columns") { setInput("id\tname\tstatus\n001\tAda\t500\n002\tLinus\t200"); setOptions((current) => ({ ...current, delimiter: "\\t", whitespaceDelimiter: false, columns: "2,1", outputDelimiter: "," })) }
    else if (operation === "sort") setInput(options.sortMode === "numeric" ? "9007199254740993\n2\n9007199254740992\n1.00000000000000000001\n1" : "file10\nfile2\nfile1")
    else { setInput("apple\nbanana\napple\nCherry\n\n banana "); setOptions((current) => ({ ...current, other: "banana\ncherry\ndate" })) }
  }
  return <UtilityWorkbench title={t("title")} description={t("description")} icon={<ListFilter className="h-6 w-6" />} input={input} output={result?.output ?? ""} operation={operation} operations={OPERATIONS.map((value) => ({ value, label: t("operations." + value) }))} onInputChange={(value) => { reset(); setInput(value) }} onOperationChange={(value) => { reset(); setOperation(value as TextLineOperation) }} onRun={run} onClear={() => { reset(); setInput(""); setOptions((current) => ({ ...current, other: "" })) }} onSample={sample} canRun={input.length > 0 || (isSet && Boolean(options.other?.length))} error={error} inputLabel={isSet ? t("textA") : undefined} inputPlaceholder={t("placeholder")} additionalInput={isSet && <div className="space-y-2"><Label htmlFor="text-lines-other">{t("textB")}</Label><Textarea id="text-lines-other" value={options.other ?? ""} onChange={(event) => configure({ other: event.target.value })} className="min-h-40 font-mono text-sm" /><p className="text-xs leading-relaxed text-md-on-surface-variant">{t("setHelp")}</p></div>} controls={<div className="space-y-4">

    <div className="grid gap-2 sm:grid-cols-2">{toggle("trim")}{toggle("removeEmpty")}{["dedupe", "sort", ...SET_LINE_OPERATIONS].includes(operation) && toggle("ignoreCase")}</div>
    {operation === "sort" && <div className="space-y-3">{choice("sortMode", [["lexical", t("lexical")], ["natural", t("natural")], ["numeric", t("numeric")]])}{toggle("descending")}<p className="text-xs leading-relaxed text-md-on-surface-variant">{t("sortHelp")}</p></div>}
    {operation === "affix" && <div className="grid gap-3 sm:grid-cols-2">{field("prefix", "[")}{field("suffix", "]")}</div>}
    {operation === "columns" && <div className="space-y-3">{toggle("whitespaceDelimiter")}<div className="grid gap-3 sm:grid-cols-2">{!options.whitespaceDelimiter && field("delimiter", "\\t")}{field("columns", "3,1-2")}{field("outputDelimiter", "\\t")}{choice("missingColumn", [["empty", t("emptyCell")], ["error", t("reportError")]])}</div><p className="text-xs leading-relaxed text-md-on-surface-variant">{t("columnHelp")}</p></div>}
    <div className="grid items-end gap-3 sm:grid-cols-2">{choice("newline", [["lf", "LF"], ["crlf", "CRLF"]])}{toggle("trailingNewline")}</div><p className="text-xs text-md-on-surface-variant">{t("limits")}</p>
  </div>} result={result ? <div className="space-y-4">
    <div role="status" className="text-sm text-md-on-surface-variant">{t("summary").replace("{input}", String(result.inputLines + result.otherLines)).replace("{output}", String(result.lines.length)).replace("{empty}", String(result.emptyRemoved)).replace("{duplicates}", String(result.duplicatesRemoved))}</div>
    <div className="flex flex-wrap gap-2">{url && file && <Button size="sm" variant="outline" asChild><a href={url} download={file.name}><Download />{t("download")}</a></Button>}<Button size="sm" variant="outline" onClick={() => { const output = result.output; reset(); setInput(output) }}><ArrowUpLeft />{t("useResult")}</Button></div>
    <div className="max-h-[32rem] overflow-auto rounded-xl border border-md-outline-variant bg-md-surface-container-low p-3 font-mono text-xs leading-6">{result.lines.slice(page * 100, (page + 1) * 100).map((line, index) => <div key={index} className="flex gap-3"><span className="w-12 shrink-0 select-none text-right text-md-on-surface-variant">{page * 100 + index + 1}</span><span className="min-w-0 whitespace-pre-wrap break-all">{line ? line.slice(0, 1000) + (line.length > 1000 ? "…" : "") : <span className="text-md-on-surface-variant">{t("emptyLine")}</span>}</span></div>)}{!result.lines.length && <p className="py-6 text-center text-md-on-surface-variant">{t("emptyResult")}</p>}</div>
    <div className="flex items-center justify-end gap-2 text-xs"><Button variant="ghost" size="icon" aria-label={t("previousPage")} disabled={page === 0} onClick={() => setPage(page - 1)}><ChevronLeft /></Button><span>{page + 1} / {pages}</span><Button variant="ghost" size="icon" aria-label={t("nextPage")} disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}><ChevronRight /></Button></div><p className="text-xs leading-relaxed text-md-on-surface-variant">{t("previewHelp")}</p>
  </div> : undefined} />
}
