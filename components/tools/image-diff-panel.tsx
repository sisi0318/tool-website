"use client"

import { useEffect, useId, useMemo, useRef, useState, type PointerEvent } from "react"
import { ArrowLeftRight, Download, GitCompareArrows, Loader2, Upload, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useTranslations } from "@/hooks/use-translations"
import { useObjectUrl } from "@/hooks/use-object-url"
import { OcrError } from "@/lib/ocr-shared"
import { createDiffSamples, runImageDiff } from "@/lib/image-diff"
import { DEFAULT_IMAGE_DIFF_OPTIONS, imageDiffLayout, type DiffSource, type ImageDiffOptions, type ImageDiffResult, type ImageDiffStage } from "@/lib/image-diff-shared"
import { SendToMenu } from "./send-to-menu"

const frame = "rounded-2xl border border-md-outline-variant bg-md-surface-container-lowest p-4 sm:p-5"
const checker = { backgroundColor: "#fff", backgroundImage: "conic-gradient(#e2e5e9 25%, transparent 0 50%, #e2e5e9 0 75%, transparent 0)", backgroundSize: "20px 20px" }
type Item = { file: File; source: DiffSource }
export default function ImageDiffPanel() {
  const t = useTranslations("imageDiff"), ot = useTranslations("ocrTools"), clipId = useId().replace(/:/g, "")
  const [items, setItems] = useState<[Item | null, Item | null]>([null, null]), [options, setOptions] = useState<ImageDiffOptions>({ ...DEFAULT_IMAGE_DIFF_OPTIONS })
  const [result, setResult] = useState<ImageDiffResult | null>(null), [busy, setBusy] = useState(false), [stage, setStage] = useState<ImageDiffStage | "prepare" | null>(null), [notice, setNotice] = useState("")
  const [mode, setMode] = useState<"wipe" | "overlay" | "difference">("wipe"), [amount, setAmount] = useState(50), [zoom, setZoom] = useState(100)
  const version = useRef(0), active = useRef<AbortController | null>(null), inputs = useRef<Array<HTMLInputElement | null>>([]), drag = useRef<number | null>(null)
  const aUrl = useObjectUrl(items[0]?.source.preview), bUrl = useObjectUrl(items[1]?.source.preview), diffUrl = useObjectUrl(result?.preview), downloadUrl = useObjectUrl(result?.output)
  const report = useMemo(() => result && new Blob([JSON.stringify({ images: items.map(item => ({ name: item!.file.name, width: item!.source.width, height: item!.source.height })), options, coordinateSpace: "comparison-canvas-pixels", layout: result.layout, ...result.stats }, null, 2)], { type: "application/json" }), [result, items, options])
  const reportUrl = useObjectUrl(report)
  const outputFile = useMemo(() => result ? new File([result.output], "image-difference.png", { type: "image/png" }) : null, [result])
  useEffect(() => () => { version.current++; active.current?.abort() }, [])
  const cancel = () => { version.current++; active.current?.abort(); active.current = null; setBusy(false); setStage(null) }
  const clear = () => { cancel(); setItems([null, null]); setResult(null); setNotice(""); drag.current = null }
  const describe = (error: unknown) => error instanceof OcrError ? error.code === "imageLimit" ? t("imageLimit") : error.code === "options" ? t("optionsError") : error.code === "timeout" ? t("timeout") : ot(`error_${error.code}`) : t("error")
  const load = async (side: 0 | 1, file: File) => {
    cancel(); setResult(null); setNotice(""); const ticket = ++version.current, controller = new AbortController(); active.current = controller; setBusy(true); setStage("prepare")
    try { const response = await runImageDiff({ action: "prepare", file }, { signal: controller.signal }); if (ticket === version.current && "source" in response) setItems(current => side === 0 ? [{ file, source: response.source }, current[1]] : [current[0], { file, source: response.source }]) }
    catch (error) { if (ticket === version.current) setNotice(describe(error)) }
    finally { if (ticket === version.current) { setBusy(false); setStage(null); active.current = null } }
  }
  const samples = async () => {
    clear(); const ticket = ++version.current, controller = new AbortController(); active.current = controller; setBusy(true); setStage("prepare")
    try {
      const files = await createDiffSamples(), next: Item[] = []
      for (const file of files) { if (ticket !== version.current) return; const response = await runImageDiff({ action: "prepare", file }, { signal: controller.signal }); if ("source" in response) next.push({ file, source: response.source }) }
      if (ticket === version.current) { setItems(next as [Item, Item]); setOptions({ ...DEFAULT_IMAGE_DIFF_OPTIONS }); setZoom(100) }
    } catch (error) { if (ticket === version.current) setNotice(describe(error)) }
    finally { if (ticket === version.current) { setBusy(false); setStage(null); active.current = null } }
  }
  const compare = async () => {
    if (!items[0] || !items[1] || busy) return
    setResult(null); setNotice(""); const ticket = ++version.current, controller = new AbortController(); active.current = controller; setBusy(true)
    try {
      imageDiffLayout(items[0].source, items[1].source, options)
      const response = await runImageDiff({ action: "compare", a: items[0].file, b: items[1].file, options }, { signal: controller.signal, onProgress: value => { if (ticket === version.current) setStage(value) } })
      if (ticket === version.current && "result" in response) setResult(response.result)
    } catch (error) { if (ticket === version.current) setNotice(describe(error)) }
    finally { if (ticket === version.current) { setBusy(false); setStage(null); active.current = null } }
  }
  const changeOptions = (next: Partial<ImageDiffOptions>) => { setOptions(current => ({ ...current, ...next })); setResult(null); setNotice("") }
  const wipe = (event: PointerEvent<SVGSVGElement>) => { if (mode !== "wipe") return; const box = event.currentTarget.getBoundingClientRect(); setAmount(Math.round(Math.max(0, Math.min(100, (event.clientX - box.left) / box.width * 100)))) }
  return <div className="space-y-5">
    <header><h1 className="flex items-center gap-3 text-2xl font-semibold"><GitCompareArrows className="h-7 w-7 text-md-primary" />{t("title")}</h1><p className="mt-2 max-w-4xl text-sm leading-6 text-md-on-surface-variant">{t("description")}</p></header>
    <div className="grid gap-4 md:grid-cols-2">{([0, 1] as const).map(side => <section key={side} className={`${frame} space-y-3`} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); if (!busy && event.dataTransfer.files[0]) void load(side, event.dataTransfer.files[0]) }} onPaste={event => { if (!busy && event.clipboardData.files[0]) { event.preventDefault(); void load(side, event.clipboardData.files[0]) } }}>
      <div className="flex items-center justify-between gap-3"><h2 className="font-semibold">{t(side === 0 ? "a" : "b")}</h2><Button variant="outline" size="sm" disabled={busy} onClick={() => inputs.current[side]?.click()}><Upload />{t("choose")}</Button></div>
      <input ref={element => { inputs.current[side] = element }} aria-label={t(side === 0 ? "uploadA" : "uploadB")} className="hidden" type="file" accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp" onChange={event => { if (!busy && event.target.files?.[0]) void load(side, event.target.files[0]); event.target.value = "" }} />
      {items[side] ? <><p className="break-all text-xs text-md-on-surface-variant">{items[side].file.name} · {items[side].source.width} × {items[side].source.height}{items[side].source.animated ? ` · ${ot("firstFrame")}` : ""}</p><div className="flex h-36 items-center justify-center overflow-hidden rounded-lg" style={checker}>{(side === 0 ? aUrl : bUrl) && <img src={(side === 0 ? aUrl : bUrl) ?? undefined} alt={t(side === 0 ? "previewA" : "previewB")} className="max-h-full max-w-full object-contain" />}</div></> : <div className="flex h-36 items-center justify-center rounded-lg border border-dashed border-md-outline-variant p-4 text-center text-sm text-md-on-surface-variant">{t("dropHint")}</div>}
    </section>)}</div>
    <section className={`${frame} space-y-4`}>
      <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={busy} onClick={() => void samples()}>{t("sample")}</Button><Button variant="ghost" disabled={busy || !items[0] || !items[1]} onClick={() => { setItems([items[1], items[0]]); setResult(null); setOptions(current => ({ ...current, offsetX: 0, offsetY: 0 })) }}><ArrowLeftRight />{t("swap")}</Button><Button variant="ghost" onClick={clear}><X />{t("clear")}</Button></div>
      <p className="text-xs leading-5 text-md-on-surface-variant">{t("limits")}</p>
      <div className="flex flex-wrap items-end gap-4"><label className="space-y-1 text-sm"><span className="block">{t("alignment")}</span><select aria-label={t("alignment")} value={options.alignment} disabled={busy} onChange={event => changeOptions({ alignment: event.target.value as ImageDiffOptions["alignment"] })} className="h-10 rounded-lg border border-md-outline-variant bg-md-surface px-3"><option value="top-left">{t("topLeft")}</option><option value="center">{t("center")}</option></select></label>{(["offsetX", "offsetY", "threshold"] as const).map(key => <label key={key} className="w-36 space-y-1 text-sm"><span className="block">{t(key)}</span><Input aria-label={t(key)} type="number" min={key === "threshold" ? 0 : -32768} max={key === "threshold" ? 255 : 32768} step={1} disabled={busy} value={Number.isNaN(options[key]) ? "" : options[key]} onChange={event => changeOptions({ [key]: event.target.value === "" ? NaN : Number(event.target.value) })} /></label>)}<Button disabled={busy || !items[0] || !items[1]} onClick={() => void compare()}>{t("compare")}</Button></div>
      <p className="text-xs leading-5 text-md-on-surface-variant">{t("optionsHint")}</p>
      {busy && <div role="status" className="flex flex-wrap items-center gap-2 text-sm"><Loader2 className="h-4 w-4 animate-spin" />{stage ? t(`stage_${stage}`) : t("compare")}<Button variant="outline" size="sm" onClick={cancel}>{t("cancel")}</Button></div>}{notice && <p role="status" className="text-sm text-md-error">{notice}</p>}
    </section>
    {result && items[0] && items[1] && <section className={`${frame} space-y-4`}>
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold">{t("result")}</h2><span className="text-sm text-md-on-surface-variant">{result.layout.width} × {result.layout.height}</span></div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{[["changed", `${result.stats.changed.toLocaleString()} (${(result.stats.changed / result.stats.compared * 100).toFixed(2)}%)`], ["compared", result.stats.compared.toLocaleString()], ["onlyA", result.stats.onlyA.toLocaleString()], ["onlyB", result.stats.onlyB.toLocaleString()]].map(([key, value]) => <div key={key} className="rounded-xl bg-md-surface-container-low p-3"><div className="text-xs text-md-on-surface-variant">{t(key)}</div><div className="mt-1 break-words font-semibold tabular-nums">{value}</div></div>)}</div>
      <div className="flex flex-wrap items-center gap-2">{(["wipe", "overlay", "difference"] as const).map(value => <Button key={value} size="sm" variant={mode === value ? "default" : "outline"} aria-pressed={mode === value} onClick={() => setMode(value)}>{t(value)}</Button>)}<label className="ml-auto flex items-center gap-2 text-sm">{t("zoom")}<select aria-label={t("zoom")} value={zoom} onChange={event => setZoom(Number(event.target.value))} className="rounded-lg border border-md-outline-variant bg-md-surface p-2">{[100, 200, 400].map(value => <option key={value} value={value}>{value}%</option>)}</select></label></div>
      {mode !== "difference" && <label className="flex items-center gap-3 text-sm"><span className="min-w-24">{t(mode === "wipe" ? "position" : "opacity")}</span><input aria-label={t(mode === "wipe" ? "position" : "opacity")} type="range" min={0} max={100} value={amount} onChange={event => setAmount(Number(event.target.value))} className="min-w-0 flex-1 accent-md-primary" /><span className="w-10 text-right tabular-nums">{amount}%</span></label>}
      <div className="max-h-[680px] overflow-auto rounded-xl border border-md-outline-variant" style={checker}><svg role="img" aria-label={t("comparisonPreview")} viewBox={`0 0 ${result.layout.width} ${result.layout.height}`} className={`block h-auto ${mode === "wipe" ? "touch-none cursor-ew-resize" : ""}`} style={{ width: `${zoom}%` }} onPointerDown={event => { if (mode !== "wipe") return; drag.current = event.pointerId; event.currentTarget.setPointerCapture(event.pointerId); wipe(event) }} onPointerMove={event => { if (drag.current === event.pointerId) wipe(event) }} onPointerUp={() => { drag.current = null }} onPointerCancel={() => { drag.current = null }}>
        <defs><clipPath id={clipId}><rect width={result.layout.width * amount / 100} height={result.layout.height} /></clipPath><clipPath id={`${clipId}-b`}><rect x={result.layout.width * amount / 100} width={result.layout.width * (100 - amount) / 100} height={result.layout.height} /></clipPath></defs>
        {mode === "difference" ? diffUrl && <image href={diffUrl} width={result.layout.width} height={result.layout.height} /> : <>
          {mode === "wipe" && bUrl && <image href={bUrl} x={result.layout.bx} y={result.layout.by} width={items[1].source.width} height={items[1].source.height} clipPath={`url(#${clipId}-b)`} />}
          {aUrl && <image href={aUrl} x={result.layout.ax} y={result.layout.ay} width={items[0].source.width} height={items[0].source.height} clipPath={mode === "wipe" ? `url(#${clipId})` : undefined} />}
          {mode === "overlay" && bUrl && <image href={bUrl} x={result.layout.bx} y={result.layout.by} width={items[1].source.width} height={items[1].source.height} opacity={amount / 100} />}
          {mode === "wipe" && <line x1={result.layout.width * amount / 100} x2={result.layout.width * amount / 100} y1={0} y2={result.layout.height} stroke="#2563eb" strokeWidth="3" vectorEffect="non-scaling-stroke" />}
        </>}
      </svg></div>
      <p role="status" className="text-sm leading-6 text-md-on-surface-variant">{t(mode === "wipe" ? "wipeHint" : mode === "overlay" ? "overlayHint" : "diffHint")} {result.stats.changed === 0 ? t("identical") : result.stats.bounds && `${t("bounds")} X=${result.stats.bounds.x}, Y=${result.stats.bounds.y}, ${result.stats.bounds.width} × ${result.stats.bounds.height}`}</p>
      <div className="flex flex-wrap gap-2">{downloadUrl && <Button asChild><a href={downloadUrl} download="image-difference.png"><Download />{t("download")}</a></Button>}{reportUrl && <Button asChild variant="outline"><a href={reportUrl} download="image-difference.json">{t("report")}</a></Button>}{outputFile && <SendToMenu value={outputFile} source={t("title")} />}</div>
    </section>}
  </div>
}
