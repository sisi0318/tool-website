"use client"

import { useCallback, useEffect, useRef } from "react"
import { useToolActivity } from "@/components/tool-activity"
import { useToolRuntimeParams } from "@/components/tool-runtime-params"
import { useWorkspace } from "@/components/workspace-context"
import { useToast } from "@/hooks/use-toast"
import { useTranslations } from "@/hooks/use-translations"
import { receiveTransfer, toolTransferIdFromHash, type ToolTransfer } from "@/lib/tool-transfer"

/** 同一次页面会话里已经取过的句柄：组件重新挂载（如撤销关闭标签）时不再重复取、也不误报过期 */
const consumed = new Set<string>()

/**
 * 接收其它工具发来的数据（“继续处理 → 在工具中打开”）。
 * - 工作台：句柄在标签的运行时参数 `handoff` 里；
 * - 独立页：`/tools/<id>#handoff=<id>`，读完立即从地址栏去掉。
 * 只有活动的工具或面板接收，页内多个面板不会抢同一份数据。
 */
export function useIncomingInput(onTransfer: (transfer: ToolTransfer) => void) {
  const params = useToolRuntimeParams()
  const workspace = useWorkspace()
  const active = useToolActivity()
  const { toast } = useToast()
  const t = useTranslations("toolTransfer")
  const handlerRef = useRef(onTransfer)
  useEffect(() => {
    handlerRef.current = onTransfer
  })

  const consume = useCallback(async (id: string) => {
    if (consumed.has(id)) return
    consumed.add(id)
    const transfer = await receiveTransfer(id)
    if (transfer) handlerRef.current(transfer)
    else toast({ title: t("transferExpired"), variant: "destructive" })
  }, [t, toast])

  const handoff = params?.handoff
  useEffect(() => {
    if (active && handoff) void consume(handoff)
  }, [active, handoff, consume])

  useEffect(() => {
    if (!active || workspace) return
    const read = () => {
      const id = toolTransferIdFromHash(window.location.hash)
      if (!id) return
      window.history.replaceState(window.history.state, "", `${window.location.pathname}${window.location.search}`)
      void consume(id)
    }
    read()
    window.addEventListener("hashchange", read)
    return () => window.removeEventListener("hashchange", read)
  }, [active, workspace, consume])
}
