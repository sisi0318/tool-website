"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Copy, Check, RefreshCw, Globe, Monitor, Cpu, Shield, Fingerprint, Battery, Smartphone, Settings, ChevronUp, ChevronDown, Zap, Eye, Wifi } from "lucide-react"
import { useTranslations } from "@/hooks/use-translations"

interface DevicePageProps {
  params?: Record<string, string>
}

// 在文件顶部添加缓存相关的常量
const CLIENT_CACHE_DURATION = 3 * 60 * 60 * 1000 // 3小时，单位毫秒
const IP_CACHE_KEY = "device-info-ip-cache"

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
  fingerprint: {
    canvas: string
    webGL: string
    audio: string
    fonts: string[]
  }
}

export default function DeviceInfoPage({ params }: DevicePageProps) {
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
  const [ipInfo, setIpInfo] = useState<any>(null)
  const [ipLoading, setIpLoading] = useState(true)
  const [canvasFingerprint, setCanvasFingerprint] = useState<string>("")
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const ipFetchedRef = useRef(false) // 添加一个引用来跟踪IP信息是否已经获取

  // Copy timeout refs
  const copyTimeoutRef = useRef<{ [key: string]: NodeJS.Timeout | null }>({})

  const [batteryStatus, setBatteryStatus] = useState<string>("Not available")
  const [batteryLevel, setBatteryLevel] = useState<number | null>(null)
  const [batteryCharging, setBatteryCharging] = useState<boolean | null>(null)
  const [navigatorFingerprint, setNavigatorFingerprint] = useState<string>("")

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

  // Function to generate canvas fingerprint
  const generateCanvasFingerprint = () => {
    try {
      const canvas = document.createElement("canvas")
      canvas.width = 200
      canvas.height = 50
      const ctx = canvas.getContext("2d")

      if (!ctx) return "Canvas not supported"

      // Draw background
      ctx.fillStyle = "rgb(255, 255, 255)"
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      // Draw text
      ctx.fillStyle = "rgb(0, 0, 0)"
      ctx.font = "18px Arial"
      ctx.fillText("Canvas Fingerprint", 10, 30)

      // Draw shapes
      ctx.strokeStyle = "rgb(255, 0, 0)"
      ctx.beginPath()
      ctx.arc(160, 25, 20, 0, Math.PI * 2)
      ctx.stroke()

      // Get data URL and hash it
      const dataURL = canvas.toDataURL()
      return dataURL
    } catch (e) {
      return "Error generating canvas fingerprint"
    }
  }

  // Function to generate WebGL fingerprint
  const generateWebGLFingerprint = () => {
    try {
      const canvas = document.createElement("canvas")
      const gl = (canvas.getContext("webgl") || canvas.getContext("experimental-webgl")) as WebGLRenderingContext | null

      if (!gl) return "WebGL not supported"

      const info = {
        vendor: gl.getParameter(gl.VENDOR),
        renderer: gl.getParameter(gl.RENDERER),
        version: gl.getParameter(gl.VERSION),
        shadingLanguageVersion: gl.getParameter(gl.SHADING_LANGUAGE_VERSION),
        extensions: gl.getSupportedExtensions(),
      }

      return JSON.stringify(info)
    } catch (e) {
      return "Error generating WebGL fingerprint"
    }
  }

  // Function to generate audio fingerprint
  const generateAudioFingerprint = () => {
    try {
      if (typeof AudioContext === "undefined" && typeof (window as any).webkitAudioContext === "undefined") {
        return "Audio API not supported"
      }

      const audioContext = new (AudioContext || (window as any).webkitAudioContext)()
      const oscillator = audioContext.createOscillator()
      const analyser = audioContext.createAnalyser()
      const gain = audioContext.createGain()

      analyser.fftSize = 1024
      gain.gain.value = 0 // Mute the sound

      oscillator.type = "triangle"
      oscillator.frequency.value = 440 // A4 note

      oscillator.connect(analyser)
      analyser.connect(gain)
      gain.connect(audioContext.destination)

      oscillator.start(0)

      const dataArray = new Uint8Array(analyser.frequencyBinCount)
      analyser.getByteFrequencyData(dataArray)

      oscillator.stop()
      audioContext.close()

      return Array.from(dataArray).slice(0, 20).join(",")
    } catch (e) {
      return "Error generating audio fingerprint"
    }
  }

  // Function to detect available fonts
  const detectFonts = () => {
    const baseFonts = ["monospace", "sans-serif", "serif"]
    const fontList = [
      "Arial",
      "Arial Black",
      "Arial Narrow",
      "Calibri",
      "Cambria",
      "Cambria Math",
      "Comic Sans MS",
      "Consolas",
      "Courier",
      "Courier New",
      "Georgia",
      "Helvetica",
      "Impact",
      "Lucida Console",
      "Lucida Sans Unicode",
      "Microsoft Sans Serif",
      "Palatino Linotype",
      "Segoe UI",
      "Tahoma",
      "Times",
      "Times New Roman",
      "Trebuchet MS",
      "Verdana",
    ]

    const testString = "mmmmmmmmmmlli"
    const testSize = "72px"
    const h = document.getElementsByTagName("body")[0]

    const s = document.createElement("span")
    s.style.fontSize = testSize
    s.innerHTML = testString

    const defaultWidth: { [key: string]: number } = {}
    const defaultHeight: { [key: string]: number } = {}

    for (const font of baseFonts) {
      s.style.fontFamily = font
      h.appendChild(s)
      defaultWidth[font] = s.offsetWidth
      defaultHeight[font] = s.offsetHeight
      h.removeChild(s)
    }

    const result = []

    for (const font of fontList) {
      let detected = false
      for (const baseFont of baseFonts) {
        s.style.fontFamily = `'${font}', ${baseFont}`
        h.appendChild(s)
        const matched = s.offsetWidth !== defaultWidth[baseFont] || s.offsetHeight !== defaultHeight[baseFont]
        h.removeChild(s)

        if (matched) {
          detected = true
          break
        }
      }

      if (detected) {
        result.push(font)
      }

      if (result.length >= 10) break // Limit to 10 fonts for performance
    }

    return result
  }

  // Function to get fingerprint information
  const getFingerprint = () => {
    return {
      canvas: generateCanvasFingerprint(),
      webGL: generateWebGLFingerprint(),
      audio: generateAudioFingerprint(),
      fonts: detectFonts(),
    }
  }

  // Replace the fetchIPInfo function with this new implementation that uses api-ipv4.ip.sb/geoip

  const fetchIPInfo = async () => {
    try {
      setIpLoading(true)

      // 检查本地缓存
      const cachedData = localStorage.getItem(IP_CACHE_KEY)
      if (cachedData) {
        try {
          const { data, timestamp } = JSON.parse(cachedData)
          const now = Date.now()

          // 如果缓存未过期，使用缓存数据
          if (now - timestamp < CLIENT_CACHE_DURATION) {
            console.log("Using cached IP info from localStorage")

            // 标记IP信息已经获取
            ipFetchedRef.current = true

            setIpInfo(data)

            if (deviceInfo) {
              setDeviceInfo({
                ...deviceInfo,
                network: {
                  ...deviceInfo.network,
                  ip: data.ip || "Unknown",
                  ipv6: "Not available",
                  isp: data.isp || "Unknown",
                  country: data.country || "Unknown",
                  region: data.region || "Unknown",
                  city: data.city || "Unknown",
                  continent: data.continent_code || "Unknown",
                  coordinates: {
                    latitude: data.latitude || "Unknown",
                    longitude: data.longitude || "Unknown",
                  },
                },
              })
            }

            setIpLoading(false)
            return
          }
        } catch (e) {
          console.error("Error parsing cached IP data:", e)
          // 缓存解析错误，继续获取新数据
        }
      }

      // 直接从 ip.sb API 获取 IP 信息
      const response = await fetch("https://api-ipv4.ip.sb/geoip")
      if (!response.ok) {
        throw new Error(`IP info API responded with status: ${response.status}`)
      }

      const ipData = await response.json()
      console.log("IP.sb API response:", ipData)

      // 缓存结果到localStorage
      localStorage.setItem(
        IP_CACHE_KEY,
        JSON.stringify({
          data: ipData,
          timestamp: Date.now(),
        }),
      )

      // 标记IP信息已经获取
      ipFetchedRef.current = true

      setIpInfo(ipData)

      if (deviceInfo) {
        setDeviceInfo({
          ...deviceInfo,
          network: {
            ...deviceInfo.network,
            ip: ipData.ip || "Unknown",
            ipv6: "Not available",
            isp: ipData.isp || "Unknown",
            country: ipData.country || "Unknown",
            region: ipData.region || "Unknown",
            city: ipData.city || "Unknown",
            continent: ipData.continent_code || "Unknown",
            coordinates: {
              latitude: ipData.latitude || "Unknown",
              longitude: ipData.longitude || "Unknown",
            },
          },
        })
      }
    } catch (error) {
      console.error("Error fetching IP info:", error)

      // Set basic IP info even if detailed info fails
      if (deviceInfo) {
        setDeviceInfo({
          ...deviceInfo,
          network: {
            ...deviceInfo.network,
            ip: "Unknown",
            ipv6: "Not available",
            isp: "Unknown",
            country: "Unknown",
            region: "Unknown",
            city: "Unknown",
            continent: "Unknown",
            coordinates: {
              latitude: "Unknown",
              longitude: "Unknown",
            },
          },
        })
      }
    } finally {
      // 确保在所有情况下都设置ipLoading为false
      setIpLoading(false)
    }
  }

  // Function to gather all device information
  const gatherDeviceInfo = () => {
    try {
      setLoading(true)

      const info: DeviceInfo = {
        userAgent: navigator.userAgent,
        browser: detectBrowser(),
        os: detectOS(),
        device: detectDevice(),
        screen: getScreenInfo(),
        network: getNetworkInfo(),
        language: getLanguageInfo(),
        features: checkFeatures(),
        fingerprint: getFingerprint(),
      }

      setDeviceInfo(info)
      setError(null)
    } catch (err) {
      console.error("Error gathering device info:", err)
      setError("Failed to gather device information")
    } finally {
      setLoading(false)
    }
  }

  // Function to copy text to clipboard
  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text).then(() => {
      // Clear previous timeout
      if (copyTimeoutRef.current[key]) {
        clearTimeout(copyTimeoutRef.current[key]!)
      }

      setCopied((prev) => ({ ...prev, [key]: true }))

      // Set new timeout
      copyTimeoutRef.current[key] = setTimeout(() => {
        setCopied((prev) => ({ ...prev, [key]: false }))
      }, 2000)
    })
  }

  // Function to copy all device info as JSON
  const copyAllAsJson = () => {
    if (!deviceInfo) return

    const jsonString = JSON.stringify(deviceInfo, null, 2)
    copyToClipboard(jsonString, "all")
  }

  // 修改 refreshDeviceInfo 函数，清除缓存
  const refreshDeviceInfo = () => {
    // 重置IP获取状态
    ipFetchedRef.current = false
    // 清除本地缓存
    localStorage.removeItem(IP_CACHE_KEY)
    gatherDeviceInfo()
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

  // 生成导航器指纹
  const generateNavigatorFingerprint = () => {
    try {
      const nav = navigator
      const fingerprint = {
        userAgent: nav.userAgent,
        appName: nav.appName,
        appVersion: nav.appVersion,
        platform: nav.platform,
        vendor: nav.vendor,
        language: nav.language,
        languages: nav.languages,
        cookieEnabled: nav.cookieEnabled,
        doNotTrack: nav.doNotTrack,
        hardwareConcurrency: nav.hardwareConcurrency,
        maxTouchPoints: nav.maxTouchPoints,
        deviceMemory: (nav as any).deviceMemory,
        plugins: Array.from((nav as any).plugins || []).map((p: any) => p.name),
        mimeTypes: Array.from((nav as any).mimeTypes || []).map((m: any) => m.type),
        webdriver: (nav as any).webdriver,
        pdfViewerEnabled: (nav as any).pdfViewerEnabled,
      }

      setNavigatorFingerprint(JSON.stringify(fingerprint, null, 2))
    } catch (e) {
      setNavigatorFingerprint("Error generating navigator fingerprint")
    }
  }

  // Initialize on component mount
  useEffect(() => {
    gatherDeviceInfo()
    getBatteryInfo()
    generateNavigatorFingerprint()

    // Clean up timeouts on unmount
    return () => {
      Object.values(copyTimeoutRef.current).forEach((timeout) => {
        if (timeout) clearTimeout(timeout)
      })
    }
  }, [])

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
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center py-2 border-b border-gray-100 dark:border-gray-800">
        <div className="font-medium mb-1 sm:mb-0">{label}</div>
        <div className="flex items-center">
          <div
            className="text-left sm:text-right mr-2 max-w-full sm:max-w-[200px] md:max-w-[300px] truncate"
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
                  className="h-8 w-8 flex-shrink-0"
                  onClick={() => copyToClipboard(displayValue, copyKey)}
                >
                  {copied[copyKey] ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{copied[copyKey] ? t("copied") : t("copy")}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-4 max-w-7xl">
      {/* 页面标题 */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-200 mb-4 flex items-center justify-center gap-2">
          <Smartphone className="h-8 w-8 text-blue-600" />
          设备信息获取
        </h1>
      </div>

      {/* 设备设置折叠区域 */}
      <div className="mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowDeviceSettings(!showDeviceSettings)}
          className="w-full text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
        >
          <div className="flex items-center gap-2">
            {showDeviceSettings ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
            <Settings className="h-4 w-4" />
            <span>设备检测设置</span>
            {!showDeviceSettings && (
              <Badge variant="secondary" className="text-xs ml-auto">
                点击查看
              </Badge>
            )}
          </div>
        </Button>

        {showDeviceSettings && (
          <Card className="mt-3 card-modern">
            <CardContent className="py-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="flex items-center space-x-2 bg-gray-100 dark:bg-gray-800 p-3 rounded-lg">
                  <Label htmlFor="auto-refresh" className="cursor-pointer text-sm">
                    手动刷新
                  </Label>
                  <Switch id="auto-refresh" checked={autoRefresh} onCheckedChange={setAutoRefresh} />
                  <Label htmlFor="auto-refresh" className="cursor-pointer text-sm text-blue-600">
                    自动刷新
                  </Label>
                </div>
                <div className="flex items-center space-x-2 bg-gray-100 dark:bg-gray-800 p-3 rounded-lg">
                  <Label htmlFor="enable-cache" className="cursor-pointer text-sm">
                    禁用缓存
                  </Label>
                  <Switch id="enable-cache" checked={enableCache} onCheckedChange={setEnableCache} />
                  <Label htmlFor="enable-cache" className="cursor-pointer text-sm text-green-600">
                    启用缓存
                  </Label>
                </div>
                <div className="flex items-center space-x-2 bg-gray-100 dark:bg-gray-800 p-3 rounded-lg">
                  <Label htmlFor="detailed-info" className="cursor-pointer text-sm">
                    简化信息
                  </Label>
                  <Switch id="detailed-info" checked={detailedInfo} onCheckedChange={setDetailedInfo} />
                  <Label htmlFor="detailed-info" className="cursor-pointer text-sm text-purple-600">
                    详细信息
                  </Label>
                </div>
                <div className="flex items-center space-x-2 bg-gray-100 dark:bg-gray-800 p-3 rounded-lg">
                  <Label htmlFor="real-time" className="cursor-pointer text-sm">
                    静态模式
                  </Label>
                  <Switch id="real-time" checked={realTimeMonitoring} onCheckedChange={setRealTimeMonitoring} />
                  <Label htmlFor="real-time" className="cursor-pointer text-sm text-orange-600">
                    实时监控
                  </Label>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* 操作按钮区域 */}
      <div className="flex flex-wrap gap-4 justify-center mb-6">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="default" 
                size="lg"
                onClick={refreshDeviceInfo} 
                disabled={loading || ipLoading}
                className="h-12 px-6"
              >
                <RefreshCw className={`h-5 w-5 mr-2 ${loading || ipLoading ? "animate-spin" : ""}`} />
                {loading || ipLoading ? "检测中..." : "重新检测"}
                {realTimeMonitoring && (
                  <Badge variant="secondary" className="ml-2 text-xs">
                    <Zap className="h-3 w-3 mr-1" />
                    实时
                  </Badge>
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>刷新设备信息</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="outline" 
                size="lg"
                onClick={copyAllAsJson} 
                disabled={!deviceInfo || loading}
                className="h-12 px-6"
              >
                {copied["all"] ? (
                  <Check className="h-5 w-5 mr-2 text-green-500" />
                ) : (
                  <Copy className="h-5 w-5 mr-2" />
                )}
                {copied["all"] ? "已复制" : "复制全部"}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{copied["all"] ? "已复制到剪贴板" : "复制所有信息为JSON格式"}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

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
          <CardContent className="text-center py-12">
            <RefreshCw className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
            <div className="text-lg font-medium text-gray-800 dark:text-gray-200">正在检测设备信息...</div>
            <div className="text-sm text-gray-600 dark:text-gray-400 mt-2">
              {ipLoading ? "获取网络信息中..." : "收集设备数据中..."}
            </div>
          </CardContent>
        </Card>
      ) : deviceInfo ? (
        <div className="space-y-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div className="relative w-full mb-6">
              <TabsList className="grid w-full grid-cols-6 h-14 p-2 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
                <TabsTrigger
                  value="basic"
                  className="flex items-center justify-center gap-2 py-3 px-4 rounded-lg data-[state=active]:bg-blue-100 dark:data-[state=active]:bg-blue-900 data-[state=active]:text-blue-700 dark:data-[state=active]:text-blue-300 transition-all duration-200"
                >
                  <Monitor className="h-5 w-5" />
                  <span className="text-sm font-medium">基础信息</span>
                </TabsTrigger>
                <TabsTrigger
                  value="network"
                  className="flex items-center justify-center gap-2 py-3 px-4 rounded-lg data-[state=active]:bg-green-100 dark:data-[state=active]:bg-green-900 data-[state=active]:text-green-700 dark:data-[state=active]:text-green-300 transition-all duration-200"
                >
                  <Wifi className="h-5 w-5" />
                  <span className="text-sm font-medium">网络信息</span>
                </TabsTrigger>
                <TabsTrigger
                  value="system"
                  className="flex items-center justify-center gap-2 py-3 px-4 rounded-lg data-[state=active]:bg-purple-100 dark:data-[state=active]:bg-purple-900 data-[state=active]:text-purple-700 dark:data-[state=active]:text-purple-300 transition-all duration-200"
                >
                  <Cpu className="h-5 w-5" />
                  <span className="text-sm font-medium">系统信息</span>
                </TabsTrigger>
                <TabsTrigger
                  value="hardware"
                  className="flex items-center justify-center gap-2 py-3 px-4 rounded-lg data-[state=active]:bg-orange-100 dark:data-[state=active]:bg-orange-900 data-[state=active]:text-orange-700 dark:data-[state=active]:text-orange-300 transition-all duration-200"
                >
                  <Battery className="h-5 w-5" />
                  <span className="text-sm font-medium">硬件信息</span>
                </TabsTrigger>
                <TabsTrigger
                  value="features"
                  className="flex items-center justify-center gap-2 py-3 px-4 rounded-lg data-[state=active]:bg-red-100 dark:data-[state=active]:bg-red-900 data-[state=active]:text-red-700 dark:data-[state=active]:text-red-300 transition-all duration-200"
                >
                  <Shield className="h-5 w-5" />
                  <span className="text-sm font-medium">功能特性</span>
                </TabsTrigger>
                <TabsTrigger
                  value="fingerprint"
                  className="flex items-center justify-center gap-2 py-3 px-4 rounded-lg data-[state=active]:bg-indigo-100 dark:data-[state=active]:bg-indigo-900 data-[state=active]:text-indigo-700 dark:data-[state=active]:text-indigo-300 transition-all duration-200"
                >
                  <Fingerprint className="h-5 w-5" />
                  <span className="text-sm font-medium">设备指纹</span>
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
                  <CardContent className="space-y-3">
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
                  <CardContent className="space-y-3">
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
                  <CardContent className="space-y-3">
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
                  <CardContent className="space-y-3">
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
                  <CardContent className="space-y-3">
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
                  <CardContent className="space-y-3">
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
                  <CardContent className="space-y-3">
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

            <TabsContent value="fingerprint" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="card-modern">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Fingerprint className="h-5 w-5 text-indigo-600" />
                      Canvas 指纹
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="mb-4 flex justify-center">
                      <canvas
                        ref={canvasRef}
                        width="200"
                        height="50"
                        className="border-2 border-gray-200 dark:border-gray-700 rounded-lg"
                      ></canvas>
                    </div>
                    <div className="text-xs font-mono break-all bg-gray-100 dark:bg-gray-700 p-3 rounded-lg mb-3">
                      {deviceInfo.fingerprint.canvas.length > 100
                        ? deviceInfo.fingerprint.canvas.substring(0, 100) + "..."
                        : deviceInfo.fingerprint.canvas}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(deviceInfo.fingerprint.canvas, "canvasFingerprint")}
                      className="w-full"
                    >
                      {copied["canvasFingerprint"] ? (
                        <Check className="h-4 w-4 mr-2 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4 mr-2" />
                      )}
                      {copied["canvasFingerprint"] ? "已复制" : "复制指纹"}
                    </Button>
                  </CardContent>
                </Card>

                <Card className="card-modern">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Cpu className="h-5 w-5 text-purple-600" />
                      WebGL 指纹
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-xs font-mono break-all bg-gray-100 dark:bg-gray-700 p-3 rounded-lg mb-3">
                      {deviceInfo.fingerprint.webGL.length > 100
                        ? deviceInfo.fingerprint.webGL.substring(0, 100) + "..."
                        : deviceInfo.fingerprint.webGL}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(deviceInfo.fingerprint.webGL, "webGLFingerprint")}
                      className="w-full"
                    >
                      {copied["webGLFingerprint"] ? (
                        <Check className="h-4 w-4 mr-2 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4 mr-2" />
                      )}
                      {copied["webGLFingerprint"] ? "已复制" : "复制指纹"}
                    </Button>
                  </CardContent>
                </Card>

                <Card className="card-modern">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Shield className="h-5 w-5 text-orange-600" />
                      音频指纹
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-xs font-mono break-all bg-gray-100 dark:bg-gray-700 p-3 rounded-lg mb-3">
                      {deviceInfo.fingerprint.audio}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(deviceInfo.fingerprint.audio, "audioFingerprint")}
                      className="w-full"
                    >
                      {copied["audioFingerprint"] ? (
                        <Check className="h-4 w-4 mr-2 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4 mr-2" />
                      )}
                      {copied["audioFingerprint"] ? "已复制" : "复制指纹"}
                    </Button>
                  </CardContent>
                </Card>

                <Card className="card-modern">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Monitor className="h-5 w-5 text-green-600" />
                      字体指纹
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-xs font-mono bg-gray-100 dark:bg-gray-700 p-3 rounded-lg mb-3 max-h-40 overflow-y-auto">
                      {deviceInfo.fingerprint.fonts.map((font, index) => (
                        <div key={index} className="mb-1 px-2 py-1 bg-white dark:bg-gray-600 rounded text-center">
                          {font}
                        </div>
                      ))}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(deviceInfo.fingerprint.fonts.join(", "), "fontFingerprint")}
                      className="w-full"
                    >
                      {copied["fontFingerprint"] ? (
                        <Check className="h-4 w-4 mr-2 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4 mr-2" />
                      )}
                      {copied["fontFingerprint"] ? "已复制" : "复制字体列表"}
                    </Button>
                  </CardContent>
                </Card>

                <Card className="card-modern lg:col-span-2">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Globe className="h-5 w-5 text-red-600" />
                      导航器指纹
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-xs font-mono break-all bg-gray-100 dark:bg-gray-700 p-3 rounded-lg mb-3 max-h-60 overflow-y-auto">
                      {navigatorFingerprint}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(navigatorFingerprint, "navigatorFingerprint")}
                      className="w-full"
                    >
                      {copied["navigatorFingerprint"] ? (
                        <Check className="h-4 w-4 mr-2 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4 mr-2" />
                      )}
                      {copied["navigatorFingerprint"] ? "已复制" : "复制完整指纹"}
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      ) : null}
    </div>
  )
}
