"use client"

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import {
  Activity,
  AlertTriangle,
  Building,
  Calendar,
  CheckCircle2,
  Clock,
  Copy,
  Database,
  Download,
  Globe,
  History,
  Info,
  Mail,
  MapPin,
  Network,
  Phone,
  RefreshCw,
  Search,
  Server,
  Shield,
  Trash2,
  User,
  X,
} from "lucide-react"

import { useI18n } from "@/components/i18n-provider"
import { JsonTreeView } from "@/components/json-tree-view"
import { useToolActivity } from "@/components/tool-activity"
import { useToolRuntimeParams } from "@/components/tool-runtime-params"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/hooks/use-toast"
import { useTranslations } from "@/hooks/use-translations"
import { createClientId } from "@/lib/client-id"
import { copyTextToClipboard } from "@/lib/clipboard"
import { downloadBlob } from "@/lib/object-url"
import { parseRdapResponse, type ParsedRdapData } from "@/lib/rdap-response"
import {
  buildRdapQueryUrl,
  detectRdapQueryType,
  findDomainRdapServer,
  findIpRdapServer,
  normalizeRdapQuery,
  type RdapBootstrapRegistry,
  type RdapQueryType,
} from "@/lib/whois-tools"

type ConcreteQueryType = Exclude<RdapQueryType, "auto">

interface QueryHistoryItem {
  id: string
  query: string
  type: ConcreteQueryType
  timestamp: number
  success: boolean
  rdapServer?: string
  duration: number
}

const WHOIS_CARD_CLASS =
  "min-w-0 rounded-[var(--md-sys-shape-corner-large)] border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container-lowest)] shadow-sm"
const QUERY_TIMEOUT_MS = 15_000
const BOOTSTRAP_URLS = {
  domain: "https://data.iana.org/rdap/dns.json",
  ipv4: "https://data.iana.org/rdap/ipv4.json",
  ipv6: "https://data.iana.org/rdap/ipv6.json",
} as const

function isBootstrapRegistry(value: unknown): value is RdapBootstrapRegistry {
  return Boolean(
    value &&
    typeof value === "object" &&
    Array.isArray((value as { services?: unknown }).services),
  )
}

function getRdapErrorMessage(value: unknown): string | undefined {
  if (!value || typeof value !== "object") return undefined
  const record = value as Record<string, unknown>
  if (typeof record.title === "string") return record.title
  if (typeof record.description === "string") return record.description
  if (Array.isArray(record.description)) {
    const text = record.description.find((item): item is string => typeof item === "string")
    if (text) return text
  }
  return undefined
}

function InfoRow({
  icon,
  label,
  value,
  mono = false,
}: {
  icon: ReactNode
  label: string
  value?: ReactNode
  mono?: boolean
}) {
  if (value === undefined || value === null || value === "") return null
  return (
    <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-start gap-x-2 gap-y-1 rounded-xl bg-[var(--md-sys-color-surface-container-low)] px-3 py-2.5">
      <span className="row-span-2 mt-0.5 text-[var(--md-sys-color-primary)]">{icon}</span>
      <span className="text-xs font-medium text-[var(--md-sys-color-on-surface-variant)]">{label}</span>
      <span className={`min-w-0 break-words text-sm [overflow-wrap:anywhere] ${mono ? "font-mono" : ""}`}>
        {value}
      </span>
    </div>
  )
}

export default function RdapQueryPage() {
  const t = useTranslations("whois")
  const { locale } = useI18n()
  const params = useToolRuntimeParams()
  const isToolActive = useToolActivity()
  const { toast } = useToast()

  const [query, setQuery] = useState(params?.domain || "")
  const [queryType, setQueryType] = useState<RdapQueryType>("auto")
  const [rdapData, setRdapData] = useState<ParsedRdapData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState("formatted")
  const [history, setHistory] = useState<QueryHistoryItem[]>([])
  const [historyExpanded, setHistoryExpanded] = useState(false)

  const bootstrapCacheRef = useRef(new Map<ConcreteQueryType, RdapBootstrapRegistry>())
  const requestControllerRef = useRef<AbortController | null>(null)
  const requestRunRef = useRef(0)
  const autoQueriedParamRef = useRef("")

  const detectedType = useMemo(() => detectRdapQueryType(query), [query])
  const stats = useMemo(() => {
    const successful = history.filter((item) => item.success).length
    const totalDuration = history.reduce((sum, item) => sum + item.duration, 0)
    return {
      total: history.length,
      successRate: history.length ? Math.round((successful / history.length) * 100) : 0,
      averageDuration: history.length ? Math.round(totalDuration / history.length) : 0,
    }
  }, [history])

  const cancelRequest = useCallback(() => {
    requestRunRef.current += 1
    requestControllerRef.current?.abort()
    requestControllerRef.current = null
    setLoading(false)
  }, [])

  useEffect(() => () => {
    requestRunRef.current += 1
    requestControllerRef.current?.abort()
  }, [])

  useEffect(() => {
    if (!isToolActive) cancelRequest()
  }, [cancelRequest, isToolActive])

  const getBootstrapRegistry = useCallback(async (
    type: ConcreteQueryType,
    signal: AbortSignal,
  ): Promise<RdapBootstrapRegistry> => {
    const cached = bootstrapCacheRef.current.get(type)
    if (cached) return cached

    const response = await fetch(BOOTSTRAP_URLS[type], {
      headers: { Accept: "application/json" },
      signal,
    })
    if (!response.ok) throw new Error(`${t("bootstrapError")} (${response.status})`)
    const data: unknown = await response.json()
    if (!isBootstrapRegistry(data)) throw new Error(t("invalidBootstrap"))
    bootstrapCacheRef.current.set(type, data)
    return data
  }, [t])

  const saveHistory = useCallback((
    queryText: string,
    type: ConcreteQueryType,
    success: boolean,
    duration: number,
    rdapServer?: string,
  ) => {
    const item: QueryHistoryItem = {
      id: createClientId("rdap-history"),
      query: queryText,
      type,
      timestamp: Date.now(),
      success,
      rdapServer,
      duration,
    }
    setHistory((previous) => [item, ...previous].slice(0, 50))
  }, [])

  const runQuery = useCallback(async (
    input: string,
    typeOverride?: ConcreteQueryType,
  ) => {
    const normalized = normalizeRdapQuery(input)
    if (!normalized) {
      setError(t("emptyQuery"))
      return
    }

    const inferred = detectRdapQueryType(normalized)
    const actualType = typeOverride ?? (queryType === "auto" ? inferred : queryType)
    if (actualType === "auto") {
      setError(t("unknownQueryType"))
      return
    }
    if (
      (actualType === "ipv4" && inferred !== "ipv4") ||
      (actualType === "ipv6" && inferred !== "ipv6") ||
      (actualType === "domain" && inferred !== "domain")
    ) {
      setError(t("queryTypeMismatch"))
      return
    }

    requestControllerRef.current?.abort()
    const controller = new AbortController()
    requestControllerRef.current = controller
    const runId = ++requestRunRef.current
    const startedAt = performance.now()
    let timedOut = false
    let rdapServer: string | undefined
    const timeout = window.setTimeout(() => {
      timedOut = true
      controller.abort()
    }, QUERY_TIMEOUT_MS)

    setQuery(normalized)
    setLoading(true)
    setError(null)
    setRdapData(null)

    try {
      const registry = await getBootstrapRegistry(actualType, controller.signal)
      rdapServer = actualType === "domain"
        ? findDomainRdapServer(normalized, registry) ?? undefined
        : findIpRdapServer(normalized, registry) ?? undefined
      if (!rdapServer) throw new Error(t("serverNotFound"))

      const objectType = actualType === "domain" ? "domain" : "ip"
      const rdapUrl = buildRdapQueryUrl(rdapServer, objectType, normalized)
      const response = await fetch(rdapUrl, {
        headers: { Accept: "application/rdap+json, application/json" },
        signal: controller.signal,
      })

      let responseData: unknown
      try {
        responseData = await response.json()
      } catch {
        responseData = null
      }

      if (!response.ok) {
        if (response.status === 404) throw new Error(t("notFound"))
        const serverMessage = getRdapErrorMessage(responseData)
        throw new Error(serverMessage || `${t("serverError")} (${response.status})`)
      }

      const duration = Math.round(performance.now() - startedAt)
      const parsed = parseRdapResponse(responseData, {
        queryTarget: normalized,
        queryType: actualType,
        rdapServer,
        queryTime: duration,
      })
      if (runId !== requestRunRef.current) return

      setRdapData(parsed)
      saveHistory(normalized, actualType, true, duration, rdapServer)
      toast({
        title: t("querySuccess"),
        description: `${t("completedIn")} ${duration} ms`,
      })
    } catch (queryError) {
      if (runId !== requestRunRef.current) return
      const duration = Math.round(performance.now() - startedAt)
      const isAbort = queryError instanceof DOMException && queryError.name === "AbortError"
      if (isAbort && !timedOut) return

      const message = timedOut
        ? t("requestTimeout")
        : queryError instanceof TypeError
          ? t("networkOrCorsError")
          : queryError instanceof Error
            ? queryError.message
            : t("networkError")
      setError(message)
      saveHistory(normalized, actualType, false, duration, rdapServer)
      toast({ title: t("queryFailed"), description: message, variant: "destructive" })
    } finally {
      window.clearTimeout(timeout)
      if (runId === requestRunRef.current) {
        requestControllerRef.current = null
        setLoading(false)
      }
    }
  }, [getBootstrapRegistry, queryType, saveHistory, t, toast])

  useEffect(() => {
    const initialQuery = params?.domain?.trim()
    if (!initialQuery || autoQueriedParamRef.current === initialQuery) return
    autoQueriedParamRef.current = initialQuery
    setQuery(initialQuery)
    void runQuery(initialQuery)
  }, [params?.domain, runQuery])

  const formatDate = useCallback((dateString?: string) => {
    if (!dateString) return t("notAvailable")
    const date = new Date(dateString)
    if (Number.isNaN(date.getTime())) return dateString
    return new Intl.DateTimeFormat(locale, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date)
  }, [locale, t])

  const copyRawData = useCallback(async () => {
    if (!rdapData?.raw) return
    const success = await copyTextToClipboard(rdapData.raw)
    toast({
      title: success ? t("copied") : t("copyFailed"),
      description: success ? t("copiedDescription") : undefined,
      variant: success ? "default" : "destructive",
    })
  }, [rdapData?.raw, t, toast])

  const exportRawData = useCallback(() => {
    if (!rdapData?.raw) return
    const safeName = (rdapData.domainName || "rdap").replace(/[^a-z0-9._-]+/gi, "_")
    downloadBlob(
      new Blob([rdapData.raw], { type: "application/json;charset=utf-8" }),
      `rdap-${safeName}.json`,
    )
  }, [rdapData])

  const submitQuery = (event: React.FormEvent) => {
    event.preventDefault()
    void runQuery(query)
  }

  const historyItems = historyExpanded ? history : history.slice(0, 5)

  return (
    <div className="container mx-auto max-w-7xl overflow-x-clip px-3 py-4 sm:px-4 sm:py-6">
      <header className="mb-5 flex items-center gap-3 sm:mb-7 sm:justify-center">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--md-sys-color-primary-container)] text-[var(--md-sys-color-on-primary-container)]">
          <Database className="h-6 w-6" />
        </span>
        <div className="min-w-0 sm:text-center">
          <h1 className="text-xl font-bold tracking-tight text-[var(--md-sys-color-on-surface)] sm:text-3xl">
            {t("title")}
          </h1>
          <p className="mt-0.5 text-xs leading-5 text-[var(--md-sys-color-on-surface-variant)] sm:text-sm">
            {t("description")}
          </p>
        </div>
      </header>

      <Card className={`mb-4 ${WHOIS_CARD_CLASS}`}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Search className="h-5 w-5 text-[var(--md-sys-color-primary)]" />
            {t("queryTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={submitQuery} className="grid min-w-0 gap-2 md:grid-cols-[11rem_minmax(0,1fr)_auto]">
            <div className="min-w-0">
              <Label htmlFor="query-type" className="sr-only">{t("queryType")}</Label>
              <Select value={queryType} onValueChange={(value) => setQueryType(value as RdapQueryType)}>
                <SelectTrigger id="query-type" className="h-11 w-full rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">{t("autoDetect")}</SelectItem>
                  <SelectItem value="domain">{t("domain")}</SelectItem>
                  <SelectItem value="ipv4">{t("ipv4")}</SelectItem>
                  <SelectItem value="ipv6">{t("ipv6")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="relative min-w-0">
              <Label htmlFor="rdap-query" className="sr-only">{t("queryInput")}</Label>
              <Globe className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-[var(--md-sys-color-on-surface-variant)]" />
              <Input
                id="rdap-query"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value)
                  setError(null)
                }}
                placeholder={t("queryPlaceholder")}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                className="h-11 min-w-0 rounded-xl pl-9"
              />
            </div>
            {loading ? (
              <Button type="button" variant="outline" className="h-11 rounded-full" onClick={cancelRequest}>
                <X className="mr-2 h-4 w-4" />
                {t("cancel")}
              </Button>
            ) : (
              <Button type="submit" className="h-11 rounded-full px-6" disabled={!query.trim()}>
                <Search className="mr-2 h-4 w-4" />
                {t("lookup")}
              </Button>
            )}
          </form>

          <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--md-sys-color-on-surface-variant)]">
            {detectedType !== "auto" && (
              <Badge variant="secondary">
                {t("detected")}: {t(detectedType)}
              </Badge>
            )}
            {["example.com", "8.8.8.8", "2001:4860:4860::8888"].map((example) => (
              <button
                key={example}
                type="button"
                className="rounded-full border border-[var(--md-sys-color-outline-variant)] px-2.5 py-1 font-mono transition-colors hover:bg-[var(--md-sys-color-surface-container)]"
                onClick={() => {
                  setQuery(example)
                  void runQuery(example)
                }}
              >
                {example}
              </button>
            ))}
          </div>

          <p className="flex items-start gap-2 rounded-xl bg-[var(--md-sys-color-secondary-container)] px-3 py-2 text-xs leading-5 text-[var(--md-sys-color-on-secondary-container)]">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            {t("networkDisclosure")}
          </p>
        </CardContent>
      </Card>

      <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-[18rem_minmax(0,1fr)] lg:gap-6">
        <main className="order-1 min-w-0 space-y-4 lg:order-2">
          {loading && (
            <Card className={WHOIS_CARD_CLASS}>
              <CardContent className="space-y-5 p-5 sm:p-6">
                <div className="flex items-center gap-3">
                  <RefreshCw className="h-5 w-5 animate-spin text-[var(--md-sys-color-primary)]" />
                  <span className="font-medium">{t("querying")}</span>
                </div>
                <Skeleton className="h-20 w-full rounded-2xl" />
                <div className="grid gap-3 sm:grid-cols-2">
                  <Skeleton className="h-24 rounded-2xl" />
                  <Skeleton className="h-24 rounded-2xl" />
                </div>
              </CardContent>
            </Card>
          )}

          {error && !loading && (
            <Alert variant="destructive" className="rounded-2xl">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>{t("errorTitle")}</AlertTitle>
              <AlertDescription className="mt-1">
                {error}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-3 rounded-full"
                  onClick={() => void runQuery(query)}
                >
                  <RefreshCw className="mr-1 h-4 w-4" />
                  {t("retry")}
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {rdapData && !loading && (
            <Card className={WHOIS_CARD_CLASS}>
              <CardHeader className="pb-3">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <CardTitle className="break-all text-xl">{rdapData.domainName || t("result")}</CardTitle>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">
                        {rdapData.queryType === "domain" ? t("domain") : rdapData.ipVersion === "v6" ? t("ipv6") : t("ipv4")}
                      </Badge>
                      <Badge variant="outline">
                        <Clock className="mr-1 h-3 w-3" />
                        {rdapData.queryTime} ms
                      </Badge>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={() => void copyRawData()}>
                      <Copy className="mr-1 h-4 w-4" />
                      {t("copy")}
                    </Button>
                    <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={exportRawData}>
                      <Download className="mr-1 h-4 w-4" />
                      {t("exportJson")}
                    </Button>
                  </div>
                </div>
                <p className="mt-3 break-all text-xs text-[var(--md-sys-color-on-surface-variant)]">
                  {t("rdapServer")}{" "}
                  <a
                    href={rdapData.rdapServer}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-[var(--md-sys-color-primary)] underline-offset-2 hover:underline"
                  >
                    {rdapData.rdapServer}
                  </a>
                </p>
              </CardHeader>
              <CardContent>
                <Tabs value={activeTab} onValueChange={setActiveTab} className="min-w-0">
                  <TabsList className="grid h-auto w-full grid-cols-2 rounded-2xl bg-[var(--md-sys-color-surface-container-low)] p-1">
                    <TabsTrigger value="formatted" className="min-h-10 rounded-xl data-[state=active]:bg-[var(--md-sys-color-secondary-container)]">
                      {t("formattedView")}
                    </TabsTrigger>
                    <TabsTrigger value="raw" className="min-h-10 rounded-xl data-[state=active]:bg-[var(--md-sys-color-secondary-container)]">
                      {t("rawData")}
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="formatted" className="min-w-0 space-y-4 pt-2">
                    {rdapData.queryType === "domain" ? (
                      <>
                        <section className="min-w-0 space-y-3">
                          <h3 className="flex items-center gap-2 font-semibold">
                            <Globe className="h-5 w-5 text-[var(--md-sys-color-primary)]" />
                            {t("domainInfo")}
                          </h3>
                          <div className="grid min-w-0 gap-2 sm:grid-cols-2">
                            <InfoRow
                              icon={<Building className="h-4 w-4" />}
                              label={t("registeredWith")}
                              value={rdapData.registrarUrl && /^https?:\/\//i.test(rdapData.registrarUrl) ? (
                                <a href={rdapData.registrarUrl} target="_blank" rel="noopener noreferrer" className="text-[var(--md-sys-color-primary)] hover:underline">
                                  {rdapData.registrar || rdapData.registrarUrl}
                                </a>
                              ) : rdapData.registrar}
                            />
                            <InfoRow icon={<Calendar className="h-4 w-4" />} label={t("created")} value={formatDate(rdapData.creationDate)} />
                            <InfoRow icon={<Calendar className="h-4 w-4" />} label={t("expires")} value={formatDate(rdapData.expiryDate)} />
                            <InfoRow icon={<Calendar className="h-4 w-4" />} label={t("updated")} value={formatDate(rdapData.updatedDate)} />
                          </div>

                          {rdapData.status && rdapData.status.length > 0 && (
                            <div className="rounded-xl bg-[var(--md-sys-color-surface-container-low)] p-3">
                              <p className="mb-2 flex items-center gap-2 text-sm font-medium">
                                <Shield className="h-4 w-4 text-[var(--md-sys-color-primary)]" />
                                {t("status")}
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {rdapData.status.map((status) => <Badge key={status} variant="outline">{status}</Badge>)}
                              </div>
                            </div>
                          )}

                          {rdapData.nameServers && rdapData.nameServers.length > 0 && (
                            <div className="rounded-xl bg-[var(--md-sys-color-surface-container-low)] p-3">
                              <p className="mb-2 flex items-center gap-2 text-sm font-medium">
                                <Server className="h-4 w-4 text-[var(--md-sys-color-primary)]" />
                                {t("nameServers")}
                              </p>
                              <div className="grid gap-2 sm:grid-cols-2">
                                {rdapData.nameServers.map((server) => (
                                  <code key={server} className="min-w-0 break-all rounded-lg bg-[var(--md-sys-color-surface-container)] px-2 py-1.5 text-xs">
                                    {server}
                                  </code>
                                ))}
                              </div>
                            </div>
                          )}

                          {rdapData.dnssec && (
                            <InfoRow
                              icon={<Shield className="h-4 w-4" />}
                              label="DNSSEC"
                              value={rdapData.dnssec === "signed" ? t("signed") : t("unsigned")}
                            />
                          )}
                        </section>

                        {rdapData.registrant && (
                          <section className="min-w-0 space-y-3 border-t border-[var(--md-sys-color-outline-variant)] pt-4">
                            <h3 className="flex items-center gap-2 font-semibold">
                              <User className="h-5 w-5 text-[var(--md-sys-color-primary)]" />
                              {t("registrantInfo")}
                            </h3>
                            <div className="grid min-w-0 gap-2 sm:grid-cols-2">
                              <InfoRow icon={<User className="h-4 w-4" />} label={t("name")} value={rdapData.registrant.name} />
                              <InfoRow icon={<Building className="h-4 w-4" />} label={t("organization")} value={rdapData.registrant.organization} />
                              <InfoRow icon={<Mail className="h-4 w-4" />} label={t("email")} value={rdapData.registrant.email} />
                              <InfoRow icon={<Phone className="h-4 w-4" />} label={t("phone")} value={rdapData.registrant.phone} />
                              <InfoRow
                                icon={<MapPin className="h-4 w-4" />}
                                label={t("address")}
                                value={[
                                  rdapData.registrant.address,
                                  rdapData.registrant.city,
                                  rdapData.registrant.state,
                                  rdapData.registrant.postalCode,
                                  rdapData.registrant.country,
                                ].filter(Boolean).join(", ")}
                              />
                            </div>
                          </section>
                        )}
                      </>
                    ) : rdapData.networkInfo ? (
                      <section className="min-w-0 space-y-3">
                        <h3 className="flex items-center gap-2 font-semibold">
                          <Network className="h-5 w-5 text-[var(--md-sys-color-primary)]" />
                          {t("networkInfo")}
                        </h3>
                        <div className="grid min-w-0 gap-2 sm:grid-cols-2">
                          <InfoRow icon={<Database className="h-4 w-4" />} label={t("networkName")} value={rdapData.networkInfo.name} />
                          <InfoRow icon={<Info className="h-4 w-4" />} label={t("networkHandle")} value={rdapData.networkInfo.handle} mono />
                          <InfoRow icon={<Activity className="h-4 w-4" />} label={t("startAddress")} value={rdapData.networkInfo.startAddress} mono />
                          <InfoRow icon={<Activity className="h-4 w-4" />} label={t("endAddress")} value={rdapData.networkInfo.endAddress} mono />
                          <InfoRow icon={<Network className="h-4 w-4" />} label={t("networkType")} value={rdapData.networkInfo.type} />
                          <InfoRow icon={<Globe className="h-4 w-4" />} label={t("country")} value={rdapData.networkInfo.country} />
                          <InfoRow icon={<Info className="h-4 w-4" />} label={t("parentHandle")} value={rdapData.networkInfo.parentHandle} mono />
                        </div>
                        {rdapData.status && rdapData.status.length > 0 && (
                          <div className="flex flex-wrap gap-2 rounded-xl bg-[var(--md-sys-color-surface-container-low)] p-3">
                            {rdapData.status.map((status) => <Badge key={status} variant="outline">{status}</Badge>)}
                          </div>
                        )}
                      </section>
                    ) : (
                      <p className="py-8 text-center text-[var(--md-sys-color-on-surface-variant)]">{t("noDataTitle")}</p>
                    )}
                  </TabsContent>

                  <TabsContent value="raw" className="min-w-0 space-y-4 pt-2">
                    <div className="max-h-[min(34rem,65dvh)] min-w-0 touch-pan-y overflow-auto overscroll-contain rounded-2xl [-webkit-overflow-scrolling:touch]">
                      <JsonTreeView jsonText={rdapData.raw} indentSize={2} rootLabel="rdap" />
                    </div>
                    <details className="min-w-0 rounded-2xl border border-[var(--md-sys-color-outline-variant)]">
                      <summary className="cursor-pointer px-4 py-3 text-sm font-medium">{t("plainJson")}</summary>
                      <pre className="max-h-[min(30rem,60dvh)] min-w-0 touch-pan-y overflow-auto border-t border-[var(--md-sys-color-outline-variant)] p-4 text-xs leading-5 [-webkit-overflow-scrolling:touch]">
                        {rdapData.raw}
                      </pre>
                    </details>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          )}

          {!loading && !error && !rdapData && (
            <Card className={WHOIS_CARD_CLASS}>
              <CardContent className="py-14 text-center text-[var(--md-sys-color-on-surface-variant)]">
                <Globe className="mx-auto mb-4 h-12 w-12" />
                <p className="font-medium">{t("emptyState")}</p>
                <p className="mt-1 text-sm">{t("emptyStateHint")}</p>
              </CardContent>
            </Card>
          )}
        </main>

        <aside className="order-2 min-w-0 space-y-4 lg:order-1">
          <Card className={WHOIS_CARD_CLASS}>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Activity className="h-4 w-4 text-[var(--md-sys-color-primary)]" />
                {t("statistics")}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-3 gap-2 lg:grid-cols-1">
              {[
                [t("totalQueries"), stats.total],
                [t("successRate"), `${stats.successRate}%`],
                [t("averageResponse"), `${stats.averageDuration} ms`],
              ].map(([label, value]) => (
                <div key={label} className="min-w-0 rounded-xl bg-[var(--md-sys-color-surface-container-low)] px-2 py-3 text-center lg:flex lg:items-center lg:justify-between lg:text-left">
                  <span className="block truncate text-[11px] text-[var(--md-sys-color-on-surface-variant)] lg:text-xs">{label}</span>
                  <span className="mt-1 block font-semibold lg:mt-0">{value}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className={WHOIS_CARD_CLASS}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <History className="h-4 w-4 text-[var(--md-sys-color-primary)]" />
                  {t("queryHistory")} ({history.length})
                </CardTitle>
                {history.length > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 rounded-full"
                    aria-label={t("clearHistory")}
                    onClick={() => setHistory([])}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {history.length === 0 ? (
                <p className="py-6 text-center text-sm text-[var(--md-sys-color-on-surface-variant)]">{t("noHistory")}</p>
              ) : (
                <div className="space-y-2">
                  {historyItems.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setQuery(item.query)
                        setQueryType(item.type)
                        void runQuery(item.query, item.type)
                      }}
                      className="w-full min-w-0 rounded-xl border border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container-low)] p-3 text-left transition-colors hover:border-[var(--md-sys-color-primary)]"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        {item.success
                          ? <CheckCircle2 className="h-4 w-4 shrink-0 text-[var(--md-sys-color-primary)]" />
                          : <AlertTriangle className="h-4 w-4 shrink-0 text-[var(--md-sys-color-error)]" />}
                        <span className="min-w-0 flex-1 truncate font-mono text-sm">{item.query}</span>
                        <Badge variant="outline" className="shrink-0 text-[10px]">{t(item.type)}</Badge>
                      </span>
                      <span className="mt-2 flex items-center justify-between text-[11px] text-[var(--md-sys-color-on-surface-variant)]">
                        <span>{new Date(item.timestamp).toLocaleString(locale)}</span>
                        <span>{item.duration} ms</span>
                      </span>
                    </button>
                  ))}
                  {history.length > 5 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="w-full rounded-full"
                      onClick={() => setHistoryExpanded((expanded) => !expanded)}
                    >
                      {historyExpanded ? t("showLess") : t("showAll")}
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  )
}
