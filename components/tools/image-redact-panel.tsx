"use client"

import { useEffect, useId, useRef, useState, type PointerEvent } from "react"
import { Download, Loader2, Plus, ScanText, Shield, Trash2, Undo2, Upload, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useTranslations } from "@/hooks/use-translations"
import { useObjectUrl } from "@/hooks/use-object-url"
import { createClientId } from "@/lib/client-id"
import { recognizeImage } from "@/lib/ocr-worker-client"
import { OcrError, type OcrProgress } from "@/lib/ocr-shared"
import { createRedactSample, runRedactImage } from "@/lib/image-redact"
import { detectRedactRegions, REDACT_LIMITS, redactRect, type RedactImage, type RedactRect, type RedactRegion, type SensitiveKind } from "@/lib/image-redact-shared"
import { SendToMenu } from "./send-to-menu"

const frame = "rounded-2xl border border-md-outline-variant bg-md-surface-container-lowest p-4 sm:p-5"
const selectClass = "h-10 rounded-lg border border-md-outline-variant bg-md-surface px-3 text-sm"
const kinds: SensitiveKind[] = ["phone", "email", "identity"]

export default function ImageRedactPanel() {
  const t = useTranslations("imageRedact"), ot = useTranslations("ocrTools"), id = useId()
  const [file, setFile] = useState<File | null>(null), [source, setSource] = useState<RedactImage | null>(null)
  const [regions, setRegions] = useState<RedactRegion[]>([]), [activeId, setActiveId] = useState("")
  const [enabled, setEnabled] = useState<SensitiveKind[]>(kinds), [color, setColor] = useState<"black" | "white">("black"), [format, setFormat] = useState<"png" | "jpeg">("png")
  const [phase, setPhase] = useState<"prepare" | "detect" | "render" | null>(null), [progress, setProgress] = useState<OcrProgress | null>(null), [notice, setNotice] = useState("")
  const [output, setOutput] = useState<File | null>(null), [zoom, setZoom] = useState(100), [draft, setDraft] = useState<RedactRect | null>(null), [undoCount, setUndoCount] = useState(0)
  const input = useRef<HTMLInputElement>(null), active = useRef<AbortController | null>(null), version = useRef(0)
  const startPoint = useRef<{ x: number; y: number; pointer: number } | null>(null), history = useRef<RedactRegion[][]>([])
  const sourceUrl = useObjectUrl(source?.preview), outputUrl = useObjectUrl(output)
  const busy = phase !== null, selected = regions.filter(region => region.selected), focused = regions.find(region => region.id === activeId)
  useEffect(() => () => { version.current++; active.current?.abort() }, [])
  const cancel = () => { version.current++; active.current?.abort(); active.current = null; setPhase(null); setProgress(null) }
  const replaceRegions = (next: RedactRegion[]) => {
    if (next.length > REDACT_LIMITS.regions) { setNotice(t("regionLimit")); return }
    history.current = [...history.current.slice(-49), regions]; setUndoCount(history.current.length)
    setRegions(next); setOutput(null)
  }
  const clear = () => { cancel(); setFile(null); setSource(null); setRegions([]); setOutput(null); setNotice(""); setDraft(null); startPoint.current = null; history.current = []; setUndoCount(0) }
  const describeError = (error: unknown) => error instanceof OcrError && ["fileLimit", "imageLimit", "format", "decode", "model", "unsupported"].includes(error.code) ? ot(`error_${error.code}`) : t(error instanceof OcrError && error.code === "timeout" ? "errorTimeout" : "error")
  const load = async (incoming: File | Promise<File>) => {
    clear(); const ticket = ++version.current, controller = new AbortController(); active.current = controller; setPhase("prepare")
    try {
      const nextFile = await incoming
      if (ticket !== version.current) return
      const next = await runRedactImage({ action: "prepare", file: nextFile }, controller.signal)
      if (ticket === version.current) { setFile(nextFile); setSource(next); setZoom(100) }
    } catch (error) { if (ticket === version.current) setNotice(describeError(error)) }
    finally { if (ticket === version.current) { setPhase(null); active.current = null } }
  }
  const detect = async () => {
    if (!file || !source || busy) return
    const ticket = ++version.current, controller = new AbortController(); active.current = controller; setPhase("detect"); setNotice(""); setOutput(null)
    try {
      const result = await recognizeImage(file, { rotation: 0, enhanceSmallText: true }, { signal: controller.signal, onProgress: value => { if (ticket === version.current) setProgress(value) } })
      if (ticket !== version.current) return
      if (result.info.width !== source.width || result.info.height !== source.height) throw new OcrError("options")
      const candidates = detectRedactRegions(result.lines, source.width, source.height, enabled)
      replaceRegions([...regions.filter(region => region.source === "manual"), ...candidates]); setActiveId(candidates[0]?.id ?? "")
      setNotice(candidates.length ? t("detected").replace("{count}", String(candidates.length)) : t("noneDetected"))
    } catch (error) { if (ticket === version.current) setNotice(describeError(error)) }
    finally { if (ticket === version.current) { setPhase(null); setProgress(null); active.current = null } }
  }
  const render = async () => {
    if (!file || !source || busy || !selected.length) return
    const ticket = ++version.current, controller = new AbortController(); active.current = controller; setPhase("render"); setOutput(null); setNotice("")
    try {
      const result = await runRedactImage({ action: "render", file, width: source.width, height: source.height, regions: selected.map(({ x, y, width, height }) => ({ x, y, width, height })), color, format }, controller.signal)
      if (ticket === version.current && result.output) setOutput(result.output)
    } catch (error) { if (ticket === version.current) setNotice(describeError(error)) }
    finally { if (ticket === version.current) { setPhase(null); active.current = null } }
  }
  const addManual = (rect: RedactRect) => {
    if (!source || busy) return
    const region: RedactRegion = { ...redactRect(rect, source.width, source.height), id: createClientId("mask"), source: "manual", selected: true, text: "", kinds: [] }
    replaceRegions([...regions, region]); setActiveId(region.id)
  }
  const point = (event: PointerEvent<SVGSVGElement>) => {
    const box = event.currentTarget.getBoundingClientRect()
    return { x: Math.max(0, Math.min(source!.width, (event.clientX - box.left) / box.width * source!.width)), y: Math.max(0, Math.min(source!.height, (event.clientY - box.top) / box.height * source!.height)) }
  }
  const dragging = (event: PointerEvent<SVGSVGElement>, finish = false) => {
    const start = startPoint.current
    if (!start || start.pointer !== event.pointerId || !source) return
    const end = point(event), rect = { x: Math.min(start.x, end.x), y: Math.min(start.y, end.y), width: Math.abs(end.x - start.x), height: Math.abs(end.y - start.y) }
    if (finish) { startPoint.current = null; setDraft(null); if (rect.width >= 1 && rect.height >= 1) addManual(rect) }
    else setDraft(rect)
  }
  const editRect = (key: keyof RedactRect, value: number) => {
    if (!focused || !source || !Number.isFinite(value)) return
    try { const next = redactRect({ ...focused, [key]: value }, source.width, source.height); replaceRegions(regions.map(region => region.id === focused.id ? { ...region, ...next } : region)) } catch { /* Keep the previous nonempty rectangle. */ }
  }
  return <div className="space-y-5" onPaste={event => { const pasted = Array.from(event.clipboardData.files)[0]; if (!busy && pasted) { event.preventDefault(); void load(pasted) } }}>
    <header><h1 className="flex items-center gap-3 text-2xl font-semibold"><Shield className="h-7 w-7 text-md-primary" />{t("title")}</h1><p className="mt-2 max-w-4xl text-sm leading-6 text-md-on-surface-variant">{t("description")}</p></header>
    <section className={`${frame} space-y-4`} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); const incoming = event.dataTransfer.files[0]; if (!busy && incoming) void load(incoming) }}>
      <input ref={input} type="file" className="hidden" aria-label={t("upload")} accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp" onChange={event => { const incoming = event.target.files?.[0]; if (!busy && incoming) void load(incoming); event.target.value = "" }} />
      <div className="flex flex-wrap items-center gap-2"><Button variant="outline" disabled={busy} onClick={() => input.current?.click()}><Upload />{t("upload")}</Button><Button variant="ghost" disabled={busy} onClick={() => void load(createRedactSample())}>{t("sample")}</Button>{file && <Button variant="ghost" onClick={clear}><X />{t("clear")}</Button>}<span className="text-xs text-md-on-surface-variant">{t("limits")}</span></div>
      {file && <p className="break-all text-sm">{file.name} · {source?.width} × {source?.height}{source?.animated ? ` · ${t("firstFrame")}` : ""}</p>}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">{kinds.map(kind => <label key={kind} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={enabled.includes(kind)} disabled={busy} onChange={e => setEnabled(e.target.checked ? [...enabled, kind] : enabled.filter(value => value !== kind))} />{t(`kind_${kind}`)}</label>)}<Button disabled={busy || !source || !enabled.length} onClick={() => void detect()}><ScanText />{t("detect")}</Button></div>
      <p className="text-xs leading-5 text-md-on-surface-variant">{t("detectHint")} {ot("downloadHint")}</p>
      {phase && <div role="status" className="flex flex-wrap items-center gap-3 text-sm"><Loader2 className="h-4 w-4 animate-spin" />{t(`phase_${phase}`)}{progress && <span>{ot(`stage_${progress.stage}`)}{progress.total ? ` · ${Math.min(100, Math.round((progress.completed ?? 0) / progress.total * 100))}%` : ""}</span>}<Button variant="outline" size="sm" onClick={() => { cancel(); setNotice(t("cancelled")) }}>{t("cancel")}</Button></div>}
      {notice && <p role="status" className="rounded-xl bg-md-surface-container p-3 text-sm">{notice}</p>}
    </section>
    {source && sourceUrl && <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(300px,1fr)]">
      <section className={`${frame} min-w-0 space-y-3`}>
        <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">{t("review")}</h2><label className="flex items-center gap-2 text-xs">{t("zoom")}<select aria-label={t("zoom")} className={selectClass} value={zoom} onChange={e => setZoom(Number(e.target.value))}>{[100, 200, 400].map(value => <option key={value} value={value}>{value}%</option>)}</select></label></div>
        <p id={`${id}-draw-hint`} className="text-xs leading-5 text-md-on-surface-variant">{t("drawHint")}</p>
        <div className="max-h-[75vh] overflow-auto rounded-lg border border-md-outline-variant bg-md-surface-container">
          <svg role="img" aria-label={t("sourcePreview")} aria-describedby={`${id}-draw-hint`} viewBox={`0 0 ${source.width} ${source.height}`} className="block touch-none select-none" style={{ width: `${zoom}%`, maxWidth: "none", cursor: busy ? "wait" : "crosshair" }}
            onPointerDown={event => { if (busy || !event.isPrimary || event.button !== 0) return; event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); startPoint.current = { ...point(event), pointer: event.pointerId } }}
            onPointerMove={event => dragging(event)} onPointerUp={event => dragging(event, true)} onPointerCancel={() => { startPoint.current = null; setDraft(null) }} onLostPointerCapture={() => { startPoint.current = null; setDraft(null) }}>
            <image href={sourceUrl} width={source.width} height={source.height} preserveAspectRatio="none" />
            {regions.map((region, index) => <g key={region.id}><rect x={region.x} y={region.y} width={region.width} height={region.height} fill={region.selected ? "#e11d48" : "none"} fillOpacity={0.28} stroke={region.id === activeId ? "#2563eb" : region.selected ? "#e11d48" : "#64748b"} strokeWidth={region.id === activeId ? 3 : 1.5} strokeDasharray={region.selected ? undefined : "5 3"} vectorEffect="non-scaling-stroke" /><text x={region.x + 3} y={Math.max(14, region.y - 4)} fontSize={Math.max(14, source.width / 65)} fill="#e11d48" stroke="white" strokeWidth={2} paintOrder="stroke">{index + 1}</text></g>)}
            {draft && <rect {...draft} fill="#2563eb" fillOpacity={0.2} stroke="#2563eb" strokeWidth={2} vectorEffect="non-scaling-stroke" />}
          </svg>
        </div>
        <Button size="sm" variant="outline" disabled={busy || regions.length >= REDACT_LIMITS.regions} onClick={() => addManual({ x: Math.floor(source.width * 0.3), y: Math.floor(source.height * 0.3), width: Math.max(1, Math.floor(source.width * 0.4)), height: Math.max(1, Math.floor(source.height * 0.1)) })}><Plus />{t("manual")}</Button>
      </section>
      <section className={`${frame} min-w-0 space-y-4`}>
        <h2 className="font-semibold">{t("regions")} · {selected.length} / {regions.length}</h2>
        <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" disabled={busy || !regions.length} onClick={() => replaceRegions(regions.map(region => ({ ...region, selected: true })))}>{t("selectAll")}</Button><Button size="sm" variant="outline" disabled={busy || !selected.length} onClick={() => replaceRegions(regions.map(region => ({ ...region, selected: false })))}>{t("selectNone")}</Button><Button size="sm" variant="ghost" disabled={busy || !undoCount} onClick={() => { const previous = history.current.pop(); if (previous) { setRegions(previous); setOutput(null); setUndoCount(history.current.length) } }}><Undo2 />{t("undo")}</Button></div>
        <div className="max-h-80 space-y-2 overflow-auto">{!regions.length && <p className="py-4 text-sm text-md-on-surface-variant">{t("empty")}</p>}{regions.map((region, index) => <div key={region.id} className={`flex items-start gap-2 rounded-xl border p-3 ${region.id === activeId ? "border-md-primary bg-md-primary-container/30" : "border-md-outline-variant"}`}>
          <input type="checkbox" className="mt-1" aria-label={`${t("selectRegion")} ${index + 1}`} checked={region.selected} disabled={busy} onChange={e => replaceRegions(regions.map(item => item.id === region.id ? { ...item, selected: e.target.checked } : item))} />
          <button className="min-w-0 flex-1 text-left text-sm" disabled={busy} onClick={() => setActiveId(region.id)}><span className="font-medium">{index + 1}. {region.source === "manual" ? t("manualRegion") : region.kinds.map(kind => t(`kind_${kind}`)).join(" / ")}</span>{region.text && <span className="mt-1 block break-all text-xs text-md-on-surface-variant">{region.text}</span>}</button>
          <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" aria-label={`${t("deleteRegion")} ${index + 1}`} disabled={busy} onClick={() => replaceRegions(regions.filter(item => item.id !== region.id))}><Trash2 className="h-4 w-4" /></Button>
        </div>)}</div>
        {focused && <fieldset className="space-y-2"><legend className="text-sm font-medium">{t("coordinates")} · {regions.indexOf(focused) + 1}</legend><div className="grid grid-cols-2 gap-3">{(["x", "y", "width", "height"] as const).map(key => <div key={key} className="space-y-1"><Label htmlFor={`${id}-${key}`}>{t(key)}</Label><Input id={`${id}-${key}`} type="number" min={key === "x" || key === "y" ? 0 : 1} max={key === "x" || key === "width" ? source.width : source.height} value={focused[key]} disabled={busy} onChange={e => { if (e.target.value !== "") editRect(key, Number(e.target.value)) }} /></div>)}</div></fieldset>}
        <div className="flex flex-wrap gap-3"><label className="space-y-1 text-sm"><span className="block">{t("color")}</span><select aria-label={t("color")} className={selectClass} value={color} disabled={busy} onChange={e => { setColor(e.target.value as typeof color); setOutput(null) }}><option value="black">{t("black")}</option><option value="white">{t("white")}</option></select></label><label className="space-y-1 text-sm"><span className="block">{t("format")}</span><select aria-label={t("format")} className={selectClass} value={format} disabled={busy} onChange={e => { setFormat(e.target.value as typeof format); setOutput(null) }}><option value="png">PNG</option><option value="jpeg">JPEG</option></select></label></div>
        <p className="text-xs leading-5 text-md-on-surface-variant">{t("exportHint")}</p>
        <Button className="h-auto min-h-10 w-full whitespace-normal" disabled={busy || !selected.length} onClick={() => void render()}>{phase === "render" ? <Loader2 className="animate-spin" /> : <Shield />}{t("apply")} ({selected.length})</Button>
      </section>
    </div>}
    {output && outputUrl && <section className={`${frame} space-y-4`}><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold">{t("result")}</h2><div className="flex flex-wrap gap-2"><Button asChild><a href={outputUrl} download={output.name}><Download />{t("download")}</a></Button><SendToMenu value={output} source={t("title")} filename={output.name} /></div></div><p className="text-xs leading-5 text-md-on-surface-variant">{t("resultHint")}</p><div className="max-h-[70vh] overflow-auto rounded-lg border border-md-outline-variant bg-md-surface-container"><img src={outputUrl} alt={t("resultPreview")} className="mx-auto block h-auto max-w-full" /></div></section>}
  </div>
}
