"use client"

import { useMemo, useRef, useState } from "react"
import dynamic from "next/dynamic"
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Play, RotateCw, Trash2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PdfChoice, PdfFilePicker, PdfNumberControls, PdfResults, PdfTaskStatus } from "@/components/tools/pdf-controls"
import { usePdfTask } from "@/hooks/use-pdf-task"
import { useTranslations } from "@/hooks/use-translations"
import { parsePdfSelection, PDF_LIMITS, PdfToolError, type PdfInfo, type PdfNumbering, type PdfPageReference } from "@/lib/pdf-shared"
import { composePdfFiles, inspectPdfFiles, samplePdfFile, type PdfFileResult } from "@/lib/pdf-worker-client"

const PdfPreview = dynamic(() => import("./pdf-preview"), { ssr: false })
interface Source { file: File; info: PdfInfo }
interface PageItem extends PdfPageReference { id: number; included: boolean; rotation: number }
export default function PdfDocumentPanel() {
  const t = useTranslations("pdfTools"), task = usePdfTask(), counter = useRef(0)
  const [sources, setSources] = useState<Source[]>([]), [plan, setPlan] = useState<PageItem[]>([])
  const [order, setOrder] = useState(""), [mode, setMode] = useState("merge"), [splitEvery, setSplitEvery] = useState("1")
  const [numbering, setNumbering] = useState<PdfNumbering>({ enabled: false, position: "bottom-center", fontSize: 10, margin: 18, total: true })
  const [flattenForms, setFlattenForms] = useState(false), [allowSignatureChanges, setAllowSignatureChanges] = useState(false)
  const [listPage, setListPage] = useState(0), [previewId, setPreviewId] = useState<number | null>(null)
  const [result, setResult] = useState<PdfFileResult | null>(null), [outputIndex, setOutputIndex] = useState<number | null>(null), [outputPage, setOutputPage] = useState(0)
  const clearResult = () => { setResult(null); setOutputIndex(null); setOutputPage(0) }
  const change = () => { task.cancel(); task.clearError(); clearResult() }
  const originals = useMemo(() => sources.flatMap((source, index) => source.info.pages.map((page) => ({ source: index, page: page.page }))), [sources])
  const totalPages = originals.length, selectedCount = plan.filter((page) => page.included).length
  const originalIndex = (page: PdfPageReference) => sources.slice(0, page.source).reduce((count, source) => count + source.info.pages.length, 0) + page.page + 1
  const append = (added: Source[]) => {
    const pages = added.reduce((count, source) => count + source.info.pages.length, 0)
    if (sources.length + added.length > PDF_LIMITS.files || sources.reduce((size, source) => size + source.file.size, 0) + added.reduce((size, source) => size + source.file.size, 0) > PDF_LIMITS.inputBytes) throw new PdfToolError("inputLimit")
    if (totalPages + pages > PDF_LIMITS.pages || plan.length + pages > PDF_LIMITS.pages) throw new PdfToolError("pageLimit")
    const next = added.flatMap((source, index) => source.info.pages.map((page) => ({ id: ++counter.current, source: sources.length + index, page: page.page, rotation: 0, included: true })))
    setSources([...sources, ...added]); setPlan([...plan, ...next]); setPreviewId(previewId ?? next[0]?.id ?? null); setOrder("")
    if (added.some((source) => source.info.formFields)) setFlattenForms(false)
    if (added.some((source) => source.info.signed)) setAllowSignatureChanges(false)
  }
  const addFiles = (files: File[]) => {
    clearResult()
    void task.run(async (context) => {
      if (sources.length + files.length > PDF_LIMITS.files || sources.reduce((size, source) => size + source.file.size, 0) + files.reduce((size, file) => size + file.size, 0) > PDF_LIMITS.inputBytes) throw new PdfToolError("inputLimit")
      const infos = await inspectPdfFiles(files, context)
      return files.map((file, index) => ({ file, info: infos[index] }))
    }, append)
  }
  const removeSource = (index: number) => { change(); const next = plan.filter((page) => page.source !== index).map((page) => ({ ...page, source: page.source > index ? page.source - 1 : page.source })); setSources(sources.filter((_, i) => i !== index)); setPlan(next); setPreviewId(next[0]?.id ?? null); setListPage(0); setOrder("") }
  const updatePlan = (next: PageItem[]) => { change(); setPlan(next) }
  const move = (index: number, delta: number) => { const next = [...plan]; [next[index], next[index + delta]] = [next[index + delta], next[index]]; updatePlan(next); setListPage(Math.floor((index + delta) / 50)) }
  const applyOrder = () => {
    clearResult()
    void task.run(async () => {
      const indices = parsePdfSelection(order, originals.length)
      return indices.map((index) => ({ ...originals[index], id: ++counter.current, included: true, rotation: plan.find((page) => page.source === originals[index].source && page.page === originals[index].page)?.rotation ?? 0 }))
    }, (next) => { setPlan(next); setPreviewId(next[0]?.id ?? null); setListPage(0) })
  }
  const generate = () => {
    clearResult()
    void task.run(async (context) => {
      const every = mode === "split" ? Number(splitEvery) : 0
      if (mode === "split" && (!Number.isInteger(every) || every < 1)) throw new PdfToolError("invalidOptions")
      return composePdfFiles(sources.map((source) => source.file), { pages: plan.filter((page) => page.included).map(({ source, page, rotation }) => ({ source, page, rotation })), splitEvery: every, numbering, flattenForms, allowSignatureChanges }, context)
    }, (next) => { setResult(next); setOutputIndex(0); setOutputPage(0) })
  }
  const selected = plan.find((page) => page.id === previewId) ?? plan[0]
  const previewOutput = result && outputIndex !== null ? result.files[outputIndex] : null
  const previewFile = previewOutput?.file ?? (selected ? sources[selected.source]?.file : null)
  const pages = Math.max(1, Math.ceil(plan.length / 50))

  return <div className="space-y-5">
    <div className="flex flex-wrap items-center gap-2"><PdfFilePicker label={t("addPdfs")} accept=".pdf,application/pdf" onFiles={addFiles} disabled={task.running} /><Button variant="outline" className="h-11" disabled={task.running} onClick={() => { clearResult(); void task.run((context) => samplePdfFile(context), (sample) => append([sample])) }}>{t("sample")}</Button>{sources.length > 0 && <Button variant="ghost" onClick={() => { change(); setSources([]); setPlan([]); setPreviewId(null); setOrder(""); setListPage(0) }}><Trash2 />{t("clear")}</Button>}</div>
    <p className="text-xs leading-relaxed text-md-on-surface-variant">{t("limits")}</p>
    <PdfTaskStatus {...task} onCancel={task.cancel} />
    {sources.length > 0 && <div className="flex flex-wrap gap-2">{sources.map((source, index) => <div key={index} className="flex min-w-0 max-w-full items-center gap-2 rounded-xl bg-md-surface-container-low px-3 py-2 text-xs"><span className="min-w-0 break-all font-mono">{index + 1}. {source.file.name}</span><span className="shrink-0 text-md-on-surface-variant">{source.info.pages.length} {t("pages")}</span><Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" aria-label={`${t("removeFile")} ${index + 1}`} onClick={() => removeSource(index)}><X /></Button></div>)}</div>}
    <div className="grid min-w-0 items-start gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <div className="min-w-0 space-y-4">
        <section className="space-y-3 rounded-2xl border border-md-outline-variant p-4"><h2 className="font-semibold">{t("pageOrder")} · {selectedCount} / {plan.length}</h2><div className="flex items-end gap-2"><div className="min-w-0 flex-1 space-y-2"><Label htmlFor="pdf-order">{t("orderInput")}</Label><Input id="pdf-order" value={order} onChange={(event) => setOrder(event.target.value)} placeholder="3,1-2,5-4" className="font-mono text-sm" disabled={!sources.length} /></div><Button variant="outline" disabled={!sources.length || task.running} onClick={applyOrder}>{t("applyOrder")}</Button></div><p className="text-xs leading-relaxed text-md-on-surface-variant">{t("orderHelp")}</p><div className="flex flex-wrap gap-2"><Button variant="ghost" size="sm" disabled={!plan.length} onClick={() => updatePlan(plan.map((page) => ({ ...page, included: true })))}>{t("selectAll")}</Button><Button variant="ghost" size="sm" disabled={!plan.length} onClick={() => updatePlan(plan.map((page) => ({ ...page, included: false })))}>{t("selectNone")}</Button><Button variant="outline" size="sm" disabled={!selectedCount} onClick={() => updatePlan(plan.map((page) => page.included ? { ...page, rotation: (page.rotation + 90) % 360 } : page))}><RotateCw />{t("rotateSelected")}</Button></div>
          <div className="max-h-[32rem] space-y-2 overflow-auto">{plan.slice(listPage * 50, (listPage + 1) * 50).map((page, offset) => { const index = listPage * 50 + offset; return <div key={page.id} className={"flex flex-wrap items-center gap-2 rounded-xl border p-2 " + (selected?.id === page.id && !previewOutput ? "border-md-primary bg-md-primary-container/30" : "border-md-outline-variant")}><input type="checkbox" className="ml-1 h-4 w-4 shrink-0 accent-[var(--md-sys-color-primary)]" aria-label={`${t("includePage")} ${index + 1}`} checked={page.included} onChange={(event) => updatePlan(plan.map((item) => item.id === page.id ? { ...item, included: event.target.checked } : item))} /><Button variant="ghost" size="sm" className="h-auto min-w-0 flex-1 justify-start whitespace-normal py-2 text-left" aria-label={`${t("previewOriginal")} ${originalIndex(page)}`} onClick={() => { setPreviewId(page.id); setOutputIndex(null) }}><span className="font-mono text-md-primary">#{originalIndex(page)}</span><span className="min-w-0 break-all text-xs">{sources[page.source]?.file.name} · {t("page")} {page.page + 1}</span></Button><span className="font-mono text-xs text-md-on-surface-variant">+{page.rotation}°</span><div className="flex items-center"><Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`${t("rotatePage")} ${index + 1}`} onClick={() => updatePlan(plan.map((item) => item.id === page.id ? { ...item, rotation: (item.rotation + 90) % 360 } : item))}><RotateCw /></Button><Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`${t("moveUp")} ${index + 1}`} disabled={index === 0} onClick={() => move(index, -1)}><ArrowUp /></Button><Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`${t("moveDown")} ${index + 1}`} disabled={index + 1 === plan.length} onClick={() => move(index, 1)}><ArrowDown /></Button></div></div> })}{!plan.length && <p className="py-8 text-center text-sm text-md-on-surface-variant">{t("emptyPages")}</p>}</div>
          {pages > 1 && <div className="flex items-center justify-end gap-2 text-xs"><Button variant="ghost" size="icon" aria-label={t("previousPageList")} disabled={listPage === 0} onClick={() => setListPage(listPage - 1)}><ChevronLeft /></Button><span>{listPage + 1} / {pages}</span><Button variant="ghost" size="icon" aria-label={t("nextPageList")} disabled={listPage + 1 >= pages} onClick={() => setListPage(listPage + 1)}><ChevronRight /></Button></div>}
        </section>
        <section className="space-y-4 rounded-2xl border border-md-outline-variant p-4"><div className="grid gap-3 sm:grid-cols-2"><PdfChoice label={t("outputMode")} value={mode} onChange={(value) => { change(); setMode(value) }} items={[["merge", t("mergeMode")], ["split", t("splitMode")]]} />{mode === "split" && <div className="space-y-2"><Label htmlFor="pdf-split-every">{t("splitEvery")}</Label><Input id="pdf-split-every" type="number" min={1} max={500} value={splitEvery} onChange={(event) => { change(); setSplitEvery(event.target.value) }} /></div>}</div><PdfNumberControls id="pdf-pages" value={numbering} onChange={(value) => { change(); setNumbering(value) }} />{sources.some((source) => source.info.formFields) && <div className="space-y-2 rounded-xl bg-md-surface-container-low p-3"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={flattenForms} onChange={(event) => { change(); setFlattenForms(event.target.checked) }} />{t("flattenForms")}</label><p className="text-xs leading-relaxed text-md-on-surface-variant">{t("formHelp")}</p></div>}{sources.some((source) => source.info.signed) && <label className="flex items-start gap-2 rounded-xl bg-md-tertiary-container p-3 text-sm text-md-on-tertiary-container"><input type="checkbox" className="mt-1" checked={allowSignatureChanges} onChange={(event) => { change(); setAllowSignatureChanges(event.target.checked) }} />{t("allowSignatureChanges")}</label>}<Button onClick={generate} disabled={!selectedCount || task.running}><Play />{t("generatePdf")}</Button></section>
      </div>
      <div className="min-w-0 space-y-3 xl:sticky xl:top-4"><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">{previewOutput ? t("outputPreview") : t("sourcePreview")}</h2>{previewOutput && <div className="flex items-center gap-2 text-xs"><Button size="icon" variant="ghost" aria-label={t("previousPreview")} disabled={outputPage === 0} onClick={() => setOutputPage(outputPage - 1)}><ChevronLeft /></Button><span>{outputPage + 1} / {previewOutput.pages}</span><Button size="icon" variant="ghost" aria-label={t("nextPreview")} disabled={outputPage + 1 >= previewOutput.pages} onClick={() => setOutputPage(outputPage + 1)}><ChevronRight /></Button></div>}</div><PdfPreview file={previewFile ?? null} page={previewOutput ? outputPage : selected?.page ?? 0} rotation={previewOutput ? 0 : selected?.rotation ?? 0} /><p className="break-all text-xs text-md-on-surface-variant">{previewFile?.name}</p><p className="text-xs text-md-on-surface-variant">{t("previewHelp")}</p></div>
    </div>
    {result && <PdfResults result={result} onPreview={(index) => { setOutputIndex(index); setOutputPage(0) }} />}
  </div>
}
