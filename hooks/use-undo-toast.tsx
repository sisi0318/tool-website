"use client"

import { useCallback } from "react"
import { ToastAction } from "@/components/ui/toast"
import { useToast } from "@/hooks/use-toast"
import { useTranslations } from "@/hooks/use-translations"

/** 撤销提示的停留时间；要等撤销窗口过去才释放资源的调用方（如关闭标签）以此为准 */
export const UNDO_TOAST_MS = 8000

/**
 * 整段覆盖或移除用户内容之后，弹出带“撤销”按钮的提示。
 * 调用方先留好旧值，在 undo 里写回；原本就没有内容可丢时不要弹。
 */
export function useUndoToast() {
  const { toast } = useToast()
  const t = useTranslations("common")

  return useCallback(
    (title: string, undo: () => void) => {
      toast({
        title,
        duration: UNDO_TOAST_MS,
        action: <ToastAction altText={t("undo")} onClick={undo}>{t("undo")}</ToastAction>,
      })
    },
    [t, toast],
  )
}
