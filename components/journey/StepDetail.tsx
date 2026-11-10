"use client"

import { Trash2 } from "lucide-react"
import { getTipId } from "@/lib/journey/tree"
import type { Journey, JourneySuggestion } from "@/lib/journey/types"
import { SendToMenu } from "@/components/tools/send-to-menu"
import { useTranslations } from "@/hooks/use-translations"
import { zhJourney } from "@/lib/translations/zh-namespaces/journey"
import { StepSettings, type StepSettingsResult } from "./StepSettings"
import { SuggestionChips } from "./SuggestionChips"
import { ValueCard } from "./ValueCard"
import { useStepTitle } from "./use-step-title"

interface StepDetailProps {
  journey: Journey
  /** 有运行锁着界面（改参数时的即时重算不算） */
  busy: boolean
  onChangeStep: (nodeId: string, config: Record<string, unknown>, outputPort: string, options: { live: boolean }) => Promise<StepSettingsResult>
  onDeleteStep: (nodeId: string) => void
  onEditInput: () => void
  onRerunFromRoot: () => void
  onApplySuggestion: (suggestion: JourneySuggestion) => void
  onMoreTools: () => void
}

/**
 * 选中那一步的全部：它是什么、参数、结果、从这里还能往哪走。
 * 参数就地改，结果就在下面跟着变；以前改参数要进一个弹层，弹层把结果盖住了。
 */
export function StepDetail({ journey, busy, onChangeStep, onDeleteStep, onEditInput, onRerunFromRoot, onApplySuggestion, onMoreTools }: StepDetailProps) {
  const t = useTranslations("journey", zhJourney)
  const stepTitle = useStepTitle()
  const node = journey.nodes[journey.activeId] ?? journey.nodes[journey.rootId]
  if (!node) return null

  const parent = node.parentId ? journey.nodes[node.parentId] : null
  const atEnd = node.id === getTipId(journey)

  return (
    <section aria-label={stepTitle(node)} className="min-w-0 space-y-3">
      <div className="flex items-center gap-2 px-1">
        <h2 className="min-w-0 flex-1 truncate text-base font-semibold text-[var(--md-sys-color-on-surface)]">{stepTitle(node)}</h2>
        {node.via && (
          <button
            type="button"
            onClick={() => onDeleteStep(node.id)}
            disabled={busy}
            aria-label={t("deleteStep")}
            title={t("deleteStep")}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[var(--md-sys-color-on-surface-variant)] transition-colors hover:bg-[var(--md-sys-color-error-container)]/60 hover:text-[var(--md-sys-color-on-error-container)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--md-sys-color-primary)] disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" aria-hidden />
          </button>
        )}
      </div>

      {node.via && parent && (
        <StepSettings
          key={node.id}
          step={node.via}
          input={parent.value}
          busy={busy}
          onChange={(config, outputPort, options) => onChangeStep(node.id, config, outputPort, options)}
        />
      )}

      <ValueCard
        node={node}
        running={busy}
        onRerunFromRoot={onRerunFromRoot}
        onEditInput={onEditInput}
        inputMissing={Boolean(journey.nodes[journey.rootId]?.valueMissing)}
        extraActions={!node.valueMissing ? <SendToMenu compact value={node.value} source={node.label} disabled={busy} /> : null}
      />

      {!node.valueMissing && (
        <SuggestionChips
          node={node}
          running={busy}
          onApply={onApplySuggestion}
          onMoreTools={onMoreTools}
          hint={atEnd ? undefined : t("continueForkHint")}
        />
      )}
    </section>
  )
}
