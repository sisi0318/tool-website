"use client"

import { useMemo, useState } from "react"
import { ArrowRight, ScanSearch } from "lucide-react"
import Link from "next/link"

import { UtilityWorkbench } from "@/components/tools/utility-workbench"
import { useTranslations } from "@/hooks/use-translations"
import { detectData, type DetectionResult } from "@/lib/data-detector"

const SAMPLE = '{"name":"tool-website","features":["canvas","detector"]}'

export default function DataDetectorPage() {
  const t = useTranslations("dataDetector")
  const [input, setInput] = useState("")
  const [result, setResult] = useState<DetectionResult | null>(null)

  const output = useMemo(
    () => result ? JSON.stringify(result, null, 2) : "",
    [result]
  )

  const run = () => setResult(detectData(input))

  return (
    <UtilityWorkbench
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
      footer={result && (
        <div className="space-y-2">
          {result.matches.slice(0, 5).map((match) => (
            <div key={match.type} className="flex items-center gap-3 rounded-2xl bg-[var(--md-sys-color-surface-container-low)] px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-[var(--md-sys-color-on-surface)]">{match.label}</p>
                <p className="truncate text-xs text-[var(--md-sys-color-on-surface-variant)]">{match.detail}</p>
              </div>
              <span className="rounded-full bg-[var(--md-sys-color-secondary-container)] px-2.5 py-1 text-xs font-bold text-[var(--md-sys-color-on-secondary-container)]">
                {Math.round(match.confidence * 100)}%
              </span>
              {match.suggestedTool && (
                <Link
                  href={`/tools/${match.suggestedTool}`}
                  className="inline-flex min-h-10 shrink-0 items-center gap-1 rounded-full px-3 text-xs font-semibold text-[var(--md-sys-color-primary)] hover:bg-[var(--md-sys-color-primary-container)]"
                >
                  {t("openTool")}<ArrowRight className="h-4 w-4" />
                </Link>
              )}
            </div>
          ))}
        </div>
      )}
    />
  )
}
