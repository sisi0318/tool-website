"use client"

import { useEffect, useId, useMemo, useRef, useState, type CSSProperties } from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { Search } from "lucide-react"
import { useTranslations } from "@/hooks/use-translations"
import { zhCanvas } from "@/lib/translations/zh-namespaces/canvas"
import { useNodeLabel } from "@/hooks/use-node-label"
import type { NodeGroup, NodeLibrary } from "./use-node-library"

interface QuickAddMenuProps {
  library: NodeLibrary
  /** 弹出的位置（屏幕坐标），一般就是双击或右键的地方 */
  position: { x: number; y: number }
  onPick: (nodeType: string) => void
  onClose: () => void
}

type MenuPositionStyle = CSSProperties & {
  "--quick-add-left": string
  "--quick-add-top": string
}

/**
 * 双击画布空白处弹出的“添加节点”菜单：打开就能打字搜索，回车添加第一项，
 * 上下键换一项。节点加在双击的位置，不用先去节点库里找再拖过来。
 */
export function QuickAddMenu({ library, position, onPick, onClose }: QuickAddMenuProps) {
  const t = useTranslations("canvas", zhCanvas)
  const nodeLabel = useNodeLabel()
  const listId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState("")
  const [activeIndex, setActiveIndex] = useState(0)

  const trimmedQuery = query.trim()
  const groups = useMemo<NodeGroup[]>(() => {
    if (trimmedQuery) {
      const results = library.search(trimmedQuery)
      return results.length > 0 ? [{ id: "search", label: "", nodes: results }] : []
    }
    const frequent: NodeGroup[] = []
    if (library.favorites.length > 0) {
      frequent.push({ id: "favorites", label: t("favoriteNodes"), nodes: library.favorites })
    }
    if (library.recent.length > 0) {
      frequent.push({ id: "recent", label: t("recentNodes"), nodes: library.recent })
    }
    return [...frequent, ...library.categories]
  }, [library, t, trimmedQuery])

  // 上下键在所有分组里连着走，所以另外摊平成一列
  const options = useMemo(
    () => groups.flatMap((group) => group.nodes.map((node) => ({ id: `${listId}-${group.id}-${node.type}`, node }))),
    [groups, listId]
  )
  const active = options[Math.min(activeIndex, options.length - 1)]

  useEffect(() => {
    if (!active) return
    const element = document.getElementById(active.id)
    // jsdom 没有 scrollIntoView
    element?.scrollIntoView?.({ block: "nearest" })
  }, [active])

  const safeX = Number.isFinite(position.x) ? position.x : 12
  const safeY = Number.isFinite(position.y) ? position.y : 12
  const panelStyle: MenuPositionStyle = {
    "--quick-add-left": `max(12px, min(${safeX}px, calc(100vw - 300px)))`,
    "--quick-add-top": `max(12px, min(${safeY}px, calc(100dvh - 26.75rem)))`,
  }

  return (
    <DialogPrimitive.Root
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[59] bg-black/25 sm:bg-transparent" />
        <DialogPrimitive.Content
          data-testid="quick-add-menu"
          style={panelStyle}
          aria-describedby={undefined}
          onOpenAutoFocus={(event) => {
            event.preventDefault()
            inputRef.current?.focus()
          }}
          className="fixed inset-x-3 bottom-3 z-[60] flex max-h-[min(26rem,calc(100dvh-1.5rem))] flex-col overflow-hidden rounded-[var(--md-sys-shape-corner-large)] border border-md-outline-variant bg-md-surface-container-high text-md-on-surface shadow-2xl outline-none sm:inset-x-auto sm:bottom-auto sm:left-[var(--quick-add-left)] sm:top-[var(--quick-add-top)] sm:w-72"
        >
          <DialogPrimitive.Title className="sr-only">{t("addNode")}</DialogPrimitive.Title>
          <div className="relative shrink-0 border-b border-md-outline-variant">
            <Search aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-md-on-surface-variant" />
            <input
              ref={inputRef}
              type="text"
              role="combobox"
              aria-expanded="true"
              aria-controls={listId}
              aria-activedescendant={active?.id}
              aria-autocomplete="list"
              aria-label={t("addNode")}
              autoComplete="off"
              spellCheck={false}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value)
                setActiveIndex(0)
              }}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown") {
                  event.preventDefault()
                  setActiveIndex((index) => (options.length === 0 ? 0 : (Math.min(index, options.length - 1) + 1) % options.length))
                } else if (event.key === "ArrowUp") {
                  event.preventDefault()
                  setActiveIndex((index) => (options.length === 0 ? 0 : (Math.min(index, options.length - 1) - 1 + options.length) % options.length))
                } else if (event.key === "Enter" && active) {
                  event.preventDefault()
                  onPick(active.node.type)
                }
              }}
              placeholder={t("nodeSearchPlaceholder")}
              className="h-12 w-full bg-transparent pl-10 pr-3 text-sm text-md-on-surface outline-none placeholder:text-md-on-surface-variant"
            />
          </div>

          <div
            id={listId}
            role="listbox"
            aria-label={t("addNode")}
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-1.5"
          >
            {options.length === 0 && (
              <p role="status" className="px-3 py-8 text-center text-sm leading-6 text-md-on-surface-variant">
                {t("noMatchingNodes")}
              </p>
            )}
            {groups.map((group) => (
              <div key={group.id} role="group" aria-label={group.label || undefined} className="mb-1 last:mb-0">
                {group.label && (
                  <p aria-hidden="true" className="px-2 pb-1 pt-1.5 text-[11px] font-medium text-md-on-surface-variant">
                    {group.label}
                  </p>
                )}
                {group.nodes.map((node) => {
                  const Icon = node.icon
                  const optionId = `${listId}-${group.id}-${node.type}`
                  const selected = active?.id === optionId
                  return (
                    <div
                      key={optionId}
                      id={optionId}
                      role="option"
                      aria-selected={selected}
                      onPointerMove={() => {
                        const index = options.findIndex((option) => option.id === optionId)
                        if (index >= 0 && index !== activeIndex) setActiveIndex(index)
                      }}
                      onClick={() => onPick(node.type)}
                      className={`flex min-h-11 cursor-pointer touch-manipulation items-center gap-2.5 rounded-[var(--md-sys-shape-corner-small)] px-2 py-1.5 sm:min-h-10 ${
                        selected ? "bg-md-hover" : ""
                      }`}
                    >
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--md-sys-shape-corner-small)] bg-md-secondary-container text-md-on-secondary-container">
                        <Icon aria-hidden="true" className="h-3.5 w-3.5" />
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm text-md-on-surface">
                        {nodeLabel(node)}
                      </span>
                      {group.id === "search" && (
                        <span className="shrink-0 text-[11px] text-md-on-surface-variant">
                          {library.categoryLabel(node.category)}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
