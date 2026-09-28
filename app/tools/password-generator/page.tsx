"use client"

import { copyTextToClipboard } from "@/lib/clipboard"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Check, Clipboard, Copy, Dices, KeyRound, RefreshCw, ShieldCheck } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useToolRuntimeParams } from "@/components/tool-runtime-params"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { NumberInput } from "@/components/ui/number-input"
import { useToolPref } from "@/hooks/use-tool-pref"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { useTranslations } from "@/hooks/use-translations"
import { zhPasswordGenerator } from "@/lib/translations/zh-namespaces/passwordGenerator"
import {
  calculatePassphraseEntropy,
  calculatePasswordEntropy,
  generatePassphrase,
  generatePassword,
  getPasswordPoolSize,
  getPasswordStrength,
  type PasswordStrength,
} from "@/lib/password-generator"

type Mode = "password" | "passphrase"

interface GeneratedValue {
  value: string
  entropy: number
  strength: PasswordStrength
}

const STRENGTH_WIDTH: Record<PasswordStrength, string> = {
  weak: "25%",
  fair: "50%",
  good: "75%",
  strong: "100%",
}

const STRENGTH_COLOR: Record<PasswordStrength, string> = {
  weak: "bg-[var(--md-sys-color-error)]",
  fair: "bg-[var(--md-sys-color-warning)]",
  good: "bg-[var(--md-sys-color-tertiary)]",
  strong: "bg-[var(--md-sys-color-success)]",
}

export default function PasswordGeneratorPage() {
  const t = useTranslations("passwordGenerator", zhPasswordGenerator)
  const params = useToolRuntimeParams()
  const [mode, setMode] = useState<Mode>(params?.feature?.toLowerCase().includes("passphrase") ? "passphrase" : "password")
  // 独立页的地址栏参数在挂载后才读到，初值赶不上
  useEffect(() => {
    if (params?.feature?.toLowerCase().includes("passphrase")) setMode("passphrase")
  }, [params?.feature])
  const [length, setLength] = useToolPref("password-generator", "length", 20, (value) => Number.isInteger(value) && value >= 8 && value <= 128)
  const [lowercase, setLowercase] = useToolPref("password-generator", "lowercase", true)
  const [uppercase, setUppercase] = useToolPref("password-generator", "uppercase", true)
  const [numbers, setNumbers] = useToolPref("password-generator", "numbers", true)
  const [symbols, setSymbols] = useToolPref("password-generator", "symbols", true)
  const [excludeAmbiguous, setExcludeAmbiguous] = useToolPref("password-generator", "excludeAmbiguous", true)
  const [wordCount, setWordCount] = useToolPref("password-generator", "wordCount", 4, (value) => Number.isInteger(value) && value >= 3 && value <= 8)
  const [separator, setSeparator] = useToolPref("password-generator", "separator", "-", (value) => value.length <= 3)
  const [capitalize, setCapitalize] = useToolPref("password-generator", "capitalize", false)
  const [includeNumber, setIncludeNumber] = useToolPref("password-generator", "includeNumber", true)
  const [count, setCount] = useToolPref("password-generator", "count", 3, (value) => Number.isInteger(value) && value >= 1 && value <= 20)
  const [results, setResults] = useState<GeneratedValue[]>([])
  const [copied, setCopied] = useState<string | null>(null)
  const [error, setError] = useState("")

  const passwordOptions = useMemo(() => ({
    length,
    lowercase,
    uppercase,
    numbers,
    symbols,
    excludeAmbiguous,
  }), [excludeAmbiguous, length, lowercase, numbers, symbols, uppercase])

  const generate = useCallback(() => {
    try {
      const next = Array.from({ length: count }, (): GeneratedValue => {
        if (mode === "password") {
          const value = generatePassword(passwordOptions)
          const entropy = calculatePasswordEntropy(length, getPasswordPoolSize(passwordOptions))
          return { value, entropy, strength: getPasswordStrength(entropy) }
        }

        const value = generatePassphrase({ wordCount, separator, capitalize, includeNumber })
        const entropy = calculatePassphraseEntropy(wordCount, includeNumber)
        return { value, entropy, strength: getPasswordStrength(entropy) }
      })
      setResults(next)
      setError("")
    } catch {
      setResults([])
      setError(t("settingsError"))
    }
  }, [capitalize, count, includeNumber, length, mode, passwordOptions, separator, t, wordCount])

  useEffect(() => {
    generate()
  }, [generate])

  const copy = async (value: string, key: string) => {
    if (!await copyTextToClipboard(value)) return
    setCopied(key)
    window.setTimeout(() => setCopied(null), 1600)
  }

  const allCharacterGroups = [lowercase, uppercase, numbers, symbols]
  const selectedGroupCount = allCharacterGroups.filter(Boolean).length
  const primaryResult = results[0]

  const optionRow = (
    id: string,
    label: string,
    description: string,
    checked: boolean,
    onCheckedChange: (checked: boolean) => void,
    disabled = false,
  ) => (
    <div className="flex items-center justify-between gap-4 rounded-2xl bg-[var(--md-sys-color-surface-container-low)] px-4 py-3">
      <div>
        <Label htmlFor={id} className="font-semibold text-[var(--md-sys-color-on-surface)]">{label}</Label>
        <p className="mt-0.5 text-xs text-[var(--md-sys-color-on-surface-variant)]">{description}</p>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} />
    </div>
  )

  return (
    <div className="mx-auto max-w-6xl px-1 py-2 sm:px-3">
      <section className="mb-6">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--md-sys-color-primary-container)] text-[var(--md-sys-color-on-primary-container)]">
            <KeyRound className="h-6 w-6" />
          </span>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-[var(--md-sys-color-on-surface)]">{t("title")}</h1>
            <p className="mt-1 text-[var(--md-sys-color-on-surface-variant)]">{t("description")}</p>
          </div>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <Card className="rounded-[var(--md-sys-shape-corner-extra-large)] border-[var(--md-sys-color-outline-variant)]/70">
          <CardHeader>
            <CardTitle>{t("settings")}</CardTitle>
            <div className="grid grid-cols-2 gap-2 rounded-2xl bg-[var(--md-sys-color-surface-container)] p-1.5">
              <button type="button" onClick={() => setMode("password")} className={`min-h-11 rounded-xl px-4 text-sm font-bold transition ${mode === "password" ? "bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)] shadow-sm" : "text-[var(--md-sys-color-on-surface-variant)] hover:bg-[var(--md-sys-color-on-surface)]/[0.08]"}`}>
                {t("passwordMode")}
              </button>
              <button type="button" onClick={() => setMode("passphrase")} className={`min-h-11 rounded-xl px-4 text-sm font-bold transition ${mode === "passphrase" ? "bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)] shadow-sm" : "text-[var(--md-sys-color-on-surface-variant)] hover:bg-[var(--md-sys-color-on-surface)]/[0.08]"}`}>
                {t("passphraseMode")}
              </button>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            {mode === "password" ? (
              <>
                <div>
                  <div className="mb-3 flex items-center justify-between">
                    <Label>{t("length")}</Label>
                    <NumberInput min={8} max={128} value={length} onValueChange={setLength} aria-label={t("length")} className="h-10 w-20 text-center font-mono" />
                  </div>
                  <Slider min={8} max={128} step={1} value={[length]} onValueChange={([value]) => setLength(value)} aria-label={t("length")} />
                </div>
                <div className="space-y-2">
                  {optionRow("password-lowercase", t("lowercase"), "a-z", lowercase, setLowercase, lowercase && selectedGroupCount === 1)}
                  {optionRow("password-uppercase", t("uppercase"), "A-Z", uppercase, setUppercase, uppercase && selectedGroupCount === 1)}
                  {optionRow("password-numbers", t("numbers"), "0-9", numbers, setNumbers, numbers && selectedGroupCount === 1)}
                  {optionRow("password-symbols", t("symbols"), "! @ # $ %", symbols, setSymbols, symbols && selectedGroupCount === 1)}
                  {optionRow("password-ambiguous", t("excludeAmbiguous"), t("excludeAmbiguousHint"), excludeAmbiguous, setExcludeAmbiguous)}
                </div>
              </>
            ) : (
              <>
                <div>
                  <div className="mb-3 flex items-center justify-between">
                    <Label>{t("wordCount")}</Label>
                    <span className="rounded-full bg-[var(--md-sys-color-secondary-container)] px-3 py-1 text-sm font-bold text-[var(--md-sys-color-on-secondary-container)]">{wordCount}</span>
                  </div>
                  <Slider min={3} max={8} step={1} value={[wordCount]} onValueChange={([value]) => setWordCount(value)} aria-label={t("wordCount")} />
                </div>
                <div>
                  <Label>{t("separator")}</Label>
                  <Select value={separator} onValueChange={setSeparator}>
                    <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="-">{t("hyphen")}</SelectItem>
                      <SelectItem value=".">{t("period")}</SelectItem>
                      <SelectItem value="_">{t("underscore")}</SelectItem>
                      <SelectItem value=" ">{t("space")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  {optionRow("phrase-capitalize", t("capitalize"), t("capitalizeHint"), capitalize, setCapitalize)}
                  {optionRow("phrase-number", t("appendNumber"), t("appendNumberHint"), includeNumber, setIncludeNumber)}
                </div>
              </>
            )}

            <div className="flex items-end gap-3">
              <div className="w-24">
                <Label htmlFor="password-count">{t("count")}</Label>
                <NumberInput id="password-count" min={1} max={20} value={count} onValueChange={setCount} className="mt-2" />
              </div>
              <Button onClick={generate} className="h-10 flex-1 gap-2">
                <RefreshCw className="h-4 w-4" />{t("generate")}
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-5">
          {primaryResult && (
            <Card className="rounded-[var(--md-sys-shape-corner-extra-large)] border-0 bg-gradient-to-br from-[var(--md-sys-color-primary-container)] to-[var(--md-sys-color-tertiary-container)]">
              <CardContent className="p-5 sm:p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-bold text-[var(--md-sys-color-on-primary-container)]">{t("strength")}</p>
                    <p className="mt-1 text-2xl font-bold text-[var(--md-sys-color-on-primary-container)]">{t(`strengthLevels.${primaryResult.strength}`)}</p>
                  </div>
                  <span className="inline-flex items-center gap-2 rounded-full bg-white/65 px-3 py-1.5 text-sm font-bold text-[var(--md-sys-color-on-primary-container)] dark:bg-black/20">
                    <ShieldCheck className="h-4 w-4" />{primaryResult.entropy.toFixed(1)} {t("bits")}
                  </span>
                </div>
                <div className="mt-5 h-2 overflow-hidden rounded-full bg-black/10">
                  <div className={`h-full rounded-full transition-all ${STRENGTH_COLOR[primaryResult.strength]}`} style={{ width: STRENGTH_WIDTH[primaryResult.strength] }} />
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="rounded-[var(--md-sys-shape-corner-extra-large)] border-[var(--md-sys-color-outline-variant)]/70">
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle>{t("results")}</CardTitle>
                <p className="mt-1 text-sm text-[var(--md-sys-color-on-surface-variant)]">{t("localHint")}</p>
              </div>
              {results.length > 1 && (
                <Button variant="outline" size="sm" onClick={() => copy(results.map((result) => result.value).join("\n"), "all")} className="gap-2">
                  {copied === "all" ? <Check className="h-4 w-4" /> : <Clipboard className="h-4 w-4" />}{t("copyAll")}
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {error ? (
                <p className="rounded-2xl bg-[var(--md-sys-color-error-container)] p-4 text-sm text-[var(--md-sys-color-on-error-container)]">{error}</p>
              ) : (
                <div className="space-y-2">
                  {results.map((result, index) => (
                    <div key={`${result.value}-${index}`} className="flex items-center gap-3 rounded-2xl border border-[var(--md-sys-color-outline-variant)]/70 bg-[var(--md-sys-color-surface-container-low)] p-3">
                      <Dices className="h-5 w-5 shrink-0 text-[var(--md-sys-color-primary)]" />
                      <code className="min-w-0 flex-1 break-all text-sm font-semibold text-[var(--md-sys-color-on-surface)] sm:text-base">{result.value}</code>
                      <button type="button" onClick={() => copy(result.value, String(index))} aria-label={t("copy")} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full hover:bg-[var(--md-sys-color-primary)]/[0.08]">
                        {copied === String(index) ? <Check className="h-4 w-4 text-[var(--md-sys-color-success)]" /> : <Copy className="h-4 w-4" />}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
