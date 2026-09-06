"use client"

import { useEffect, useRef, useState } from "react"
import { Copy, Download, ImagePlus, Loader2, PenTool, RotateCcw, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { SendToMenu } from "@/components/tools/send-to-menu"
import { useObjectUrl } from "@/hooks/use-object-url"
import { useToast } from "@/hooks/use-toast"
import { useTranslations } from "@/hooks/use-translations"
import { DEFAULT_VECTOR_OPTIONS, ImageVectorError, VECTOR_LIMITS, rasterHeader, type ImageVectorOptions, type ImageVectorResult, type VectorStage, type VectorErrorCode } from "@/lib/image-vector-shared"
import { vectorizeImage } from "@/lib/image-vector-worker-client"
import { createVectorSample, type VectorSample } from "@/lib/image-vector-samples"

const frame = "rounded-2xl border border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container-lowest)]"
const checker = { backgroundImage: "conic-gradient(#87968222 25%, transparent 0 50%, #87968222 0 75%, transparent 0)", backgroundSize: "20px 20px" }
const size = (bytes: number) => bytes < 1024 ? `${bytes} B` : bytes < 1048576 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1048576).toFixed(2)} MB`

function Option({ id, label, value, onChange, choices, disabled }: { id: string; label: string; value: string; onChange: (value: string) => void; choices: Array<[string, string]>; disabled?: boolean }) {
  return <div className="space-y-2"><Label htmlFor={id}>{label}</Label><Select value={value} onValueChange={onChange} disabled={disabled}><SelectTrigger id={id}><SelectValue /></SelectTrigger><SelectContent>{choices.map(([key, text]) => <SelectItem key={key} value={key}>{text}</SelectItem>)}</SelectContent></Select></div>
}

export default function ImageToSvgPage() {
  const t = useTranslations("imageVectorTools"), { toast } = useToast()
  const [file, setFile] = useState<File | null>(null)
  const [validatedFile, setValidatedFile] = useState<File | null>(null)
  const [validationError, setValidationError] = useState<VectorErrorCode | null>(null)
  const [options, setOptions] = useState<ImageVectorOptions>(DEFAULT_VECTOR_OPTIONS)
  const [result, setResult] = useState<ImageVectorResult | null>(null)
  const [error, setError] = useState("")
  const [stage, setStage] = useState<VectorStage | null>(null)
  const [sampleLoading, setSampleLoading] = useState(false)
  const [comparison, setComparison] = useState("side")
  const [zoom, setZoom] = useState("100")
  const [position, setPosition] = useState(50)
  const inputRef = useRef<HTMLInputElement>(null), version = useRef(0), active = useRef<AbortController | null>(null)
  const sourceUrl = useObjectUrl(file === validatedFile ? file : null), resultUrl = useObjectUrl(result?.file)
  const inputUrl = file && file === validatedFile ? sourceUrl : null, outputUrl = result ? resultUrl : null
  const busy = stage !== null, zoomFactor = Number(zoom) / 100
  const invalidate = () => { version.current++; active.current?.abort(); active.current = null; setStage(null); return version.current }
  useEffect(() => () => { version.current++; active.current?.abort() }, [])
  useEffect(() => {
    if (!file) return
    let current = true
    void file.arrayBuffer().then(buffer => { rasterHeader(new Uint8Array(buffer)); if (current) setValidatedFile(file) })
      .catch(cause => { if (current) setValidationError(cause instanceof ImageVectorError ? cause.code : "decode") })
    return () => { current = false }
  }, [file])
  const replaceFile = (next: File | null) => {
    setResult(null); setError(""); setZoom("100"); setValidatedFile(null); setValidationError(null)
    if (next && (next.size > VECTOR_LIMITS.fileBytes || next.size === 0)) { setFile(null); setError(t("error_fileLimit")); return }
    setFile(next)
  }
  const choose = (next: File | null) => { invalidate(); setSampleLoading(false); replaceFile(next) }
  const update = (key: keyof ImageVectorOptions, value: string | number) => { setOptions(previous => ({ ...previous, [key]: value })); setResult(null); setError("") }
  const example = async (type: VectorSample) => {
    const id = invalidate(); setSampleLoading(true); setError(""); setResult(null)
    try { const next = await createVectorSample(type); if (version.current === id) replaceFile(next) }
    catch { if (version.current === id) setError(t("error_decode")) }
    finally { if (version.current === id) setSampleLoading(false) }
  }
  const run = async () => {
    if (!file || file !== validatedFile) return
    const id = invalidate(), controller = new AbortController(); active.current = controller
    setResult(null); setError(""); setStage("reading")
    try {
      const next = await vectorizeImage(file, options, { signal: controller.signal, onProgress: value => { if (version.current === id) setStage(value) } })
      if (version.current === id) setResult(next)
    } catch (cause) { if (version.current === id) setError(t(`error_${cause instanceof ImageVectorError ? cause.code : "engine"}`)) }
    finally { if (version.current === id) { setStage(null); active.current = null } }
  }
  const copy = async () => { if (!result) return; try { await navigator.clipboard.writeText(result.svg); toast({ description: t("copied") }) } catch { toast({ description: t("copyFailed"), variant: "destructive" }) } }
  const preview = (url: string | null, label: string, svg = false) => <section className={`${frame} min-w-0 overflow-hidden`}><div className="border-b border-[var(--md-sys-color-outline-variant)] px-4 py-3 text-sm font-semibold">{label}</div><div className="h-80 overflow-auto" style={checker}>{url ? <div className="relative" style={{ width: `${Number(zoom)}%`, height: 320 * zoomFactor }}><img src={url} alt={label} draggable={false} className="absolute inset-0 h-full w-full object-contain" /></div> : <div className="flex h-full items-center justify-center px-6 text-center text-sm text-[var(--md-sys-color-on-surface-variant)]">{svg ? t("outputEmpty") : t("inputEmpty")}</div>}</div></section>

  return <div className="container mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6">
    <header className="space-y-3"><h1 className="flex items-center gap-3 text-2xl font-bold sm:text-3xl"><PenTool className="h-7 w-7 text-[var(--md-sys-color-primary)]" />{t("title")}</h1><p className="max-w-3xl text-sm leading-6 text-[var(--md-sys-color-on-surface-variant)]">{t("description")}</p></header>
    <section className={`${frame} space-y-4 p-5`} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); if (event.dataTransfer.files[0]) choose(event.dataTransfer.files[0]) }}>
      <input ref={inputRef} type="file" className="hidden" accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp" onChange={event => { choose(event.target.files?.[0] ?? null); event.target.value = "" }} />
      <div className="flex flex-wrap items-center gap-3"><Button className="h-12" onClick={() => inputRef.current?.click()}><ImagePlus className="h-4 w-4" />{t("chooseFile")}</Button><span className="min-w-0 flex-1 break-all text-sm">{file ? `${file.name} · ${size(file.size)}` : t("fileHint")}</span>{file && <Button variant="ghost" size="icon" aria-label={t("clear")} onClick={() => choose(null)}><X className="h-4 w-4" /></Button>}</div>
      <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--md-sys-color-on-surface-variant)]"><span>{t("trySample")}</span>{(["icon", "illustration", "gradient"] as const).map(type => <Button key={type} variant="outline" size="sm" disabled={sampleLoading} onClick={() => void example(type)}>{t(`sample_${type}`)}</Button>)}{sampleLoading && <Loader2 className="h-4 w-4 animate-spin" />}</div>
      <p className="text-xs leading-5 text-[var(--md-sys-color-on-surface-variant)]">{t("limits")}</p>
    </section>
    <section className={`${frame} space-y-5 p-5`}>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Option id="vector-tracing" label={t("tracing")} value={options.tracing} onChange={value => update("tracing", value)} choices={[["faithful", t("faithful")], ["smooth", t("smooth")]]} disabled={busy} />
        <Option id="vector-mode" label={t("mode")} value={options.mode} onChange={value => update("mode", value)} choices={[["color", t("color")], ["monochrome", t("monochrome")]]} disabled={busy} />
        <Option id="vector-edge" label={t("resolution")} value={String(options.maxEdge)} onChange={value => update("maxEdge", Number(value))} choices={[512, 768, 1024, 1600, 2048].map(edge => [String(edge), `${edge} px`])} disabled={busy} />
        {options.mode === "color" ? <Option id="vector-colors" label={t("colorPrecision")} value={options.colorPrecision} onChange={value => update("colorPrecision", value)} choices={[["fine", t("fine")], ["balanced", t("standard")], ["simple", t("fewerColors")]]} disabled={busy} /> : <div className="space-y-2"><Label htmlFor="vector-threshold">{t("threshold")}</Label><Input id="vector-threshold" type="number" min={0} max={255} value={options.threshold} disabled={busy} onChange={event => update("threshold", Number(event.target.value))} /></div>}
        {options.tracing === "smooth" && <Option id="vector-detail" label={t("detail")} value={options.detail} onChange={value => update("detail", value)} choices={[["high", t("high")], ["balanced", t("balanced")], ["simple", t("simple")]]} disabled={busy} />}
        <Option id="vector-alpha" label={t("background")} value={options.alpha} onChange={value => update("alpha", value)} choices={[["transparent", t("preserveTransparency")], ["white", t("whiteBackground")]]} disabled={busy} />
      </div>
      <div className="space-y-1 text-xs leading-5 text-[var(--md-sys-color-on-surface-variant)]"><p>{options.tracing === "faithful" ? t("faithfulHint") : t("smoothHint")}</p><p>{t("alphaHint")}</p></div>
      <div className="flex flex-wrap items-center gap-3"><Button onClick={() => void run()} disabled={!file || file !== validatedFile || busy || sampleLoading}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <PenTool className="h-4 w-4" />}{busy ? t(`stage_${stage}`) : t("convert")}</Button>{busy && <Button variant="outline" onClick={() => { invalidate(); setError(t("error_cancelled")) }}>{t("cancel")}</Button>}<Button variant="ghost" disabled={busy} onClick={() => { setOptions(DEFAULT_VECTOR_OPTIONS); setResult(null); setError("") }}><RotateCcw className="h-4 w-4" />{t("reset")}</Button><span className="text-xs text-[var(--md-sys-color-on-surface-variant)]">{t("local")}</span></div>
      {(error || validationError) && <p role="alert" className="rounded-xl bg-[var(--md-sys-color-error-container)] px-4 py-3 text-sm text-[var(--md-sys-color-on-error-container)]">{validationError ? t(`error_${validationError}`) : error}</p>}
    </section>
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4"><h2 className="text-lg font-semibold">{t("compare")}</h2><div className="flex flex-wrap gap-3"><Option id="vector-comparison" label={t("compareMode")} value={comparison} onChange={setComparison} choices={[["side", t("sideBySide")], ["overlay", t("overlay")]]} /><Option id="vector-zoom" label={t("zoom")} value={zoom} onChange={setZoom} choices={[["100", t("fit")], ["200", "200%"], ["400", "400%"]]} /></div></div>
      {comparison === "overlay" && inputUrl && outputUrl ? <div className={`${frame} space-y-3 p-4`}><div className="flex justify-between text-sm"><span>{t("original")}</span><span>SVG</span></div><div className="h-80 overflow-auto rounded-xl" style={checker}><div className="relative" style={{ width: `${Number(zoom)}%`, height: 320 * zoomFactor }}><img src={inputUrl} alt={t("original")} className="absolute inset-0 h-full w-full object-contain" draggable={false} /><div className="absolute inset-0" style={{ ...checker, backgroundColor: "var(--md-sys-color-surface-container-lowest)", clipPath: `inset(0 0 0 ${position}%)` }}><img src={outputUrl} alt={t("svgPreview")} className="h-full w-full object-contain" draggable={false} /></div><div aria-hidden="true" className="pointer-events-none absolute inset-y-0 w-0.5 bg-[var(--md-sys-color-primary)]" style={{ left: `${position}%` }} /></div></div><Label htmlFor="vector-compare-position">{t("comparePosition")}</Label><input id="vector-compare-position" type="range" min={0} max={100} value={position} onChange={event => setPosition(Number(event.target.value))} className="w-full accent-[var(--md-sys-color-primary)]" /></div> : <div className="grid gap-4 lg:grid-cols-2">{preview(inputUrl, t("original"))}{preview(outputUrl, t("svgPreview"), true)}</div>}
    </section>
    {result && <section className={`${frame} space-y-4 p-5`}>
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">{t("result")}</h2><div className="flex flex-wrap gap-2">{outputUrl && <Button asChild><a href={outputUrl} download={result.file.name}><Download className="h-4 w-4" />{t("download")}</a></Button>}<Button variant="outline" onClick={() => void copy()}><Copy className="h-4 w-4" />{t("copy")}</Button><SendToMenu value={result.file} source={t("title")} /></div></div>
      <dl className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">{[[t("sourceSize"), `${result.info.sourceWidth} × ${result.info.sourceHeight}`], [t("traceSize"), `${result.info.width} × ${result.info.height}`], [t("pathCount"), result.info.paths.toLocaleString()], [t("outputSize"), `${size(result.info.bytes)} · ${(result.info.elapsedMs / 1000).toFixed(2)} s`]].map(([label, value]) => <div key={label}><dt className="text-[var(--md-sys-color-on-surface-variant)]">{label}</dt><dd className="mt-1 font-mono">{value}</dd></div>)}</dl>
      <div className="space-y-1 text-xs leading-5 text-[var(--md-sys-color-on-surface-variant)]"><p>{t("resultHint")}</p>{(result.info.sourceWidth !== result.info.width || result.info.sourceHeight !== result.info.height) && <p>{t("resized")}</p>}{result.info.animated && <p>{t("firstFrame")}</p>}{result.info.semiTransparentPixels > 0 && <p>{t("semiTransparent")}</p>}</div>
      <details><summary className="cursor-pointer text-sm font-medium">{t("viewCode")}</summary><pre className="mt-3 max-h-72 overflow-auto rounded-xl bg-[var(--md-sys-color-surface-container)] p-4 text-xs">{result.svg.slice(0, 64000)}</pre>{result.svg.length > 64000 && <p className="mt-2 text-xs text-[var(--md-sys-color-on-surface-variant)]">{t("codeTruncated")}</p>}</details>
    </section>}
  </div>
}
