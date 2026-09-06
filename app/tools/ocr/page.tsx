"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Copy, Download, ImagePlus, Loader2, ScanText, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { SendToMenu } from "@/components/tools/send-to-menu"
import { useObjectUrl } from "@/hooks/use-object-url"
import { useToast } from "@/hooks/use-toast"
import { useTranslations } from "@/hooks/use-translations"
import { DEFAULT_OCR_OPTIONS, OCR_LIMITS, OCR_LOW_CONFIDENCE, OcrError, ocrExport, ocrFileName, ocrImageHeader, type OcrOptions, type OcrProgress, type OcrResult } from "@/lib/ocr-shared"
import { recognizeImage } from "@/lib/ocr-worker-client"
import { createOcrSample, type OcrSample } from "@/lib/ocr-samples"

const frame = "rounded-2xl border border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container-lowest)]"
const muted = "text-[var(--md-sys-color-on-surface-variant)]"
export default function OcrPage() {
  const t = useTranslations("ocrTools"), { toast } = useToast()
  const [file, setFile] = useState<File | null>(null), [validated, setValidated] = useState<File | null>(null)
  const [options, setOptions] = useState<OcrOptions>(DEFAULT_OCR_OPTIONS), [result, setResult] = useState<OcrResult | null>(null)
  const [text, setText] = useState(""), [error, setError] = useState("")
  const [progress, setProgress] = useState<OcrProgress | null>(null), [sampleLoading, setSampleLoading] = useState(false)
  const [selected, setSelected] = useState<number | null>(null), [showBoxes, setShowBoxes] = useState(true), [onlyLow, setOnlyLow] = useState(false), [zoom, setZoom] = useState("100")
  const inputRef = useRef<HTMLInputElement>(null), active = useRef<AbortController | null>(null), version = useRef(0)
  const sourceUrl = useObjectUrl(validated === file ? file : null), previewUrl = useObjectUrl(result?.preview)
  const inputUrl = file && validated === file ? sourceUrl : null
  const textBlob = useMemo(() => result ? new Blob([text], { type: "text/plain;charset=utf-8" }) : null, [result, text])
  const jsonBlob = useMemo(() => result ? new Blob([ocrExport(result, text)], { type: "application/json" }) : null, [result, text])
  const textUrl = useObjectUrl(textBlob), jsonUrl = useObjectUrl(jsonBlob)
  const busy = progress !== null, lowCount = result?.lines.filter(line => line.score < OCR_LOW_CONFIDENCE).length ?? 0
  const invalidate = () => { version.current++; active.current?.abort(); active.current = null; setProgress(null); return version.current }
  const clearResult = () => { setResult(null); setText(""); setSelected(null); setError("") }
  const replaceFile = (next: File | null) => {
    clearResult(); setValidated(null); setZoom("100")
    if (next && (!next.size || next.size > OCR_LIMITS.fileBytes)) { setFile(null); setError("fileLimit"); return }
    setFile(next)
  }
  const choose = (next: File | null) => { invalidate(); setSampleLoading(false); replaceFile(next) }
  useEffect(() => () => { version.current++; active.current?.abort() }, [])
  useEffect(() => {
    if (!file) return
    let current = true
    void file.arrayBuffer().then(buffer => { ocrImageHeader(new Uint8Array(buffer)); if (current) setValidated(file) })
      .catch(cause => { if (current) setError(cause instanceof OcrError ? cause.code : "decode") })
    return () => { current = false }
  }, [file])
  const example = async (kind: OcrSample) => {
    const id = invalidate(); setSampleLoading(true); clearResult()
    try { const next = await createOcrSample(kind); if (version.current === id) replaceFile(next) }
    catch { if (version.current === id) setError("decode") }
    finally { if (version.current === id) setSampleLoading(false) }
  }
  const run = async () => {
    if (!file || validated !== file) return
    const id = invalidate(), controller = new AbortController(); active.current = controller
    clearResult(); setProgress({ stage: "reading" })
    try {
      const next = await recognizeImage(file, options, { signal: controller.signal, onProgress: value => { if (version.current === id) setProgress(value) } })
      if (version.current === id) { setResult(next); setText(next.text) }
    } catch (cause) { if (version.current === id) setError(cause instanceof OcrError ? cause.code : "engine") }
    finally { if (version.current === id) { setProgress(null); active.current = null } }
  }
  const copy = async () => { try { await navigator.clipboard.writeText(text); toast({ description: t("copied") }) } catch { toast({ description: t("copyFailed"), variant: "destructive" }) } }
  const update = (next: OcrOptions) => { invalidate(); setOptions(next); clearResult() }
  const selectLine = (id: number) => { setSelected(id); document.getElementById(`ocr-line-${id}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" }) }
  return <div className="container mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6" onPaste={event => {
    const image = Array.from(event.clipboardData.items).find(item => item.kind === "file" && item.type.startsWith("image/"))?.getAsFile()
    if (image) { event.preventDefault(); choose(image) }
  }}>
    <header className="space-y-3"><h1 className="flex items-center gap-3 text-2xl font-bold sm:text-3xl"><ScanText className="h-7 w-7 text-[var(--md-sys-color-primary)]" />{t("title")}</h1><p className={`max-w-3xl text-sm leading-6 ${muted}`}>{t("description")}</p><div className="flex flex-wrap gap-2 text-xs"><span className="rounded-full bg-[var(--md-sys-color-primary-container)] px-3 py-1 text-[var(--md-sys-color-on-primary-container)]">{t("local")}</span><span className={`px-2 py-1 ${muted}`}>PaddleOCR · PP-OCRv6</span></div></header>
    <section className={`${frame} space-y-4 p-5`} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); if (event.dataTransfer.files[0]) choose(event.dataTransfer.files[0]) }}>
      <input ref={inputRef} type="file" className="hidden" aria-label={t("chooseFile")} accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp" onChange={event => { choose(event.target.files?.[0] ?? null); event.target.value = "" }} />
      <div className="flex flex-wrap items-center gap-3"><Button className="h-12" onClick={() => inputRef.current?.click()}><ImagePlus className="h-4 w-4" />{t("chooseFile")}</Button><span className={`order-last min-w-0 basis-full break-words text-sm sm:order-none sm:basis-0 sm:flex-1 ${muted}`}>{file ? `${file.name} · ${(file.size / 1048576).toFixed(2)} MB` : t("fileHint")}</span>{file && <Button variant="ghost" size="icon" aria-label={t("clear")} onClick={() => choose(null)}><X className="h-4 w-4" /></Button>}</div>
      <div className="flex flex-wrap items-center gap-2"><span className={`text-xs ${muted}`}>{t("sample")}</span>{(["document", "small", "dark", "long"] as const).map(kind => <Button key={kind} variant="outline" size="sm" disabled={sampleLoading} onClick={() => void example(kind)}>{t(`sample_${kind}`)}</Button>)}</div>
      <p className={`text-xs leading-5 ${muted}`}>{t("limits")}</p>
    </section>
    <section className={`${frame} space-y-4 p-5`}>
      <div className="flex flex-wrap items-end gap-5"><div className="w-44 space-y-2"><Label htmlFor="ocr-rotation">{t("rotation")}</Label><Select value={String(options.rotation)} onValueChange={value => update({ ...options, rotation: Number(value) as OcrOptions["rotation"] })} disabled={busy}><SelectTrigger id="ocr-rotation"><SelectValue /></SelectTrigger><SelectContent>{[0, 90, 180, 270].map(value => <SelectItem key={value} value={String(value)}>{value === 0 ? t("rotationNone") : `${value}°`}</SelectItem>)}</SelectContent></Select></div><label className="flex min-h-10 cursor-pointer items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-[var(--md-sys-color-primary)]" checked={options.enhanceSmallText} disabled={busy} onChange={event => update({ ...options, enhanceSmallText: event.target.checked })} />{t("enhance")}</label></div>
      <p className={`text-xs leading-5 ${muted}`}>{t("accuracyHint")}</p>
      <div className="flex flex-wrap items-center gap-3"><Button disabled={!file || file !== validated || busy || sampleLoading} onClick={() => void run()}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanText className="h-4 w-4" />}{busy ? t("working") : t("recognize")}</Button>{busy && <Button variant="outline" onClick={() => { invalidate(); setError("cancelled") }}>{t("cancel")}</Button>}<span className={`text-xs ${muted}`}>{t("downloadHint")}</span></div>
      {progress && <div role="status" aria-live="polite" className="space-y-2"><p className="text-sm">{t(`stage_${progress.stage}`)}{progress.total && progress.stage === "recognizing" ? ` · ${progress.completed! + 1} / ${progress.total}` : progress.total ? ` · ${Math.min(100, Math.round(progress.completed! / progress.total * 100))}%` : ""}</p>{progress.total && <progress aria-label={t(`stage_${progress.stage}`)} className="h-2 w-full accent-[var(--md-sys-color-primary)]" max={progress.total} value={progress.completed ?? 0} />}</div>}
      {error && <p role="alert" className="rounded-xl bg-[var(--md-sys-color-error-container)] px-4 py-3 text-sm text-[var(--md-sys-color-on-error-container)]">{t(`error_${error}`)}</p>}
    </section>
    <div className="grid items-start gap-5 lg:grid-cols-2">
      <section className={`${frame} min-w-0 overflow-hidden`}><div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--md-sys-color-outline-variant)] p-4"><h2 className="font-semibold">{t("preview")}</h2><div className="flex items-center gap-3"><label className="flex cursor-pointer items-center gap-2 text-xs"><input type="checkbox" checked={showBoxes} onChange={e => setShowBoxes(e.target.checked)} />{t("boxes")}</label><select aria-label={t("zoom")} value={zoom} onChange={e => setZoom(e.target.value)} className="rounded-lg border border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface)] px-2 py-1 text-xs"><option value="100">{t("fit")}</option><option value="200">200%</option><option value="400">400%</option></select></div></div>
        <div className="max-h-[560px] min-h-64 overflow-auto bg-[var(--md-sys-color-surface-container)]">{(result ? previewUrl : inputUrl) ? <div className="relative" style={{ width: `${zoom}%` }}><img src={(result ? previewUrl : inputUrl) ?? undefined} alt={t("previewAlt")} className="block h-auto w-full" draggable={false} />{result && showBoxes && <svg className="absolute inset-0 h-full w-full" viewBox={`0 0 ${result.info.width} ${result.info.height}`} aria-label={t("boxes")}>
          {result.lines.map(line => <polygon key={line.id} role="button" tabIndex={0} aria-label={`${line.id + 1}. ${line.text}`} aria-pressed={selected === line.id} points={line.poly.map(p => p.join(",")).join(" ")} vectorEffect="non-scaling-stroke" strokeWidth={selected === line.id ? 2.5 : 1} stroke={selected === line.id ? "#2563eb" : line.score < OCR_LOW_CONFIDENCE ? "#d97706" : "#258246"} fill={selected === line.id ? "#2563eb30" : "#2582460c"} className="cursor-pointer outline-none focus:stroke-blue-600 focus:stroke-[3px]" onClick={() => selectLine(line.id)} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); selectLine(line.id) } }} />)}
        </svg>}</div> : <div className={`flex min-h-64 items-center justify-center px-6 text-center text-sm ${muted}`}>{t("inputEmpty")}</div>}</div>
        {result && <p className={`border-t border-[var(--md-sys-color-outline-variant)] px-4 py-3 text-xs leading-5 ${muted}`}>{result.info.width} × {result.info.height} · {result.lines.length} {t("lines")} · {(result.info.elapsedMs / 1000).toFixed(1)} s{result.info.tiles > 1 ? ` · ${result.info.tiles} ${t("tiles")}` : ""}{result.info.animated && ` · ${t("firstFrame")}`}</p>}
      </section>
      <section className={`${frame} min-w-0 space-y-4 p-4`}><div className="flex flex-wrap items-center justify-between gap-3"><Label htmlFor="ocr-output" className="text-base font-semibold">{t("output")}</Label><span className={`text-xs ${muted}`}>{t("editable")}</span></div><Textarea id="ocr-output" value={text} onChange={event => setText(event.target.value)} disabled={!result} placeholder={t("outputEmpty")} className="min-h-80 resize-y font-mono text-sm leading-6" spellCheck={false} />
        {result && !result.lines.length && <p role="status" className={`text-sm ${muted}`}>{t("noText")}</p>}
        <div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" disabled={!result || !text} onClick={() => void copy()}><Copy className="h-4 w-4" />{t("copy")}</Button>{textUrl && file && <Button asChild variant="outline" size="sm"><a href={textUrl} download={ocrFileName(file.name, "txt")}><Download className="h-4 w-4" />TXT</a></Button>}{jsonUrl && file && <Button asChild variant="outline" size="sm"><a href={jsonUrl} download={ocrFileName(file.name, "json")}><Download className="h-4 w-4" />JSON</a></Button>}{result && text && <SendToMenu value={text} source={t("title")} />}</div>
        {result && <p className={`text-xs leading-5 ${muted}`}>{t("exportHint")}</p>}
      </section>
    </div>
    {result && result.lines.length > 0 && <section className={`${frame} space-y-4 p-5`}><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold">{t("review")} <span className={`ml-2 text-xs font-normal ${muted}`}>{lowCount} {t("lowCount")}</span></h2><label className="flex cursor-pointer items-center gap-2 text-sm"><input type="checkbox" checked={onlyLow} onChange={e => setOnlyLow(e.target.checked)} />{t("onlyLow")}</label></div><p className={`text-xs leading-5 ${muted}`}>{t("confidenceHint")}</p><div className="max-h-80 space-y-2 overflow-auto">{result.lines.filter(line => !onlyLow || line.score < OCR_LOW_CONFIDENCE).map(line => <button id={`ocr-line-${line.id}`} key={line.id} type="button" aria-pressed={selected === line.id} onClick={() => setSelected(line.id)} className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left text-sm ${selected === line.id ? "border-[var(--md-sys-color-primary)] bg-[var(--md-sys-color-primary-container)]" : "border-[var(--md-sys-color-outline-variant)]"}`}><span className={`w-7 shrink-0 font-mono text-xs ${muted}`}>{line.id + 1}</span><span className="min-w-0 flex-1 break-words">{line.text}</span><span className={`shrink-0 rounded px-2 py-0.5 font-mono text-xs ${line.score < OCR_LOW_CONFIDENCE ? "bg-amber-100 text-amber-900" : muted}`}>{(line.score * 100).toFixed(1)}%</span></button>)}{onlyLow && lowCount === 0 && <p className={`py-3 text-sm ${muted}`}>{t("noLow")}</p>}</div></section>}
  </div>
}
