import { memo } from "react"
import { Handle, Position } from "@xyflow/react"
import { getNodeDefinition } from "@/lib/canvas/registry"
import { useCanvasStore } from "@/lib/canvas/store"
import { TYPE_COLORS } from "@/lib/canvas/types/primitives"
import type { PortDefinition } from "@/lib/canvas/types"

interface ToolNodeProps {
  data: {
    id: string
    type: string
    config: Record<string, unknown>
  }
}

function PortHandle({
  port,
  type,
}: {
  port: PortDefinition
  type: "source" | "target"
}) {
  const color = TYPE_COLORS[port.dataType]
  const isOutput = type === "source"

  return (
    <div
      className={`flex items-center gap-1 ${isOutput ? "flex-row-reverse" : ""}`}
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

function ToolNodeComponent({ data }: ToolNodeProps) {
  const definition = getNodeDefinition(data.type)
  const nodeErrors = useCanvasStore((s) => s.nodeErrors[data.id])
  const nodeRunning = useCanvasStore((s) => s.nodeRunning[data.id])
  const selectedNodeId = useCanvasStore((s) => s.selectedNodeId)
  const selectNode = useCanvasStore((s) => s.selectNode)

  if (!definition) return null

  const isSelected = selectedNodeId === data.id
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
      onClick={() => selectNode(data.id)}
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
              <PortHandle key={port.id} port={port} type="target" />
            ))}
          </div>
        )}

        {definition.outputs.length > 0 && (
          <div className="space-y-1">
            {definition.outputs.map((port) => (
              <PortHandle key={port.id} port={port} type="source" />
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

export const ToolNode = memo(ToolNodeComponent)
