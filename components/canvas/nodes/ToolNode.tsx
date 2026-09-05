"use client"

import { memo, useCallback, useEffect, useMemo, useRef } from "react"
import { Handle, Position } from "@xyflow/react"
import { useObjectUrl } from "@/hooks/use-object-url"
import { getNodeDefinition } from "@/lib/canvas/registry"
import { useTranslations } from "@/hooks/use-translations"
import { CYCLE_ERROR, UPSTREAM_ERROR, useCanvasStore } from "@/lib/canvas/store"
import { TYPE_COLORS } from "@/lib/canvas/types/primitives"
import { previewCanvasValue } from "@/lib/canvas/format-value"
import type { ConfigField } from "@/lib/canvas/types"
import { ConfigInput } from "./ConfigInput"
import { JsonTreeViewer } from "./JsonTreeViewer"
import { NodeRunButton } from "./NodeRunButton"
import { NodeBypassButton } from "./NodeBypassButton"

/** 卡片上的输出只放一小段;完整内容在属性面板里看、复制 */
const NODE_PREVIEW_CHARS = 160
/** 字符串预览节点的展示上限。整段塞进 DOM 会在大文本上卡死画布 */
const STRING_PREVIEW_CHARS = 4000

interface ToolNodeProps {
  data: {
    id: string
    type: string
    config: Record<string, unknown>
    disabled?: boolean
    selected?: boolean
  }
}

function ToolNodeComponent({ data }: ToolNodeProps) {
  const t = useTranslations("canvas")
  const definition = getNodeDefinition(data.type)
  const nodeOutputs = useCanvasStore((s) => s.nodeOutputs[data.id])
  const contentPreview = useMemo(
    () => (data.type === "string-preview" ? previewCanvasValue(nodeOutputs?.content, STRING_PREVIEW_CHARS) : null),
    [data.type, nodeOutputs],
  )
  const nodeErrors = useCanvasStore((s) => s.nodeErrors[data.id])
  const nodeRunning = useCanvasStore((s) => s.nodeRunning[data.id])
  const isPrimarySelected = useCanvasStore((s) => s.selectedNodeId === data.id)
  const isSelected = Boolean(data.selected || isPrimarySelected)
  const updateConfig = useCanvasStore((s) => s.updateNodeConfig)
  const executeNode = useCanvasStore((s) => s.executeNode)
  const edges = useCanvasStore((s) => s.edges)
  const autoRun = useCanvasStore((s) => s.autoRun)
  const autoExecutedRef = useRef(false)
  const previewSource = (
    data.type === "image-preview" && nodeOutputs?.file instanceof Blob
      ? nodeOutputs.file
      : null
  )
  const previewUrl = useObjectUrl(previewSource)

  const incomingEdges = useMemo(() => edges.filter((e) => e.target === data.id), [edges, data.id])
  const connectedPorts = useMemo(
    () => new Map(incomingEdges.map((e) => [e.targetPort, e])),
    [incomingEdges]
  )

  useEffect(() => {
    if (autoRun && definition && definition.config.length === 0 && !autoExecutedRef.current && !nodeOutputs && !nodeRunning) {
      autoExecutedRef.current = true
      executeNode(data.id, undefined, true, false)
    }
  }, [autoRun, definition, data.id, nodeOutputs, nodeRunning, executeNode])

  const getInputValue = useCallback((portId: string): unknown => {
    const edge = connectedPorts.get(portId)
    if (!edge) return undefined
    const sourceOutputs = useCanvasStore.getState().nodeOutputs[edge.source]
    return sourceOutputs?.[edge.sourcePort]
  }, [connectedPorts])

  if (!definition) {
    return (
      <div className="min-w-[280px] rounded-[var(--md-sys-shape-corner-medium)] border-2 border-md-error bg-md-surface-container-low px-3 py-2 shadow-md">
        <p className="text-sm font-medium text-md-error">Unknown node: {data.type}</p>
        <p className="text-[10px] text-md-on-surface-variant">
          This node type is not registered, so it cannot run. Delete it or update the workflow.
        </p>
      </div>
    )
  }

  const Icon = definition.icon

  return (
    <div
      data-node-disabled={data.disabled ? "true" : undefined}
      className={`min-w-[280px] max-w-[calc(100vw-2rem)] rounded-[var(--md-sys-shape-corner-medium)] border-2 bg-md-surface-container-low text-md-on-surface shadow-md transition-opacity sm:max-w-[400px] ${
        nodeErrors
          ? "border-md-error"
          : isSelected
          ? "border-md-primary"
          : "border-md-outline-variant"
      } ${data.disabled ? "border-dashed opacity-70" : ""}`}
    >
      {/* Header */}
      <div className="flex items-center gap-2 rounded-t-[calc(var(--md-sys-shape-corner-medium)-2px)] border-b border-md-outline-variant bg-md-surface-container px-3 py-2">
        <Icon className="h-4 w-4 text-md-on-surface-variant" />
        <span className={`text-sm font-medium text-md-on-surface ${data.disabled ? "line-through" : ""}`}>
          {definition.label}
        </span>
        <NodeBypassButton nodeId={data.id} disabled={Boolean(data.disabled)} />
        <NodeRunButton nodeId={data.id} running={Boolean(nodeRunning)} hasError={Boolean(nodeErrors)} />
      </div>

      {/* Parameters */}
      <div className="py-1">
        {definition.config.map((field) => {
          // 隐藏字段（如 ECB 模式下的 IV）连同端口一起跳过，避免可连接的“孤儿行”
          if (field.visible && !field.visible(data.config)) return null

          const connected = field.hasInput ? connectedPorts.has(field.id) : false
          const upstreamValue = connected ? getInputValue(field.id) : undefined

          return (
            <div key={field.id} className="flex items-center gap-1 px-2 py-1">
              {/* Input Port */}
              <div className="w-3 flex justify-center">
                {field.hasInput && (
                  <Handle
                    type="target"
                    position={Position.Left}
                    id={field.id}
                    style={{
                      background: TYPE_COLORS[field.dataType] ?? "#94a3b8",
                      width: 12,
                      height: 12,
                      border: "2px solid var(--md-sys-color-surface)",
                      position: "relative",
                      left: -12,
                      transform: "none",
                    }}
                  />
                )}
              </div>

              {/* Parameter Label + Input */}
              <div className="flex-1 flex items-center gap-1 min-w-0">
                <span className="w-14 shrink-0 truncate text-[10px] text-md-on-surface-variant" title={field.name}>
                  {field.name}
                </span>
                <div className="flex-1 min-w-0">
                  <ConfigInput
                    field={field}
                    value={connected ? upstreamValue : data.config[field.id]}
                    onChange={(v) => {
                      if (!connected) {
                        updateConfig(data.id, { ...data.config, [field.id]: v })
                      }
                    }}
                    disabled={connected}
                    allConfig={data.config}
                  />
                </div>
              </div>

              {/* Output Port */}
              <div className="w-3 flex justify-center">
                {field.hasOutput && (
                  <Handle
                    type="source"
                    position={Position.Right}
                    id={field.id}
                    style={{
                      background: TYPE_COLORS[field.dataType] ?? "#94a3b8",
                      width: 12,
                      height: 12,
                      border: "2px solid var(--md-sys-color-surface)",
                      position: "relative",
                      right: -12,
                      transform: "none",
                    }}
                  />
                )}
              </div>
            </div>
          )
        })}

        {/* Derived Outputs */}
        {definition.outputs.length > 0 && (
          <div className="mt-1 border-t border-md-outline-variant/60 pt-1">
            {definition.outputs.map((output) => {
              const outputValue = nodeOutputs?.[output.id]
              const preview = previewCanvasValue(outputValue, NODE_PREVIEW_CHARS)
              const outputText = preview.truncated ? `${preview.text}…` : preview.text
              return (
                <div key={output.id} className="flex items-center gap-1 px-2 py-1">
                  <div className="w-3" />
                  <div className="flex-1 flex items-center gap-1 min-w-0">
                    <span className="w-14 shrink-0 truncate text-[10px] text-md-on-surface-variant" title={output.name}>
                      {output.name}
                    </span>
                    <span className="truncate text-[10px] text-md-on-surface-variant" title={outputText}>
                      {outputText}
                    </span>
                  </div>
                  <div className="w-3 flex justify-center">
                    <Handle
                      type="source"
                      position={Position.Right}
                      id={output.id}
                      style={{
                        background: TYPE_COLORS[output.dataType] ?? "#94a3b8",
                        width: 12,
                        height: 12,
                        border: "2px solid var(--md-sys-color-surface)",
                        position: "relative",
                        right: -12,
                        transform: "none",
                      }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Preview Content */}
      {(data.type === "string-preview" || data.type === "json-preview" || data.type === "image-preview") && (
        <div className="border-t border-md-outline-variant px-3 py-2">
          {data.type === "string-preview" && contentPreview && contentPreview.text.length > 0 && (
            <div className="max-h-32 overflow-auto rounded-[var(--md-sys-shape-corner-extra-small)] bg-md-surface-container p-2">
              <pre className="text-[10px] whitespace-pre-wrap break-words">
                {contentPreview.text}
              </pre>
              {contentPreview.truncated && (
                <p className="mt-1 text-[10px] text-md-on-surface-variant">
                  {t("outputTruncated").replace("{shown}", String(STRING_PREVIEW_CHARS))}
                </p>
              )}
            </div>
          )}
          {data.type === "json-preview" && !!nodeOutputs?.parsed && (
            <div className="max-h-48 overflow-auto rounded-[var(--md-sys-shape-corner-extra-small)] bg-md-surface-container p-2">
              <JsonTreeViewer data={nodeOutputs.parsed} />
            </div>
          )}
          {data.type === "image-preview" && previewUrl && (
            <div className="rounded-[var(--md-sys-shape-corner-extra-small)] bg-md-surface-container p-2">
              <img
                src={previewUrl}
                alt="Preview"
                className="max-w-full max-h-48 object-contain"
              />
            </div>
          )}
        </div>
      )}

      {nodeErrors && (
        <div className="rounded-b-[calc(var(--md-sys-shape-corner-medium)-2px)] border-t border-md-error/40 bg-md-error-container/60 px-3 py-2">
          <p className="max-h-24 overflow-auto whitespace-pre-wrap break-words text-xs text-md-on-error-container">{nodeErrors === CYCLE_ERROR ? t("nodeInCycle") : nodeErrors === UPSTREAM_ERROR ? t("nodeUpstreamFailed") : nodeErrors}</p>
        </div>
      )}
    </div>
  )
}

export const ToolNode = memo(ToolNodeComponent)
