"use client"

import type { ReactNode } from "react"
import { Check, Copy, Cpu, Fingerprint, Globe, Monitor, Shield } from "lucide-react"

import { JsonTreeView } from "@/components/json-tree-view"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { DeviceFingerprint, FingerprintSignal, FingerprintSignalStatus } from "@/lib/device-fingerprint"

interface DeviceFingerprintPanelProps {
  fingerprint: DeviceFingerprint
  copied: Record<string, boolean>
  showDetails: boolean
  onCopy: (text: string, key: string) => void
}

const STATUS_META: Record<FingerprintSignalStatus, { label: string; className: string }> = {
  ready: { label: "可用", className: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300" },
  limited: { label: "受限", className: "bg-amber-500/12 text-amber-700 dark:text-amber-300" },
  unsupported: { label: "不支持", className: "bg-slate-500/12 text-slate-700 dark:text-slate-300" },
  blocked: { label: "已阻止", className: "bg-orange-500/12 text-orange-700 dark:text-orange-300" },
  error: { label: "失败", className: "bg-red-500/12 text-red-700 dark:text-red-300" },
}

function formatFingerprintId(id: string): string {
  if (!id || id === "unavailable") return "暂不可用"
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
  const status = STATUS_META[signal.status]

  return (
    <Card data-testid={`fingerprint-signal-${id}`} className="min-w-0 rounded-2xl border-[var(--md-sys-color-outline-variant)]/70">
      <CardHeader className="flex-row items-center gap-2 space-y-0 p-4 pb-3 sm:p-5 sm:pb-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--md-sys-color-secondary-container)] text-[var(--md-sys-color-on-secondary-container)]">
          {icon}
        </span>
        <CardTitle className="min-w-0 flex-1 text-base">{title}</CardTitle>
        <Badge className={`shrink-0 border-0 text-[11px] ${status.className}`}>{status.label}</Badge>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={!signal.digest}
          onClick={() => signal.digest && onCopy(signal.digest, `${id}Fingerprint`)}
          aria-label={copied ? `${title}摘要已复制` : `复制${title}摘要`}
          className="h-10 w-10 shrink-0 rounded-full"
        >
          {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
        </Button>
      </CardHeader>
      <CardContent className="space-y-3 p-4 pt-0 sm:p-5 sm:pt-0">
        {signal.previewUrl && (
          <img
            src={signal.previewUrl}
            alt="Canvas 指纹渲染预览"
            className="h-auto max-h-20 w-full rounded-xl border border-[var(--md-sys-color-outline-variant)] object-cover"
          />
        )}
        <div className="min-w-0 rounded-xl bg-[var(--md-sys-color-surface-container-low)] px-3 py-2">
          <code className="block break-all text-xs leading-5 text-[var(--md-sys-color-on-surface)]">
            {signal.digest ?? "没有可用摘要"}
          </code>
        </div>
        <p className="text-xs leading-5 text-[var(--md-sys-color-on-surface-variant)]">{signal.note}</p>
        {children}
        {showDetails && signal.raw && (
          <details className="rounded-xl border border-[var(--md-sys-color-outline-variant)]/70">
            <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-[var(--md-sys-color-on-surface-variant)]">
              查看原始详情
            </summary>
            <div className="max-h-64 overflow-auto border-t border-[var(--md-sys-color-outline-variant)] p-3">
              {details ?? <pre className="whitespace-pre-wrap break-all text-xs leading-5">{signal.raw}</pre>}
            </div>
          </details>
        )}
      </CardContent>
    </Card>
  )
}

export function DeviceFingerprintPanel({ fingerprint, copied, showDetails, onCopy }: DeviceFingerprintPanelProps) {
  const { signals } = fingerprint
  const collectedTime = Number.isNaN(Date.parse(fingerprint.collectedAt))
    ? "未知"
    : new Date(fingerprint.collectedAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })

  return (
    <div className="space-y-3 sm:space-y-4">
      <Card data-testid="fingerprint-summary" className="overflow-hidden rounded-2xl border-indigo-500/25 bg-indigo-500/[0.05]">
        <CardContent className="space-y-3 p-4 sm:p-5">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-500/15 text-indigo-700 dark:text-indigo-300">
              <Fingerprint className="h-6 w-6" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="font-bold text-[var(--md-sys-color-on-surface)]">综合浏览器指纹</h2>
              <p className="mt-0.5 text-xs text-[var(--md-sys-color-on-surface-variant)]">
                本地采集 · {collectedTime}
              </p>
            </div>
            <Badge variant="secondary" className="shrink-0">
              {fingerprint.readySignals}/{fingerprint.totalSignals} 信号
            </Badge>
          </div>

          <div className="flex min-w-0 items-center gap-2 rounded-xl bg-[var(--md-sys-color-surface-container-lowest)] p-2 pl-3">
            <code className="min-w-0 flex-1 truncate text-xs font-semibold tracking-wide" title={fingerprint.id}>
              {formatFingerprintId(fingerprint.id)}
            </code>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={fingerprint.id === "unavailable"}
              onClick={() => onCopy(fingerprint.id, "compositeFingerprint")}
              aria-label={copied.compositeFingerprint ? "综合指纹已复制" : "复制综合指纹"}
              className="h-10 w-10 shrink-0 rounded-full"
            >
              {copied.compositeFingerprint ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>

          <p className="text-xs leading-5 text-[var(--md-sys-color-on-surface-variant)]">
            该值用于比较同一浏览器环境，不代表真实身份。隐私模式、系统升级或浏览器抗指纹策略可能让结果变化。
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
          title="离线音频"
          icon={<Shield className="h-4 w-4" />}
          signal={signals.audio}
          copied={Boolean(copied.audioFingerprint)}
          showDetails={showDetails}
          onCopy={onCopy}
        />
        <SignalCard
          id="fonts"
          title="字体"
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
            title="浏览器环境"
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
