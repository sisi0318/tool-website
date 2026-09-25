"use client"

import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react"
import { usePathname } from "next/navigation"
import { Check, Copy, Loader2, Play, RotateCcw, Sparkles } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useTranslations } from "@/hooks/use-translations"
import { copyTextToClipboard } from "@/lib/clipboard"
import { SendToMenu } from "@/components/tools/send-to-menu"
import { useUndoToast } from "@/hooks/use-undo-toast"

/**
 * 独立工具页(/tools/<id>)把操作类型写回 URL,链接可以直接指向某个模式(如 ?op=decode);
 * 输入只读不写 —— 用户数据不该进浏览器历史,?input= 是主动构造链接时才带的。
 * 工作台(/tools)里同一页面挂着多个工具、共用一个 URL,不做同步。
 */
const OPERATION_PARAM = "op"
const INPUT_PARAM = "input"
const MAX_URL_INPUT_CHARS = 4096
/** 自动运行的防抖与输入上限：更长的输入改为提示用 Ctrl/⌘+Enter 手动运行 */
const AUTO_RUN_DELAY_MS = 300
const DEFAULT_AUTO_RUN_MAX_CHARS = 200_000

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
  allowWhitespaceInput?: boolean
  canRun?: boolean
  error?: string
  inputLabel?: string
  outputLabel?: string
  inputPlaceholder?: string
  inputDisabled?: boolean
  outputPlaceholder?: string
  runLabel?: string
  controls?: ReactNode
  additionalInput?: ReactNode
  result?: ReactNode
  footer?: ReactNode
  /** 输入或操作变化后自动运行（防抖）；只给同步、开销小的工具开 */
  autoRun?: boolean
  /** 超过这个长度不再自动运行 */
  autoRunMaxChars?: number
  /** 页面自己的选项（如 SQL 方言）变化时也要自动重跑，把它们拼成一个字符串传进来 */
  autoRunKey?: string
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
  allowWhitespaceInput = false,
  canRun,
  error,
  inputLabel,
  outputLabel,
  inputPlaceholder,
  inputDisabled = false,
  outputPlaceholder,
  runLabel,
  controls,
  additionalInput,
  result,
  footer,
  autoRun = false,
  autoRunMaxChars = DEFAULT_AUTO_RUN_MAX_CHARS,
  autoRunKey = "",
}: UtilityWorkbenchProps) {
  const t = useTranslations("utilityWorkbench")
  // 工作台里可能同时挂着好几个工具，id 不能写死
  const fieldId = useId()
  const [copied, setCopied] = useState(false)
  const [copyError, setCopyError] = useState("")
  const copyFeedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const copyOutput = async () => {
    if (!output) return

    if (copyFeedbackTimeoutRef.current) clearTimeout(copyFeedbackTimeoutRef.current)

    try {
      if (!await copyTextToClipboard(output, { reportFailure: false })) throw new Error("Clipboard unavailable")
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

  const hasRunnableInput = canRun ?? (allowWhitespaceInput ? input.length > 0 : input.trim().length > 0)
  const [pending, setPending] = useState(false)
  const busy = running || pending
  // 输出对应的是哪一次输入与操作；两者之一变了，结果就过期了
  const [resultSource, setResultSource] = useState<{ input: string; operation: string } | null>(null)
  const stale = Boolean(output) && resultSource !== null && (resultSource.input !== input || resultSource.operation !== operation)

  useEffect(() => {
    // 页面在别处更新了输出（比如自动识别、反向处理），也视为对应当前的输入
    if (output) setResultSource({ input, operation })
    // 只在输出变化时记录
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [output])

  const run = useCallback(async () => {
    if (busy || !hasRunnableInput) return
    const source = { input, operation }
    setPending(true)
    // 让出一帧：同步的重计算开始前先把"处理中"画出来
    await new Promise((resolve) => setTimeout(resolve, 0))
    try {
      await onRun()
      setResultSource(source)
    } finally {
      setPending(false)
    }
  }, [busy, hasRunnableInput, input, onRun, operation])

  const runRef = useRef(run)
  runRef.current = run
  const tooLargeForAutoRun = autoRun && input.length > autoRunMaxChars

  useEffect(() => {
    if (!autoRun || tooLargeForAutoRun || !hasRunnableInput) return
    const timer = setTimeout(() => void runRef.current(), AUTO_RUN_DELAY_MS)
    return () => clearTimeout(timer)
  }, [autoRun, autoRunKey, hasRunnableInput, input, operation, tooLargeForAutoRun])

  // 点"示例"后等输入更新完再运行一次
  const runAfterSampleRef = useRef(false)
  useEffect(() => {
    if (!runAfterSampleRef.current) return
    runAfterSampleRef.current = false
    void runRef.current()
  }, [input])

  // 清空和载入示例会整段覆盖输入，覆盖前留一份，提示里可以撤销
  const tc = useTranslations("common")
  const showUndo = useUndoToast()
  const replaceInput = (replace: () => void, messageKey: "inputCleared" | "inputReplacedBySample") => {
    const previous = input
    replace()
    if (previous.trim()) showUndo(tc(messageKey), () => onInputChange(previous))
  }

  const handleShortcut = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== "Enter" || !(event.ctrlKey || event.metaKey)) return
    event.preventDefault()
    void run()
  }

  const pathname = usePathname()
  const syncUrl = pathname !== "/tools"
  const urlBootedRef = useRef(false)

  useEffect(() => {
    if (!syncUrl || urlBootedRef.current) return
    urlBootedRef.current = true
    const params = new URLSearchParams(window.location.search)
    const requestedOperation = params.get(OPERATION_PARAM)
    if (
      requestedOperation &&
      requestedOperation !== operation &&
      operations.some((item) => item.value === requestedOperation)
    ) {
      onOperationChange(requestedOperation)
    }
    const requestedInput = params.get(INPUT_PARAM)
    if (requestedInput && requestedInput.length <= MAX_URL_INPUT_CHARS) onInputChange(requestedInput)
    // 只在挂载时读一次 URL
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncUrl])

  const urlWriteArmedRef = useRef(false)
  useEffect(() => {
    if (!syncUrl) return
    // 首次提交时 URL 里的 op 还没来得及应用到 state,跳过,避免先删再写
    if (!urlWriteArmedRef.current) {
      urlWriteArmedRef.current = true
      return
    }
    const url = new URL(window.location.href)
    if (operation === operations[0]?.value) url.searchParams.delete(OPERATION_PARAM)
    else url.searchParams.set(OPERATION_PARAM, operation)
    if (url.href !== window.location.href) window.history.replaceState(window.history.state, "", url)
  }, [operation, operations, syncUrl])

  return (
    <div className="mx-auto max-w-7xl px-1 py-2 sm:px-3">
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
        <Card onKeyDown={handleShortcut} className="rounded-[var(--md-sys-shape-corner-extra-large)] border-[var(--md-sys-color-outline-variant)]/70">
          <CardHeader className="p-4 sm:p-6">
            <CardTitle>{t("inputSettings")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 p-4 pt-0 sm:p-6 sm:pt-0">
            {operations.length > 1 && (
              <div>
                <Label htmlFor={`${fieldId}-operation`}>{t("operation")}</Label>
                <Select value={operation} onValueChange={onOperationChange}>
                  <SelectTrigger id={`${fieldId}-operation`} data-workbench-operation className="mt-2 min-h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {operations.map((item) => (
                      <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {controls}

            <div>
              <div className="mb-2 flex items-center justify-between gap-3">
                <Label htmlFor={`${fieldId}-input`}>{inputLabel ?? t("input")}</Label>
                <span className="text-xs text-[var(--md-sys-color-on-surface-variant)]">
                  {t("characters").replace("{count}", String(input.length))}
                </span>
              </div>
              <Textarea
                id={`${fieldId}-input`}
                data-workbench-input
                data-primary-input
                value={input}
                disabled={inputDisabled}
                onChange={(event) => onInputChange(event.target.value)}
                placeholder={inputPlaceholder ?? t("inputPlaceholder")}
                spellCheck={false}
                className="min-h-40 resize-y rounded-2xl font-mono text-sm leading-6 sm:min-h-64"
              />
            </div>

            {additionalInput}

            {tooLargeForAutoRun && (
              <p className="text-xs text-[var(--md-sys-color-on-surface-variant)]">{t("autoRunPaused")}</p>
            )}

            {error && (
              <p
                role="alert"
                className="rounded-2xl bg-[var(--md-sys-color-error-container)] px-4 py-3 text-sm text-[var(--md-sys-color-on-error-container)]"
              >
                {error}
              </p>
            )}

            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
              <Button onClick={() => void run()} disabled={busy || !hasRunnableInput} className="col-span-2 min-h-11 w-full gap-2 sm:w-auto">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                {busy ? t("processing") : (runLabel ?? t("run"))}
                <kbd aria-hidden="true" className="ml-1 hidden rounded border border-current/30 px-1 text-[10px] font-medium opacity-70 sm:inline">Ctrl ↵</kbd>
              </Button>
              {onSample && (
                <Button type="button" variant="outline" onClick={() => replaceInput(() => { runAfterSampleRef.current = true; onSample() }, "inputReplacedBySample")} className="min-h-11 w-full gap-2 sm:w-auto">
                  <Sparkles className="h-4 w-4" />{t("sample")}
                </Button>
              )}
              <Button type="button" variant="ghost" onClick={() => replaceInput(onClear, "inputCleared")} className={`min-h-11 w-full gap-2 sm:w-auto ${onSample ? "" : "col-span-2"}`}>
                <RotateCcw className="h-4 w-4" />{t("clear")}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="min-w-0 rounded-[var(--md-sys-shape-corner-extra-large)] border-[var(--md-sys-color-outline-variant)]/70">
          <CardHeader className="flex-row flex-wrap items-center justify-between gap-2 space-y-0 p-4 sm:p-6">
            <CardTitle>{outputLabel ?? t("output")}</CardTitle>
            <div className="ml-auto flex flex-wrap gap-2">
            <SendToMenu value={output} source={title} disabled={!output || busy || stale} />
            <Button type="button" variant="outline" size="sm" onClick={copyOutput} disabled={!output || stale} className="min-h-10 gap-2">
              {copied ? <Check className="h-4 w-4 text-[var(--md-sys-color-primary)]" /> : <Copy className="h-4 w-4" />}
              {copied ? t("copied") : t("copy")}
            </Button>
            </div>
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
            {stale && (
              <p role="status" className="rounded-2xl bg-[var(--md-sys-color-surface-container)] px-4 py-3 text-sm text-[var(--md-sys-color-on-surface-variant)]">
                {t("staleOutput")}
              </p>
            )}
            <div className={stale ? "opacity-60" : undefined}>
            {result ?? (
              <Textarea
                value={output}
                readOnly
                placeholder={outputPlaceholder ?? t("outputPlaceholder")}
                spellCheck={false}
                className="min-h-48 resize-y rounded-2xl bg-[var(--md-sys-color-surface-container-low)] font-mono text-sm leading-6 sm:min-h-[26rem]"
              />
            )}
            </div>
            {footer}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
