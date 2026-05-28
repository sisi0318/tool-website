"use client"

import { useState, useMemo } from "react"
import { getAllNodes } from "@/lib/canvas/registry"
import { useCanvasStore } from "@/lib/canvas/store"
import { useTranslations } from "@/hooks/use-translations"
import { ScrollArea } from "@/components/ui/scroll-area"
import { WorkflowNewButton } from "./workflow/WorkflowNewButton"
import { WorkflowSaveButton } from "./workflow/WorkflowSaveButton"
import { WorkflowLoadButton } from "./workflow/WorkflowLoadButton"

const CATEGORY_IDS = ["basic", "crypto", "data", "image", "text", "dev", "utility", "viewer"] as const

const CATEGORY_KEYS: Record<string, string> = {
  basic: "categoryBasic",
  crypto: "categoryCrypto",
  data: "categoryData",
  image: "categoryImage",
  text: "categoryText",
  dev: "categoryDev",
  utility: "categoryUtility",
  viewer: "categoryViewer",
}

export function NodePalette() {
  const t = useTranslations("canvas")
  const addNode = useCanvasStore((s) => s.addNode)
  const [workflowExpanded, setWorkflowExpanded] = useState(true)
  const [nodesExpanded, setNodesExpanded] = useState(true)

  const nodesByCategory = useMemo(() => {
    const allNodes = getAllNodes()
    const grouped: Record<string, typeof allNodes> = {}

    for (const id of CATEGORY_IDS) {
      grouped[id] = allNodes.filter((n) => n.category === id)
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
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">{t("workflow")}</h3>
        </button>
        {workflowExpanded && (
          <div className="p-2 space-y-1 border-b border-gray-200 dark:border-gray-700">
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
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">{t("nodes")}</h3>
        </button>
        {nodesExpanded && (
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-3">
              {CATEGORY_IDS.map((catId) => {
                const nodes = nodesByCategory[catId]
                if (!nodes || nodes.length === 0) return null

                return (
                  <div key={catId}>
                    <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase px-2 mb-1">
                      {t(CATEGORY_KEYS[catId])}
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
