import { memo, useMemo } from "react"
import { Handle, Position } from "@xyflow/react"
import { getNodeDefinition } from "@/lib/canvas/registry"
import { useCanvasStore } from "@/lib/canvas/store"
import { TYPE_COLORS } from "@/lib/canvas/types/primitives"
import { formatCanvasValue } from "@/lib/canvas/format-value"
import type { NodeInstance, ConfigField } from "@/lib/canvas/types"
import { ConfigInput } from "./ConfigInput"
import { NodeRunButton } from "./NodeRunButton"
import { NodeBypassButton } from "./NodeBypassButton"

interface BaseNodeProps {
  data: NodeInstance & {
    definition: NonNullable<ReturnType<typeof getNodeDefinition>>
    selected?: boolean
  }
}

function BaseNodeComponent({ data }: BaseNodeProps) {
  const { definition, ...node } = data
  const nodeOutputs = useCanvasStore((s) => s.nodeOutputs[node.id])
  const nodeErrors = useCanvasStore((s) => s.nodeErrors[node.id])
  const nodeRunning = useCanvasStore((s) => s.nodeRunning[node.id])
  const isPrimarySelected = useCanvasStore((s) => s.selectedNodeId === node.id)
  const isSelected = Boolean(data.selected || isPrimarySelected)
  const updateConfig = useCanvasStore((s) => s.updateNodeConfig)
  const edges = useCanvasStore((s) => s.edges)

  const Icon = definition.icon

  const incomingEdges = useMemo(() => edges.filter((e) => e.target === node.id), [edges, node.id])
  const connectedPorts = useMemo(
    () => new Map(incomingEdges.map((e) => [e.targetPort, e])),
    [incomingEdges]
  )

  const getInputValue = (portId: string): unknown => {
    const edge = connectedPorts.get(portId)
    if (!edge) return undefined
    const sourceOutputs = useCanvasStore.getState().nodeOutputs[edge.source]
    return sourceOutputs?.[edge.sourcePort]
  }

  return (
    <div
      data-node-disabled={node.disabled ? "true" : undefined}
      className={`min-w-[280px] max-w-[calc(100vw-2rem)] rounded-[var(--md-sys-shape-corner-medium)] border-2 bg-md-surface-container-low text-md-on-surface shadow-md transition-opacity sm:max-w-[400px] ${
        nodeErrors
          ? "border-md-error"
          : isSelected
          ? "border-md-primary"
          : "border-md-outline-variant"
      } ${node.disabled ? "border-dashed opacity-70" : ""}`}
    >
      {/* Header */}
      <div className="flex items-center gap-2 rounded-t-[calc(var(--md-sys-shape-corner-medium)-2px)] border-b border-md-outline-variant bg-md-surface-container px-3 py-2">
        <Icon className="h-4 w-4 text-md-on-surface-variant" />
        <span className={`text-sm font-medium text-md-on-surface ${node.disabled ? "line-through" : ""}`}>
          {definition.label}
        </span>
        <NodeBypassButton nodeId={node.id} disabled={Boolean(node.disabled)} />
        <NodeRunButton nodeId={node.id} running={Boolean(nodeRunning)} hasError={Boolean(nodeErrors)} />
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
              const outputText = formatCanvasValue(outputValue)
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

      {nodeErrors && (
        <div className="rounded-b-[calc(var(--md-sys-shape-corner-medium)-2px)] border-t border-md-error/40 bg-md-error-container/60 px-3 py-2">
          <p className="max-h-24 overflow-auto whitespace-pre-wrap break-words text-xs text-md-on-error-container">{nodeErrors}</p>
        </div>
      )}
    </div>
  )
}

export const BaseNode = memo(BaseNodeComponent)
