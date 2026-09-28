"use client"

import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react"
import { usePathname, useRouter } from "next/navigation"
import { Search } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { useToolPreferences } from "@/hooks/use-tool-preferences"
import { useTranslations } from "@/hooks/use-translations"
import { TOOL_CATALOG, TOOL_IDS } from "@/lib/tools/catalog"
import { createToolSearchIndex, searchTools, type SearchResult } from "@/lib/tools/search"
import { cn } from "@/lib/utils"

/** 页头搜索按钮发出：工作台（/tools）聚焦自己的搜索框，其它页面打开命令面板 */
export const OPEN_TOOL_SEARCH_EVENT = "tools:open-search"

export function requestToolSearch() {
  window.dispatchEvent(new Event(OPEN_TOOL_SEARCH_EVENT))
}

/** 工作台有自己的搜索框，画布的 Ctrl/⌘K 用来搜节点 */
export function commandPaletteDisabledOn(pathname: string) {
  return pathname === "/tools" || pathname.startsWith("/canvas")
}

/** 功能命中带上 feature 参数，独立工具页会按它切到对应功能 */
export function toolResultHref(result: Pick<SearchResult, "toolId" | "featureParam">) {
  return `/tools/${result.toolId}${result.featureParam ? `?feature=${encodeURIComponent(result.featureParam)}` : ""}`
}

const toolIds = [...TOOL_IDS]

/**
 * 全站命令面板：Ctrl/⌘K 或页头的搜索按钮打开，按工具名、功能和别名搜索；
 * 输入为空时列出收藏和最近使用。以前只有工作台里能搜工具。
 */
export function CommandPalette() {
  const pathname = usePathname()
  const router = useRouter()
  const t = useTranslations("commandPalette")
  const toolsT = useTranslations("tools")
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [active, setActive] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)
  const disabled = commandPaletteDisabledOn(pathname)
  const { favoriteIds, recentIds } = useToolPreferences(toolIds)

  const index = useMemo(
    () => createToolSearchIndex(Object.fromEntries(TOOL_CATALOG.map((entry) => [entry.translationKey, { name: toolsT(`${entry.translationKey}.name`) }]))),
    [toolsT],
  )

  const sections = useMemo(() => {
    if (query.trim()) return [{ key: "results", title: "", items: searchTools(index, query, 12) }]
    const byId = new Map(index.map((tool) => [tool.toolId, tool.toolName]))
    const entries = (ids: string[]): SearchResult[] => ids.flatMap((toolId) => {
      const toolName = byId.get(toolId)
      return toolName ? [{ toolId, toolName, featureName: "" }] : []
    })
    return [
      { key: "favorites", title: t("favorites"), items: entries(favoriteIds) },
      { key: "recents", title: t("recents"), items: entries(recentIds.filter((id) => !favoriteIds.includes(id))) },
    ].filter((section) => section.items.length > 0)
  }, [favoriteIds, index, query, recentIds, t])
  const items = sections.flatMap((section) => section.items)

  useEffect(() => {
    if (disabled) return
    const toggle = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "k" || !(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey) return
      event.preventDefault()
      setOpen((current) => !current)
    }
    const show = () => setOpen(true)
    window.addEventListener("keydown", toggle)
    window.addEventListener(OPEN_TOOL_SEARCH_EVENT, show)
    return () => {
      window.removeEventListener("keydown", toggle)
      window.removeEventListener(OPEN_TOOL_SEARCH_EVENT, show)
    }
  }, [disabled])

  useEffect(() => { setOpen(false) }, [pathname])
  useEffect(() => { if (open) setQuery("") }, [open])
  useEffect(() => { setActive(0) }, [query, open])
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView?.({ block: "nearest" })
  }, [active])

  const choose = (result: SearchResult) => {
    setOpen(false)
    router.push(toolResultHref(result))
  }

  const onKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault()
      setActive((current) => Math.min(items.length - 1, current + 1))
    } else if (event.key === "ArrowUp") {
      event.preventDefault()
      setActive((current) => Math.max(0, current - 1))
    } else if (event.key === "Enter" && items[active]) {
      event.preventDefault()
      choose(items[active])
    }
  }

  if (disabled) return null

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="top-[12vh] max-h-[76vh] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogTitle className="sr-only">{t("title")}</DialogTitle>
        <DialogDescription className="sr-only">{t("hint")}</DialogDescription>
        <div className="flex items-center gap-2 border-b border-[var(--md-sys-color-outline-variant)] px-4 pr-12">
          <Search className="h-5 w-5 shrink-0 text-[var(--md-sys-color-on-surface-variant)]" aria-hidden="true" />
          <input
            autoFocus
            role="combobox"
            aria-expanded="true"
            aria-controls="command-palette-list"
            aria-activedescendant={items[active] ? `command-palette-option-${active}` : undefined}
            aria-label={t("placeholder")}
            placeholder={t("placeholder")}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onKeyDown}
            className="h-14 min-w-0 flex-1 bg-transparent text-base text-[var(--md-sys-color-on-surface)] outline-none placeholder:text-[var(--md-sys-color-on-surface-variant)]"
          />
        </div>
        <div id="command-palette-list" role="listbox" aria-label={t("title")} ref={listRef} className="max-h-[60vh] overflow-y-auto p-2">
          {sections.map((section) => (
            <div key={section.key} role="group" aria-label={section.title || t("title")}>
              {section.title && <div className="px-3 pb-1 pt-2 text-xs font-semibold text-[var(--md-sys-color-on-surface-variant)]">{section.title}</div>}
              {section.items.map((item) => {
                const position = items.indexOf(item)
                return (
                  <div
                    key={`${item.toolId}-${item.featureName}`}
                    id={`command-palette-option-${position}`}
                    role="option"
                    aria-selected={position === active}
                    data-index={position}
                    onClick={() => choose(item)}
                    onMouseMove={() => setActive(position)}
                    className={cn(
                      "flex min-h-11 cursor-pointer items-center gap-2 rounded-xl px-3 text-sm text-[var(--md-sys-color-on-surface)]",
                      position === active && "bg-[var(--md-sys-color-secondary-container)] text-[var(--md-sys-color-on-secondary-container)]",
                    )}
                  >
                    <span className="font-medium">{item.toolName}</span>
                    {item.featureName && <span className="min-w-0 truncate text-[var(--md-sys-color-on-surface-variant)]">· {item.featureName}</span>}
                  </div>
                )
              })}
            </div>
          ))}
          {!items.length && (
            <p className="px-3 py-8 text-center text-sm text-[var(--md-sys-color-on-surface-variant)]">{query.trim() ? t("noResults") : t("emptyHint")}</p>
          )}
        </div>
        <p className="hidden border-t border-[var(--md-sys-color-outline-variant)] px-4 py-2 text-xs text-[var(--md-sys-color-on-surface-variant)] sm:block" aria-hidden="true">{t("hint")}</p>
      </DialogContent>
    </Dialog>
  )
}
