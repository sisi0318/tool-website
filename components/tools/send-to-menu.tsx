"use client"

import dynamic from "next/dynamic"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowRight, Workflow } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { useTranslations } from "@/hooks/use-translations"
import { useToast } from "@/hooks/use-toast"
import { toolTransfers, toolTransferUrl, ToolTransferError } from "@/lib/tool-transfer"

const SendToToolDialog = dynamic(() => import("./send-to-tool-dialog"), { ssr: false })

export function SendToMenu({ value, source, filename, disabled = false, compact = false }: {
  value: unknown; source: string; filename?: string; disabled?: boolean; compact?: boolean
}) {
  const t = useTranslations("toolTransfer")
  const router = useRouter()
  const { toast } = useToast()
  const [choosing, setChoosing] = useState(false)

  const send = (targetTool?: string) => {
    try {
      const id = toolTransfers.put(value, source, targetTool, filename)
      const url = toolTransferUrl(id)
      setChoosing(false)
      if (window.location.pathname === "/journey") window.location.hash = url.slice(url.indexOf("#"))
      else router.push(url)
    } catch (error) {
      toast({ title: t(error instanceof ToolTransferError ? error.code : "failed"), variant: "destructive" })
    }
  }

  return <>
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" size={compact ? "icon" : "sm"} className={compact ? "h-8 w-8 shrink-0" : "shrink-0"} disabled={disabled} aria-label={`${t("continue")} · ${source}`} title={t("continue")}><ArrowRight className="h-4 w-4" />{!compact && t("continue")}</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => send()}><Workflow className="mr-2 h-4 w-4" />{t("journey")}</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => setChoosing(true)}><ArrowRight className="mr-2 h-4 w-4" />{t("chooseTool")}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
    {choosing && <SendToToolDialog value={value} onClose={() => setChoosing(false)} onPick={send} />}
  </>
}
