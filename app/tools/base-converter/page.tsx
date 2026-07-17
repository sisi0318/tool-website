"use client"

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react"
import {
  Binary,
  Calculator,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Hash,
  Minus,
  Plus,
  RefreshCw,
  Settings,
  Zap,
  type LucideIcon,
} from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useTranslations } from "@/hooks/use-translations"
import { useToast } from "@/hooks/use-toast"
import { copyTextToClipboard } from "@/lib/clipboard"
import {
  BaseConverterError,
  formatBigIntInBase,
  parseBigIntInBase,
} from "@/lib/base-converter-tools"

type ResultKey =
  | "binary"
  | "octal"
  | "decimal"
  | "hexadecimal"
  | "base32"
  | "base36"
  | "base58"
  | "base62"
  | "base64"
  | "custom"

interface BaseDefinition {
  key: Exclude<ResultKey, "custom">
  base: number
  icon: LucideIcon
}

const BASE_PRESETS = [
  { key: "binary", base: 2, sample: "010101" },
  { key: "octal", base: 8, sample: "7654" },
  { key: "decimal", base: 10, sample: "1234" },
  { key: "hexadecimal", base: 16, sample: "ABCD" },
  { key: "base32", base: 32, sample: "A2C4" },
  { key: "base36", base: 36, sample: "Z9X7" },
  { key: "base58", base: 58, sample: "BTC" },
  { key: "base62", base: 62, sample: "URL" },
  { key: "base64", base: 64, sample: "R64" },
] as const

const STANDARD_BASES: readonly BaseDefinition[] = [
  { key: "binary", base: 2, icon: Binary },
  { key: "octal", base: 8, icon: Hash },
  { key: "decimal", base: 10, icon: Calculator },
  { key: "hexadecimal", base: 16, icon: Hash },
]

const EXTENDED_BASES: readonly BaseDefinition[] = [
  { key: "base32", base: 32, icon: Hash },
  { key: "base36", base: 36, icon: Hash },
  { key: "base58", base: 58, icon: Hash },
  { key: "base62", base: 62, icon: Hash },
  { key: "base64", base: 64, icon: Hash },
]

function groupFromRight(digits: string, size: number, separator: string): string {
  const groups: string[] = []
  for (let end = digits.length; end > 0; end -= size) {
    groups.unshift(digits.slice(Math.max(0, end - size), end))
  }
  return groups.join(separator)
}

function formatNumber(value: string, base: number): string {
  if (!value) return ""
  const sign = value.startsWith("-") ? "-" : ""
  const digits = sign ? value.slice(1) : value

  if (base === 2) return sign + groupFromRight(digits, 4, " ")
  if (base === 8) return sign + groupFromRight(digits, 3, " ")
  if (base === 10) return sign + groupFromRight(digits, 3, ",")
  if (base === 16) return sign + groupFromRight(digits, 4, " ")
  return value
}

export default function BaseConverterPage() {
  const t = useTranslations("baseConverter")
  const { toast } = useToast()
  const [showSettings, setShowSettings] = useState(false)
  const [autoFormat, setAutoFormat] = useState(true)
  const [realTimeConversion, setRealTimeConversion] = useState(true)
  const [showLength, setShowLength] = useState(false)
  const [compactDisplay, setCompactDisplay] = useState(false)
  const [inputNumber, setInputNumber] = useState("12345")
  const [inputBase, setInputBase] = useState(10)
  const [customBase, setCustomBase] = useState(36)
  const [results, setResults] = useState<Partial<Record<ResultKey, string>>>({})
  const [error, setError] = useState("")
  const [copied, setCopied] = useState<Record<string, boolean>>({})
  const [activeTab, setActiveTab] = useState("standard")
  const copyTimeoutsRef = useRef<Record<string, number>>({})

  useEffect(() => {
    const timeouts = copyTimeoutsRef.current
    return () => {
      Object.values(timeouts).forEach(window.clearTimeout)
    }
  }, [])

  const formatError = useCallback(
    (conversionError: unknown) => {
      if (!(conversionError instanceof BaseConverterError)) return t("invalidInput")
      switch (conversionError.code) {
        case "baseOutOfRange":
          return t("errors.baseOutOfRange")
        case "emptyInput":
          return t("errors.emptyInput")
        case "invalidInteger":
          return t("errors.invalidInteger")
        case "invalidDigit":
          return `${t("errors.character")} “${conversionError.details?.character ?? ""}” ${t("errors.invalidForBase")} ${conversionError.details?.base ?? inputBase}`
      }
    },
    [inputBase, t],
  )

  const convertToAllBases = useCallback(() => {
    if (!inputNumber.trim()) {
      setResults({})
      setError("")
      return
    }

    try {
      const decimal = parseBigIntInBase(inputNumber, inputBase)
      setResults({
        binary: formatBigIntInBase(decimal, 2),
        octal: formatBigIntInBase(decimal, 8),
        decimal: decimal.toString(),
        hexadecimal: formatBigIntInBase(decimal, 16),
        base32: formatBigIntInBase(decimal, 32),
        base36: formatBigIntInBase(decimal, 36),
        base58: formatBigIntInBase(decimal, 58),
        base62: formatBigIntInBase(decimal, 62),
        base64: formatBigIntInBase(decimal, 64),
        custom: formatBigIntInBase(decimal, customBase),
      })
      setError("")
    } catch (conversionError) {
      setError(formatError(conversionError))
      setResults({})
    }
  }, [customBase, formatError, inputBase, inputNumber])

  useEffect(() => {
    if (realTimeConversion) convertToAllBases()
  }, [convertToAllBases, realTimeConversion])

  const handleCopy = useCallback(
    async (text: string, key: string) => {
      if (!text) return
      const success = await copyTextToClipboard(text)
      if (!success) {
        toast({ title: t("copyFailed"), variant: "destructive" })
        return
      }

      window.clearTimeout(copyTimeoutsRef.current[key])
      setCopied((current) => ({ ...current, [key]: true }))
      copyTimeoutsRef.current[key] = window.setTimeout(() => {
        setCopied((current) => ({ ...current, [key]: false }))
        delete copyTimeoutsRef.current[key]
      }, 2000)
    },
    [t, toast],
  )

  return (
    <div className="container mx-auto max-w-7xl px-4 py-4 sm:py-6">
      <div className="mb-6 text-center sm:mb-8">
        <h1 className="mb-2 flex items-center justify-center gap-2 text-2xl font-bold text-[var(--md-sys-color-on-surface)] sm:text-3xl">
          <Calculator className="h-7 w-7 text-[var(--md-sys-color-primary)] sm:h-8 sm:w-8" />
          {t("title")}
        </h1>
        <p className="mx-auto max-w-3xl text-sm text-[var(--md-sys-color-on-surface-variant)]">
          {t("description")}
        </p>
      </div>

      <div className="mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowSettings((visible) => !visible)}
          className="w-full justify-start text-[var(--md-sys-color-on-surface-variant)] hover:text-[var(--md-sys-color-on-surface)]"
          aria-expanded={showSettings}
        >
          {showSettings ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          <Settings className="h-4 w-4" />
          <span>{t("settings")}</span>
          {!showSettings && (
            <Badge variant="secondary" className="ml-auto text-xs">{t("clickToView")}</Badge>
          )}
        </Button>

        {showSettings && (
          <Card className="card-modern mt-3">
            <CardContent className="py-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <SettingSwitch id="base-auto-format" label={t("autoFormat")} checked={autoFormat} onCheckedChange={setAutoFormat} />
                <SettingSwitch id="base-real-time" label={t("realTimeConversion")} checked={realTimeConversion} onCheckedChange={setRealTimeConversion} />
                <SettingSwitch id="base-show-length" label={t("showLength")} checked={showLength} onCheckedChange={setShowLength} />
                <SettingSwitch id="base-compact" label={t("compactDisplay")} checked={compactDisplay} onCheckedChange={setCompactDisplay} />
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <Card className="card-modern mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="flex flex-wrap items-center gap-2 text-lg">
            <Hash className="h-5 w-5 text-[var(--md-sys-color-primary)]" />
            {t("numberInput")}
            {realTimeConversion && (
              <Badge variant="secondary" className="text-xs">
                <Zap className="mr-1 h-3 w-3" />
                {t("live")}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-5 lg:grid-cols-2 lg:gap-6">
            <div className="space-y-2">
              <Label htmlFor="base-input-number">{t("inputNumber")}</Label>
              <Input
                id="base-input-number"
                value={inputNumber}
                onChange={(event) => setInputNumber(event.target.value)}
                className="h-12 font-mono text-lg"
                placeholder={t("inputPlaceholder")}
                autoComplete="off"
                spellCheck={false}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="base-input-radix">{t("inputBase")} (2–64)</Label>
              <div className="flex flex-wrap items-center gap-2">
                <BaseValueControl
                  id="base-input-radix"
                  value={inputBase}
                  onValueChange={setInputBase}
                  label={t("inputBase")}
                />
                <Select value={inputBase.toString()} onValueChange={(value) => setInputBase(Number(value))}>
                  <SelectTrigger className="h-10 min-w-36 flex-1 sm:max-w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BASE_PRESETS.map((preset) => (
                      <SelectItem key={preset.base} value={preset.base.toString()}>
                        {t(preset.key)} · Base {preset.base}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {!realTimeConversion && (
            <div className="mt-4 flex justify-end">
              <Button onClick={convertToAllBases} disabled={!inputNumber.trim()}>
                <RefreshCw className="mr-2 h-4 w-4" />
                {t("convert")}
              </Button>
            </div>
          )}

          {error && (
            <div role="alert" className="mt-4 rounded-xl border border-[var(--md-sys-color-error)]/30 bg-[var(--md-sys-color-error-container)] p-3 text-sm text-[var(--md-sys-color-on-error-container)]">
              {error}
            </div>
          )}

          <div className="mt-5">
            <Label className="mb-3 block">{t("commonBases")}</Label>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-9">
              {BASE_PRESETS.map((preset) => (
                <Button
                  key={preset.base}
                  variant={inputBase === preset.base ? "default" : "outline"}
                  size="sm"
                  onClick={() => setInputBase(preset.base)}
                  className="h-12 min-w-0 flex-col gap-1 px-1"
                  aria-label={`${t(preset.key)} Base ${preset.base}`}
                >
                  <span className="truncate font-mono text-xs">{preset.sample}</span>
                  <span className="text-xs">{preset.base}</span>
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="mb-6 grid w-full grid-cols-2">
          <TabsTrigger value="standard" className="gap-2">
            <Binary className="h-4 w-4" />
            {t("standardBases")}
          </TabsTrigger>
          <TabsTrigger value="extended" className="gap-2">
            <Calculator className="h-4 w-4" />
            {t("extendedBases")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="standard">
          <ResultGrid
            definitions={STANDARD_BASES}
            results={results}
            autoFormat={autoFormat}
            showLength={showLength}
            compactDisplay={compactDisplay}
            copied={copied}
            onCopy={handleCopy}
          />
        </TabsContent>

        <TabsContent value="extended">
          <ResultGrid
            definitions={EXTENDED_BASES}
            results={results}
            autoFormat={autoFormat}
            showLength={showLength}
            compactDisplay={compactDisplay}
            copied={copied}
            onCopy={handleCopy}
          />

          <Card className="card-modern mt-6">
            <CardHeader className="pb-3">
              <CardTitle className="flex flex-wrap items-center gap-2 text-lg">
                <Settings className="h-5 w-5 text-[var(--md-sys-color-primary)]" />
                {t("custom")} · Base {customBase}
                {autoFormat && <Badge variant="secondary" className="text-xs">{t("formatted")}</Badge>}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <Label htmlFor="custom-base-value">{t("customBase")} (2–64)</Label>
                <BaseValueControl
                  id="custom-base-value"
                  value={customBase}
                  onValueChange={setCustomBase}
                  label={t("customBase")}
                />
              </div>
              <ResultValue
                value={results.custom ?? ""}
                base={customBase}
                autoFormat={autoFormat}
                compactDisplay={compactDisplay}
              />
              <ResultActions
                value={results.custom ?? ""}
                copyKey={`custom-${customBase}`}
                copied={copied}
                showLength={showLength}
                onCopy={handleCopy}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

interface SettingSwitchProps {
  id: string
  label: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}

function SettingSwitch({ id, label, checked, onCheckedChange }: SettingSwitchProps) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-[var(--md-sys-color-surface-container-low)] p-3">
      <Label htmlFor={id} className="cursor-pointer text-sm">{label}</Label>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  )
}

interface BaseValueControlProps {
  id: string
  value: number
  onValueChange: (value: number) => void
  label: string
}

function BaseValueControl({ id, value, onValueChange, label }: BaseValueControlProps) {
  const t = useTranslations("baseConverter")
  const [draft, setDraft] = useState(value.toString())

  useEffect(() => {
    setDraft(value.toString())
  }, [value])

  return (
    <div className="flex items-center gap-1">
      <Input
        id={id}
        value={draft}
        inputMode="numeric"
        onChange={(event) => {
          const nextDraft = event.target.value
          if (!/^\d*$/.test(nextDraft)) return
          setDraft(nextDraft)
          const parsed = Number(nextDraft)
          if (Number.isInteger(parsed) && parsed >= 2 && parsed <= 64) onValueChange(parsed)
        }}
        onBlur={() => setDraft(value.toString())}
        className="h-10 w-16 text-center font-mono"
        aria-label={label}
      />
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-10 w-10"
        onClick={() => onValueChange(Math.max(2, value - 1))}
        disabled={value <= 2}
        aria-label={`${t("decrease")} ${label}`}
      >
        <Minus className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-10 w-10"
        onClick={() => onValueChange(Math.min(64, value + 1))}
        disabled={value >= 64}
        aria-label={`${t("increase")} ${label}`}
      >
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  )
}

interface ResultGridProps {
  definitions: readonly BaseDefinition[]
  results: Partial<Record<ResultKey, string>>
  autoFormat: boolean
  showLength: boolean
  compactDisplay: boolean
  copied: Record<string, boolean>
  onCopy: (text: string, key: string) => void
}

function ResultGrid(props: ResultGridProps) {
  const t = useTranslations("baseConverter")
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
      {props.definitions.map((definition) => {
        const Icon = definition.icon
        return (
          <ResultCard
            key={definition.base}
            title={`${t(definition.key)} · Base ${definition.base}`}
            base={definition.base}
            value={props.results[definition.key] ?? ""}
            autoFormat={props.autoFormat}
            showLength={props.showLength}
            compactDisplay={props.compactDisplay}
            onCopy={props.onCopy}
            copied={props.copied}
            icon={<Icon className="h-5 w-5" />}
          />
        )
      })}
    </div>
  )
}

interface ResultCardProps {
  title: string
  base: number
  value: string
  autoFormat: boolean
  showLength: boolean
  compactDisplay: boolean
  onCopy: (text: string, key: string) => void
  copied: Record<string, boolean>
  icon: ReactNode
}

function ResultCard({
  title,
  base,
  value,
  autoFormat,
  showLength,
  compactDisplay,
  onCopy,
  copied,
  icon,
}: ResultCardProps) {
  const t = useTranslations("baseConverter")
  const copyKey = `base-${base}`
  return (
    <Card className="card-modern min-w-0">
      <CardHeader className="pb-3">
        <CardTitle className="flex flex-wrap items-center gap-2 text-lg text-[var(--md-sys-color-primary)]">
          {icon}
          <span>{title}</span>
          {autoFormat && <Badge variant="secondary" className="text-xs">{t("formatted")}</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <ResultValue value={value} base={base} autoFormat={autoFormat} compactDisplay={compactDisplay} />
        <ResultActions
          value={value}
          copyKey={copyKey}
          copied={copied}
          showLength={showLength}
          onCopy={onCopy}
        />
      </CardContent>
    </Card>
  )
}

interface ResultValueProps {
  value: string
  base: number
  autoFormat: boolean
  compactDisplay: boolean
}

function ResultValue({ value, base, autoFormat, compactDisplay }: ResultValueProps) {
  const t = useTranslations("baseConverter")
  const displayValue = autoFormat ? formatNumber(value, base) : value
  const digitCount = value.replace(/^[+-]/, "").length

  return (
    <div className={`rounded-xl bg-[var(--md-sys-color-surface-container-low)] font-mono break-all ${compactDisplay ? "p-3 text-sm" : "border-2 border-dashed border-[var(--md-sys-color-outline-variant)] p-4 text-lg"}`}>
      <span className={displayValue ? "text-[var(--md-sys-color-on-surface)]" : "text-sm text-[var(--md-sys-color-on-surface-variant)]"}>
        {displayValue || t("resultPlaceholder")}
      </span>
      {value && base === 2 && digitCount > 8 && (
        <span className="mt-2 block text-xs text-[var(--md-sys-color-on-surface-variant)]">
          {Math.ceil(digitCount / 8)} {t("bytes")}
        </span>
      )}
    </div>
  )
}

interface ResultActionsProps {
  value: string
  copyKey: string
  copied: Record<string, boolean>
  showLength: boolean
  onCopy: (text: string, key: string) => void
}

function ResultActions({ value, copyKey, copied, showLength, onCopy }: ResultActionsProps) {
  const t = useTranslations("baseConverter")
  const digitCount = value.replace(/^[+-]/, "").length
  return (
    <div className="flex items-center justify-between gap-2">
      <Button
        variant="outline"
        onClick={() => onCopy(value, copyKey)}
        disabled={!value}
        className="min-w-0 flex-1"
      >
        {copied[copyKey] ? (
          <Check className="mr-2 h-4 w-4 shrink-0 text-[var(--md-sys-color-tertiary)]" />
        ) : (
          <Copy className="mr-2 h-4 w-4 shrink-0" />
        )}
        {copied[copyKey] ? t("copied") : t("copy")}
      </Button>
      {showLength && value && (
        <Badge variant="outline" className="shrink-0">
          {digitCount} {t("digits")}
        </Badge>
      )}
    </div>
  )
}
