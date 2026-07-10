"use client"

import { useCallback, useMemo, useRef, useState } from "react"
import { Search, X } from "lucide-react"
import { useReactFlow } from "@xyflow/react"
import { getAllNodes } from "@/lib/canvas/registry"
import { useCanvasStore } from "@/lib/canvas/store"
import { createCanvasNode } from "@/lib/canvas/node-factory"
import { useTranslations } from "@/hooks/use-translations"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { WorkflowNewButton } from "./workflow/WorkflowNewButton"
import { WorkflowSaveButton } from "./workflow/WorkflowSaveButton"
import { WorkflowLoadButton } from "./workflow/WorkflowLoadButton"
import { WorkflowTransferButtons } from "./workflow/WorkflowTransferButtons"

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

const NODE_WIDTH_ESTIMATE = 280
const NODE_HEIGHT_ESTIMATE = 120
const ADD_CASCADE_STEP = 24
const ADD_CASCADE_COUNT = 6

function normalizeSearchValue(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase()
}

interface NodePaletteProps {
  onNodeAdded?: () => void
  onRequestClose?: () => void
}

export function NodePalette({ onNodeAdded, onRequestClose }: NodePaletteProps = {}) {
  const t = useTranslations("canvas")
  const addNode = useCanvasStore((s) => s.addNode)
  const { screenToFlowPosition } = useReactFlow()
  const [workflowExpanded, setWorkflowExpanded] = useState(true)
  const [nodesExpanded, setNodesExpanded] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const addSequenceRef = useRef(0)
  const suppressClickRef = useRef(false)

  const normalizedQuery = useMemo(
    () => normalizeSearchValue(searchQuery.trim()),
    [searchQuery]
  )

  const nodesByCategory = useMemo(() => {
    const allNodes = getAllNodes()
    const grouped: Record<string, typeof allNodes> = {}

    for (const id of CATEGORY_IDS) {
      const categoryLabel = t(CATEGORY_KEYS[id])
      grouped[id] = allNodes.filter((node) => {
        if (node.category !== id) return false
        if (!normalizedQuery) return true

        const searchableText = [
          node.label,
          node.description,
          node.category,
          categoryLabel,
          node.type,
        ]
          .filter((value): value is string => Boolean(value))
          .map(normalizeSearchValue)
          .join(" ")

        return searchableText.includes(normalizedQuery)
      })
    }

    return grouped
  }, [normalizedQuery, t])

  const visibleNodeCount = useMemo(
    () => CATEGORY_IDS.reduce((count, category) => count + nodesByCategory[category].length, 0),
    [nodesByCategory]
  )

  const handleAddNode = useCallback(
    (type: string) => {
      const sequence = addSequenceRef.current++
      const cascadeOffset = (sequence % ADD_CASCADE_COUNT) * ADD_CASCADE_STEP
      const canvas = document.querySelector<HTMLElement>("[data-testid='canvas-drop-zone']")

      let position = {
        x: 96 + cascadeOffset,
        y: 96 + cascadeOffset,
      }

      if (canvas) {
        const bounds = canvas.getBoundingClientRect()
        position = screenToFlowPosition({
          x: bounds.left + bounds.width / 2 - NODE_WIDTH_ESTIMATE / 2 + cascadeOffset,
          y: bounds.top + bounds.height / 2 - NODE_HEIGHT_ESTIMATE / 2 + cascadeOffset,
        })
      }

      addNode(createCanvasNode(type, position))
      onNodeAdded?.()
    },
    [addNode, onNodeAdded, screenToFlowPosition]
  )

  const handleDragStart = (type: string, e: React.DragEvent) => {
    suppressClickRef.current = true
    e.dataTransfer.setData("application/canvas-node", type)
    e.dataTransfer.effectAllowed = "copyMove"
  }

  const handleDragEnd = () => {
    window.setTimeout(() => {
      suppressClickRef.current = false
    }, 0)
  }

  const handleNodeClick = (type: string) => {
    if (suppressClickRef.current) return
    handleAddNode(type)
  }

  return (
    <aside className="relative flex w-64 max-w-[85vw] flex-col border-r border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900" aria-label={t("palette")}>
      {onRequestClose && (
        <button
          type="button"
          onClick={onRequestClose}
          aria-label={t("close")}
          className="absolute right-2 top-1.5 z-10 flex h-9 w-9 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-gray-400 dark:hover:bg-gray-800 lg:hidden"
        >
          <X aria-hidden="true" className="h-4 w-4" />
        </button>
      )}
      {/* Workflow Section */}
      <div>
        <button
          type="button"
          onClick={() => setWorkflowExpanded(!workflowExpanded)}
          aria-expanded={workflowExpanded}
          aria-controls="canvas-workflow-actions"
          className="flex min-h-11 w-full items-center gap-2 border-b border-gray-200 p-3 pr-12 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 dark:border-gray-700 dark:hover:bg-gray-800 lg:pr-3"
        >
          <span aria-hidden="true" className="text-xs text-gray-500">{workflowExpanded ? "▼" : "▶"}</span>
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">{t("workflow")}</h3>
        </button>
        {workflowExpanded && (
          <div id="canvas-workflow-actions" className="p-2 space-y-1 border-b border-gray-200 dark:border-gray-700">
            <WorkflowNewButton />
            <WorkflowSaveButton />
            <WorkflowLoadButton />
            <WorkflowTransferButtons />
          </div>
        )}
      </div>

      {/* Nodes Section */}
      <div className="flex-1 flex flex-col min-h-0">
        <button
          type="button"
          onClick={() => setNodesExpanded(!nodesExpanded)}
          aria-expanded={nodesExpanded}
          aria-controls="canvas-node-library"
          className="min-h-11 w-full flex items-center gap-2 p-3 border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500"
        >
          <span aria-hidden="true" className="text-xs text-gray-500">{nodesExpanded ? "▼" : "▶"}</span>
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">{t("nodes")}</h3>
        </button>
        {nodesExpanded && (
          <div id="canvas-node-library" className="flex min-h-0 flex-1 flex-col">
            <div className="border-b border-gray-200 p-2 dark:border-gray-700">
              <div className="relative">
                <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500 dark:text-gray-400" />
                <Input
                  type="search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder={t("nodeSearchPlaceholder")}
                  aria-label={t("nodeSearchPlaceholder")}
                  className="h-10 rounded-md border border-gray-200 bg-gray-50 pl-9 pr-9 text-sm dark:border-gray-700 dark:bg-gray-800"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    aria-label={t("clearNodeSearch")}
                    className="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-gray-500 hover:bg-gray-200 hover:text-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-100"
                  >
                    <X aria-hidden="true" className="h-4 w-4" />
                  </button>
                )}
              </div>
              <p className="mt-1.5 px-1 text-[11px] text-gray-500 dark:text-gray-400">
                {t("nodeAddHint")}
              </p>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-2 space-y-3" aria-live="polite">
                {visibleNodeCount === 0 && (
                  <p role="status" className="px-3 py-8 text-center text-sm leading-6 text-gray-500 dark:text-gray-400">
                    {t("noMatchingNodes")}
                  </p>
                )}
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
                          <button
                            type="button"
                            key={node.type}
                            draggable
                            onDragStart={(e) => handleDragStart(node.type, e)}
                            onDragEnd={handleDragEnd}
                            onClick={() => handleNodeClick(node.type)}
                            aria-label={`${t("addNode")}: ${node.label}`}
                            title={node.description ?? t("nodeAddHint")}
                            className="flex min-h-11 w-full cursor-grab touch-manipulation items-center gap-2 rounded-md px-2 py-2 text-left transition-colors hover:bg-gray-100 active:cursor-grabbing active:bg-gray-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:hover:bg-gray-800 dark:active:bg-gray-700"
                          >
                            <Icon aria-hidden="true" className="h-4 w-4 shrink-0 text-gray-600 dark:text-gray-400" />
                            <span className="min-w-0">
                              <span className="block truncate text-sm text-gray-700 dark:text-gray-300">
                                {node.label}
                              </span>
                              {node.description && (
                                <span className="block truncate text-xs text-gray-500 dark:text-gray-400">
                                  {node.description}
                                </span>
                              )}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
              </div>
            </ScrollArea>
          </div>
        )}
      </div>
    </aside>
  )
}
