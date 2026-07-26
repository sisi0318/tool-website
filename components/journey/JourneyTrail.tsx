"use client"

import { useEffect, useRef } from "react"
import { ChevronRight, GitBranch } from "lucide-react"
import type { Journey } from "@/lib/journey/types"
import { getBranchPoints, getChildren, getPath } from "@/lib/journey/tree"
import { useTranslations } from "@/hooks/use-translations"

interface JourneyTrailProps {
  journey: Journey
  onSelect: (nodeId: string) => void
  /** Clicking the already-active (non-root) chip opens its step settings. */
  onOpenActiveStep: () => void
  onOpenBranches: () => void
}

export function JourneyTrail({ journey, onSelect, onOpenActiveStep, onOpenBranches }: JourneyTrailProps) {
  const t = useTranslations("journey")
  const activeChipRef = useRef<HTMLButtonElement>(null)
  const path = getPath(journey, journey.activeId)
  const branchPoints = getBranchPoints(journey)

  useEffect(() => {
    activeChipRef.current?.scrollIntoView({ block: "nearest", inline: "nearest" })
  }, [journey.activeId])

  return (
    <nav aria-label={t("title")} className="flex items-center gap-1">
      <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto py-1">
        {path.map((node, index) => {
          const isActive = node.id === journey.activeId
          const label = node.parentId === null ? t("trailInput") : node.label
          return (
            <div key={node.id} className="flex shrink-0 items-center gap-1">
              {index > 0 && (
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[var(--md-sys-color-outline)]" aria-hidden />
              )}
              <button
                ref={isActive ? activeChipRef : undefined}
                type="button"
                onClick={() => {
                  if (isActive && node.via) onOpenActiveStep()
                  else onSelect(node.id)
                }}
                aria-current={isActive ? "step" : undefined}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--md-sys-color-primary)] ${
                  isActive
                    ? "bg-[var(--md-sys-color-primary-container)] font-medium text-[var(--md-sys-color-on-primary-container)]"
                    : "border border-[var(--md-sys-color-outline-variant)] text-[var(--md-sys-color-on-surface-variant)] hover:bg-[var(--md-sys-color-surface-container-high)]"
                }`}
              >
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${
                    isActive
                      ? "bg-[var(--md-sys-color-on-primary-container)]/10"
                      : "bg-[var(--md-sys-color-surface-container-highest)]"
                  }`}
                  aria-hidden
                >
                  {index + 1}
                </span>
                <span className="max-w-[10rem] truncate">{label}</span>
                {branchPoints.has(node.id) && (
                  <span className="shrink-0 rounded-full bg-[var(--md-sys-color-tertiary-container)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--md-sys-color-on-tertiary-container)]">
                    {t("branchBadge").replace("{count}", String(getChildren(journey, node.id).length))}
                  </span>
                )}
              </button>
            </div>
          )
        })}
      </div>
      <button
        type="button"
        onClick={onOpenBranches}
        aria-label={t("branchesTitle")}
        title={t("branchesTitle")}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[var(--md-sys-color-on-surface-variant)] transition-colors hover:bg-[var(--md-sys-color-on-surface)]/[0.08] hover:text-[var(--md-sys-color-on-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--md-sys-color-primary)]"
      >
        <GitBranch className="h-4 w-4" />
      </button>
    </nav>
  )
}
