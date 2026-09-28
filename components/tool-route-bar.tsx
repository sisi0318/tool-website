"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ArrowLeft, Check, Clipboard, ExternalLink, Search, Star } from "lucide-react"

import { useTranslations } from "@/hooks/use-translations"
import { useToolPreferences } from "@/hooks/use-tool-preferences"
import { copyTextToClipboard } from "@/lib/clipboard"
import { TOOL_CATALOG, TOOL_IDS } from "@/lib/tools/catalog"

/**
 * 工具 id → 翻译键，从 lib/tools/catalog.ts 派生。
 * 这里曾是一份手写表，还额外跟着一份内容完全相同的 workspaceTools 集合。
 */
export const toolTranslationKeys: Record<string, string> = Object.fromEntries(
  TOOL_CATALOG.map((entry) => [entry.id, `${entry.translationKey}.name`]),
)

const workspaceTools = new Set(TOOL_IDS)
const toolIds = [...TOOL_IDS]

const NON_TEXT_INPUTS = "[type='hidden'], [type='file'], [type='checkbox'], [type='radio'], [type='button'], [type='submit'], [type='reset'], [type='range'], [type='color'], [type='image']"

function canTakeTyping(field: HTMLElement) {
  if (field.matches(":disabled, [readonly]") || field.matches(NON_TEXT_INPUTS)) return false
  if (field.closest("[hidden], [aria-hidden='true'], [inert], .hidden")) return false
  const element = field as HTMLElement & { checkVisibility?: () => boolean }
  return typeof element.checkVisibility === "function" ? element.checkVisibility() : true
}

/**
 * “/” 要聚焦的输入框：工具用 data-primary-input 声明的主输入框优先，
 * 否则取第一个看得见、能打字的输入框。以前会落到隐藏的文件 input 上，按键被吞掉。
 */
export function findPrimaryField(root: ParentNode = document): HTMLElement | null {
  const declared = Array.from(root.querySelectorAll<HTMLElement>("main [data-primary-input]")).find(canTakeTyping)
  if (declared) return declared
  return Array.from(root.querySelectorAll<HTMLElement>("main input, main textarea, main select")).find(canTakeTyping) ?? null
}

export function ToolRouteBar() {
  const pathname = usePathname()
  const commonT = useTranslations("common")
  const toolsT = useTranslations("tools")
  const [copied, setCopied] = useState(false)
  const toolId = pathname.split("/")[2] || ""
  const translationKey = toolTranslationKeys[toolId]
  const toolName = translationKey ? toolsT(translationKey) : ""
  const { favoriteIds, toggleFavorite, recordRecent } = useToolPreferences(toolIds)
  const isFavorite = favoriteIds.includes(toolId)

  // 直接打开的工具页也记进“最近使用”；以前只有在工作台里开标签才记
  useEffect(() => {
    if (translationKey) recordRecent(toolId)
  }, [recordRecent, toolId, translationKey])

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return
      const target = event.target as HTMLElement | null
      if (target?.matches("input, textarea, select, [contenteditable='true']")) return
      const field = findPrimaryField()
      if (!field) return
      event.preventDefault()
      field.focus()
    }

    window.addEventListener("keydown", handleShortcut)
    return () => {
      window.removeEventListener("keydown", handleShortcut)
    }
  }, [pathname])

  const workspaceUrl = workspaceTools.has(toolId) ? `/tools?tool=${encodeURIComponent(toolId)}` : null

  if (!translationKey) return null

  const copyLink = async () => {
    if (!await copyTextToClipboard(window.location.href)) return
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1800)
  }

  return (
    <div className="sticky top-16 z-40 border-b border-[var(--md-sys-color-outline-variant)]/60 bg-[var(--md-sys-color-surface)]/92 backdrop-blur-xl">
      <div className="container mx-auto flex min-h-12 max-w-7xl items-center gap-1 px-2 sm:min-h-14 sm:gap-2 sm:px-6 lg:px-8">
        <Link
          href="/tools"
          aria-label={commonT("backToTools")}
          className="inline-flex min-h-10 min-w-10 items-center justify-center gap-2 rounded-full px-2 text-sm font-semibold text-[var(--md-sys-color-on-surface-variant)] hover:bg-[var(--md-sys-color-surface-container-high)] hover:text-[var(--md-sys-color-on-surface)] sm:min-w-0 sm:justify-start sm:px-3"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline">{commonT("backToTools")}</span>
        </Link>

        <span className="mx-1 hidden h-5 w-px bg-[var(--md-sys-color-outline-variant)] sm:block" />
        <strong className="min-w-0 flex-1 truncate text-xs text-[var(--md-sys-color-on-surface)] sm:text-sm">
          {toolName}
        </strong>

        <span className="hidden items-center gap-1.5 text-xs text-[var(--md-sys-color-on-surface-variant)] lg:inline-flex">
          <Search className="h-3.5 w-3.5" />
          {commonT("focusInputHint")}
        </span>

        <button
          type="button"
          onClick={() => toggleFavorite(toolId)}
          aria-pressed={isFavorite}
          aria-label={isFavorite ? toolsT("removeFavorite") : toolsT("addFavorite")}
          title={isFavorite ? toolsT("removeFavorite") : toolsT("addFavorite")}
          className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-full text-[var(--md-sys-color-on-surface-variant)] hover:bg-[var(--md-sys-color-surface-container-high)] hover:text-[var(--md-sys-color-primary)]"
        >
          <Star className={isFavorite ? "h-4 w-4 fill-current text-[var(--md-sys-color-primary)]" : "h-4 w-4"} />
        </button>

        <button
          type="button"
          onClick={copyLink}
          aria-label={copied ? commonT("linkCopied") : commonT("copyToolLink")}
          className="inline-flex min-h-10 min-w-10 items-center justify-center gap-2 rounded-full px-2 text-sm font-semibold text-[var(--md-sys-color-on-surface-variant)] hover:bg-[var(--md-sys-color-surface-container-high)] md:min-w-0 md:px-3"
        >
          {copied ? <Check className="h-4 w-4 text-[var(--md-sys-color-primary)]" /> : <Clipboard className="h-4 w-4" />}
          <span className="hidden md:inline">{copied ? commonT("linkCopied") : commonT("copyToolLink")}</span>
        </button>

        {workspaceUrl && (
          <Link
            href={workspaceUrl}
            aria-label={commonT("openInWorkspace")}
            className="inline-flex min-h-10 min-w-10 items-center justify-center gap-2 rounded-full bg-[var(--md-sys-color-secondary-container)] px-2 text-sm font-bold text-[var(--md-sys-color-on-secondary-container)] hover:brightness-95 sm:min-w-0 sm:px-3"
          >
            <ExternalLink className="h-4 w-4" />
            <span className="hidden sm:inline">{commonT("openInWorkspace")}</span>
          </Link>
        )}
      </div>
    </div>
  )
}
