"use client"

import { useEffect, useState } from "react"
import dynamic from "next/dynamic"
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Play, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PdfChoice, PdfFilePicker, PdfNumberControls, PdfResults, PdfTaskStatus } from "@/components/tools/pdf-controls"
import { usePdfTask } from "@/hooks/use-pdf-task"
import { useObjectUrl } from "@/hooks/use-object-url"
import { useTranslations } from "@/hooks/use-translations"
import { PDF_LIMITS, PdfToolError, pdfImageDimensions, type PdfImageOptions, type PdfNumbering } from "@/lib/pdf-shared"
import { imageFilesToPdf, type PdfFileResult } from "@/lib/pdf-worker-client"

const PdfPreview = dynamic(() => import("./pdf-preview"), { ssr: false })
let thumbnailQueue = Promise.resolve()
function ImageThumbnail({ file }: { file: File }) {
  const [thumbnail, setThumbnail] = useState<Blob | null>(null), url = useObjectUrl(thumbnail)
  useEffect(() => {
    let cancelled = false
    setThumbnail(null)
    thumbnailQueue = thumbnailQueue.then(async () => {
      if (cancelled) return
      const bytes = new Uint8Array(await file.arrayBuffer()), size = pdfImageDimensions(bytes)
      const { orientation } = await import("exifr")
      const angle = await orientation(bytes).catch(() => 1) ?? 1
      const width = angle >= 5 ? size.height : size.width, height = angle >= 5 ? size.width : size.height, scale = Math.min(1, 180 / Math.max(width, height))
      if (cancelled) return
      const bitmap = await createImageBitmap(file, { resizeWidth: Math.max(1, Math.round(width * scale)), resizeHeight: Math.max(1, Math.round(height * scale)), resizeQuality: "medium", imageOrientation: "from-image" })
      try {
        if (cancelled) return
        const canvas = document.createElement("canvas"); canvas.width = bitmap.width; canvas.height = bitmap.height
        canvas.getContext("2d")?.drawImage(bitmap, 0, 0)
        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"))
        if (!cancelled) setThumbnail(blob)
      } finally { bitmap.close() }
    }).catch(() => {})
    return () => { cancelled = true }
  }, [file])
  return url ? <img src={url} alt={file.name} className="h-14 w-20 rounded-lg bg-white object-contain" /> : <span className="h-14 w-20 rounded-lg bg-md-surface-container-high" />
}
export default function PdfImagesPanel() {
  const t = useTranslations("pdfTools"), task = usePdfTask()
  const [files, setFiles] = useState<File[]>([]), [pageSize, setPageSize] = useState<NonNullable<PdfImageOptions["pageSize"]>>("a4"), [margin, setMargin] = useState("36")
  const [numbering, setNumbering] = useState<PdfNumbering>({ enabled: false, position: "bottom-center", margin: 18, fontSize: 10, total: true })
  const [result, setResult] = useState<PdfFileResult | null>(null), [page, setPage] = useState(0)
  const change = () => { task.cancel(); task.clearError(); setResult(null); setPage(0) }
  const addFiles = (added: File[]) => {
    setResult(null)
    void task.run(async ({ signal }) => { const next = [...files, ...added]; if (next.length > PDF_LIMITS.files || next.reduce((total, file) => total + file.size, 0) > PDF_LIMITS.inputBytes) throw new PdfToolError("inputLimit"); for (const file of added) { signal?.throwIfAborted(); pdfImageDimensions(new Uint8Array(await file.arrayBuffer())) }; return next }, setFiles)
  }
  const sample = () => {
    setResult(null)
    void task.run(async () => {
      if (files.length >= PDF_LIMITS.files) throw new PdfToolError("inputLimit")
      const canvas = document.createElement("canvas"); canvas.width = 640; canvas.height = 420
      const context = canvas.getContext("2d")!
      context.fillStyle = "#eef3ef"; context.fillRect(0, 0, 640, 420)
      context.fillStyle = "#146756"; context.fillRect(30, 30, 580, 120)
      context.fillStyle = "white"; context.font = "bold 36px sans-serif"; context.fillText("A local image", 60, 105)
      context.fillStyle = "#dab542"; context.fillRect(60, 200, 180, 140)
      context.fillStyle = "#294780"; context.fillRect(280, 200, 300, 140)
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new PdfToolError("invalidImage")), "image/png"))
      const next = [...files, new File([blob], `sample-image-${files.length + 1}.png`, { type: "image/png" })]
      if (next.reduce((size, file) => size + file.size, 0) > PDF_LIMITS.inputBytes) throw new PdfToolError("inputLimit")
      return next
    }, setFiles)
  }
  const move = (index: number, delta: number) => { change(); const next = [...files]; [next[index], next[index + delta]] = [next[index + delta], next[index]]; setFiles(next) }
  const generate = () => { setResult(null); void task.run((context) => imageFilesToPdf(files, { pageSize, margin: Number(margin), numbering }, context), (next) => { setResult(next); setPage(0) }) }
  return <div className="space-y-5"><div className="flex flex-wrap gap-2"><PdfFilePicker label={t("addImages")} accept="image/png,image/jpeg,.png,.jpg,.jpeg" onFiles={addFiles} disabled={task.running} /><Button variant="outline" className="h-11" disabled={task.running} onClick={sample}>{t("imageSample")}</Button></div><p className="text-xs leading-relaxed text-md-on-surface-variant">{t("imageHelp")}</p><PdfTaskStatus {...task} onCancel={task.cancel} /><div className="grid min-w-0 items-start gap-5 xl:grid-cols-2"><div className="min-w-0 space-y-4"><div className="space-y-2">{files.map((file, index) => <div key={index} className="flex flex-wrap items-center gap-3 rounded-xl border border-md-outline-variant p-3"><ImageThumbnail file={file} /><span className="min-w-0 flex-1 break-all font-mono text-xs">{index + 1}. {file.name}</span><div className="flex items-center"><Button size="icon" variant="ghost" aria-label={`${t("moveUp")} ${index + 1}`} disabled={index === 0} onClick={() => move(index, -1)}><ArrowUp /></Button><Button size="icon" variant="ghost" aria-label={`${t("moveDown")} ${index + 1}`} disabled={index + 1 >= files.length} onClick={() => move(index, 1)}><ArrowDown /></Button><Button size="icon" variant="ghost" aria-label={`${t("removeFile")} ${index + 1}`} onClick={() => { change(); setFiles(files.filter((_, i) => i !== index)) }}><X /></Button></div></div>)}</div><div className="space-y-4 rounded-2xl border border-md-outline-variant p-4"><PdfChoice label={t("paperSize")} value={pageSize} onChange={(value) => { change(); setPageSize(value as typeof pageSize) }} items={[["a4", "A4 · " + t("portrait")], ["a4-landscape", "A4 · " + t("landscape")], ["letter", "Letter · " + t("portrait")], ["letter-landscape", "Letter · " + t("landscape")], ["image", t("imageSize")]]} /><div className="space-y-2"><Label htmlFor="pdf-image-margin">{t("imageMargin")}</Label><Input id="pdf-image-margin" type="number" min={0} max={144} value={margin} onChange={(event) => { change(); setMargin(event.target.value) }} /></div><PdfNumberControls id="pdf-images" value={numbering} onChange={(value) => { change(); setNumbering(value) }} /><Button onClick={generate} disabled={!files.length || task.running}><Play />{t("generatePdf")}</Button></div></div><div className="min-w-0 space-y-3 xl:sticky xl:top-4"><div className="flex items-center justify-between"><h2 className="font-semibold">{t("outputPreview")}</h2>{result && <div className="flex items-center gap-2 text-xs"><Button size="icon" variant="ghost" aria-label={t("previousPreview")} disabled={page === 0} onClick={() => setPage(page - 1)}><ChevronLeft /></Button><span>{page + 1} / {result.pages}</span><Button size="icon" variant="ghost" aria-label={t("nextPreview")} disabled={page + 1 >= result.pages} onClick={() => setPage(page + 1)}><ChevronRight /></Button></div>}</div><PdfPreview file={result?.files[0].file ?? null} page={page} /><p className="text-xs text-md-on-surface-variant">{t("previewHelp")}</p></div></div>{result && <PdfResults result={result} onPreview={() => setPage(0)} />}</div>
}
