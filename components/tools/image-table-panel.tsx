"use client"

import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react"
import { Download, Loader2, ScanText, Table2, Upload, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useTranslations } from "@/hooks/use-translations"
import { useObjectUrl } from "@/hooks/use-object-url"
import { recognizeImage } from "@/lib/ocr-worker-client"
import { OcrError, type OcrLine, type OcrProgress } from "@/lib/ocr-shared"
import { createTableSample, runImageTable } from "@/lib/image-table"
import { inferTableGrid, populateTable, tableColumnName, tableCsv, tableGrid, TABLE_LIMITS, type TableData, type TableGrid, type TableImage } from "@/lib/image-table-shared"
import { SendToMenu } from "./send-to-menu"

const frame = "rounded-2xl border border-md-outline-variant bg-md-surface-container-lowest p-4 sm:p-5"
export default function ImageTablePanel() {
  const t = useTranslations("imageTable"), ot = useTranslations("ocrTools")
  const [file, setFile] = useState<File | null>(null), [source, setSource] = useState<TableImage | null>(null), [lines, setLines] = useState<OcrLine[] | null>(null)
  const [grid, setGrid] = useState<TableGrid | null>(null), [draftX, setDraftX] = useState(""), [draftY, setDraftY] = useState("")
  const [data, setData] = useState<TableData | null>(null), [selected, setSelected] = useState<[number, number]>([0, 0])
  const [phase, setPhase] = useState<"prepare" | "recognize" | "export" | null>(null), [progress, setProgress] = useState<OcrProgress | null>(null), [notice, setNotice] = useState("")
  const [numbers, setNumbers] = useState(false), [safeCsv, setSafeCsv] = useState(true), [zoom, setZoom] = useState(100), [output, setOutput] = useState<File | null>(null)
  const input = useRef<HTMLInputElement>(null), version = useRef(0), active = useRef<AbortController | null>(null), dragging = useRef<{ axis: "x" | "y"; index: number; pointer: number } | null>(null)
  const previewUrl = useObjectUrl(source?.preview), outputUrl = useObjectUrl(output), busy = phase !== null
  const draftGrid = useMemo(() => {
    if (!source) return null
    try { return tableGrid({ x: draftX.split(/[,，\s]+/).filter(Boolean).map(Number), y: draftY.split(/[,，\s]+/).filter(Boolean).map(Number) }, source.width, source.height) } catch { return null }
  }, [draftX, draftY, source])
  const changed = !!grid && JSON.stringify(grid) !== JSON.stringify(draftGrid)
  const reviewCount = data?.cells.flat().filter(cell => cell.review).length ?? 0
  const csv = useMemo(() => { try { return data ? tableCsv(data.cells.map(row => row.map(cell => cell.text)), safeCsv) : "" } catch { return "" } }, [data, safeCsv])
  useEffect(() => () => { version.current++; active.current?.abort() }, [])
  const cancel = () => { version.current++; active.current?.abort(); active.current = null; setPhase(null); setProgress(null) }
  const clear = () => { cancel(); setFile(null); setSource(null); setLines(null); setGrid(null); setDraftX(""); setDraftY(""); setData(null); setOutput(null); setNotice(""); dragging.current = null }
  const errorText = (error: unknown) => error instanceof OcrError ? error.code === "outputLimit" ? t("limitError") : error.code === "options" ? t("gridError") : ot(`error_${error.code}`) : t("error")
  const showGrid = (next: TableGrid) => { setDraftX(next.x.join(", ")); setDraftY(next.y.join(", ")) }
  const load = async (incoming: File | Promise<File>) => {
    clear(); const ticket = ++version.current, controller = new AbortController(); active.current = controller; setPhase("prepare")
    try { const nextFile = await incoming; if (ticket !== version.current) return; const result = await runImageTable({ action: "prepare", file: nextFile }, controller.signal); if (ticket === version.current && "image" in result) { setFile(nextFile); setSource(result.image); setZoom(100) } }
    catch (error) { if (ticket === version.current) setNotice(errorText(error)) }
    finally { if (ticket === version.current) { setPhase(null); active.current = null } }
  }
  const recognize = async () => {
    if (!file || !source || busy) return
    const ticket = ++version.current, controller = new AbortController(); active.current = controller; setPhase("recognize"); setNotice(""); setOutput(null)
    try {
      const result = await recognizeImage(file, { rotation: 0, enhanceSmallText: true }, { signal: controller.signal, onProgress: value => { if (ticket === version.current) setProgress(value) } })
      if (ticket !== version.current) return
      if (result.info.width !== source.width || result.info.height !== source.height) throw new OcrError("options")
      if (!data) setLines(result.lines)
      const next = inferTableGrid(result.lines, source.width, source.height, source.rules), table = populateTable(result.lines, next)
      setLines(result.lines)
      setGrid(next); showGrid(next); setData(table); setSelected([0, 0]); setNotice(result.lines.length ? t(source.rules.x.length >= 2 && source.rules.y.length >= 2 ? "rulesFound" : "inferred") : ot("noText"))
    } catch (error) { if (ticket === version.current) { setNotice(errorText(error)); if (!data) showGrid({ x: [0, source.width], y: [0, source.height] }) } }
    finally { if (ticket === version.current) { setPhase(null); setProgress(null); active.current = null } }
  }
  const rebuild = () => {
    if (!draftGrid || !lines) return
    try { setData(populateTable(lines, draftGrid)); setGrid(draftGrid); setSelected([0, 0]); setOutput(null); setNotice(t("rebuilt")) } catch (error) { setNotice(errorText(error)) }
  }
  const edit = (r: number, c: number, text: string) => {
    setData(current => current && { ...current, cells: current.cells.map((row, ri) => row.map((cell, ci) => ri === r && ci === c ? { text, review: false } : cell)) }); setOutput(null)
  }
  const exportFile = async (format: "csv" | "xlsx") => {
    if (!data || busy || changed) return
    const ticket = ++version.current, controller = new AbortController(); active.current = controller; setPhase("export"); setNotice(""); setOutput(null)
    try { const result = await runImageTable({ action: "export", cells: data.cells.map(row => row.map(cell => cell.text)), format, numbers, safeCsv }, controller.signal); if (ticket === version.current && "output" in result) setOutput(new File([result.output], `${file?.name.replace(/\.[^.]*$/, "").replace(/[\\/\u0000-\u001f]/g, "_").slice(0, 100) || "table"}.${format}`, { type: result.output.type })) }
    catch (error) { if (ticket === version.current) setNotice(errorText(error)) }
    finally { if (ticket === version.current) { setPhase(null); active.current = null } }
  }
  const moveBoundary = (event: PointerEvent<SVGSVGElement>) => {
    const drag = dragging.current
    if (!drag || drag.pointer !== event.pointerId || !draftGrid || !source) return
    const rect = event.currentTarget.getBoundingClientRect(), values = [...draftGrid[drag.axis]], end = drag.axis === "x" ? source.width : source.height
    const position = drag.axis === "x" ? (event.clientX - rect.left) / rect.width * source.width : (event.clientY - rect.top) / rect.height * source.height
    values[drag.index] = Math.round(Math.max(drag.index ? values[drag.index - 1] + 2 : 0, Math.min(drag.index < values.length - 1 ? values[drag.index + 1] - 2 : end, position)))
    showGrid({ ...draftGrid, [drag.axis]: values }); setOutput(null)
  }
  const beginDrag = (event: PointerEvent<SVGLineElement>, axis: "x" | "y", index: number) => { if (busy) return; event.preventDefault(); dragging.current = { axis, index, pointer: event.pointerId }; event.currentTarget.ownerSVGElement?.setPointerCapture(event.pointerId) }
  return <div className="space-y-5" onPaste={event => { const pasted = event.clipboardData.files[0]; if (!busy && pasted) { event.preventDefault(); void load(pasted) } }}>
    <header><h1 className="flex items-center gap-3 text-2xl font-semibold"><Table2 className="h-7 w-7 text-md-primary" />{t("title")}</h1><p className="mt-2 max-w-4xl text-sm leading-6 text-md-on-surface-variant">{t("description")}</p></header>
    <section className={`${frame} space-y-3`} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); if (!busy && event.dataTransfer.files[0]) void load(event.dataTransfer.files[0]) }}>
      <input ref={input} aria-label={t("upload")} type="file" accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp" className="hidden" onChange={event => { if (!busy && event.target.files?.[0]) void load(event.target.files[0]); event.target.value = "" }} />
      <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={busy} onClick={() => input.current?.click()}><Upload />{t("upload")}</Button><Button variant="ghost" disabled={busy} onClick={() => void load(createTableSample())}>{t("sample")}</Button>{file && <Button variant="ghost" onClick={clear}><X />{t("clear")}</Button>}<Button disabled={busy || !source} onClick={() => void recognize()}><ScanText />{t("recognize")}</Button></div>
      <p className="text-xs leading-5 text-md-on-surface-variant">{t("limits")} {ot("downloadHint")}</p>
      {file && <p className="break-all text-sm">{file.name} · {source?.width} × {source?.height}{source?.animated ? ` · ${ot("firstFrame")}` : ""}</p>}
      {busy && <div role="status" className="flex flex-wrap items-center gap-2 text-sm"><Loader2 className="h-4 w-4 animate-spin" />{t(`phase_${phase}`)}{progress && <span>{ot(`stage_${progress.stage}`)}{progress.total ? ` ${progress.completed ?? 0}/${progress.total}` : ""}</span>}<Button variant="outline" size="sm" onClick={cancel}>{t("cancel")}</Button></div>}
      {notice && <p role="status" className="text-sm leading-6 text-md-primary">{notice}</p>}
    </section>
    {source && previewUrl && <section className={`${frame} space-y-4`}>
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold">{t("structure")}</h2><label className="flex items-center gap-2 text-sm">{t("zoom")}<select aria-label={t("zoom")} className="rounded-lg border border-md-outline-variant bg-md-surface p-2" value={zoom} onChange={event => setZoom(Number(event.target.value))}>{[100, 200, 400].map(value => <option key={value} value={value}>{value}%</option>)}</select></label></div>
      <div className="max-h-[560px] overflow-auto rounded-xl border border-md-outline-variant bg-white"><div className="relative" style={{ width: `${zoom}%` }}>
        <img src={previewUrl} alt={t("preview")} width={source.width} height={source.height} className="block h-auto w-full" draggable={false} />
        {draftGrid && <svg aria-label={t("boundaries")} viewBox={`0 0 ${source.width} ${source.height}`} className="absolute inset-0 h-full w-full touch-none" onPointerMove={moveBoundary} onPointerUp={event => { moveBoundary(event); dragging.current = null }} onPointerCancel={() => { dragging.current = null }}>
          {!changed && grid && data && <rect x={grid.x[selected[1]]} y={grid.y[selected[0]]} width={grid.x[selected[1] + 1] - grid.x[selected[1]]} height={grid.y[selected[0] + 1] - grid.y[selected[0]]} fill="#60a5fa" fillOpacity="0.2" pointerEvents="none" />}
          {(["x", "y"] as const).flatMap(axis => draftGrid[axis].map((value, index) => <g key={`${axis}-${index}`}><line x1={axis === "x" ? value : draftGrid.x[0]} x2={axis === "x" ? value : draftGrid.x.at(-1)} y1={axis === "y" ? value : draftGrid.y[0]} y2={axis === "y" ? value : draftGrid.y.at(-1)} stroke="#2563eb" strokeWidth="1.5" vectorEffect="non-scaling-stroke" pointerEvents="none" /><line data-boundary={`${axis}-${index}`} x1={axis === "x" ? value : draftGrid.x[0]} x2={axis === "x" ? value : draftGrid.x.at(-1)} y1={axis === "y" ? value : draftGrid.y[0]} y2={axis === "y" ? value : draftGrid.y.at(-1)} stroke="transparent" strokeWidth="12" vectorEffect="non-scaling-stroke" style={{ cursor: axis === "x" ? "ew-resize" : "ns-resize" }} onPointerDown={event => beginDrag(event, axis, index)} /></g>))}
        </svg>}
      </div></div>
      {lines && <><p className="text-xs leading-5 text-md-on-surface-variant">{t("gridHint")}</p><div className="grid gap-3 md:grid-cols-2"><label className="min-w-0 space-y-1 text-sm"><span>{t("xEdges")}</span><Input aria-label={t("xEdges")} value={draftX} disabled={busy} onChange={event => { setDraftX(event.target.value); setOutput(null) }} className="font-mono" /></label><label className="min-w-0 space-y-1 text-sm"><span>{t("yEdges")}</span><Input aria-label={t("yEdges")} value={draftY} disabled={busy} onChange={event => { setDraftY(event.target.value); setOutput(null) }} className="font-mono" /></label></div><div className="flex flex-wrap items-center gap-3"><Button variant="outline" disabled={busy || !draftGrid} onClick={rebuild}>{t("rebuild")}</Button>{grid && <Button variant="ghost" disabled={busy || !changed} onClick={() => showGrid(grid)}>{t("resetGrid")}</Button>}{!draftGrid && <span role="alert" className="text-sm text-md-error">{t("gridError")}</span>}{changed && <span className="text-sm text-md-on-surface-variant">{t("changed")}</span>}</div></>}
    </section>}
    {data && <section className={`${frame} space-y-4`}>
      <div><h2 className="font-semibold">{t("review")} · {data.cells.length} × {data.cells[0].length}</h2><p className="mt-2 text-xs leading-5 text-md-on-surface-variant">{t("reviewHint")} {t("reviewCount").replace("{count}", String(reviewCount))}{data.outside > 0 ? ` ${t("outside").replace("{count}", String(data.outside))}` : ""}</p></div>
      <div className="max-h-[560px] overflow-auto rounded-xl border border-md-outline-variant"><table className="w-full border-collapse text-sm"><thead className="sticky top-0 z-10 bg-md-surface-container"><tr><th className="w-10 p-2" aria-label={t("row")} />{data.cells[0].map((_, c) => <th key={c} className="border-l border-md-outline-variant px-3 py-2">{tableColumnName(c)}</th>)}</tr></thead><tbody>{data.cells.map((row, r) => <tr key={r}><th className="bg-md-surface-container px-2 text-center font-normal">{r + 1}</th>{row.map((cell, c) => <td key={c} className={`border-l border-t border-md-outline-variant p-0 ${cell.review ? "bg-amber-100 dark:bg-amber-950" : ""}`}><textarea aria-label={`${t("cell")} ${tableColumnName(c)}${r + 1}`} title={cell.review ? t("needsReview") : undefined} rows={Math.min(5, Math.max(2, cell.text.split("\n").length))} maxLength={TABLE_LIMITS.cellChars} value={cell.text} disabled={busy || changed} onFocus={() => setSelected([r, c])} onChange={event => edit(r, c, event.target.value)} className="block min-w-36 w-full resize-y bg-transparent p-3 outline-offset-[-2px] focus:outline focus:outline-2 focus:outline-md-primary" /></td>)}</tr>)}</tbody></table></div>
      <div className="flex flex-wrap gap-x-5 gap-y-3"><label className="flex items-center gap-2 text-sm"><input type="checkbox" disabled={busy} checked={numbers} onChange={event => { setNumbers(event.target.checked); setOutput(null) }} />{t("numbers")}</label><label className="flex items-center gap-2 text-sm"><input type="checkbox" disabled={busy} checked={safeCsv} onChange={event => { setSafeCsv(event.target.checked); setOutput(null) }} />{t("safeCsv")}</label></div>
      <p className="text-xs leading-5 text-md-on-surface-variant">{t("exportHint")}</p>
      <div className="flex flex-wrap gap-2"><Button disabled={busy || changed} onClick={() => void exportFile("xlsx")}>{t("xlsx")}</Button><Button variant="outline" disabled={busy || changed} onClick={() => void exportFile("csv")}>{t("csv")}</Button>{!changed && csv && <SendToMenu value={csv} source={t("title")} />}{output && outputUrl && <Button asChild variant="outline"><a href={outputUrl} download={output.name}><Download />{t("download")} {output.name.split(".").at(-1)?.toUpperCase()}</a></Button>}</div>
    </section>}
  </div>
}
