"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Minus,
  Plus,
  Settings,
  Snowflake,
  Sun,
  Thermometer,
  type LucideIcon,
} from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { copyTextToClipboard } from "@/lib/clipboard"
import { useToast } from "@/hooks/use-toast"
import { useTranslations } from "@/hooks/use-translations"

type TemperatureScaleId =
  | "kelvin"
  | "celsius"
  | "fahrenheit"
  | "rankine"
  | "delisle"
  | "newton"
  | "reaumur"
  | "romer"

type ScaleCategory = "common" | "scientific" | "historical"

interface TemperatureScale {
  id: TemperatureScaleId
  symbol: string
  category: ScaleCategory
  icon: string
  toKelvin: (value: number) => number
  fromKelvin: (kelvin: number) => number
}

const TEMPERATURE_SCALES: readonly TemperatureScale[] = [
  {
    id: "kelvin",
    symbol: "K",
    category: "common",
    icon: "⚗️",
    toKelvin: (value) => value,
    fromKelvin: (kelvin) => kelvin,
  },
  {
    id: "celsius",
    symbol: "°C",
    category: "common",
    icon: "🌡️",
    toKelvin: (value) => value + 273.15,
    fromKelvin: (kelvin) => kelvin - 273.15,
  },
  {
    id: "fahrenheit",
    symbol: "°F",
    category: "common",
    icon: "🇺🇸",
    toKelvin: (value) => (value + 459.67) * (5 / 9),
    fromKelvin: (kelvin) => kelvin * (9 / 5) - 459.67,
  },
  {
    id: "rankine",
    symbol: "°R",
    category: "scientific",
    icon: "🔬",
    toKelvin: (value) => value * (5 / 9),
    fromKelvin: (kelvin) => kelvin * (9 / 5),
  },
  {
    id: "delisle",
    symbol: "°De",
    category: "historical",
    icon: "📜",
    toKelvin: (value) => 373.15 - (value * 2) / 3,
    fromKelvin: (kelvin) => (373.15 - kelvin) * (3 / 2),
  },
  {
    id: "newton",
    symbol: "°N",
    category: "historical",
    icon: "🍎",
    toKelvin: (value) => value * (100 / 33) + 273.15,
    fromKelvin: (kelvin) => (kelvin - 273.15) * (33 / 100),
  },
  {
    id: "reaumur",
    symbol: "°Ré",
    category: "historical",
    icon: "🇫🇷",
    toKelvin: (value) => value * (5 / 4) + 273.15,
    fromKelvin: (kelvin) => (kelvin - 273.15) * (4 / 5),
  },
  {
    id: "romer",
    symbol: "°Rø",
    category: "historical",
    icon: "🇩🇰",
    toKelvin: (value) => (value - 7.5) * (40 / 21) + 273.15,
    fromKelvin: (kelvin) => (kelvin - 273.15) * (21 / 40) + 7.5,
  },
]

const SCALE_GROUPS: readonly {
  id: ScaleCategory
  icon: LucideIcon
  gridClass: string
}[] = [
  { id: "common", icon: Thermometer, gridClass: "md:grid-cols-2 lg:grid-cols-3" },
  { id: "scientific", icon: Sun, gridClass: "md:grid-cols-2 lg:grid-cols-3" },
  { id: "historical", icon: Snowflake, gridClass: "md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" },
]

const TEMPERATURE_PRESETS = [
  { id: "absoluteZero", kelvin: 0, icon: "❄️" },
  { id: "liquidNitrogen", kelvin: 77.36, icon: "🧪" },
  { id: "dryIce", kelvin: 194.65, icon: "🧊" },
  { id: "waterFreezing", kelvin: 273.15, icon: "🧊" },
  { id: "roomTemperature", kelvin: 293.15, icon: "🏠" },
  { id: "bodyTemperature", kelvin: 310.15, icon: "🩺" },
  { id: "waterBoiling", kelvin: 373.15, icon: "💨" },
  { id: "bakingTemperature", kelvin: 453.15, icon: "🍞" },
  { id: "sunSurface", kelvin: 5778, icon: "☀️" },
  { id: "earthCore", kelvin: 6000, icon: "🌍" },
] as const

function temperaturesFromKelvin(kelvin: number): Record<TemperatureScaleId, number> {
  return Object.fromEntries(
    TEMPERATURE_SCALES.map((scale) => [scale.id, scale.fromKelvin(kelvin)]),
  ) as Record<TemperatureScaleId, number>
}

function parseTemperatureInput(value: string): number | null {
  const normalized = value.trim().replace(",", ".")
  if (!normalized) return null
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

export default function TemperatureConverterPage() {
  const t = useTranslations("temperatureConverter")
  const { toast } = useToast()
  const [showSettings, setShowSettings] = useState(false)
  const [autoFormat, setAutoFormat] = useState(true)
  const [showDescription, setShowDescription] = useState(false)
  const [compactDisplay, setCompactDisplay] = useState(false)
  const [precision, setPrecision] = useState(2)
  const [temperatures, setTemperatures] = useState<Record<TemperatureScaleId, number>>(
    () => temperaturesFromKelvin(293.15),
  )
  const [copied, setCopied] = useState<Record<string, boolean>>({})
  const copyTimeoutsRef = useRef<Record<string, number>>({})

  useEffect(() => {
    const timeouts = copyTimeoutsRef.current
    return () => {
      Object.values(timeouts).forEach(window.clearTimeout)
    }
  }, [])

  const updateTemperatures = useCallback((value: number, scaleId: TemperatureScaleId) => {
    const scale = TEMPERATURE_SCALES.find((item) => item.id === scaleId)
    if (!scale || !Number.isFinite(value)) return
    setTemperatures(temperaturesFromKelvin(scale.toKelvin(value)))
  }, [])

  const handleIncrement = useCallback(
    (scaleId: TemperatureScaleId, amount: number) => {
      updateTemperatures(temperatures[scaleId] + amount, scaleId)
    },
    [temperatures, updateTemperatures],
  )

  const copyValue = useCallback(
    async (text: string, key: string) => {
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

  const formatTemperature = useCallback(
    (value: number) => {
      const normalized = Object.is(value, -0) ? 0 : value
      if (!autoFormat) return normalized.toString()
      return normalized.toFixed(precision).replace(/\.?0+$/, "")
    },
    [autoFormat, precision],
  )

  return (
    <div className="container mx-auto max-w-7xl px-4 py-4 sm:py-6">
      <div className="mb-6 text-center sm:mb-8">
        <h1 className="mb-2 flex items-center justify-center gap-2 text-2xl font-bold text-[var(--md-sys-color-on-surface)] sm:text-3xl">
          <Thermometer className="h-7 w-7 text-[var(--md-sys-color-primary)] sm:h-8 sm:w-8" />
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
            <Badge variant="secondary" className="ml-auto text-xs">
              {t("clickToView")}
            </Badge>
          )}
        </Button>

        {showSettings && (
          <Card className="card-modern mt-3">
            <CardContent className="py-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <SettingSwitch
                  id="temperature-auto-format"
                  label={t("autoFormat")}
                  checked={autoFormat}
                  onCheckedChange={setAutoFormat}
                />
                <SettingSwitch
                  id="temperature-description"
                  label={t("showDescriptions")}
                  checked={showDescription}
                  onCheckedChange={setShowDescription}
                />
                <SettingSwitch
                  id="temperature-compact"
                  label={t("compactDisplay")}
                  checked={compactDisplay}
                  onCheckedChange={setCompactDisplay}
                />
                <div className="flex items-center justify-between gap-3 rounded-xl bg-[var(--md-sys-color-surface-container-low)] p-3">
                  <Label htmlFor="temperature-precision" className="cursor-pointer text-sm">
                    {t("precision")}
                  </Label>
                  <Select value={precision.toString()} onValueChange={(value) => setPrecision(Number(value))}>
                    <SelectTrigger id="temperature-precision" className="h-9 w-28">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[0, 1, 2, 3, 4].map((digits) => (
                        <SelectItem key={digits} value={digits.toString()}>
                          {digits} {t("decimalPlaces")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="space-y-5 sm:space-y-8">
        {SCALE_GROUPS.map((group) => {
          const Icon = group.icon
          return (
            <Card key={group.id} className="card-modern">
              <CardHeader className="pb-3">
                <CardTitle className="flex flex-wrap items-center gap-2 text-lg sm:text-xl">
                  <Icon className="h-5 w-5 text-[var(--md-sys-color-primary)] sm:h-6 sm:w-6" />
                  {t(`categories.${group.id}.title`)}
                  <Badge variant="secondary" className="text-xs">
                    {t(`categories.${group.id}.badge`)}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`grid grid-cols-1 gap-4 sm:gap-6 ${group.gridClass}`}>
                  {TEMPERATURE_SCALES.filter((scale) => scale.category === group.id).map((scale) => (
                    <TemperatureCard
                      key={scale.id}
                      scale={scale}
                      value={temperatures[scale.id]}
                      formatTemperature={formatTemperature}
                      onValueChange={updateTemperatures}
                      onIncrement={handleIncrement}
                      onCopy={copyValue}
                      copied={copied}
                      showDescription={showDescription}
                      compactDisplay={compactDisplay}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Card className="card-modern mt-6 sm:mt-8">
        <CardHeader className="pb-3">
          <CardTitle className="flex flex-wrap items-center gap-2 text-lg">
            <Sun className="h-5 w-5 text-[var(--md-sys-color-secondary)]" />
            {t("presetsTitle")}
            <Badge variant="secondary" className="text-xs">
              {t("clickToSet")}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
            {TEMPERATURE_PRESETS.map((preset) => (
              <Button
                key={preset.id}
                variant="outline"
                className="h-auto min-w-0 flex-col gap-2 whitespace-normal p-3 hover:bg-[var(--md-sys-color-primary-container)] sm:p-4"
                onClick={() => setTemperatures(temperaturesFromKelvin(preset.kelvin))}
              >
                <span className="text-2xl" aria-hidden="true">{preset.icon}</span>
                <span className="min-w-0 text-center">
                  <span className="block text-sm font-medium">{t(`presets.${preset.id}`)}</span>
                  <span className="block text-xs text-[var(--md-sys-color-on-surface-variant)]">
                    {formatTemperature(preset.kelvin - 273.15)} °C
                  </span>
                </span>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
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

interface TemperatureCardProps {
  scale: TemperatureScale
  value: number
  formatTemperature: (value: number) => string
  onValueChange: (value: number, scaleId: TemperatureScaleId) => void
  onIncrement: (scaleId: TemperatureScaleId, amount: number) => void
  onCopy: (text: string, key: string) => void
  copied: Record<string, boolean>
  showDescription: boolean
  compactDisplay: boolean
}

function TemperatureCard({
  scale,
  value,
  formatTemperature,
  onValueChange,
  onIncrement,
  onCopy,
  copied,
  showDescription,
  compactDisplay,
}: TemperatureCardProps) {
  const t = useTranslations("temperatureConverter")
  const copyKey = `temp-${scale.id}`
  const focusedRef = useRef(false)
  const [draft, setDraft] = useState(() => formatTemperature(value))

  useEffect(() => {
    const draftValue = parseTemperatureInput(draft)
    const matchesValue =
      draftValue !== null && Math.abs(draftValue - value) <= Math.max(1, Math.abs(value)) * 1e-12
    if (!focusedRef.current || !matchesValue) setDraft(formatTemperature(value))
  }, [draft, formatTemperature, value])

  const scaleName = t(`scales.${scale.id}.name`)

  return (
    <Card className="card-modern min-w-0">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg text-[var(--md-sys-color-primary)]">
          <span className="text-xl" aria-hidden="true">{scale.icon}</span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">{scaleName}</span>
            <span className="block text-sm font-normal text-[var(--md-sys-color-on-surface-variant)]">
              {scale.symbol}
            </span>
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className={`rounded-xl border-2 border-dashed border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container-low)] ${compactDisplay ? "p-3" : "p-4"}`}>
            <div className="flex min-w-0 items-center gap-2">
              <Input
                type="text"
                inputMode="decimal"
                value={draft}
                aria-label={`${scaleName} (${scale.symbol})`}
                onFocus={() => {
                  focusedRef.current = true
                }}
                onBlur={() => {
                  focusedRef.current = false
                  const parsed = parseTemperatureInput(draft)
                  if (parsed !== null) onValueChange(parsed, scale.id)
                  setDraft(formatTemperature(parsed ?? value))
                }}
                onChange={(event) => {
                  const nextDraft = event.target.value
                  setDraft(nextDraft)
                  const parsed = parseTemperatureInput(nextDraft)
                  if (parsed !== null) onValueChange(parsed, scale.id)
                }}
                className={`min-w-0 border-0 bg-transparent text-center font-mono shadow-none focus-visible:ring-0 ${compactDisplay ? "h-10 text-lg" : "h-12 text-2xl"}`}
              />
              <span className={`min-w-12 text-center font-semibold text-[var(--md-sys-color-primary)] ${compactDisplay ? "text-lg" : "text-xl"}`}>
                {scale.symbol}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-[1fr_minmax(7rem,1.4fr)_1fr] gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => onIncrement(scale.id, -1)}
              className="w-full"
              aria-label={`${t("decrease")} ${scaleName}`}
            >
              <Minus className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              onClick={() => onCopy(formatTemperature(value), copyKey)}
              className="min-w-0 px-2"
            >
              {copied[copyKey] ? (
                <Check className="mr-2 h-4 w-4 shrink-0 text-[var(--md-sys-color-tertiary)]" />
              ) : (
                <Copy className="mr-2 h-4 w-4 shrink-0" />
              )}
              <span className="truncate">{copied[copyKey] ? t("copied") : t("copy")}</span>
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => onIncrement(scale.id, 1)}
              className="w-full"
              aria-label={`${t("increase")} ${scaleName}`}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {showDescription && (
            <p className="rounded-lg bg-[var(--md-sys-color-surface-container-low)] p-2 text-xs text-[var(--md-sys-color-on-surface-variant)]">
              {t(`scales.${scale.id}.description`)}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
