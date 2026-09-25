"use client"

import { useEffect } from "react"
import { useToast } from "@/hooks/use-toast"
import { useTranslations } from "@/hooks/use-translations"
import { CLIPBOARD_FAILURE_EVENT } from "@/lib/clipboard"

/** 全站统一的"复制失败"提示，见 lib/clipboard.ts */
export function ClipboardFailureNotifier() {
  const { toast } = useToast()
  const t = useTranslations("common")

  useEffect(() => {
    const notify = () => toast({ title: t("copyFailed"), description: t("copyFailedHint"), variant: "destructive" })
    window.addEventListener(CLIPBOARD_FAILURE_EVENT, notify)
    return () => window.removeEventListener(CLIPBOARD_FAILURE_EVENT, notify)
  }, [t, toast])

  return null
}
