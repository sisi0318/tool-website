"use client"

import { ArrowRight, Undo2 } from "lucide-react"
import type { ToolTransfer } from "@/lib/tool-transfer"
import { previewCanvasValue } from "@/lib/canvas/format-value"
import { useTranslations } from "@/hooks/use-translations"
import { Button } from "@/components/ui/button"

export function TransferIntake({ transfer, onStart, onRestore }: { transfer: ToolTransfer; onStart: () => void; onRestore: () => void }) {
  const t = useTranslations("toolTransfer")
  const preview = previewCanvasValue(transfer.value, 3000, true)
  return <section className="mx-auto max-w-3xl space-y-4 px-4 py-8">
    <h1 className="text-xl font-semibold">{t("received")}</h1>
    <p className="break-all text-sm text-md-on-surface-variant">{transfer.source} · {transfer.valueType}</p>
    <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-all rounded-xl bg-md-surface-container-low p-4 font-mono text-xs">{preview.text}{preview.truncated ? "…" : ""}</pre>
    <p className="text-sm text-md-on-surface-variant">{t("draftConflict")}</p>
    <div className="flex flex-wrap gap-2"><Button onClick={onStart}><ArrowRight />{t("startNew")}</Button><Button variant="outline" onClick={onRestore}><Undo2 />{t("restoreDraft")}</Button></div>
  </section>
}
