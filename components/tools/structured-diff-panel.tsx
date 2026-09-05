"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { ArrowRightLeft, ChevronLeft, ChevronRight, Copy, Download, FileText, Loader2, Play, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useTranslations } from "@/hooks/use-translations"
import { copyTextToClipboard } from "@/lib/clipboard"
import { downloadBlob } from "@/lib/object-url"
import { cn } from "@/lib/utils"
import { compareStructuredText, StructuredDiffError, type StructuredDiffResult, type StructuredFormat, type StructuredValue } from "@/lib/structured-diff"

const PAGE_SIZE = 50
const selectClass = "h-10 rounded-lg border border-md-outline bg-md-surface px-3 text-sm text-md-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-md-primary"

function displayValue(value: StructuredValue | undefined): string {
  if (value === undefined) return "—"
  const text = JSON.stringify(value, null, 2)
  return text.length > 3000 ? `${text.slice(0, 3000)}…` : text
}

export function StructuredDiffPanel({ left, right, onLeftChange, onRightChange, active = true }: {
  left: string; right: string; onLeftChange: (value: string) => void; onRightChange: (value: string) => void; active?: boolean
}) {
  const t = useTranslations("diff.structured")
  const [format, setFormat] = useState<StructuredFormat>("json")
  const [ignoreText, setIgnoreText] = useState("")
  const [arrayMode, setArrayMode] = useState("index")
  const [arrayKey, setArrayKey] = useState("id")
  const [result, setResult] = useState<StructuredDiffResult | null>(null)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const [copyStatus, setCopyStatus] = useState("")
  const [page, setPage] = useState(0)
  const request = useRef(0)

  const run = useCallback(async () => {
    const version = ++request.current
    setError("")
    setResult(null)
    setCopyStatus("")
    if (!active || !left.trim() || !right.trim()) return
    if (arrayMode === "key" && !arrayKey.trim()) { setError(t("keyRequired")); return }
    setBusy(true)
    try {
      const compared = await compareStructuredText(left, right, format, { ignorePaths: ignoreText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean), arrayKey: arrayMode === "key" ? arrayKey : undefined })
      if (version !== request.current) return
      setResult(compared)
      setPage(0)
    } catch (error) {
      if (version !== request.current) return
      setError(error instanceof StructuredDiffError ? [error.side ? t(error.side) : "", t(`errors.${error.code}`), error.path, error.detail].filter(Boolean).join(" · ") : t("errors.invalidInput"))
    } finally {
      if (version === request.current) setBusy(false)
    }
  }, [active, left, right, format, ignoreText, arrayMode, arrayKey, t])

  useEffect(() => {
    request.current += 1
    setResult(null)
    setError("")
    setBusy(false)
    setCopyStatus("")
    const timeout = active && left.length + right.length < 100_000 ? window.setTimeout(() => void run(), 300) : null
    return () => { request.current += 1; if (timeout !== null) window.clearTimeout(timeout) }
  }, [active, left, right, run])

  const sample = () => {
    setFormat("json")
    setArrayMode("key")
    setArrayKey("id")
    setIgnoreText("**.updatedAt")
    onLeftChange(JSON.stringify({ users: [{ id: "a", name: "Ada", role: "reader" }, { id: "b", name: "Bob", role: "editor" }], updatedAt: "2026-09-01" }, null, 2))
    onRightChange(JSON.stringify({ updatedAt: "2026-09-05", users: [{ id: "b", name: "Bob", role: "editor" }, { id: "a", name: "Ada", role: "admin" }] }, null, 2))
  }
  const report = result ? JSON.stringify(result, null, 2) : ""
  const pages = Math.max(1, Math.ceil((result?.changes.length ?? 0) / PAGE_SIZE))
  const copy = async (value: string) => setCopyStatus(await copyTextToClipboard(value) ? t("copied") : t("copyFailed"))

  return <div className="space-y-5" data-testid="structured-diff">
    <p className="text-sm text-md-on-surface-variant">{t("help")}</p>
    <div className="grid gap-4 rounded-xl border border-md-outline-variant bg-md-surface-container-low p-4 md:grid-cols-2">
      <div className="space-y-3">
        <label className="flex flex-wrap items-center gap-3 text-sm">{t("format")}<select aria-label={t("format")} value={format} onChange={(event) => setFormat(event.target.value as StructuredFormat)} className={selectClass}><option value="json">JSON</option><option value="yaml">YAML</option></select></label>
        <label className="flex flex-wrap items-center gap-3 text-sm">{t("arrayMode")}<select aria-label={t("arrayMode")} value={arrayMode} onChange={(event) => setArrayMode(event.target.value)} className={selectClass}><option value="index">{t("byIndex")}</option><option value="key">{t("byKey")}</option></select></label>
        {arrayMode === "key" && <div className="flex flex-wrap items-center gap-3"><Label htmlFor="diff-array-key">{t("arrayKey")}</Label><Input id="diff-array-key" className="w-40 font-mono" value={arrayKey} onChange={(event) => setArrayKey(event.target.value)} placeholder="id" /></div>}
        <p className="text-xs text-md-on-surface-variant">{t("arrayHelp")}</p>
      </div>
      <div className="space-y-2"><Label htmlFor="diff-ignore-paths">{t("ignorePaths")}</Label><Textarea id="diff-ignore-paths" className="min-h-20 font-mono text-xs" value={ignoreText} onChange={(event) => setIgnoreText(event.target.value)} placeholder={"metadata.updatedAt\nusers.*.lastSeen\n**.timestamp"} /><p className="text-xs text-md-on-surface-variant">{t("ignoreHelp")}</p></div>
    </div>
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" size="sm" onClick={sample}><FileText />{t("sample")}</Button>
      <Button variant="outline" size="sm" onClick={() => { onLeftChange(right); onRightChange(left) }}><ArrowRightLeft />{t("swap")}</Button>
      <Button variant="outline" size="sm" onClick={() => { onLeftChange(""); onRightChange("") }}><Trash2 />{t("clear")}</Button>
      <Button size="sm" onClick={() => void run()} disabled={busy || !left.trim() || !right.trim()}>{busy ? <Loader2 className="animate-spin" /> : <Play />}{t("compare")}</Button>
    </div>
    <div className="grid min-w-0 gap-4 md:grid-cols-2">
      <div className="min-w-0 space-y-2"><Label htmlFor="structured-left">{t("left")}</Label><Textarea id="structured-left" value={left} onChange={(event) => onLeftChange(event.target.value)} className="h-64 font-mono text-sm" spellCheck={false} placeholder={t("leftPlaceholder")} /></div>
      <div className="min-w-0 space-y-2"><Label htmlFor="structured-right">{t("right")}</Label><Textarea id="structured-right" value={right} onChange={(event) => onRightChange(event.target.value)} className="h-64 font-mono text-sm" spellCheck={false} placeholder={t("rightPlaceholder")} /></div>
    </div>
    {left.length + right.length >= 100_000 && <p className="text-sm text-md-on-surface-variant">{t("manualHelp")}</p>}
    {error && <div role="alert" className="break-words rounded-xl bg-md-error-container p-4 text-sm text-md-on-error-container">{error}</div>}
    {result ? <section aria-label={t("result")} className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="status" className="text-sm font-medium">{result.equal ? t("equal") : `${result.changes.length} ${t("changes")} · ${t("added")} ${result.added} · ${t("removed")} ${result.removed} · ${t("changed")} ${result.changed}`}</div>
        <div className="flex flex-wrap items-center gap-2"><span role="status" className="text-xs text-md-primary">{copyStatus}</span><Button variant="outline" size="sm" onClick={() => void copy(report)}><Copy />{t("copyReport")}</Button><Button variant="outline" size="sm" onClick={() => downloadBlob(new Blob([report], { type: "application/json" }), "structured-diff.json")}><Download />{t("downloadReport")}</Button></div>
      </div>
      {result.changes.length > 0 && <>
        <div className="overflow-x-auto rounded-xl border border-md-outline-variant">
          <table className="w-full min-w-[38rem] table-fixed text-left text-sm">
            <thead className="bg-md-surface-container"><tr><th className="w-2/5 p-3">{t("path")}</th><th className="p-3">{t("oldValue")}</th><th className="p-3">{t("newValue")}</th></tr></thead>
            <tbody>{result.changes.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map((change, index) => <tr className="border-t border-md-outline-variant align-top" key={index}>
              <td className="space-y-2 p-3"><span className={cn("inline-block rounded px-2 py-0.5 text-xs", change.type === "added" ? "bg-md-primary-container text-md-on-primary-container" : change.type === "removed" ? "bg-md-error-container text-md-on-error-container" : "bg-md-tertiary-container text-md-on-tertiary-container")}>{t(change.type)}</span><div className="flex items-start gap-1"><code className="min-w-0 flex-1 break-all">{change.path}</code><Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" aria-label={`${t("copyPath")} ${change.path}`} onClick={() => void copy(change.path)}><Copy /></Button></div>{change.oldPath !== change.newPath && <p className="break-all font-mono text-xs text-md-on-surface-variant">{change.oldPath ?? "—"} → {change.newPath ?? "—"}</p>}</td>
              <td className="p-3"><pre className="max-h-60 overflow-auto whitespace-pre-wrap break-all text-xs">{displayValue(change.oldValue)}</pre></td><td className="p-3"><pre className="max-h-60 overflow-auto whitespace-pre-wrap break-all text-xs">{displayValue(change.newValue)}</pre></td>
            </tr>)}</tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-md-on-surface-variant"><span>{t("reportHelp")}</span><div className="flex items-center gap-2"><Button variant="ghost" size="icon" aria-label={t("previousPage")} disabled={page === 0} onClick={() => setPage(page - 1)}><ChevronLeft /></Button><span>{page + 1} / {pages}</span><Button variant="ghost" size="icon" aria-label={t("nextPage")} disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}><ChevronRight /></Button></div></div>
      </>}
    </section> : !error && <p className="py-5 text-center text-sm text-md-on-surface-variant">{busy ? t("comparing") : t("empty")}</p>}
  </div>
}
