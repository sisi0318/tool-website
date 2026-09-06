"use client"

import { useState } from "react"
import { FileText } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import PdfDocumentPanel from "@/components/tools/pdf-document-panel"
import PdfImagesPanel from "@/components/tools/pdf-images-panel"
import PdfOcrPanel from "@/components/tools/pdf-ocr-panel"
import { useTranslations } from "@/hooks/use-translations"

export default function PdfPage() {
  const t = useTranslations("pdfTools"), [mode, setMode] = useState("pages")
  return <div className="mx-auto max-w-7xl space-y-5 px-1 pb-8 sm:px-3"><div className="flex items-center gap-3"><FileText className="h-7 w-7 shrink-0 text-md-primary" /><div><h1 className="text-2xl font-semibold">{t("title")}</h1><p className="mt-1 text-sm text-md-on-surface-variant">{t("description")}</p></div></div><Tabs value={mode} onValueChange={setMode}><TabsList className="mb-4"><TabsTrigger value="pages">{t("pagesMode")}</TabsTrigger><TabsTrigger value="images">{t("imagesMode")}</TabsTrigger><TabsTrigger value="ocr">{t("ocrMode")}</TabsTrigger></TabsList><TabsContent value="pages" forceMount className="data-[state=inactive]:hidden"><PdfDocumentPanel /></TabsContent><TabsContent value="images" forceMount className="data-[state=inactive]:hidden"><PdfImagesPanel /></TabsContent><TabsContent value="ocr" forceMount className="data-[state=inactive]:hidden"><PdfOcrPanel isActive={mode === "ocr"} /></TabsContent></Tabs></div>
}
