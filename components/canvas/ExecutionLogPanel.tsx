"use client"

import { useEffect, useRef } from "react"
import {
  Ban,
  CheckCircle2,
  CircleAlert,
  LoaderCircle,
  Trash2,
  X,
} from "lucide-react"
import { useTranslations } from "@/hooks/use-translations"
import { getNodeDefinition } from "@/lib/canvas/registry"
import { useCanvasStore } from "@/lib/canvas/store"
import type { ExecutionLogEntry } from "@/lib/canvas/types"

interface ExecutionLogPanelProps {
  open: boolean
  onClose: () => void
  onSelectNode?: (nodeId: string) => void
}

function StatusIcon({ entry }: { entry: ExecutionLogEntry }) {
  switch (entry.status) {
    case "running":
      return <LoaderCircle className="size-4 animate-spin text-blue-500" />
    case "success":
      return <CheckCircle2 className="size-4 text-emerald-500" />
    case "error":
      return <CircleAlert className="size-4 text-red-500" />
    case "cancelled":
      return <Ban className="size-4 text-gray-400" />
  }
}

function formatDuration(durationMs: number): string {
  if (durationMs < 1) return "<1 ms"
  if (durationMs < 1000) return `${Math.round(durationMs)} ms`
  return `${(durationMs / 1000).toFixed(2)} s`
}

export function ExecutionLogPanel({
  open,
  onClose,
  onSelectNode,
}: ExecutionLogPanelProps) {
  const t = useTranslations("canvas")
  const executionLog = useCanvasStore((state) => state.executionLog)
  const nodes = useCanvasStore((state) => state.nodes)
  const clearExecutionLog = useCanvasStore((state) => state.clearExecutionLog)
  const panelRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (open) panelRef.current?.focus()
  }, [open])

  if (!open) return null

  const existingNodeIds = new Set(nodes.map((node) => node.id))
  const entries = [...executionLog].reverse()

  return (
    <section
      id="canvas-execution-log"
      ref={panelRef}
      tabIndex={-1}
      data-canvas-shortcuts="off"
      aria-label={t("executionLog")}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation()
          onClose()
        }
      }}
      className="absolute bottom-[max(.75rem,env(safe-area-inset-bottom))] right-3 z-30 flex max-h-[min(28rem,55%)] w-[min(28rem,calc(100%-1.5rem))] flex-col overflow-hidden rounded-xl border border-gray-200 bg-white/95 shadow-2xl outline-none backdrop-blur focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-gray-700 dark:bg-gray-900/95"
    >
      <div className="flex min-h-12 items-center gap-2 border-b border-gray-200 px-3 dark:border-gray-700">
        <h3 className="min-w-0 flex-1 truncate text-sm font-semibold text-gray-800 dark:text-gray-100">
          {t("executionLog")}
        </h3>
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {entries.length}
        </span>
        <button
          type="button"
          onClick={clearExecutionLog}
          disabled={entries.length === 0}
          aria-label={t("clearExecutionLog")}
          title={t("clearExecutionLog")}
          className="flex h-11 w-11 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-40 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-red-400 sm:h-9 sm:w-9"
        >
          <Trash2 className="size-4" />
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("close")}
          title={t("close")}
          className="flex h-11 w-11 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100 sm:h-9 sm:w-9"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2" aria-live="polite">
        {entries.length === 0 ? (
          <p className="px-3 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
            {t("executionLogEmpty")}
          </p>
        ) : (
          <ol className="space-y-1.5">
            {entries.map((entry) => {
              const definition = getNodeDefinition(entry.nodeType)
              const canSelect = existingNodeIds.has(entry.nodeId) && Boolean(onSelectNode)
              const statusLabel = t(`executionStatus${entry.status[0].toUpperCase()}${entry.status.slice(1)}`)

              return (
                <li key={entry.id}>
                  <button
                    type="button"
                    disabled={!canSelect}
                    onClick={() => onSelectNode?.(entry.nodeId)}
                    className="w-full rounded-lg border border-gray-100 p-2.5 text-left transition-colors enabled:hover:border-blue-200 enabled:hover:bg-blue-50/50 disabled:cursor-default dark:border-gray-800 dark:enabled:hover:border-blue-900 dark:enabled:hover:bg-blue-950/20"
                  >
                    <span className="flex items-start gap-2">
                      <span className="mt-0.5 shrink-0" aria-hidden="true">
                        <StatusIcon entry={entry} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="min-w-0 flex-1 truncate text-xs font-medium text-gray-800 dark:text-gray-100">
                            {definition?.label ?? entry.nodeType}
                          </span>
                          <time className="shrink-0 text-[10px] text-gray-400">
                            {new Date(entry.startedAt).toLocaleTimeString()}
                          </time>
                        </span>
                        <span className="mt-0.5 flex items-center gap-2 text-[10px] text-gray-500 dark:text-gray-400">
                          <span>{statusLabel}</span>
                          {entry.status !== "running" && <span>{formatDuration(entry.durationMs)}</span>}
                        </span>
                        {entry.error && (
                          <span className="mt-1 block max-h-16 overflow-auto whitespace-pre-wrap break-words text-[11px] text-red-600 dark:text-red-400">
                            {entry.error}
                          </span>
                        )}
                      </span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ol>
        )}
      </div>
    </section>
  )
}
