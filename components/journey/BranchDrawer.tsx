"use client"

import type { ReactNode } from "react"
import { Trash2 } from "lucide-react"
import type { Journey, JourneyNode } from "@/lib/journey/types"
import { getChildren } from "@/lib/journey/tree"
import { formatCanvasValue } from "@/lib/canvas/format-value"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useTranslations } from "@/hooks/use-translations"

interface BranchDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  journey: Journey
  onSelect: (nodeId: string) => void
  onDelete: (nodeId: string) => void
}

export function BranchDrawer({ open, onOpenChange, journey, onSelect, onDelete }: BranchDrawerProps) {
  const t = useTranslations("journey")
  const root = journey.nodes[journey.rootId]

  const renderNode = (node: JourneyNode, depth: number): ReactNode => {
    const isActive = node.id === journey.activeId
    const isRoot = node.parentId === null
    const compact = node.valueMissing ? t("valueMissingTitle") : formatCanvasValue(node.value).slice(0, 80)
    return (
      <div key={node.id}>
        <div className="flex items-center gap-1" style={{ paddingLeft: `${depth * 16}px` }}>
          <button
            type="button"
            onClick={() => onSelect(node.id)}
            title={t("switchTo")}
            className={`flex min-w-0 flex-1 items-center gap-2 rounded-2xl px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--md-sys-color-primary)] ${
              isActive
                ? "bg-[var(--md-sys-color-primary-container)]"
                : "hover:bg-[var(--md-sys-color-surface-container-high)]"
            }`}
          >
            <span
              className={`shrink-0 text-sm font-medium ${
                isActive
                  ? "text-[var(--md-sys-color-on-primary-container)]"
                  : "text-[var(--md-sys-color-on-surface)]"
              }`}
            >
              {isRoot ? t("trailInput") : node.label}
            </span>
            {isActive && (
              <span className="shrink-0 rounded-full bg-[var(--md-sys-color-primary)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--md-sys-color-on-primary)]">
                {t("activeBranch")}
              </span>
            )}
            <span
              className={`min-w-0 truncate font-mono text-xs ${
                isActive
                  ? "text-[var(--md-sys-color-on-primary-container)]/70"
                  : "text-[var(--md-sys-color-on-surface-variant)]"
              }`}
            >
              {compact}
            </span>
          </button>
          {!isRoot && (
            <button
              type="button"
              onClick={() => onDelete(node.id)}
              aria-label={t("deleteStep")}
              title={t("deleteStep")}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[var(--md-sys-color-on-surface-variant)] transition-colors hover:bg-[var(--md-sys-color-error-container)]/60 hover:text-[var(--md-sys-color-error)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--md-sys-color-error)]"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        {getChildren(journey, node.id).map((child) => renderNode(child, depth + 1))}
      </div>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg rounded-3xl border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container-low)]">
        <DialogHeader>
          <DialogTitle className="text-[var(--md-sys-color-on-surface)]">{t("branchesTitle")}</DialogTitle>
        </DialogHeader>
        <div className="max-h-[60vh] space-y-0.5 overflow-y-auto pr-1">{root ? renderNode(root, 0) : null}</div>
      </DialogContent>
    </Dialog>
  )
}
