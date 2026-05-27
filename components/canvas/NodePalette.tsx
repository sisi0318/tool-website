"use client"

import { useState, useMemo } from "react"
import { getAllNodes } from "@/lib/canvas/registry"
import { useCanvasStore } from "@/lib/canvas/store"
import { ScrollArea } from "@/components/ui/scroll-area"
import { WorkflowNewButton } from "./workflow/WorkflowNewButton"
import { WorkflowSaveButton } from "./workflow/WorkflowSaveButton"
import { WorkflowLoadButton } from "./workflow/WorkflowLoadButton"

const CATEGORIES = [
  { id: "basic", label: "Basic" },
  { id: "crypto", label: "Crypto" },
  { id: "data", label: "Data" },
  { id: "image", label: "Image" },
  { id: "text", label: "Text" },
  { id: "dev", label: "Dev" },
  { id: "utility", label: "Utility" },
  { id: "viewer", label: "Viewer" },
]

export function NodePalette() {
  const addNode = useCanvasStore((s) => s.addNode)
  const [workflowExpanded, setWorkflowExpanded] = useState(true)
  const [nodesExpanded, setNodesExpanded] = useState(true)

  const nodesByCategory = useMemo(() => {
    const allNodes = getAllNodes()
    const grouped: Record<string, typeof allNodes> = {}

    for (const cat of CATEGORIES) {
      grouped[cat.id] = allNodes.filter((n) => n.category === cat.id)
    }

    return grouped
  }, [])

  const handleDragStart = (type: string, e: React.DragEvent) => {
    e.dataTransfer.setData("application/canvas-node", type)
    e.dataTransfer.effectAllowed = "move"
  }

  return (
    <div className="w-64 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex flex-col">
      {/* Workflow Section */}
      <div>
        <button
          onClick={() => setWorkflowExpanded(!workflowExpanded)}
          className="w-full flex items-center gap-2 p-3 border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
        >
          <span className="text-xs text-gray-500">{workflowExpanded ? "▼" : "▶"}</span>
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Workflow</h3>
        </button>
        {workflowExpanded && (
          <div className="p-2 flex gap-2 border-b border-gray-200 dark:border-gray-700">
            <WorkflowNewButton />
            <WorkflowSaveButton />
            <WorkflowLoadButton />
          </div>
        )}
      </div>

      {/* Nodes Section */}
      <div className="flex-1 flex flex-col min-h-0">
        <button
          onClick={() => setNodesExpanded(!nodesExpanded)}
          className="w-full flex items-center gap-2 p-3 border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
        >
          <span className="text-xs text-gray-500">{nodesExpanded ? "▼" : "▶"}</span>
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Nodes</h3>
        </button>
        {nodesExpanded && (
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-3">
              {CATEGORIES.map((cat) => {
                const nodes = nodesByCategory[cat.id]
                if (!nodes || nodes.length === 0) return null

                return (
                  <div key={cat.id}>
                    <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase px-2 mb-1">
                      {cat.label}
                    </h4>
                    <div className="space-y-1">
                      {nodes.map((node) => {
                        const Icon = node.icon
                        return (
                          <div
                            key={node.type}
                            draggable
                            onDragStart={(e) => handleDragStart(node.type, e)}
                            className="flex items-center gap-2 px-2 py-1.5 rounded-md cursor-grab hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                          >
                            <Icon className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                            <span className="text-sm text-gray-700 dark:text-gray-300">
                              {node.label}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  )
}
