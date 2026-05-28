import { memo, useMemo } from "react"
import { Handle, Position } from "@xyflow/react"
import { getNodeDefinition } from "@/lib/canvas/registry"
import { useCanvasStore } from "@/lib/canvas/store"
import { TYPE_COLORS } from "@/lib/canvas/types/primitives"
import type { NodeInstance, ConfigField } from "@/lib/canvas/types"
import { ConfigInput } from "./ConfigInput"

interface BaseNodeProps {
  data: NodeInstance & { definition: NonNullable<ReturnType<typeof getNodeDefinition>> }
}

function BaseNodeComponent({ data }: BaseNodeProps) {
  const { definition, ...node } = data
  const nodeOutputs = useCanvasStore((s) => s.nodeOutputs[node.id])
  const nodeErrors = useCanvasStore((s) => s.nodeErrors[node.id])
  const nodeRunning = useCanvasStore((s) => s.nodeRunning[node.id])
  const isSelected = useCanvasStore((s) => s.selectedNodeId === node.id)
  const selectNode = useCanvasStore((s) => s.selectNode)
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
      className={`bg-white dark:bg-gray-800 rounded-lg shadow-md border-2 min-w-[280px] max-w-[400px] ${
        nodeErrors
          ? "border-red-500"
          : isSelected
          ? "border-blue-500"
          : "border-gray-200 dark:border-gray-700"
      }`}
      onClick={() => selectNode(node.id)}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 rounded-t-lg">
        <Icon className="w-4 h-4 text-gray-600 dark:text-gray-400" />
        <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
          {definition.label}
        </span>
        {nodeRunning && (
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse ml-auto" />
        )}
      </div>

      {/* Parameters */}
      <div className="py-1">
        {definition.config.map((field) => {
          const connected = field.hasInput ? connectedPorts.has(field.id) : false
          const upstreamValue = connected ? getInputValue(field.id) : undefined
          const outputValue = field.hasOutput ? nodeOutputs?.[field.id] : undefined

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
                      width: 8,
                      height: 8,
                      border: "2px solid white",
                      position: "relative",
                      left: -12,
                      transform: "none",
                    }}
                  />
                )}
              </div>

              {/* Parameter Label + Input */}
              <div className="flex-1 flex items-center gap-1 min-w-0">
                <span className="text-[10px] text-gray-400 w-14 shrink-0 truncate" title={field.name}>
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
                      width: 8,
                      height: 8,
                      border: "2px solid white",
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
          <div className="border-t border-gray-100 dark:border-gray-700 mt-1 pt-1">
            {definition.outputs.map((output) => {
              const outputValue = nodeOutputs?.[output.id]
              return (
                <div key={output.id} className="flex items-center gap-1 px-2 py-1">
                  <div className="w-3" />
                  <div className="flex-1 flex items-center gap-1 min-w-0">
                    <span className="text-[10px] text-gray-400 w-14 shrink-0 truncate" title={output.name}>
                      {output.name}
                    </span>
                    <span className="text-[10px] text-gray-500 truncate" title={String(outputValue ?? "")}>
                      {outputValue !== undefined ? String(outputValue) : ""}
                    </span>
                  </div>
                  <div className="w-3 flex justify-center">
                    <Handle
                      type="source"
                      position={Position.Right}
                      id={output.id}
                      style={{
                        background: TYPE_COLORS[output.dataType] ?? "#94a3b8",
                        width: 8,
                        height: 8,
                        border: "2px solid white",
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
        <div className="px-3 py-2 border-t border-red-200 bg-red-50 dark:bg-red-900/20 rounded-b-lg">
          <p className="text-xs text-red-600 dark:text-red-400 truncate">{nodeErrors}</p>
        </div>
      )}
    </div>
  )
}

export const BaseNode = memo(BaseNodeComponent)
