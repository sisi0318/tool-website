import { memo } from "react"
import { Handle, Position } from "@xyflow/react"
import { getNodeDefinition } from "@/lib/canvas/registry"
import { useCanvasStore } from "@/lib/canvas/store"
import { TYPE_COLORS } from "@/lib/canvas/types/primitives"
import type { NodeInstance, PortDefinition } from "@/lib/canvas/types"
import { InlineEditor } from "./InlineEditor"

interface BaseNodeProps {
  data: NodeInstance & { definition: NonNullable<ReturnType<typeof getNodeDefinition>> }
}

function PortHandle({
  port,
  type,
  nodeId,
}: {
  port: PortDefinition
  type: "source" | "target"
  nodeId: string
}) {
  const color = TYPE_COLORS[port.dataType]
  const isOutput = type === "source"

  return (
    <div
      className={`flex items-center gap-1 ${isOutput ? "flex-row-reverse" : ""}`}
      style={{ position: "relative" }}
    >
      <Handle
        type={type}
        position={isOutput ? Position.Right : Position.Left}
        id={port.id}
        style={{
          background: color,
          width: 10,
          height: 10,
          border: "2px solid white",
        }}
      />
      <span className="text-xs text-gray-600 dark:text-gray-400">{port.name}</span>
    </div>
  )
}

function BaseNodeComponent({ data }: BaseNodeProps) {
  const { definition, ...node } = data
  const nodeOutputs = useCanvasStore((s) => s.nodeOutputs[node.id])
  const nodeErrors = useCanvasStore((s) => s.nodeErrors[node.id])
  const nodeRunning = useCanvasStore((s) => s.nodeRunning[node.id])
  const selectedNodeId = useCanvasStore((s) => s.selectedNodeId)
  const selectNode = useCanvasStore((s) => s.selectNode)

  const isSelected = selectedNodeId === node.id
  const Icon = definition.icon

  return (
    <div
      className={`bg-white dark:bg-gray-800 rounded-lg shadow-md border-2 min-w-[160px] ${
        nodeErrors
          ? "border-red-500"
          : isSelected
          ? "border-blue-500"
          : "border-gray-200 dark:border-gray-700"
      }`}
      onClick={() => selectNode(node.id)}
    >
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 rounded-t-lg">
        <Icon className="w-4 h-4 text-gray-600 dark:text-gray-400" />
        <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
          {definition.label}
        </span>
        {nodeRunning && (
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse ml-auto" />
        )}
      </div>

      <div className="p-3">
        {definition.inputs.length > 0 && (
          <div className="space-y-1 mb-2">
            {definition.inputs.map((port) => (
              <PortHandle key={port.id} port={port} type="target" nodeId={node.id} />
            ))}
          </div>
        )}

        <InlineEditor nodeId={node.id} definition={definition} />

        {definition.outputs.length > 0 && (
          <div className="space-y-1">
            {definition.outputs.map((port) => (
              <PortHandle key={port.id} port={port} type="source" nodeId={node.id} />
            ))}
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
