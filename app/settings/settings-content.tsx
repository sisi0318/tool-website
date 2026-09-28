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
import { zhSettings } from "@/lib/translations/zh-namespaces/settings"
import { clearAppCaches, readAppCacheUsage, type AppCacheUsage } from "@/lib/storage/cache-storage"
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
  const t = useTranslations("settings", zhSettings)
  const { toast } = useToast()
  const [usage, setUsage] = useState<StorageGroupUsage[] | null>(null)
  const [pending, setPending] = useState<StorageGroupId | "all" | "cache" | null>(null)
  const [cacheUsage, setCacheUsage] = useState<AppCacheUsage[]>([]), [cacheError, setCacheError] = useState(false), [clearing, setClearing] = useState(false)

  // localStorage 只在浏览器里有，首帧留空避免 hydration 不一致
  const refresh = useCallback(async () => {
    setUsage(readStorageUsage())
    try { setCacheUsage(await readAppCacheUsage()); setCacheError(false) } catch { setCacheError(true) }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const totalBytes = (usage ?? []).reduce((sum, item) => sum + item.bytes, 0)

  const handleClear = async () => {
    if (!pending || clearing) return
    setClearing(true)
    const removed = pending === "cache" ? 0 : clearAppStorage(pending === "all" ? undefined : [pending])
    try {
      const cacheCount = pending === "all" || pending === "cache" ? await clearAppCaches() : pending === "tools" ? await clearAppCaches(true) : 0
      toast(removed + cacheCount > 0 ? { title: t("cleared").replace("{count}", String(removed + cacheCount)) } : { title: t("clearFailed"), variant: "destructive" })
    } catch { toast({ title: t("cacheClearFailed"), variant: "destructive" }) }
    finally { setPending(null); setClearing(false); await refresh() }
  }

  const pendingGroupLabel =
    pending === "cache" ? t("cacheTitle") : pending && pending !== "all" ? t(GROUP_LABEL_KEYS[pending]) : ""

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

        {usage !== null && usage.length === 0 && cacheUsage.length === 0 && !cacheError ? (
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

            {(cacheUsage.length > 0 || cacheError) && <section className="mt-4 space-y-3 rounded-2xl border border-md-outline-variant bg-md-surface-container-lowest p-5"><h2 className="font-semibold">{t("cacheTitle")}</h2><p className="text-sm text-md-on-surface-variant">{t("cacheHint")}</p>{cacheError && <p role="alert" className="text-sm text-md-error">{t("cacheReadFailed")}</p>}<ul className="space-y-2 text-sm">{cacheUsage.map(cache => <li key={cache.name} className="flex flex-wrap justify-between gap-2"><span>{t(cache.queryData ? "queryCache" : cache.name === "ocr-public-models" ? "ocrCache" : cache.name === "pdf-viewer-assets" ? "pdfCache" : cache.name === "image-vectorizer-assets" ? "vectorCache" : "siteCache")}</span><span className="text-md-on-surface-variant">{t("keysCount").replace("{count}", String(cache.entries))}</span></li>)}</ul><Button variant="outline" disabled={clearing} onClick={() => setPending("cache")}>{t("clearCaches")}</Button></section>}

            <Button
              variant="outline"
              onClick={() => setPending("all")}
              disabled={clearing}
              className="mt-6 rounded-full border-[var(--md-sys-color-error)] text-[var(--md-sys-color-error)] hover:bg-[var(--md-sys-color-error-container)]/40"
            >
              <Trash2 className="h-4 w-4" />
              {t("clearAll")}
            </Button>
          </>
        )}
      </div>

      <Dialog open={pending !== null} onOpenChange={(open) => !open && !clearing && setPending(null)}>
        <DialogContent className="max-w-md rounded-3xl border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container-low)]">
          <DialogHeader>
            <DialogTitle className="text-[var(--md-sys-color-on-surface)]">
              {t("confirmTitle")}
            </DialogTitle>
            <DialogDescription className="text-[var(--md-sys-color-on-surface-variant)]">
              {pending === "cache" ? t("cacheConfirm") : pending === "all"
                ? t("confirmAll")
                : t("confirmGroup").replace("{group}", pendingGroupLabel)}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" disabled={clearing} onClick={() => setPending(null)} className="rounded-full">
              {t("cancel")}
            </Button>
            <Button
              onClick={() => void handleClear()}
              disabled={clearing}
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
