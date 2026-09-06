"use client"

import { useEffect, useRef, useState } from "react"
import { Loader2, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { PDFDocumentLoadingTask, PDFDocumentProxy, PDFWorker, RenderTask } from "pdfjs-dist"
import { useTranslations } from "@/hooks/use-translations"
import { loadPdfJs, pdfJsOptions } from "@/lib/pdfjs-runtime"
export default function PdfPreview({ file, page = 0, rotation = 0 }: { file: File | null; page?: number; rotation?: number }) {
  const t = useTranslations("pdfTools")
  const canvas = useRef<HTMLCanvasElement | null>(null)
  const [loaded, setLoaded] = useState<{ file: File; document: PDFDocumentProxy; worker: PDFWorker } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [retry, setRetry] = useState(0)
  const [rendered, setRendered] = useState<{ file: File; page: number; rotation: number } | null>(null)
  useEffect(() => {
    setLoaded(null); setRendered(null); setError(""); setBusy(!!file)
    if (!file) return
    let cancelled = false, worker: PDFWorker | undefined, task: PDFDocumentLoadingTask | undefined
    const timeout = setTimeout(() => { if (!cancelled) { cancelled = true; worker?.destroy(); setError(t("previewTimeout")); setBusy(false) } }, 20000)
    void (async () => {
      const [pdfjs, buffer] = await Promise.all([loadPdfJs(), file.arrayBuffer()])
      if (cancelled) return
      worker = pdfjs.PDFWorker.create({ name: "local-pdf-preview" })
      task = pdfjs.getDocument({ data: new Uint8Array(buffer), worker, ...pdfJsOptions(pdfjs) })
      const document = await task.promise
      if (!cancelled) setLoaded({ file, document, worker })
    })().catch(() => { if (!cancelled) { setError(t("previewFailed")); setBusy(false) } }).finally(() => clearTimeout(timeout))
    return () => { cancelled = true; clearTimeout(timeout); void task?.destroy().catch(() => {}); worker?.destroy() }
  }, [file, t, retry])
  useEffect(() => {
    const target = canvas.current
    if (!target || !loaded || loaded.file !== file) return
    let cancelled = false, render: RenderTask | undefined
    setBusy(true); setError("")
    const timeout = setTimeout(() => { if (!cancelled) { cancelled = true; render?.cancel(); loaded.worker.destroy(); setError(t("previewTimeout")); setBusy(false) } }, 15000)
    void (async () => {
      const source = await loaded.document.getPage(page + 1)
      if (cancelled) return
      const angle = (source.rotate + rotation + 360) % 360, base = source.getViewport({ scale: 1, rotation: angle })
      const viewport = source.getViewport({ scale: Math.min(1.5, 900 / Math.max(base.width, base.height)), rotation: angle })
      if (!Number.isFinite(viewport.width + viewport.height) || viewport.width <= 0 || viewport.height <= 0) throw new Error("Invalid page geometry")
      target.width = Math.ceil(viewport.width); target.height = Math.ceil(viewport.height)
      render = source.render({ canvas: target, viewport, background: "rgb(255,255,255)" })
      await render.promise
      if (!cancelled) setRendered({ file: loaded.file, page, rotation })
      source.cleanup()
    })().catch((cause) => { if (!cancelled && cause?.name !== "RenderingCancelledException") setError(t("previewFailed")) }).finally(() => { clearTimeout(timeout); if (!cancelled) setBusy(false) })
    return () => { cancelled = true; clearTimeout(timeout); render?.cancel() }
  }, [file, loaded, page, rotation, t])
  return <div className="flex min-h-48 flex-col items-center justify-center gap-3 rounded-2xl bg-md-surface-container-high p-3">
    {busy && <span role="status" className="flex items-center gap-2 text-xs text-md-on-surface-variant"><Loader2 className="h-4 w-4 animate-spin" />{t("previewLoading")}</span>}
    {error && <><p className="text-center text-xs text-md-on-surface-variant">{error}</p><Button variant="outline" size="sm" onClick={() => setRetry(retry + 1)}><RotateCcw />{t("retryPreview")}</Button></>}
    {!file && <p className="text-sm text-md-on-surface-variant">{t("previewEmpty")}</p>}
    <canvas ref={canvas} role="img" aria-label={t("previewPage").replace("{page}", String(page + 1))} className={file && !error && rendered?.file === file && rendered.page === page && rendered.rotation === rotation ? "block max-h-[40rem] max-w-full rounded-sm bg-white shadow-md" : "hidden"} />
  </div>
}
