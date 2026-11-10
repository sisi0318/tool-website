"use client"

import { useEffect, useMemo, useRef, type ReactNode } from "react"
import { GitBranch } from "lucide-react"
import { detectData } from "@/lib/data-detector"
import { summarizeValue } from "@/lib/journey/describe"
import { getBranchPoints, getChildren, getTrail } from "@/lib/journey/tree"
import type { Journey, JourneyNode } from "@/lib/journey/types"
import { useTranslations } from "@/hooks/use-translations"
import { zhJourney } from "@/lib/translations/zh-namespaces/journey"
import { useStepTitle } from "./use-step-title"

/** 超过这个长度的文本不再跑识别：摘要里那个“JSON”“JWT”不值得为它扫一遍大文本 */
const DETECT_SUMMARY_CHARS = 64 * 1024

function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / 1024 / 1024).toFixed(1)} MB`
}

/** 一步结果的一行摘要：“12 行 · 340 个字符 · JSON” */
function StepSummary({ node }: { node: JourneyNode }) {
  const t = useTranslations("journey", zhJourney)
  const text = useMemo(() => {
    const summary = summarizeValue(node)
    const count = (key: string, value: number) => t(key).replace("{count}", value.toLocaleString())
    switch (summary.kind) {
      case "missing":
        return t("summaryMissing")
      case "empty":
        return t("emptyValue")
      case "file":
        return summary.name ? `${summary.name} · ${formatBytes(summary.bytes)}` : t("bytesValue").replace("{size}", formatBytes(summary.bytes))
      case "list":
        return count("summaryItems", summary.items)
      case "object":
        return count("summaryFields", summary.fields)
      case "scalar":
        return summary.text.length > 40 ? `${summary.text.slice(0, 40)}…` : summary.text
      case "text": {
        const parts = summary.lines > 1 ? [count("summaryLines", summary.lines), count("summaryChars", summary.chars)] : [count("summaryChars", summary.chars)]
        const value = node.value as string
        if (value.length <= DETECT_SUMMARY_CHARS) {
          const { best } = detectData(value)
          if (best.type !== "plain-text" && best.confidence >= 0.6) parts.push(best.label)
        }
        return parts.join(" · ")
      }
    }
  }, [node, t])

  return (
    <span className={`block truncate text-xs ${node.valueMissing ? "text-[var(--md-sys-color-error)]" : "text-[var(--md-sys-color-on-surface-variant)]"}`}>
      {text}
    </span>
  )
}

interface StepListProps {
  journey: Journey
  onSelect: (nodeId: string) => void
  onOpenBranches: () => void
  /** 窄屏上，选中那一步的详情就地展开在它下面；宽屏时详情在右栏，这里不传 */
  inlineDetail?: ReactNode
}

/**
 * 这条路上的每一步，从输入到末端竖着排开。
 *
 * 以前是一排小标签，写着工具名，而且只排到选中的那一步为止：回头看第 2 步，第 3、4 步就从
 * 屏幕上消失了。现在整条路一直都在，每步写着做了什么、得到了什么；选中哪一步只决定右边
 * （窄屏是它下面）展开的是谁。
 */
export function StepList({ journey, onSelect, onOpenBranches, inlineDetail }: StepListProps) {
  const t = useTranslations("journey", zhJourney)
  const stepTitle = useStepTitle()
  const trail = getTrail(journey)
  const branchPoints = getBranchPoints(journey)
  const selectedRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    selectedRef.current?.scrollIntoView?.({ block: "nearest", inline: "nearest" })
  }, [journey.activeId])

  return (
    // 窄屏上选中那一步的详情就展开在列表里面，所以这里是一个普通的分区而不是导航地标：
    // 地标里不该装着参数表单和结果
    <section aria-label={t("stepsTitle")} className="min-w-0">
      <div className="mb-2 flex items-center justify-between gap-2 px-1">
        <h2 className="text-xs font-medium uppercase tracking-wide text-[var(--md-sys-color-on-surface-variant)]">{t("stepsTitle")}</h2>
        {branchPoints.size > 0 && (
          <button
            type="button"
            onClick={onOpenBranches}
            className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs text-[var(--md-sys-color-on-surface-variant)] transition-colors hover:bg-md-hover hover:text-[var(--md-sys-color-on-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--md-sys-color-primary)]"
          >
            <GitBranch className="h-3.5 w-3.5" aria-hidden />
            {t("allBranches")}
          </button>
        )}
      </div>

      <ol className="space-y-1">
        {trail.map((node, index) => {
          const selected = node.id === journey.activeId
          const otherPaths = branchPoints.has(node.id) ? getChildren(journey, node.id).length - 1 : 0
          return (
            <li key={node.id} className="min-w-0">
              <button
                ref={selected ? selectedRef : undefined}
                type="button"
                data-journey-step={index + 1}
                onClick={() => onSelect(node.id)}
                aria-current={selected ? "step" : undefined}
                className={`flex w-full min-w-0 items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--md-sys-color-primary)] ${
                  selected
                    ? "bg-[var(--md-sys-color-primary-container)] text-[var(--md-sys-color-on-primary-container)]"
                    : "text-[var(--md-sys-color-on-surface)] hover:bg-[var(--md-sys-color-surface-container-high)]"
                }`}
              >
                <span
                  aria-hidden
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                    selected ? "bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)]" : "bg-[var(--md-sys-color-surface-container-highest)] text-[var(--md-sys-color-on-surface-variant)]"
                  }`}
                >
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{stepTitle(node)}</span>
                  <StepSummary node={node} />
                </span>
              </button>

              {otherPaths > 0 && (
                <button
                  type="button"
                  onClick={onOpenBranches}
                  className="ml-12 mt-0.5 inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium text-[var(--md-sys-color-tertiary)] transition-colors hover:bg-md-tertiary-container/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--md-sys-color-primary)]"
                >
                  <GitBranch className="h-3.5 w-3.5" aria-hidden />
                  {t("forkHere").replace("{count}", String(otherPaths))}
                </button>
              )}

              {selected && inlineDetail ? <div className="mt-2 space-y-3 pb-2">{inlineDetail}</div> : null}
            </li>
          )
        })}
      </ol>
    </section>
  )
}
