"use client"

import { Copy, CopyPlus, Trash2 } from "lucide-react"
import { useTranslations } from "@/hooks/use-translations"
import { zhCanvas } from "@/lib/translations/zh-namespaces/canvas"

interface SelectionToolbarProps {
  count: number
  onCopy: () => void
  onDuplicate: () => void
  onDelete: () => void
}

export function SelectionToolbar({
  count,
  onCopy,
  onDuplicate,
  onDelete,
}: SelectionToolbarProps) {
  const t = useTranslations("canvas", zhCanvas)

  if (count < 2) return null

  const buttonClass =
    "nodrag nopan inline-flex h-11 items-center gap-1.5 rounded-[var(--md-sys-shape-corner-small)] px-3 text-xs font-medium text-md-on-surface-variant transition-colors hover:bg-md-hover hover:text-md-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-md-primary sm:h-9 sm:px-2.5"

  return (
    <div
      role="toolbar"
      aria-label={t("selectionToolbar")}
      // 手机上底边是视图工具条和「节点库」按钮，这一条排在它们上面
      className="scrollbar-hide absolute bottom-[calc(max(0.75rem,env(safe-area-inset-bottom))+3.75rem)] left-1/2 z-20 flex max-w-[calc(100%-1rem)] -translate-x-1/2 items-center gap-0.5 overflow-x-auto rounded-[var(--md-sys-shape-corner-large)] border border-md-outline-variant bg-md-surface-container p-1 shadow-xl lg:bottom-3"
    >
      <span className="shrink-0 px-2 text-xs font-medium text-md-on-surface-variant">
        {t("selectedNodes").replace("{count}", String(count))}
      </span>
      <span className="mx-1 h-5 w-px shrink-0 bg-md-outline-variant" aria-hidden="true" />
      <button type="button" onClick={onCopy} className={buttonClass} title={`${t("copyNodes")} (Ctrl/Cmd+C)`}>
        <Copy className="size-4" />
        <span>{t("copyNodes")}</span>
      </button>
      <button type="button" onClick={onDuplicate} className={buttonClass} title={`${t("duplicateNodes")} (Ctrl/Cmd+D)`}>
        <CopyPlus className="size-4" />
        <span>{t("duplicateNodes")}</span>
      </button>
      <button
        type="button"
        onClick={onDelete}
        className={`${buttonClass} text-md-error hover:bg-md-error-container hover:text-md-on-error-container`}
        title={t("deleteSelectedNodes")}
      >
        <Trash2 className="size-4" />
        <span>{t("deleteSelectedNodes")}</span>
      </button>
    </div>
  )
}
