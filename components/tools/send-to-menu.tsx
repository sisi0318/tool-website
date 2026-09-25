"use client"

import dynamic from "next/dynamic"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { AppWindow, ArrowRight, ListTree, Workflow } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { useWorkspace } from "@/components/workspace-context"
import { useTranslations } from "@/hooks/use-translations"
import { useToast } from "@/hooks/use-toast"
import { useOpenInTool } from "@/hooks/use-open-in-tool"
import { offerTransferToOtherTabs, toolTransfers, toolTransferUrl, ToolTransferError, transferKind } from "@/lib/tool-transfer"

const SendToToolDialog = dynamic(() => import("./send-to-tool-dialog"), { ssr: false })
const ToolPagePicker = dynamic(() => import("./tool-page-picker"), { ssr: false })

export function SendToMenu({ value, source, filename, disabled = false, compact = false }: {
  value: unknown; source: string; filename?: string; disabled?: boolean; compact?: boolean
}) {
  const t = useTranslations("toolTransfer")
  const router = useRouter()
  const workspace = useWorkspace()
  const { toast } = useToast()
  const [choosing, setChoosing] = useState<"tool-page" | "journey-step" | null>(null)
  const openToolWith = useOpenInTool()

  const put = (targetTool?: string) => {
    try {
      return toolTransfers.put(value, source, targetTool, filename)
    } catch (error) {
      toast({ title: t(error instanceof ToolTransferError ? error.code : "failed"), variant: "destructive" })
      return null
    }
  }

  // 在某个工具页打开：工作台里就地开一个标签，独立页跳过去。以前只能发往旅程，而且会离开工作台
  const openInTool = (toolId: string) => {
    setChoosing(null)
    openToolWith(toolId, value, source, filename)
  }

  // 发往旅程。工作台里改在新的浏览器标签打开，工作台里各标签的输入和结果都保留；
  // 数据留在本页内存，由新标签通过 BroadcastChannel 取走
  const sendToJourney = (targetTool?: string) => {
    setChoosing(null)
    const id = put(targetTool)
    if (!id) return
    const url = toolTransferUrl(id)
    if (window.location.pathname === "/journey") {
      window.location.hash = url.slice(url.indexOf("#"))
      return
    }
    if (workspace) {
      offerTransferToOtherTabs(id)
      const opened = window.open(url, "_blank")
      if (opened) {
        opened.opener = null
        toast({ title: t("journeyOpenedInNewTab") })
        return
      }
    }
    router.push(url)
  }

  return <>
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" size={compact ? "icon" : "sm"} className={compact ? "h-8 w-8 shrink-0" : "shrink-0"} disabled={disabled} aria-label={`${t("continue")} · ${source}`} title={t("continue")}><ArrowRight className="h-4 w-4" />{!compact && t("continue")}</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => setChoosing("tool-page")}><AppWindow className="mr-2 h-4 w-4" />{t("openInTool")}</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => sendToJourney()}><Workflow className="mr-2 h-4 w-4" />{t("journey")}</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => setChoosing("journey-step")}><ListTree className="mr-2 h-4 w-4" />{t("chooseTool")}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
    {choosing === "tool-page" && <ToolPagePicker kind={transferKind(value)} onClose={() => setChoosing(null)} onPick={openInTool} />}
    {choosing === "journey-step" && <SendToToolDialog value={value} onClose={() => setChoosing(null)} onPick={sendToJourney} />}
  </>
}
