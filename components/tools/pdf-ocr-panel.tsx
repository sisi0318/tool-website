"use client"

import { useEffect, useId, useMemo, useRef, useState } from "react"
import { ChevronLeft, ChevronRight, Copy, Download, FileUp, Loader2, ScanText, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import PdfPreview from "./pdf-preview"
import { SendToMenu } from "./send-to-menu"
import { useObjectUrl } from "@/hooks/use-object-url"
import { useToast } from "@/hooks/use-toast"
import { useTranslations } from "@/hooks/use-translations"
import { OcrError, OCR_LOW_CONFIDENCE, type OcrOptions } from "@/lib/ocr-shared"
import { PDF_LIMITS, PdfToolError, parsePdfSelection, type PdfInfo } from "@/lib/pdf-shared"
import { inspectPdfFiles } from "@/lib/pdf-worker-client"
import { recognizePdf, exportSearchablePdf, sampleOcrPdf } from "@/lib/pdf-ocr-client"
import { PDF_OCR_LIMITS, pdfOcrJson, pdfOcrText, type PdfOcrPage, type PdfOcrProgress } from "@/lib/pdf-ocr-shared"

const frame = "rounded-2xl border border-md-outline-variant bg-md-surface-container-lowest p-4 sm:p-5"
export default function PdfOcrPanel({ isActive = true, headingLevel = "h2" }: { isActive?: boolean; headingLevel?: "h1" | "h2" }) {
  const Heading = headingLevel
  const t = useTranslations("pdfOcr"), pt = useTranslations("pdfTools"), ot = useTranslations("ocrTools"), { toast } = useToast(), id = useId()
  const [file, setFile] = useState<File | null>(null), [info, setInfo] = useState<PdfInfo | null>(null)
  const [selection, setSelection] = useState(""), [dpi, setDpi] = useState(200), [rotation, setRotation] = useState<OcrOptions["rotation"]>(0)
  const [pages, setPages] = useState<PdfOcrPage[]>([]), [index, setIndex] = useState(0), [lineIndex, setLineIndex] = useState<number | null>(null)
  const [busy, setBusy] = useState(false), [progress, setProgress] = useState<PdfOcrProgress | null>(null), [error, setError] = useState("")
  const [output, setOutput] = useState<Blob | null>(null), [onlyLow, setOnlyLow] = useState(false), [zoom, setZoom] = useState("100")
  const input = useRef<HTMLInputElement>(null), active = useRef<AbortController | null>(null), version = useRef(0)
  const previewUrl = useObjectUrl(pages[index]?.preview), outputUrl = useObjectUrl(output)
  const text = useMemo(() => pdfOcrText(pages), [pages])
  const textBlob = useMemo(() => pages.length ? new Blob([text], { type: "text/plain;charset=utf-8" }) : null, [text, pages.length])
  const jsonBlob = useMemo(() => pages.length ? new Blob([pdfOcrJson(pages)], { type: "application/json" }) : null, [pages])
  const textUrl = useObjectUrl(textBlob), jsonUrl = useObjectUrl(jsonBlob)
  const baseName = file?.name.replace(/\.[^.]*$/, "").replace(/[\\/\u0000-\u001f]/g, "_").slice(0, 100) || "ocr"
  const cancel = () => { version.current++; active.current?.abort(); active.current = null; setBusy(false); setProgress(null) }
  const resetResult = () => { setPages([]); setOutput(null); setIndex(0); setLineIndex(null); setError("") }
  useEffect(() => () => { version.current++; active.current?.abort() }, [])
  useEffect(() => { if (!isActive) { version.current++; active.current?.abort(); active.current = null; setBusy(false); setProgress(null) } }, [isActive])
  const errorText = (cause: unknown) => cause instanceof OcrError ? ot(`error_${cause.code}`) : cause instanceof PdfToolError ? ["pageLimit", "imageLimit", "outputLimit"].includes(cause.code) ? t(`error_${cause.code}`) : pt(`errors.${cause.code}`) : pt("errors.invalidPdf")
  const task = async <T,>(work: (signal: AbortSignal, update: (value: PdfOcrProgress) => void) => Promise<T>, commit: (value: T) => void) => {
    cancel(); const job = version.current, controller = new AbortController(); active.current = controller; setBusy(true); setError("")
    try { const result = await work(controller.signal, value => { if (job === version.current) setProgress(value) }); if (job === version.current) commit(result) }
    catch (cause) { if (job === version.current) setError(errorText(cause)) }
    finally { if (job === version.current) { setBusy(false); setProgress(null); active.current = null } }
  }
  const choose = (next: File | null) => {
    cancel(); resetResult(); setFile(null); setInfo(null); setSelection("")
    if (!next) return
    if (!next.size || next.size > PDF_LIMITS.inputBytes) { setError(pt("errors.inputLimit")); return }
    void task(async signal => { const [details] = await inspectPdfFiles([next], { signal }); if (details.unsupportedForm) throw new PdfToolError("formStructure"); return details }, details => { setFile(next); setInfo(details) })
  }
  const sample = () => {
    resetResult(); setFile(null); setInfo(null); setSelection("")
    void task(async signal => { const next = await sampleOcrPdf(); const [details] = await inspectPdfFiles([next], { signal }); return { next, details } }, ({ next, details }) => { setFile(next); setInfo(details) })
  }
  let count = 0, selectionError = ""
  if (info) { try { count = parsePdfSelection(selection, info.pages.length).length; if (count > PDF_OCR_LIMITS.pages) selectionError = t("error_pageLimit") } catch { selectionError = pt("errors.invalidSelection") } }
  const run = () => {
    if (!file || selectionError) return
    resetResult()
    void task((signal, onProgress) => recognizePdf(file, { selection, dpi, rotation }, { signal, onProgress }), setPages)
  }
  const generate = () => void task((signal, update) => { update({ stage: "writing", completed: 0, total: pages.length }); return exportSearchablePdf(pages, signal) }, setOutput)
  const editLine = (line: number, value: string) => { setOutput(null); setPages(previous => previous.map((page, i) => i === index ? { ...page, lines: page.lines.map((item, n) => n === line ? { ...item, text: value } : item) } : page)) }
  const selectLine = (line: number) => { setOnlyLow(false); setLineIndex(line); requestAnimationFrame(() => document.getElementById(`${id}-line-${line}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" })) }
  const current = pages[index], lowCount = current?.lines.filter(line => line.score < OCR_LOW_CONFIDENCE).length ?? 0
  return <div className="space-y-5">
    <div><Heading className="flex items-center gap-2 text-xl font-semibold"><ScanText className="h-5 w-5 text-md-primary" />{t("title")}</Heading><p className="mt-2 max-w-4xl text-sm leading-6 text-md-on-surface-variant">{t("description")}</p></div>
    <section className={`${frame} space-y-4`} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); if (event.dataTransfer.files[0]) choose(event.dataTransfer.files[0]) }}>
      <input ref={input} type="file" className="hidden" aria-label={t("choose")} accept="application/pdf,.pdf" onChange={event => { choose(event.target.files?.[0] ?? null); event.target.value = "" }} />
      <div className="flex flex-wrap items-center gap-3"><Button variant="outline" className="h-11" onClick={() => input.current?.click()}><FileUp />{t("choose")}</Button><Button size="sm" variant="ghost" disabled={busy} onClick={sample}>{t("sample")}</Button>{file && <><span className="order-last min-w-0 basis-full break-all text-sm sm:order-none sm:basis-0 sm:flex-1">{file.name} · {info?.pages.length} {pt("pages")}</span><Button aria-label={pt("clear")} variant="ghost" size="icon" onClick={() => choose(null)}><X /></Button></>}</div>
      <p className="text-xs leading-5 text-md-on-surface-variant">{t("limits")}</p>
      <div className="grid items-start gap-4 sm:grid-cols-[minmax(0,1fr)_140px_160px]">
        <div className="space-y-2"><Label htmlFor={`${id}-pages`}>{t("selection")}</Label><Input id={`${id}-pages`} value={selection} disabled={busy} placeholder="1-3,5" onChange={e => { setSelection(e.target.value); resetResult() }} /><p className="text-xs text-md-on-surface-variant">{t("selectionHint")}{info && !selectionError ? ` · ${count} ${pt("pages")}` : ""}</p></div>
        <div className="space-y-2"><Label htmlFor={`${id}-dpi`}>{t("resolution")}</Label><select id={`${id}-dpi`} className="h-10 w-full rounded-lg border border-md-outline-variant bg-md-surface px-3 text-sm" disabled={busy} value={dpi} onChange={e => { setDpi(Number(e.target.value)); resetResult() }}>{[144, 200, 300].map(value => <option key={value} value={value}>{value} DPI</option>)}</select></div>
        <div className="space-y-2"><Label htmlFor={`${id}-rotation`}>{ot("rotation")}</Label><select id={`${id}-rotation`} className="h-10 w-full rounded-lg border border-md-outline-variant bg-md-surface px-3 text-sm" disabled={busy} value={rotation} onChange={e => { setRotation(Number(e.target.value) as OcrOptions["rotation"]); resetResult() }}>{[0, 90, 180, 270].map(value => <option key={value} value={value}>{value === 0 ? ot("rotationNone") : `${value}°`}</option>)}</select></div>
      </div>
      {selectionError && <p role="alert" className="text-sm text-md-error">{selectionError}</p>}
      <p className="text-xs leading-5 text-md-on-surface-variant">{t("exportHint")}</p>
      <div className="flex flex-wrap items-center gap-3"><Button disabled={!file || busy || !!selectionError} onClick={run}>{busy ? <Loader2 className="animate-spin" /> : <ScanText />}{t("recognize")}</Button>{busy && <Button variant="outline" onClick={() => { cancel(); setError(pt("errors.cancelled")) }}>{pt("cancel")}</Button>}<span className="text-xs text-md-on-surface-variant">{ot("downloadHint")}</span></div>
      {busy && <div role="status" aria-live="polite" className="space-y-2 text-sm"><p>{t(`stage_${progress?.stage ?? "reading"}`)}{progress?.sourcePage ? ` · ${t("sourcePage").replace("{page}", String(progress.sourcePage))} · ${progress.completed + 1} / ${progress.total}` : ""}</p>{progress?.ocr && <p className="text-xs text-md-on-surface-variant">{ot(`stage_${progress.ocr.stage}`)}{progress.ocr.total ? ` · ${Math.min(100, Math.round((progress.ocr.completed ?? 0) / progress.ocr.total * 100))}%` : ""}</p>}</div>}
      {error && <p role="alert" className="rounded-xl bg-md-error-container p-3 text-sm text-md-on-error-container">{error}</p>}
    </section>
    {current ? <>
      <section className={`${frame} flex flex-wrap items-center justify-between gap-3`}><div className="flex items-center gap-2"><Button size="icon" variant="ghost" aria-label={pt("previousPreview")} disabled={index === 0} onClick={() => { setIndex(index - 1); setLineIndex(null) }}><ChevronLeft /></Button><span className="text-sm">{index + 1} / {pages.length} · {t("sourcePage").replace("{page}", String(current.sourcePage))}</span><Button size="icon" variant="ghost" aria-label={pt("nextPreview")} disabled={index === pages.length - 1} onClick={() => { setIndex(index + 1); setLineIndex(null) }}><ChevronRight /></Button></div><span className="text-xs text-md-on-surface-variant">{current.pixelWidth} × {current.pixelHeight} · {current.lines.length} {ot("lines")}</span></section>
      <div className="grid items-start gap-5 lg:grid-cols-2">
        <section className={`${frame} min-w-0 space-y-3`}><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">{ot("preview")}</h3><select aria-label={ot("zoom")} className="rounded-lg border border-md-outline-variant bg-md-surface px-2 py-1 text-xs" value={zoom} onChange={e => setZoom(e.target.value)}><option value="100">{ot("fit")}</option><option value="200">200%</option><option value="400">400%</option></select></div><div className="max-h-[560px] overflow-auto rounded-lg bg-white">{previewUrl && <div className="relative" style={{ width: `${zoom}%` }}><img src={previewUrl} alt={t("sourcePage").replace("{page}", String(current.sourcePage))} className="block h-auto w-full" /><svg viewBox={`0 0 ${current.pixelWidth} ${current.pixelHeight}`} className="absolute inset-0 h-full w-full">{current.lines.map((line, n) => <polygon key={n} role="button" tabIndex={0} aria-label={`${n + 1}. ${line.text}`} aria-pressed={n === lineIndex} points={line.poly.map(p => p.join(",")).join(" ")} fill={n === lineIndex ? "#2563eb30" : "#2582460c"} stroke={n === lineIndex ? "#2563eb" : line.score < OCR_LOW_CONFIDENCE ? "#d97706" : "#258246"} vectorEffect="non-scaling-stroke" strokeWidth={n === lineIndex ? 2 : 1} className="cursor-pointer focus:stroke-blue-600 focus:stroke-[3px]" onClick={() => selectLine(n)} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); selectLine(n) } }} />)}</svg></div>}</div></section>
        <section className={`${frame} min-w-0 space-y-3`}><div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-semibold">{ot("review")}</h3><label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={onlyLow} onChange={e => setOnlyLow(e.target.checked)} />{ot("onlyLow")} ({lowCount})</label></div><p className="text-xs leading-5 text-md-on-surface-variant">{t("reviewHint")}</p><div className="max-h-[520px] space-y-3 overflow-auto">{current.lines.map((line, n) => onlyLow && line.score >= OCR_LOW_CONFIDENCE ? null : <div key={n} className={`space-y-1 rounded-lg border p-2 ${lineIndex === n ? "border-md-primary" : "border-md-outline-variant"}`}><div className="flex justify-between text-xs"><Label htmlFor={`${id}-line-${n}`}>{n + 1}</Label><span className={line.score < OCR_LOW_CONFIDENCE ? "text-amber-700 dark:text-amber-300" : "text-md-on-surface-variant"}>{(line.score * 100).toFixed(1)}%</span></div><Textarea id={`${id}-line-${n}`} value={line.text} disabled={busy} maxLength={2000} rows={1} className="min-h-10 resize-y text-sm" onFocus={() => setLineIndex(n)} onChange={e => editLine(n, e.target.value.replace(/[\r\n\u0000]/g, " "))} /></div>)}{!current.lines.length && <p className="text-sm text-md-on-surface-variant">{t("noText")}</p>}{onlyLow && !lowCount && !!current.lines.length && <p className="text-sm text-md-on-surface-variant">{ot("noLow")}</p>}</div></section>
      </div>
      <section className={`${frame} space-y-4`}><h3 className="font-semibold">{t("allText")}</h3><Textarea aria-label={t("allText")} value={text} readOnly rows={6} className="font-mono text-sm" /><div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" disabled={!text} onClick={() => void navigator.clipboard.writeText(text).then(() => toast({ description: ot("copied") })).catch(() => toast({ description: ot("copyFailed"), variant: "destructive" }))}><Copy />{ot("copy")}</Button>{textUrl && <Button asChild size="sm" variant="outline"><a href={textUrl} download={`${baseName}.txt`}><Download />TXT</a></Button>}{jsonUrl && <Button asChild size="sm" variant="outline"><a href={jsonUrl} download={`${baseName}.json`}><Download />JSON</a></Button>}{text && <SendToMenu value={text} source={t("title")} />}<Button size="sm" disabled={busy} onClick={generate}>{t("generate")}</Button>{outputUrl && <Button asChild size="sm" variant="outline"><a href={outputUrl} download={`${baseName}-searchable.pdf`}><Download />{t("download")}</a></Button>}</div>{output && <p role="status" className="text-sm text-md-primary">{t("ready")} · {(output.size / 1048576).toFixed(2)} MB</p>}</section>
    </> : file && <PdfPreview file={isActive ? file : null} rotation={rotation} />}
  </div>
}
