"use client"

import { useEffect, useId, useMemo, useRef, useState } from "react"
import { CheckCircle2, Copy, Download, FileArchive, Files, Loader2, RotateCcw, Upload, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useObjectUrl } from "@/hooks/use-object-url"
import { useTranslations } from "@/hooks/use-translations"
import { useToast } from "@/hooks/use-toast"
import { SendToMenu } from "./send-to-menu"
import { createClientId } from "@/lib/client-id"
import { OCR_LIMITS, OCR_LOW_CONFIDENCE, type OcrProgress } from "@/lib/ocr-shared"
import { createOcrSample } from "@/lib/ocr-samples"
import { batchErrorCode, imageBatchZip, runImageBatch } from "@/lib/image-batch"
import { batchCombinedText, batchOcrResult, batchOptions, batchResultBytes, DEFAULT_BATCH_OPTIONS, IMAGE_BATCH_LIMITS, uniqueImageBase, type BatchImageJob, type ImageBatchOptions } from "@/lib/image-batch-shared"

const frame = "rounded-2xl border border-md-outline-variant bg-md-surface-container-lowest p-4 sm:p-5"
const selectClass = "h-10 w-full rounded-lg border border-md-outline-variant bg-md-surface px-3 text-sm"
function size(bytes: number) { return bytes < 1048576 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1048576).toFixed(2)} MB` }
function DownloadFile({ file }: { file: File }) {
  const url = useObjectUrl(file)
  return url ? <Button asChild variant="outline" size="sm"><a href={url} download={file.name}><Download />{file.name.split(".").pop()?.toUpperCase()}</a></Button> : null
}
export default function ImageBatchPanel({ isActive = true, headingLevel = "h1" }: { isActive?: boolean; headingLevel?: "h1" | "h2" }) {
  const t = useTranslations("imageBatch"), ot = useTranslations("ocrTools"), { toast } = useToast(), id = useId(), Heading = headingLevel
  const [jobs, setJobs] = useState<BatchImageJob[]>([]), [options, setOptions] = useState<ImageBatchOptions>(DEFAULT_BATCH_OPTIONS)
  const [selectedId, setSelectedId] = useState(""), [phase, setPhase] = useState<"run" | "zip" | "sample" | null>(null)
  const [progress, setProgress] = useState<{ current: number; total: number; name: string; ocr?: OcrProgress } | null>(null), [notice, setNotice] = useState("")
  const [archive, setArchive] = useState<Blob | null>(null), archiveUrl = useObjectUrl(archive)
  const input = useRef<HTMLInputElement>(null), current = useRef<BatchImageJob[]>([]), active = useRef<AbortController | null>(null), version = useRef(0)
  const updateJobs = (fn: (jobs: BatchImageJob[]) => BatchImageJob[]) => { current.current = fn(current.current); setJobs(current.current) }
  const busy = phase !== null, selected = jobs.find(job => job.id === selectedId) ?? jobs[0]
  const preview = useObjectUrl(selected?.status === "done" ? selected.result?.preview ?? selected.result?.files[0] : null)
  const complete = jobs.filter(job => job.status === "done"), failed = jobs.filter(job => job.status === "error"), ready = jobs.filter(job => job.status === "ready")
  const text = useMemo(() => batchCombinedText(jobs), [jobs]), textFile = useMemo(() => new File([text], "all-ocr-text.txt", { type: "text/plain;charset=utf-8" }), [text])
  const describe = (code: string) => { const [scope, key] = code.split(":"); return scope === "ocr" ? ot(`error_${key}`) : t(`error_${key || "convert"}`) }
  const cancel = () => { version.current++; active.current?.abort(); active.current = null; setPhase(null); setProgress(null); updateJobs(list => list.map(job => job.status === "running" ? { ...job, status: "ready" } : job)) }
  useEffect(() => () => { version.current++; active.current?.abort() }, [])
  useEffect(() => { if (!isActive) { version.current++; active.current?.abort(); active.current = null; setPhase(null); setProgress(null); const next = current.current.map(job => job.status === "running" ? { ...job, status: "ready" as const } : job); current.current = next; setJobs(next) } }, [isActive])
  const add = (files: File[]) => {
    setArchive(null); setNotice("")
    const used = new Set(current.current.map(job => job.base.toLowerCase())), next: BatchImageJob[] = []
    let total = current.current.reduce((sum, job) => sum + job.file.size, 0), skipped = false
    for (const file of files) {
      if (current.current.length + next.length >= IMAGE_BATCH_LIMITS.files || total + file.size > IMAGE_BATCH_LIMITS.inputBytes || file.size > OCR_LIMITS.fileBytes) { skipped = true; continue }
      total += file.size; next.push({ id: createClientId("batch"), file, base: uniqueImageBase(file.name, used), status: "ready" })
    }
    updateJobs(list => [...list, ...next])
    if (skipped) setNotice(t("skipped"))
  }
  const samples = async () => {
    const ticket = ++version.current; setPhase("sample"); setNotice("")
    try { const files = await Promise.all((["document", "small", "dark"] as const).map(createOcrSample)); if (ticket === version.current) add(files) }
    catch { if (ticket === version.current) setNotice(t("error_convert")) }
    finally { if (ticket === version.current) setPhase(null) }
  }
  const change = (next: ImageBatchOptions) => { setOptions(next); setArchive(null); setNotice(""); updateJobs(list => list.map(({ id, file, base }) => ({ id, file, base, status: "ready" }))) }
  let valid = true
  try { batchOptions(options) } catch { valid = false }
  const run = async (ids: string[]) => {
    if (busy || !ids.length || !valid) return
    const ticket = ++version.current, controller = new AbortController(); active.current = controller; setPhase("run"); setNotice(""); setArchive(null)
    const target = new Set(ids), list = current.current.filter(job => target.has(job.id)).map(({ id, file, base }) => ({ id, file, base, status: "ready" as const }))
    const kept = current.current.filter(job => !target.has(job.id)).reduce((sum, job) => sum + batchResultBytes(job.result), 0)
    updateJobs(jobs => jobs.map(job => target.has(job.id) ? { id: job.id, file: job.file, base: job.base, status: "ready" } : job))
    try {
      await runImageBatch(list, options, { signal: controller.signal, onProgress: value => { if (ticket === version.current) setProgress(value) }, onUpdate: (jobId, value) => { if (ticket === version.current) updateJobs(jobs => jobs.map(job => job.id === jobId ? { ...job, ...value } : job)) } }, undefined, kept)
    } catch (error) { if (ticket === version.current) setNotice(describe(batchErrorCode(error))) }
    finally { if (ticket === version.current) { setPhase(null); setProgress(null); active.current = null } }
  }
  const pack = async () => {
    const ticket = ++version.current, controller = new AbortController(); active.current = controller; setPhase("zip"); setArchive(null); setNotice("")
    try { const zip = await imageBatchZip(current.current, options, controller.signal); if (ticket === version.current) setArchive(zip) }
    catch (error) { if (ticket === version.current) setNotice(describe(batchErrorCode(error))) }
    finally { if (ticket === version.current) { setPhase(null); active.current = null } }
  }
  const edit = (value: string) => {
    if (!selected?.result?.ocr) return
    const result = batchOcrResult(selected.result.ocr, selected.base, value)
    if (jobs.reduce((sum, job) => sum + batchResultBytes(job.id === selected.id ? result : job.result), 0) > IMAGE_BATCH_LIMITS.outputBytes) { setNotice(t("error_outputLimit")); return }
    setArchive(null); updateJobs(list => list.map(job => job.id === selected.id ? { ...job, result } : job))
  }
  return <div className="space-y-5" onPaste={event => { if (busy) return; const files = Array.from(event.clipboardData.items).filter(item => item.kind === "file").map(item => item.getAsFile()).filter((file): file is File => !!file); if (files.length) { event.preventDefault(); add(files) } }}>
    <header><Heading className="flex items-center gap-3 text-2xl font-semibold"><Files className="h-7 w-7 text-md-primary" />{t("title")}</Heading><p className="mt-2 max-w-4xl text-sm leading-6 text-md-on-surface-variant">{t("description")}</p></header>
    <section className={`${frame} space-y-4`} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); if (!busy) add(Array.from(event.dataTransfer.files)) }}>
      <input ref={input} type="file" multiple className="hidden" aria-label={t("add")} accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp" onChange={event => { if (!busy) add(Array.from(event.target.files ?? [])); event.target.value = "" }} />
      <div className="flex flex-wrap items-center gap-3"><Button variant="outline" disabled={busy} onClick={() => input.current?.click()}><Upload />{t("add")}</Button><Button size="sm" variant="ghost" disabled={busy} onClick={() => void samples()}>{t("samples")}</Button><span className="text-xs text-md-on-surface-variant">{t("dropHint")}</span>{!!jobs.length && <Button size="sm" variant="ghost" onClick={() => { cancel(); updateJobs(() => []); setArchive(null); setNotice("") }}><X />{t("clear")}</Button>}</div>
      <p className="text-xs leading-5 text-md-on-surface-variant">{t("limits")}</p>
      <Tabs value={options.mode} onValueChange={value => change({ ...DEFAULT_BATCH_OPTIONS, mode: value as ImageBatchOptions["mode"] })}><TabsList><TabsTrigger value="ocr" disabled={busy}>{t("ocrMode")}</TabsTrigger><TabsTrigger value="images" disabled={busy}>{t("imageMode")}</TabsTrigger></TabsList></Tabs>
      {options.mode === "ocr" ? <><div className="flex flex-wrap items-end gap-4"><div className="w-44 space-y-2"><Label htmlFor={`${id}-rotation`}>{ot("rotation")}</Label><select id={`${id}-rotation`} className={selectClass} value={options.rotation} disabled={busy} onChange={e => change({ ...options, rotation: Number(e.target.value) as ImageBatchOptions["rotation"] })}>{[0, 90, 180, 270].map(angle => <option key={angle} value={angle}>{angle ? `${angle}°` : ot("rotationNone")}</option>)}</select></div><label className="flex min-h-10 items-center gap-2 text-sm"><input type="checkbox" checked={options.enhanceSmallText} disabled={busy} onChange={e => change({ ...options, enhanceSmallText: e.target.checked })} />{ot("enhance")}</label></div><p className="text-xs text-md-on-surface-variant">{ot("downloadHint")}</p></> : <><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><div className="space-y-2"><Label htmlFor={`${id}-format`}>{t("format")}</Label><select id={`${id}-format`} className={selectClass} value={options.format} disabled={busy} onChange={e => change({ ...options, quality: Number.isFinite(options.quality) ? options.quality : 82, format: e.target.value as ImageBatchOptions["format"] })}><option value="webp">WebP</option><option value="jpeg">JPEG</option><option value="png">PNG</option></select></div><div className="space-y-2"><Label htmlFor={`${id}-quality`}>{t("quality")}</Label><Input id={`${id}-quality`} type="number" min={10} max={100} value={options.quality} disabled={busy || options.format === "png"} onChange={e => change({ ...options, quality: Number(e.target.value) })} /></div><div className="space-y-2"><Label htmlFor={`${id}-width`}>{t("width")}</Label><Input id={`${id}-width`} type="number" min={1} max={32768} placeholder={t("keepSize")} value={options.maxWidth || ""} disabled={busy} onChange={e => change({ ...options, maxWidth: e.target.value ? Number(e.target.value) : 0 })} /></div><div className="space-y-2"><Label htmlFor={`${id}-height`}>{t("height")}</Label><Input id={`${id}-height`} type="number" min={1} max={32768} placeholder={t("keepSize")} value={options.maxHeight || ""} disabled={busy} onChange={e => change({ ...options, maxHeight: e.target.value ? Number(e.target.value) : 0 })} /></div></div><p className="text-xs leading-5 text-md-on-surface-variant">{t("imageHint")}</p></>}
      <p className="text-xs text-md-on-surface-variant">{t("optionsHint")}</p>
      <div className="flex flex-wrap items-center gap-2"><Button disabled={busy || !ready.length || !valid} onClick={() => void run(ready.map(job => job.id))}>{busy ? <Loader2 className="animate-spin" /> : <Files />}{t("run")} ({ready.length})</Button>{!!failed.length && <Button disabled={busy || !valid} variant="outline" onClick={() => void run(failed.map(job => job.id))}><RotateCcw />{t("retry")} ({failed.length})</Button>}{!!complete.length && <Button variant="ghost" disabled={busy || !valid} onClick={() => void run(jobs.map(job => job.id))}>{t("rerun")}</Button>}{busy && <Button variant="outline" onClick={() => { cancel(); setNotice(t("cancelled")) }}>{t("cancel")}</Button>}</div>
      {!valid && <p role="alert" className="text-sm text-md-error">{t("error_options")}</p>}
      {phase && <div role="status" className="space-y-2 text-sm"><p className="break-all">{t(`phase_${phase}`)}{progress && phase === "run" ? ` · ${progress.current} / ${progress.total} · ${progress.name}` : ""}</p>{progress?.ocr && <p className="text-xs text-md-on-surface-variant">{ot(`stage_${progress.ocr.stage}`)}{progress.ocr.total ? ` · ${Math.min(100, Math.round((progress.ocr.completed ?? 0) / progress.ocr.total * 100))}%` : ""}</p>}{progress && <progress aria-label={t("progress")} className="h-2 w-full accent-[var(--md-sys-color-primary)]" max={progress.total} value={progress.current - 1} />}</div>}
      {notice && <p role="status" className="rounded-xl bg-md-surface-container p-3 text-sm">{notice}</p>}
    </section>
    {!!jobs.length && <div className="grid items-start gap-5 lg:grid-cols-2">
      <section className={`${frame} min-w-0 space-y-3`}><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">{t("queue")} · {jobs.length}</h2><span className="text-xs text-md-on-surface-variant">{t("status_done")} {complete.length} · {t("status_error")} {failed.length}</span></div><div className="max-h-[620px] space-y-2 overflow-auto">{jobs.map((job, index) => <div key={job.id} className={`rounded-xl border p-3 ${selected?.id === job.id ? "border-md-primary bg-md-primary-container/20" : "border-md-outline-variant"}`}><div className="flex items-start gap-2"><button type="button" aria-pressed={selected?.id === job.id} className="min-w-0 flex-1 break-all text-left text-sm font-medium" onClick={() => setSelectedId(job.id)}>{index + 1}. {job.file.name}</button><span className={`shrink-0 text-xs ${job.status === "error" ? "text-md-error" : job.status === "done" ? "text-md-primary" : "text-md-on-surface-variant"}`}>{t(`status_${job.status}`)}</span><Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" aria-label={`${t("remove")} ${job.file.name}`} disabled={busy} onClick={() => { updateJobs(list => list.filter(item => item.id !== job.id)); setArchive(null) }}><X className="h-3 w-3" /></Button></div><p className="mt-1 text-xs text-md-on-surface-variant">{size(job.file.size)}{job.result ? ` → ${size(batchResultBytes(job.result))} · ${job.result.width} × ${job.result.height}` : ""}</p>{job.error && <p className="mt-2 text-xs text-md-error">{describe(job.error)}</p>}{job.result?.animated && <p className="mt-2 text-xs text-md-on-surface-variant">{ot("firstFrame")}</p>}{job.result && <div className="mt-2 flex flex-wrap gap-2">{job.result.files.map(file => <DownloadFile key={file.name} file={file} />)}</div>}</div>)}</div></section>
      <section className={`${frame} min-w-0 space-y-3`}><h2 className="break-all font-semibold">{t("preview")} · {selected?.file.name}</h2>{preview ? <img src={preview} alt={t("preview")} className="max-h-80 w-full rounded-lg bg-md-surface-container object-contain" /> : <p className="py-16 text-center text-sm text-md-on-surface-variant">{t("previewEmpty")}</p>}{selected?.result?.text !== undefined && <><Label htmlFor={`${id}-text`}>{ot("output")}</Label><Textarea id={`${id}-text`} rows={10} maxLength={200000} value={selected.result.text} disabled={busy} onChange={e => edit(e.target.value)} spellCheck={false} /><p className="text-xs leading-5 text-md-on-surface-variant">{t("textHint")} · {selected.result.ocr?.lines.filter(line => line.score < OCR_LOW_CONFIDENCE).length ?? 0} {ot("lowCount")}</p>{selected.result.text && <SendToMenu value={selected.result.text} source={t("title")} />}</>}{selected?.result && options.mode === "images" && <p className="text-sm text-md-on-surface-variant">{selected.result.files[0].size <= selected.file.size ? t("smaller") : t("larger")} {Math.abs((1 - selected.result.files[0].size / selected.file.size) * 100).toFixed(1)}%</p>}</section>
    </div>}
    {!!complete.length && <section className={`${frame} space-y-3`}><h2 className="flex items-center gap-2 font-semibold"><CheckCircle2 className="h-5 w-5 text-md-primary" />{t("export")} · {complete.length} / {jobs.length}</h2><p className="text-xs leading-5 text-md-on-surface-variant">{t("zipHint")}</p><div className="flex flex-wrap gap-2"><Button disabled={busy} onClick={() => void pack()}><FileArchive />{t("pack")}</Button>{archiveUrl && <Button asChild variant="outline"><a href={archiveUrl} download={`batch-${options.mode}.zip`}><Download />{t("downloadZip")}</a></Button>}{options.mode === "ocr" && text && <><DownloadFile file={textFile} /><Button variant="outline" size="sm" onClick={() => void navigator.clipboard.writeText(text).then(() => toast({ description: ot("copied") })).catch(() => toast({ description: ot("copyFailed"), variant: "destructive" }))}><Copy />{t("copyAll")}</Button></>}</div></section>}
  </div>
}
