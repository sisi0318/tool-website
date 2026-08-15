"use client"

import { useMemo } from "react"
import { AlertTriangle, Copy, Download, RotateCcw, Settings2 } from "lucide-react"
import type { JourneyNode } from "@/lib/journey/types"
import { detectData } from "@/lib/data-detector"
import { formatCanvasValue } from "@/lib/canvas/format-value"
import { copyTextToClipboard } from "@/lib/clipboard"
import { downloadBlob } from "@/lib/object-url"
import { useObjectUrl } from "@/hooks/use-object-url"
import { useTranslations } from "@/hooks/use-translations"
import { useToast } from "@/hooks/use-toast"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { JsonTreeView } from "@/components/json-tree-view"

const ICON_BUTTON =
  "flex h-9 w-9 items-center justify-center rounded-full text-[var(--md-sys-color-on-surface-variant)] transition-colors hover:bg-[var(--md-sys-color-on-surface)]/[0.08] hover:text-[var(--md-sys-color-on-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--md-sys-color-primary)] disabled:opacity-50"

function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / 1024 / 1024).toFixed(1)} MB`
}

interface ValueCardProps {
  node: JourneyNode
  running: boolean
  onOpenStepSheet: () => void
  onRerunFromRoot: () => void
}

export function ValueCard({ node, running, onOpenStepSheet, onRerunFromRoot }: ValueCardProps) {
  const t = useTranslations("journey")
  const { toast } = useToast()

  const isRoot = node.parentId === null
  const isString = typeof node.value === "string"
  const blobValue = typeof Blob !== "undefined" && node.value instanceof Blob ? node.value : null

  const detection = useMemo(() => {
    if (node.valueMissing || typeof node.value !== "string" || node.value.trim().length === 0) return null
    return detectData(node.value)
  }, [node.value, node.valueMissing])

  const imageSource = blobValue && blobValue.type.startsWith("image/") ? blobValue : null
  const imageUrl = useObjectUrl(imageSource)

  const canCopy = !node.valueMissing && (isString || node.valueType === "json")
  const canDownload = !node.valueMissing && (isString || blobValue !== null || node.valueType === "json")

  const handleCopy = async () => {
    const text = isString ? (node.value as string) : formatCanvasValue(node.value, true)
    const ok = await copyTextToClipboard(text)
    toast(ok ? { title: t("copied") } : { title: t("copyFailed"), variant: "destructive" })
  }

  const handleDownload = () => {
    if (blobValue) {
      const name = blobValue instanceof File && blobValue.name ? blobValue.name : "journey-file"
      downloadBlob(blobValue, name)
      return
    }
    if (isString) {
      downloadBlob(new Blob([node.value as string], { type: "text/plain;charset=utf-8" }), "journey-value.txt")
      return
    }
    downloadBlob(new Blob([formatCanvasValue(node.value, true)], { type: "application/json" }), "journey-value.json")
  }

  const renderPreview = () => {
    if (isString) {
      const text = node.value as string
      if (text.length === 0) {
        return <p className="text-sm italic text-[var(--md-sys-color-on-surface-variant)]">{t("emptyValue")}</p>
      }
      return (
        <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all rounded-2xl bg-[var(--md-sys-color-surface-container-high)] p-3 font-mono text-xs leading-relaxed text-[var(--md-sys-color-on-surface)]">
          {text}
        </pre>
      )
    }
    if (blobValue) {
      return (
        <div className="space-y-2">
          <p className="text-sm text-[var(--md-sys-color-on-surface)]">
            {t("bytesValue").replace("{size}", formatBytes(blobValue.size))}
            {blobValue instanceof File && blobValue.name ? (
              <span className="ml-2 break-all font-mono text-xs text-[var(--md-sys-color-on-surface-variant)]">
                {blobValue.name}
              </span>
            ) : null}
          </p>
          {imageUrl && (
            <img
              src={imageUrl}
              alt=""
              className="max-h-64 w-auto rounded-2xl border border-[var(--md-sys-color-outline-variant)] object-contain"
            />
          )}
        </div>
      )
    }
    if (node.valueType === "json") {
      return (
        <div className="rounded-2xl bg-[var(--md-sys-color-surface-container-high)] p-3">
          <JsonTreeView jsonText={formatCanvasValue(node.value, true)} />
        </div>
      )
    }
    return <p className="font-mono text-sm text-[var(--md-sys-color-on-surface)]">{String(node.value)}</p>
  }

  return (
    <section className="rounded-3xl bg-[var(--md-sys-color-surface-container-low)] p-4 shadow-sm sm:p-5">
      <div className="flex items-center gap-2">
        <h2 className="text-xs font-medium uppercase tracking-wide text-[var(--md-sys-color-on-surface-variant)]">
          {t("currentData")}
        </h2>
        <Badge className="border-transparent bg-[var(--md-sys-color-secondary-container)] font-mono text-[10px] text-[var(--md-sys-color-on-secondary-container)] hover:bg-[var(--md-sys-color-secondary-container)]">
          {node.valueType}
        </Badge>
        <div className="ml-auto flex items-center">
          {canCopy && (
            <button
              type="button"
              onClick={handleCopy}
              aria-label={t("copy")}
              title={t("copy")}
              className={ICON_BUTTON}
            >
              <Copy className="h-4 w-4" />
            </button>
          )}
          {canDownload && (
            <button
              type="button"
              onClick={handleDownload}
              aria-label={t("download")}
              title={t("download")}
              className={ICON_BUTTON}
            >
              <Download className="h-4 w-4" />
            </button>
          )}
          {!isRoot && (
            <button
              type="button"
              onClick={onOpenStepSheet}
              aria-label={t("stepConfigTitle")}
              title={t("stepConfigTitle")}
              className={ICON_BUTTON}
            >
              <Settings2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {detection && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-[var(--md-sys-color-on-surface-variant)]">{t("detectedAs")}</span>
          {detection.matches.slice(0, 3).map((match) => {
            const isBest = match.type === detection.best.type
            return (
              <span
                key={match.type}
                title={match.detail}
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs ${
                  isBest
                    ? "bg-[var(--md-sys-color-tertiary-container)] font-medium text-[var(--md-sys-color-on-tertiary-container)]"
                    : "border border-[var(--md-sys-color-outline-variant)] text-[var(--md-sys-color-on-surface-variant)]"
                }`}
              >
                {match.label}
                <span className="opacity-70">
                  {t("confidencePercent").replace("{percent}", String(Math.round(match.confidence * 100)))}
                </span>
              </span>
            )
          })}
        </div>
      )}

      <div className="mt-3">
        {node.valueMissing ? (
          <div className="rounded-2xl bg-[var(--md-sys-color-error-container)] p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-[var(--md-sys-color-on-error-container)]">
              <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
              {t("valueMissingTitle")}
            </div>
            <p className="mt-1 text-xs leading-relaxed text-[var(--md-sys-color-on-error-container)]/80">
              {t("valueMissingDescription")}
            </p>
            <Button
              size="sm"
              onClick={onRerunFromRoot}
              disabled={running}
              className="mt-3 rounded-full bg-[var(--md-sys-color-error)] px-4 text-[var(--md-sys-color-on-error)] hover:bg-[var(--md-sys-color-error)]/90"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              {t("rerunFromRoot")}
            </Button>
          </div>
        ) : (
          renderPreview()
        )}
      </div>
    </section>
  )
}
