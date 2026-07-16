"use client"

import { LoaderCircle, Play, RotateCcw } from "lucide-react"
import { useTranslations } from "@/hooks/use-translations"
import { useCanvasStore } from "@/lib/canvas/store"

interface NodeRunButtonProps {
  nodeId: string
  running: boolean
  hasError: boolean
}

export function NodeRunButton({ nodeId, running, hasError }: NodeRunButtonProps) {
  const t = useTranslations("canvas")
  const executeNode = useCanvasStore((state) => state.executeNode)
  const label = hasError ? t("retryNode") : t("runNode")

  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation()
        executeNode(nodeId, undefined, false, true)
      }}
      disabled={running}
      aria-label={label}
      title={label}
      className="nodrag nopan ml-auto flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-md-on-surface-variant transition-colors hover:bg-md-primary/10 hover:text-md-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-md-primary disabled:opacity-50"
    >
      {running ? (
        <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
      ) : hasError ? (
        <RotateCcw className="h-3.5 w-3.5" />
      ) : (
        <Play className="h-3.5 w-3.5" />
      )}
    </button>
  )
}
