"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import { Check, Copy, Play, RotateCcw, Sparkles } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useTranslations } from "@/hooks/use-translations"
import { copyTextToClipboard } from "@/lib/clipboard"

export interface WorkbenchOperation {
  value: string
  label: string
}

interface UtilityWorkbenchProps {
  title: string
  description: string
  icon: ReactNode
  input: string
  output: string
  operation: string
  operations: WorkbenchOperation[]
  onInputChange: (value: string) => void
  onOperationChange: (value: string) => void
  onRun: () => void | Promise<void>
  onClear: () => void
  onSample?: () => void
  running?: boolean
  error?: string
  inputLabel?: string
  outputLabel?: string
  inputPlaceholder?: string
  outputPlaceholder?: string
  runLabel?: string
  controls?: ReactNode
  result?: ReactNode
  footer?: ReactNode
}

export function UtilityWorkbench({
  title,
  description,
  icon,
  input,
  output,
  operation,
  operations,
  onInputChange,
  onOperationChange,
  onRun,
  onClear,
  onSample,
  running = false,
  error,
  inputLabel,
  outputLabel,
  inputPlaceholder,
  outputPlaceholder,
  runLabel,
  controls,
  result,
  footer,
}: UtilityWorkbenchProps) {
  const t = useTranslations("utilityWorkbench")
  const [copied, setCopied] = useState(false)
  const [copyError, setCopyError] = useState("")
  const copyFeedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const copyOutput = async () => {
    if (!output) return

    if (copyFeedbackTimeoutRef.current) clearTimeout(copyFeedbackTimeoutRef.current)

    try {
      if (!await copyTextToClipboard(output)) throw new Error("Clipboard unavailable")
      setCopyError("")
      setCopied(true)
      copyFeedbackTimeoutRef.current = setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopied(false)
      setCopyError(t("copyFailed"))
      copyFeedbackTimeoutRef.current = setTimeout(() => setCopyError(""), 3000)
    }
  }

  useEffect(() => {
    return () => {
      if (copyFeedbackTimeoutRef.current) clearTimeout(copyFeedbackTimeoutRef.current)
    }
  }, [])

  return (
    <main className="mx-auto max-w-7xl px-1 py-2 sm:px-3">
      <section className="mb-4 flex items-start gap-3 sm:mb-6">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--md-sys-color-primary-container)] text-[var(--md-sys-color-on-primary-container)] sm:h-12 sm:w-12">
          {icon}
        </span>
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight text-[var(--md-sys-color-on-surface)] sm:text-3xl">
            {title}
          </h1>
          <p className="mt-1 text-sm leading-6 text-[var(--md-sys-color-on-surface-variant)] sm:text-base">
            {description}
          </p>
        </div>
      </section>

      <div className="grid gap-4 sm:gap-5 xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
        <Card className="rounded-[var(--md-sys-shape-corner-extra-large)] border-[var(--md-sys-color-outline-variant)]/70">
          <CardHeader className="p-4 sm:p-6">
            <CardTitle>{t("inputSettings")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 p-4 pt-0 sm:p-6 sm:pt-0">
            <div>
              <Label htmlFor="utility-workbench-operation">{t("operation")}</Label>
              <Select value={operation} onValueChange={onOperationChange}>
                <SelectTrigger id="utility-workbench-operation" className="mt-2 min-h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {operations.map((item) => (
                    <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {controls}

            <div>
              <div className="mb-2 flex items-center justify-between gap-3">
                <Label htmlFor="utility-workbench-input">{inputLabel ?? t("input")}</Label>
                <span className="text-xs text-[var(--md-sys-color-on-surface-variant)]">
                  {t("characters").replace("{count}", String(input.length))}
                </span>
              </div>
              <Textarea
                id="utility-workbench-input"
                value={input}
                onChange={(event) => onInputChange(event.target.value)}
                placeholder={inputPlaceholder ?? t("inputPlaceholder")}
                spellCheck={false}
                className="min-h-40 resize-y rounded-2xl font-mono text-sm leading-6 sm:min-h-64"
              />
            </div>

            {error && (
              <p
                role="alert"
                className="rounded-2xl bg-[var(--md-sys-color-error-container)] px-4 py-3 text-sm text-[var(--md-sys-color-on-error-container)]"
              >
                {error}
              </p>
            )}

            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
              <Button onClick={() => void onRun()} disabled={running || !input.trim()} className="col-span-2 min-h-11 w-full gap-2 sm:w-auto">
                <Play className="h-4 w-4" />
                {running ? t("processing") : (runLabel ?? t("run"))}
              </Button>
              {onSample && (
                <Button type="button" variant="outline" onClick={onSample} className="min-h-11 w-full gap-2 sm:w-auto">
                  <Sparkles className="h-4 w-4" />{t("sample")}
                </Button>
              )}
              <Button type="button" variant="ghost" onClick={onClear} className={`min-h-11 w-full gap-2 sm:w-auto ${onSample ? "" : "col-span-2"}`}>
                <RotateCcw className="h-4 w-4" />{t("clear")}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="min-w-0 rounded-[var(--md-sys-shape-corner-extra-large)] border-[var(--md-sys-color-outline-variant)]/70">
          <CardHeader className="flex-row items-center justify-between space-y-0 p-4 sm:p-6">
            <CardTitle>{outputLabel ?? t("output")}</CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={copyOutput} disabled={!output} className="min-h-10 gap-2">
              {copied ? <Check className="h-4 w-4 text-[var(--md-sys-color-primary)]" /> : <Copy className="h-4 w-4" />}
              {copied ? t("copied") : t("copy")}
            </Button>
          </CardHeader>
          <CardContent className="space-y-4 p-4 pt-0 sm:p-6 sm:pt-0">
            {copyError && (
              <p
                role="alert"
                className="rounded-2xl bg-[var(--md-sys-color-error-container)] px-4 py-3 text-sm text-[var(--md-sys-color-on-error-container)]"
              >
                {copyError}
              </p>
            )}
            {result ?? (
              <Textarea
                value={output}
                readOnly
                placeholder={outputPlaceholder ?? t("outputPlaceholder")}
                spellCheck={false}
                className="min-h-48 resize-y rounded-2xl bg-[var(--md-sys-color-surface-container-low)] font-mono text-sm leading-6 sm:min-h-[26rem]"
              />
            )}
            {footer}
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
