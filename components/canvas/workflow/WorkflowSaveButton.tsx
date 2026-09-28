"use client"

import { CopyPlus, Save } from "lucide-react"
import { useTranslations } from "@/hooks/use-translations"
import { requestWorkflowSave } from "./WorkflowSaveController"

const BUTTON_CLASS = "flex min-h-11 w-full items-center gap-2 rounded-[var(--md-sys-shape-corner-small)] px-2 py-1.5 text-left text-sm text-md-on-surface transition-colors hover:bg-[var(--md-sys-color-on-surface)]/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-md-primary"

/** 保存与另存为；实际的保存与命名对话框在常驻的 WorkflowSaveController 里 */
export function WorkflowSaveButton() {
  const t = useTranslations("canvas")
  return (
    <>
      <button type="button" onClick={() => requestWorkflowSave(false)} className={BUTTON_CLASS}>
        <Save aria-hidden="true" className="h-4 w-4 text-md-on-surface-variant" />
        {t("save")}
        <kbd aria-hidden="true" className="ml-auto hidden text-[10px] text-md-on-surface-variant sm:inline">Ctrl S</kbd>
      </button>
      <button type="button" onClick={() => requestWorkflowSave(true)} className={BUTTON_CLASS}>
        <CopyPlus aria-hidden="true" className="h-4 w-4 text-md-on-surface-variant" />
        {t("saveAs")}
      </button>
    </>
  )
}
