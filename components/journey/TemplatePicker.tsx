"use client"

import { FileImage, FileText, Workflow } from "lucide-react"
import { JOURNEY_TEMPLATES, type JourneyTemplate } from "@/lib/journey/templates"
import { useTranslations } from "@/hooks/use-translations"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { JOURNEY_DIALOG_CLASS } from "./dialog-style"

export function TemplatePicker({ open, onOpenChange, onChoose }: { open: boolean; onOpenChange: (open: boolean) => void; onChoose: (template: JourneyTemplate) => void }) {
  const t = useTranslations("workflowTemplates")
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className={`max-h-[90dvh] w-[calc(100%-2rem)] max-w-3xl overflow-y-auto p-5 sm:p-6 ${JOURNEY_DIALOG_CLASS}`}>
    <DialogHeader><DialogTitle className="flex items-center gap-2 text-md-on-surface"><Workflow className="h-5 w-5 text-md-primary" />{t("title")}</DialogTitle><DialogDescription className="text-md-on-surface-variant">{t("description")}</DialogDescription></DialogHeader>
    <div className="grid gap-3 sm:grid-cols-2">{JOURNEY_TEMPLATES.map(template => { const Icon = template.input === "image" ? FileImage : FileText; return <article key={template.id} className="flex min-w-0 flex-col rounded-2xl border border-md-outline-variant bg-md-surface-container-lowest p-4"><h3 className="flex items-center gap-2 font-semibold text-md-on-surface"><Icon className="h-4 w-4 shrink-0 text-md-primary" />{t(`${template.id}_title`)}</h3><p className="mt-2 flex-1 text-sm leading-6 text-md-on-surface-variant">{t(`${template.id}_description`)}</p><p className="mt-3 text-xs text-md-on-surface-variant">{t(template.input === "image" ? "imageInput" : "textInput")} · {template.steps.length} {t("steps")}</p><Button size="sm" variant="outline" className="mt-3 w-full" aria-label={`${t("use")} · ${t(`${template.id}_title`)}`} onClick={() => onChoose(template)}>{t("use")}</Button></article> })}</div>
    <p className="text-xs leading-5 text-md-on-surface-variant">{t("pickerHint")}</p>
  </DialogContent></Dialog>
}
