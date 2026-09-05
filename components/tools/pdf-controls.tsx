"use client"

import { useRef, useState } from "react"
import { ChevronLeft, ChevronRight, Download, FileUp, Loader2, Square } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { SendToMenu } from "@/components/tools/send-to-menu"
import { useObjectUrl } from "@/hooks/use-object-url"
import { useTranslations } from "@/hooks/use-translations"
import type { PdfNumbering, PdfProgress } from "@/lib/pdf-shared"
import type { PdfFileResult } from "@/lib/pdf-worker-client"

export function PdfFilePicker({ label, accept, onFiles, disabled = false }: { label: string; accept: string; onFiles: (files: File[]) => void; disabled?: boolean }) {
  const input = useRef<HTMLInputElement | null>(null)
  return <><input ref={input} type="file" className="hidden" multiple accept={accept} onChange={(event) => { const files = Array.from(event.target.files ?? []); event.target.value = ""; if (files.length) onFiles(files) }} /><Button type="button" variant="outline" className="h-11" disabled={disabled} onClick={() => input.current?.click()}><FileUp />{label}</Button></>
}
export function PdfChoice({ label, value, onChange, items }: { label: string; value: string; onChange: (value: string) => void; items: Array<[string, string]> }) {
  return <div className="min-w-0 space-y-2"><Label>{label}</Label><Select value={value} onValueChange={onChange}><SelectTrigger aria-label={label}><SelectValue /></SelectTrigger><SelectContent>{items.map(([key, name]) => <SelectItem key={key} value={key}>{name}</SelectItem>)}</SelectContent></Select></div>
}
export function PdfNumberControls({ value, onChange, id }: { value: PdfNumbering; onChange: (value: PdfNumbering) => void; id: string }) {
  const t = useTranslations("pdfTools")
  return <div className="space-y-3"><div className="flex items-center justify-between gap-3"><Label htmlFor={id + "-numbers"}>{t("addNumbers")}</Label><Switch id={id + "-numbers"} checked={value.enabled} onCheckedChange={(enabled) => onChange({ ...value, enabled })} /></div>{value.enabled && <div className="grid gap-3 sm:grid-cols-2"><PdfChoice label={t("numberPosition")} value={value.position ?? "bottom-center"} items={[["bottom-center", t("bottomCenter")], ["bottom-right", t("bottomRight")], ["top-right", t("topRight")]]} onChange={(position) => onChange({ ...value, position: position as PdfNumbering["position"] })} /><PdfChoice label={t("numberFormat")} value={value.total === false ? "page" : "total"} items={[["total", "1 / N"], ["page", "1"]]} onChange={(format) => onChange({ ...value, total: format === "total" })} /><div className="space-y-2"><Label htmlFor={id + "-size"}>{t("fontSize")}</Label><Input id={id + "-size"} type="number" min={4} max={72} value={value.fontSize ?? 10} onChange={(event) => onChange({ ...value, fontSize: Number(event.target.value) })} /></div><div className="space-y-2"><Label htmlFor={id + "-margin"}>{t("numberMargin")}</Label><Input id={id + "-margin"} type="number" min={0} max={144} value={value.margin ?? 18} onChange={(event) => onChange({ ...value, margin: Number(event.target.value) })} /></div></div>}</div>
}
export function PdfTaskStatus({ running, progress, error, onCancel }: { running: boolean; progress: PdfProgress | null; error: string; onCancel: () => void }) {
  const t = useTranslations("pdfTools")
  return <>{running && <div className="flex flex-wrap items-center gap-3"><span role="status" className="flex items-center gap-2 text-sm text-md-on-surface-variant"><Loader2 className="h-4 w-4 animate-spin" />{progress ? `${t("stages." + progress.stage)} ${progress.completed} / ${progress.total}` : t("working")}</span><Button variant="outline" size="sm" onClick={onCancel}><Square />{t("cancel")}</Button></div>}{error && <p role="alert" className="break-words rounded-xl bg-md-error-container p-3 text-sm text-md-on-error-container">{error}</p>}</>
}
function PdfDownload({ file, label }: { file: File; label: string }) {
  const url = useObjectUrl(file)
  return url ? <Button asChild size="sm" variant="outline"><a href={url} download={file.name}><Download />{label}</a></Button> : <Button size="sm" disabled>{label}</Button>
}
export function PdfResults({ result, onPreview }: { result: PdfFileResult; onPreview: (index: number) => void }) {
  const t = useTranslations("pdfTools"), [page, setPage] = useState(0)
  return <section className="space-y-3 rounded-2xl border border-md-outline-variant p-4"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold">{t("result")} · {result.pages} {t("pages")}</h2><div className="flex flex-wrap gap-2"><PdfDownload file={result.download} label={result.files.length > 1 ? t("downloadZip") : t("downloadPdf")} /><SendToMenu value={result.download} source={t("result")} /></div></div>{result.retainedForms && <p className="text-xs text-md-primary">{t("retainedForms")}</p>}{result.flattenedForms && <p className="text-xs text-md-on-surface-variant">{t("flattenedForms")}</p>}{(result.droppedOutlines || result.changedSignatures) && <p className="rounded-xl bg-md-tertiary-container p-3 text-xs text-md-on-tertiary-container">{[result.droppedOutlines ? t("droppedOutlines") : "", result.changedSignatures ? t("changedSignatures") : ""].filter(Boolean).join(" ")}</p>}<div className="space-y-2">{result.files.slice(page * 20, (page + 1) * 20).map((output, index) => <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-md-surface-container-low p-3" key={output.file.name}><Button variant="ghost" size="sm" className="h-auto min-w-0 whitespace-normal break-all text-left font-mono" onClick={() => onPreview(page * 20 + index)}>{output.file.name} · {output.pages} {t("pages")}</Button><div className="flex items-center gap-2"><span className="text-xs text-md-on-surface-variant">{(output.file.size / 1024).toFixed(1)} KB</span>{result.files.length > 1 && <PdfDownload file={output.file} label={t("downloadPdf")} />}</div></div>)}</div>{result.files.length > 20 && <div className="flex items-center justify-end gap-2 text-xs"><Button size="icon" variant="ghost" aria-label={t("previousResults")} disabled={page === 0} onClick={() => setPage(page - 1)}><ChevronLeft /></Button><span>{page + 1} / {Math.ceil(result.files.length / 20)}</span><Button size="icon" variant="ghost" aria-label={t("nextResults")} disabled={(page + 1) * 20 >= result.files.length} onClick={() => setPage(page + 1)}><ChevronRight /></Button></div>}</section>
}
