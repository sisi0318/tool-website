"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  GitBranchPlus,
  Search,
  Star,
  X,
} from "lucide-react"
import { useReactFlow } from "@xyflow/react"
import { getAllNodes, getNodeDefinition } from "@/lib/canvas/registry"
import { useCanvasStore } from "@/lib/canvas/store"
import { createCanvasNode } from "@/lib/canvas/node-factory"
import {
  getAutoConnectPlan,
  loadNodeLibraryPreferences,
  recordRecentNodeType,
  saveFavoriteNodeTypes,
  saveRecentNodeTypes,
  searchNodeDefinitions,
  toggleFavoriteNodeType,
} from "@/lib/canvas/node-library"
import type { NodeDefinition } from "@/lib/canvas/types"
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
const APPEND_X_OFFSET = 360

function getBrowserStorage(): Storage | undefined {
  if (typeof window === "undefined") return undefined
  try {
    return window.localStorage
  } catch {
    return undefined
  }
}

interface NodePaletteProps {
  onNodeAdded?: () => void
  onRequestClose?: () => void
  onRequestOpen?: () => void
}

interface NodeGroup {
  id: string
  label: string
  nodes: NodeDefinition[]
}

export function NodePalette({
  onNodeAdded,
  onRequestClose,
  onRequestOpen,
}: NodePaletteProps = {}) {
  const t = useTranslations("canvas")
  const tCommon = useTranslations("common")
  const addNode = useCanvasStore((state) => state.addNode)
  const addSubgraph = useCanvasStore((state) => state.addSubgraph)
  const canvasNodes = useCanvasStore((state) => state.nodes)
  const selectedNodeId = useCanvasStore((state) => state.selectedNodeId)
  const { screenToFlowPosition } = useReactFlow()
  const [workflowExpanded, setWorkflowExpanded] = useState(true)
  const [nodesExpanded, setNodesExpanded] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [favoriteTypes, setFavoriteTypes] = useState<string[]>([])
  const [recentTypes, setRecentTypes] = useState<string[]>([])
  const searchInputRef = useRef<HTMLInputElement>(null)
  const addSequenceRef = useRef(0)
  const suppressClickRef = useRef(false)
  const allNodes = useMemo(() => getAllNodes(), [])
  const definitionByType = useMemo(
    () => new Map(allNodes.map((definition) => [definition.type, definition])),
    [allNodes]
  )

  useEffect(() => {
    const preferences = loadNodeLibraryPreferences(
      allNodes,
      getBrowserStorage()
    )
    setFavoriteTypes(preferences.favorites)
    setRecentTypes(preferences.recent)
  }, [allNodes])

  const selectedSource = useMemo(
    () => canvasNodes.find((node) => node.id === selectedNodeId),
    [canvasNodes, selectedNodeId]
  )
  const selectedSourceDefinition = selectedSource
    ? getNodeDefinition(selectedSource.type)
    : undefined

  const getCategoryLabel = useCallback(
    (category: NodeDefinition["category"]) => t(CATEGORY_KEYS[category]),
    [t]
  )

  const searchResults = useMemo(
    () => searchNodeDefinitions(allNodes, searchQuery, getCategoryLabel),
    [allNodes, getCategoryLabel, searchQuery]
  )

  const nodeGroups = useMemo<NodeGroup[]>(() => {
    if (searchQuery.trim()) {
      return [{
        id: "search",
        label: t("searchResults").replace("{count}", String(searchResults.length)),
        nodes: searchResults,
      }]
    }

    const groups: NodeGroup[] = []
    const favoriteNodes = favoriteTypes.flatMap((type) => {
      const definition = definitionByType.get(type)
      return definition ? [definition] : []
    })
    const recentNodes = recentTypes.flatMap((type) => {
      const definition = definitionByType.get(type)
      return definition ? [definition] : []
    })

    if (favoriteNodes.length > 0) {
      groups.push({ id: "favorites", label: t("favoriteNodes"), nodes: favoriteNodes })
    }
    if (recentNodes.length > 0) {
      groups.push({ id: "recent", label: t("recentNodes"), nodes: recentNodes })
    }

    for (const category of CATEGORY_IDS) {
      const nodes = allNodes.filter((definition) => definition.category === category)
      if (nodes.length > 0) {
        groups.push({ id: category, label: t(CATEGORY_KEYS[category]), nodes })
      }
    }
    return groups
  }, [allNodes, definitionByType, favoriteTypes, recentTypes, searchQuery, searchResults, t])

  const recordNodeUse = useCallback((type: string) => {
    setRecentTypes((current) => {
      const next = recordRecentNodeType(current, type)
      saveRecentNodeTypes(next, getBrowserStorage())
      return next
    })
  }, [])

  const toggleFavorite = useCallback((type: string) => {
    setFavoriteTypes((current) => {
      const next = toggleFavoriteNodeType(current, type)
      saveFavoriteNodeTypes(next, getBrowserStorage())
      return next
    })
  }, [])

  const getCenteredPosition = useCallback(() => {
    const sequence = addSequenceRef.current++
    const cascadeOffset = (sequence % ADD_CASCADE_COUNT) * ADD_CASCADE_STEP
    const canvas = document.querySelector<HTMLElement>("[data-testid='canvas-drop-zone']")

    if (!canvas) {
      return { x: 96 + cascadeOffset, y: 96 + cascadeOffset }
    }

    const bounds = canvas.getBoundingClientRect()
    return screenToFlowPosition({
      x: bounds.left + bounds.width / 2 - NODE_WIDTH_ESTIMATE / 2 + cascadeOffset,
      y: bounds.top + bounds.height / 2 - NODE_HEIGHT_ESTIMATE / 2 + cascadeOffset,
    })
  }, [screenToFlowPosition])

  const handleAddNode = useCallback(
    (type: string) => {
      addNode(createCanvasNode(type, getCenteredPosition()))
      recordNodeUse(type)
      onNodeAdded?.()
    },
    [addNode, getCenteredPosition, onNodeAdded, recordNodeUse]
  )

  const handleAddAndConnect = useCallback(
    (targetDefinition: NodeDefinition) => {
      if (!selectedSource || !selectedSourceDefinition) return
      const plan = getAutoConnectPlan(selectedSourceDefinition, targetDefinition)
      if (!plan) return

      const sequence = addSequenceRef.current++
      const cascadeOffset = (sequence % ADD_CASCADE_COUNT) * ADD_CASCADE_STEP
      const newNode = createCanvasNode(targetDefinition.type, {
        x: selectedSource.position.x + APPEND_X_OFFSET,
        y: selectedSource.position.y + cascadeOffset,
      })
      addSubgraph({
        nodes: [newNode],
        edges: [{
          id: `edge-${selectedSource.id}-${plan.sourcePortId}-${newNode.id}-${plan.targetPortId}`,
          source: selectedSource.id,
          sourcePort: plan.sourcePortId,
          target: newNode.id,
          targetPort: plan.targetPortId,
        }],
      })
      recordNodeUse(targetDefinition.type)
      onNodeAdded?.()
    },
    [addSubgraph, onNodeAdded, recordNodeUse, selectedSource, selectedSourceDefinition]
  )

  const handleDragStart = (type: string, event: React.DragEvent) => {
    suppressClickRef.current = true
    event.dataTransfer.setData("application/canvas-node", type)
    event.dataTransfer.effectAllowed = "copyMove"
  }

  const handleDragEnd = (type: string, event: React.DragEvent) => {
    if (event.dataTransfer.dropEffect !== "none") recordNodeUse(type)
    window.setTimeout(() => {
      suppressClickRef.current = false
    }, 0)
  }

  const handleNodeClick = (type: string) => {
    if (suppressClickRef.current) return
    handleAddNode(type)
  }

  const focusSearch = useCallback(() => {
    onRequestOpen?.()
    setNodesExpanded(true)
    window.requestAnimationFrame(() => searchInputRef.current?.focus())
  }, [onRequestOpen])

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement
      const isTextEntry =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable
      const key = event.key.toLocaleLowerCase()
      const commandSearch = (event.ctrlKey || event.metaKey) && key === "k"
      const slashSearch = !event.ctrlKey && !event.metaKey && !event.altKey && event.key === "/"

      if (!commandSearch && (!slashSearch || isTextEntry)) return
      if (target.closest('[role="dialog"], [role="alertdialog"]')) return

      event.preventDefault()
      focusSearch()
    }

    window.addEventListener("keydown", handleShortcut)
    return () => window.removeEventListener("keydown", handleShortcut)
  }, [focusSearch])

  const sectionButtonClass =
    "flex min-h-11 w-full items-center gap-2 border-b border-md-outline-variant p-3 text-md-on-surface transition-colors hover:bg-[var(--md-sys-color-on-surface)]/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-md-primary"

  return (
    <aside
      id="canvas-node-palette"
      className="relative flex h-full min-h-0 w-72 max-w-[88vw] flex-col overflow-hidden border-r border-md-outline-variant bg-md-surface-container-low"
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

      <div className="border-b border-md-outline-variant p-2 pr-12 lg:pr-2">
        <Link
          href="/tools"
          className="flex min-h-10 items-center gap-2 rounded-[var(--md-sys-shape-corner-small)] px-2 text-sm font-medium text-md-on-surface-variant transition-colors hover:bg-[var(--md-sys-color-on-surface)]/[0.08] hover:text-md-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-md-primary"
        >
          <ArrowLeft aria-hidden="true" className="h-4 w-4" />
          {tCommon("backToTools")}
        </Link>
      </div>

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
              {selectedSourceDefinition && (
                <div className="mb-2 flex items-center gap-2 rounded-[var(--md-sys-shape-corner-small)] bg-md-primary-container px-2.5 py-2 text-xs text-md-on-primary-container">
                  <GitBranchPlus aria-hidden="true" className="h-4 w-4 shrink-0" />
                  <span className="min-w-0 truncate">
                    {t("appendFromNode").replace("{node}", selectedSourceDefinition.label)}
                  </span>
                </div>
              )}
              <div className="relative">
                <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-md-on-surface-variant" />
                <Input
                  ref={searchInputRef}
                  type="search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && searchResults[0]) {
                      event.preventDefault()
                      handleAddNode(searchResults[0].type)
                    } else if (event.key === "Escape") {
                      if (searchQuery) setSearchQuery("")
                      else onRequestClose?.()
                    }
                  }}
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
              <div className="mt-1.5 flex items-center justify-between gap-2 px-1 text-[11px] text-md-on-surface-variant">
                <span>{t("nodeAddHint")}</span>
                <kbd className="shrink-0 rounded border border-md-outline-variant bg-md-surface-container px-1.5 py-0.5 font-sans">
                  Ctrl K
                </kbd>
              </div>
            </div>
            <ScrollArea className="flex-1">
              <div className="space-y-4 p-2" aria-live="polite">
                {searchQuery.trim() && searchResults.length === 0 && (
                  <p role="status" className="px-3 py-8 text-center text-sm leading-6 text-md-on-surface-variant">
                    {t("noMatchingNodes")}
                  </p>
                )}
                {nodeGroups.map((group) => (
                  <section key={group.id} aria-labelledby={`canvas-node-group-${group.id}`}>
                    <h4
                      id={`canvas-node-group-${group.id}`}
                      className="mb-1 flex items-center gap-1.5 px-2 text-xs font-medium uppercase text-md-on-surface-variant"
                    >
                      <span>{group.label}</span>
                      {!searchQuery.trim() && (
                        <span aria-hidden="true" className="rounded-full bg-md-surface-container-high px-1.5 py-0.5 text-[10px] tabular-nums">
                          {group.nodes.length}
                        </span>
                      )}
                    </h4>
                    <div className="space-y-1">
                      {group.nodes.map((node) => {
                        const Icon = node.icon
                        const isFavorite = favoriteTypes.includes(node.type)
                        const autoConnectPlan = selectedSourceDefinition
                          ? getAutoConnectPlan(selectedSourceDefinition, node)
                          : null
                        return (
                          <div
                            key={`${group.id}-${node.type}`}
                            className="group flex min-h-12 items-stretch overflow-hidden rounded-[var(--md-sys-shape-corner-small)] transition-colors hover:bg-[var(--md-sys-color-on-surface)]/[0.08] focus-within:ring-2 focus-within:ring-md-primary"
                          >
                            <button
                              type="button"
                              draggable
                              onDragStart={(event) => handleDragStart(node.type, event)}
                              onDragEnd={(event) => handleDragEnd(node.type, event)}
                              onClick={() => handleNodeClick(node.type)}
                              aria-label={`${t("addNode")}: ${node.label}`}
                              title={node.description ?? t("nodeAddHint")}
                              className="flex min-w-0 flex-1 cursor-grab touch-manipulation items-center gap-2 px-2 py-2 text-left active:cursor-grabbing active:bg-[var(--md-sys-color-on-surface)]/[0.12] focus-visible:outline-none"
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
                            {autoConnectPlan && (
                              <button
                                type="button"
                                onClick={() => handleAddAndConnect(node)}
                                aria-label={`${t("addAndConnectAfter")}: ${node.label}`}
                                title={t("addAndConnectAfter")}
                                className="flex w-11 shrink-0 items-center justify-center text-md-on-surface-variant transition-colors hover:bg-md-primary-container hover:text-md-on-primary-container focus-visible:outline-none"
                              >
                                <GitBranchPlus aria-hidden="true" className="h-4 w-4" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => toggleFavorite(node.type)}
                              aria-label={`${isFavorite ? t("removeFavoriteNode") : t("addFavoriteNode")}: ${node.label}`}
                              aria-pressed={isFavorite}
                              title={isFavorite ? t("removeFavoriteNode") : t("addFavoriteNode")}
                              className={`flex w-11 shrink-0 items-center justify-center transition-colors focus-visible:outline-none ${
                                isFavorite
                                  ? "text-md-primary"
                                  : "text-md-on-surface-variant hover:text-md-primary"
                              }`}
                            >
                              <Star aria-hidden="true" className={`h-4 w-4 ${isFavorite ? "fill-current" : ""}`} />
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  </section>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}
      </div>
    </aside>
  )
}
