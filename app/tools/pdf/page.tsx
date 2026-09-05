"use client"

import { FileText } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import PdfDocumentPanel from "@/components/tools/pdf-document-panel"
import PdfImagesPanel from "@/components/tools/pdf-images-panel"
import { useTranslations } from "@/hooks/use-translations"

export default function PdfPage() {
  const t = useTranslations("pdfTools")
  return <div className="mx-auto max-w-7xl space-y-5 px-1 pb-8 sm:px-3"><div className="flex items-center gap-3"><FileText className="h-7 w-7 shrink-0 text-md-primary" /><div><h1 className="text-2xl font-semibold">{t("title")}</h1><p className="mt-1 text-sm text-md-on-surface-variant">{t("description")}</p></div></div><Tabs defaultValue="pages"><TabsList className="mb-4"><TabsTrigger value="pages">{t("pagesMode")}</TabsTrigger><TabsTrigger value="images">{t("imagesMode")}</TabsTrigger></TabsList><TabsContent value="pages" forceMount className="data-[state=inactive]:hidden"><PdfDocumentPanel /></TabsContent><TabsContent value="images" forceMount className="data-[state=inactive]:hidden"><PdfImagesPanel /></TabsContent></Tabs></div>
}
