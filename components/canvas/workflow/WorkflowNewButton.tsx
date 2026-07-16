"use client"

import { useEffect, useState } from "react"
import { FilePlus } from "lucide-react"
import { useCanvasStore } from "@/lib/canvas/store"
import { useTranslations } from "@/hooks/use-translations"
import { Button } from "@/components/ui/button"
import { SaveDialog } from "./SaveDialog"
import { saveWorkflow, getWorkflowList } from "@/lib/canvas/workflow"

function NewCanvasConfirm({
  onCancel,
  onDiscard,
  onSave,
}: {
  onCancel: () => void
  onDiscard: () => void
  onSave: () => void
}) {
  const t = useTranslations("canvas")

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation()
        onCancel()
      }
    }
    window.addEventListener("keydown", handleKeyDown, true)
    return () => window.removeEventListener("keydown", handleKeyDown, true)
  }, [onCancel])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--md-sys-color-scrim)]/50 p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) onCancel()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="canvas-new-dialog-title"
        className="w-80 max-w-full rounded-[var(--md-sys-shape-corner-large)] border border-md-outline-variant bg-md-surface-container-high p-4 text-md-on-surface shadow-2xl"
      >
        <h3 id="canvas-new-dialog-title" className="mb-2 text-sm font-semibold">
          {t("newCanvasTitle")}
        </h3>
        <p className="mb-4 text-xs text-md-on-surface-variant">
          {t("newCanvasMessage")}
        </p>
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onCancel} className="min-h-11 sm:min-h-9">
            {t("cancel")}
          </Button>
          <Button variant="outline" size="sm" onClick={onDiscard} className="min-h-11 sm:min-h-9">
            {t("dontSave")}
          </Button>
          <Button size="sm" onClick={onSave} autoFocus className="min-h-11 sm:min-h-9">
            {t("save")}
          </Button>
        </div>
      </div>
    </div>
  )
}

export function WorkflowNewButton() {
  const t = useTranslations("canvas")
  const nodes = useCanvasStore((s) => s.nodes)
  const edges = useCanvasStore((s) => s.edges)
  const clearCanvas = useCanvasStore((s) => s.clearCanvas)
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const handleClick = () => {
    if (nodes.length > 0) {
      setShowConfirm(true)
    } else {
      clearCanvas()
    }
  }

  const handleSave = (name: string) => {
    saveWorkflow(name, { nodes, edges })
    setShowSaveDialog(false)
    clearCanvas()
    setShowConfirm(false)
  }

  const handleDiscard = () => {
    clearCanvas()
    setShowConfirm(false)
  }

  if (showSaveDialog) {
    return (
      <SaveDialog
        onSave={handleSave}
        onCancel={() => setShowSaveDialog(false)}
        existingNames={getWorkflowList()}
      />
    )
  }

  if (showConfirm) {
    return (
      <NewCanvasConfirm
        onCancel={() => setShowConfirm(false)}
        onDiscard={handleDiscard}
        onSave={() => { setShowConfirm(false); setShowSaveDialog(true) }}
      />
    )
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="flex min-h-11 w-full items-center gap-2 rounded-[var(--md-sys-shape-corner-small)] px-2 py-1.5 text-left text-sm text-md-on-surface transition-colors hover:bg-[var(--md-sys-color-on-surface)]/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-md-primary"
    >
      <FilePlus aria-hidden="true" className="h-4 w-4 text-md-on-surface-variant" />
      {t("newCanvas")}
    </button>
  )
}
