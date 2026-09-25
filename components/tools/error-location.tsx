"use client"

import { Crosshair } from "lucide-react"
import { useTranslations } from "@/hooks/use-translations"
import { offsetOf, type TextLocation } from "@/lib/text-location"

/** 在输入框里选中出错位置并滚动到那一行 */
export function revealTextLocation(field: HTMLTextAreaElement | HTMLInputElement, location: TextLocation) {
  const offset = offsetOf(field.value, location)
  field.focus()
  field.setSelectionRange(offset, Math.min(field.value.length, offset + 1))
  if (field instanceof HTMLTextAreaElement) {
    const lineHeight = Number.parseFloat(getComputedStyle(field).lineHeight) || 20
    field.scrollTop = Math.max(0, (location.line - 1) * lineHeight - field.clientHeight / 2)
  }
}

/** “第 X 行，第 Y 列”加一个“定位”按钮，点了跳到 targetId 输入框里的出错处 */
export function ErrorLocation({ location, targetId }: { location: TextLocation; targetId: string }) {
  const t = useTranslations("common")
  const reveal = () => {
    const field = document.getElementById(targetId)
    if (field instanceof HTMLTextAreaElement || field instanceof HTMLInputElement) revealTextLocation(field, location)
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <span>{t("errorAt").replace("{line}", String(location.line)).replace("{column}", String(location.column))}</span>
      <button
        type="button"
        onClick={reveal}
        className="inline-flex min-h-8 items-center gap-1 rounded-full bg-[var(--md-sys-color-surface)] px-3 text-xs font-medium text-[var(--md-sys-color-on-surface)] shadow-sm hover:bg-[var(--md-sys-color-surface-container-high)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--md-sys-color-primary)]"
      >
        <Crosshair className="h-3.5 w-3.5" aria-hidden="true" />
        {t("revealError")}
      </button>
    </span>
  )
}
