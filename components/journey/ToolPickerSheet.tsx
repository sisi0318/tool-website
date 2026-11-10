"use client"

import { useEffect, useMemo, useState } from "react"
import { SearchX } from "lucide-react"
import type { DataType, NodeDefinition } from "@/lib/canvas/types"
import { rankCompatibleTools } from "@/lib/journey/suggest"
import { searchNodeDefinitions } from "@/lib/canvas/node-library"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { JOURNEY_DIALOG_CLASS } from "./dialog-style"
import { Input } from "@/components/ui/input"
import { useTranslations } from "@/hooks/use-translations"
import { zhJourney } from "@/lib/translations/zh-namespaces/journey"
import { useNodeLabel } from "@/hooks/use-node-label"

interface ToolPickerSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** 要接着处理的这份数据：按它的样子决定哪些工具排在前面 */
  value: unknown
  valueType: DataType
  /** 这条路上已经用过的工具，按先后；用过的排在“推荐”里 */
  usedTools?: readonly string[]
  running: boolean
  onPick: (definition: NodeDefinition) => void
}

const TILE =
  "flex flex-col items-center gap-2 rounded-2xl border border-[var(--md-sys-color-outline-variant)] p-3 text-center text-xs text-[var(--md-sys-color-on-surface)] transition-colors hover:bg-[var(--md-sys-color-secondary-container)] hover:text-[var(--md-sys-color-on-secondary-container)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--md-sys-color-primary)] disabled:opacity-50"

/**
 * 全部可以接在这份数据后面的工具。
 * 以前按名字全排出来：手里是一段 JSON，先看到的却是汇率、温度、密码生成。
 * 现在针对这份数据的建议和这条路上用过的工具单列在前，其余在后；搜索时合成一个列表，相关的仍然靠前。
 */
export function ToolPickerSheet({ open, onOpenChange, value, valueType, usedTools, running, onPick }: ToolPickerSheetProps) {
  const t = useTranslations("journey", zhJourney)
  const nodeLabel = useNodeLabel()
  const [query, setQuery] = useState("")

  useEffect(() => {
    if (!open) setQuery("")
  }, [open])

  const ranked = useMemo(() => {
    if (!open) return { recommended: [], others: [] }
    const { recommended, others } = rankCompatibleTools(value, valueType, usedTools)
    // 其余工具按当前语言的名称排序
    return { recommended, others: [...others].sort((a, b) => nodeLabel(a).localeCompare(nodeLabel(b))) }
  }, [nodeLabel, open, usedTools, value, valueType])

  const searching = query.trim().length > 0
  // 搜索同时匹配中文名、英文名和类型；结果里推荐的工具仍排在前面
  const found = useMemo(
    () => searchNodeDefinitions([...ranked.recommended, ...ranked.others], query, undefined, nodeLabel),
    [nodeLabel, query, ranked],
  )
  const sections: Array<{ key: string; title: string | null; tools: NodeDefinition[] }> = searching
    ? [{ key: "found", title: null, tools: found }]
    : [
        { key: "recommended", title: t("recommendedTools"), tools: ranked.recommended },
        { key: "others", title: ranked.recommended.length > 0 ? t("otherTools") : null, tools: ranked.others },
      ].filter((section) => section.tools.length > 0)
  const first = sections[0]?.tools[0]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`max-w-lg ${JOURNEY_DIALOG_CLASS}`}>
        <DialogHeader>
          <DialogTitle className="text-[var(--md-sys-color-on-surface)]">{t("moreToolsTitle")}</DialogTitle>
        </DialogHeader>
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && first && !running) {
              event.preventDefault()
              onPick(first)
            }
          }}
          placeholder={t("searchTools")}
          aria-label={t("searchTools")}
          className="rounded-full"
        />
        {!first ? (
          <div className="flex flex-col items-center gap-2 py-8 text-sm text-[var(--md-sys-color-on-surface-variant)]">
            <SearchX className="h-6 w-6" aria-hidden />
            {t("noCompatibleTools")}
          </div>
        ) : (
          <div className="max-h-[50vh] space-y-4 overflow-y-auto pr-1">
            {sections.map((section) => (
              <section key={section.key} aria-label={section.title ?? undefined}>
                {section.title && (
                  <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--md-sys-color-on-surface-variant)]">{section.title}</h3>
                )}
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {section.tools.map((definition) => {
                    const Icon = definition.icon
                    return (
                      <button key={definition.type} type="button" disabled={running} onClick={() => onPick(definition)} className={TILE}>
                        <Icon className="h-5 w-5 shrink-0" />
                        <span className="line-clamp-2 w-full leading-tight">{nodeLabel(definition)}</span>
                      </button>
                    )
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
