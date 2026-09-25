"use client"

import { useMemo, useState } from "react"
import { Search } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { useTranslations } from "@/hooks/use-translations"
import { TOOL_CATALOG, toolAccepts, type ToolInputKind } from "@/lib/tools/catalog"

/** “在工具中打开”：只列出能接收这类数据的工具页，可按名称、id 与别名筛选 */
export default function ToolPagePicker({ kind, onPick, onClose }: { kind: ToolInputKind; onPick: (toolId: string) => void; onClose: () => void }) {
  const t = useTranslations("toolTransfer")
  const toolsT = useTranslations("tools")
  const [query, setQuery] = useState("")
  const tools = useMemo(
    () => TOOL_CATALOG
      .filter((entry) => toolAccepts(entry, kind))
      .map((entry) => ({
        id: entry.id,
        name: toolsT(`${entry.translationKey}.name`),
        haystack: [entry.id, toolsT(`${entry.translationKey}.name`), ...(entry.keywords ?? [])].join(" ").toLowerCase(),
      })),
    [kind, toolsT],
  )
  const needle = query.trim().toLowerCase()
  const shown = needle ? tools.filter((tool) => tool.haystack.includes(needle)) : tools

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-h-[85vh] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("openInToolTitle")}</DialogTitle>
          <DialogDescription>{t("openInToolDescription")}</DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--md-sys-color-on-surface-variant)]" aria-hidden="true" />
          <Input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("searchTools")} aria-label={t("searchTools")} className="pl-9" />
        </div>
        <ul className="-mx-2 max-h-[50vh] overflow-y-auto">
          {shown.map((tool) => (
            <li key={tool.id}>
              <button
                type="button"
                onClick={() => onPick(tool.id)}
                className="flex min-h-11 w-full items-center rounded-xl px-3 text-left text-sm hover:bg-[var(--md-sys-color-surface-container-high)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--md-sys-color-primary)]"
              >
                {tool.name}
              </button>
            </li>
          ))}
          {!shown.length && <li className="px-3 py-6 text-center text-sm text-[var(--md-sys-color-on-surface-variant)]">{t("noCompatibleTools")}</li>}
        </ul>
      </DialogContent>
    </Dialog>
  )
}
