"use client"

import { useState } from "react"
import { Save } from "lucide-react"
import { useCanvasStore } from "@/lib/canvas/store"
import { useTranslations } from "@/hooks/use-translations"
import { SaveDialog } from "./SaveDialog"
import { saveWorkflow, getWorkflowList } from "@/lib/canvas/workflow"

export function WorkflowSaveButton() {
  const t = useTranslations("canvas")
  const nodes = useCanvasStore((s) => s.nodes)
  const edges = useCanvasStore((s) => s.edges)
  const [showDialog, setShowDialog] = useState(false)

  const handleSave = (name: string) => {
    saveWorkflow(name, { nodes, edges })
    setShowDialog(false)
  }

  if (showDialog) {
    return (
      <SaveDialog
        onSave={handleSave}
        onCancel={() => setShowDialog(false)}
        existingNames={getWorkflowList()}
      />
    )
  }

  return (
    <button
      type="button"
      onClick={() => setShowDialog(true)}
      className="flex min-h-11 w-full items-center gap-2 rounded-[var(--md-sys-shape-corner-small)] px-2 py-1.5 text-left text-sm text-md-on-surface transition-colors hover:bg-[var(--md-sys-color-on-surface)]/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-md-primary"
    >
      <Save aria-hidden="true" className="h-4 w-4 text-md-on-surface-variant" />
      {t("save")}
    </button>
  )
}
