"use client"

import type { ReactNode } from "react"
import { Check, Copy, Cpu, Fingerprint, Globe, Monitor, Shield } from "lucide-react"

import { JsonTreeView } from "@/components/json-tree-view"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useI18n } from "@/components/i18n-provider"
import { useTranslations } from "@/hooks/use-translations"
import type { DeviceFingerprint, FingerprintSignal, FingerprintSignalStatus } from "@/lib/device-fingerprint"

interface DeviceFingerprintPanelProps {
  fingerprint: DeviceFingerprint
  copied: Record<string, boolean>
  showDetails: boolean
  onCopy: (text: string, key: string) => void
}

const STATUS_META: Record<FingerprintSignalStatus, { labelKey: string; className: string }> = {
  ready: {
    labelKey: "statusReady",
    className: "bg-[var(--md-sys-color-primary-container)] text-[var(--md-sys-color-on-primary-container)]",
  },
  limited: {
    labelKey: "statusLimited",
    className: "bg-[var(--md-sys-color-tertiary-container)] text-[var(--md-sys-color-on-tertiary-container)]",
  },
  unsupported: {
    labelKey: "statusUnsupported",
    className: "bg-[var(--md-sys-color-surface-container-high)] text-[var(--md-sys-color-on-surface-variant)]",
  },
  blocked: {
    labelKey: "statusBlocked",
    className: "bg-[var(--md-sys-color-error-container)] text-[var(--md-sys-color-on-error-container)]",
  },
  error: {
    labelKey: "statusError",
    className: "bg-[var(--md-sys-color-error-container)] text-[var(--md-sys-color-on-error-container)]",
  },
}

function formatFingerprintId(id: string, unavailableLabel: string): string {
  if (!id || id === "unavailable") return unavailableLabel
  return id.slice(0, 32).match(/.{1,8}/g)?.join("-") ?? id.slice(0, 32)
}

interface SignalCardProps {
  id: string
  title: string
  icon: ReactNode
  signal: FingerprintSignal
  copied: boolean
  showDetails: boolean
  onCopy: (text: string, key: string) => void
  children?: ReactNode
  details?: ReactNode
}

function SignalCard({ id, title, icon, signal, copied, showDetails, onCopy, children, details }: SignalCardProps) {
  const t = useTranslations("device")
  const status = STATUS_META[signal.status]
  const noteKey = `fingerprintNotes.${signal.note}`
  const translatedNote = t(noteKey)
  const note = (translatedNote === `device.${noteKey}` ? signal.note : translatedNote)
    .replace("{count}", String(signal.noteValue ?? 0))

  return (
    <Card
      data-testid={`fingerprint-signal-${id}`}
      className="min-w-0 rounded-2xl border-[var(--md-sys-color-outline-variant)]/70 bg-[var(--md-sys-color-surface-container-lowest)]"
    >
      <CardHeader className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-2 gap-y-1 p-4 pb-3 sm:p-5 sm:pb-3">
        <span className="row-span-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--md-sys-color-secondary-container)] text-[var(--md-sys-color-on-secondary-container)]">
          {icon}
        </span>
        <CardTitle className="min-w-0 self-end text-base leading-5">{title}</CardTitle>
        <Badge className={`col-start-2 row-start-2 w-fit shrink-0 border-0 text-[11px] ${status.className}`}>
          {t(status.labelKey)}
        </Badge>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={!signal.digest}
          onClick={() => signal.digest && onCopy(signal.digest, `${id}Fingerprint`)}
          aria-label={(copied ? t("copiedDigestAria") : t("copyDigestAria")).replace("{title}", title)}
          className="col-start-3 row-span-2 row-start-1 h-10 w-10 shrink-0 rounded-full"
        >
          {copied ? <Check className="h-4 w-4 text-[var(--md-sys-color-primary)]" /> : <Copy className="h-4 w-4" />}
        </Button>
      </CardHeader>
      <CardContent className="space-y-3 p-4 pt-0 sm:p-5 sm:pt-0">
        {signal.previewUrl && (
          <img
            src={signal.previewUrl}
            alt={t("canvasPreviewAlt")}
            className="h-auto max-h-20 w-full rounded-xl border border-[var(--md-sys-color-outline-variant)] object-cover"
          />
        )}
        <div className="min-w-0 rounded-xl bg-[var(--md-sys-color-surface-container-low)] px-3 py-2">
          <code className="block break-all text-xs leading-5 text-[var(--md-sys-color-on-surface)]">
            {signal.digest ?? t("noDigest")}
          </code>
        </div>
        <p className="text-xs leading-5 text-[var(--md-sys-color-on-surface-variant)]">{note}</p>
        {children}
        {showDetails && signal.raw && (
          <details className="rounded-xl border border-[var(--md-sys-color-outline-variant)]/70">
            <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-[var(--md-sys-color-on-surface-variant)]">
              {t("showRawDetails")}
            </summary>
            <div
              className="max-h-[min(24rem,60dvh)] min-w-0 touch-pan-y overflow-auto overscroll-contain border-t border-[var(--md-sys-color-outline-variant)] p-3 [-webkit-overflow-scrolling:touch]"
              tabIndex={0}
            >
              {details ?? <pre className="whitespace-pre-wrap break-all text-xs leading-5">{signal.raw}</pre>}
            </div>
          </details>
        )}
      </CardContent>
    </Card>
  )
}

export function DeviceFingerprintPanel({ fingerprint, copied, showDetails, onCopy }: DeviceFingerprintPanelProps) {
  const t = useTranslations("device")
  const { locale } = useI18n()
  const { signals } = fingerprint
  const collectedTime = Number.isNaN(Date.parse(fingerprint.collectedAt))
    ? t("unknown")
    : new Date(fingerprint.collectedAt).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit", second: "2-digit" })

  return (
    <div className="min-w-0 space-y-3 sm:space-y-4">
      <Card
        data-testid="fingerprint-summary"
        className="min-w-0 overflow-hidden rounded-2xl border-[var(--md-sys-color-primary)]/25 bg-[var(--md-sys-color-primary-container)]/30"
      >
        <CardContent className="space-y-3 p-4 sm:p-5">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--md-sys-color-primary-container)] text-[var(--md-sys-color-on-primary-container)]">
              <Fingerprint className="h-6 w-6" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="font-bold text-[var(--md-sys-color-on-surface)]">{t("compositeFingerprint")}</h2>
              <p className="mt-0.5 text-xs text-[var(--md-sys-color-on-surface-variant)]">
                {t("collectedLocally")} · {collectedTime}
              </p>
              <Badge variant="secondary" className="mt-2 w-fit">
                {fingerprint.readySignals}/{fingerprint.totalSignals} {t("signals")}
              </Badge>
            </div>
          </div>

          <div className="flex min-w-0 items-center gap-2 rounded-xl bg-[var(--md-sys-color-surface-container-lowest)] p-2 pl-3">
            <code className="min-w-0 flex-1 truncate text-xs font-semibold tracking-wide" title={fingerprint.id}>
              {formatFingerprintId(fingerprint.id, t("fingerprintUnavailable"))}
            </code>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={fingerprint.id === "unavailable"}
              onClick={() => onCopy(fingerprint.id, "compositeFingerprint")}
              aria-label={copied.compositeFingerprint ? t("compositeCopiedAria") : t("copyCompositeAria")}
              className="h-10 w-10 shrink-0 rounded-full"
            >
              {copied.compositeFingerprint ? <Check className="h-4 w-4 text-[var(--md-sys-color-primary)]" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>

          <p className="text-xs leading-5 text-[var(--md-sys-color-on-surface-variant)]">
            {t("fingerprintPrivacyNotice")}
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2">
        <SignalCard
          id="canvas"
          title="Canvas"
          icon={<Fingerprint className="h-4 w-4" />}
          signal={signals.canvas}
          copied={Boolean(copied.canvasFingerprint)}
          showDetails={showDetails}
          onCopy={onCopy}
        />
        <SignalCard
          id="webGL"
          title="WebGL"
          icon={<Cpu className="h-4 w-4" />}
          signal={signals.webGL}
          copied={Boolean(copied.webGLFingerprint)}
          showDetails={showDetails}
          onCopy={onCopy}
        />
        <SignalCard
          id="audio"
          title={t("offlineAudio")}
          icon={<Shield className="h-4 w-4" />}
          signal={signals.audio}
          copied={Boolean(copied.audioFingerprint)}
          showDetails={showDetails}
          onCopy={onCopy}
        />
        <SignalCard
          id="fonts"
          title={t("fontsLabel")}
          icon={<Monitor className="h-4 w-4" />}
          signal={signals.fonts}
          copied={Boolean(copied.fontsFingerprint)}
          showDetails={showDetails}
          onCopy={onCopy}
        >
          {signals.fonts.values.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {signals.fonts.values.slice(0, 6).map((font) => (
                <span key={font} className="rounded-full bg-[var(--md-sys-color-secondary-container)] px-2 py-1 text-[11px] text-[var(--md-sys-color-on-secondary-container)]">
                  {font}
                </span>
              ))}
              {signals.fonts.values.length > 6 && (
                <span className="rounded-full bg-[var(--md-sys-color-surface-container-high)] px-2 py-1 text-[11px]">
                  +{signals.fonts.values.length - 6}
                </span>
              )}
            </div>
          )}
        </SignalCard>
        <div className="sm:col-span-2">
          <SignalCard
            id="navigator"
            title={t("browserEnvironment")}
            icon={<Globe className="h-4 w-4" />}
            signal={signals.navigator}
            copied={Boolean(copied.navigatorFingerprint)}
            showDetails={showDetails}
            onCopy={onCopy}
            details={signals.navigator.raw ? <JsonTreeView jsonText={signals.navigator.raw} indentSize={2} rootLabel="navigator" /> : undefined}
          />
        </div>
      </div>
    </div>
  )
}
