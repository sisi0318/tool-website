"use client"

import { useEffect, useMemo, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useTranslations } from "@/hooks/use-translations"
import { cn } from "@/lib/utils"
import { copyTextToClipboard } from "@/lib/clipboard"
import { Check, ChevronDown, ChevronRight, Copy } from "lucide-react"

type JsonPrimitive = string | number | boolean | null
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue }

const isJsonContainer = (value: JsonValue): value is JsonValue[] | { [key: string]: JsonValue } =>
  typeof value === "object" && value !== null

type JsonTreeTranslator = (key: string) => string

const getNodeSummary = (value: JsonValue, t: JsonTreeTranslator) => {
  if (Array.isArray(value)) {
    return `${t("array")}(${value.length})`
  }

  if (value && typeof value === "object") {
    return `${t("object")}(${Object.keys(value).length})`
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
  t: JsonTreeTranslator
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
  t,
  value,
}: JsonTreeNodeProps) {
  const collapsible = isJsonContainer(value)
  const collapsed = collapsible ? isCollapsed(path) : false
  const nodeCopyText = typeof value === "string" ? value : JSON.stringify(value, null, indentText)
  const typeLabel = getNodeTypeLabel(value)

  if (!collapsible) {
    const primitiveClassName =
      value === null
        ? "text-[var(--md-sys-color-on-surface-variant)]"
        : typeof value === "string"
          ? "text-[var(--md-sys-color-success)]"
          : typeof value === "number"
            ? "text-[var(--md-sys-color-tertiary)]"
            : "text-[var(--md-sys-color-primary)]"

    return (
      <div className="rounded-xl border border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container-lowest)] px-3 py-2.5 transition-colors hover:border-[var(--md-sys-color-outline)] hover:bg-[var(--md-sys-color-surface-container-low)]">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm font-semibold text-[var(--md-sys-color-on-surface)]">{label}</span>
              <Badge variant="secondary" className="rounded-full px-2 py-0 text-[10px] uppercase tracking-[0.12em]">
                {typeLabel}
              </Badge>
            </div>
            <div className="mt-1 font-mono text-sm leading-6">
              <span className="mr-2 text-[var(--md-sys-color-outline)]">=</span>
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
            aria-label={t("copyAria").replace("{label}", label)}
          >
            {copied[path] ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            <span className="ml-1 hidden sm:inline">{copied[path] ? t("copied") : t("copy")}</span>
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
      <div className="rounded-2xl border border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container-low)] px-3 py-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 rounded-full px-2.5 font-mono text-xs"
            onClick={() => onToggle(path)}
            aria-label={(collapsed ? t("expandAria") : t("collapseAria")).replace("{label}", label)}
          >
            {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            <span className="ml-1 font-semibold">{label}</span>
          </Button>
          <Badge variant="secondary" className="rounded-full px-2 py-0 font-mono text-[10px] uppercase tracking-[0.12em]">
            {typeLabel}
          </Badge>
          <Badge variant="secondary" className="rounded-full px-2 py-0 font-mono text-[11px]">
            {getNodeSummary(value, t)}
          </Badge>
          <div className="ml-auto">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 rounded-full px-2.5 text-xs"
              onClick={() => onCopy(nodeCopyText, path)}
              aria-label={t("copyNodeAria").replace("{label}", label)}
            >
              {copied[path] ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              <span className="ml-1 hidden sm:inline">{copied[path] ? t("copied") : t("copyNode")}</span>
            </Button>
          </div>
        </div>

        {collapsed ? (
          <div className="mt-2 rounded-xl bg-[var(--md-sys-color-surface-container-high)] px-3 py-2 font-mono text-xs text-[var(--md-sys-color-on-surface-variant)]">
            {Array.isArray(value) ? "[ ... ]" : "{ ... }"}
          </div>
        ) : (
          <div
            className={cn(
              "mt-3 space-y-3 border-l border-dashed border-[var(--md-sys-color-outline-variant)] pl-4",
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
                t={t}
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
  emptyMessage,
  indentSize = 2,
  jsonText,
  rootLabel,
}: JsonTreeViewProps) {
  const t = useTranslations("jsonTree")
  const [copied, setCopied] = useState<Record<string, boolean>>({})
  const [collapsedPaths, setCollapsedPaths] = useState<Set<string>>(new Set())
  const resolvedEmptyMessage = emptyMessage ?? t("emptyMessage")
  const resolvedRootLabel = rootLabel ?? t("root")

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

    void copyTextToClipboard(text).then((success) => {
      if (!success) return
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
      <div className={cn("rounded-2xl border border-dashed border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container-low)] px-4 py-6 text-sm text-[var(--md-sys-color-on-surface-variant)]", className)}>
        {resolvedEmptyMessage}
      </div>
    )
  }

  const rootTypeLabel = parsedResult.parsed === null ? "null" : getNodeTypeLabel(parsedResult.parsed)
  const rootSummary = getNodeSummary(parsedResult.parsed, t)

  return (
    <div className={cn("space-y-4", className)}>
      <div className="rounded-2xl border border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container-lowest)] p-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-[var(--md-sys-color-on-surface)]">{t("nodeView")}</span>
              <Badge variant="secondary" className="rounded-full px-2 py-0 text-[10px] uppercase tracking-[0.12em]">
                {rootTypeLabel}
              </Badge>
              <Badge variant="secondary" className="rounded-full px-2 py-0 font-mono text-[11px]">
                {rootSummary}
              </Badge>
            </div>
            <p className="text-xs leading-5 text-[var(--md-sys-color-on-surface-variant)]">
              {t("description")}
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
              {copied["tree-all"] ? t("copied") : t("copyAll")}
            </Button>
            <Button variant="outline" size="sm" className="rounded-full" onClick={expandAllNodes}>
              <ChevronDown className="h-4 w-4 mr-1" />
              {t("expandAll")}
            </Button>
            <Button variant="outline" size="sm" className="rounded-full" onClick={collapseAllNodes}>
              <ChevronRight className="h-4 w-4 mr-1" />
              {t("collapseAll")}
            </Button>
          </div>
        </div>
      </div>

      <div className="max-h-[36rem] overflow-auto rounded-2xl border border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container-low)] p-3 sm:p-4">
        <JsonTreeNode
          copied={copied}
          indentText={indentSize}
          isCollapsed={(path) => collapsedPaths.has(path)}
          label={resolvedRootLabel}
          onCopy={copyToClipboard}
          onToggle={toggleNodeCollapse}
          path="root"
          t={t}
          value={parsedResult.parsed}
        />
      </div>
    </div>
  )
}
