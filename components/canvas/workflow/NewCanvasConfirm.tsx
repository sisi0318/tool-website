"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import { useTranslations } from "@/hooks/use-translations"
import { zhCanvas } from "@/lib/translations/zh-namespaces/canvas"

interface NewCanvasConfirmProps {
  onCancel: () => void
  onDiscard: () => void
  onSave: () => void
}

/** 新建前发现画布有没保存的内容：取消、不保存、或先保存 */
export function NewCanvasConfirm({ onCancel, onDiscard, onSave }: NewCanvasConfirmProps) {
  const t = useTranslations("canvas", zhCanvas)

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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) onCancel()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="canvas-new-dialog-title"
        tabIndex={-1}
        className="outline-none w-80 max-w-full rounded-[var(--md-sys-shape-corner-large)] border border-md-outline-variant bg-md-surface-container-high p-4 text-md-on-surface shadow-2xl"
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
          <Button size="sm" onClick={onSave} autoFocus data-autofocus className="min-h-11 sm:min-h-9">
            {t("save")}
          </Button>
        </div>
      </div>
    </div>
  )
}
