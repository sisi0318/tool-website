"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import { useTranslations } from "@/hooks/use-translations"
import { Trash2 } from "lucide-react"

interface LoadDialogProps {
  workflows: string[]
  onLoad: (name: string) => void
  onDelete: (name: string) => void
  onClose: () => void
}

export function LoadDialog({ workflows, onLoad, onDelete, onClose }: LoadDialogProps) {
  const t = useTranslations("canvas")

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation()
        onClose()
      }
    }
    window.addEventListener("keydown", handleKeyDown, true)
    return () => window.removeEventListener("keydown", handleKeyDown, true)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--md-sys-color-scrim)]/50 p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="canvas-load-dialog-title"
        className="w-80 max-w-full rounded-[var(--md-sys-shape-corner-large)] border border-md-outline-variant bg-md-surface-container-high p-4 text-md-on-surface shadow-2xl"
      >
        <h3 id="canvas-load-dialog-title" className="mb-2 text-sm font-semibold">
          {t("loadWorkflow")}
        </h3>
        <div className="mb-4 max-h-60 overflow-auto rounded-[var(--md-sys-shape-corner-small)] border border-md-outline-variant">
          {workflows.length === 0 ? (
            <p className="p-4 text-center text-xs text-md-on-surface-variant">{t("noSavedWorkflows")}</p>
          ) : (
            workflows.map((name) => (
              <div
                key={name}
                className="flex items-center justify-between border-b border-md-outline-variant px-3 py-1.5 last:border-b-0 hover:bg-[var(--md-sys-color-on-surface)]/[0.04]"
              >
                <button
                  type="button"
                  onClick={() => onLoad(name)}
                  className="min-h-9 flex-1 rounded text-left text-sm text-md-on-surface outline-none transition-colors hover:text-md-primary focus-visible:ring-2 focus-visible:ring-md-primary"
                >
                  {name}
                </button>
                <button
                  type="button"
                  onClick={(event) => { event.stopPropagation(); onDelete(name) }}
                  aria-label={`${t("deleteNode")}: ${name}`}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-md-on-surface-variant outline-none transition-colors hover:bg-md-error-container/60 hover:text-md-error focus-visible:ring-2 focus-visible:ring-md-primary"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))
          )}
        </div>
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={onClose} className="min-h-11 sm:min-h-9">
            {t("close")}
          </Button>
        </div>
      </div>
    </div>
  )
}
