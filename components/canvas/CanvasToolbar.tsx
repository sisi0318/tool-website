"use client"

import { useState } from "react"
import { Panel, useReactFlow } from "@xyflow/react"
import {
  AlertCircle,
  LoaderCircle,
  Maximize2,
  Network,
  Play,
  Redo2,
  ScrollText,
  Trash2,
  Undo2,
  Zap,
} from "lucide-react"
import { useTranslations } from "@/hooks/use-translations"
import { useCanvasStore } from "@/lib/canvas/store"
import { ConfirmDialog } from "./workflow/ConfirmDialog"

interface ToolbarButtonProps {
  label: string
  onClick: () => void
  disabled?: boolean
  active?: boolean
  expanded?: boolean
  controls?: string
  danger?: boolean
  children: React.ReactNode
}

interface CanvasToolbarProps {
  onAutoLayout?: () => void
  onToggleExecutionLog?: () => void
  executionLogOpen?: boolean
}

function ToolbarButton({
  label,
  onClick,
  disabled,
  active,
  expanded,
  controls,
  danger,
  children,
}: ToolbarButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={expanded === undefined ? active : undefined}
      aria-expanded={expanded}
      aria-controls={controls}
      title={label}
      className={`inline-flex h-11 min-w-11 items-center justify-center gap-1.5 rounded-[var(--md-sys-shape-corner-small)] px-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-md-primary disabled:cursor-not-allowed disabled:opacity-40 sm:h-9 sm:min-w-9 ${
        active
          ? "bg-md-primary text-md-on-primary hover:bg-md-primary/90"
          : danger
            ? "text-md-error hover:bg-md-error-container/60"
            : "text-md-on-surface-variant hover:bg-[var(--md-sys-color-on-surface)]/[0.08] hover:text-md-on-surface"
      }`}
    >
      {children}
    </button>
  )
}

export function CanvasToolbar({
  onAutoLayout,
  onToggleExecutionLog,
  executionLogOpen = false,
}: CanvasToolbarProps = {}) {
  const t = useTranslations("canvas")
  const { fitView } = useReactFlow()
  const nodes = useCanvasStore((state) => state.nodes)
  const nodeRunning = useCanvasStore((state) => state.nodeRunning)
  const nodeErrors = useCanvasStore((state) => state.nodeErrors)
  const autoRun = useCanvasStore((state) => state.autoRun)
  const canUndo = useCanvasStore((state) => state.canUndo)
  const canRedo = useCanvasStore((state) => state.canRedo)
  const executeAll = useCanvasStore((state) => state.executeAll)
  const setAutoRun = useCanvasStore((state) => state.setAutoRun)
  const undo = useCanvasStore((state) => state.undo)
  const redo = useCanvasStore((state) => state.redo)
  const clearCanvas = useCanvasStore((state) => state.clearCanvas)
  const [runRequested, setRunRequested] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)

  const runningCount = Object.values(nodeRunning).filter(Boolean).length
  const errorCount = Object.values(nodeErrors).filter(Boolean).length
  const isRunning = runRequested || runningCount > 0

  const runAll = async () => {
    if (nodes.length === 0 || isRunning) return
    setRunRequested(true)
    try {
      await executeAll()
    } finally {
      setRunRequested(false)
    }
  }

  return (
    <>
      <Panel position="top-center" className="!m-2 max-w-[calc(100%-1rem)]">
        <div
          className="scrollbar-hide flex max-w-full items-center gap-0.5 overflow-x-auto rounded-[var(--md-sys-shape-corner-medium)] border border-md-outline-variant bg-md-surface-container/95 p-1 shadow-lg backdrop-blur"
          role="toolbar"
          aria-label={t("canvasToolbar")}
        >
          <ToolbarButton
            label={t("runAll")}
            onClick={runAll}
            disabled={nodes.length === 0 || isRunning}
          >
            {isRunning ? <LoaderCircle className="size-4 animate-spin" /> : <Play className="size-4" />}
            <span className="hidden sm:inline">{t("run")}</span>
          </ToolbarButton>

          <ToolbarButton
            label={autoRun ? t("disableAutoRun") : t("enableAutoRun")}
            onClick={() => setAutoRun(!autoRun)}
            active={autoRun}
          >
            <Zap className="size-4" />
            <span className="hidden md:inline">{t("autoRun")}</span>
          </ToolbarButton>

          <span className="mx-1 h-5 w-px shrink-0 bg-md-outline-variant" aria-hidden="true" />

          <ToolbarButton label={t("undo")} onClick={undo} disabled={!canUndo}>
            <Undo2 className="size-4" />
          </ToolbarButton>
          <ToolbarButton label={t("redo")} onClick={redo} disabled={!canRedo}>
            <Redo2 className="size-4" />
          </ToolbarButton>
          <ToolbarButton
            label={t("fitView")}
            onClick={() => fitView({ padding: 0.2, duration: 250 })}
            disabled={nodes.length === 0}
          >
            <Maximize2 className="size-4" />
          </ToolbarButton>
          {onAutoLayout && (
            <ToolbarButton
              label={t("autoLayout")}
              onClick={onAutoLayout}
              disabled={nodes.length < 2}
            >
              <Network className="size-4" />
            </ToolbarButton>
          )}
          {onToggleExecutionLog && (
            <ToolbarButton
              label={t("executionLog")}
              onClick={onToggleExecutionLog}
              active={executionLogOpen}
              expanded={executionLogOpen}
              controls="canvas-execution-log"
            >
              <ScrollText className="size-4" />
            </ToolbarButton>
          )}
          <ToolbarButton
            label={t("clearCanvas")}
            onClick={() => setConfirmClear(true)}
            disabled={nodes.length === 0}
            danger
          >
            <Trash2 className="size-4" />
          </ToolbarButton>

          <span className="mx-1 h-5 w-px shrink-0 bg-md-outline-variant" aria-hidden="true" />

          <div
            className="flex shrink-0 items-center gap-1.5 px-2 text-[11px] text-md-on-surface-variant"
            aria-live="polite"
          >
            {runningCount > 0 ? (
              <>
                <LoaderCircle className="size-3.5 animate-spin text-md-primary" />
                <span>{t("runningCount").replace("{count}", String(runningCount))}</span>
              </>
            ) : errorCount > 0 ? (
              <>
                <AlertCircle className="size-3.5 text-md-error" />
                <span>{t("errorCount").replace("{count}", String(errorCount))}</span>
              </>
            ) : (
              <span>{t("nodeCount").replace("{count}", String(nodes.length))}</span>
            )}
          </div>
        </div>
      </Panel>

      {confirmClear && (
        <ConfirmDialog
          title={t("clearCanvasTitle")}
          message={t("clearCanvasMessage")}
          confirmLabel={t("clearCanvas")}
          onCancel={() => setConfirmClear(false)}
          onConfirm={() => {
            clearCanvas()
            setConfirmClear(false)
          }}
        />
      )}
    </>
  )
}
