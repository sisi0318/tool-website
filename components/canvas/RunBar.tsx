"use client"

import { useState } from "react"
import {
  AlertCircle,
  Ellipsis,
  Footprints,
  LoaderCircle,
  Play,
  ScrollText,
  Square,
  Zap,
} from "lucide-react"
import { useTranslations } from "@/hooks/use-translations"
import { zhCanvas } from "@/lib/translations/zh-namespaces/canvas"
import { isBlockingNodeError, useCanvasStore } from "@/lib/canvas/store"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ChromeButton, ChromeDivider, FLOATING_SURFACE } from "./chrome"

interface RunBarProps {
  executionLogOpen: boolean
  onToggleExecutionLog: () => void
}

/** 画布右上角：运行、单步、自动运行，加上当前的运行状态和执行日志的开关 */
export function RunBar({ executionLogOpen, onToggleExecutionLog }: RunBarProps) {
  const t = useTranslations("canvas", zhCanvas)
  const hasNodes = useCanvasStore((state) => state.nodes.length > 0)
  const nodeRunning = useCanvasStore((state) => state.nodeRunning)
  const nodeErrors = useCanvasStore((state) => state.nodeErrors)
  const autoRun = useCanvasStore((state) => state.autoRun)
  const stepProgress = useCanvasStore((state) => state.stepProgress)
  const executeAll = useCanvasStore((state) => state.executeAll)
  const executeStep = useCanvasStore((state) => state.executeStep)
  const setAutoRun = useCanvasStore((state) => state.setAutoRun)
  const stopExecution = useCanvasStore((state) => state.stopExecution)
  const [requestedAction, setRequestedAction] = useState<"all" | "step" | null>(null)

  const runningCount = Object.values(nodeRunning).filter(Boolean).length
  const errorCount = Object.values(nodeErrors).filter(isBlockingNodeError).length
  const isRunning = requestedAction !== null || runningCount > 0

  const runAll = async () => {
    if (!hasNodes || isRunning) return
    setRequestedAction("all")
    try {
      await executeAll()
    } finally {
      setRequestedAction(null)
    }
  }

  const runNextStep = async () => {
    if (!hasNodes || isRunning) return
    setRequestedAction("step")
    try {
      await executeStep()
    } finally {
      setRequestedAction(null)
    }
  }

  const status =
    runningCount > 0 ? (
      <>
        <LoaderCircle aria-hidden="true" className="size-3.5 animate-spin text-md-primary" />
        <span className="sr-only sm:not-sr-only">{t("runningCount").replace("{count}", String(runningCount))}</span>
        <span aria-hidden="true" className="tabular-nums sm:hidden">{runningCount}</span>
      </>
    ) : errorCount > 0 ? (
      <>
        <AlertCircle aria-hidden="true" className="size-3.5 text-md-error" />
        <span className="sr-only sm:not-sr-only">{t("errorCount").replace("{count}", String(errorCount))}</span>
        <span aria-hidden="true" className="tabular-nums sm:hidden">{errorCount}</span>
      </>
    ) : stepProgress.total > 0 ? (
      <span className="sr-only sm:not-sr-only">
        {t("stepCount")
          .replace("{current}", String(stepProgress.current))
          .replace("{total}", String(stepProgress.total))}
      </span>
    ) : null

  return (
    <div
      role="toolbar"
      aria-label={t("canvasToolbar")}
      className={`${FLOATING_SURFACE} pointer-events-auto flex shrink-0 items-center gap-0.5 p-1`}
    >
      {isRunning ? (
        // 执行中把「运行」换成「停止」:节点的 execute 拿得到 AbortSignal,
        // 网络请求会真正中断,而不只是丢弃结果。
        <ChromeButton label={t("stopExecution")} onClick={stopExecution} tone="tonal" className="sm:px-3">
          <Square aria-hidden="true" className="size-4" />
          <span className="hidden sm:inline">{t("stop")}</span>
        </ChromeButton>
      ) : (
        <ChromeButton label={t("runAll")} onClick={runAll} disabled={!hasNodes} tone="primary" className="sm:px-3">
          <Play aria-hidden="true" className="size-4" />
          <span className="hidden sm:inline">{t("run")}</span>
        </ChromeButton>
      )}

      <ChromeButton label={t("runNextStep")} onClick={runNextStep} disabled={!hasNodes || isRunning} className="max-sm:hidden">
        {requestedAction === "step"
          ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
          : <Footprints aria-hidden="true" className="size-4" />}
        <span className="hidden md:inline">{t("step")}</span>
      </ChromeButton>

      <ChromeButton
        label={autoRun ? t("disableAutoRun") : t("enableAutoRun")}
        onClick={() => setAutoRun(!autoRun)}
        active={autoRun}
        className="max-sm:hidden"
      >
        <Zap aria-hidden="true" className="size-4" />
        <span className="hidden md:inline">{t("autoRun")}</span>
      </ChromeButton>

      <ChromeDivider className="max-sm:hidden" />

      <div
        aria-live="polite"
        className={`flex shrink-0 items-center gap-1.5 text-[11px] text-md-on-surface-variant ${status ? "px-1.5" : ""}`}
      >
        {status}
      </div>

      <ChromeButton
        label={t("executionLog")}
        onClick={onToggleExecutionLog}
        active={executionLogOpen}
        aria-expanded={executionLogOpen}
        aria-controls={executionLogOpen ? "canvas-execution-log" : undefined}
        data-execution-log-toggle
      >
        <ScrollText aria-hidden="true" className="size-4" />
      </ChromeButton>

      {/* 手机上一行放不下：单步和自动运行收进这个菜单，工作流名称才不至于只剩两三个字 */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <ChromeButton label={t("moreRunOptions")} className="sm:hidden">
            <Ellipsis aria-hidden="true" className="size-4" />
          </ChromeButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-52">
          <DropdownMenuItem disabled={!hasNodes || isRunning} onSelect={() => void runNextStep()}>
            <Footprints aria-hidden="true" className="text-md-on-surface-variant" />
            {t("runNextStep")}
          </DropdownMenuItem>
          <DropdownMenuCheckboxItem checked={autoRun} onCheckedChange={(checked) => setAutoRun(checked === true)}>
            {t("autoRun")}
          </DropdownMenuCheckboxItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
