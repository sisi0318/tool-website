"use client"

import { useEffect, useMemo, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Check, ChevronDown, ChevronRight, Copy } from "lucide-react"

type JsonPrimitive = string | number | boolean | null
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue }

const isJsonContainer = (value: JsonValue): value is JsonValue[] | { [key: string]: JsonValue } =>
  typeof value === "object" && value !== null

const getNodeSummary = (value: JsonValue) => {
  if (Array.isArray(value)) {
    return `Array(${value.length})`
  }

  if (value && typeof value === "object") {
    return `Object(${Object.keys(value).length})`
  }

  if (typeof value === "string") {
    return `"${value}"`
  }

  return String(value)
}

const getNodeTypeLabel = (value: JsonValue) => {
  if (Array.isArray(value)) return "array"
  if (value === null) return "null"
  return typeof value
}

const collectCollapsiblePaths = (value: JsonValue, currentPath = "root"): string[] => {
  if (!isJsonContainer(value)) {
    return []
  }

  const childEntries = Array.isArray(value)
    ? value.map((item, index) => [index.toString(), item] as const)
    : Object.entries(value)

  return childEntries.flatMap(([key, childValue]) => {
    if (!isJsonContainer(childValue)) {
      return []
    }

    const nextPath = `${currentPath}.${key}`
    return [nextPath, ...collectCollapsiblePaths(childValue, nextPath)]
  })
}

interface JsonTreeNodeProps {
  copied: Record<string, boolean>
  depth?: number
  indentText: string | number
  isCollapsed: (path: string) => boolean
  label: string
  onCopy: (text: string, key?: string) => void
  onToggle: (path: string) => void
  path: string
  value: JsonValue
}

function JsonTreeNode({
  copied,
  depth = 0,
  indentText,
  isCollapsed,
  label,
  onCopy,
  onToggle,
  path,
  value,
}: JsonTreeNodeProps) {
  const collapsible = isJsonContainer(value)
  const collapsed = collapsible ? isCollapsed(path) : false
  const nodeCopyText = typeof value === "string" ? value : JSON.stringify(value, null, indentText)
  const typeLabel = getNodeTypeLabel(value)

  if (!collapsible) {
    const primitiveClassName =
      value === null
        ? "text-slate-500"
        : typeof value === "string"
          ? "text-emerald-600 dark:text-emerald-400"
          : typeof value === "number"
            ? "text-sky-600 dark:text-sky-400"
            : "text-violet-600 dark:text-violet-400"

    return (
      <div className="rounded-xl border border-slate-200/80 bg-white/85 px-3 py-2.5 shadow-[0_1px_0_rgba(15,23,42,0.04)] transition-colors hover:border-slate-300 hover:bg-white dark:border-slate-800 dark:bg-slate-950/60 dark:hover:border-slate-700 dark:hover:bg-slate-950/80">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm font-semibold text-slate-700 dark:text-slate-100">{label}</span>
              <Badge variant="secondary" className="rounded-full px-2 py-0 text-[10px] uppercase tracking-[0.12em]">
                {typeLabel}
              </Badge>
            </div>
            <div className="mt-1 font-mono text-sm leading-6">
              <span className="mr-2 text-slate-400">=</span>
              <span className={cn("break-all", primitiveClassName)}>
                {typeof value === "string" ? `"${value}"` : String(value)}
              </span>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 shrink-0 rounded-full px-2.5 text-xs"
            onClick={() => onCopy(nodeCopyText, path)}
            aria-label={`复制 ${label}`}
          >
            {copied[path] ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            <span className="ml-1 hidden sm:inline">{copied[path] ? "已复制" : "复制"}</span>
          </Button>
        </div>
      </div>
    )
  }

  const entries = Array.isArray(value)
    ? value.map((item, index) => [index.toString(), item] as const)
    : Object.entries(value)

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,250,252,0.9))] px-3 py-2.5 shadow-[0_1px_0_rgba(15,23,42,0.04)] dark:border-slate-800 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.92),rgba(2,6,23,0.82))]">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 rounded-full px-2.5 font-mono text-xs"
            onClick={() => onToggle(path)}
            aria-label={`${collapsed ? "展开" : "折叠"} ${label}`}
          >
            {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            <span className="ml-1 font-semibold">{label}</span>
          </Button>
          <Badge variant="secondary" className="rounded-full px-2 py-0 font-mono text-[10px] uppercase tracking-[0.12em]">
            {typeLabel}
          </Badge>
          <Badge variant="secondary" className="rounded-full px-2 py-0 font-mono text-[11px]">
            {getNodeSummary(value)}
          </Badge>
          <div className="ml-auto">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 rounded-full px-2.5 text-xs"
              onClick={() => onCopy(nodeCopyText, path)}
              aria-label={`复制节点 ${label}`}
            >
              {copied[path] ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              <span className="ml-1 hidden sm:inline">{copied[path] ? "已复制" : "复制节点"}</span>
            </Button>
          </div>
        </div>

        {collapsed ? (
          <div className="mt-2 rounded-xl bg-slate-100/80 px-3 py-2 font-mono text-xs text-slate-500 dark:bg-slate-800/70 dark:text-slate-400">
            {Array.isArray(value) ? "[ ... ]" : "{ ... }"}
          </div>
        ) : (
          <div
            className={cn(
              "mt-3 space-y-3 border-l border-dashed border-slate-300/90 pl-4 dark:border-slate-700/90",
              depth === 0 && "pl-3 sm:pl-4",
            )}
          >
            {entries.map(([childKey, childValue]) => (
              <JsonTreeNode
                key={`${path}.${childKey}`}
                copied={copied}
                depth={depth + 1}
                indentText={indentText}
                isCollapsed={isCollapsed}
                label={Array.isArray(value) ? `[${childKey}]` : childKey}
                onCopy={onCopy}
                onToggle={onToggle}
                path={`${path}.${childKey}`}
                value={childValue}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

interface JsonTreeViewProps {
  className?: string
  emptyMessage?: string
  indentSize?: number
  jsonText: string
  rootLabel?: string
}

export function JsonTreeView({
  className,
  emptyMessage = "输入有效 JSON 后，这里会显示可折叠、可复制的节点树。",
  indentSize = 2,
  jsonText,
  rootLabel = "root",
}: JsonTreeViewProps) {
  const [copied, setCopied] = useState<Record<string, boolean>>({})
  const [collapsedPaths, setCollapsedPaths] = useState<Set<string>>(new Set())

  const parsedResult = useMemo(() => {
    if (!jsonText.trim()) {
      return { parsed: null as JsonValue | null, valid: false }
    }

    try {
      return {
        parsed: JSON.parse(jsonText) as JsonValue,
        valid: true,
      }
    } catch {
      return { parsed: null as JsonValue | null, valid: false }
    }
  }, [jsonText])

  useEffect(() => {
    setCollapsedPaths(new Set())
    setCopied({})
  }, [jsonText])

  const copyToClipboard = (text: string, key = "main") => {
    if (text === undefined || text === null) return

    navigator.clipboard.writeText(text).then(() => {
      setCopied((prev) => ({ ...prev, [key]: true }))

      window.setTimeout(() => {
        setCopied((prev) => ({ ...prev, [key]: false }))
      }, 2000)
    })
  }

  const toggleNodeCollapse = (path: string) => {
    setCollapsedPaths((prev) => {
      const next = new Set(prev)
      if (next.has(path)) {
        next.delete(path)
      } else {
        next.add(path)
      }
      return next
    })
  }

  const collapseAllNodes = () => {
    if (!parsedResult.valid || !parsedResult.parsed || !isJsonContainer(parsedResult.parsed)) return
    setCollapsedPaths(new Set(collectCollapsiblePaths(parsedResult.parsed)))
  }

  const expandAllNodes = () => {
    setCollapsedPaths(new Set())
  }

  if (!parsedResult.valid) {
    return (
      <div className={cn("rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 px-4 py-6 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-950/30 dark:text-slate-400", className)}>
        {emptyMessage}
      </div>
    )
  }

  const rootTypeLabel = parsedResult.parsed === null ? "null" : getNodeTypeLabel(parsedResult.parsed)
  const rootSummary = getNodeSummary(parsedResult.parsed)

  return (
    <div className={cn("space-y-4", className)}>
      <div className="rounded-2xl border border-slate-200 bg-white/80 p-3 shadow-[0_1px_0_rgba(15,23,42,0.04)] dark:border-slate-800 dark:bg-slate-950/40">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">节点视图</span>
              <Badge variant="secondary" className="rounded-full px-2 py-0 text-[10px] uppercase tracking-[0.12em]">
                {rootTypeLabel}
              </Badge>
              <Badge variant="secondary" className="rounded-full px-2 py-0 font-mono text-[11px]">
                {rootSummary}
              </Badge>
            </div>
            <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">
              支持逐层展开、整树折叠，以及按节点复制内容。
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="rounded-full"
              onClick={() => copyToClipboard(JSON.stringify(parsedResult.parsed, null, indentSize), "tree-all")}
            >
              {copied["tree-all"] ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
              {copied["tree-all"] ? "已复制" : "复制全部"}
            </Button>
            <Button variant="outline" size="sm" className="rounded-full" onClick={expandAllNodes}>
              <ChevronDown className="h-4 w-4 mr-1" />
              展开全部
            </Button>
            <Button variant="outline" size="sm" className="rounded-full" onClick={collapseAllNodes}>
              <ChevronRight className="h-4 w-4 mr-1" />
              折叠全部
            </Button>
          </div>
        </div>
      </div>

      <div className="max-h-[36rem] overflow-auto rounded-2xl border border-slate-200 bg-slate-50/70 p-3 sm:p-4 dark:border-slate-800 dark:bg-slate-950/40">
        <JsonTreeNode
          copied={copied}
          indentText={indentSize}
          isCollapsed={(path) => collapsedPaths.has(path)}
          label={rootLabel}
          onCopy={copyToClipboard}
          onToggle={toggleNodeCollapse}
          path="root"
          value={parsedResult.parsed}
        />
      </div>
    </div>
  )
}
