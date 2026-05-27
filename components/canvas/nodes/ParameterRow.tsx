import { Handle, Position } from "@xyflow/react"
import { useCanvasStore } from "@/lib/canvas/store"
import { TYPE_COLORS } from "@/lib/canvas/types/primitives"
import type { ConfigField } from "@/lib/canvas/types"
import { ConfigInput } from "./ConfigInput"

interface ParameterRowProps {
  nodeId: string
  field: ConfigField
  value: unknown
  onChange: (value: unknown) => void
  disabled: boolean
  allConfig: Record<string, unknown>
}

export function ParameterRow({ nodeId, field, value, onChange, disabled, allConfig }: ParameterRowProps) {
  const edges = useCanvasStore((s) => s.edges)

  // 处理联动选项 - 返回空数组时隐藏
  if (field.dependsOn && field.dynamicOptions) {
    const dependentValue = allConfig[field.dependsOn]
    const dynamicOpts = field.dynamicOptions(String(dependentValue ?? ""))
    if (dynamicOpts.length === 0) return null
  }

  // 检查关联端口是否已连接
  const isPortConnected = field.portId
    ? edges.some((e) => e.target === nodeId && e.targetPort === field.portId)
    : false

  return (
    <div className="flex items-center gap-2 px-3 py-1" data-testid="parameter-row">
      {/* 左侧端口 */}
      {field.portId && (
        <Handle
          type="target"
          position={Position.Left}
          id={field.portId}
          style={{ background: TYPE_COLORS[field.dataType as keyof typeof TYPE_COLORS] ?? "#94a3b8" }}
        />
      )}

      {/* 参数标签 */}
      <span className="text-xs text-gray-500 min-w-[60px]">{field.name}</span>

      {/* 参数输入 */}
      <div className="flex-1">
        <ConfigInput
          field={field}
          value={value}
          onChange={onChange}
          disabled={isPortConnected || disabled}
          allConfig={allConfig}
        />
      </div>
    </div>
  )
}
