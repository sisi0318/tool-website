import { memo } from "react"
import { Handle, Position } from "@xyflow/react"
import { getNodeDefinition } from "@/lib/canvas/registry"
import { useCanvasStore } from "@/lib/canvas/store"
import { TYPE_COLORS } from "@/lib/canvas/types/primitives"
import type { PortDefinition } from "@/lib/canvas/types"
import { ParameterRow } from "./ParameterRow"

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
  const nodeOutputs = useCanvasStore((s) => s.nodeOutputs[data.id])
  const nodeErrors = useCanvasStore((s) => s.nodeErrors[data.id])
  const nodeRunning = useCanvasStore((s) => s.nodeRunning[data.id])
  const selectedNodeId = useCanvasStore((s) => s.selectedNodeId)
  const selectNode = useCanvasStore((s) => s.selectNode)
  const updateConfig = useCanvasStore((s) => s.updateNodeConfig)
  const edges = useCanvasStore((s) => s.edges)

  if (!definition) return null

  const isSelected = selectedNodeId === data.id
  const Icon = definition.icon

  // 分离独立参数
  const standaloneFields = definition.config.filter((f) => !f.portId)

  // 获取输入端口的上游值
  const getInputValue = (portId: string): unknown => {
    const edge = edges.find((e) => e.target === data.id && e.targetPort === portId)
    if (!edge) return undefined
    const sourceOutputs = useCanvasStore.getState().nodeOutputs[edge.source]
    return sourceOutputs?.[edge.sourcePort]
  }

  // 检查输入端口是否已连接
  const isInputConnected = (portId: string): boolean => {
    return edges.some((e) => e.target === data.id && e.targetPort === portId)
  }

  return (
    <div
      className={`bg-white dark:bg-gray-800 rounded-lg shadow-md border-2 min-w-[200px] max-w-[280px] ${
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

      <div className="py-1">
        {/* 输入端口 */}
        {definition.inputs.map((port) => {
          const connected = isInputConnected(port.id)
          const upstreamValue = connected ? getInputValue(port.id) : undefined
          return (
            <div key={port.id} className="flex items-center gap-2 px-3 py-1 relative">
              <PortHandle port={port} type="target" />
              {connected && (
                <span className="text-xs text-gray-400 truncate max-w-[100px]" title={String(upstreamValue ?? "")}>
                  {upstreamValue !== undefined ? String(upstreamValue) : ""}
                </span>
              )}
            </div>
          )
        })}

        {/* 独立参数 */}
        {standaloneFields.map((field) => (
          <ParameterRow
            key={field.id}
            nodeId={data.id}
            field={field}
            value={data.config[field.id]}
            onChange={(v) => updateConfig(data.id, { ...data.config, [field.id]: v })}
            disabled={false}
            allConfig={data.config}
          />
        ))}

        {/* 输出端口 */}
        {definition.outputs.map((port) => {
          const outputValue = nodeOutputs?.[port.id]
          return (
            <div key={port.id} className="flex items-center justify-end gap-2 px-3 py-1 relative">
              <span className="text-xs text-gray-500 truncate max-w-[100px]" title={String(outputValue ?? "")}>
                {outputValue !== undefined ? String(outputValue) : port.name}
              </span>
              <PortHandle port={port} type="source" />
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

export const ToolNode = memo(ToolNodeComponent)
