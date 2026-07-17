"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  AlertTriangle,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Key,
  Loader2,
  RefreshCw,
  Settings,
  Shuffle,
  Trash2,
  Zap,
} from "lucide-react"

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { useTranslations } from "@/hooks/use-translations"
import { useToast } from "@/hooks/use-toast"
import { copyTextToClipboard } from "@/lib/clipboard"
import { base64ToBytes, bytesToBase64, bytesToHex } from "@/lib/binary"
import {
  calculateHmac,
  verifyHmac,
  type HmacKeyFormat,
  type HmacOutputFormat,
} from "@/lib/hmac-tools"

interface AlgorithmDefinition {
  id: string
  name: string
  legacy?: boolean
}

const HMAC_ALGORITHMS: readonly AlgorithmDefinition[] = [
  { id: "md5", name: "MD5", legacy: true },
  { id: "sha1", name: "SHA-1", legacy: true },
  { id: "sha224", name: "SHA-224" },
  { id: "sha256", name: "SHA-256" },
  { id: "sha384", name: "SHA-384" },
  { id: "sha512", name: "SHA-512" },
  { id: "sha3-224", name: "SHA3-224" },
  { id: "sha3-256", name: "SHA3-256" },
  { id: "sha3-384", name: "SHA3-384" },
  { id: "sha3-512", name: "SHA3-512" },
  { id: "ripemd160", name: "RIPEMD-160" },
]

type KeyStrengthLevel = "empty" | "invalid" | "veryWeak" | "weak" | "medium" | "strong"

interface KeyStrength {
  level: KeyStrengthLevel
  score: number
}

function getEncodedKeyLength(key: string, format: HmacKeyFormat): number | null {
  try {
    if (format === "hex") {
      if (!/^(?:[0-9a-f]{2})+$/i.test(key)) return null
      return key.length / 2
    }
    if (format === "base64") return base64ToBytes(key).length
    return new TextEncoder().encode(key).length
  } catch {
    return null
  }
}

function analyzeKeyStrength(key: string, format: HmacKeyFormat): KeyStrength {
  if (!key) return { level: "empty", score: 0 }
  const byteLength = getEncodedKeyLength(key, format)
  if (byteLength === null || byteLength === 0) return { level: "invalid", score: 0 }

  let score = byteLength >= 32 ? 85 : byteLength >= 16 ? 65 : byteLength >= 8 ? 45 : 20
  if (format === "raw") {
    const categories = [
      /[a-z]/.test(key),
      /[A-Z]/.test(key),
      /\d/.test(key),
      /[^a-zA-Z0-9]/.test(key),
    ].filter(Boolean).length
    score += Math.min(15, categories * 4)
  } else if (byteLength >= 32) {
    score += 10
  }
  score = Math.min(100, score)

  if (score >= 80) return { level: "strong", score }
  if (score >= 60) return { level: "medium", score }
  if (score >= 40) return { level: "weak", score }
  return { level: "veryWeak", score }
}

function generateSecureRandomString(length: number, alphabet: string): string {
  const maxValidByte = 256 - (256 % alphabet.length)
  let result = ""

  while (result.length < length) {
    const bytes = new Uint8Array(Math.max(16, length - result.length))
    crypto.getRandomValues(bytes)
    for (const byte of bytes) {
      if (byte >= maxValidByte) continue
      result += alphabet[byte % alphabet.length]
      if (result.length === length) break
    }
  }

  return result
}

export default function HmacPage() {
  const t = useTranslations("hmac")
  const { toast } = useToast()
  const [algorithm, setAlgorithm] = useState("sha256")
  const [showSettings, setShowSettings] = useState(false)
  const [input, setInput] = useState("")
  const [output, setOutput] = useState("")
  const [autoMode, setAutoMode] = useState(true)
  const [autoSwitch, setAutoSwitch] = useState(true)
  const [hmacKey, setHmacKey] = useState("")
  const [keyFormat, setKeyFormat] = useState<HmacKeyFormat>("raw")
  const [verifyValue, setVerifyValue] = useState("")
  const [outputFormat, setOutputFormat] = useState<HmacOutputFormat>("hex")
  const [copied, setCopied] = useState<Record<string, boolean>>({})
  const [calculationError, setCalculationError] = useState("")
  const [isCalculating, setIsCalculating] = useState(false)
  const copyTimeoutsRef = useRef<Record<string, number>>({})
  const calculationRequestRef = useRef(0)
  const previousAutoStateRef = useRef({
    input,
    algorithm,
    hmacKey,
    keyFormat,
    outputFormat,
    autoMode,
    autoSwitch,
  })

  const selectedAlgorithm =
    HMAC_ALGORITHMS.find((item) => item.id === algorithm) ?? HMAC_ALGORITHMS[3]
  const keyStrength = useMemo(() => analyzeKeyStrength(hmacKey, keyFormat), [hmacKey, keyFormat])
  const verifyResult = useMemo(() => {
    if (!verifyValue.trim() || !output) return null
    return verifyHmac(output, verifyValue, outputFormat)
  }, [output, outputFormat, verifyValue])

  useEffect(() => {
    const timeouts = copyTimeoutsRef.current
    return () => {
      Object.values(timeouts).forEach(window.clearTimeout)
      calculationRequestRef.current += 1
    }
  }, [])

  const calculateValue = useCallback(
    async (data: string, requestId: number) => {
      setIsCalculating(true)
      try {
        const result = await calculateHmac({
          data,
          key: hmacKey,
          algorithm,
          keyFormat,
          outputFormat,
        })
        if (requestId !== calculationRequestRef.current) return
        setOutput(result)
        setCalculationError("")
      } catch {
        if (requestId !== calculationRequestRef.current) return
        setOutput("")
        setCalculationError(keyStrength.level === "invalid" ? t("invalidKey") : t("error"))
      } finally {
        if (requestId === calculationRequestRef.current) setIsCalculating(false)
      }
    },
    [algorithm, hmacKey, keyFormat, keyStrength.level, outputFormat, t],
  )

  const calculateManually = useCallback(() => {
    if (!input || !hmacKey || keyStrength.level === "invalid") return
    const requestId = ++calculationRequestRef.current
    void calculateValue(input, requestId)
  }, [calculateValue, hmacKey, input, keyStrength.level])

  useEffect(() => {
    const previous = previousAutoStateRef.current
    const inputChanged = previous.input !== input
    const settingsChanged =
      previous.algorithm !== algorithm ||
      previous.hmacKey !== hmacKey ||
      previous.keyFormat !== keyFormat ||
      previous.outputFormat !== outputFormat
    const autoModeEnabled = !previous.autoMode && autoMode
    const autoSwitchEnabled = !previous.autoSwitch && autoSwitch

    previousAutoStateRef.current = {
      input,
      algorithm,
      hmacKey,
      keyFormat,
      outputFormat,
      autoMode,
      autoSwitch,
    }

    if (!input || !hmacKey || keyStrength.level === "invalid") {
      calculationRequestRef.current += 1
      setOutput("")
      setIsCalculating(false)
      setCalculationError(
        hmacKey && keyStrength.level === "invalid" ? t("invalidKey") : "",
      )
      return
    }

    const shouldCalculate =
      (autoMode && (inputChanged || autoModeEnabled)) ||
      (autoSwitch && (settingsChanged || autoSwitchEnabled))
    if (!shouldCalculate) return

    if (settingsChanged) setOutput("")
    const requestId = ++calculationRequestRef.current
    const timeout = window.setTimeout(() => {
      void calculateValue(input, requestId)
    }, 250)

    return () => {
      window.clearTimeout(timeout)
    }
  }, [
    algorithm,
    autoMode,
    autoSwitch,
    calculateValue,
    hmacKey,
    input,
    keyFormat,
    keyStrength.level,
    outputFormat,
    t,
  ])

  const generateRandomKey = useCallback(() => {
    const bytes = new Uint8Array(32)
    crypto.getRandomValues(bytes)
    if (keyFormat === "hex") {
      setHmacKey(bytesToHex(bytes))
    } else if (keyFormat === "base64") {
      setHmacKey(bytesToBase64(bytes))
    } else {
      const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,./<>?"
      setHmacKey(generateSecureRandomString(32, alphabet))
    }
  }, [keyFormat])

  const copyOutput = useCallback(async () => {
    if (!output) return
    const success = await copyTextToClipboard(output)
    if (!success) {
      toast({ title: t("copyFailed"), variant: "destructive" })
      return
    }

    window.clearTimeout(copyTimeoutsRef.current.output)
    setCopied((current) => ({ ...current, output: true }))
    copyTimeoutsRef.current.output = window.setTimeout(() => {
      setCopied((current) => ({ ...current, output: false }))
      delete copyTimeoutsRef.current.output
    }, 2000)
  }, [output, t, toast])

  const clearAll = useCallback(() => {
    calculationRequestRef.current += 1
    setInput("")
    setOutput("")
    setVerifyValue("")
    setCalculationError("")
    setIsCalculating(false)
  }, [])

  const strengthTone =
    keyStrength.level === "strong"
      ? "bg-[var(--md-sys-color-primary)]"
      : keyStrength.level === "medium"
        ? "bg-[var(--md-sys-color-tertiary)]"
        : "bg-[var(--md-sys-color-error)]"

  return (
    <div className="container mx-auto max-w-6xl px-4 py-4 sm:py-6">
      <div className="mb-6 text-center sm:mb-8">
        <h1 className="mb-2 text-2xl font-bold text-[var(--md-sys-color-on-surface)] sm:text-3xl">
          {t("title")}
        </h1>
        <p className="mx-auto max-w-3xl text-sm text-[var(--md-sys-color-on-surface-variant)]">
          {t("description")}
        </p>
      </div>

      <section className="mb-6" aria-labelledby="hmac-algorithm-label">
        <Label id="hmac-algorithm-label" className="mb-2 block">{t("algorithm")}</Label>
        <Tabs value={algorithm} onValueChange={setAlgorithm}>
          <TabsList className="grid h-auto w-full grid-cols-3 gap-1 bg-[var(--md-sys-color-surface-container)] p-1 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-11">
            {HMAC_ALGORITHMS.map((item) => (
              <TabsTrigger
                key={item.id}
                value={item.id}
                className="min-w-0 whitespace-nowrap px-1.5 py-2 text-xs"
              >
                {item.name}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        {selectedAlgorithm.legacy && (
          <div className="mt-3 flex items-start gap-2 rounded-xl bg-[var(--md-sys-color-error-container)] p-3 text-sm text-[var(--md-sys-color-on-error-container)]">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{t("legacyAlgorithmWarning")}</span>
          </div>
        )}

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowSettings((visible) => !visible)}
          className="mt-3 w-full justify-start text-[var(--md-sys-color-on-surface-variant)] hover:text-[var(--md-sys-color-on-surface)]"
          aria-expanded={showSettings}
        >
          {showSettings ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          <Settings className="h-4 w-4" />
          <span>{t("workModeSettings")}</span>
          {!showSettings && (
            <Badge variant="secondary" className="ml-auto text-xs">{t("clickToView")}</Badge>
          )}
        </Button>

        {showSettings && (
          <Card className="card-modern mt-3">
            <CardContent className="grid gap-3 py-4 md:grid-cols-2">
              <SettingSwitch id="hmac-auto-mode" label={t("autoMode")} checked={autoMode} onCheckedChange={setAutoMode} />
              <SettingSwitch id="hmac-auto-switch" label={t("autoSwitch")} checked={autoSwitch} onCheckedChange={setAutoSwitch} />
            </CardContent>
          </Card>
        )}
      </section>

      <Card className="card-modern mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="flex flex-wrap items-center gap-2 text-base">
            <Key className="h-4 w-4 text-[var(--md-sys-color-primary)]" />
            {t("keyManagement")}
            {hmacKey && (
              <Badge
                variant={
                  keyStrength.level === "strong"
                    ? "default"
                    : keyStrength.level === "medium"
                      ? "secondary"
                      : "destructive"
                }
                className="ml-auto text-xs"
              >
                {t("strength")}: {t(`strengthLevels.${keyStrength.level}`)}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label htmlFor="hmac-key">{t("key")}</Label>
              <div className="flex flex-wrap items-center gap-2">
                <Select value={keyFormat} onValueChange={(value) => setKeyFormat(value as HmacKeyFormat)}>
                  <SelectTrigger className="h-9 w-28" aria-label={t("keyFormat")}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="raw">{t("rawText")}</SelectItem>
                    <SelectItem value="hex">HEX</SelectItem>
                    <SelectItem value="base64">Base64</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" size="sm" onClick={generateRandomKey}>
                  <Shuffle className="mr-1 h-3.5 w-3.5" />
                  {t("generateKey")}
                </Button>
              </div>
            </div>
            <div className="relative">
              <Input
                id="hmac-key"
                value={hmacKey}
                onChange={(event) => setHmacKey(event.target.value)}
                placeholder={t("keyPlaceholder")}
                className="pr-10 font-mono"
                autoComplete="off"
                spellCheck={false}
              />
              <Key className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--md-sys-color-on-surface-variant)]" />
            </div>
          </div>

          {hmacKey && (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="text-[var(--md-sys-color-on-surface-variant)]">{t("keyStrength")}</span>
                <span className="font-medium">
                  {t(`strengthLevels.${keyStrength.level}`)} ({keyStrength.score}/100)
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-[var(--md-sys-color-surface-container-high)]">
                <div
                  className={`h-full rounded-full transition-[width] ${strengthTone}`}
                  style={{ width: `${keyStrength.score}%` }}
                />
              </div>
              <p className="text-xs text-[var(--md-sys-color-on-surface-variant)]">
                {t(`strengthAdvice.${keyStrength.level}`)}
              </p>
            </div>
          )}

          <div className="max-w-xs space-y-2">
            <Label htmlFor="hmac-output-format">{t("outputFormat")}</Label>
            <Select value={outputFormat} onValueChange={(value) => setOutputFormat(value as HmacOutputFormat)}>
              <SelectTrigger id="hmac-output-format" className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="hex">{t("hex")}</SelectItem>
                <SelectItem value="base64">Base64</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:gap-5">
        <Card className="card-modern min-w-0">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <span className="h-3 w-3 rounded-full bg-[var(--md-sys-color-tertiary)]" />
              {t("dataInput")}
              <Badge variant="outline" className="ml-auto text-xs">
                {input.length} {t("characters")}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              aria-label={t("inputAria")}
              placeholder={t("inputPlaceholder")}
              className="min-h-[220px] resize-y font-mono text-sm"
            />
            {calculationError && (
              <p role="alert" className="mt-2 flex items-center gap-1 text-sm text-[var(--md-sys-color-error)]">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                {calculationError}
              </p>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-wrap items-center justify-center gap-2 lg:w-32 lg:flex-col">
          {!autoMode && (
            <Button
              onClick={calculateManually}
              disabled={!input || !hmacKey || keyStrength.level === "invalid" || isCalculating}
              size="sm"
            >
              {isCalculating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ArrowRight className="mr-2 h-4 w-4 rotate-90 lg:rotate-0" />
              )}
              {t("calculate")}
            </Button>
          )}
          <Badge variant="secondary" className="text-xs">{selectedAlgorithm.name}</Badge>
          {autoMode && (
            <span className="flex items-center gap-1 text-xs text-[var(--md-sys-color-tertiary)]">
              {isCalculating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />}
              {t("liveCalculation")}
            </span>
          )}
          {autoSwitch && (
            <span className="flex items-center gap-1 text-xs text-[var(--md-sys-color-primary)]">
              <RefreshCw className="h-3 w-3" />
              {t("settingsAutoUpdate")}
            </span>
          )}
          <Button
            onClick={clearAll}
            variant="outline"
            size="sm"
            className="text-[var(--md-sys-color-error)] hover:bg-[var(--md-sys-color-error-container)]"
            disabled={!input && !output && !verifyValue}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            {t("clearInput")}
          </Button>
        </div>

        <Card className="card-modern min-w-0">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <span className="h-3 w-3 rounded-full bg-[var(--md-sys-color-primary)]" />
              {t("hmacOutput")}
              <Badge variant="outline" className="ml-auto text-xs">
                {output.length} {t("characters")}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative">
              <Textarea
                value={output}
                readOnly
                aria-label={t("resultAria")}
                placeholder={isCalculating ? t("calculating") : t("resultPlaceholder")}
                className="min-h-[220px] resize-y pr-11 font-mono text-sm"
              />
              <Button
                onClick={copyOutput}
                disabled={!output}
                aria-label={copied.output ? t("copiedResultAria") : t("copyResultAria")}
                variant="ghost"
                size="icon"
                className="absolute right-2 top-2 h-8 w-8"
              >
                {copied.output ? (
                  <Check className="h-4 w-4 text-[var(--md-sys-color-tertiary)]" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="card-modern mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Key className="h-4 w-4 text-[var(--md-sys-color-primary)]" />
            {t("verifyTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Label htmlFor="verify-hmac">{t("verifyLabel")}</Label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              id="verify-hmac"
              placeholder={t("verifyPlaceholder")}
              value={verifyValue}
              onChange={(event) => setVerifyValue(event.target.value)}
              className="min-w-0 flex-1 font-mono"
              spellCheck={false}
            />
            {verifyResult !== null && (
              <div
                aria-live="polite"
                className={`flex shrink-0 items-center rounded-lg px-3 py-2 text-sm ${
                  verifyResult
                    ? "bg-[var(--md-sys-color-tertiary-container)] text-[var(--md-sys-color-on-tertiary-container)]"
                    : "bg-[var(--md-sys-color-error-container)] text-[var(--md-sys-color-on-error-container)]"
                }`}
              >
                {verifyResult
                  ? `✓ ${t("verifyMatch")} (${selectedAlgorithm.name})`
                  : `✗ ${t("verifyNotMatch")}`}
              </div>
            )}
          </div>
          <p className="text-xs text-[var(--md-sys-color-on-surface-variant)]">
            {outputFormat === "hex" ? t("hexVerificationHint") : t("base64VerificationHint")}
          </p>
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
