"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { GitBranchPlus, Plus, Search, Star, X, type LucideIcon } from "lucide-react"
import { useReactFlow } from "@xyflow/react"
import { getNodeDefinition } from "@/lib/canvas/registry"
import { useCanvasStore } from "@/lib/canvas/store"
import { createCanvasNode } from "@/lib/canvas/node-factory"
import { getAutoConnectPlan } from "@/lib/canvas/node-library"
import type { NodeDefinition } from "@/lib/canvas/types"
import { useTranslations } from "@/hooks/use-translations"
import { zhCanvas } from "@/lib/translations/zh-namespaces/canvas"
import { useNodeLabel } from "@/hooks/use-node-label"
import { useMediaQuery } from "@/hooks/use-media-query"
import { Input } from "@/components/ui/input"
import { CATEGORY_ICONS, type NodeCategory } from "./node-categories"
import { FLOATING_SURFACE } from "./chrome"
import type { NodeGroup, NodeLibrary } from "./use-node-library"

const PANEL_ID = "canvas-node-palette"
const NODE_WIDTH_ESTIMATE = 280
const NODE_HEIGHT_ESTIMATE = 120
const ADD_CASCADE_STEP = 24
const ADD_CASCADE_COUNT = 6
const APPEND_X_OFFSET = 360

/** 竖栏上的一格：搜索（整个节点库）、常用（收藏与最近）、或某个分类 */
type DockPanel = "search" | "frequent" | NodeCategory

interface NodeDockProps {
  library: NodeLibrary
}

/**
 * 节点库。桌面上是画布左侧的一条浮动竖栏，点一格在旁边展开对应的节点列表；
 * 手机上竖栏收成右下角的「节点库」按钮，列表从左侧滑出。
 * 列表里点一下把节点加到画布中央，也可以直接拖到画布上；选中了节点时还能“加在它后面并连好线”。
 */
export function NodeDock({ library }: NodeDockProps) {
  const t = useTranslations("canvas", zhCanvas)
  const nodeLabel = useNodeLabel()
  const addNode = useCanvasStore((state) => state.addNode)
  const addSubgraph = useCanvasStore((state) => state.addSubgraph)
  // 只取选中的那个节点：订阅整个 nodes 的话，拖动任何节点都会重渲染节点库
  const selectedSource = useCanvasStore((state) =>
    state.selectedNodeId ? state.nodes.find((node) => node.id === state.selectedNodeId) : undefined
  )
  const { screenToFlowPosition } = useReactFlow()
  const isDesktop = useMediaQuery("(min-width: 1024px)")
  const [panel, setPanel] = useState<DockPanel | null>(null)
  const [query, setQuery] = useState("")
  const searchInputRef = useRef<HTMLInputElement>(null)
  const railRefs = useRef(new Map<DockPanel, HTMLButtonElement>())
  const mobileButtonRef = useRef<HTMLButtonElement>(null)
  const addSequenceRef = useRef(0)
  const suppressClickRef = useRef(false)

  const selectedSourceDefinition = selectedSource
    ? getNodeDefinition(selectedSource.type)
    : undefined

  const railItems = useMemo<Array<{ id: DockPanel; label: string; icon: LucideIcon }>>(
    () => [
      { id: "search", label: t("dockSearch"), icon: Search },
      { id: "frequent", label: t("dockFrequent"), icon: Star },
      ...library.categories.map((group) => ({
        id: group.id as NodeCategory,
        label: group.label,
        icon: CATEGORY_ICONS[group.id as NodeCategory],
      })),
    ],
    [library.categories, t]
  )

  const trimmedQuery = panel === "search" ? query.trim() : ""
  const searchResults = useMemo(
    () => (trimmedQuery ? library.search(trimmedQuery) : []),
    [library, trimmedQuery]
  )

  const groups = useMemo<NodeGroup[]>(() => {
    if (!panel) return []
    const frequent: NodeGroup[] = []
    if (library.favorites.length > 0) {
      frequent.push({ id: "favorites", label: t("favoriteNodes"), nodes: library.favorites })
    }
    if (library.recent.length > 0) {
      frequent.push({ id: "recent", label: t("recentNodes"), nodes: library.recent })
    }

    if (panel === "search") {
      if (trimmedQuery) {
        return [{
          id: "search",
          label: t("searchResults").replace("{count}", String(searchResults.length)),
          nodes: searchResults,
        }]
      }
      return [...frequent, ...library.categories]
    }
    if (panel === "frequent") return frequent
    return library.categories.filter((group) => group.id === panel)
  }, [library, panel, searchResults, t, trimmedQuery])

  const panelTitle =
    panel === "search" || panel === null
      ? t("palette")
      : railItems.find((item) => item.id === panel)?.label ?? t("palette")
  // 只看一个分类时，面板标题就是分类名，不用再重复一遍分组标题
  const singleCategory = panel !== null && panel !== "search" && panel !== "frequent"

  const closePanel = useCallback((restoreFocus = false) => {
    if (restoreFocus && panel) {
      const opener = railRefs.current.get(panel)
      // 竖栏在手机上是隐藏的，这时把焦点还给「节点库」按钮
      const target = opener && opener.offsetParent !== null ? opener : mobileButtonRef.current
      window.requestAnimationFrame(() => target?.focus())
    }
    setPanel(null)
    setQuery("")
  }, [panel])

  const togglePanel = useCallback((next: DockPanel) => {
    setQuery("")
    setPanel((current) => (current === next ? null : next))
  }, [])

  const openSearch = useCallback(() => {
    setPanel("search")
    window.requestAnimationFrame(() => searchInputRef.current?.focus())
  }, [])

  useEffect(() => {
    if (panel !== "search") return
    const frame = window.requestAnimationFrame(() => searchInputRef.current?.focus())
    return () => window.cancelAnimationFrame(frame)
  }, [panel])

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      // 事件也可能直接派发在 window / document 上，那时没有 tagName 和 closest
      const target = event.target instanceof HTMLElement ? event.target : null
      const isTextEntry = Boolean(target && (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable
      ))
      const key = event.key.toLocaleLowerCase()
      const commandSearch = (event.ctrlKey || event.metaKey) && key === "k"
      const slashSearch = !event.ctrlKey && !event.metaKey && !event.altKey && event.key === "/"

      if (!commandSearch && (!slashSearch || isTextEntry)) return
      if (target?.closest('[role="dialog"], [role="alertdialog"]')) return

      event.preventDefault()
      openSearch()
    }

    window.addEventListener("keydown", handleShortcut)
    return () => window.removeEventListener("keydown", handleShortcut)
  }, [openSearch])

  const afterAdd = useCallback(
    (type: string) => {
      library.recordUse(type)
      // 手机上列表盖着画布，加完就收起来；桌面上留着，方便连着加几个
      if (!isDesktop) closePanel()
    },
    [closePanel, isDesktop, library]
  )

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
      afterAdd(type)
    },
    [addNode, afterAdd, getCenteredPosition]
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
      afterAdd(targetDefinition.type)
    },
    [addSubgraph, afterAdd, selectedSource, selectedSourceDefinition]
  )

  const handleDragStart = (type: string, event: React.DragEvent) => {
    suppressClickRef.current = true
    event.dataTransfer.setData("application/canvas-node", type)
    event.dataTransfer.effectAllowed = "copyMove"
  }

  const handleDragEnd = (type: string, event: React.DragEvent) => {
    if (event.dataTransfer.dropEffect !== "none") library.recordUse(type)
    window.setTimeout(() => {
      suppressClickRef.current = false
    }, 0)
  }

  const handleNodeClick = (type: string) => {
    if (suppressClickRef.current) return
    handleAddNode(type)
  }

  return (
    <>
      <div
        role="toolbar"
        aria-label={t("palette")}
        aria-orientation="vertical"
        onKeyDown={(event) => {
          if (event.key !== "Escape" || panel === null) return
          event.stopPropagation()
          closePanel(true)
        }}
        className={`${FLOATING_SURFACE} scrollbar-hide absolute left-3 top-[4.25rem] z-20 hidden max-h-[calc(100%-8.5rem)] w-[3.75rem] flex-col gap-0.5 overflow-y-auto p-1 lg:flex`}
      >
        {railItems.map((item, index) => {
          const Icon = item.icon
          const open = panel === item.id
          return (
            <div key={item.id} className="contents">
              {index === 2 && <span aria-hidden="true" className="mx-2 my-0.5 h-px shrink-0 bg-md-outline-variant" />}
              <button
                type="button"
                ref={(element) => {
                  if (element) railRefs.current.set(item.id, element)
                  else railRefs.current.delete(item.id)
                }}
                onClick={() => togglePanel(item.id)}
                aria-expanded={open}
                aria-controls={open ? PANEL_ID : undefined}
                title={item.id === "search" ? `${t("nodeSearchPlaceholder")} (Ctrl K)` : item.label}
                className={`flex h-12 w-full shrink-0 flex-col items-center justify-center gap-1 rounded-[var(--md-sys-shape-corner-medium)] text-[11px] leading-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-md-primary ${
                  open
                    ? "bg-md-secondary-container text-md-on-secondary-container"
                    : "text-md-on-surface-variant hover:bg-md-hover hover:text-md-on-surface"
                }`}
              >
                <Icon aria-hidden="true" className="h-[18px] w-[18px]" />
                <span className="max-w-full truncate px-0.5">{item.label}</span>
              </button>
            </div>
          )
        })}
      </div>

      <button
        type="button"
        ref={mobileButtonRef}
        onClick={openSearch}
        aria-expanded={panel !== null}
        aria-controls={panel !== null ? PANEL_ID : undefined}
        className="absolute bottom-[max(0.75rem,env(safe-area-inset-bottom))] right-3 z-20 flex min-h-11 items-center gap-1.5 rounded-full bg-md-inverse-surface px-4 text-xs font-semibold text-md-inverse-on-surface shadow-lg transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-md-primary focus-visible:ring-offset-2 active:scale-95 lg:hidden"
      >
        <Plus aria-hidden="true" className="h-4 w-4" />
        {t("palette")}
      </button>

      {panel !== null && (
        <>
          <button
            type="button"
            aria-label={t("close")}
            tabIndex={-1}
            onClick={() => closePanel(true)}
            className="fixed inset-0 z-30 bg-black/30 backdrop-blur-[1px] lg:hidden"
          />
          <aside
            id={PANEL_ID}
            data-canvas-shortcuts="off"
            aria-label={t("palette")}
            onKeyDown={(event) => {
              if (event.key !== "Escape") return
              event.stopPropagation()
              if (query) setQuery("")
              else closePanel(true)
            }}
            className="fixed inset-y-0 left-0 z-40 flex w-[min(21.5rem,88vw)] flex-col overflow-hidden border-r border-md-outline-variant bg-md-surface-container-low shadow-2xl lg:absolute lg:inset-y-auto lg:left-[4.75rem] lg:top-[4.25rem] lg:z-20 lg:max-h-[calc(100%-8.5rem)] lg:w-72 lg:rounded-[var(--md-sys-shape-corner-large)] lg:border lg:shadow-lg"
          >
            <div className="flex min-h-12 shrink-0 items-center gap-2 border-b border-md-outline-variant py-1 pl-4 pr-1.5">
              <h2 className="min-w-0 flex-1 truncate text-sm font-semibold text-md-on-surface">
                {panelTitle}
                {singleCategory && groups[0] && (
                  <span className="ml-1.5 font-normal tabular-nums text-md-on-surface-variant">
                    {groups[0].nodes.length}
                  </span>
                )}
              </h2>
              <button
                type="button"
                onClick={() => closePanel(true)}
                aria-label={t("close")}
                title={t("close")}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-md-on-surface-variant transition-colors hover:bg-md-hover hover:text-md-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-md-primary sm:h-9 sm:w-9"
              >
                <X aria-hidden="true" className="h-4 w-4" />
              </button>
            </div>

            {(panel === "search" || selectedSourceDefinition) && (
              <div className="shrink-0 space-y-2 border-b border-md-outline-variant p-2">
                {selectedSourceDefinition && (
                  <div className="flex items-start gap-2 rounded-[var(--md-sys-shape-corner-small)] bg-md-primary-container px-2.5 py-2 text-xs leading-5 text-md-on-primary-container">
                    <GitBranchPlus aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
                    <span className="min-w-0">
                      {t("appendFromNode").replace("{node}", nodeLabel(selectedSourceDefinition))}
                    </span>
                  </div>
                )}
                {panel === "search" && (
                  <div>
                    <div className="relative">
                      <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-md-on-surface-variant" />
                      <Input
                        ref={searchInputRef}
                        type="search"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" && searchResults[0]) {
                            event.preventDefault()
                            handleAddNode(searchResults[0].type)
                          }
                        }}
                        placeholder={t("nodeSearchPlaceholder")}
                        aria-label={t("nodeSearchPlaceholder")}
                        className="h-10 rounded-[var(--md-sys-shape-corner-small)] border border-md-outline-variant bg-md-surface-container-lowest pl-9 pr-9 text-sm text-md-on-surface placeholder:text-md-on-surface-variant"
                      />
                      {query && (
                        <button
                          type="button"
                          onClick={() => {
                            setQuery("")
                            searchInputRef.current?.focus()
                          }}
                          aria-label={t("clearNodeSearch")}
                          className="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-[var(--md-sys-shape-corner-small)] text-md-on-surface-variant transition-colors hover:bg-md-hover hover:text-md-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-md-primary"
                        >
                          <X aria-hidden="true" className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    <div className="mt-1.5 flex items-center justify-between gap-2 px-1 text-[11px] text-md-on-surface-variant">
                      <span>{t("nodeAddHint")}</span>
                      <kbd className="hidden shrink-0 rounded border border-md-outline-variant bg-md-surface-container px-1.5 py-0.5 font-sans lg:inline">
                        Ctrl K
                      </kbd>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              <div className="space-y-4 p-2" aria-live="polite">
                {trimmedQuery && searchResults.length === 0 && (
                  <p role="status" className="px-3 py-8 text-center text-sm leading-6 text-md-on-surface-variant">
                    {t("noMatchingNodes")}
                  </p>
                )}
                {panel === "frequent" && groups.length === 0 && (
                  <p className="px-3 py-8 text-center text-sm leading-6 text-md-on-surface-variant">
                    {t("frequentEmpty")}
                  </p>
                )}
                {groups.map((group) => (
                  <section key={group.id} aria-labelledby={singleCategory ? undefined : `canvas-node-group-${group.id}`} aria-label={singleCategory ? group.label : undefined}>
                    {!singleCategory && (
                      <h3
                        id={`canvas-node-group-${group.id}`}
                        className="mb-1 flex items-center gap-1.5 px-2 text-xs font-medium text-md-on-surface-variant"
                      >
                        <span>{group.label}</span>
                        {!trimmedQuery && (
                          <span aria-hidden="true" className="rounded-full bg-md-surface-container-high px-1.5 py-0.5 text-[10px] tabular-nums">
                            {group.nodes.length}
                          </span>
                        )}
                      </h3>
                    )}
                    <div className="space-y-1">
                      {group.nodes.map((node) => {
                        const Icon = node.icon
                        const isFavorite = library.isFavorite(node.type)
                        const autoConnectPlan = selectedSourceDefinition
                          ? getAutoConnectPlan(selectedSourceDefinition, node)
                          : null
                        return (
                          <div
                            key={`${group.id}-${node.type}`}
                            className="group flex min-h-12 items-stretch overflow-hidden rounded-[var(--md-sys-shape-corner-small)] transition-colors focus-within:ring-2 focus-within:ring-md-primary hover:bg-md-hover"
                          >
                            <button
                              type="button"
                              draggable
                              onDragStart={(event) => handleDragStart(node.type, event)}
                              onDragEnd={(event) => handleDragEnd(node.type, event)}
                              onClick={() => handleNodeClick(node.type)}
                              aria-label={`${t("addNode")}: ${nodeLabel(node)}`}
                              title={node.description ?? t("nodeAddHint")}
                              className="flex min-w-0 flex-1 cursor-grab touch-manipulation items-center gap-2 px-2 py-2 text-left focus-visible:outline-none active:cursor-grabbing active:bg-md-pressed"
                            >
                              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--md-sys-shape-corner-small)] bg-md-secondary-container text-md-on-secondary-container">
                                <Icon aria-hidden="true" className="h-4 w-4" />
                              </span>
                              <span className="min-w-0">
                                <span className="block truncate text-sm text-md-on-surface">
                                  {nodeLabel(node)}
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
                                aria-label={`${t("addAndConnectAfter")}: ${nodeLabel(node)}`}
                                title={t("addAndConnectAfter")}
                                className="flex w-11 shrink-0 items-center justify-center text-md-on-surface-variant transition-colors hover:bg-md-primary-container hover:text-md-on-primary-container focus-visible:outline-none"
                              >
                                <GitBranchPlus aria-hidden="true" className="h-4 w-4" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => library.toggleFavorite(node.type)}
                              aria-label={`${isFavorite ? t("removeFavoriteNode") : t("addFavoriteNode")}: ${nodeLabel(node)}`}
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
            </div>
          </aside>
        </>
      )}
    </>
  )
}
