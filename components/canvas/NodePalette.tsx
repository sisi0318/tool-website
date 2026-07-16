"use client"

import { useCallback, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { ArrowLeft, ChevronDown, ChevronRight, Search, X } from "lucide-react"
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
  const tCommon = useTranslations("common")
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

  const sectionButtonClass =
    "flex min-h-11 w-full items-center gap-2 border-b border-md-outline-variant p-3 text-md-on-surface transition-colors hover:bg-[var(--md-sys-color-on-surface)]/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-md-primary"

  return (
    <aside
      className="relative flex w-64 max-w-[85vw] flex-col border-r border-md-outline-variant bg-md-surface-container-low"
      aria-label={t("palette")}
    >
      {onRequestClose && (
        <button
          type="button"
          onClick={onRequestClose}
          aria-label={t("close")}
          className="absolute right-2 top-1.5 z-10 flex h-9 w-9 items-center justify-center rounded-full text-md-on-surface-variant transition-colors hover:bg-[var(--md-sys-color-on-surface)]/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-md-primary lg:hidden"
        >
          <X aria-hidden="true" className="h-4 w-4" />
        </button>
      )}

      {/* Back to tools */}
      <div className="border-b border-md-outline-variant p-2 pr-12 lg:pr-2">
        <Link
          href="/tools"
          className="flex min-h-10 items-center gap-2 rounded-[var(--md-sys-shape-corner-small)] px-2 text-sm font-medium text-md-on-surface-variant transition-colors hover:bg-[var(--md-sys-color-on-surface)]/[0.08] hover:text-md-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-md-primary"
        >
          <ArrowLeft aria-hidden="true" className="h-4 w-4" />
          {tCommon("backToTools")}
        </Link>
      </div>

      {/* Workflow Section */}
      <div>
        <button
          type="button"
          onClick={() => setWorkflowExpanded(!workflowExpanded)}
          aria-expanded={workflowExpanded}
          aria-controls="canvas-workflow-actions"
          className={`${sectionButtonClass} pr-12 lg:pr-3`}
        >
          {workflowExpanded
            ? <ChevronDown aria-hidden="true" className="h-4 w-4 text-md-on-surface-variant" />
            : <ChevronRight aria-hidden="true" className="h-4 w-4 text-md-on-surface-variant" />}
          <h3 className="text-sm font-semibold">{t("workflow")}</h3>
        </button>
        {workflowExpanded && (
          <div id="canvas-workflow-actions" className="space-y-1 border-b border-md-outline-variant p-2">
            <WorkflowNewButton />
            <WorkflowSaveButton />
            <WorkflowLoadButton />
            <WorkflowTransferButtons />
          </div>
        )}
      </div>

      {/* Nodes Section */}
      <div className="flex min-h-0 flex-1 flex-col">
        <button
          type="button"
          onClick={() => setNodesExpanded(!nodesExpanded)}
          aria-expanded={nodesExpanded}
          aria-controls="canvas-node-library"
          className={sectionButtonClass}
        >
          {nodesExpanded
            ? <ChevronDown aria-hidden="true" className="h-4 w-4 text-md-on-surface-variant" />
            : <ChevronRight aria-hidden="true" className="h-4 w-4 text-md-on-surface-variant" />}
          <h3 className="text-sm font-semibold">{t("nodes")}</h3>
        </button>
        {nodesExpanded && (
          <div id="canvas-node-library" className="flex min-h-0 flex-1 flex-col">
            <div className="border-b border-md-outline-variant p-2">
              <div className="relative">
                <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-md-on-surface-variant" />
                <Input
                  type="search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder={t("nodeSearchPlaceholder")}
                  aria-label={t("nodeSearchPlaceholder")}
                  className="h-10 rounded-[var(--md-sys-shape-corner-small)] border border-md-outline-variant bg-md-surface-container-lowest pl-9 pr-9 text-sm text-md-on-surface placeholder:text-md-on-surface-variant"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    aria-label={t("clearNodeSearch")}
                    className="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-[var(--md-sys-shape-corner-small)] text-md-on-surface-variant transition-colors hover:bg-[var(--md-sys-color-on-surface)]/[0.08] hover:text-md-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-md-primary"
                  >
                    <X aria-hidden="true" className="h-4 w-4" />
                  </button>
                )}
              </div>
              <p className="mt-1.5 px-1 text-[11px] text-md-on-surface-variant">
                {t("nodeAddHint")}
              </p>
            </div>
            <ScrollArea className="flex-1">
              <div className="space-y-3 p-2" aria-live="polite">
                {visibleNodeCount === 0 && (
                  <p role="status" className="px-3 py-8 text-center text-sm leading-6 text-md-on-surface-variant">
                    {t("noMatchingNodes")}
                  </p>
                )}
              {CATEGORY_IDS.map((catId) => {
                const nodes = nodesByCategory[catId]
                if (!nodes || nodes.length === 0) return null

                return (
                  <div key={catId}>
                    <h4 className="mb-1 px-2 text-xs font-medium uppercase text-md-on-surface-variant">
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
                            className="flex min-h-11 w-full cursor-grab touch-manipulation items-center gap-2 rounded-[var(--md-sys-shape-corner-small)] px-2 py-2 text-left transition-colors hover:bg-[var(--md-sys-color-on-surface)]/[0.08] active:cursor-grabbing active:bg-[var(--md-sys-color-on-surface)]/[0.12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-md-primary"
                          >
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--md-sys-shape-corner-small)] bg-md-secondary-container text-md-on-secondary-container">
                              <Icon aria-hidden="true" className="h-4 w-4" />
                            </span>
                            <span className="min-w-0">
                              <span className="block truncate text-sm text-md-on-surface">
                                {node.label}
                              </span>
                              {node.description && (
                                <span className="block truncate text-xs text-md-on-surface-variant">
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
