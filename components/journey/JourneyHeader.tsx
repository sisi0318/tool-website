"use client"

import { FilePlus2, FolderOpen, LayoutTemplate, MoreHorizontal, Repeat2, Save, Share2, Workflow } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { useTranslations } from "@/hooks/use-translations"
import { zhJourney } from "@/lib/translations/zh-namespaces/journey"
import { zhWorkflowTemplates } from "@/lib/translations/zh-namespaces/workflowTemplates"

interface JourneyHeaderProps {
  name: string
  /** 有运行锁着界面时，改名和各项动作都先停用 */
  disabled: boolean
  onRename: (name: string) => void
  onReplay: () => void
  onShare: () => void
  onSave: () => void
  onOpen: () => void
  onNew: () => void
  onOpenInCanvas: () => void
  onTemplates: () => void
}

/**
 * 旅程的名字和动作。
 *
 * 以前是七个没有文字的图标排成一排，分不出主次，手机上还占掉一整行。
 * “套用到新数据”和“分享”是这个功能存在的理由，带着文字放在外面；其余收进菜单。
 */
export function JourneyHeader({ name, disabled, onRename, onReplay, onShare, onSave, onOpen, onNew, onOpenInCanvas, onTemplates }: JourneyHeaderProps) {
  const t = useTranslations("journey", zhJourney)
  const wt = useTranslations("workflowTemplates", zhWorkflowTemplates)

  return (
    <header className="flex flex-wrap items-center gap-2">
      <Input
        value={name}
        disabled={disabled}
        onChange={(event) => onRename(event.target.value)}
        aria-label={t("journeyName")}
        placeholder={t("namePlaceholder")}
        className="h-10 w-full min-w-0 flex-1 basis-full rounded-full bg-transparent px-3 text-base font-semibold text-[var(--md-sys-color-on-surface)] sm:basis-0"
      />
      <div className="flex items-center gap-1.5">
        <Button variant="outline" size="sm" onClick={onReplay} disabled={disabled} className="h-10 rounded-full px-4">
          <Repeat2 className="h-4 w-4" aria-hidden />
          {t("replayTitle")}
        </Button>
        <Button variant="outline" size="sm" onClick={onShare} disabled={disabled} className="h-10 rounded-full px-4">
          <Share2 className="h-4 w-4" aria-hidden />
          {t("shareJourney")}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" disabled={disabled} aria-label={t("moreActions")} title={t("moreActions")} className="h-10 w-10 rounded-full">
              <MoreHorizontal className="h-5 w-5" aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={onSave}><Save className="mr-2 h-4 w-4" aria-hidden />{t("saveJourney")}</DropdownMenuItem>
            <DropdownMenuItem onSelect={onOpen}><FolderOpen className="mr-2 h-4 w-4" aria-hidden />{t("loadJourneyTitle")}</DropdownMenuItem>
            <DropdownMenuItem onSelect={onNew}><FilePlus2 className="mr-2 h-4 w-4" aria-hidden />{t("newJourney")}</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onOpenInCanvas}><Workflow className="mr-2 h-4 w-4" aria-hidden />{t("openInCanvas")}</DropdownMenuItem>
            <DropdownMenuItem onSelect={onTemplates}><LayoutTemplate className="mr-2 h-4 w-4" aria-hidden />{wt("title")}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
