"use client"

import { useEffect, useState } from "react"
import { LoaderCircle } from "lucide-react"
import { getNodeDefinition } from "@/lib/canvas/registry"
import type { RunProgress } from "@/lib/journey/session"
import type { JourneyStep } from "@/lib/journey/types"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { JOURNEY_DIALOG_CLASS } from "./dialog-style"
import { Button } from "@/components/ui/button"
import { useTranslations } from "@/hooks/use-translations"
import { zhJourney } from "@/lib/translations/zh-namespaces/journey"
import { useNodeLabel } from "@/hooks/use-node-label"
import { RunStatus } from "./RunStatus"
import { StepConfigForm, draftOf, type StepDraft } from "./StepConfigForm"

interface StepSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** 要加的这一步；它带着工具的默认参数，确认后才运行 */
  step: JourneyStep | null
  running: boolean
  /** 正在运行的步骤；面板是模态的，页面上的取消按钮点不到，所以面板里也放一份 */
  progress?: RunProgress | null
  onCancel?: () => void
  onRun: (config: Record<string, unknown>, outputPort: string) => void
}

/**
 * 加一步之前先填参数。只用于第一次运行就得由人确认的工具：有参数要填的、会联网的、需要手动执行的。
 * 已经在路上的步骤直接在详情区里改参数（StepSettings），不再弹这个面板。
 */
export function StepSheet({ open, onOpenChange, step, running, progress, onCancel, onRun }: StepSheetProps) {
  const t = useTranslations("journey", zhJourney)
  const nodeLabel = useNodeLabel()
  const [draft, setDraft] = useState<StepDraft>({ config: {}, outputPort: "" })

  useEffect(() => {
    if (open && step) setDraft(draftOf(step))
  }, [open, step])

  const definition = step ? getNodeDefinition(step.tool) : undefined

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`max-w-lg ${JOURNEY_DIALOG_CLASS}`}>
        <DialogHeader>
          <DialogTitle className="text-[var(--md-sys-color-on-surface)]">
            {t("stepConfigTitle")}
            {definition && (
              <span className="ml-2 text-sm font-normal text-[var(--md-sys-color-on-surface-variant)]">{nodeLabel(definition)}</span>
            )}
          </DialogTitle>
          <DialogDescription>{t("configureNewStep")}</DialogDescription>
        </DialogHeader>
        <div className="max-h-[55vh] overflow-y-auto pr-1">
          {step && <StepConfigForm tool={step.tool} draft={draft} onChange={setDraft} disabled={running} />}
        </div>
        {running && progress && onCancel && <RunStatus progress={progress} onCancel={onCancel} />}
        <div className="flex justify-end">
          <Button
            onClick={() => onRun(draft.config, draft.outputPort)}
            disabled={running || !definition}
            className="rounded-full bg-[var(--md-sys-color-primary)] px-6 text-[var(--md-sys-color-on-primary)] hover:bg-[var(--md-sys-color-primary)]/90"
          >
            {running && <LoaderCircle className="h-4 w-4 animate-spin" />}
            {t("runNewStep")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
