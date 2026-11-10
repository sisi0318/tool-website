"use client"

import { NodeToolbar, Position } from "@xyflow/react"
import {
  CircleSlash2,
  CopyPlus,
  LoaderCircle,
  Play,
  Power,
  RotateCcw,
  SlidersHorizontal,
  Trash2,
} from "lucide-react"
import { useTranslations } from "@/hooks/use-translations"
import { zhCanvas } from "@/lib/translations/zh-namespaces/canvas"
import { isBlockingNodeError, useCanvasStore } from "@/lib/canvas/store"
import { FLOATING_SURFACE, formatShortcut } from "./chrome"

interface NodeActionsToolbarProps {
  nodeId: string
  inspectorOpen: boolean
  onToggleInspector: () => void
  onDuplicate: () => void
  onDelete: () => void
}

const BUTTON_CLASS =
  "nodrag nopan flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--md-sys-shape-corner-medium)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-md-primary disabled:opacity-50 sm:h-9 sm:w-9"
const NEUTRAL_CLASS =
  "text-md-on-surface-variant hover:bg-md-hover hover:text-md-on-surface"

/**
 * 选中一个节点时浮在它上方的工具条。位置跟着节点走，大小不随画布缩放。
 * 右侧接着往下加节点的“+”在节点卡片里：nodes/NodeAppendZone.tsx。
 */
export function NodeActionsToolbar({
  nodeId,
  inspectorOpen,
  onToggleInspector,
  onDuplicate,
  onDelete,
}: NodeActionsToolbarProps) {
  const t = useTranslations("canvas", zhCanvas)
  const disabled = useCanvasStore((state) => Boolean(state.nodes.find((node) => node.id === nodeId)?.disabled))
  const running = useCanvasStore((state) => Boolean(state.nodeRunning[nodeId]))
  const hasError = useCanvasStore((state) => isBlockingNodeError(state.nodeErrors[nodeId]))
  const executeToNode = useCanvasStore((state) => state.executeToNode)
  const setNodeDisabled = useCanvasStore((state) => state.setNodeDisabled)

  const runLabel = hasError ? t("retryToNode") : t("runToNode")
  const bypassLabel = disabled ? t("enableNode") : t("disableNode")
  const duplicateLabel = t("duplicateNodes")

  return (
    <NodeToolbar nodeId={nodeId} isVisible position={Position.Top} offset={10}>
      <div
        role="toolbar"
        aria-label={t("nodeToolbar")}
        data-testid="node-actions-toolbar"
        className={`${FLOATING_SURFACE} flex items-center gap-0.5 p-1`}
      >
        <button
          type="button"
          onClick={() => executeToNode(nodeId, true)}
          disabled={running}
          aria-label={runLabel}
          title={runLabel}
          className={`${BUTTON_CLASS} text-md-primary hover:bg-md-hover`}
        >
          {running ? (
            <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" />
          ) : hasError ? (
            <RotateCcw aria-hidden="true" className="h-4 w-4" />
          ) : (
            <Play aria-hidden="true" className="h-4 w-4" />
          )}
        </button>
        <button
          type="button"
          onClick={onDuplicate}
          aria-label={duplicateLabel}
          title={`${duplicateLabel} (${formatShortcut("mod+d")})`}
          className={`${BUTTON_CLASS} ${NEUTRAL_CLASS}`}
        >
          <CopyPlus aria-hidden="true" className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => setNodeDisabled(nodeId, !disabled)}
          aria-label={bypassLabel}
          aria-pressed={disabled}
          title={bypassLabel}
          className={`${BUTTON_CLASS} ${
            disabled
              ? "bg-md-tertiary-container text-md-on-tertiary-container"
              : "text-md-on-surface-variant hover:bg-md-tertiary-container hover:text-md-on-tertiary-container"
          }`}
        >
          {disabled
            ? <Power aria-hidden="true" className="h-4 w-4" />
            : <CircleSlash2 aria-hidden="true" className="h-4 w-4" />}
        </button>
        <button
          type="button"
          onClick={onToggleInspector}
          aria-label={t("nodeProperties")}
          aria-pressed={inspectorOpen}
          title={t("nodeProperties")}
          className={`${BUTTON_CLASS} ${
            inspectorOpen
              ? "bg-md-secondary-container text-md-on-secondary-container"
              : NEUTRAL_CLASS
          }`}
        >
          <SlidersHorizontal aria-hidden="true" className="h-4 w-4" />
        </button>
        <span aria-hidden="true" className="mx-0.5 h-5 w-px shrink-0 bg-md-outline-variant" />
        <button
          type="button"
          onClick={onDelete}
          aria-label={t("deleteNode")}
          title={`${t("deleteNode")} (Delete)`}
          className={`${BUTTON_CLASS} text-md-on-surface-variant hover:bg-md-error-container hover:text-md-on-error-container`}
        >
          <Trash2 aria-hidden="true" className="h-4 w-4" />
        </button>
      </div>
    </NodeToolbar>
  )
}
