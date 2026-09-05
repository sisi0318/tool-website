"use client"

import { useEffect, useState } from "react"
import { FolderOpen, LoaderCircle, Play, Trash2 } from "lucide-react"
import type { Journey } from "@/lib/journey/types"
import { getPathSteps } from "@/lib/journey/tree"
import { deleteJourney, encodeSharedPath, listSavedJourneys } from "@/lib/journey/serialize"
import { copyTextToClipboard } from "@/lib/clipboard"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { useTranslations } from "@/hooks/use-translations"
import { useToast } from "@/hooks/use-toast"

const DIALOG_CLASS =
  "max-w-md rounded-3xl border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container-low)]"
const PRIMARY_BUTTON =
  "rounded-full bg-[var(--md-sys-color-primary)] px-6 text-[var(--md-sys-color-on-primary)] hover:bg-[var(--md-sys-color-primary)]/90"

interface DialogBaseProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const MAX_SHARED_INPUT_CHARS = 2048

/** 覆盖当前旅程前的二次确认;嵌在原对话框里,取消就回到原来的内容而不是关掉整个对话框 */
function ReplaceCurrentConfirm({
  description,
  confirmLabel,
  running = false,
  onCancel,
  onConfirm,
}: {
  description: string
  confirmLabel: string
  running?: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  const t = useTranslations("journey")

  return (
    <div role="alert" className="space-y-4">
      <p className="rounded-2xl bg-[var(--md-sys-color-error-container)]/50 p-3 text-sm leading-relaxed text-[var(--md-sys-color-on-error-container)]">
        {description}
      </p>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button
          variant="outline"
          onClick={onCancel}
          disabled={running}
          className="rounded-full border-[var(--md-sys-color-outline-variant)] px-6"
        >
          {t("cancel")}
        </Button>
        <Button onClick={onConfirm} disabled={running} className={PRIMARY_BUTTON}>
          {running && <LoaderCircle className="h-4 w-4 animate-spin" />}
          {confirmLabel}
        </Button>
      </div>
    </div>
  )
}

export function ShareDialog({ open, onOpenChange, journey }: DialogBaseProps & { journey: Journey }) {
  const t = useTranslations("journey")
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
  const t = useTranslations("journey")
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

  const handleDelete = (name: string) => {
    deleteJourney(name)
    setNames(listSavedJourneys())
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

export function ReplayDialog({
  open,
  onOpenChange,
  stepCount,
  running,
  onRun,
  isCurrentSaved,
}: DialogBaseProps & {
  stepCount: number
  running: boolean
  onRun: (text: string) => void
  isCurrentSaved: () => boolean
}) {
  const t = useTranslations("journey")
  const [text, setText] = useState("")
  const [confirming, setConfirming] = useState(false)

  useEffect(() => {
    if (!open) {
      setText("")
      setConfirming(false)
    }
  }, [open])

  const handleRun = () => {
    if (isCurrentSaved()) onRun(text)
    else setConfirming(true)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={DIALOG_CLASS}>
        <DialogHeader>
          <DialogTitle className="text-[var(--md-sys-color-on-surface)]">{t("replayTitle")}</DialogTitle>
          <DialogDescription className="text-[var(--md-sys-color-on-surface-variant)]">
            {t("replayHint").replace("{count}", String(stepCount))}
          </DialogDescription>
        </DialogHeader>
        {confirming ? (
          <ReplaceCurrentConfirm
            description={t("confirmReplayDescription")}
            confirmLabel={t("replaceAndRun")}
            running={running}
            onCancel={() => setConfirming(false)}
            onConfirm={() => onRun(text)}
          />
        ) : (
          <>
            <Textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder={t("replayPlaceholder")}
              aria-label={t("replayTitle")}
              rows={5}
              className="rounded-2xl border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container-highest)] font-mono text-sm text-[var(--md-sys-color-on-surface)] placeholder:text-[var(--md-sys-color-on-surface-variant)]/60"
            />
            <Button onClick={handleRun} disabled={!text.trim() || running || stepCount === 0} className={PRIMARY_BUTTON}>
              {running ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              {t("replayRun")}
            </Button>
          </>
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
  const t = useTranslations("journey")

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
  const t = useTranslations("journey")

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
