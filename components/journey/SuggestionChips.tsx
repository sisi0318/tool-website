"use client"

import { useMemo } from "react"
import { LayoutGrid, LoaderCircle } from "lucide-react"
import type { JourneyNode, JourneySuggestion } from "@/lib/journey/types"
import { suggestNext } from "@/lib/journey/suggest"
import { useTranslations } from "@/hooks/use-translations"
import { zhJourney } from "@/lib/translations/zh-namespaces/journey"
import { zhJourneySuggestions } from "@/lib/translations/zh-namespaces/journeySuggestions"
import { useNodeLabel } from "@/hooks/use-node-label"

interface SuggestionChipsProps {
  node: JourneyNode
  running: boolean
  onApply: (suggestion: JourneySuggestion) => void
  onMoreTools: () => void
}

export function SuggestionChips({ node, running, onApply, onMoreTools }: SuggestionChipsProps) {
  const t = useTranslations("journey", zhJourney)
  const st = useTranslations("journeySuggestions", zhJourneySuggestions)
  const nodeLabel = useNodeLabel()
  // 精选建议有自己的动作短语；类型兼容的兜底建议显示工具名
  const labelOf = (suggestion: JourneySuggestion) =>
    suggestion.labelKey ? st(suggestion.labelKey) : nodeLabel({ type: suggestion.tool, label: suggestion.label })

  const suggestions = useMemo(
    () => (node.valueMissing ? [] : suggestNext(node.value, node.valueType, 6)),
    [node.value, node.valueType, node.valueMissing],
  )

  return (
    <section className="rounded-3xl bg-[var(--md-sys-color-surface-container-low)] p-4 shadow-sm sm:p-5">
      <div className="flex items-center gap-2">
        <h2 className="text-xs font-medium uppercase tracking-wide text-[var(--md-sys-color-on-surface-variant)]">
          {t("nextStepTitle")}
        </h2>
        {running && (
          <span className="inline-flex items-center gap-1 text-xs text-[var(--md-sys-color-primary)]">
            <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden />
            {t("applying")}
          </span>
        )}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {suggestions.map((suggestion) => (
          <button
            key={`${suggestion.tool}:${JSON.stringify(suggestion.config)}`}
            type="button"
            disabled={running}
            onClick={() => onApply(suggestion)}
            className="inline-flex items-center gap-1.5 rounded-full bg-[var(--md-sys-color-secondary-container)] px-3.5 py-2 text-sm font-medium text-[var(--md-sys-color-on-secondary-container)] transition-all hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--md-sys-color-primary)] disabled:opacity-50"
          >
            {labelOf(suggestion)}
            {suggestion.reason === "detection" && suggestion.detectionType ? (
              <span className="rounded-full bg-[var(--md-sys-color-secondary)]/15 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide">
                {suggestion.detectionType}
              </span>
            ) : (
              <span className="text-[10px] font-normal text-[var(--md-sys-color-on-secondary-container)]/70">
                {t("compatibleReason")}
              </span>
            )}
          </button>
        ))}
        <button
          type="button"
          disabled={running}
          onClick={onMoreTools}
          className="inline-flex items-center gap-1.5 rounded-full border border-[var(--md-sys-color-outline-variant)] px-3.5 py-2 text-sm text-[var(--md-sys-color-on-surface-variant)] transition-colors hover:bg-[var(--md-sys-color-surface-container-high)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--md-sys-color-primary)] disabled:opacity-50"
        >
          <LayoutGrid className="h-3.5 w-3.5" aria-hidden />
          {t("moreTools")}
        </button>
      </div>
    </section>
  )
}
