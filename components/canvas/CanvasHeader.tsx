"use client"

import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { hasUnsavedCanvasChanges, useCanvasStore } from "@/lib/canvas/store"
import { useTranslations } from "@/hooks/use-translations"
import { zhCanvas } from "@/lib/translations/zh-namespaces/canvas"
import { FLOATING_SURFACE } from "./chrome"
import { WorkflowMenu } from "./workflow/WorkflowMenu"

/** 画布左上角：返回、工作流名称（点开是文件操作），以及节点数和保存状态 */
export function CanvasHeader() {
  const t = useTranslations("canvas", zhCanvas)
  const tCommon = useTranslations("common")
  const nodeCount = useCanvasStore((state) => state.nodes.length)
  const named = useCanvasStore((state) => state.currentWorkflow !== null)
  const unsaved = useCanvasStore(hasUnsavedCanvasChanges)
  const saveState = unsaved ? t("workflowUnsaved") : named ? t("workflowSavedState") : null

  return (
    <div className={`${FLOATING_SURFACE} pointer-events-auto flex min-w-0 items-center gap-0.5 p-1`}>
      <Link
        href="/tools"
        aria-label={tCommon("backToTools")}
        title={tCommon("backToTools")}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--md-sys-shape-corner-medium)] text-md-on-surface-variant transition-colors hover:bg-md-hover hover:text-md-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-md-primary sm:h-9 sm:w-9"
      >
        <ArrowLeft aria-hidden="true" className="h-4 w-4" />
      </Link>
      <WorkflowMenu />
      <p className="hidden shrink-0 items-center gap-1.5 border-l border-md-outline-variant py-1 pl-3 pr-2.5 text-xs text-md-on-surface-variant md:flex">
        <span className="tabular-nums">{t("nodeCount").replace("{count}", String(nodeCount))}</span>
        {saveState && (
          <>
            <span aria-hidden="true">·</span>
            <span>{saveState}</span>
          </>
        )}
      </p>
    </div>
  )
}
