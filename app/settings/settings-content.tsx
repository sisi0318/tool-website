"use client"

import { useCallback, useEffect, useState } from "react"
import { Database, ShieldAlert, Trash2 } from "lucide-react"

import Header from "@/components/header"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { useTranslations } from "@/hooks/use-translations"
import {
  STORAGE_ENTRIES,
  clearAppStorage,
  formatStorageSize,
  readStorageUsage,
  type StorageGroupId,
  type StorageGroupUsage,
} from "@/lib/storage/app-storage"

const GROUP_LABEL_KEYS: Record<StorageGroupId, string> = {
  workspace: "groupWorkspace",
  canvas: "groupCanvas",
  journey: "groupJourney",
  tools: "groupTools",
  preferences: "groupPreferences",
}

/** 同一组里可能有多条登记项，去重后按登记顺序展示 */
function describeGroup(group: StorageGroupId): string[] {
  const seen = new Set<string>()
  for (const entry of STORAGE_ENTRIES) {
    if (entry.group === group) seen.add(entry.descriptionKey)
  }
  return [...seen]
}

export function SettingsContent() {
  const t = useTranslations("settings")
  const { toast } = useToast()
  const [usage, setUsage] = useState<StorageGroupUsage[] | null>(null)
  const [pending, setPending] = useState<StorageGroupId | "all" | null>(null)

  // localStorage 只在浏览器里有，首帧留空避免 hydration 不一致
  const refresh = useCallback(() => setUsage(readStorageUsage()), [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const totalBytes = (usage ?? []).reduce((sum, item) => sum + item.bytes, 0)

  const handleClear = () => {
    if (!pending) return
    const removed = clearAppStorage(pending === "all" ? undefined : [pending])
    setPending(null)
    refresh()
    toast(
      removed > 0
        ? { title: t("cleared").replace("{count}", String(removed)) }
        : { title: t("clearFailed"), variant: "destructive" },
    )
  }

  const pendingGroupLabel =
    pending && pending !== "all" ? t(GROUP_LABEL_KEYS[pending]) : ""

  return (
    <div className="min-h-screen bg-[var(--md-sys-color-surface)]">
      <Header />

      <div className="container mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold tracking-tight text-[var(--md-sys-color-on-surface)]">
          {t("title")}
        </h1>
        <p className="mt-3 leading-7 text-[var(--md-sys-color-on-surface-variant)]">
          {t("description")}
        </p>

        {usage !== null && usage.length === 0 ? (
          <p className="mt-8 rounded-2xl bg-[var(--md-sys-color-surface-container-low)] p-6 text-center text-sm text-[var(--md-sys-color-on-surface-variant)]">
            {t("empty")}
          </p>
        ) : (
          <>
            <p className="mt-6 flex items-center gap-2 text-sm font-semibold text-[var(--md-sys-color-on-surface-variant)]">
              <Database className="h-4 w-4" aria-hidden />
              {t("totalUsage").replace("{size}", formatStorageSize(totalBytes))}
            </p>

            <ul className="mt-4 space-y-3">
              {(usage ?? []).map((item) => (
                <li
                  key={item.group}
                  className="rounded-2xl border border-[var(--md-sys-color-outline-variant)]/70 bg-[var(--md-sys-color-surface-container-lowest)] p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="flex flex-wrap items-center gap-2 font-semibold text-[var(--md-sys-color-on-surface)]">
                        {t(GROUP_LABEL_KEYS[item.group])}
                        {item.sensitive && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-[var(--md-sys-color-error-container)] px-2.5 py-0.5 text-xs font-semibold text-[var(--md-sys-color-on-error-container)]">
                            <ShieldAlert className="h-3 w-3" aria-hidden />
                            {t("sensitiveBadge")}
                          </span>
                        )}
                      </h2>
                      <p className="mt-1 text-xs text-[var(--md-sys-color-on-surface-variant)]">
                        {t("keysCount").replace("{count}", String(item.keys.length))} ·{" "}
                        {formatStorageSize(item.bytes)}
                      </p>
                      <ul className="mt-2 space-y-0.5 text-sm text-[var(--md-sys-color-on-surface-variant)]">
                        {describeGroup(item.group).map((descriptionKey) => (
                          <li key={descriptionKey}>· {t(descriptionKey)}</li>
                        ))}
                      </ul>
                      {item.sensitive && (
                        <p className="mt-2 text-xs text-[var(--md-sys-color-error)]">
                          {t("sensitiveHint")}
                        </p>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => setPending(item.group)}
                      className="shrink-0 rounded-full border-[var(--md-sys-color-outline-variant)]"
                    >
                      <Trash2 className="h-4 w-4" />
                      {t("clearGroup")}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>

            <Button
              variant="outline"
              onClick={() => setPending("all")}
              className="mt-6 rounded-full border-[var(--md-sys-color-error)] text-[var(--md-sys-color-error)] hover:bg-[var(--md-sys-color-error-container)]/40"
            >
              <Trash2 className="h-4 w-4" />
              {t("clearAll")}
            </Button>
          </>
        )}
      </div>

      <Dialog open={pending !== null} onOpenChange={(open) => !open && setPending(null)}>
        <DialogContent className="max-w-md rounded-3xl border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container-low)]">
          <DialogHeader>
            <DialogTitle className="text-[var(--md-sys-color-on-surface)]">
              {t("confirmTitle")}
            </DialogTitle>
            <DialogDescription className="text-[var(--md-sys-color-on-surface-variant)]">
              {pending === "all"
                ? t("confirmAll")
                : t("confirmGroup").replace("{group}", pendingGroupLabel)}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setPending(null)} className="rounded-full">
              {t("cancel")}
            </Button>
            <Button
              onClick={handleClear}
              className="rounded-full bg-[var(--md-sys-color-error)] text-[var(--md-sys-color-on-error)] hover:bg-[var(--md-sys-color-error)]/90"
            >
              {t("confirm")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
