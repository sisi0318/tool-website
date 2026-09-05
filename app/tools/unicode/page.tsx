"use client"

import { useMemo, useState } from "react"
import { CaseSensitive, ChevronLeft, ChevronRight, Download } from "lucide-react"
import { UtilityWorkbench } from "@/components/tools/utility-workbench"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useTranslations } from "@/hooks/use-translations"
import { useObjectUrl } from "@/hooks/use-object-url"
import { NORMALIZATION_FORMS, processUnicode, UnicodeError, type UnicodeCharacter, type UnicodeOperation } from "@/lib/unicode-tools"

const SAMPLE = "Café / Cafe\u0301\nＡ①ﬃ / A1ffi\nA B\u00A0C\u200BD\u200DE\u202EF\u202C\n👩‍💻 🇨🇳 中\t文\uFE0F"
function glyph(entry: UnicodeCharacter) {
  if (entry.flags.some((flag) => ["whitespace", "control", "format", "ignorable", "surrogate"].includes(flag))) return `[${entry.label || entry.codePoint}]`
  return entry.flags.includes("mark") ? "◌" + entry.character : entry.character
}

export default function UnicodePage() {
  const t = useTranslations("unicodeTools")
  const [input, setInput] = useState("")
  const [operation, setOperation] = useState<UnicodeOperation>("inspect")
  const [result, setResult] = useState<ReturnType<typeof processUnicode> | null>(null)
  const [error, setError] = useState("")
  const [query, setQuery] = useState("")
  const [flaggedOnly, setFlaggedOnly] = useState(false)
  const [page, setPage] = useState(0)
  const reset = () => { setResult(null); setError(""); setPage(0) }
  const rows = useMemo(() => {
    const search = query.toLowerCase()
    return result?.report.characters.filter((entry) => (!flaggedOnly || entry.flags.length > 0) && (!search || [entry.character, entry.codePoint, entry.escape, entry.label, entry.category, t("categories." + entry.category), ...entry.flags, ...entry.flags.map((flag) => t("flags." + flag))].some((value) => value.toLowerCase().includes(search)))) ?? []
  }, [result, query, flaggedOnly, t])
  const pages = Math.max(1, Math.ceil(rows.length / 100))
  const file = useMemo(() => result ? new File([result.output], operation === "inspect" ? "unicode-report.json" : `unicode-${operation}.txt`, { type: operation === "inspect" ? "application/json" : "text/plain;charset=utf-8" }) : null, [result, operation])
  const url = useObjectUrl(file)
  const run = () => {
    try { setResult(processUnicode(input, operation)); setError(""); setPage(0) }
    catch (cause) { setResult(null); setError(cause instanceof UnicodeError ? t("errors." + cause.code) : t("failed")) }
  }
  return <UtilityWorkbench title={t("title")} description={t("description")} icon={<CaseSensitive className="h-6 w-6" />} input={input} output={result?.output ?? ""} operation={operation} operations={[{ value: "inspect", label: t("inspect") }, ...NORMALIZATION_FORMS.map((form) => ({ value: form, label: form + " · " + t("forms." + form) }))]} onInputChange={(value) => { reset(); setInput(value) }} onOperationChange={(value) => { reset(); setOperation(value as UnicodeOperation) }} onRun={run} onClear={() => { reset(); setInput("") }} onSample={() => { reset(); setInput(SAMPLE); setOperation("inspect") }} allowWhitespaceInput error={error} inputPlaceholder={t("placeholder")} controls={<p className="text-xs leading-relaxed text-md-on-surface-variant">{t("normalizationHelp")}</p>} result={result ? <div className="min-w-0 space-y-4">
    <div className="flex flex-wrap gap-2 text-xs">{[[t("codePoints"), result.report.codePoints], ["UTF-16", result.report.utf16Units], ["UTF-8", result.report.utf8Bytes ?? "—"], [t("graphemes"), result.report.graphemes ?? "—"], [t("flagged"), result.report.flagged]].map(([label, value]) => <span key={label} className="rounded-full bg-md-secondary-container px-3 py-1.5 text-md-on-secondary-container">{label} · {value}</span>)}</div>
    {!result.report.wellFormed && <p role="alert" className="rounded-xl bg-md-error-container p-3 text-xs text-md-on-error-container">{t("illFormedHelp")}</p>}
    {operation !== "inspect" && <><p role="status" className="text-sm text-md-primary">{result.changed ? t("changed") : t("unchanged")}</p><Textarea aria-label={t("normalizedOutput")} readOnly value={result.output} className="min-h-24 font-mono text-sm" /></>}
    <div className="flex flex-wrap items-center justify-between gap-2"><div className="flex flex-wrap gap-2 text-xs">{NORMALIZATION_FORMS.map((form) => <span key={form} className={result.report.normalized[form] ? "text-md-primary" : "text-md-on-surface-variant"}>{form} · {result.report.normalized[form] ? t("yes") : t("no")}</span>)}</div>{url && file && <Button asChild variant="outline" size="sm"><a href={url} download={file.name}><Download />{t("download")}</a></Button>}</div>
    <div className="flex flex-wrap items-center gap-3"><Input aria-label={t("search")} placeholder={t("searchPlaceholder")} value={query} onChange={(event) => { setQuery(event.target.value); setPage(0) }} className="min-w-0 flex-1 basis-44" /><label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={flaggedOnly} onChange={(event) => { setFlaggedOnly(event.target.checked); setPage(0) }} />{t("flaggedOnly")}</label></div>
    <div className="overflow-x-auto rounded-xl border border-md-outline-variant"><table className="w-full min-w-[40rem] text-left text-xs"><thead className="bg-md-surface-container"><tr>{[t("character"), t("codePoint"), "UTF-8", t("offset"), t("graphemeIndex"), t("properties")].map((label) => <th className="p-3" key={label}>{label}</th>)}</tr></thead><tbody>{rows.slice(page * 100, (page + 1) * 100).map((entry) => <tr className="border-t border-md-outline-variant align-top" key={entry.index}><td className="max-w-32 break-all p-3 font-mono"><bdi>{glyph(entry)}</bdi></td><td className="whitespace-nowrap p-3 font-mono"><div>{entry.codePoint}</div><span className="text-md-on-surface-variant">{entry.escape}</span></td><td className="whitespace-nowrap p-3 font-mono">{entry.utf8 ?? t("invalid")}</td><td className="p-3 font-mono"><div>{entry.utf16Offset}</div><span className="whitespace-nowrap text-md-on-surface-variant">{entry.utf16.join(" ")}</span></td><td className="p-3 font-mono">{entry.grapheme === null ? "—" : entry.grapheme + 1}</td><td className="min-w-36 space-y-1 p-3"><div>{t("categories." + entry.category)}</div><div className="flex flex-wrap gap-1">{entry.flags.map((flag) => <span key={flag} className="rounded bg-md-tertiary-container px-1.5 py-0.5 text-md-on-tertiary-container">{t("flags." + flag)}</span>)}</div>{entry.label && <div className="font-mono text-md-on-surface-variant">{entry.label}</div>}</td></tr>)}</tbody></table></div>
    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-md-on-surface-variant"><span>{rows.length} {t("items")}</span><div className="flex items-center gap-2"><Button variant="ghost" size="icon" aria-label={t("previousPage")} disabled={page === 0} onClick={() => setPage(page - 1)}><ChevronLeft /></Button><span>{page + 1} / {pages}</span><Button variant="ghost" size="icon" aria-label={t("nextPage")} disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}><ChevronRight /></Button></div></div>
    <p className="text-xs leading-relaxed text-md-on-surface-variant">{t("offsetHelp")}</p>
  </div> : undefined} />
}
