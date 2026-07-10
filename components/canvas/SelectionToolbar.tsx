"use client"

import { Copy, CopyPlus, Trash2 } from "lucide-react"
import { useTranslations } from "@/hooks/use-translations"

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
  const t = useTranslations("canvas")

  if (count < 2) return null

  const buttonClass =
    "nodrag nopan inline-flex h-11 items-center gap-1.5 rounded-lg px-3 text-xs font-medium text-gray-700 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-gray-200 dark:hover:bg-gray-700 sm:h-9 sm:px-2.5"

  return (
    <div
      role="toolbar"
      aria-label={t("selectionToolbar")}
      className="absolute bottom-[max(1rem,env(safe-area-inset-bottom))] left-1/2 z-20 flex max-w-[calc(100%-1rem)] -translate-x-1/2 items-center gap-0.5 overflow-x-auto rounded-xl border border-gray-200 bg-white/95 p-1 shadow-xl backdrop-blur dark:border-gray-700 dark:bg-gray-900/95"
    >
      <span className="shrink-0 px-2 text-xs font-medium text-gray-500 dark:text-gray-400">
        {t("selectedNodes").replace("{count}", String(count))}
      </span>
      <span className="mx-1 h-5 w-px shrink-0 bg-gray-200 dark:bg-gray-700" aria-hidden="true" />
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
        className={`${buttonClass} text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40`}
        title={t("deleteSelectedNodes")}
      >
        <Trash2 className="size-4" />
        <span>{t("deleteSelectedNodes")}</span>
      </button>
    </div>
  )
}
