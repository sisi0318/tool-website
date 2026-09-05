"use client"

import { useEffect, useMemo, useState } from "react"
import { Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SegmentedControl, SegmentedControlItem } from "@/components/ui/segmented-control"
import { SendToMenu } from "@/components/tools/send-to-menu"
import { useObjectUrl } from "@/hooks/use-object-url"
import { useTranslations } from "@/hooks/use-translations"
import { createHexdump } from "@/lib/hex-binary-tools"
import { detectFileSignature } from "@/lib/file-signature"

export const formatBinarySize = (size: number) => size < 1024 ? size + " B" : size < 1024 * 1024 ? (size / 1024).toFixed(1) + " KB" : (size / (1024 * 1024)).toFixed(1) + " MB"

export function BinaryFileDownload({ file, label, compact = false }: { file: File; label?: string; compact?: boolean }) {
  const t = useTranslations("compressionFiles")
  const url = useObjectUrl(file)
  return url ? <Button asChild size={compact ? "icon" : "sm"} variant={compact ? "ghost" : "default"}><a href={url} download={file.name} aria-label={label ?? t("downloadFile")}><Download />{!compact && t("downloadFile")}</a></Button> : <Button disabled size={compact ? "icon" : "sm"}><Download />{!compact && t("downloadFile")}</Button>
}

export function BinaryFileResult({ file, source }: { file: File; source?: string }) {
  const t = useTranslations("compressionFiles")
  const [prefix, setPrefix] = useState<Uint8Array | null>(null)
  const [mode, setMode] = useState("text")
  useEffect(() => {
    let cancelled = false
    setPrefix(null)
    void file.slice(0, 64 * 1024).arrayBuffer().then((buffer) => { if (!cancelled) setPrefix(new Uint8Array(buffer)) }).catch(() => { if (!cancelled) setPrefix(new Uint8Array()) })
    return () => { cancelled = true }
  }, [file])
  const text = useMemo(() => {
    if (!prefix) return null
    try {
      const value = new TextDecoder("utf-8", { fatal: true }).decode(prefix, { stream: file.size > prefix.length })
      return /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(value) ? null : value
    } catch { return null }
  }, [prefix, file.size])
  const signature = prefix ? detectFileSignature(prefix) : null
  const imageFile = file.size <= 8 * 1024 * 1024 && signature && ["png", "jpeg", "gif", "webp"].includes(signature.id) ? file : null
  const imageUrl = useObjectUrl(imageFile)
  return <section className="space-y-3 rounded-xl border border-md-outline-variant bg-md-surface-container-low p-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><div className="min-w-0"><h3 className="break-all font-mono text-sm font-semibold">{file.name}</h3><p className="text-xs text-md-on-surface-variant">{formatBinarySize(file.size)}</p></div><div className="flex flex-wrap gap-2"><BinaryFileDownload file={file} /><SendToMenu value={file} source={source ?? file.name} /></div></div>
    {imageUrl && <img src={imageUrl} alt={file.name} className="max-h-64 max-w-full rounded-lg object-contain" />}
    <SegmentedControl aria-label={t("previewMode")} value={mode} onValueChange={setMode} className="h-9"><SegmentedControlItem value="text">UTF-8</SegmentedControlItem><SegmentedControlItem value="hex">Hex</SegmentedControlItem></SegmentedControl>
    <pre className={"max-h-64 overflow-auto rounded-lg bg-md-surface p-3 font-mono text-xs leading-relaxed " + (mode === "hex" ? "whitespace-pre" : "whitespace-pre-wrap break-all")}>{!prefix ? t("loading") : mode === "hex" ? createHexdump(prefix.subarray(0, 512)) || t("emptyFile") : text === null ? t("notText") : text || t("emptyFile")}</pre>
    <p className="text-xs text-md-on-surface-variant">{t("previewHelp")}</p>
  </section>
}
