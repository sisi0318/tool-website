"use client"

import { memo, useMemo } from "react"
import { getNodeDefinition } from "@/lib/canvas/registry"
import { useTranslations } from "@/hooks/use-translations"
import { zhCanvas } from "@/lib/translations/zh-namespaces/canvas"
import { useNodeLabel } from "@/hooks/use-node-label"
import { useShallow } from "zustand/react/shallow"
import { isBlockingNodeError, useCanvasStore } from "@/lib/canvas/store"
import { previewCanvasValue } from "@/lib/canvas/format-value"
import type { NodeInstance, ConfigField } from "@/lib/canvas/types"
import { ConfigInput } from "./ConfigInput"
import { NodeRunButton } from "./NodeRunButton"
import { NodeStatusMessage } from "./NodeStatusMessage"
import { NodeBypassButton } from "./NodeBypassButton"
import { NodePort } from "./NodePort"

/** 卡片上的输出只放一小段;完整内容在属性面板里看、复制 */
const NODE_PREVIEW_CHARS = 160

interface BaseNodeProps {
  data: NodeInstance & {
    definition: ReturnType<typeof getNodeDefinition>
    selected?: boolean
  }
}

function BaseNodeComponent({ data }: BaseNodeProps) {
  const t = useTranslations("canvas", zhCanvas)
  const nodeLabel = useNodeLabel()
  const { definition, ...node } = data
  const nodeOutputs = useCanvasStore((s) => s.nodeOutputs[node.id])
  const nodeErrors = useCanvasStore((s) => s.nodeErrors[node.id])
  const nodeRunning = useCanvasStore((s) => s.nodeRunning[node.id])
  const isPrimarySelected = useCanvasStore((s) => s.selectedNodeId === node.id)
  const isSelected = Boolean(data.selected || isPrimarySelected)
  const updateConfig = useCanvasStore((s) => s.updateNodeConfig)

  // 只订阅连到本节点的边：以前订阅整个 edges，任何一条边变了所有节点都要重渲染
  const incomingEdges = useCanvasStore(useShallow((s) => s.edges.filter((e) => e.target === node.id)))
  const connectedPorts = useMemo(
    () => new Map(incomingEdges.map((e) => [e.targetPort, e])),
    [incomingEdges]
  )

  if (!definition) {
    return (
      <div className="min-w-[200px] rounded-[var(--md-sys-shape-corner-medium)] border-2 border-md-error bg-md-surface-container-low px-3 py-2 shadow-md">
        <p className="text-sm font-medium text-md-error">Unknown node: {node.type}</p>
      </div>
    )
  }

  const Icon = definition.icon

  const getInputValue = (portId: string): unknown => {
    const edge = connectedPorts.get(portId)
    if (!edge) return undefined
    const sourceOutputs = useCanvasStore.getState().nodeOutputs[edge.source]
    return sourceOutputs?.[edge.sourcePort]
  }

  return (
    <div
      data-node-disabled={node.disabled ? "true" : undefined}
      data-node-error={isBlockingNodeError(nodeErrors) ? "true" : undefined}
      className={`min-w-[280px] max-w-[calc(100vw-2rem)] rounded-[var(--md-sys-shape-corner-medium)] border-2 bg-md-surface-container-low text-md-on-surface transition-[opacity,box-shadow] sm:max-w-[400px] ${
        isBlockingNodeError(nodeErrors)
          ? "border-md-error"
          : isSelected
          ? "border-md-primary"
          : "border-md-outline-variant"
      } ${
        // 选中的节点多一圈光晕、阴影抬高（app/globals.css 的 .canvas-node-selected），在一排节点里一眼能找到
        isSelected ? "canvas-node-selected" : "shadow-md"
      } ${node.disabled ? "border-dashed opacity-70" : ""}`}
    >
      {/* Header */}
      <div className="flex items-center gap-2 rounded-t-[calc(var(--md-sys-shape-corner-medium)-2px)] border-b border-md-outline-variant bg-md-surface-container px-3 py-2">
        <Icon className="h-4 w-4 text-md-on-surface-variant" />
        <span className={`text-sm font-medium text-md-on-surface ${node.disabled ? "line-through" : ""}`}>
          {nodeLabel(definition)}
        </span>
        <NodeBypassButton nodeId={node.id} disabled={Boolean(node.disabled)} />
        <NodeRunButton nodeId={node.id} running={Boolean(nodeRunning)} hasError={isBlockingNodeError(nodeErrors)} />
      </div>

      {/* Parameters */}
      <div className="py-1">
        {definition.config.map((field) => {
          const connected = field.hasInput ? connectedPorts.has(field.id) : false
          const upstreamValue = connected ? getInputValue(field.id) : undefined

          return (
            <div key={field.id} className="flex items-center gap-1 px-2 py-1">
              {/* Input Port */}
              <div className="w-3 flex justify-center">
                {field.hasInput && (
                  <NodePort nodeId={node.id} side="target" port={field} />
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
                    value={connected ? upstreamValue : node.config[field.id]}
                    onChange={(v) => {
                      if (!connected) {
                        updateConfig(node.id, { ...node.config, [field.id]: v })
                      }
                    }}
                    disabled={connected}
                    allConfig={node.config}
                  />
                </div>
              </div>

              {/* Output Port */}
              <div className="w-3 flex justify-center">
                {field.hasOutput && (
                  <NodePort nodeId={node.id} side="source" port={field} />
                )}
              </div>
            </div>
          )
        })}

        {/* Derived Outputs */}
        {definition.outputs.length > 0 && (
          <div className="mt-1 border-t border-md-outline-variant pt-1">
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
                    <NodePort nodeId={node.id} side="source" port={output} />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {nodeErrors && <NodeStatusMessage error={nodeErrors} />}
    </div>
  )
}

export const BaseNode = memo(BaseNodeComponent)
