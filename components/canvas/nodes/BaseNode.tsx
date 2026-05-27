import { memo } from "react"
import { Handle, Position } from "@xyflow/react"
import { getNodeDefinition } from "@/lib/canvas/registry"
import { useCanvasStore } from "@/lib/canvas/store"
import { TYPE_COLORS } from "@/lib/canvas/types/primitives"
import type { NodeInstance, PortDefinition } from "@/lib/canvas/types"
import { ParameterRow } from "./ParameterRow"

interface BaseNodeProps {
  data: NodeInstance & { definition: NonNullable<ReturnType<typeof getNodeDefinition>> }
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
  )
}

function BaseNodeComponent({ data }: BaseNodeProps) {
  const { definition, ...node } = data
  const nodeOutputs = useCanvasStore((s) => s.nodeOutputs[node.id])
  const nodeErrors = useCanvasStore((s) => s.nodeErrors[node.id])
  const nodeRunning = useCanvasStore((s) => s.nodeRunning[node.id])
  const selectedNodeId = useCanvasStore((s) => s.selectedNodeId)
  const selectNode = useCanvasStore((s) => s.selectNode)
  const updateConfig = useCanvasStore((s) => s.updateNodeConfig)

  const isSelected = selectedNodeId === node.id
  const Icon = definition.icon

  // 分离端口关联参数和独立参数
  const portFields = definition.config.filter((f) => f.portId)
  const standaloneFields = definition.config.filter((f) => !f.portId)

  return (
    <div
      className={`bg-white dark:bg-gray-800 rounded-lg shadow-md border-2 min-w-[200px] max-w-[280px] ${
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

      <div className="py-1">
        {/* 输入端口 + 关联参数 */}
        {definition.inputs.map((port) => {
          const field = portFields.find((f) => f.portId === port.id)
          const color = TYPE_COLORS[port.dataType]
          return (
            <div key={port.id} className="flex items-center gap-2 px-3 py-1 relative">
              <Handle
                type="target"
                position={Position.Left}
                id={port.id}
                style={{
                  background: color,
                  width: 10,
                  height: 10,
                  border: "2px solid white",
                }}
              />
              <span className="text-xs text-gray-500 min-w-[40px]">{port.name}</span>
              {field && (
                <div className="flex-1">
                  <input
                    type="text"
                    value={String(node.config[field.id] ?? field.defaultValue ?? "")}
                    onChange={(e) => updateConfig(node.id, { ...node.config, [field.id]: e.target.value })}
                    disabled={false}
                    className="w-full px-2 py-1 text-xs bg-gray-50 dark:bg-gray-900 rounded border border-gray-300 dark:border-gray-600"
                  />
                </div>
              )}
            </div>
          )
        })}

        {/* 独立参数 */}
        {standaloneFields.map((field) => (
          <ParameterRow
            key={field.id}
            nodeId={node.id}
            field={field}
            value={node.config[field.id]}
            onChange={(v) => updateConfig(node.id, { ...node.config, [field.id]: v })}
            disabled={false}
            allConfig={node.config}
          />
        ))}

        {/* 输出端口 */}
        {definition.outputs.map((port) => {
          const color = TYPE_COLORS[port.dataType]
          return (
            <div key={port.id} className="flex items-center justify-end gap-2 px-3 py-1 relative">
              <span className="text-xs text-gray-500 min-w-[40px] text-right">{port.name}</span>
              <Handle
                type="source"
                position={Position.Right}
                id={port.id}
                style={{
                  background: color,
                  width: 10,
                  height: 10,
                  border: "2px solid white",
                }}
              />
            </div>
          )
        })}
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
