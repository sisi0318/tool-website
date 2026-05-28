"use client"

import { useMemo } from "react"
import { getNodeDefinition } from "@/lib/canvas/registry"
import { useCanvasStore } from "@/lib/canvas/store"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function PropertyPanel() {
  const selectedNodeId = useCanvasStore((s) => s.selectedNodeId)
  const nodes = useCanvasStore((s) => s.nodes)
  const updateNodeConfig = useCanvasStore((s) => s.updateNodeConfig)
  const nodeOutputs = useCanvasStore((s) => s.nodeOutputs)

  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedNodeId),
    [nodes, selectedNodeId]
  )

  const definition = useMemo(
    () => (selectedNode ? getNodeDefinition(selectedNode.type) : undefined),
    [selectedNode]
  )

  if (!selectedNode || !definition) {
    return (
      <div className="w-72 border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 flex items-center justify-center">
        <p className="text-sm text-gray-500 dark:text-gray-400">Select a node to edit</p>
      </div>
    )
  }

  const outputs = nodeOutputs[selectedNode.id]

  return (
    <div className="w-72 border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex flex-col">
      <div className="p-3 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
          {definition.label}
        </h3>
      </div>
      <div className="flex-1 overflow-auto p-3 space-y-4">
        {definition.config.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
              Config
            </h4>
            {definition.config.map((field) => (
              <div key={field.id} className="space-y-1">
                <Label className="text-xs">{field.name}</Label>
                {field.options ? (
                  <select
                    className="w-full px-2 py-1 text-sm border rounded-md bg-white dark:bg-gray-800"
                    value={String(selectedNode.config[field.id] ?? field.defaultValue ?? "")}
                    onChange={(e) =>
                      updateNodeConfig(selectedNode.id, {
                        ...selectedNode.config,
                        [field.id]: e.target.value,
                      })
                    }
                  >
                    {field.options.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <Input
                    type={field.dataType === "number" ? "number" : "text"}
                    value={String(selectedNode.config[field.id] ?? field.defaultValue ?? "")}
                    onChange={(e) =>
                      updateNodeConfig(selectedNode.id, {
                        ...selectedNode.config,
                        [field.id]:
                          field.dataType === "number"
                            ? Number(e.target.value)
                            : e.target.value,
                      })
                    }
                    className="h-8 text-sm"
                  />
                )}
              </div>
            ))}
          </div>
        )}

        {outputs && Object.keys(outputs).length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
              Outputs
            </h4>
            {Object.entries(outputs).map(([key, value]) => (
              <div key={key} className="space-y-1">
                <Label className="text-xs text-gray-500">{key}</Label>
                <div className="px-2 py-1.5 bg-gray-100 dark:bg-gray-800 rounded text-xs font-mono break-all">
                  {typeof value === "object" ? JSON.stringify(value, null, 2) : String(value)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
