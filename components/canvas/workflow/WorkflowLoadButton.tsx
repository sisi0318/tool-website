"use client"

import { useState, useCallback } from "react"
import { FolderOpen } from "lucide-react"
import { useCanvasStore } from "@/lib/canvas/store"
import { useTranslations } from "@/hooks/use-translations"
import { LoadDialog } from "./LoadDialog"
import { getWorkflowList, loadWorkflow, deleteWorkflow } from "@/lib/canvas/workflow"

export function WorkflowLoadButton() {
  const t = useTranslations("canvas")
  const [showDialog, setShowDialog] = useState(false)
  const [workflows, setWorkflows] = useState<string[]>([])
  const replaceWorkflow = useCanvasStore((state) => state.replaceWorkflow)

  const handleOpen = useCallback(() => {
    setWorkflows(getWorkflowList())
    setShowDialog(true)
  }, [])

  const handleDelete = useCallback((name: string) => {
    deleteWorkflow(name)
    setWorkflows(getWorkflowList())
  }, [])

  const handleLoad = useCallback((name: string) => {
    const data = loadWorkflow(name)
    if (data) {
      replaceWorkflow(data)
      setShowDialog(false)
    }
  }, [replaceWorkflow])

  if (showDialog) {
    return (
      <LoadDialog
        workflows={workflows}
        onLoad={handleLoad}
        onDelete={handleDelete}
        onClose={() => setShowDialog(false)}
      />
    )
  }

  return (
    <button
      type="button"
      onClick={handleOpen}
      className="flex min-h-11 w-full items-center gap-2 rounded-[var(--md-sys-shape-corner-small)] px-2 py-1.5 text-left text-sm text-md-on-surface transition-colors hover:bg-[var(--md-sys-color-on-surface)]/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-md-primary"
    >
      <FolderOpen aria-hidden="true" className="h-4 w-4 text-md-on-surface-variant" />
      {t("load")}
    </button>
  )
}
