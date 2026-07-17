"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DeviceFingerprintPanel } from "@/components/tools/device-fingerprint-panel"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Copy, Check, RefreshCw, Globe, Monitor, Cpu, Shield, Fingerprint, Battery, Smartphone, Settings, ChevronUp, ChevronDown, Zap, Eye, Wifi } from "lucide-react"
import { useTranslations } from "@/hooks/use-translations"
import { useToolActivity } from "@/components/tool-activity"
import { collectDeviceFingerprint, type DeviceFingerprint } from "@/lib/device-fingerprint"
import { copyTextToClipboard as writeClipboardText } from "@/lib/clipboard"

const CLIENT_CACHE_DURATION = 3 * 60 * 60 * 1000
const IP_CACHE_KEY = "device-info-ip-cache"
const IP_CACHE_PREFERENCE_KEY = "device-info-ip-cache-enabled"
const DEVICE_CARD_CLASS =
  "min-w-0 rounded-[var(--md-sys-shape-corner-large)] border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container-lowest)] shadow-sm"
const DEVICE_ICON_CLASS =
  "text-[var(--md-sys-color-primary)]"

interface DeviceInfo {
  userAgent: string
  browser: {
    name: string
    version: string
    engine: string
    mobile: boolean
  }
  os: {
    name: string
    version: string
  }
  device: {
    type: string
    vendor: string
    model: string
  }
  screen: {
    width: number
    height: number
    availableWidth: number
    availableHeight: number
    viewportWidth: number
    viewportHeight: number
    pixelWidth: number
    pixelHeight: number
    colorDepth: number
    orientation: string
    ratio: number
    dpr: number
  }
  network: {
    ip: string
    ipv6: string
    isp: string
    connectionType: string | any
    downlink: number | string
    rtt: number | string
    saveData: boolean | string
    country?: string
    region?: string
    city?: string
    continent?: string
    coordinates?: {
      latitude: string | number
      longitude: string | number
    }
  }
  language: {
    language: string
    languages: string[]
    timeZone: string
    timeZoneOffset: number
  }
  features: {
    cookies: boolean
    localStorage: boolean
    sessionStorage: boolean
    webWorkers: boolean
    serviceWorkers: boolean
    webGL: boolean
    canvas: boolean
    webRTC: boolean
    touchScreen: boolean
    doNotTrack: boolean | null
  }
  fingerprint: DeviceFingerprint
}

interface IpGeoInfo {
  ip?: string
  isp?: string
  country?: string
  region?: string
  city?: string
  continent_code?: string
  latitude?: string | number
  longitude?: string | number
}

interface BatteryManagerLike extends EventTarget {
  charging: boolean
  chargingTime: number
  dischargingTime: number
  level: number
}

interface NavigatorWithBattery extends Navigator {
  getBattery?: () => Promise<BatteryManagerLike>
}

function canUseStorage(storageName: "localStorage" | "sessionStorage"): boolean {
  try {
    const storage = window[storageName]
    const key = "__device_storage_probe__"
    storage.setItem(key, key)
    storage.removeItem(key)
    return true
  } catch {
    return false
  }
}

export default function DeviceInfoPage() {
  const t = useTranslations("device")
  const isToolActive = useToolActivity()
  
  const [showDeviceSettings, setShowDeviceSettings] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [enableCache, setEnableCache] = useState(true)
  const [detailedInfo, setDetailedInfo] = useState(true)
  const [realTimeMonitoring, setRealTimeMonitoring] = useState(false)
  
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState<{ [key: string]: boolean }>({})
  const [activeTab, setActiveTab] = useState("basic")
  const [ipLoading, setIpLoading] = useState(true)
  const ipFetchedRef = useRef(false)
  const ipRequestRef = useRef<AbortController | null>(null)
  const ipRunRef = useRef(0)
  const collectionRunRef = useRef(0)

  const copyTimeoutRef = useRef<{ [key: string]: ReturnType<typeof setTimeout> | null }>({})

  const [batteryStatus, setBatteryStatus] = useState<string>("Not available")
  const [batteryLevel, setBatteryLevel] = useState<number | null>(null)
  const [batteryCharging, setBatteryCharging] = useState<boolean | null>(null)

  // Function to detect browser
  const detectBrowser = () => {
    const userAgent = navigator.userAgent
    let browserName = "Unknown"
    let browserVersion = "Unknown"
    let engineName = "Unknown"
    let isMobile = false

    // Check if mobile
    if (/Mobi|Android/i.test(userAgent)) {
      isMobile = true
    }

    // Detect browser and version
    if (userAgent.includes("FxiOS")) {
      browserName = "Firefox"
      engineName = "WebKit"
      browserVersion = userAgent.match(/FxiOS\/([0-9.]+)/)?.[1] ?? browserVersion
    } else if (userAgent.includes("CriOS")) {
      browserName = "Chrome"
      engineName = "WebKit"
      browserVersion = userAgent.match(/CriOS\/([0-9.]+)/)?.[1] ?? browserVersion
    } else if (userAgent.includes("EdgiOS")) {
      browserName = "Edge"
      engineName = "WebKit"
      browserVersion = userAgent.match(/EdgiOS\/([0-9.]+)/)?.[1] ?? browserVersion
    } else if (userAgent.indexOf("Firefox") > -1) {
      browserName = "Firefox"
      engineName = "Gecko"
      const match = userAgent.match(/Firefox\/([0-9.]+)/)
      if (match) browserVersion = match[1]
    } else if (userAgent.indexOf("SamsungBrowser") > -1) {
      browserName = "Samsung Browser"
      engineName = "Blink"
      const match = userAgent.match(/SamsungBrowser\/([0-9.]+)/)
      if (match) browserVersion = match[1]
    } else if (userAgent.indexOf("Opera") > -1 || userAgent.indexOf("OPR") > -1) {
      browserName = "Opera"
      engineName = "Blink"
      const match = userAgent.match(/(?:Opera|OPR)\/([0-9.]+)/)
      if (match) browserVersion = match[1]
    } else if (userAgent.indexOf("Trident") > -1) {
      browserName = "Internet Explorer"
      engineName = "Trident"
      const match = userAgent.match(/rv:([0-9.]+)/)
      if (match) browserVersion = match[1]
    } else if (userAgent.indexOf("Edge") > -1) {
      browserName = "Edge (Legacy)"
      engineName = "EdgeHTML"
      const match = userAgent.match(/Edge\/([0-9.]+)/)
      if (match) browserVersion = match[1]
    } else if (userAgent.indexOf("Edg") > -1) {
      browserName = "Edge (Chromium)"
      engineName = "Blink"
      const match = userAgent.match(/Edg\/([0-9.]+)/)
      if (match) browserVersion = match[1]
    } else if (userAgent.indexOf("Chrome") > -1) {
      browserName = "Chrome"
      engineName = "Blink"
      const match = userAgent.match(/Chrome\/([0-9.]+)/)
      if (match) browserVersion = match[1]
    } else if (userAgent.indexOf("Safari") > -1) {
      browserName = "Safari"
      engineName = "WebKit"
      const match = userAgent.match(/Version\/([0-9.]+)/)
      if (match) browserVersion = match[1]
    }

    return {
      name: browserName,
      version: browserVersion,
      engine: engineName,
      mobile: isMobile,
    }
  }

  // Function to detect OS
  const detectOS = () => {
    const userAgent = navigator.userAgent
    let osName = "Unknown"
    let osVersion = "Unknown"

    const isIPadDesktopMode = /Macintosh/i.test(userAgent) && navigator.maxTouchPoints > 1

    if (/iPhone|iPad|iPod/i.test(userAgent) || isIPadDesktopMode) {
      osName = "iOS"
      const match = userAgent.match(/OS ([0-9_]+)/) ?? userAgent.match(/Version\/([0-9.]+)/)
      if (match) osVersion = match[1].replace(/_/g, ".")
    } else if (userAgent.indexOf("Windows NT 10.0") !== -1) osName = "Windows 10 / 11"
    else if (userAgent.indexOf("Windows NT 6.3") !== -1) osName = "Windows 8.1"
    else if (userAgent.indexOf("Windows NT 6.2") !== -1) osName = "Windows 8"
    else if (userAgent.indexOf("Windows NT 6.1") !== -1) osName = "Windows 7"
    else if (userAgent.indexOf("Windows NT 6.0") !== -1) osName = "Windows Vista"
    else if (userAgent.indexOf("Windows NT 5.1") !== -1) osName = "Windows XP"
    else if (userAgent.indexOf("Windows NT 5.0") !== -1) osName = "Windows 2000"
    else if (userAgent.indexOf("Mac") !== -1) {
      osName = "macOS"
      const match = userAgent.match(/Mac OS X ([0-9_]+)/)
      if (match) {
        osVersion = match[1].replace(/_/g, ".")
        // Convert version numbers like 10.15 to named versions
        if (osVersion.startsWith("10.15")) osName = "macOS Catalina"
        else if (osVersion.startsWith("10.14")) osName = "macOS Mojave"
        else if (osVersion.startsWith("10.13")) osName = "macOS High Sierra"
        else if (osVersion.startsWith("11")) osName = "macOS Big Sur"
        else if (osVersion.startsWith("12")) osName = "macOS Monterey"
        else if (osVersion.startsWith("13")) osName = "macOS Ventura"
        else if (osVersion.startsWith("14")) osName = "macOS Sonoma"
      }
    } else if (userAgent.indexOf("Android") !== -1) {
      osName = "Android"
      const match = userAgent.match(/Android ([0-9.]+)/)
      if (match) osVersion = match[1]
    } else if (userAgent.indexOf("Linux") !== -1) {
      osName = "Linux"
    }

    return {
      name: osName,
      version: osVersion,
    }
  }

  // Function to detect device
  const detectDevice = () => {
    const userAgent = navigator.userAgent
    let deviceType = "Desktop"
    let deviceVendor = "Unknown"
    let deviceModel = "Unknown"

    const isIPadDesktopMode = /Macintosh/i.test(userAgent) && navigator.maxTouchPoints > 1
    const isTablet = /Tablet|iPad/i.test(userAgent) || isIPadDesktopMode || (/Android/i.test(userAgent) && !/Mobile/i.test(userAgent))

    if (isTablet) {
      deviceType = "Tablet"
    } else if (/Mobi|iPhone|iPod|Android/i.test(userAgent)) {
      deviceType = "Mobile"
    }

    if (userAgent.indexOf("iPhone") !== -1) {
      deviceVendor = "Apple"
      deviceModel = "iPhone"
    } else if (userAgent.indexOf("iPad") !== -1 || isIPadDesktopMode) {
      deviceVendor = "Apple"
      deviceModel = "iPad"
    } else if (userAgent.indexOf("Pixel") !== -1) {
      deviceVendor = "Google"
      const match = userAgent.match(/Pixel [^;)]+/)
      if (match) deviceModel = match[0]
      else deviceModel = "Pixel"
    } else if (userAgent.indexOf("Samsung") !== -1 || userAgent.indexOf("SM-") !== -1) {
      deviceVendor = "Samsung"
      const match = userAgent.match(/SM-[A-Z0-9]+/)
      if (match) deviceModel = match[0]
    }

    return {
      type: deviceType,
      vendor: deviceVendor,
      model: deviceModel,
    }
  }

  // Function to get screen information
  const getScreenInfo = () => {
    const width = window.screen.width
    const height = window.screen.height
    const availableWidth = window.screen.availWidth
    const availableHeight = window.screen.availHeight
    const viewportWidth = window.visualViewport?.width ?? window.innerWidth
    const viewportHeight = window.visualViewport?.height ?? window.innerHeight
    const colorDepth = window.screen.colorDepth
    const orientation = window.screen.orientation ? window.screen.orientation.type : "unknown"
    const ratio = Math.round((width / height) * 100) / 100
    const dpr = window.devicePixelRatio || 1

    return {
      width,
      height,
      availableWidth,
      availableHeight,
      viewportWidth: Math.round(viewportWidth),
      viewportHeight: Math.round(viewportHeight),
      pixelWidth: Math.round(width * dpr),
      pixelHeight: Math.round(height * dpr),
      colorDepth,
      orientation,
      ratio,
      dpr,
    }
  }

  // Function to get language information
  const getLanguageInfo = () => {
    return {
      language: navigator.language,
      languages: navigator.languages ? Array.from(navigator.languages) : [navigator.language],
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      timeZoneOffset: new Date().getTimezoneOffset(),
    }
  }

  // Function to check browser features
  const checkFeatures = () => {
    const doNotTrack =
      navigator.doNotTrack === "1" ||
      navigator.doNotTrack === "yes" ||
      (window as any).doNotTrack === "1"
        ? true
        : navigator.doNotTrack === "0" || navigator.doNotTrack === "no" || (window as any).doNotTrack === "0"
          ? false
          : null

    return {
      cookies: navigator.cookieEnabled,
      localStorage: canUseStorage("localStorage"),
      sessionStorage: canUseStorage("sessionStorage"),
      webWorkers: !!window.Worker,
      serviceWorkers: !!navigator.serviceWorker,
      webGL: (() => {
        try {
          const canvas = document.createElement("canvas")
          return !!(
            window.WebGLRenderingContext &&
            (canvas.getContext("webgl") || canvas.getContext("experimental-webgl"))
          )
        } catch (e) {
          return false
        }
      })(),
      canvas: (() => {
        try {
          const canvas = document.createElement("canvas")
          return !!canvas.getContext("2d")
        } catch (e) {
          return false
        }
      })(),
      webRTC: !!(
        window.RTCPeerConnection ||
        (window as any).mozRTCPeerConnection ||
        (window as any).webkitRTCPeerConnection
      ),
      touchScreen: "ontouchstart" in window || navigator.maxTouchPoints > 0,
      doNotTrack,
    }
  }

  // Function to get network information
  const getNetworkInfo = () => {
    const connection =
      (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection

    const hasRealConnectionInfo =
      connection &&
      (typeof connection.effectiveType === "string" ||
        typeof connection.downlink === "number" ||
        typeof connection.rtt === "number")

    return {
      ip: "Fetching...",
      ipv6: "Not available",
      isp: "Unknown",
      connectionType: hasRealConnectionInfo ? connection.effectiveType : "Not available",
      downlink:
        hasRealConnectionInfo && typeof connection.downlink === "number" ? connection.downlink : "Not available",
      rtt: hasRealConnectionInfo && typeof connection.rtt === "number" ? connection.rtt : "Not available",
      saveData:
        hasRealConnectionInfo && typeof connection.saveData === "boolean" ? connection.saveData : "Not available",
      country: "Unknown",
      region: "Unknown",
      city: "Unknown",
      continent: "Unknown",
      coordinates: {
        latitude: "Unknown",
        longitude: "Unknown",
      },
    }
  }

  const fetchIPInfo = async () => {
    const runId = ++ipRunRef.current
    ipRequestRef.current?.abort()
    const controller = new AbortController()
    ipRequestRef.current = controller

    const applyIpInfo = (data: IpGeoInfo | null) => {
      if (runId !== ipRunRef.current) return
      setDeviceInfo((current) => current ? {
        ...current,
        network: {
          ...current.network,
          ip: data?.ip || "Unknown",
          ipv6: "Not available",
          isp: data?.isp || "Unknown",
          country: data?.country || "Unknown",
          region: data?.region || "Unknown",
          city: data?.city || "Unknown",
          continent: data?.continent_code || "Unknown",
          coordinates: {
            latitude: data?.latitude ?? "Unknown",
            longitude: data?.longitude ?? "Unknown",
          },
        },
      } : current)
    }

    try {
      setIpLoading(true)
      if (!enableCache) localStorage.removeItem(IP_CACHE_KEY)
      const cachedData = enableCache ? localStorage.getItem(IP_CACHE_KEY) : null
      if (cachedData) {
        try {
          const { data, timestamp } = JSON.parse(cachedData) as { data: IpGeoInfo; timestamp: number }
          if (Date.now() - timestamp < CLIENT_CACHE_DURATION) {
            applyIpInfo(data)
            return
          }
        } catch {
          localStorage.removeItem(IP_CACHE_KEY)
        }
      }

      const timeout = window.setTimeout(() => controller.abort(), 8000)
      let response: Response
      try {
        response = await fetch("https://api-ipv4.ip.sb/geoip", { signal: controller.signal })
      } finally {
        window.clearTimeout(timeout)
      }
      if (!response.ok) throw new Error(`IP info API responded with status: ${response.status}`)

      const ipData = await response.json() as IpGeoInfo
      if (enableCache) {
        localStorage.setItem(IP_CACHE_KEY, JSON.stringify({ data: ipData, timestamp: Date.now() }))
      }
      applyIpInfo(ipData)
    } catch {
      applyIpInfo(null)
    } finally {
      if (runId === ipRunRef.current) {
        ipFetchedRef.current = true
        ipRequestRef.current = null
        setIpLoading(false)
      }
    }
  }

  // Function to gather all device information
  const gatherDeviceInfo = async () => {
    const runId = ++collectionRunRef.current
    try {
      setLoading(true)
      const fingerprint = await collectDeviceFingerprint()
      if (runId !== collectionRunRef.current) return

      const info: DeviceInfo = {
        userAgent: navigator.userAgent,
        browser: detectBrowser(),
        os: detectOS(),
        device: detectDevice(),
        screen: getScreenInfo(),
        network: getNetworkInfo(),
        language: getLanguageInfo(),
        features: checkFeatures(),
        fingerprint,
      }

      setDeviceInfo(info)
      setError(null)
    } catch (err) {
      console.error("Error gathering device info:", err)
      if (runId === collectionRunRef.current) setError(t("gatherError"))
    } finally {
      if (runId === collectionRunRef.current) setLoading(false)
    }
  }

  // Function to copy text to clipboard
  const copyToClipboard = async (text: string, key: string) => {
    if (await writeClipboardText(text)) {

      // Clear previous timeout
      if (copyTimeoutRef.current[key]) {
        clearTimeout(copyTimeoutRef.current[key]!)
      }

      setCopied((prev) => ({ ...prev, [key]: true }))

      // Set new timeout
      copyTimeoutRef.current[key] = setTimeout(() => {
        setCopied((prev) => ({ ...prev, [key]: false }))
      }, 2000)
    } else {
      setCopied((prev) => ({ ...prev, [key]: false }))
    }
  }

  // Function to copy all device info as JSON
  const copyAllAsJson = () => {
    if (!deviceInfo) return

    const jsonString = JSON.stringify(deviceInfo, (key, value) => key === "previewUrl" ? undefined : value, 2)
    copyToClipboard(jsonString, "all")
  }

  const refreshDeviceInfo = () => {
    ipFetchedRef.current = false
    ipRequestRef.current?.abort()
    try {
      localStorage.removeItem(IP_CACHE_KEY)
    } catch {
      // Refresh still works when storage access is blocked.
    }
    void gatherDeviceInfo()
  }

  const handleCacheChange = (enabled: boolean) => {
    setEnableCache(enabled)
    try {
      localStorage.setItem(IP_CACHE_PREFERENCE_KEY, String(enabled))
      if (!enabled) localStorage.removeItem(IP_CACHE_KEY)
    } catch {
      setEnableCache(false)
    }
  }

  useEffect(() => {
    try {
      const savedPreference = localStorage.getItem(IP_CACHE_PREFERENCE_KEY)
      if (savedPreference !== null) setEnableCache(savedPreference === "true")
    } catch {
      setEnableCache(false)
    }

    void gatherDeviceInfo()

    return () => {
      collectionRunRef.current += 1
      ipRunRef.current += 1
      ipRequestRef.current?.abort()
      Object.values(copyTimeoutRef.current).forEach((timeout) => {
        if (timeout) clearTimeout(timeout)
      })
    }
  }, [])

  useEffect(() => {
    if (!isToolActive) return
    let battery: BatteryManagerLike | null = null
    let cancelled = false

    const updateBatteryInfo = () => {
      if (cancelled || !battery) return

      setBatteryLevel(battery.level)
      setBatteryCharging(battery.charging)
      const seconds = battery.charging ? battery.chargingTime : battery.dischargingTime
      const remaining = Number.isFinite(seconds)
        ? `${Math.max(0, Math.floor(seconds / 60))} ${t("minutes")}`
        : t("unknown")
      setBatteryStatus(`${battery.charging ? t("charging") : t("discharging")} · ${remaining} ${t("remaining")}`)
    }

    void (async () => {
      try {
        const getBattery = (navigator as NavigatorWithBattery).getBattery
        if (!getBattery) return

        battery = await getBattery.call(navigator)
        if (cancelled) return
        updateBatteryInfo()
        battery.addEventListener("levelchange", updateBatteryInfo)
        battery.addEventListener("chargingchange", updateBatteryInfo)
      } catch (batteryError) {
        console.error("Error getting battery info:", batteryError)
      }
    })()

    return () => {
      cancelled = true
      battery?.removeEventListener("levelchange", updateBatteryInfo)
      battery?.removeEventListener("chargingchange", updateBatteryInfo)
    }
  }, [isToolActive, t])

  useEffect(() => {
    if (!isToolActive || !autoRefresh) return
    const interval = window.setInterval(() => {
      ipFetchedRef.current = false
      void gatherDeviceInfo()
    }, 60_000)
    return () => window.clearInterval(interval)
  }, [autoRefresh, isToolActive])

  useEffect(() => {
    if (!isToolActive || !realTimeMonitoring) return

    const updateLiveInfo = () => {
      setDeviceInfo((current) => {
        if (!current) return current
        const liveNetwork = getNetworkInfo()
        return {
          ...current,
          screen: getScreenInfo(),
          network: {
            ...current.network,
            connectionType: liveNetwork.connectionType,
            downlink: liveNetwork.downlink,
            rtt: liveNetwork.rtt,
            saveData: liveNetwork.saveData,
          },
        }
      })
    }

    const connection = (navigator as any).connection
    window.addEventListener("resize", updateLiveInfo)
    window.addEventListener("orientationchange", updateLiveInfo)
    window.addEventListener("online", updateLiveInfo)
    window.addEventListener("offline", updateLiveInfo)
    connection?.addEventListener?.("change", updateLiveInfo)
    return () => {
      window.removeEventListener("resize", updateLiveInfo)
      window.removeEventListener("orientationchange", updateLiveInfo)
      window.removeEventListener("online", updateLiveInfo)
      window.removeEventListener("offline", updateLiveInfo)
      connection?.removeEventListener?.("change", updateLiveInfo)
    }
  }, [realTimeMonitoring, isToolActive])

  useEffect(() => {
    if (deviceInfo && !ipFetchedRef.current) {
      fetchIPInfo()
    }
  }, [deviceInfo])

  // Render a data item with copy button
  const renderDataItem = (label: string, value: string | number | boolean | null, copyKey: string) => {
    const rawValue = value === null ? "Not detected" : String(value)
    const canonicalValues: Record<string, string> = {
      "Not detected": t("notDetected"),
      "Not available": t("unavailable"),
      "Fetching...": t("fetching"),
      Unknown: t("unknown"),
      unknown: t("unknown"),
      Desktop: t("desktop"),
      Mobile: t("mobile"),
      Tablet: t("tablet"),
    }
    const displayValue = canonicalValues[rawValue] ?? rawValue

    return (
      <div className="grid min-h-12 min-w-0 grid-cols-[minmax(0,1fr)_2.5rem] items-center gap-x-2 border-b border-[var(--md-sys-color-outline-variant)]/60 py-2 sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)_2.5rem]">
        <div className="min-w-0 self-end text-xs font-medium text-[var(--md-sys-color-on-surface-variant)] sm:self-center">{label}</div>
        <div
          className="col-start-1 row-start-2 min-w-0 break-words text-sm leading-5 text-[var(--md-sys-color-on-surface)] [overflow-wrap:anywhere] sm:col-start-2 sm:row-start-1 sm:text-right"
          title={displayValue}
        >
          {displayValue}
        </div>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="col-start-2 row-span-2 row-start-1 h-10 w-10 shrink-0 rounded-full sm:col-start-3 sm:row-span-1"
                onClick={() => copyToClipboard(displayValue, copyKey)}
                aria-label={`${copied[copyKey] ? t("copied") : t("copy")} ${label}`}
              >
                {copied[copyKey] ? <Check className="h-4 w-4 text-[var(--md-sys-color-primary)]" /> : <Copy className="h-4 w-4" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{copied[copyKey] ? t("copied") : t("copy")}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    )
  }

  return (
    <div className="device-tool-page container mx-auto max-w-7xl overflow-x-clip px-3 py-3 sm:px-4 sm:py-6">
      <section className="mb-4 flex items-center gap-3 sm:mb-6 sm:justify-center">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--md-sys-color-primary-container)] text-[var(--md-sys-color-on-primary-container)] sm:h-12 sm:w-12">
          <Smartphone className="h-6 w-6" />
        </span>
        <div className="min-w-0 sm:text-center">
          <h1 className="text-xl font-bold tracking-tight text-[var(--md-sys-color-on-surface)] sm:text-3xl">{t("title")}</h1>
          <p className="mt-0.5 text-xs leading-5 text-[var(--md-sys-color-on-surface-variant)] sm:text-sm">
            {t("description")}
          </p>
        </div>
      </section>

      <div className="mb-4 grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowDeviceSettings(!showDeviceSettings)}
          aria-expanded={showDeviceSettings}
          className="min-h-10 min-w-0 justify-start gap-2 rounded-full px-3 text-[var(--md-sys-color-on-surface-variant)]"
        >
          <Settings className="h-4 w-4 shrink-0" />
          <span className="truncate">{t("settings")}</span>
          {showDeviceSettings ? <ChevronUp className="ml-auto h-4 w-4 shrink-0" /> : <ChevronDown className="ml-auto h-4 w-4 shrink-0" />}
        </Button>

        <Button
          type="button"
          onClick={refreshDeviceInfo}
          disabled={loading}
          className="min-h-10 shrink-0 gap-1.5 rounded-full px-3"
          aria-label={t("refreshAria")}
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          <span className="hidden xs:inline sm:inline">{loading ? t("refreshing") : t("refresh")}</span>
        </Button>

        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={copyAllAsJson}
          disabled={!deviceInfo || loading}
          className="h-10 w-10 shrink-0 rounded-full"
          aria-label={copied.all ? t("allCopiedAria") : t("copyAllAria")}
        >
          {copied.all ? <Check className="h-4 w-4 text-[var(--md-sys-color-primary)]" /> : <Copy className="h-4 w-4" />}
        </Button>
      </div>

      {showDeviceSettings && (
        <Card className={`mb-4 ${DEVICE_CARD_CLASS}`}>
          <CardContent className="p-3 sm:p-4">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <div className="flex min-h-14 items-center justify-between gap-3 rounded-xl bg-[var(--md-sys-color-surface-container)] px-3 py-2">
                  <Label htmlFor="auto-refresh" className="min-w-0 cursor-pointer text-sm">
                    <span className="block font-medium">{t("autoRefresh")}</span>
                    <span className="block text-xs text-[var(--md-sys-color-on-surface-variant)]">{t("autoRefreshDescription")}</span>
                  </Label>
                  <Switch id="auto-refresh" checked={autoRefresh} onCheckedChange={setAutoRefresh} />
                </div>
                <div className="flex min-h-14 items-center justify-between gap-3 rounded-xl bg-[var(--md-sys-color-surface-container)] px-3 py-2">
                  <Label htmlFor="enable-cache" className="min-w-0 cursor-pointer text-sm">
                    <span className="block font-medium">{t("networkCache")}</span>
                    <span className="block text-xs text-[var(--md-sys-color-on-surface-variant)]">{t("networkCacheDescription")}</span>
                  </Label>
                  <Switch id="enable-cache" checked={enableCache} onCheckedChange={handleCacheChange} />
                </div>
                <div className="flex min-h-14 items-center justify-between gap-3 rounded-xl bg-[var(--md-sys-color-surface-container)] px-3 py-2">
                  <Label htmlFor="detailed-info" className="min-w-0 cursor-pointer text-sm">
                    <span className="block font-medium">{t("rawFingerprintDetails")}</span>
                    <span className="block text-xs text-[var(--md-sys-color-on-surface-variant)]">{t("rawFingerprintDetailsDescription")}</span>
                  </Label>
                  <Switch id="detailed-info" checked={detailedInfo} onCheckedChange={setDetailedInfo} />
                </div>
                <div className="flex min-h-14 items-center justify-between gap-3 rounded-xl bg-[var(--md-sys-color-surface-container)] px-3 py-2">
                  <Label htmlFor="real-time" className="min-w-0 cursor-pointer text-sm">
                    <span className="block font-medium">{t("environmentMonitoring")}</span>
                    <span className="block text-xs text-[var(--md-sys-color-on-surface-variant)]">{t("environmentMonitoringDescription")}</span>
                  </Label>
                  <Switch id="real-time" checked={realTimeMonitoring} onCheckedChange={setRealTimeMonitoring} />
                </div>
              </div>
            </CardContent>
          </Card>
      )}

      {error ? (
        <Card className={DEVICE_CARD_CLASS}>
          <CardContent className="py-8 text-center">
            <div className="mb-4 text-lg text-[var(--md-sys-color-error)]">{t("loadError")}</div>
            <div className="text-[var(--md-sys-color-on-surface-variant)]">{error}</div>
            <Button onClick={refreshDeviceInfo} className="mt-4">
              <RefreshCw className="mr-2 h-4 w-4" />
              {t("retry")}
            </Button>
          </CardContent>
        </Card>
      ) : loading ? (
        <Card className={DEVICE_CARD_CLASS}>
          <CardContent className="py-10 text-center">
            <RefreshCw className="mx-auto mb-4 h-10 w-10 animate-spin text-[var(--md-sys-color-primary)]" />
            <div className="font-medium text-[var(--md-sys-color-on-surface)]">{t("loading")}</div>
            <div className="mt-2 text-xs text-[var(--md-sys-color-on-surface-variant)]">{t("loadingDescription")}</div>
          </CardContent>
        </Card>
      ) : deviceInfo ? (
        <div className="min-w-0 space-y-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div className="relative mb-4 w-full">
              <TabsList
                aria-label={t("categoriesAria")}
                className="grid h-auto w-full grid-cols-3 gap-1 rounded-2xl border border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container-low)] p-1 shadow-sm md:grid-cols-6"
              >
                <TabsTrigger
                  value="basic"
                  className="flex min-h-10 min-w-0 items-center justify-center gap-1 rounded-xl px-1 py-2 text-xs transition-all data-[state=active]:bg-[var(--md-sys-color-secondary-container)] data-[state=active]:text-[var(--md-sys-color-on-secondary-container)] sm:px-2"
                >
                  <Monitor className="hidden h-4 w-4 shrink-0 sm:block" />
                  <span className="font-medium">{t("basicInfo")}</span>
                </TabsTrigger>
                <TabsTrigger
                  value="network"
                  className="flex min-h-10 min-w-0 items-center justify-center gap-1 rounded-xl px-1 py-2 text-xs transition-all data-[state=active]:bg-[var(--md-sys-color-secondary-container)] data-[state=active]:text-[var(--md-sys-color-on-secondary-container)] sm:px-2"
                >
                  <Wifi className="hidden h-4 w-4 shrink-0 sm:block" />
                  <span className="font-medium">{t("networkInfo")}</span>
                </TabsTrigger>
                <TabsTrigger
                  value="system"
                  className="flex min-h-10 min-w-0 items-center justify-center gap-1 rounded-xl px-1 py-2 text-xs transition-all data-[state=active]:bg-[var(--md-sys-color-secondary-container)] data-[state=active]:text-[var(--md-sys-color-on-secondary-container)] sm:px-2"
                >
                  <Cpu className="hidden h-4 w-4 shrink-0 sm:block" />
                  <span className="font-medium">{t("systemInfo")}</span>
                </TabsTrigger>
                <TabsTrigger
                  value="hardware"
                  className="flex min-h-10 min-w-0 items-center justify-center gap-1 rounded-xl px-1 py-2 text-xs transition-all data-[state=active]:bg-[var(--md-sys-color-secondary-container)] data-[state=active]:text-[var(--md-sys-color-on-secondary-container)] sm:px-2"
                >
                  <Battery className="hidden h-4 w-4 shrink-0 sm:block" />
                  <span className="font-medium">{t("hardwareInfo")}</span>
                </TabsTrigger>
                <TabsTrigger
                  value="features"
                  className="flex min-h-10 min-w-0 items-center justify-center gap-1 rounded-xl px-1 py-2 text-xs transition-all data-[state=active]:bg-[var(--md-sys-color-secondary-container)] data-[state=active]:text-[var(--md-sys-color-on-secondary-container)] sm:px-2"
                >
                  <Shield className="hidden h-4 w-4 shrink-0 sm:block" />
                  <span className="font-medium">{t("features")}</span>
                </TabsTrigger>
                <TabsTrigger
                  value="fingerprint"
                  className="flex min-h-10 min-w-0 items-center justify-center gap-1 rounded-xl px-1 py-2 text-xs transition-all data-[state=active]:bg-[var(--md-sys-color-secondary-container)] data-[state=active]:text-[var(--md-sys-color-on-secondary-container)] sm:px-2"
                >
                  <Fingerprint className="hidden h-4 w-4 shrink-0 sm:block" />
                  <span className="font-medium">{t("fingerprint")}</span>
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="basic" className="space-y-6">
              <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
                <Card className={DEVICE_CARD_CLASS}>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Globe className={`h-5 w-5 ${DEVICE_ICON_CLASS}`} />
                      {t("browserInfo")}
                      {deviceInfo.browser.mobile && (
                        <Badge variant="secondary" className="text-xs">
                          {t("mobile")}
                        </Badge>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-0 p-4 pt-0 sm:p-6 sm:pt-0">
                    {renderDataItem(t("userAgent"), deviceInfo.userAgent, "userAgent")}
                    {renderDataItem(t("browserName"), deviceInfo.browser.name, "browserName")}
                    {renderDataItem(t("browserVersion"), deviceInfo.browser.version, "browserVersion")}
                    {renderDataItem(t("browserEngine"), deviceInfo.browser.engine, "browserEngine")}
                    {renderDataItem(t("isMobile"), deviceInfo.browser.mobile ? t("yes") : t("no"), "isMobile")}
                  </CardContent>
                </Card>

                <Card className={DEVICE_CARD_CLASS}>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Smartphone className={`h-5 w-5 ${DEVICE_ICON_CLASS}`} />
                      {t("deviceInfo")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-0 p-4 pt-0 sm:p-6 sm:pt-0">
                    {renderDataItem(t("deviceType"), deviceInfo.device.type, "deviceType")}
                    {renderDataItem(t("deviceVendor"), deviceInfo.device.vendor, "deviceVendor")}
                    {renderDataItem(t("deviceModel"), deviceInfo.device.model, "deviceModel")}
                  </CardContent>
                </Card>

                <Card className={`${DEVICE_CARD_CLASS} lg:col-span-2`}>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Monitor className={`h-5 w-5 ${DEVICE_ICON_CLASS}`} />
                      {t("osInfo")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid min-w-0 grid-cols-1 gap-x-4 md:grid-cols-2">
                    {renderDataItem(t("osName"), deviceInfo.os.name, "osName")}
                    {renderDataItem(t("osVersion"), deviceInfo.os.version, "osVersion")}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="network" className="space-y-6">
              <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
                <Card className={DEVICE_CARD_CLASS}>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex flex-wrap items-center gap-2 text-lg">
                      <Globe className={`h-5 w-5 ${DEVICE_ICON_CLASS}`} />
                      {t("ipInfo")}
                      {enableCache && (
                        <Badge variant="secondary" className="text-xs">
                          <Eye className="mr-1 h-3 w-3" />
                          {t("cached")}
                        </Badge>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {ipLoading ? (
                      <div className="flex flex-col items-center justify-center py-8">
                        <RefreshCw className="mb-4 h-8 w-8 animate-spin text-[var(--md-sys-color-primary)]" />
                        <div className="text-sm text-[var(--md-sys-color-on-surface-variant)]">{t("networkLoading")}</div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {renderDataItem(t("ipAddress"), deviceInfo.network.ip, "ipAddress")}
                        {renderDataItem(t("continent"), deviceInfo.network.continent || "Unknown", "continent")}
                        {renderDataItem(t("country"), deviceInfo.network.country || "Unknown", "country")}
                        {renderDataItem(t("region"), deviceInfo.network.region || "Unknown", "region")}
                        {renderDataItem(t("city"), deviceInfo.network.city || "Unknown", "city")}
                        {renderDataItem(t("isp"), deviceInfo.network.isp || "Unknown", "isp")}
                        {deviceInfo.network.coordinates &&
                          renderDataItem(
                            t("coordinates"),
                            `${deviceInfo.network.coordinates.latitude}, ${deviceInfo.network.coordinates.longitude}`,
                            "coordinates",
                          )}
                        <p className="pt-2 text-xs leading-5 text-[var(--md-sys-color-on-surface-variant)]">
                          {t("networkPrivacy")}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className={DEVICE_CARD_CLASS}>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Wifi className={`h-5 w-5 ${DEVICE_ICON_CLASS}`} />
                      {t("connectionInfo")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-0 p-4 pt-0 sm:p-6 sm:pt-0">
                    {renderDataItem(t("connectionType"), deviceInfo.network.connectionType, "connectionType")}
                    {renderDataItem(t("downlink"), typeof deviceInfo.network.downlink === "number" ? `${deviceInfo.network.downlink} Mbps` : deviceInfo.network.downlink, "downlink")}
                    {renderDataItem(t("rtt"), typeof deviceInfo.network.rtt === "number" ? `${deviceInfo.network.rtt} ms` : deviceInfo.network.rtt, "rtt")}
                    {renderDataItem(t("saveData"), typeof deviceInfo.network.saveData === "boolean" ? (deviceInfo.network.saveData ? t("enabled") : t("disabled")) : deviceInfo.network.saveData, "saveData")}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="system" className="space-y-6">
              <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
                <Card className={DEVICE_CARD_CLASS}>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Monitor className={`h-5 w-5 ${DEVICE_ICON_CLASS}`} />
                      {t("screenInfo")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-0 p-4 pt-0 sm:p-6 sm:pt-0">
                    {renderDataItem(
                      t("resolution"),
                      `${deviceInfo.screen.width} x ${deviceInfo.screen.height}`,
                      "resolution",
                    )}
                    {renderDataItem(t("physicalResolution"), `${deviceInfo.screen.pixelWidth} x ${deviceInfo.screen.pixelHeight}`, "physicalResolution")}
                    {renderDataItem(t("availableScreen"), `${deviceInfo.screen.availableWidth} x ${deviceInfo.screen.availableHeight}`, "availableScreen")}
                    {renderDataItem(t("viewport"), `${deviceInfo.screen.viewportWidth} x ${deviceInfo.screen.viewportHeight}`, "viewport")}
                    {renderDataItem(t("colorDepth"), `${deviceInfo.screen.colorDepth} bit`, "colorDepth")}
                    {renderDataItem(t("pixelRatio"), deviceInfo.screen.dpr, "pixelRatio")}
                    {renderDataItem(t("orientation"), deviceInfo.screen.orientation, "orientation")}
                    {renderDataItem(t("aspectRatio"), deviceInfo.screen.ratio, "aspectRatio")}
                  </CardContent>
                </Card>

                <Card className={DEVICE_CARD_CLASS}>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Globe className={`h-5 w-5 ${DEVICE_ICON_CLASS}`} />
                      {t("languageInfo")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-0 p-4 pt-0 sm:p-6 sm:pt-0">
                    {renderDataItem(t("language"), deviceInfo.language.language, "language")}
                    {renderDataItem(t("languages"), deviceInfo.language.languages.join(", "), "languages")}
                    {renderDataItem(t("timeZone"), deviceInfo.language.timeZone, "timeZone")}
                    {renderDataItem(t("timeZoneOffset"), `${deviceInfo.language.timeZoneOffset} ${t("minutes")}`, "timeZoneOffset")}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="hardware" className="space-y-6">
              <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
                <Card className={DEVICE_CARD_CLASS}>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Cpu className={`h-5 w-5 ${DEVICE_ICON_CLASS}`} />
                      {t("processorInfo")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-0 p-4 pt-0 sm:p-6 sm:pt-0">
                    {renderDataItem(
                      t("deviceMemory"),
                      (navigator as any).deviceMemory ? `${(navigator as any).deviceMemory} GB` : t("unavailable"),
                      "deviceMemory",
                    )}
                    {renderDataItem(
                      t("hardwareConcurrency"),
                      navigator.hardwareConcurrency || t("unavailable"),
                      "hardwareConcurrency",
                    )}
                    {renderDataItem(t("maxTouchPoints"), navigator.maxTouchPoints || t("unavailable"), "maxTouchPoints")}
                  </CardContent>
                </Card>

                <Card className={DEVICE_CARD_CLASS}>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex flex-wrap items-center gap-2 text-lg">
                      <Battery className={`h-5 w-5 ${DEVICE_ICON_CLASS}`} />
                      {t("batteryInfo")}
                      {realTimeMonitoring && (
                        <Badge variant="secondary" className="text-xs">
                          <Zap className="mr-1 h-3 w-3" />
                          {t("live")}
                        </Badge>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-0 p-4 pt-0 sm:p-6 sm:pt-0">
                    {renderDataItem(t("batteryStatus"), batteryStatus, "batteryStatus")}
                    {renderDataItem(
                      t("batteryLevel"),
                      batteryLevel !== null ? `${Math.round(batteryLevel * 100)}%` : t("unavailable"),
                      "batteryLevel",
                    )}
                    {renderDataItem(
                      t("batteryCharging"),
                      batteryCharging !== null ? (batteryCharging ? t("charging") : t("notCharging")) : t("unavailable"),
                      "batteryCharging",
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="features" className="space-y-6">
              <Card className={DEVICE_CARD_CLASS}>
                <CardHeader className="pb-3">
                  <CardTitle className="flex flex-wrap items-center gap-2 text-lg">
                    <Shield className={`h-5 w-5 ${DEVICE_ICON_CLASS}`} />
                    {t("browserFeatures")}
                    {detailedInfo && (
                      <Badge variant="secondary" className="text-xs">
                        {t("detailedMode")}
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid min-w-0 grid-cols-1 gap-x-4 md:grid-cols-2">
                  {renderDataItem(t("cookies"), deviceInfo.features.cookies ? t("enabled") : t("disabled"), "cookies")}
                  {renderDataItem(
                    t("localStorage"),
                    deviceInfo.features.localStorage ? t("available") : t("unavailable"),
                    "localStorage",
                  )}
                  {renderDataItem(
                    t("sessionStorage"),
                    deviceInfo.features.sessionStorage ? t("available") : t("unavailable"),
                    "sessionStorage",
                  )}
                  {renderDataItem(
                    t("webWorkers"),
                    deviceInfo.features.webWorkers ? t("supported") : t("unsupported"),
                    "webWorkers",
                  )}
                  {renderDataItem(
                    t("serviceWorkers"),
                    deviceInfo.features.serviceWorkers ? t("supported") : t("unsupported"),
                    "serviceWorkers",
                  )}
                  {renderDataItem(t("webGL"), deviceInfo.features.webGL ? t("supported") : t("unsupported"), "webGL")}
                  {renderDataItem(t("canvas"), deviceInfo.features.canvas ? t("supported") : t("unsupported"), "canvas")}
                  {renderDataItem(t("webRTC"), deviceInfo.features.webRTC ? t("supported") : t("unsupported"), "webRTC")}
                  {renderDataItem(t("touchScreen"), deviceInfo.features.touchScreen ? t("yes") : t("no"), "touchScreen")}
                  {renderDataItem(
                    t("doNotTrack"),
                    deviceInfo.features.doNotTrack === null
                      ? t("notSpecified")
                      : deviceInfo.features.doNotTrack
                        ? t("enabled")
                        : t("disabled"),
                    "doNotTrack",
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="fingerprint" className="mt-0 min-w-0 overflow-visible">
              <DeviceFingerprintPanel
                fingerprint={deviceInfo.fingerprint}
                copied={copied}
                showDetails={detailedInfo}
                onCopy={copyToClipboard}
              />
            </TabsContent>
          </Tabs>
        </div>
      ) : null}
    </div>
  )
}
