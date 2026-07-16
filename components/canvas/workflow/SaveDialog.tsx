"use client"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { useTranslations } from "@/hooks/use-translations"

interface SaveDialogProps {
  onSave: (name: string) => void
  onCancel: () => void
  existingNames: string[]
}

export function SaveDialog({ onSave, onCancel, existingNames }: SaveDialogProps) {
  const t = useTranslations("canvas")
  const [name, setName] = useState("")
  const [showOverwrite, setShowOverwrite] = useState(false)
  const [error, setError] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

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

  const handleSave = () => {
    if (!name.trim()) {
      setError(t("nameRequired"))
      return
    }
    if (existingNames.includes(name.trim())) {
      setShowOverwrite(true)
      return
    }
    onSave(name.trim())
  }

  const handleOverwrite = () => {
    onSave(name.trim())
  }

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
        aria-labelledby="canvas-save-dialog-title"
        className="w-80 max-w-full rounded-[var(--md-sys-shape-corner-large)] border border-md-outline-variant bg-md-surface-container-high p-4 text-md-on-surface shadow-2xl"
      >
        {showOverwrite ? (
          <>
            <h3 id="canvas-save-dialog-title" className="mb-2 text-sm font-semibold">
              {t("workflowExistsTitle")}
            </h3>
            <p className="mb-4 text-xs text-md-on-surface-variant">
              {t("workflowExistsMessage").replace("{name}", name)}
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={onCancel} className="min-h-11 sm:min-h-9">
                {t("cancel")}
              </Button>
              <Button size="sm" onClick={handleOverwrite} className="min-h-11 sm:min-h-9">
                {t("overwrite")}
              </Button>
            </div>
          </>
        ) : (
          <>
            <h3 id="canvas-save-dialog-title" className="mb-2 text-sm font-semibold">
              {t("saveWorkflow")}
            </h3>
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={(event) => { setName(event.target.value); setError("") }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault()
                  handleSave()
                }
              }}
              placeholder={t("saveWorkflowPlaceholder")}
              aria-invalid={Boolean(error)}
              className="mb-2 w-full rounded-[var(--md-sys-shape-corner-small)] border border-md-outline-variant bg-md-surface-container-lowest px-3 py-2 text-sm text-md-on-surface outline-none focus-visible:ring-2 focus-visible:ring-md-primary"
            />
            {error && <p className="mb-2 text-xs text-md-error">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={onCancel} className="min-h-11 sm:min-h-9">
                {t("cancel")}
              </Button>
              <Button size="sm" onClick={handleSave} className="min-h-11 sm:min-h-9">
                {t("confirm")}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
