"use client"

import { useDeferredValue, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { ArrowUp, Check, ChevronDown, ChevronLeft, ChevronRight, Copy, Focus, MoreHorizontal, Search, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { SegmentedControl, SegmentedControlItem } from "@/components/ui/segmented-control"
import { SendToMenu } from "@/components/tools/send-to-menu"
import { useTranslations } from "@/hooks/use-translations"
import { cn } from "@/lib/utils"
import { copyTextToClipboard } from "@/lib/clipboard"
import { expandJsonTreeToDepth, indexJsonTree, jsonTreePreview, visibleJsonTreeEntries, type JsonTreeEntry, type JsonTreeIndex, type JsonTreeValue } from "@/lib/json-tree"

const PAGE_SIZE = 100
const MAX_INPUT_CHARS = 10 * 1024 * 1024
const previewEntry = (node: JsonTreeEntry, limit = 120) => node.type === "array" ? "[" + node.childCount + "]" : node.type === "object" ? "{" + node.childCount + "}" : jsonTreePreview(node.value, limit)

interface JsonTreeViewProps {
  className?: string
  emptyMessage?: string
  emphasizeIndentation?: boolean
  indentSize?: number
  jsonText: string
  rootLabel?: string
  defaultView?: "compact" | "cards"
}

export function JsonTreeView({ className, emptyMessage, emphasizeIndentation = false, indentSize = 2, jsonText, rootLabel, defaultView = "compact" }: JsonTreeViewProps) {
  const t = useTranslations("jsonTree")
  const parsed = useMemo(() => {
    if (jsonText.length > MAX_INPUT_CHARS) return { index: null, tooLarge: true }
    try { return { index: indexJsonTree(JSON.parse(jsonText) as JsonTreeValue), tooLarge: false } }
    catch { return { index: null, tooLarge: false } }
  }, [jsonText])
  const index = parsed.index
  const [view, setView] = useState(defaultView)
  const [scope, setScope] = useState("")
  const [query, setQuery] = useState("")
  const deferredQuery = useDeferredValue(query)
  const [expanded, setExpanded] = useState(() => index ? expandJsonTreeToDepth(index, 2) : new Set<string>())
  const [searchCollapsed, setSearchCollapsed] = useState(new Set<string>())
  const [level, setLevel] = useState("2")
  const [page, setPage] = useState(0)
  const [copied, setCopied] = useState<string | null>(null)
  const [copyFailed, setCopyFailed] = useState(false)
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scrollArea = useRef<HTMLDivElement>(null)
  const root = index?.byId.get(scope) ?? index?.entries[0]

  useEffect(() => {
    setScope("")
    setQuery("")
    setExpanded(index ? expandJsonTreeToDepth(index, 2) : new Set())
    setSearchCollapsed(new Set())
    setLevel("2")
    setPage(0)
    setCopied(null)
    setCopyFailed(false)
  }, [index])

  useEffect(() => () => { if (copyTimer.current) clearTimeout(copyTimer.current) }, [])
  useEffect(() => { if (scrollArea.current) scrollArea.current.scrollTop = 0 }, [page, scope, deferredQuery, view])

  const selected = useMemo(() => index && root ? visibleJsonTreeEntries(index, expanded, root.id, deferredQuery, searchCollapsed) : { entries: [], matches: new Set<string>() }, [index, root, expanded, deferredQuery, searchCollapsed])
  const pages = Math.max(1, Math.ceil(selected.entries.length / PAGE_SIZE))
  const currentPage = Math.min(page, pages - 1)
  const displayed = useMemo(() => selected.entries.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE), [selected.entries, currentPage])
  const cardIds = useMemo(() => {
    const result = new Set<string>()
    if (!index || !root) return result
    for (const node of displayed) {
      let current: JsonTreeEntry | undefined = node
      while (current && !result.has(current.id)) {
        result.add(current.id)
        if (current.id === root.id || current.parent === null) break
        current = index.byId.get(current.parent)
      }
    }
    return result
  }, [index, root, displayed])

  const copy = async (value: string, key: string) => {
    const ok = await copyTextToClipboard(value)
    setCopyFailed(!ok)
    setCopied(ok ? key : null)
    if (copyTimer.current) clearTimeout(copyTimer.current)
    copyTimer.current = setTimeout(() => { setCopied(null); setCopyFailed(false) }, 2000)
  }
  const copyValue = (node: JsonTreeEntry) => void copy(typeof node.value === "string" ? node.value : JSON.stringify(node.value, null, indentSize), "value:" + node.id)
  const toggle = (id: string) => {
    const update = (previous: Set<string>) => { const next = new Set(previous); if (next.has(id)) next.delete(id); else next.add(id); return next }
    if (deferredQuery.trim()) setSearchCollapsed(update)
    else setExpanded(update)
    setLevel("custom")
  }
  const setDepth = (value: string) => {
    if (!index || !root) return
    setLevel(value)
    setQuery("")
    setSearchCollapsed(new Set())
    setExpanded(expandJsonTreeToDepth(index, value === "all" ? Infinity : Number(value), root.id))
    setPage(0)
  }
  const focus = (id: string) => {
    if (!index) return
    setScope(id)
    setQuery("")
    setSearchCollapsed(new Set())
    setExpanded(expandJsonTreeToDepth(index, 2, id))
    setLevel("2")
    setPage(0)
  }
  const isOpen = (node: JsonTreeEntry) => node.childCount > 0 && (deferredQuery.trim() ? !searchCollapsed.has(node.id) : expanded.has(node.id))
  const label = (node: JsonTreeEntry) => node.id === "" ? rootLabel ?? t("root") : index?.byId.get(node.parent ?? "")?.type === "array" ? "[" + node.key + "]" : node.key
  const indent = Math.max(4, Math.min(8, indentSize) * 4)
  const typeClass = (node: JsonTreeEntry) => node.type === "string" ? "text-[var(--md-sys-color-success)]" : node.type === "number" ? "text-md-tertiary" : node.type === "null" ? "text-md-on-surface-variant" : "text-md-primary"

  const actions = (node: JsonTreeEntry) => <div className="ml-auto flex shrink-0 items-center gap-1">
    <Button type="button" variant="ghost" size="icon" className="h-8 w-8" aria-label={t("copyAria").replace("{label}", node.path)} onClick={() => copyValue(node)}>
      {copied === "value:" + node.id ? <Check /> : <Copy />}
    </Button>
    <DropdownMenu>
      <DropdownMenuTrigger asChild><Button type="button" variant="ghost" size="icon" className="h-8 w-8" aria-label={t("nodeActions").replace("{path}", node.path)}><MoreHorizontal /></Button></DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => void copy(node.path, "path:" + node.id)}><Copy className="mr-2 h-4 w-4" />{t("copyPath")}</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void copy(node.id, "pointer:" + node.id)}><Copy className="mr-2 h-4 w-4" />{t("copyPointer")}</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => focus(node.id)}><Focus className="mr-2 h-4 w-4" />{t("focusSubtree")}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
    <SendToMenu value={node.value} source={node.path} compact />
  </div>

  const compactRow = (node: JsonTreeEntry) => {
    const depth = Math.min(24, node.depth - (root?.depth ?? 0))
    return <div key={node.id} data-tree-path={node.id} className={cn("flex min-w-[20rem] items-center gap-1 border-b border-md-outline-variant/30 py-0.5 pr-2 font-mono text-xs hover:bg-md-surface-container-high", selected.matches.has(node.id) && "bg-md-secondary-container/60")} style={{
      paddingInlineStart: 8 + depth * indent,
      ...(emphasizeIndentation && depth > 0 ? {
        backgroundImage: "repeating-linear-gradient(90deg, transparent 0 " + (indent - 1) + "px, var(--md-sys-color-outline) " + (indent - 1) + "px " + indent + "px)",
        backgroundSize: depth * indent + "px 100%", backgroundRepeat: "no-repeat", backgroundPosition: "8px 0",
      } : {}),
    }}>
      {node.childCount > 0 ? <button type="button" className="flex min-w-0 shrink-0 items-center gap-1 rounded px-1 py-1 text-md-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-md-primary" aria-label={(isOpen(node) ? t("collapseAria") : t("expandAria")).replace("{label}", node.path)} aria-expanded={isOpen(node)} onClick={() => toggle(node.id)} title={node.path}>
        {isOpen(node) ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0" />}<span className="max-w-40 truncate font-semibold">{label(node)}</span>
      </button> : <span title={node.path} className="max-w-40 shrink-0 truncate pl-6 font-semibold text-md-on-surface">{label(node)}</span>}
      <span className="mx-1 hidden text-[10px] uppercase text-md-on-surface-variant sm:inline">{node.type}</span>
      <span className={cn("min-w-0 flex-1 truncate", typeClass(node))} title={previewEntry(node, 300)}>{previewEntry(node)}</span>
      {actions(node)}
    </div>
  }

  const cardNode = (node: JsonTreeEntry, tree: JsonTreeIndex): ReactNode => {
    const open = isOpen(node)
    const children = node.children.filter((id) => cardIds.has(id))
    const container = node.type === "array" || node.type === "object"
    return <div key={node.id} data-tree-path={node.id} className="rounded-xl border border-md-outline-variant bg-md-surface-container-lowest p-3">
      <div className="flex flex-wrap items-center gap-2">
        {node.childCount > 0 ? <Button type="button" variant="ghost" size="sm" className="h-8 max-w-full px-1 font-mono" aria-label={(open ? t("collapseAria") : t("expandAria")).replace("{label}", node.path)} aria-expanded={open} onClick={() => toggle(node.id)}>{open ? <ChevronDown /> : <ChevronRight />}<span className="truncate">{label(node)}</span></Button> : <strong className="max-w-full truncate font-mono text-sm">{label(node)}</strong>}
        <Badge variant="secondary" className="px-2 text-[10px] uppercase">{node.type}</Badge>
        {container && <span className="font-mono text-xs text-md-on-surface-variant">{previewEntry(node)}</span>}
        {actions(node)}
      </div>
      {container ? open && children.length > 0 ? <div className={cn("mt-3 space-y-2 border-l", emphasizeIndentation ? "border-l-2 border-solid border-md-outline" : "border-dashed border-md-outline-variant")} style={{ paddingInlineStart: Math.max(12, indent) }}>{children.map((id) => cardNode(tree.byId.get(id)!, tree))}</div> : <p className="mt-2 font-mono text-xs text-md-on-surface-variant">{node.type === "array" ? node.childCount ? "[ … ]" : "[]" : node.childCount ? "{ … }" : "{}"}</p> : <pre className={cn("mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-all font-mono text-sm", typeClass(node))}>{jsonTreePreview(node.value, 16_000)}</pre>}
    </div>
  }

  if (!index || !root) return <div className={cn("rounded-2xl border border-dashed border-md-outline-variant bg-md-surface-container-low px-4 py-6 text-sm text-md-on-surface-variant", className)}>{parsed.tooLarge ? t("inputTooLarge") : emptyMessage ?? t("emptyMessage")}</div>

  return <div className={cn("space-y-3", className)}>
    <div className="space-y-3 rounded-2xl border border-md-outline-variant bg-md-surface-container-lowest p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold">{t("nodeView")}</span><Badge variant="secondary" className="font-mono text-[10px] uppercase">{root.type}</Badge>
        <SegmentedControl aria-label={t("viewMode")} value={view} onValueChange={(value) => setView(value as typeof view)} className="ml-auto h-9">
          <SegmentedControlItem value="compact" className="text-xs">{t("compact")}</SegmentedControlItem><SegmentedControlItem value="cards" className="text-xs">{t("cards")}</SegmentedControlItem>
        </SegmentedControl>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-40 flex-1"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-md-on-surface-variant" /><Input aria-label={t("search")} placeholder={t("search")} className="h-10 pl-9 pr-9 text-sm" value={query} maxLength={200} onChange={(event) => { setQuery(event.target.value); setSearchCollapsed(new Set()); setPage(0) }} />{query && <Button variant="ghost" size="icon" className="absolute right-0 top-0 h-10 w-9" aria-label={t("clearSearch")} onClick={() => { setQuery(""); setSearchCollapsed(new Set()); setPage(0) }}><X /></Button>}</div>
        <label className="flex items-center gap-2 text-xs">{t("expandDepth")}<select aria-label={t("expandDepth")} value={level} onChange={(event) => setDepth(event.target.value)} className="h-10 rounded-lg border border-md-outline-variant bg-md-surface px-2 text-md-on-surface">
          {[0, 1, 2, 3, 4].map((depth) => <option key={depth} value={String(depth)}>{t("depthOption").replace("{depth}", String(depth))}</option>)}<option value="all">{t("allLevels")}</option>{level === "custom" && <option value="custom">{t("customDepth")}</option>}
        </select></label>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => void copy(JSON.stringify(root.value, null, indentSize), "all:" + root.id)}>{copied === "all:" + root.id ? <Check /> : <Copy />}{scope ? t("copySubtree") : t("copyAll")}</Button>
        <Button variant="outline" size="sm" onClick={() => setDepth("all")}><ChevronDown />{t("expandAll")}</Button>
        <Button variant="outline" size="sm" onClick={() => setDepth("0")}><ChevronRight />{t("collapseAll")}</Button>
        <span role="status" className={cn("text-xs", copyFailed ? "text-md-error" : "text-md-primary")}>{copyFailed ? t("copyFailed") : copied ? t("copied") : ""}</span>
      </div>
      {scope && <div className="flex flex-wrap items-center gap-2 rounded-lg bg-md-secondary-container px-3 py-2 text-md-on-secondary-container"><code className="min-w-0 flex-1 break-all text-xs">{root.path}</code><Button variant="ghost" size="sm" onClick={() => focus(root.parent ?? "")}><ArrowUp />{t("parent")}</Button><Button variant="ghost" size="sm" onClick={() => focus("")}>{t("backToRoot")}</Button></div>}
      <p className="text-xs text-md-on-surface-variant">{t("description")}</p>
    </div>
    {index.limited && <p role="status" className="rounded-lg bg-md-tertiary-container p-3 text-xs text-md-on-tertiary-container">{t("indexLimited")}</p>}
    {deferredQuery.trim() && <p role="status" className="text-xs text-md-on-surface-variant">{t("matchCount").replace("{count}", String(selected.matches.size))}</p>}
    <div ref={scrollArea} className="max-h-[36rem] overflow-auto rounded-xl border border-md-outline-variant bg-md-surface-container-low">
      {displayed.length ? view === "compact" ? displayed.map(compactRow) : <div className="min-w-[20rem] p-3">{cardNode(root, index)}</div> : <p className="p-6 text-center text-sm text-md-on-surface-variant">{t("noMatches")}</p>}
    </div>
    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-md-on-surface-variant">
      <span>{t("visibleCount").replace("{count}", String(selected.entries.length))}{pages > 1 ? " · " + t("pageSize").replace("{count}", String(PAGE_SIZE)) : ""}</span>
      {pages > 1 && <div className="flex items-center gap-1"><Button variant="ghost" size="icon" aria-label={t("previousPage")} disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}><ChevronLeft /></Button><span>{currentPage + 1} / {pages}</span><Button variant="ghost" size="icon" aria-label={t("nextPage")} disabled={currentPage + 1 >= pages} onClick={() => setPage(currentPage + 1)}><ChevronRight /></Button></div>}
    </div>
  </div>
}
