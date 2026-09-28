"use client"

import { useEffect, useState } from "react"
import { FolderOpen, LoaderCircle, Play, Trash2 } from "lucide-react"
import type { Journey } from "@/lib/journey/types"
import { getPathSteps } from "@/lib/journey/tree"
import { encodeSharedPath, listSavedJourneys, restoreSavedJourney, takeSavedJourney } from "@/lib/journey/serialize"
import { ToastAction } from "@/components/ui/toast"
import { copyTextToClipboard } from "@/lib/clipboard"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { JOURNEY_DIALOG_CLASS } from "./dialog-style"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { useTranslations } from "@/hooks/use-translations"
import { zhJourney } from "@/lib/translations/zh-namespaces/journey"
import { useToast } from "@/hooks/use-toast"
import { RunStatus } from "./RunStatus"
import type { TemplateRunProgress } from "./TemplateStage"

const DIALOG_CLASS = `max-w-md ${JOURNEY_DIALOG_CLASS}`
const PRIMARY_BUTTON =
  "rounded-full bg-[var(--md-sys-color-primary)] px-6 text-[var(--md-sys-color-on-primary)] hover:bg-[var(--md-sys-color-primary)]/90"

interface DialogBaseProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const MAX_SHARED_INPUT_CHARS = 2048

interface InputDialogProps extends DialogBaseProps {
  fileInput: boolean
  running: boolean
  /** 正在运行的步骤；对话框是模态的，页面上的取消按钮点不到，所以这里也放一份 */
  progress?: TemplateRunProgress | null
  onCancel?: () => void
  onRun: (value: string | File) => void
}

/** 换输入的对话框：文本或文件，运行时显示进度与取消。页面按原节点重算所有分支 */
function InputDialog({
  open,
  onOpenChange,
  title,
  hint,
  runLabel,
  placeholder,
  initialText = "",
  fileInput,
  running,
  progress,
  onCancel,
  onRun,
}: InputDialogProps & { title: string; hint: string; runLabel: string; placeholder?: string; initialText?: string }) {
  const t = useTranslations("journey", zhJourney)
  const [text, setText] = useState("")
  const [file, setFile] = useState<File | null>(null)

  useEffect(() => {
    if (open) {
      setText(initialText)
    } else {
      setText("")
      setFile(null)
    }
  }, [open, initialText])

  const value = fileInput ? file : text
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={DIALOG_CLASS}>
        <DialogHeader>
          <DialogTitle className="text-[var(--md-sys-color-on-surface)]">{title}</DialogTitle>
          <DialogDescription className="text-[var(--md-sys-color-on-surface-variant)]">{hint}</DialogDescription>
        </DialogHeader>
        {fileInput ? (
          <label className="space-y-2 text-sm">
            <span className="block">{t("uploadFile")}</span>
            <input type="file" aria-label={t("uploadFile")} disabled={running} className="block max-w-full text-sm" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
          </label>
        ) : (
          <Textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder={placeholder}
            aria-label={title}
            rows={6}
            className="rounded-2xl border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container-highest)] font-mono text-sm text-[var(--md-sys-color-on-surface)] placeholder:text-[var(--md-sys-color-on-surface-variant)]/60"
          />
        )}
        {running && progress && onCancel && <RunStatus progress={progress} onCancel={onCancel} />}
        <Button onClick={() => value && onRun(value)} disabled={!value || (typeof value === "string" && !value.trim()) || running} className={PRIMARY_BUTTON}>
          {running ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          {runLabel}
        </Button>
      </DialogContent>
    </Dialog>
  )
}

/** 输入（文件、超过 64K 的文本）不随保存恢复时，让用户重新提供同一份输入 */
export function RestoreInputDialog(props: InputDialogProps) {
  const t = useTranslations("journey", zhJourney)
  return <InputDialog {...props} title={t("restoreInputTitle")} hint={t("restoreInputHint")} runLabel={t("restoreInputRun")} />
}

/**
 * “应用到新数据”与根节点的“编辑输入”：换掉输入，按原来的步骤重算整棵树。
 * 以前只回放当前路径并另建一条单链，其他分支全部丢失。
 */
export function ReplayDialog({
  stepCount,
  editing = false,
  initialText = "",
  ...props
}: InputDialogProps & { stepCount: number; editing?: boolean; initialText?: string }) {
  const t = useTranslations("journey", zhJourney)
  return (
    <InputDialog
      {...props}
      title={t(editing ? "editInput" : "replayTitle")}
      hint={t("replayHint").replace("{count}", String(stepCount))}
      runLabel={t("replayRun")}
      placeholder={t("replayPlaceholder")}
      initialText={editing ? initialText : ""}
    />
  )
}

/** 覆盖当前旅程前的二次确认;嵌在原对话框里,取消就回到原来的内容而不是关掉整个对话框 */
function ReplaceCurrentConfirm({
  description,
  confirmLabel,
  onCancel,
  onConfirm,
}: {
  description: string
  confirmLabel: string
  onCancel: () => void
  onConfirm: () => void
}) {
  const t = useTranslations("journey", zhJourney)

  return (
    <div role="alert" className="space-y-4">
      <p className="rounded-2xl bg-[var(--md-sys-color-error-container)]/50 p-3 text-sm leading-relaxed text-[var(--md-sys-color-on-error-container)]">
        {description}
      </p>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button
          variant="outline"
          onClick={onCancel}
          className="rounded-full border-[var(--md-sys-color-outline-variant)] px-6"
        >
          {t("cancel")}
        </Button>
        <Button onClick={onConfirm} className={PRIMARY_BUTTON}>
          {confirmLabel}
        </Button>
      </div>
    </div>
  )
}

export function ShareDialog({ open, onOpenChange, journey }: DialogBaseProps & { journey: Journey }) {
  const t = useTranslations("journey", zhJourney)
  const { toast } = useToast()
  const [includeInput, setIncludeInput] = useState(false)

  const rootValue = journey.nodes[journey.rootId]?.value
  const canIncludeInput =
    typeof rootValue === "string" && rootValue.length > 0 && rootValue.length <= MAX_SHARED_INPUT_CHARS
  const steps = getPathSteps(journey, journey.activeId)

  useEffect(() => {
    if (!open) setIncludeInput(false)
  }, [open])

  const handleShare = async () => {
    try {
      const encoded = encodeSharedPath(
        journey.name,
        steps,
        includeInput && canIncludeInput ? (rootValue as string) : undefined,
      )
      if (!encoded) {
        toast({ title: t("shareTooLarge"), variant: "destructive" })
        return
      }
      const url = `${window.location.origin}/journey#${encoded}`
      if (!(await copyTextToClipboard(url))) throw new Error("clipboard unavailable")
      toast({ title: t("shareCopied") })
      onOpenChange(false)
    } catch {
      toast({ title: t("shareFailed"), variant: "destructive" })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={DIALOG_CLASS}>
        <DialogHeader>
          <DialogTitle className="text-[var(--md-sys-color-on-surface)]">{t("shareJourney")}</DialogTitle>
          <DialogDescription className="text-[var(--md-sys-color-on-surface-variant)]">
            {t("stepCount").replace("{count}", String(steps.length))}
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center justify-between gap-3 rounded-2xl bg-[var(--md-sys-color-surface-container-high)] p-3">
          <Label
            htmlFor="journey-share-include"
            className="text-sm leading-snug text-[var(--md-sys-color-on-surface)]"
          >
            {t("shareIncludeInput")}
          </Label>
          <Switch
            id="journey-share-include"
            checked={includeInput && canIncludeInput}
            onCheckedChange={setIncludeInput}
            disabled={!canIncludeInput}
          />
        </div>
        <Button onClick={handleShare} disabled={steps.length === 0} className={PRIMARY_BUTTON}>
          {t("shareJourney")}
        </Button>
      </DialogContent>
    </Dialog>
  )
}

export function OpenJourneyDialog({
  open,
  onOpenChange,
  onLoad,
  isCurrentSaved,
}: DialogBaseProps & { onLoad: (name: string) => void; isCurrentSaved: () => boolean }) {
  const t = useTranslations("journey", zhJourney)
  const { toast } = useToast()
  const [names, setNames] = useState<string[]>([])
  // 待确认覆盖的存档名;null 时显示列表
  const [confirming, setConfirming] = useState<string | null>(null)

  useEffect(() => {
    if (open) setNames(listSavedJourneys())
    else setConfirming(null)
  }, [open])

  const handlePick = (name: string) => {
    if (isCurrentSaved()) onLoad(name)
    else setConfirming(name)
  }

  // 一点即删,但提示里可以撤销:存档只在本机,删了就找不回来
  const handleDelete = (name: string) => {
    const removed = takeSavedJourney(name)
    setNames(listSavedJourneys())
    if (!removed) return
    toast({
      title: t("savedDeleted").replace("{name}", name),
      duration: 8000,
      action: (
        <ToastAction altText={t("undo")} onClick={() => { if (restoreSavedJourney(name, removed)) setNames(listSavedJourneys()) }}>
          {t("undo")}
        </ToastAction>
      ),
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={DIALOG_CLASS}>
        <DialogHeader>
          <DialogTitle className="text-[var(--md-sys-color-on-surface)]">{t("loadJourneyTitle")}</DialogTitle>
        </DialogHeader>
        {confirming !== null ? (
          <ReplaceCurrentConfirm
            description={t("confirmOpenDescription").replace("{name}", confirming)}
            confirmLabel={t("replaceAndOpen")}
            onCancel={() => setConfirming(null)}
            onConfirm={() => onLoad(confirming)}
          />
        ) : names.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-6 text-sm text-[var(--md-sys-color-on-surface-variant)]">
            <FolderOpen className="h-6 w-6" aria-hidden />
            {t("noSavedJourneys")}
          </div>
        ) : (
          <div className="max-h-[50vh] space-y-1 overflow-y-auto pr-1">
            {names.map((name) => (
              <div key={name} className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handlePick(name)}
                  title={t("loadJourneyTitle")}
                  className="min-w-0 flex-1 truncate rounded-2xl px-3 py-2.5 text-left text-sm text-[var(--md-sys-color-on-surface)] transition-colors hover:bg-[var(--md-sys-color-surface-container-high)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--md-sys-color-primary)]"
                >
                  {name}
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(name)}
                  aria-label={t("deleteSaved")}
                  title={t("deleteSaved")}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[var(--md-sys-color-on-surface-variant)] transition-colors hover:bg-[var(--md-sys-color-error-container)]/60 hover:text-[var(--md-sys-color-error)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--md-sys-color-error)]"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

export function ConfirmOverwriteDialog({
  open,
  onOpenChange,
  name,
  onConfirm,
}: DialogBaseProps & { name: string; onConfirm: () => void }) {
  const t = useTranslations("journey", zhJourney)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={DIALOG_CLASS}>
        <DialogHeader>
          <DialogTitle className="text-[var(--md-sys-color-on-surface)]">{t("confirmOverwriteTitle")}</DialogTitle>
          <DialogDescription className="text-[var(--md-sys-color-on-surface-variant)]">
            {t("confirmOverwriteDescription").replace("{name}", name)}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="rounded-full border-[var(--md-sys-color-outline-variant)] px-6"
          >
            {t("cancel")}
          </Button>
          <Button onClick={onConfirm} className={PRIMARY_BUTTON}>
            {t("overwrite")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function ConfirmNewDialog({
  open,
  onOpenChange,
  onConfirm,
}: DialogBaseProps & { onConfirm: () => void }) {
  const t = useTranslations("journey", zhJourney)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={DIALOG_CLASS}>
        <DialogHeader>
          <DialogTitle className="text-[var(--md-sys-color-on-surface)]">{t("confirmNewTitle")}</DialogTitle>
          <DialogDescription className="text-[var(--md-sys-color-on-surface-variant)]">
            {t("confirmNewDescription")}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="rounded-full border-[var(--md-sys-color-outline-variant)] px-6"
          >
            {t("cancel")}
          </Button>
          <Button onClick={onConfirm} className={PRIMARY_BUTTON}>
            {t("confirm")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
