"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  ArrowRightLeft,
  Check,
  Clock,
  Copy,
  ExternalLink,
  Info,
  Plus,
  RefreshCw,
  TrendingUp,
  X,
  Zap,
} from "lucide-react"

import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { useTranslations } from "@/hooks/use-translations"
import { useToast } from "@/hooks/use-toast"
import { useI18n } from "@/components/i18n-provider"
import { copyTextToClipboard } from "@/lib/clipboard"
import {
  buildCurrencyValues,
  convertCurrencyAmount,
  getExchangeRate,
  isExchangeRateTable,
  parseCurrencyAmount,
  type ExchangeRateTable,
} from "@/lib/currency-tools"
import { getAllExchangeRates } from "./actions"

const SELECTED_CURRENCIES_KEY = "currency_selected_currencies"
const MULTI_CURRENCIES_KEY = "currency_multi_currencies"
const ACTIVE_TAB_KEY = "currency_active_tab"
const CACHE_KEY = "currency_rates_all"
const CLIENT_CACHE_TTL = 60 * 60 * 1000

const CURRENCIES = [
  { code: "USD", symbol: "$", flag: "🇺🇸" },
  { code: "EUR", symbol: "€", flag: "🇪🇺" },
  { code: "JPY", symbol: "¥", flag: "🇯🇵" },
  { code: "GBP", symbol: "£", flag: "🇬🇧" },
  { code: "AUD", symbol: "A$", flag: "🇦🇺" },
  { code: "CAD", symbol: "C$", flag: "🇨🇦" },
  { code: "CHF", symbol: "Fr", flag: "🇨🇭" },
  { code: "CNY", symbol: "¥", flag: "🇨🇳" },
  { code: "HKD", symbol: "HK$", flag: "🇭🇰" },
  { code: "NZD", symbol: "NZ$", flag: "🇳🇿" },
  { code: "SEK", symbol: "kr", flag: "🇸🇪" },
  { code: "KRW", symbol: "₩", flag: "🇰🇷" },
  { code: "SGD", symbol: "S$", flag: "🇸🇬" },
  { code: "NOK", symbol: "kr", flag: "🇳🇴" },
  { code: "MXN", symbol: "$", flag: "🇲🇽" },
  { code: "INR", symbol: "₹", flag: "🇮🇳" },
  { code: "RUB", symbol: "₽", flag: "🇷🇺" },
  { code: "ZAR", symbol: "R", flag: "🇿🇦" },
  { code: "TRY", symbol: "₺", flag: "🇹🇷" },
  { code: "BRL", symbol: "R$", flag: "🇧🇷" },
  { code: "THB", symbol: "฿", flag: "🇹🇭" },
  { code: "AED", symbol: "د.إ", flag: "🇦🇪" },
  { code: "PHP", symbol: "₱", flag: "🇵🇭" },
  { code: "MYR", symbol: "RM", flag: "🇲🇾" },
  { code: "PLN", symbol: "zł", flag: "🇵🇱" },
] as const

const SUPPORTED_CODES = new Set<string>(CURRENCIES.map((currency) => currency.code))
const DEFAULT_MULTI_CURRENCIES = ["CNY", "USD", "EUR", "JPY"]
const DEFAULT_RATE_TARGETS = ["CNY", "USD", "JPY", "GBP"]
const POPULAR_PAIRS = [
  ["USD", "EUR"],
  ["EUR", "USD"],
  ["USD", "JPY"],
  ["USD", "GBP"],
  ["USD", "CNY"],
  ["EUR", "GBP"],
  ["GBP", "USD"],
  ["AUD", "USD"],
] as const

type CurrencyTab = "single" | "multi" | "multiInput"

interface ClientCacheItem {
  timestamp: number
  data: ExchangeRateTable
}

interface ConversionResult {
  amount: number
  from: string
  to: string
  rate: number
  result: number
}

interface HistoryItem extends ConversionResult {
  id: string
  timestamp: string
}

function readCurrencyList(key: string, fallback: string[]): string[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(key) ?? "null")
    if (!Array.isArray(parsed)) return fallback
    const currencies = [...new Set(parsed.filter((value): value is string => typeof value === "string" && SUPPORTED_CODES.has(value)))]
    return currencies.length > 0 ? currencies : fallback
  } catch {
    return fallback
  }
}

function readClientCache(): ExchangeRateTable | null {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(CACHE_KEY) ?? "null")
    if (!parsed || typeof parsed !== "object") return null
    const cache = parsed as Partial<ClientCacheItem>
    if (
      typeof cache.timestamp !== "number" ||
      Date.now() - cache.timestamp >= CLIENT_CACHE_TTL ||
      !isExchangeRateTable(cache.data)
    ) {
      localStorage.removeItem(CACHE_KEY)
      return null
    }
    return cache.data
  } catch {
    localStorage.removeItem(CACHE_KEY)
    return null
  }
}

function saveClientCache(data: ExchangeRateTable): void {
  try {
    const cache: ClientCacheItem = { timestamp: Date.now(), data }
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache))
  } catch {
    // Storage may be unavailable in private or restricted browser contexts.
  }
}

function saveLocalValue(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    // The converter still works when persistent browser storage is unavailable.
  }
}

function readActiveTab(): CurrencyTab | null {
  try {
    const value = localStorage.getItem(ACTIVE_TAB_KEY)
    return value === "single" || value === "multi" || value === "multiInput"
      ? value
      : null
  } catch {
    return null
  }
}

function sortCnyFirst(codes: readonly string[]): string[] {
  return codes.includes("CNY")
    ? ["CNY", ...codes.filter((code) => code !== "CNY")]
    : [...codes]
}

export default function CurrencyConverterPage() {
  const t = useTranslations("currency")
  const { locale } = useI18n()
  const { toast } = useToast()
  const [autoMode, setAutoMode] = useState(true)
  const [copied, setCopied] = useState<Record<string, boolean>>({})
  const [amount, setAmount] = useState("1")
  const [fromCurrency, setFromCurrency] = useState("USD")
  const [toCurrency, setToCurrency] = useState("CNY")
  const [conversion, setConversion] = useState<ConversionResult | null>(null)
  const [rateData, setRateData] = useState<ExchangeRateTable | null>(null)
  const [loading, setLoading] = useState(true)
  const [dataError, setDataError] = useState("")
  const [amountError, setAmountError] = useState("")
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [selectedRateCurrencies, setSelectedRateCurrencies] = useState<string[]>([])
  const [newRateCurrency, setNewRateCurrency] = useState("")
  const [activeTab, setActiveTab] = useState<CurrencyTab>("single")
  const [multiCurrencies, setMultiCurrencies] = useState<string[]>(DEFAULT_MULTI_CURRENCIES)
  const [newMultiCurrency, setNewMultiCurrency] = useState("")
  const [multiBaseCurrency, setMultiBaseCurrency] = useState("CNY")
  const [multiBaseValue, setMultiBaseValue] = useState("1")
  const [storageLoaded, setStorageLoaded] = useState(false)
  const copyTimeoutsRef = useRef<Record<string, number>>({})
  const rateRequestRef = useRef(0)

  const currencyNames = useMemo(() => {
    let displayNames: Intl.DisplayNames | null = null
    try {
      displayNames = new Intl.DisplayNames([locale], { type: "currency" })
    } catch {
      displayNames = null
    }
    return Object.fromEntries(
      CURRENCIES.map((currency) => [
        currency.code,
        displayNames?.of(currency.code) ?? currency.code,
      ]),
    ) as Record<string, string>
  }, [locale])

  const currencyMetadata = useMemo(
    () => Object.fromEntries(CURRENCIES.map((currency) => [currency.code, currency])),
    [],
  )

  const getCurrency = useCallback(
    (code: string) => ({
      code,
      symbol: currencyMetadata[code]?.symbol ?? "",
      flag: currencyMetadata[code]?.flag ?? "",
      name: currencyNames[code] ?? code,
    }),
    [currencyMetadata, currencyNames],
  )

  const formatAmount = useCallback(
    (value: number) =>
      new Intl.NumberFormat(locale, {
        minimumFractionDigits: 2,
        maximumFractionDigits: Math.abs(value) > 0 && Math.abs(value) < 0.01 ? 6 : 2,
      }).format(value),
    [locale],
  )

  const formatRate = useCallback(
    (value: number) =>
      new Intl.NumberFormat(locale, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 6,
      }).format(value),
    [locale],
  )

  const lastUpdated = useMemo(
    () => rateData ? new Date(rateData.lastUpdated).toLocaleString(locale) : "",
    [locale, rateData],
  )

  const fetchRates = useCallback(
    async (forceRefresh = false) => {
      const requestId = ++rateRequestRef.current
      setLoading(true)
      setDataError("")
      try {
        if (!forceRefresh) {
          const cached = readClientCache()
          if (cached) {
            if (requestId === rateRequestRef.current) setRateData(cached)
            return
          }
        } else {
          try {
            localStorage.removeItem(CACHE_KEY)
          } catch {
            // A forced server refresh can continue without local storage access.
          }
        }

        const response = await getAllExchangeRates(forceRefresh)
        const table: ExchangeRateTable = {
          baseCurrency: response.baseCurrency,
          rates: response.rates,
          lastUpdated: response.lastUpdated,
        }
        if (!isExchangeRateTable(table)) throw new Error("Invalid exchange-rate response")
        if (requestId !== rateRequestRef.current) return
        setRateData(table)
        saveClientCache(table)
      } catch {
        if (requestId === rateRequestRef.current) setDataError(t("conversionError"))
      } finally {
        if (requestId === rateRequestRef.current) setLoading(false)
      }
    },
    [t],
  )

  useEffect(() => {
    void fetchRates()
  }, [fetchRates])

  useEffect(() => {
    const selected = readCurrencyList(SELECTED_CURRENCIES_KEY, [])
    const multi = readCurrencyList(MULTI_CURRENCIES_KEY, DEFAULT_MULTI_CURRENCIES)
    const savedTab = readActiveTab()
    setSelectedRateCurrencies(selected)
    setMultiCurrencies(multi)
    if (savedTab) setActiveTab(savedTab)
    if (!multi.includes("CNY")) {
      setMultiBaseCurrency(multi[0] ?? "")
    }
    setStorageLoaded(true)
  }, [])

  useEffect(() => {
    if (!storageLoaded) return
    saveLocalValue(SELECTED_CURRENCIES_KEY, JSON.stringify(selectedRateCurrencies))
  }, [selectedRateCurrencies, storageLoaded])

  useEffect(() => {
    if (!storageLoaded) return
    saveLocalValue(MULTI_CURRENCIES_KEY, JSON.stringify(multiCurrencies))
  }, [multiCurrencies, storageLoaded])

  useEffect(() => {
    if (!storageLoaded) return
    saveLocalValue(ACTIVE_TAB_KEY, activeTab)
  }, [activeTab, storageLoaded])

  useEffect(() => {
    const timeouts = copyTimeoutsRef.current
    return () => {
      Object.values(timeouts).forEach(window.clearTimeout)
      rateRequestRef.current += 1
    }
  }, [])

  const calculateSingle = useCallback(
    (addToHistory: boolean, showInvalidAmount: boolean) => {
      const parsedAmount = parseCurrencyAmount(amount)
      if (parsedAmount === null) {
        setConversion(null)
        setAmountError(showInvalidAmount && amount.trim() ? t("invalidAmount") : "")
        return
      }
      if (!rateData) return

      const exchangeRate = getExchangeRate(rateData, fromCurrency, toCurrency)
      const converted = convertCurrencyAmount(rateData, parsedAmount, fromCurrency, toCurrency)
      if (exchangeRate === null || converted === null) {
        setConversion(null)
        setDataError(t("conversionError"))
        return
      }

      const nextConversion: ConversionResult = {
        amount: parsedAmount,
        from: fromCurrency,
        to: toCurrency,
        rate: exchangeRate,
        result: converted,
      }
      setConversion(nextConversion)
      setAmountError("")

      if (addToHistory) {
        const historyItem: HistoryItem = {
          ...nextConversion,
          id: `${Date.now()}-${fromCurrency}-${toCurrency}`,
          timestamp: new Date().toISOString(),
        }
        setHistory((current) => [historyItem, ...current].slice(0, 10))
      }
    },
    [amount, fromCurrency, rateData, t, toCurrency],
  )

  useEffect(() => {
    if (autoMode) {
      calculateSingle(false, false)
    } else {
      setConversion(null)
      setAmountError("")
    }
  }, [autoMode, calculateSingle])

  const rateTargets = useMemo(
    () => [
      ...new Set([
        ...DEFAULT_RATE_TARGETS,
        ...selectedRateCurrencies,
        toCurrency,
      ]),
    ].filter((code) => code !== fromCurrency),
    [fromCurrency, selectedRateCurrencies, toCurrency],
  )

  const multipleRates = useMemo(() => {
    const parsedAmount = parseCurrencyAmount(amount)
    if (!rateData || parsedAmount === null) return []

    return sortCnyFirst(rateTargets).flatMap((code) => {
      const rate = getExchangeRate(rateData, fromCurrency, code)
      const converted = convertCurrencyAmount(rateData, parsedAmount, fromCurrency, code)
      return rate === null || converted === null
        ? []
        : [{ code, rate, converted }]
    })
  }, [amount, fromCurrency, rateData, rateTargets])

  const multiValues = useMemo(() => {
    if (
      !rateData ||
      !multiBaseCurrency ||
      !multiCurrencies.includes(multiBaseCurrency)
    ) {
      return multiBaseCurrency ? { [multiBaseCurrency]: multiBaseValue } : {}
    }
    const parsed = parseCurrencyAmount(multiBaseValue)
    if (parsed === null) {
      return Object.fromEntries(
        multiCurrencies.map((code) => [code, code === multiBaseCurrency ? multiBaseValue : ""]),
      )
    }
    const values = buildCurrencyValues(
      rateData,
      parsed,
      multiBaseCurrency,
      multiCurrencies,
    )
    values[multiBaseCurrency] = multiBaseValue
    return values
  }, [multiBaseCurrency, multiBaseValue, multiCurrencies, rateData])

  const copyResult = useCallback(
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

  const addRateCurrency = () => {
    if (
      newRateCurrency &&
      newRateCurrency !== fromCurrency &&
      !selectedRateCurrencies.includes(newRateCurrency)
    ) {
      setSelectedRateCurrencies((current) => [...current, newRateCurrency])
      setNewRateCurrency("")
    }
  }

  const addMultiCurrency = () => {
    if (newMultiCurrency && !multiCurrencies.includes(newMultiCurrency)) {
      setMultiCurrencies((current) => [...current, newMultiCurrency])
      if (!multiBaseCurrency) {
        setMultiBaseCurrency(newMultiCurrency)
        setMultiBaseValue("1")
      }
      setNewMultiCurrency("")
    }
  }

  const removeMultiCurrency = (code: string) => {
    const remaining = multiCurrencies.filter((currency) => currency !== code)
    if (multiBaseCurrency === code) {
      const nextBase = remaining[0] ?? ""
      setMultiBaseValue(nextBase ? multiValues[nextBase] ?? "1" : "")
      setMultiBaseCurrency(nextBase)
    }
    setMultiCurrencies(remaining)
  }

  const fromInfo = getCurrency(fromCurrency)
  const toInfo = getCurrency(toCurrency)

  return (
    <div className="container mx-auto max-w-6xl px-4 py-4 sm:py-6">
      <div className="mb-6 text-center sm:mb-8">
        <h1 className="mb-2 flex items-center justify-center gap-2 text-2xl font-bold text-[var(--md-sys-color-on-surface)] sm:text-3xl">
          <TrendingUp className="h-7 w-7 text-[var(--md-sys-color-primary)] sm:h-8 sm:w-8" />
          {t("title")}
        </h1>
        <p className="text-sm text-[var(--md-sys-color-on-surface-variant)]">
          {t("description")}
        </p>
      </div>

      <Card className="card-modern mb-6">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4 text-[var(--md-sys-color-primary)]" />
            {t("singleConversion")}
          </CardTitle>
          <div className="flex flex-wrap items-center gap-3">
            <Label htmlFor="currency-auto-mode" className="cursor-pointer text-sm">
              {t("liveConversion")}
            </Label>
            <Switch id="currency-auto-mode" checked={autoMode} onCheckedChange={setAutoMode} />
            <Button
              variant="outline"
              size="sm"
              onClick={() => void fetchRates(true)}
              disabled={loading}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              {t("refreshRates")}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="currency-amount">{t("amount")}</Label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-[var(--md-sys-color-on-surface-variant)]">
                {fromInfo.symbol}
              </span>
              <Input
                id="currency-amount"
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={(event) => {
                  const value = event.target.value
                  if (/^\d*\.?\d*$/.test(value)) setAmount(value)
                }}
                onBlur={() => {
                  setAmountError(
                    amount.trim() && parseCurrencyAmount(amount) === null
                      ? t("invalidAmount")
                      : "",
                  )
                }}
                className="h-12 pl-10 text-lg"
                placeholder="1.00"
                aria-invalid={Boolean(amountError)}
              />
            </div>
            {amountError && (
              <p role="alert" className="text-sm text-[var(--md-sys-color-error)]">{amountError}</p>
            )}
          </div>

          <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
            <CurrencySelect
              id="currency-from"
              label={t("from")}
              value={fromCurrency}
              onValueChange={(value) => {
                setFromCurrency(value)
                setNewRateCurrency("")
              }}
              names={currencyNames}
            />
            <Button
              variant="outline"
              size="icon"
              onClick={() => {
                setFromCurrency(toCurrency)
                setToCurrency(fromCurrency)
                setNewRateCurrency("")
              }}
              className="justify-self-center rounded-full sm:mb-0"
              aria-label={t("swapCurrencies")}
            >
              <ArrowRightLeft className="h-4 w-4 rotate-90 sm:rotate-0" />
            </Button>
            <CurrencySelect
              id="currency-to"
              label={t("to")}
              value={toCurrency}
              onValueChange={setToCurrency}
              names={currencyNames}
            />
          </div>

          {!autoMode && (
            <Button
              onClick={() => calculateSingle(true, true)}
              disabled={loading || !rateData || parseCurrencyAmount(amount) === null}
              className="w-full sm:w-auto"
            >
              <TrendingUp className="mr-2 h-4 w-4" />
              {t("convert")}
            </Button>
          )}
          {autoMode && (
            <div className="flex items-center gap-2 rounded-xl bg-[var(--md-sys-color-primary-container)] px-3 py-2 text-sm text-[var(--md-sys-color-on-primary-container)]">
              <Zap className="h-4 w-4" />
              {t("liveConversionEnabled")}
            </div>
          )}
        </CardContent>
      </Card>

      {(dataError || loading) && (
        <div className="mb-6">
          {loading ? (
            <Skeleton className="h-12 w-full rounded-xl" />
          ) : (
            <div role="alert" className="rounded-xl bg-[var(--md-sys-color-error-container)] p-3 text-[var(--md-sys-color-on-error-container)]">
              {dataError}
            </div>
          )}
        </div>
      )}

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as CurrencyTab)}>
        <TabsList className="grid h-auto w-full grid-cols-3">
          <TabsTrigger value="single" className="whitespace-normal px-1 text-xs sm:text-sm">
            {t("singleResult")}
          </TabsTrigger>
          <TabsTrigger value="multi" className="whitespace-normal px-1 text-xs sm:text-sm">
            {t("multipleRates")}
          </TabsTrigger>
          <TabsTrigger value="multiInput" className="whitespace-normal px-1 text-xs sm:text-sm">
            {t("multiCurrencyInput")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="single" className="mt-6">
          <Card className="card-modern">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp className="h-4 w-4 text-[var(--md-sys-color-primary)]" />
                {t("result")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-4">
                  <Skeleton className="h-24 w-full" />
                  <Skeleton className="mx-auto h-5 w-2/3" />
                </div>
              ) : conversion ? (
                <div className="space-y-4 text-center">
                  <div className="rounded-2xl bg-[var(--md-sys-color-primary-container)] p-4 text-[var(--md-sys-color-on-primary-container)] sm:p-6">
                    <div className="flex flex-wrap items-baseline justify-center gap-x-2 gap-y-1 text-2xl font-bold sm:text-3xl">
                      <span aria-hidden="true">{getCurrency(conversion.from).flag}</span>
                      <span>{formatAmount(conversion.amount)}</span>
                      <span className="text-base font-medium">{conversion.from}</span>
                      <span className="mx-1 opacity-70">=</span>
                      <span aria-hidden="true">{getCurrency(conversion.to).flag}</span>
                      <span>{formatAmount(conversion.result)}</span>
                      <span className="text-base font-medium">{conversion.to}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void copyResult(`${formatAmount(conversion.result)} ${conversion.to}`, "single-result")}
                      className="mt-3"
                    >
                      {copied["single-result"] ? <Check className="mr-1 h-4 w-4" /> : <Copy className="mr-1 h-4 w-4" />}
                      {copied["single-result"] ? t("copied") : t("copyResult")}
                    </Button>
                  </div>
                  <div className="rounded-xl bg-[var(--md-sys-color-surface-container-low)] p-4">
                    <div className="mb-1 text-sm text-[var(--md-sys-color-on-surface-variant)]">{t("exchangeRate")}</div>
                    <div className="font-medium">
                      1 {conversion.from} = {formatRate(conversion.rate)} {conversion.to}
                    </div>
                  </div>
                  <UpdatedAt value={lastUpdated} label={t("lastUpdated")} />
                </div>
              ) : (
                <div className="py-10 text-center text-[var(--md-sys-color-on-surface-variant)]">
                  <TrendingUp className="mx-auto mb-3 h-12 w-12 opacity-40" />
                  {t("enterAmount")}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="multi" className="mt-6">
          <Card className="card-modern">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">
                {t("multipleRatesFor")} {fromInfo.flag} {fromCurrency}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm text-[var(--md-sys-color-on-surface-variant)]">
                {parseCurrencyAmount(amount) === null ? "—" : formatAmount(Number(amount))} {fromCurrency}
              </div>
              <CurrencyAdder
                value={newRateCurrency}
                onValueChange={setNewRateCurrency}
                onAdd={addRateCurrency}
                excluded={[fromCurrency, ...selectedRateCurrencies]}
                names={currencyNames}
                placeholder={t("addMoreCurrencies")}
                addLabel={t("add")}
              />
              {selectedRateCurrencies.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {selectedRateCurrencies.map((code) => (
                    <Badge key={code} variant="secondary" className="gap-1 py-1 pl-2 pr-1">
                      {getCurrency(code).flag} {code}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => setSelectedRateCurrencies((current) => current.filter((item) => item !== code))}
                        aria-label={`${t("removeCurrency")} ${code}`}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </Badge>
                  ))}
                </div>
              )}
              {loading ? (
                <div className="space-y-2">
                  {[1, 2, 3, 4].map((value) => <Skeleton key={value} className="h-16 w-full" />)}
                </div>
              ) : multipleRates.length > 0 ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {multipleRates.map((item) => {
                    const info = getCurrency(item.code)
                    return (
                      <div key={item.code} className="flex min-w-0 items-center justify-between gap-3 rounded-xl bg-[var(--md-sys-color-surface-container-low)] p-3">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="text-xl" aria-hidden="true">{info.flag}</span>
                          <span className="min-w-0">
                            <span className="block truncate font-medium">{info.name}</span>
                            <span className="block text-xs text-[var(--md-sys-color-on-surface-variant)]">{item.code}</span>
                          </span>
                        </div>
                        <div className="shrink-0 text-right">
                          <div className="font-bold">{formatAmount(item.converted)}</div>
                          <div className="text-xs text-[var(--md-sys-color-on-surface-variant)]">
                            1 {fromCurrency} = {formatRate(item.rate)}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="py-6 text-center text-[var(--md-sys-color-on-surface-variant)]">
                  {t("enterAmount")}
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="multiInput" className="mt-6">
          <Card className="card-modern">
            <CardHeader className="pb-3">
              <CardTitle>{t("multiCurrencyConverter")}</CardTitle>
              <p className="text-sm text-[var(--md-sys-color-on-surface-variant)]">
                {t("multiCurrencyDescription")}
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <CurrencyAdder
                value={newMultiCurrency}
                onValueChange={setNewMultiCurrency}
                onAdd={addMultiCurrency}
                excluded={multiCurrencies}
                names={currencyNames}
                placeholder={t("addMoreCurrencies")}
                addLabel={t("add")}
              />
              {multiCurrencies.length > 0 ? (
                <div className="space-y-3">
                  {sortCnyFirst(multiCurrencies).map((code) => {
                    const info = getCurrency(code)
                    return (
                      <div key={code} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-xl bg-[var(--md-sys-color-surface-container-low)] p-3">
                        <div className="flex min-w-16 items-center gap-1.5 sm:min-w-32">
                          <span className="text-xl" aria-hidden="true">{info.flag}</span>
                          <span>
                            <span className="block font-medium">{code}</span>
                            <span className="hidden max-w-28 truncate text-xs text-[var(--md-sys-color-on-surface-variant)] sm:block">
                              {info.name}
                            </span>
                          </span>
                        </div>
                        <div className="relative min-w-0">
                          <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-[var(--md-sys-color-on-surface-variant)]">
                            {info.symbol}
                          </span>
                          <Input
                            type="text"
                            inputMode="decimal"
                            value={multiValues[code] ?? ""}
                            onChange={(event) => {
                              const value = event.target.value
                              if (!/^\d*\.?\d*$/.test(value)) return
                              setMultiBaseCurrency(code)
                              setMultiBaseValue(value)
                            }}
                            className="min-w-0 pl-11"
                            aria-label={`${info.name} (${code})`}
                          />
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeMultiCurrency(code)}
                          className="text-[var(--md-sys-color-on-surface-variant)] hover:text-[var(--md-sys-color-error)]"
                          aria-label={`${t("removeCurrency")} ${code}`}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-[var(--md-sys-color-outline-variant)] p-8 text-center text-[var(--md-sys-color-on-surface-variant)]">
                  {t("selectCurrenciesToStart")}
                </div>
              )}
              <UpdatedAt value={lastUpdated} label={t("lastUpdated")} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <section className="mt-8">
        <h2 className="mb-4 text-lg font-medium">{t("popularPairs")}</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {POPULAR_PAIRS.map(([from, to]) => (
            <Button
              key={`${from}-${to}`}
              variant="outline"
              className="h-auto min-w-0 justify-start py-3"
              onClick={() => {
                setFromCurrency(from)
                setToCurrency(to)
                setActiveTab("single")
              }}
            >
              <span className="flex min-w-0 items-center">
                {getCurrency(from).flag}
                <span className="ml-1 truncate">{from}</span>
                <ArrowRightLeft className="mx-1 h-3 w-3 shrink-0" />
                {getCurrency(to).flag}
                <span className="ml-1 truncate">{to}</span>
              </span>
            </Button>
          ))}
        </div>
      </section>

      {history.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-4 text-lg font-medium">{t("conversionHistory")}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {history.map((item) => (
              <div key={item.id} className="rounded-xl bg-[var(--md-sys-color-surface-container-low)] p-3">
                <div className="mb-2 flex items-center justify-between gap-2 text-xs text-[var(--md-sys-color-on-surface-variant)]">
                  <span>{new Date(item.timestamp).toLocaleString(locale)}</span>
                  <span>{item.from} → {item.to}</span>
                </div>
                <div className="flex flex-wrap items-center gap-2 font-medium">
                  <span>{formatAmount(item.amount)} {item.from}</span>
                  <span>=</span>
                  <span>{formatAmount(item.result)} {item.to}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <footer className="mt-8 space-y-2 border-t border-[var(--md-sys-color-outline-variant)] pt-4 text-xs text-[var(--md-sys-color-on-surface-variant)]">
        <UpdatedAt value={lastUpdated} label={t("lastUpdated")} />
        <p className="flex flex-wrap items-center gap-1">
          <Info className="h-3.5 w-3.5" />
          {t("dataSourceLabel")}
          <a
            href="https://www.exchangerate-api.com"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-[var(--md-sys-color-primary)] underline-offset-2 hover:underline"
          >
            ExchangeRate-API Open Access
            <ExternalLink className="h-3 w-3" />
          </a>
          · {t("providerUpdateInfo")}
        </p>
        <p>{t("cacheInfo")}</p>
        <p>{t("disclaimer")}</p>
      </footer>
    </div>
  )
}

interface CurrencySelectProps {
  id: string
  label: string
  value: string
  onValueChange: (value: string) => void
  names: Record<string, string>
}

function CurrencySelect({ id, label, value, onValueChange, names }: CurrencySelectProps) {
  return (
    <div className="min-w-0 space-y-1">
      <Label htmlFor={id} className="text-xs text-[var(--md-sys-color-on-surface-variant)]">
        {label}
      </Label>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger id={id} className="h-12 w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent position="popper" sideOffset={5} align="start">
          {CURRENCIES.map((currency) => (
            <SelectItem key={currency.code} value={currency.code}>
              <span className="flex min-w-0 items-center">
                <span className="mr-2" aria-hidden="true">{currency.flag}</span>
                <span className="font-medium">{currency.code}</span>
                <span className="ml-2 truncate text-sm text-[var(--md-sys-color-on-surface-variant)]">
                  – {names[currency.code]}
                </span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

interface CurrencyAdderProps {
  value: string
  onValueChange: (value: string) => void
  onAdd: () => void
  excluded: readonly string[]
  names: Record<string, string>
  placeholder: string
  addLabel: string
}

function CurrencyAdder({
  value,
  onValueChange,
  onAdd,
  excluded,
  names,
  placeholder,
  addLabel,
}: CurrencyAdderProps) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger className="min-w-0 flex-1">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {CURRENCIES.filter((currency) => !excluded.includes(currency.code)).map((currency) => (
            <SelectItem key={currency.code} value={currency.code}>
              {currency.flag} {currency.code} – {names[currency.code]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button onClick={onAdd} disabled={!value} className="w-full sm:w-auto">
        <Plus className="mr-1 h-4 w-4" />
        {addLabel}
      </Button>
    </div>
  )
}

function UpdatedAt({ value, label }: { value: string; label: string }) {
  if (!value) return null
  return (
    <div className="flex items-center justify-center text-xs text-[var(--md-sys-color-on-surface-variant)]">
      <Clock className="mr-1 h-3 w-3" />
      {label}: {value}
    </div>
  )
}
