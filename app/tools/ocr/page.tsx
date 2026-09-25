"use client"

import { useMemo, useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import ImageOcrPanel from "@/components/tools/image-ocr-panel"
import PdfOcrPanel from "@/components/tools/pdf-ocr-panel"
import ImageBatchPanel from "@/components/tools/image-batch-panel"
import { BusyTabIndicator, useBusyModes } from "@/components/tools/busy-tab-indicator"
import { useTranslations } from "@/hooks/use-translations"
import { PanelActivityProvider } from "@/components/tool-activity"

const MODES = ["image", "pdf", "batch"] as const

export default function OcrPage() {
  const t = useTranslations("ocrTools"), [mode, setMode] = useState("image")
  const { busy, reporters } = useBusyModes(MODES)
  const labels = useMemo(() => ({ image: t("imageMode"), pdf: t("pdfMode"), batch: t("batchMode") }), [t])
  return <div className="container mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6"><Tabs value={mode} onValueChange={setMode}><TabsList className="mb-5">{MODES.map(value => <TabsTrigger key={value} value={value} className="gap-1.5">{labels[value]}<BusyTabIndicator busy={busy[value]} /></TabsTrigger>)}</TabsList><TabsContent value="image" forceMount className="data-[state=inactive]:hidden"><PanelActivityProvider active={mode === "image"}><ImageOcrPanel onBusyChange={reporters.image} /></PanelActivityProvider></TabsContent><TabsContent value="pdf" forceMount className="data-[state=inactive]:hidden"><PanelActivityProvider active={mode === "pdf"}><PdfOcrPanel isActive={mode === "pdf"} headingLevel="h1" onBusyChange={reporters.pdf} /></PanelActivityProvider></TabsContent><TabsContent value="batch" forceMount className="data-[state=inactive]:hidden"><PanelActivityProvider active={mode === "batch"}><ImageBatchPanel onBusyChange={reporters.batch} /></PanelActivityProvider></TabsContent></Tabs></div>
}
