"use client"

import { useCallback } from "react"
import { useRouter } from "next/navigation"
import { useWorkspace } from "@/components/workspace-context"
import { useToast } from "@/hooks/use-toast"
import { useTranslations } from "@/hooks/use-translations"
import { toolPageTransferUrl, toolTransfers, ToolTransferError } from "@/lib/tool-transfer"

/**
 * 带着数据打开另一个工具：工作台里就地开标签（不离开工作台），独立页跳到 /tools/<id>#handoff=。
 * 数据只放在内存里，URL 里只有一次性句柄。返回是否已发出。
 */
export function useOpenInTool() {
  const router = useRouter()
  const workspace = useWorkspace()
  const { toast } = useToast()
  const t = useTranslations("toolTransfer")

  return useCallback((toolId: string, value: unknown, source: string, filename?: string) => {
    let id: string
    try {
      id = toolTransfers.put(value, source, undefined, filename)
    } catch (error) {
      toast({ title: t(error instanceof ToolTransferError ? error.code : "failed"), variant: "destructive" })
      return false
    }
    if (workspace) workspace.openTool(toolId, { handoff: id })
    else router.push(toolPageTransferUrl(toolId, id))
    return true
  }, [router, t, toast, workspace])
}
