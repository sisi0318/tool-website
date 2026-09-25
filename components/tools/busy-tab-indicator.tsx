"use client"

import { useMemo, useState } from "react"
import { Loader2 } from "lucide-react"
import { useTranslations } from "@/hooks/use-translations"

/**
 * 同一页面里用子标签切换的几个面板（OCR 的图片 / PDF / 批量，PDF 的页面 / 图片 / OCR）
 * 在后台继续处理时，在标签上显示进行中。reporters 的函数引用稳定，可以直接放进面板的 effect 依赖。
 */
export function useBusyModes<Mode extends string>(modes: readonly Mode[]) {
  const [busy, setBusy] = useState<Partial<Record<Mode, boolean>>>({})
  const reporters = useMemo(
    () => Object.fromEntries(modes.map((mode) => [
      mode,
      (value: boolean) => setBusy((previous) => (Boolean(previous[mode]) === value ? previous : { ...previous, [mode]: value })),
    ])) as Record<Mode, (value: boolean) => void>,
    // 模式列表是模块级常量
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
  return { busy, reporters }
}

export function BusyTabIndicator({ busy }: { busy?: boolean }) {
  const t = useTranslations("common")
  if (!busy) return null
  return (
    <>
      <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin text-[var(--md-sys-color-primary)]" />
      <span className="sr-only">{t("runningInBackground")}</span>
    </>
  )
}
