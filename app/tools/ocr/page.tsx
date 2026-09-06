"use client"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import ImageOcrPanel from "@/components/tools/image-ocr-panel"
import PdfOcrPanel from "@/components/tools/pdf-ocr-panel"
import { useTranslations } from "@/hooks/use-translations"

export default function OcrPage() {
  const t = useTranslations("ocrTools"), [mode, setMode] = useState("image")
  return <div className="container mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6"><Tabs value={mode} onValueChange={setMode}><TabsList className="mb-5"><TabsTrigger value="image">{t("imageMode")}</TabsTrigger><TabsTrigger value="pdf">{t("pdfMode")}</TabsTrigger></TabsList><TabsContent value="image" forceMount className="data-[state=inactive]:hidden"><ImageOcrPanel isActive={mode === "image"} /></TabsContent><TabsContent value="pdf" forceMount className="data-[state=inactive]:hidden"><PdfOcrPanel isActive={mode === "pdf"} headingLevel="h1" /></TabsContent></Tabs></div>
}
