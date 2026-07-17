"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { CheckCircle2, Download, FileArchive, FileImage, ImageDown, Loader2, Trash2, Upload, X } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { useTranslations } from "@/hooks/use-translations"
import { convertImageFile, type ImageOutputFormat } from "@/lib/image-convert"
import { mapWithConcurrency } from "@/lib/async-pool"
import { createClientId } from "@/lib/client-id"
import {
  createObjectUrl,
  downloadBlob,
  revokeObjectUrl,
  revokeObjectUrls,
} from "@/lib/object-url"

interface ImageItem {
  id: string
  source: File
  sourceUrl: string
  status: "ready" | "processing" | "done" | "error"
  result?: File
  resultUrl?: string
  width?: number
  height?: number
  error?: string
}

const MAX_FILES = 30
const MAX_FILE_SIZE = 25 * 1024 * 1024

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

function releaseImageItem(item: ImageItem): void {
  revokeObjectUrls([item.sourceUrl, item.resultUrl])
}

export default function ImageConvertPage() {
  const t = useTranslations("imageConvert")
  const inputRef = useRef<HTMLInputElement>(null)
  const itemsRef = useRef<ImageItem[]>([])
  const mountedRef = useRef(true)
  const [items, setItems] = useState<ImageItem[]>([])
  const [format, setFormat] = useState<ImageOutputFormat>("webp")
  const [quality, setQuality] = useState(82)
  const [maxWidth, setMaxWidth] = useState("")
  const [maxHeight, setMaxHeight] = useState("")
  const [dragging, setDragging] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [notice, setNotice] = useState("")

  useEffect(() => {
    mountedRef.current = true

    return () => {
      mountedRef.current = false
      itemsRef.current.forEach(releaseImageItem)
    }
  }, [])

  const updateItems = (updater: (current: ImageItem[]) => ImageItem[]) => {
    const next = updater(itemsRef.current)
    itemsRef.current = next
    setItems(next)
  }

  const completed = useMemo(() => items.filter((item) => item.result), [items])

  const addFiles = (files: File[]) => {
    const images = files.filter((file) => file.type.startsWith("image/") && file.size <= MAX_FILE_SIZE)
    if (images.length !== files.length) setNotice(t("invalidFilesSkipped"))
    const available = Math.max(0, MAX_FILES - itemsRef.current.length)
    if (images.length > available) setNotice(t("fileLimit"))
    const next = images.slice(0, available).map((file) => ({
      id: createClientId("convert"),
      source: file,
      sourceUrl: createObjectUrl(file),
      status: "ready" as const,
    }))
    updateItems((current) => [...current, ...next])
  }

  const removeItem = (id: string) => {
    updateItems((current) => {
      const item = current.find((entry) => entry.id === id)
      if (item) {
        releaseImageItem(item)
      }
      return current.filter((entry) => entry.id !== id)
    })
  }

  const clearItems = () => {
    itemsRef.current.forEach(releaseImageItem)
    updateItems(() => [])
    setNotice("")
  }

  const convertAll = async () => {
    const itemsToConvert = [...itemsRef.current]
    if (itemsToConvert.length === 0 || processing) return
    setProcessing(true)
    setNotice("")

    try {
      await mapWithConcurrency(itemsToConvert, 3, async (item) => {
        if (!mountedRef.current) return

        updateItems((current) => current.map((entry) => (
          entry.id === item.id
            ? { ...entry, status: "processing", error: undefined }
            : entry
        )))

        try {
          const converted = await convertImageFile(item.source, {
            format,
            quality: quality / 100,
            maxWidth: Number(maxWidth) || undefined,
            maxHeight: Number(maxHeight) || undefined,
          })
          if (!mountedRef.current) return

          updateItems((current) => current.map((entry) => {
            if (entry.id !== item.id) return entry

            revokeObjectUrl(entry.resultUrl)
            return {
              ...entry,
              status: "done",
              result: converted.file,
              resultUrl: createObjectUrl(converted.file),
              width: converted.width,
              height: converted.height,
            }
          }))
        } catch (error) {
          if (!mountedRef.current) return

          const code = error instanceof Error ? error.message : "CONVERSION_FAILED"
          const message = code === "FORMAT_NOT_SUPPORTED" ? t("formatUnsupported") : t("conversionFailed")
          updateItems((current) => current.map((entry) => (
            entry.id === item.id
              ? { ...entry, status: "error", error: message }
              : entry
          )))
        }
      })
    } finally {
      if (mountedRef.current) {
        setProcessing(false)
      }
    }
  }

  const downloadAll = async () => {
    if (completed.length === 0) return
    if (completed.length === 1 && completed[0].result) {
      downloadBlob(completed[0].result, completed[0].result.name)
      return
    }
    const { default: JSZip } = await import("jszip")
    const zip = new JSZip()
    const usedNames = new Map<string, number>()
    completed.forEach((item) => {
      if (!item.result) return
      const count = usedNames.get(item.result.name) ?? 0
      usedNames.set(item.result.name, count + 1)
      const name = count === 0
        ? item.result.name
        : item.result.name.replace(/(\.[^.]+)$/, `-${count + 1}$1`)
      zip.file(name, item.result)
    })
    downloadBlob(await zip.generateAsync({ type: "blob" }), "converted-images.zip")
  }

  return (
    <main className="mx-auto max-w-7xl px-1 py-2 sm:px-3">
      <section className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--md-sys-color-primary-container)] text-[var(--md-sys-color-on-primary-container)]"><ImageDown className="h-6 w-6" /></span>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-[var(--md-sys-color-on-surface)]">{t("title")}</h1>
            <p className="mt-1 text-[var(--md-sys-color-on-surface-variant)]">{t("description")}</p>
          </div>
        </div>
        {items.length > 0 && <Button variant="outline" onClick={clearItems} className="gap-2"><Trash2 className="h-4 w-4" />{t("clearAll")}</Button>}
      </section>

      <div className="grid gap-5 lg:grid-cols-[340px_minmax(0,1fr)]">
        <div className="space-y-5">
          <Card className="rounded-[var(--md-sys-shape-corner-extra-large)] border-[var(--md-sys-color-outline-variant)]/70">
            <CardHeader><CardTitle>{t("settings")}</CardTitle></CardHeader>
            <CardContent className="space-y-5">
              <div>
                <Label>{t("outputFormat")}</Label>
                <Select value={format} onValueChange={(value) => setFormat(value as ImageOutputFormat)}>
                  <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="webp">WebP</SelectItem><SelectItem value="jpeg">JPEG</SelectItem><SelectItem value="png">PNG</SelectItem><SelectItem value="avif">AVIF</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {format !== "png" && (
                <div>
                  <div className="mb-3 flex items-center justify-between"><Label>{t("quality")}</Label><Badge variant="secondary">{quality}%</Badge></div>
                  <Slider value={[quality]} min={10} max={100} step={1} onValueChange={([value]) => setQuality(value)} aria-label={t("quality")} />
                </div>
              )}
              <div>
                <Label>{t("maxDimensions")}</Label>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <Input type="number" min={1} placeholder={t("maxWidth")} value={maxWidth} onChange={(event) => setMaxWidth(event.target.value)} aria-label={t("maxWidth")} />
                  <Input type="number" min={1} placeholder={t("maxHeight")} value={maxHeight} onChange={(event) => setMaxHeight(event.target.value)} aria-label={t("maxHeight")} />
                </div>
                <p className="mt-2 text-xs text-[var(--md-sys-color-on-surface-variant)]">{t("resizeHint")}</p>
              </div>
              <Button onClick={convertAll} disabled={items.length === 0 || processing} className="h-11 w-full gap-2">
                {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageDown className="h-4 w-4" />}
                {processing ? t("processing") : t("convertAll")}
              </Button>
            </CardContent>
          </Card>
          <Card className="rounded-[var(--md-sys-shape-corner-extra-large)] border-0 bg-[var(--md-sys-color-secondary-container)] text-[var(--md-sys-color-on-secondary-container)]">
            <CardContent className="p-5 text-sm leading-6">{t("privacyNote")}</CardContent>
          </Card>
        </div>

        <Card className="rounded-[var(--md-sys-shape-corner-extra-large)] border-[var(--md-sys-color-outline-variant)]/70">
          <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
            <div><CardTitle>{t("images")}</CardTitle><p className="mt-1 text-sm text-[var(--md-sys-color-on-surface-variant)]">{items.length}/{MAX_FILES} {t("files")}</p></div>
            {completed.length > 0 && <Button variant="outline" onClick={downloadAll} className="gap-2">{completed.length > 1 ? <FileArchive className="h-4 w-4" /> : <Download className="h-4 w-4" />}{completed.length > 1 ? t("downloadZip") : t("download")}</Button>}
          </CardHeader>
          <CardContent className="space-y-4">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              onDragOver={(event) => { event.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => { event.preventDefault(); setDragging(false); addFiles(Array.from(event.dataTransfer.files)) }}
              className={`flex min-h-40 w-full flex-col items-center justify-center rounded-[var(--md-sys-shape-corner-large)] border-2 border-dashed p-6 text-center transition-colors ${dragging ? "border-[var(--md-sys-color-primary)] bg-[var(--md-sys-color-primary)]/[0.08]" : "border-[var(--md-sys-color-outline-variant)] hover:bg-[var(--md-sys-color-surface-container-low)]"}`}
            >
              <Upload className="h-8 w-8 text-[var(--md-sys-color-primary)]" />
              <span className="mt-3 font-bold text-[var(--md-sys-color-on-surface)]">{t("dropTitle")}</span>
              <span className="mt-1 text-sm text-[var(--md-sys-color-on-surface-variant)]">{t("dropHint")}</span>
            </button>
            <input ref={inputRef} type="file" accept="image/*" multiple className="sr-only" aria-label={t("chooseImages")} onChange={(event) => { addFiles(Array.from(event.target.files ?? [])); event.target.value = "" }} />
            {notice && <p role="status" className="rounded-xl bg-[var(--md-sys-color-surface-container)] px-4 py-3 text-sm text-[var(--md-sys-color-on-surface-variant)]">{notice}</p>}

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {items.map((item) => (
                <article key={item.id} className="overflow-hidden rounded-2xl border border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container-low)]">
                  <div className="relative aspect-video bg-[var(--md-sys-color-surface-container-high)]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={item.resultUrl ?? item.sourceUrl} alt={item.source.name} className="h-full w-full object-contain" />
                    <button type="button" onClick={() => removeItem(item.id)} aria-label={t("remove")} className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/75"><X className="h-4 w-4" /></button>
                    {item.status === "processing" && <div className="absolute inset-0 flex items-center justify-center bg-black/45 text-white"><Loader2 className="h-7 w-7 animate-spin" /></div>}
                  </div>
                  <div className="space-y-2 p-3">
                    <div className="flex items-start gap-2"><FileImage className="mt-0.5 h-4 w-4 shrink-0 text-[var(--md-sys-color-primary)]" /><p className="min-w-0 flex-1 truncate text-sm font-semibold">{item.result?.name ?? item.source.name}</p></div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--md-sys-color-on-surface-variant)]">
                      <span>{formatBytes(item.source.size)}</span>
                      {item.result && <><span>→</span><span>{formatBytes(item.result.size)}</span><Badge variant="secondary">{item.width}×{item.height}</Badge></>}
                    </div>
                    {item.status === "done" && item.result && <button type="button" onClick={() => downloadBlob(item.result!, item.result!.name)} className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--md-sys-color-primary)]"><CheckCircle2 className="h-4 w-4" />{t("download")}</button>}
                    {item.error && <p className="text-xs text-[var(--md-sys-color-error)]">{item.error}</p>}
                  </div>
                </article>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
