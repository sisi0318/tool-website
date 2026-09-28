"use client"

import { LoaderCircle } from "lucide-react"
import { getNodeDefinition } from "@/lib/canvas/registry"
import { Button } from "@/components/ui/button"
import { useNodeLabel } from "@/hooks/use-node-label"
import { useTranslations } from "@/hooks/use-translations"
import { zhJourney } from "@/lib/translations/zh-namespaces/journey"
import { zhWorkflowTemplates } from "@/lib/translations/zh-namespaces/workflowTemplates"
import type { TemplateRunProgress } from "./TemplateStage"

/**
 * 正在运行的步骤与取消按钮。单步、改参数重算、重新提供输入以前都不能取消，
 * OCR 这类慢步骤会让整页禁用好几分钟；对话框和步骤面板是模态的，所以它们里面各放一份。
 */
export function RunStatus({ progress, onCancel }: { progress: TemplateRunProgress; onCancel: () => void }) {
  const t = useTranslations("journey", zhJourney)
  const wt = useTranslations("workflowTemplates", zhWorkflowTemplates)
  const nodeLabel = useNodeLabel()
  const definition = getNodeDefinition(progress.tool)
  const tool = definition ? nodeLabel(definition) : progress.tool
  const stage = progress.total > 1
    ? wt("progress").replace("{current}", String(progress.current)).replace("{total}", String(progress.total))
    : t("applying")

  return (
    <div role="status" className="flex flex-wrap items-center gap-3 rounded-2xl bg-md-primary-container p-3 text-sm text-md-on-primary-container">
      <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" />
      <span className="min-w-0 flex-1">{stage} · {tool}</span>
      <Button variant="outline" size="sm" onClick={onCancel}>{wt("cancel")}</Button>
    </div>
  )
}
