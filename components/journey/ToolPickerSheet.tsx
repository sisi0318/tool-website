"use client"

import { useEffect, useMemo, useState } from "react"
import { SearchX } from "lucide-react"
import type { DataType, NodeDefinition } from "@/lib/canvas/types"
import { getCompatibleTools } from "@/lib/journey/suggest"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { JOURNEY_DIALOG_CLASS } from "./dialog-style"
import { Input } from "@/components/ui/input"
import { useTranslations } from "@/hooks/use-translations"

interface ToolPickerSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  valueType: DataType
  running: boolean
  onPick: (definition: NodeDefinition) => void
}

export function ToolPickerSheet({ open, onOpenChange, valueType, running, onPick }: ToolPickerSheetProps) {
  const t = useTranslations("journey")
  const [query, setQuery] = useState("")

  useEffect(() => {
    if (!open) setQuery("")
  }, [open])

  const tools = useMemo(() => (open ? getCompatibleTools(valueType) : []), [open, valueType])

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return tools
    return tools.filter(
      (definition) =>
        definition.label.toLowerCase().includes(needle) || definition.type.toLowerCase().includes(needle),
    )
  }, [tools, query])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`max-w-lg ${JOURNEY_DIALOG_CLASS}`}>
        <DialogHeader>
          <DialogTitle className="text-[var(--md-sys-color-on-surface)]">{t("moreToolsTitle")}</DialogTitle>
        </DialogHeader>
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("searchTools")}
          aria-label={t("searchTools")}
          className="rounded-full"
        />
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-sm text-[var(--md-sys-color-on-surface-variant)]">
            <SearchX className="h-6 w-6" aria-hidden />
            {t("noCompatibleTools")}
          </div>
        ) : (
          <div className="grid max-h-[50vh] grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3">
            {filtered.map((definition) => {
              const Icon = definition.icon
              return (
                <button
                  key={definition.type}
                  type="button"
                  disabled={running}
                  onClick={() => onPick(definition)}
                  className="flex flex-col items-center gap-2 rounded-2xl border border-[var(--md-sys-color-outline-variant)] p-3 text-center text-xs text-[var(--md-sys-color-on-surface)] transition-colors hover:bg-[var(--md-sys-color-secondary-container)] hover:text-[var(--md-sys-color-on-secondary-container)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--md-sys-color-primary)] disabled:opacity-50"
                >
                  <Icon className="h-5 w-5" />
                  <span className="w-full truncate leading-tight">{definition.label}</span>
                </button>
              )
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
