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
import { collectDeviceFingerprint, type DeviceFingerprint } from "@/lib/device-fingerprint"

// 在文件顶部添加缓存相关的常量
const CLIENT_CACHE_DURATION = 3 * 60 * 60 * 1000 // 3小时，单位毫秒
const IP_CACHE_KEY = "device-info-ip-cache"
const IP_CACHE_PREFERENCE_KEY = "device-info-ip-cache-enabled"

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

export default function DeviceInfoPage() {
  const t = useTranslations("device")
  
  // 设置状态
  const [showDeviceSettings, setShowDeviceSettings] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [enableCache, setEnableCache] = useState(true)
  const [detailedInfo, setDetailedInfo] = useState(true)
  const [realTimeMonitoring, setRealTimeMonitoring] = useState(false)
  
  // 原有状态
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState<{ [key: string]: boolean }>({})
  const [activeTab, setActiveTab] = useState("basic")
  const [ipLoading, setIpLoading] = useState(true)
  const ipFetchedRef = useRef(false) // 添加一个引用来跟踪IP信息是否已经获取
  const collectionRunRef = useRef(0)

  // Copy timeout refs
  const copyTimeoutRef = useRef<{ [key: string]: NodeJS.Timeout | null }>({})

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
    if (userAgent.indexOf("Firefox") > -1) {
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

    if (userAgent.indexOf("Windows NT 10.0") !== -1) osName = "Windows 10"
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
    } else if (userAgent.indexOf("like Mac") !== -1) {
      osName = "iOS"
      const match = userAgent.match(/OS ([0-9_]+)/)
      if (match) osVersion = match[1].replace(/_/g, ".")
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

    // Check if mobile or tablet
    if (/Mobi/i.test(userAgent)) {
      deviceType = "Mobile"
    } else if (/Tablet|iPad/i.test(userAgent)) {
      deviceType = "Tablet"
    }

    // Try to detect vendor and model
    if (userAgent.indexOf("iPhone") !== -1) {
      deviceVendor = "Apple"
      deviceModel = "iPhone"
    } else if (userAgent.indexOf("iPad") !== -1) {
      deviceVendor = "Apple"
      deviceModel = "iPad"
    } else if (userAgent.indexOf("Pixel") !== -1) {
      deviceVendor = "Google"
      const match = userAgent.match(/Pixel ([0-9XL]+)/)
      if (match) deviceModel = `Pixel ${match[1]}`
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
    const colorDepth = window.screen.colorDepth
    const orientation = window.screen.orientation ? window.screen.orientation.type : "unknown"
    const ratio = Math.round((width / height) * 100) / 100
    const dpr = window.devicePixelRatio || 1

    return {
      width,
      height,
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
      (window as any).doNotTrack === "1" ||
      navigator.doNotTrack === "1"
        ? true
        : navigator.doNotTrack === "0" || navigator.doNotTrack === "no" || (window as any).doNotTrack === "0"
          ? false
          : null

    return {
      cookies: navigator.cookieEnabled,
      localStorage: !!window.localStorage,
      sessionStorage: !!window.sessionStorage,
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

    // 检查是否有真实的连接信息
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
    const applyIpInfo = (data: IpGeoInfo | null) => {
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

      const controller = new AbortController()
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
      ipFetchedRef.current = true
      setIpLoading(false)
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
      if (runId === collectionRunRef.current) setError("Failed to gather device information")
    } finally {
      if (runId === collectionRunRef.current) setLoading(false)
    }
  }

  // Function to copy text to clipboard
  const copyToClipboard = async (text: string, key: string) => {
    const legacyCopy = () => {
      const textarea = document.createElement("textarea")
      textarea.value = text
      textarea.style.cssText = "position:fixed;opacity:0;pointer-events:none"
      document.body.appendChild(textarea)
      textarea.select()
      const copied = document.execCommand("copy")
      textarea.remove()
      if (!copied) throw new Error("Copy command was rejected")
    }

    try {
      if (navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(text)
        } catch {
          legacyCopy()
        }
      } else {
        legacyCopy()
      }

      // Clear previous timeout
      if (copyTimeoutRef.current[key]) {
        clearTimeout(copyTimeoutRef.current[key]!)
      }

      setCopied((prev) => ({ ...prev, [key]: true }))

      // Set new timeout
      copyTimeoutRef.current[key] = setTimeout(() => {
        setCopied((prev) => ({ ...prev, [key]: false }))
      }, 2000)
    } catch {
      setCopied((prev) => ({ ...prev, [key]: false }))
    }
  }

  // Function to copy all device info as JSON
  const copyAllAsJson = () => {
    if (!deviceInfo) return

    const jsonString = JSON.stringify(deviceInfo, (key, value) => key === "previewUrl" ? undefined : value, 2)
    copyToClipboard(jsonString, "all")
  }

  // 修改 refreshDeviceInfo 函数，清除缓存
  const refreshDeviceInfo = () => {
    // 重置IP获取状态
    ipFetchedRef.current = false
    // 清除本地缓存
    localStorage.removeItem(IP_CACHE_KEY)
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

  // 获取电池信息
  const getBatteryInfo = async () => {
    try {
      if ("getBattery" in navigator) {
        const battery = await (navigator as any).getBattery()

        setBatteryLevel(battery.level)
        setBatteryCharging(battery.charging)

        if (battery.charging) {
          const chargingTime =
            battery.chargingTime === Number.POSITIVE_INFINITY
              ? "Unknown"
              : `${Math.floor(battery.chargingTime / 60)} minutes`
          setBatteryStatus(`Charging (${chargingTime} remaining)`)
        } else {
          const dischargingTime =
            battery.dischargingTime === Number.POSITIVE_INFINITY
              ? "Unknown"
              : `${Math.floor(battery.dischargingTime / 60)} minutes`
          setBatteryStatus(`Discharging (${dischargingTime} remaining)`)
        }

        // 添加电池事件监听器
        battery.addEventListener("levelchange", () => {
          setBatteryLevel(battery.level)
        })

        battery.addEventListener("chargingchange", () => {
          setBatteryCharging(battery.charging)
          if (battery.charging) {
            setBatteryStatus(`Charging (${Math.floor(battery.chargingTime / 60)} minutes remaining)`)
          } else {
            setBatteryStatus(`Discharging (${Math.floor(battery.dischargingTime / 60)} minutes remaining)`)
          }
        })
      }
    } catch (error) {
      console.error("Error getting battery info:", error)
    }
  }

  // Initialize on component mount
  useEffect(() => {
    try {
      const savedPreference = localStorage.getItem(IP_CACHE_PREFERENCE_KEY)
      if (savedPreference !== null) setEnableCache(savedPreference === "true")
    } catch {
      setEnableCache(false)
    }

    void gatherDeviceInfo()
    void getBatteryInfo()

    // Clean up timeouts on unmount
    return () => {
      Object.values(copyTimeoutRef.current).forEach((timeout) => {
        if (timeout) clearTimeout(timeout)
      })
    }
  }, [])

  useEffect(() => {
    if (!autoRefresh) return
    const interval = window.setInterval(() => {
      ipFetchedRef.current = false
      void gatherDeviceInfo()
    }, 60_000)
    return () => window.clearInterval(interval)
  }, [autoRefresh])

  useEffect(() => {
    if (!realTimeMonitoring) return

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
  }, [realTimeMonitoring])

  // 添加新的 useEffect 来监听 deviceInfo 的变化
  useEffect(() => {
    if (deviceInfo && !ipFetchedRef.current) {
      fetchIPInfo()
    }
  }, [deviceInfo])

  // Render a data item with copy button
  const renderDataItem = (label: string, value: string | number | boolean | null, copyKey: string) => {
    const displayValue = value === null ? "Not detected" : String(value)

    return (
      <div className="grid min-h-11 grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)_2.5rem] items-center gap-2 border-b border-gray-100 py-1.5 dark:border-gray-800">
        <div className="min-w-0 text-xs font-medium text-gray-600 dark:text-gray-400">{label}</div>
        <div className="min-w-0 truncate text-right text-sm" title={displayValue}>{displayValue}</div>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 shrink-0 rounded-full"
                onClick={() => copyToClipboard(displayValue, copyKey)}
                aria-label={`复制${label}`}
              >
                {copied[copyKey] ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{copied[copyKey] ? t("copied") : t("copy")}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    )
  }

  return (
    <div className="device-tool-page container mx-auto max-w-7xl px-3 py-3 sm:px-4 sm:py-6">
      <section className="mb-4 flex items-center gap-3 sm:mb-6 sm:justify-center">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-500/12 text-blue-700 dark:text-blue-300 sm:h-12 sm:w-12">
          <Smartphone className="h-6 w-6" />
        </span>
        <div className="min-w-0 sm:text-center">
          <h1 className="text-xl font-bold tracking-tight text-gray-800 dark:text-gray-200 sm:text-3xl">设备信息检测</h1>
          <p className="mt-0.5 text-xs leading-5 text-gray-600 dark:text-gray-400 sm:text-sm">
            浏览器本地采集，快速查看环境与指纹信号
          </p>
        </div>
      </section>

      <div className="mb-4 flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowDeviceSettings(!showDeviceSettings)}
          aria-expanded={showDeviceSettings}
          className="min-h-10 min-w-0 flex-1 justify-start gap-2 rounded-full px-3 text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
        >
          <Settings className="h-4 w-4 shrink-0" />
          <span className="truncate">检测设置</span>
          {showDeviceSettings ? <ChevronUp className="ml-auto h-4 w-4 shrink-0" /> : <ChevronDown className="ml-auto h-4 w-4 shrink-0" />}
        </Button>

        <Button
          type="button"
          onClick={refreshDeviceInfo}
          disabled={loading}
          className="min-h-10 shrink-0 gap-1.5 rounded-full px-3"
          aria-label="重新检测设备信息"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          <span>{loading ? "检测中" : "重新检测"}</span>
        </Button>

        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={copyAllAsJson}
          disabled={!deviceInfo || loading}
          className="h-10 w-10 shrink-0 rounded-full"
          aria-label={copied.all ? "设备信息已复制" : "复制全部设备信息"}
        >
          {copied.all ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
        </Button>
      </div>

      {showDeviceSettings && (
        <Card className="mb-4 rounded-2xl">
          <CardContent className="p-3 sm:p-4">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <div className="flex min-h-12 items-center justify-between gap-3 rounded-xl bg-gray-100 px-3 py-2 dark:bg-gray-800">
                  <Label htmlFor="auto-refresh" className="min-w-0 cursor-pointer text-sm">
                    <span className="block font-medium">定时刷新</span>
                    <span className="block text-xs text-gray-500">每 60 秒重新采集</span>
                  </Label>
                  <Switch id="auto-refresh" checked={autoRefresh} onCheckedChange={setAutoRefresh} />
                </div>
                <div className="flex min-h-12 items-center justify-between gap-3 rounded-xl bg-gray-100 px-3 py-2 dark:bg-gray-800">
                  <Label htmlFor="enable-cache" className="min-w-0 cursor-pointer text-sm">
                    <span className="block font-medium">网络信息缓存</span>
                    <span className="block text-xs text-gray-500">保留 3 小时</span>
                  </Label>
                  <Switch id="enable-cache" checked={enableCache} onCheckedChange={handleCacheChange} />
                </div>
                <div className="flex min-h-12 items-center justify-between gap-3 rounded-xl bg-gray-100 px-3 py-2 dark:bg-gray-800">
                  <Label htmlFor="detailed-info" className="min-w-0 cursor-pointer text-sm">
                    <span className="block font-medium">指纹原始详情</span>
                    <span className="block text-xs text-gray-500">默认折叠显示</span>
                  </Label>
                  <Switch id="detailed-info" checked={detailedInfo} onCheckedChange={setDetailedInfo} />
                </div>
                <div className="flex min-h-12 items-center justify-between gap-3 rounded-xl bg-gray-100 px-3 py-2 dark:bg-gray-800">
                  <Label htmlFor="real-time" className="min-w-0 cursor-pointer text-sm">
                    <span className="block font-medium">环境变化监听</span>
                    <span className="block text-xs text-gray-500">屏幕与网络状态</span>
                  </Label>
                  <Switch id="real-time" checked={realTimeMonitoring} onCheckedChange={setRealTimeMonitoring} />
                </div>
              </div>
            </CardContent>
          </Card>
      )}

      {error ? (
        <Card className="card-modern">
          <CardContent className="text-center py-8">
            <div className="text-red-500 text-lg mb-4">设备信息获取失败</div>
            <div className="text-gray-600 dark:text-gray-400">{error}</div>
            <Button onClick={refreshDeviceInfo} className="mt-4">
              <RefreshCw className="h-4 w-4 mr-2" />
              重新尝试
            </Button>
          </CardContent>
        </Card>
      ) : loading ? (
        <Card className="card-modern">
          <CardContent className="py-10 text-center">
            <RefreshCw className="mx-auto mb-4 h-10 w-10 animate-spin text-blue-600" />
            <div className="font-medium text-gray-800 dark:text-gray-200">正在采集浏览器环境与指纹信号…</div>
            <div className="mt-2 text-xs text-gray-600 dark:text-gray-400">全部处理都在当前浏览器本地完成</div>
          </CardContent>
        </Card>
      ) : deviceInfo ? (
        <div className="space-y-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div className="relative mb-4 w-full">
              <TabsList aria-label="设备信息分类" className="grid h-auto w-full grid-cols-3 gap-1 rounded-2xl border border-gray-200 bg-white p-1 shadow-sm dark:border-gray-700 dark:bg-gray-800 md:grid-cols-6">
                <TabsTrigger
                  value="basic"
                  className="flex min-h-10 min-w-0 items-center justify-center gap-1 rounded-xl px-1 py-2 text-xs transition-all duration-200 data-[state=active]:bg-blue-100 data-[state=active]:text-blue-700 dark:data-[state=active]:bg-blue-900 dark:data-[state=active]:text-blue-300 sm:px-2"
                >
                  <Monitor className="hidden h-4 w-4 shrink-0 sm:block" />
                  <span className="font-medium">基础信息</span>
                </TabsTrigger>
                <TabsTrigger
                  value="network"
                  className="flex min-h-10 min-w-0 items-center justify-center gap-1 rounded-xl px-1 py-2 text-xs transition-all duration-200 data-[state=active]:bg-green-100 data-[state=active]:text-green-700 dark:data-[state=active]:bg-green-900 dark:data-[state=active]:text-green-300 sm:px-2"
                >
                  <Wifi className="hidden h-4 w-4 shrink-0 sm:block" />
                  <span className="font-medium">网络信息</span>
                </TabsTrigger>
                <TabsTrigger
                  value="system"
                  className="flex min-h-10 min-w-0 items-center justify-center gap-1 rounded-xl px-1 py-2 text-xs transition-all duration-200 data-[state=active]:bg-purple-100 data-[state=active]:text-purple-700 dark:data-[state=active]:bg-purple-900 dark:data-[state=active]:text-purple-300 sm:px-2"
                >
                  <Cpu className="hidden h-4 w-4 shrink-0 sm:block" />
                  <span className="font-medium">系统信息</span>
                </TabsTrigger>
                <TabsTrigger
                  value="hardware"
                  className="flex min-h-10 min-w-0 items-center justify-center gap-1 rounded-xl px-1 py-2 text-xs transition-all duration-200 data-[state=active]:bg-orange-100 data-[state=active]:text-orange-700 dark:data-[state=active]:bg-orange-900 dark:data-[state=active]:text-orange-300 sm:px-2"
                >
                  <Battery className="hidden h-4 w-4 shrink-0 sm:block" />
                  <span className="font-medium">硬件信息</span>
                </TabsTrigger>
                <TabsTrigger
                  value="features"
                  className="flex min-h-10 min-w-0 items-center justify-center gap-1 rounded-xl px-1 py-2 text-xs transition-all duration-200 data-[state=active]:bg-red-100 data-[state=active]:text-red-700 dark:data-[state=active]:bg-red-900 dark:data-[state=active]:text-red-300 sm:px-2"
                >
                  <Shield className="hidden h-4 w-4 shrink-0 sm:block" />
                  <span className="font-medium">功能特性</span>
                </TabsTrigger>
                <TabsTrigger
                  value="fingerprint"
                  className="flex min-h-10 min-w-0 items-center justify-center gap-1 rounded-xl px-1 py-2 text-xs transition-all duration-200 data-[state=active]:bg-indigo-100 data-[state=active]:text-indigo-700 dark:data-[state=active]:bg-indigo-900 dark:data-[state=active]:text-indigo-300 sm:px-2"
                >
                  <Fingerprint className="hidden h-4 w-4 shrink-0 sm:block" />
                  <span className="font-medium">设备指纹</span>
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="basic" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="card-modern">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Globe className="h-5 w-5 text-blue-600" />
                      浏览器信息
                      {deviceInfo.browser.mobile && (
                        <Badge variant="secondary" className="text-xs">
                          移动端
                        </Badge>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-0 p-4 pt-0 sm:p-6 sm:pt-0">
                    {renderDataItem("用户代理", deviceInfo.userAgent, "userAgent")}
                    {renderDataItem("浏览器名称", deviceInfo.browser.name, "browserName")}
                    {renderDataItem("浏览器版本", deviceInfo.browser.version, "browserVersion")}
                    {renderDataItem("渲染引擎", deviceInfo.browser.engine, "browserEngine")}
                    {renderDataItem("移动设备", deviceInfo.browser.mobile ? "是" : "否", "isMobile")}
                  </CardContent>
                </Card>

                <Card className="card-modern">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Smartphone className="h-5 w-5 text-green-600" />
                      设备信息
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-0 p-4 pt-0 sm:p-6 sm:pt-0">
                    {renderDataItem("设备类型", deviceInfo.device.type, "deviceType")}
                    {renderDataItem("设备厂商", deviceInfo.device.vendor, "deviceVendor")}
                    {renderDataItem("设备型号", deviceInfo.device.model, "deviceModel")}
                  </CardContent>
                </Card>

                <Card className="card-modern lg:col-span-2">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Monitor className="h-5 w-5 text-purple-600" />
                      操作系统信息
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {renderDataItem("操作系统", deviceInfo.os.name, "osName")}
                    {renderDataItem("系统版本", deviceInfo.os.version, "osVersion")}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="network" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="card-modern">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Globe className="h-5 w-5 text-green-600" />
                      IP 地址信息
                      {enableCache && (
                        <Badge variant="secondary" className="text-xs">
                          <Eye className="h-3 w-3 mr-1" />
                          缓存
                        </Badge>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {ipLoading ? (
                      <div className="flex flex-col items-center justify-center py-8">
                        <RefreshCw className="h-8 w-8 animate-spin text-green-600 mb-4" />
                        <div className="text-sm text-gray-600 dark:text-gray-400">获取网络信息中...</div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {renderDataItem("IP 地址", deviceInfo.network.ip, "ipAddress")}
                        {renderDataItem("大洲", deviceInfo.network.continent || "Unknown", "continent")}
                        {renderDataItem("国家", deviceInfo.network.country || "Unknown", "country")}
                        {renderDataItem("地区", deviceInfo.network.region || "Unknown", "region")}
                        {renderDataItem("城市", deviceInfo.network.city || "Unknown", "city")}
                        {renderDataItem("ISP 服务商", deviceInfo.network.isp || "Unknown", "isp")}
                        {deviceInfo.network.coordinates &&
                          renderDataItem(
                            "坐标位置",
                            `${deviceInfo.network.coordinates.latitude}, ${deviceInfo.network.coordinates.longitude}`,
                            "coordinates",
                          )}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="card-modern">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Wifi className="h-5 w-5 text-blue-600" />
                      连接信息
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-0 p-4 pt-0 sm:p-6 sm:pt-0">
                    {renderDataItem("连接类型", deviceInfo.network.connectionType, "connectionType")}
                    {renderDataItem("下载速率", typeof deviceInfo.network.downlink === 'number' ? `${deviceInfo.network.downlink} Mbps` : deviceInfo.network.downlink, "downlink")}
                    {renderDataItem("网络延迟", typeof deviceInfo.network.rtt === 'number' ? `${deviceInfo.network.rtt} ms` : deviceInfo.network.rtt, "rtt")}
                    {renderDataItem("数据节省", typeof deviceInfo.network.saveData === 'boolean' ? (deviceInfo.network.saveData ? "启用" : "禁用") : deviceInfo.network.saveData, "saveData")}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="system" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="card-modern">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Monitor className="h-5 w-5 text-purple-600" />
                      屏幕信息
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-0 p-4 pt-0 sm:p-6 sm:pt-0">
                    {renderDataItem(
                      "屏幕分辨率",
                      `${deviceInfo.screen.width} x ${deviceInfo.screen.height}`,
                      "resolution",
                    )}
                    {renderDataItem("颜色深度", `${deviceInfo.screen.colorDepth} bit`, "colorDepth")}
                    {renderDataItem("像素比例", deviceInfo.screen.dpr, "pixelRatio")}
                    {renderDataItem("屏幕方向", deviceInfo.screen.orientation, "orientation")}
                    {renderDataItem("宽高比", deviceInfo.screen.ratio, "aspectRatio")}
                  </CardContent>
                </Card>

                <Card className="card-modern">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Globe className="h-5 w-5 text-orange-600" />
                      语言与时区
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-0 p-4 pt-0 sm:p-6 sm:pt-0">
                    {renderDataItem("首选语言", deviceInfo.language.language, "language")}
                    {renderDataItem("支持语言", deviceInfo.language.languages.join(", "), "languages")}
                    {renderDataItem("时区", deviceInfo.language.timeZone, "timeZone")}
                    {renderDataItem("时区偏移", `${deviceInfo.language.timeZoneOffset} 分钟`, "timeZoneOffset")}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="hardware" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="card-modern">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Cpu className="h-5 w-5 text-orange-600" />
                      处理器信息
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-0 p-4 pt-0 sm:p-6 sm:pt-0">
                    {renderDataItem(
                      "设备内存",
                      (navigator as any).deviceMemory ? `${(navigator as any).deviceMemory} GB` : "不可用",
                      "deviceMemory",
                    )}
                    {renderDataItem(
                      "硬件并发",
                      navigator.hardwareConcurrency || "不可用",
                      "hardwareConcurrency",
                    )}
                    {renderDataItem("最大触点数", navigator.maxTouchPoints || "不可用", "maxTouchPoints")}
                  </CardContent>
                </Card>

                <Card className="card-modern">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Battery className="h-5 w-5 text-green-600" />
                      电池信息
                      {realTimeMonitoring && (
                        <Badge variant="secondary" className="text-xs">
                          <Zap className="h-3 w-3 mr-1" />
                          实时
                        </Badge>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-0 p-4 pt-0 sm:p-6 sm:pt-0">
                    {renderDataItem("电池状态", batteryStatus, "batteryStatus")}
                    {renderDataItem(
                      "电池电量",
                      batteryLevel !== null ? `${Math.round(batteryLevel * 100)}%` : "不可用",
                      "batteryLevel",
                    )}
                    {renderDataItem(
                      "充电状态",
                      batteryCharging !== null ? (batteryCharging ? "充电中" : "未充电") : "不可用",
                      "batteryCharging",
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="features" className="space-y-6">
              <Card className="card-modern">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Shield className="h-5 w-5 text-red-600" />
                    浏览器功能特性
                    {detailedInfo && (
                      <Badge variant="secondary" className="text-xs">
                        详细模式
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {renderDataItem("Cookies", deviceInfo.features.cookies ? "启用" : "禁用", "cookies")}
                  {renderDataItem(
                    "本地存储",
                    deviceInfo.features.localStorage ? "可用" : "不可用",
                    "localStorage",
                  )}
                  {renderDataItem(
                    "会话存储",
                    deviceInfo.features.sessionStorage ? "可用" : "不可用",
                    "sessionStorage",
                  )}
                  {renderDataItem(
                    "Web Workers",
                    deviceInfo.features.webWorkers ? "支持" : "不支持",
                    "webWorkers",
                  )}
                  {renderDataItem(
                    "Service Workers",
                    deviceInfo.features.serviceWorkers ? "支持" : "不支持",
                    "serviceWorkers",
                  )}
                  {renderDataItem("WebGL", deviceInfo.features.webGL ? "支持" : "不支持", "webGL")}
                  {renderDataItem("Canvas", deviceInfo.features.canvas ? "支持" : "不支持", "canvas")}
                  {renderDataItem("WebRTC", deviceInfo.features.webRTC ? "支持" : "不支持", "webRTC")}
                  {renderDataItem("触摸屏", deviceInfo.features.touchScreen ? "是" : "否", "touchScreen")}
                  {renderDataItem(
                    "请勿跟踪",
                    deviceInfo.features.doNotTrack === null
                      ? "未指定"
                      : deviceInfo.features.doNotTrack
                        ? "启用"
                        : "禁用",
                    "doNotTrack",
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="fingerprint" className="mt-0">
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
