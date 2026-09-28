"use client"

import { useMemo, useState } from "react"
import { ArrowRight, ScanSearch } from "lucide-react"
import Link from "next/link"

import { UtilityWorkbench } from "@/components/tools/utility-workbench"
import { useTranslations } from "@/hooks/use-translations"
import { zhDataDetector } from "@/lib/translations/zh-namespaces/dataDetector"
import { detectData, type DetectionResult } from "@/lib/data-detector"
import { useToolDraft } from "@/hooks/use-tool-draft"
import { useOpenInTool } from "@/hooks/use-open-in-tool"
import { getToolEntry, toolAccepts } from "@/lib/tools/catalog"

const SAMPLE = '{"name":"tool-website","features":["canvas","detector"]}'

export default function DataDetectorPage() {
  const t = useTranslations("dataDetector", zhDataDetector)
  const [input, setInput] = useToolDraft("data-detector")
  const openInTool = useOpenInTool()
  const [result, setResult] = useState<DetectionResult | null>(null)

  const localizedResult = useMemo(() => {
    if (!result) return null
    const localizeMatch = (match: DetectionResult["best"]) => ({
      ...match,
      label: t(`types.${match.type}`),
    })
    return {
      best: localizeMatch(result.best),
      matches: result.matches.map(localizeMatch),
    }
  }, [result, t])
  const output = useMemo(
    () => localizedResult ? JSON.stringify(localizedResult, null, 2) : "",
    [localizedResult],
  )

  const run = () => setResult(detectData(input))

  return (
    <UtilityWorkbench textFile autoRun
      title={t("title")}
      description={t("description")}
      icon={<ScanSearch className="h-6 w-6" />}
      input={input}
      output={output}
      operation="detect"
      operations={[{ value: "detect", label: t("detect") }]}
      onInputChange={setInput}
      onOperationChange={() => {}}
      onRun={run}
      onClear={() => { setInput(""); setResult(null) }}
      onSample={() => { setInput(SAMPLE); setResult(detectData(SAMPLE)) }}
      inputPlaceholder={t("placeholder")}
      outputLabel={t("result")}
      footer={localizedResult && (
        <div className="space-y-2">
          {localizedResult.matches.slice(0, 5).map((match) => (
            <div key={match.type} className="flex items-center gap-3 rounded-2xl bg-[var(--md-sys-color-surface-container-low)] px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-[var(--md-sys-color-on-surface)]">{match.label}</p>
                <p className="truncate text-xs text-[var(--md-sys-color-on-surface-variant)]">{match.detail}</p>
              </div>
              <span className="rounded-full bg-[var(--md-sys-color-secondary-container)] px-2.5 py-1 text-xs font-bold text-[var(--md-sys-color-on-secondary-container)]">
                {Math.round(match.confidence * 100)}%
              </span>
              {match.suggestedTool && (() => {
                const className = "inline-flex min-h-10 shrink-0 items-center gap-1 rounded-full px-3 text-xs font-semibold text-[var(--md-sys-color-primary)] hover:bg-[var(--md-sys-color-primary-container)]"
                const entry = getToolEntry(match.suggestedTool)
                // 能接收文本的工具直接带上当前输入；工作台里就地开标签，不再离开工作台
                return entry && toolAccepts(entry, "text")
                  ? <button type="button" className={className} onClick={() => openInTool(entry.id, input, t("title"))}>{t("openTool")}<ArrowRight className="h-4 w-4" /></button>
                  : <Link href={`/tools/${match.suggestedTool}`} className={className}>{t("openTool")}<ArrowRight className="h-4 w-4" /></Link>
              })()}
            </div>
          ))}
        </div>
      )}
    />
  )
}
