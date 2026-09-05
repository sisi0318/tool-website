"use client"

import { copyTextToClipboard as writeClipboardText } from "@/lib/clipboard"
import { readLocalStorage, writeLocalStorage } from "@/lib/safe-storage"

import { useState, useEffect, useCallback, useRef } from "react"
import { useTranslations } from "@/hooks/use-translations"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Clock, Globe, Timer, AlarmClock, Plus, X, Copy, Check, Settings, ChevronUp, ChevronDown, Zap, RefreshCw, Play, Pause, Square } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Input } from "@/components/ui/input"
import { useToolActivity } from "@/components/tool-activity"

// Interface for the props
// Time zone configuration
const timeZones = [
  { id: "UTC", name: "UTC", offset: 0 },
  { id: "America/New_York", name: "New York (EST/EDT)", offset: -5 },
  { id: "America/Los_Angeles", name: "Los Angeles (PST/PDT)", offset: -8 },
  { id: "America/Chicago", name: "Chicago (CST/CDT)", offset: -6 },
  { id: "Europe/London", name: "London (GMT/BST)", offset: 0 },
  { id: "Europe/Paris", name: "Paris (CET/CEST)", offset: 1 },
  { id: "Europe/Berlin", name: "Berlin (CET/CEST)", offset: 1 },
  { id: "Asia/Tokyo", name: "Tokyo (JST)", offset: 9 },
  { id: "Asia/Shanghai", name: "Shanghai (CST)", offset: 8 },
  { id: "Asia/Singapore", name: "Singapore (SGT)", offset: 8 },
  { id: "Asia/Dubai", name: "Dubai (GST)", offset: 4 },
  { id: "Australia/Sydney", name: "Sydney (AEST/AEDT)", offset: 10 },
  { id: "Pacific/Auckland", name: "Auckland (NZST/NZDT)", offset: 12 },
]

// Date Format Options
const dateFormats = [
  { id: "full", name: "Full" }, // Wednesday, April 6, 2025
  { id: "long", name: "Long" }, // April 6, 2025
  { id: "medium", name: "Medium" }, // Apr 6, 2025
  { id: "short", name: "Short" }, // 4/6/25
]

// Time Format Options
const timeFormats = [
  { id: "12hour", name: "12-hour" },
  { id: "24hour", name: "24-hour" },
]

// Local storage keys
const WORLD_CLOCKS_STORAGE_KEY = "time_world_clocks"
const TIME_FORMAT_STORAGE_KEY = "time_format"
const DATE_FORMAT_STORAGE_KEY = "time_date_format"
const SHOW_SECONDS_STORAGE_KEY = "time_show_seconds"
const ACTIVE_TAB_STORAGE_KEY = "time_active_tab"

export default function TimePage() {
  const t = useTranslations("time")
  const isToolActive = useToolActivity()

  // 基础状态
  const [showTimeInfo, setShowTimeInfo] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(true)

  // State variables
  // 页面在构建时预渲染,服务端的"现在"和浏览器的"现在"必然不同;初始为 null,
  // 挂载后才写入真实时间,否则水合时文本对不上(React #418)
  const [currentTime, setCurrentTime] = useState<Date | null>(null)
  const [timeFormat, setTimeFormat] = useState<string>("12hour")
  const [dateFormat, setDateFormat] = useState<string>("full")
  const [showSeconds, setShowSeconds] = useState<boolean>(true)
  const [activeTab, setActiveTab] = useState<string>("current")
  const [worldClocks, setWorldClocks] = useState<string[]>([
    "UTC",
    "America/New_York",
    "Europe/London",
    "Asia/Shanghai",
    "Asia/Tokyo",
  ])
  const [newTimeZone, setNewTimeZone] = useState<string>("")
  const [copied, setCopied] = useState<{ [key: string]: boolean }>({})
  const [stopwatchRunning, setStopwatchRunning] = useState(false)
  const [stopwatchTime, setStopwatchTime] = useState(0)
  const [stopwatchLaps, setStopwatchLaps] = useState<number[]>([])
  const [timerRunning, setTimerRunning] = useState(false)
  const [timerTime, setTimerTime] = useState(0)
  const [timerDuration, setTimerDuration] = useState(300) // 5 minutes in seconds
  const [timerCompleted, setTimerCompleted] = useState(false)
  const [timestamp, setTimestamp] = useState<string>("")
  const [timestampUnit, setTimestampUnit] = useState<string>("seconds")
  const [timestampResult, setTimestampResult] = useState<{ local: string; utc: string } | null>(null)
  const [dateInput, setDateInput] = useState<string>("")
  const [dateResult, setDateResult] = useState<{ seconds: number; milliseconds: number } | null>(null)
  const [utcInput, setUtcInput] = useState<string>("")
  const [utcResult, setUtcResult] = useState<{ local: string; timestamp: number } | null>(null)

  // Refs for timers
  const clockInterval = useRef<ReturnType<typeof setInterval> | null>(null)
  const stopwatchInterval = useRef<ReturnType<typeof setInterval> | null>(null)
  const timerInterval = useRef<ReturnType<typeof setInterval> | null>(null)
  const copyTimeoutRef = useRef<{ [key: string]: ReturnType<typeof setTimeout> | null }>({})
  const stopwatchStartedAtRef = useRef<number | null>(null)
  const stopwatchBaseTimeRef = useRef(0)
  const timerEndsAtRef = useRef<number | null>(null)

  // Effect to update time every second
  useEffect(() => {
    if (!isToolActive) return
    setCurrentTime(new Date())
    if (!autoRefresh) return

    clockInterval.current = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)

    return () => {
      if (clockInterval.current) {
        clearInterval(clockInterval.current)
      }
    }
  }, [autoRefresh, isToolActive])

  // Load saved settings from localStorage
  useEffect(() => {
    // Load world clocks
    const savedWorldClocks = readLocalStorage(WORLD_CLOCKS_STORAGE_KEY)
    if (savedWorldClocks) {
      try {
        const parsed = JSON.parse(savedWorldClocks)
        if (Array.isArray(parsed)) {
          setWorldClocks(parsed)
        }
      } catch (e) {
        console.error("Error parsing saved world clocks:", e)
      }
    }

    // Load time format
    const savedTimeFormat = readLocalStorage(TIME_FORMAT_STORAGE_KEY)
    if (savedTimeFormat) {
      setTimeFormat(savedTimeFormat)
    }

    // Load date format
    const savedDateFormat = readLocalStorage(DATE_FORMAT_STORAGE_KEY)
    if (savedDateFormat) {
      setDateFormat(savedDateFormat)
    }

    // Load seconds display preference
    const savedShowSeconds = readLocalStorage(SHOW_SECONDS_STORAGE_KEY)
    if (savedShowSeconds !== null) {
      setShowSeconds(savedShowSeconds === "true")
    }

    // Load active tab
    const savedActiveTab = readLocalStorage(ACTIVE_TAB_STORAGE_KEY)
    if (savedActiveTab) {
      setActiveTab(savedActiveTab)
    }
  }, [])

  // Save settings to localStorage when they change
  useEffect(() => {
    writeLocalStorage(WORLD_CLOCKS_STORAGE_KEY, JSON.stringify(worldClocks))
    writeLocalStorage(TIME_FORMAT_STORAGE_KEY, timeFormat)
    writeLocalStorage(DATE_FORMAT_STORAGE_KEY, dateFormat)
    writeLocalStorage(SHOW_SECONDS_STORAGE_KEY, String(showSeconds))
    writeLocalStorage(ACTIVE_TAB_STORAGE_KEY, activeTab)
  }, [worldClocks, timeFormat, dateFormat, showSeconds, activeTab])

  // Stopwatch effect
  useEffect(() => {
    if (!isToolActive || !stopwatchRunning || stopwatchStartedAtRef.current === null) return

    const updateStopwatch = () => {
      const startedAt = stopwatchStartedAtRef.current
      if (startedAt === null) return
      setStopwatchTime(stopwatchBaseTimeRef.current + performance.now() - startedAt)
    }

    updateStopwatch()
    stopwatchInterval.current = setInterval(updateStopwatch, 30)
    return () => {
      if (stopwatchInterval.current) {
        clearInterval(stopwatchInterval.current)
        stopwatchInterval.current = null
      }
    }
  }, [stopwatchRunning, isToolActive])

  // Timer effect
  useEffect(() => {
    if (!isToolActive || !timerRunning || timerEndsAtRef.current === null) return

    const updateTimer = () => {
      const endsAt = timerEndsAtRef.current
      if (endsAt === null) return

      const remaining = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000))
      setTimerTime(remaining)
      if (remaining === 0) {
        timerEndsAtRef.current = null
        setTimerRunning(false)
        setTimerCompleted(true)
      }
    }

    updateTimer()
    timerInterval.current = setInterval(updateTimer, 250)
    return () => {
      if (timerInterval.current) {
        clearInterval(timerInterval.current)
        timerInterval.current = null
      }
    }
  }, [timerRunning, isToolActive])

  useEffect(() => {
    return () => {
      // 卸载时要清掉“此刻挂着”的定时器，读的正是 cleanup 时刻的 .current，规则在这里是误报
      // eslint-disable-next-line react-hooks/exhaustive-deps
      Object.values(copyTimeoutRef.current).forEach((timeout) => {
        if (timeout) clearTimeout(timeout)
      })
    }
  }, [])

  // Format time based on settings
  const formatTime = useCallback(
    (date: Date | null, tzId?: string) => {
      if (!date) return "--:--:--"
      try {
        const options: Intl.DateTimeFormatOptions = {
          hour: "numeric",
          minute: "2-digit",
          second: showSeconds ? "2-digit" : undefined,
          hour12: timeFormat === "12hour",
        }

        if (tzId) {
          options.timeZone = tzId
        }

        return new Intl.DateTimeFormat(undefined, options).format(date)
      } catch (error) {
        console.error("Error formatting time:", error)
        // Fallback formatting
        return date.toLocaleTimeString()
      }
    },
    [showSeconds, timeFormat],
  )

  // Format date based on settings
  const formatDate = useCallback(
    (date: Date | null, tzId?: string) => {
      if (!date) return "\u00a0"
      try {
        let options: Intl.DateTimeFormatOptions = {}

        switch (dateFormat) {
          case "full":
            options = { weekday: "long", year: "numeric", month: "long", day: "numeric" }
            break
          case "long":
            options = { year: "numeric", month: "long", day: "numeric" }
            break
          case "medium":
            options = { year: "numeric", month: "short", day: "numeric" }
            break
          case "short":
            options = { year: "2-digit", month: "numeric", day: "numeric" }
            break
          default:
            options = { year: "numeric", month: "long", day: "numeric" }
        }

        if (tzId) {
          options.timeZone = tzId
        }

        return new Intl.DateTimeFormat(undefined, options).format(date)
      } catch (error) {
        console.error("Error formatting date:", error)
        // Fallback formatting
        return date.toLocaleDateString()
      }
    },
    [dateFormat],
  )

  // Format stopwatch time
  const formatStopwatchTime = (time: number) => {
    const milliseconds = Math.floor((time % 1000) / 10)
    const seconds = Math.floor((time / 1000) % 60)
    const minutes = Math.floor((time / (1000 * 60)) % 60)
    const hours = Math.floor(time / (1000 * 60 * 60))

    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}.${milliseconds.toString().padStart(2, "0")}`
  }

  // Format timer time
  const formatTimerTime = (time: number) => {
    const seconds = time % 60
    const minutes = Math.floor(time / 60) % 60
    const hours = Math.floor(time / 3600)

    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
  }

  // Add a world clock
  const addWorldClock = () => {
    if (newTimeZone && !worldClocks.includes(newTimeZone)) {
      setWorldClocks([...worldClocks, newTimeZone])
      setNewTimeZone("")
    }
  }

  // Remove a world clock
  const removeWorldClock = (tzId: string) => {
    setWorldClocks(worldClocks.filter((tz) => tz !== tzId))
  }

  // Get time zone details by ID
  const getTimeZoneDetails = (tzId: string) => {
    return timeZones.find((tz) => tz.id === tzId) || { id: tzId, name: tzId, offset: 0 }
  }

  // 复制到剪贴板
  const copyToClipboard = (text: string, key: string = "main") => {
    if (!text) return

    void writeClipboardText(text).then((success) => {
      if (!success) return
      if (copyTimeoutRef.current[key]) {
        clearTimeout(copyTimeoutRef.current[key]!)
      }
      setCopied(prev => ({ ...prev, [key]: true }))

      copyTimeoutRef.current[key] = setTimeout(() => {
        setCopied(prev => ({ ...prev, [key]: false }))
      }, 2000)
    })
  }

  // Copy current time to clipboard
  const copyCurrentTime = () => {
    if (!currentTime) return
    const formattedTime = `${formatDate(currentTime)} ${formatTime(currentTime)}`
    copyToClipboard(formattedTime, "current")
  }

  // Stopwatch controls
  const startStopwatch = () => {
    stopwatchBaseTimeRef.current = stopwatchTime
    stopwatchStartedAtRef.current = performance.now()
    setStopwatchRunning(true)
  }
  const pauseStopwatch = () => {
    if (stopwatchStartedAtRef.current !== null) {
      const elapsed =
        stopwatchBaseTimeRef.current + performance.now() - stopwatchStartedAtRef.current
      stopwatchBaseTimeRef.current = elapsed
      stopwatchStartedAtRef.current = null
      setStopwatchTime(elapsed)
    }
    setStopwatchRunning(false)
  }
  const resetStopwatch = () => {
    setStopwatchRunning(false)
    setStopwatchTime(0)
    setStopwatchLaps([])
    stopwatchBaseTimeRef.current = 0
    stopwatchStartedAtRef.current = null
  }
  const lapStopwatch = () => {
    if (!stopwatchRunning || stopwatchStartedAtRef.current === null) return
    const elapsed =
      stopwatchBaseTimeRef.current + performance.now() - stopwatchStartedAtRef.current
    setStopwatchTime(elapsed)
    setStopwatchLaps((current) => [...current, elapsed])
  }

  // Timer controls
  const startTimer = () => {
    const remaining = timerTime === 0 ? timerDuration : timerTime
    if (remaining <= 0) return
    timerEndsAtRef.current = Date.now() + remaining * 1000
    setTimerTime(remaining)
    setTimerCompleted(false)
    setTimerRunning(true)
  }
  const pauseTimer = () => {
    if (timerEndsAtRef.current !== null) {
      setTimerTime(Math.max(0, Math.ceil((timerEndsAtRef.current - Date.now()) / 1000)))
      timerEndsAtRef.current = null
    }
    setTimerRunning(false)
  }
  const resetTimer = () => {
    timerEndsAtRef.current = null
    setTimerRunning(false)
    setTimerTime(timerDuration)
    setTimerCompleted(false)
  }
  const setCustomTimerDuration = (seconds: number) => {
    timerEndsAtRef.current = null
    setTimerRunning(false)
    setTimerDuration(seconds)
    setTimerTime(seconds)
    setTimerCompleted(false)
  }

  // 日期转换为时间戳
  const convertDateToTimestamp = () => {
    if (!dateInput) return

    try {
      // 尝试解析多种格式的日期
      let date: Date

      // 检查输入格式并解析
      if (dateInput.includes("T")) {
        // ISO格式 2025-04-06T12:50:26
        date = new Date(dateInput)
      } else if (dateInput.includes("-")) {
        // 格式如 2025-04-06 12:50:26
        const [datePart, timePart] = dateInput.split(" ")
        const [year, month, day] = datePart.split("-")
        const [hour, minute, second] = timePart ? timePart.split(":") : ["0", "0", "0"]

        date = new Date(
          Number.parseInt(year),
          Number.parseInt(month) - 1,
          Number.parseInt(day),
          Number.parseInt(hour || "0"),
          Number.parseInt(minute || "0"),
          Number.parseInt(second || "0"),
        )
      } else if (dateInput.includes("/")) {
        // 格式如 2025/4/6 12:41:00
        const [datePart, timePart] = dateInput.split(" ")
        const [year, month, day] = datePart.split("/")
        const [hour, minute, second] = timePart ? timePart.split(":") : ["0", "0", "0"]

        date = new Date(
          Number.parseInt(year),
          Number.parseInt(month) - 1,
          Number.parseInt(day),
          Number.parseInt(hour || "0"),
          Number.parseInt(minute || "0"),
          Number.parseInt(second || "0"),
        )
      } else {
        // 尝试直接解析
        date = new Date(dateInput)
      }

      // 检查日期是否有效
      if (isNaN(date.getTime())) {
        throw new Error("Invalid date")
      }

      // 获取时间戳（毫秒和秒）
      const timestampMs = date.getTime()
      const timestampSec = Math.floor(timestampMs / 1000)

      setDateResult({
        seconds: timestampSec,
        milliseconds: timestampMs,
      })
    } catch (error) {
      console.error("Error converting date:", error)
      setDateResult(null)
    }
  }

  // UTC时间转换为本地时间和时间��
  const convertUtcToLocal = () => {
    if (!utcInput) return

    try {
      // 尝试解析多种格式的UTC日期
      let utcDate: Date

      // 如果输入已经包含Z或GMT，直接解析
      if (utcInput.includes("Z") || utcInput.includes("GMT")) {
        utcDate = new Date(utcInput)
      } else {
        // 否则添加Z表示这是UTC时间
        utcDate = new Date(utcInput + "Z")
      }

      // 检查日期是否有效
      if (isNaN(utcDate.getTime())) {
        throw new Error("Invalid date")
      }

      // 获取本地时间和时间戳
      const localTime = utcDate.toLocaleString()
      const timestamp = Math.floor(utcDate.getTime() / 1000)

      setUtcResult({
        local: localTime,
        timestamp: timestamp,
      })
    } catch (error) {
      console.error("Error converting UTC time:", error)
      setUtcResult(null)
    }
  }

  // 初始化日期输入为当前时间
  useEffect(() => {
    // 格式化当前日期时间为 YYYY-MM-DD hh:mm:ss 格式
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, "0")
    const day = String(now.getDate()).padStart(2, "0")
    const hours = String(now.getHours()).padStart(2, "0")
    const minutes = String(now.getMinutes()).padStart(2, "0")
    const seconds = String(now.getSeconds()).padStart(2, "0")

    setDateInput(`${year}-${month}-${day} ${hours}:${minutes}:${seconds}`)
  }, [])

  // 初始化UTC输入为当前时间的UTC表示
  useEffect(() => {
    // 使用toISOString获取标准的UTC时间格式
    const now = new Date()
    setUtcInput(now.toISOString().replace(".000Z", "Z"))
  }, [])

  // 时间戳转换为日期
  const convertTimestampToDate = () => {
    if (!timestamp) return

    try {
      // 将输入转换为数字
      const timestampNum = Number(timestamp)
      if (isNaN(timestampNum)) {
        throw new Error("Invalid timestamp")
      }

      // 根据单位转换为毫秒
      const timestampMs = timestampUnit === "seconds" ? timestampNum * 1000 : timestampNum

      // 创建日期对象
      const date = new Date(timestampMs)

      // 检查日期是否有效
      if (isNaN(date.getTime())) {
        throw new Error("Invalid date")
      }

      // 格式化日期
      const localFormatted = date.toLocaleString()
      const utcFormatted = date.toUTCString()

      setTimestampResult({
        local: localFormatted,
        utc: utcFormatted,
      })
    } catch (error) {
      console.error("Error converting timestamp:", error)
      setTimestampResult(null)
    }
  }

  return (
    <div className="container mx-auto px-4 py-4 max-w-6xl">
      {/* 页面标题 */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-[var(--md-sys-color-on-surface)] mb-4 flex items-center justify-center gap-2">
          <Clock className="h-8 w-8 text-[var(--md-sys-color-primary)]" />
          {t("title")}
        </h1>
      </div>

      {/* 时间设置折叠区域 */}
      <div className="mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowTimeInfo(!showTimeInfo)}
          className="w-full text-sm text-[var(--md-sys-color-on-surface-variant)] hover:text-[var(--md-sys-color-on-surface)]"
        >
          <div className="flex items-center gap-2">
            {showTimeInfo ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
            <Settings className="h-4 w-4" />
            <span>{t("timeSettings")}</span>
            {!showTimeInfo && (
              <Badge variant="secondary" className="text-xs ml-auto">
                {t("clickToView")}
              </Badge>
            )}
          </div>
        </Button>

        {showTimeInfo && (
          <Card className="mt-3 card-modern">
            <CardContent className="py-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center space-x-2 bg-[var(--md-sys-color-surface-container)] p-3 rounded-lg">
                  <Label htmlFor="auto-refresh" className="cursor-pointer text-sm">
                    {t("manualRefresh")}
                  </Label>
                  <Switch id="auto-refresh" checked={autoRefresh} onCheckedChange={setAutoRefresh} />
                  <Label htmlFor="auto-refresh" className="cursor-pointer text-sm text-[var(--md-sys-color-primary)]">
                    {t("autoRefresh")}
                  </Label>
                </div>
                <div className="flex items-center space-x-2 bg-[var(--md-sys-color-surface-container)] p-3 rounded-lg">
                  <Label htmlFor="show-seconds" className="cursor-pointer text-sm">
                    {t("hideSeconds")}
                  </Label>
                  <Switch id="show-seconds" checked={showSeconds} onCheckedChange={setShowSeconds} />
                  <Label htmlFor="show-seconds" className="cursor-pointer text-sm text-[var(--md-sys-color-success)]">
                    {t("showSeconds")}
                  </Label>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-8">
        <TabsList className="grid h-auto w-full grid-cols-3 gap-1 p-1 sm:grid-cols-5">
          <TabsTrigger value="current" className="flex min-h-10 items-center justify-center gap-1 px-1 text-xs sm:gap-2 sm:px-3 sm:text-sm">
            <Clock className="hidden h-4 w-4 sm:block" />
            {t("currentTime")}
          </TabsTrigger>
          <TabsTrigger value="world" className="flex min-h-10 items-center justify-center gap-1 px-1 text-xs sm:gap-2 sm:px-3 sm:text-sm">
            <Globe className="hidden h-4 w-4 sm:block" />
            {t("worldClock")}
          </TabsTrigger>
          <TabsTrigger value="stopwatch" className="flex min-h-10 items-center justify-center gap-1 px-1 text-xs sm:gap-2 sm:px-3 sm:text-sm">
            <Timer className="hidden h-4 w-4 sm:block" />
            {t("stopwatch")}
          </TabsTrigger>
          <TabsTrigger value="timer" className="flex min-h-10 items-center justify-center gap-1 px-1 text-xs sm:gap-2 sm:px-3 sm:text-sm">
            <AlarmClock className="hidden h-4 w-4 sm:block" />
            {t("timer")}
          </TabsTrigger>
          <TabsTrigger value="timestamp" className="flex min-h-10 items-center justify-center gap-1 px-1 text-xs sm:gap-2 sm:px-3 sm:text-sm">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="hidden h-4 w-4 sm:block"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            {t("timestamp")}
          </TabsTrigger>
        </TabsList>

        {/* Current Time Tab */}
        <TabsContent value="current" className="mt-6">
          <Card className="card-modern text-center">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center justify-center gap-2">
                <Clock className="h-5 w-5 text-[var(--md-sys-color-primary)]" />
                {t("currentTime")}
                {autoRefresh && (
                  <Badge variant="secondary" className="text-xs">
                    <Zap className="h-3 w-3 mr-1" />
                    {t("live")}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center space-y-8">
                {/* 主时间显示 */}
                <div className="bg-gradient-to-r from-[var(--md-sys-color-primary-container)] to-[var(--md-sys-color-secondary-container)] rounded-2xl p-8 w-full max-w-2xl">
                  <div className="text-4xl md:text-6xl lg:text-7xl font-bold font-mono tracking-tight text-[var(--md-sys-color-on-surface)] mb-4">
                    {formatTime(currentTime)}
                  </div>
                  <div className="text-lg md:text-xl lg:text-2xl text-[var(--md-sys-color-on-surface-variant)]">
                    {formatDate(currentTime)}
                  </div>
                  <div className="mt-4 flex flex-wrap justify-center gap-2">
                    {!autoRefresh && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setCurrentTime(new Date())}
                        className="text-xs text-[var(--md-sys-color-on-surface-variant)] hover:text-[var(--md-sys-color-on-surface)]"
                      >
                        <RefreshCw className="mr-1 h-3 w-3" />
                        {t("refreshTime")}
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={copyCurrentTime}
                      className="text-xs text-[var(--md-sys-color-on-surface-variant)] hover:text-[var(--md-sys-color-on-surface)]"
                    >
                      {copied["current"] ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
                      {t("copyCurrentTime")}
                    </Button>
                  </div>
                </div>

                {/* 格式设置 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-md">
                  <div className="space-y-2">
                    <Label htmlFor="timeFormat" className="text-sm font-medium">{t("timeFormat")}</Label>
                    <Select value={timeFormat} onValueChange={setTimeFormat}>
                      <SelectTrigger id="timeFormat" className="h-10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="12hour">{t("hour12")}</SelectItem>
                        <SelectItem value="24hour">{t("hour24")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="dateFormat" className="text-sm font-medium">{t("dateFormat")}</Label>
                    <Select value={dateFormat} onValueChange={setDateFormat}>
                      <SelectTrigger id="dateFormat" className="h-10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="full">{t("fullFormat")}</SelectItem>
                        <SelectItem value="long">{t("longFormat")}</SelectItem>
                        <SelectItem value="medium">{t("mediumFormat")}</SelectItem>
                        <SelectItem value="short">{t("shortFormat")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* 时间戳信息 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-2xl">
                  <Card className="bg-[var(--md-sys-color-surface-container-low)] border-0">
                    <CardContent className="p-4">
                      <div className="text-sm text-[var(--md-sys-color-on-surface-variant)] mb-1">{t("unixTimestampSeconds")}</div>
                      <div className="text-lg font-mono text-[var(--md-sys-color-on-surface)] flex items-center justify-between">
                        <span>{currentTime ? Math.floor(currentTime.getTime() / 1000) : "-"}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={!currentTime}
                          onClick={() => {
                            if (currentTime) copyToClipboard(Math.floor(currentTime.getTime() / 1000).toString(), "timestamp-sec")
                          }}
                          className="p-1 h-6 w-6"
                        >
                          {copied["timestamp-sec"] ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="bg-[var(--md-sys-color-surface-container-low)] border-0">
                    <CardContent className="p-4">
                      <div className="text-sm text-[var(--md-sys-color-on-surface-variant)] mb-1">{t("timestampMilliseconds")}</div>
                      <div className="text-lg font-mono text-[var(--md-sys-color-on-surface)] flex items-center justify-between">
                        <span>{currentTime ? currentTime.getTime() : "-"}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={!currentTime}
                          onClick={() => {
                            if (currentTime) copyToClipboard(currentTime.getTime().toString(), "timestamp-ms")
                          }}
                          className="p-1 h-6 w-6"
                        >
                          {copied["timestamp-ms"] ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* World Clock Tab */}
        <TabsContent value="world">
          <Card>
            <CardHeader>
              <CardTitle>{t("worldClock")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-6 flex flex-col sm:flex-row gap-2">
                <div className="flex-1">
                  <Select value={newTimeZone} onValueChange={setNewTimeZone}>
                    <SelectTrigger>
                      <SelectValue placeholder={t("selectTimeZone")} />
                    </SelectTrigger>
                    <SelectContent>
                      {timeZones
                        .filter((tz) => !worldClocks.includes(tz.id))
                        .map((tz) => (
                          <SelectItem key={tz.id} value={tz.id}>
                            {tz.name} (GMT{tz.offset >= 0 ? "+" : ""}
                            {tz.offset})
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={addWorldClock} disabled={!newTimeZone}>
                  <Plus className="h-4 w-4 mr-1" />
                  {t("add")}
                </Button>
              </div>

              <div className="space-y-4">
                {worldClocks.length > 0 ? (
                  worldClocks.map((tzId) => {
                    const tzDetails = getTimeZoneDetails(tzId)
                    return (
                      <div
                        key={tzId}
                        className="flex justify-between items-center p-4 bg-[var(--md-sys-color-surface-container-low)] rounded-lg"
                      >
                        <div>
                          <div className="text-lg font-medium">{tzDetails.name}</div>
                          <div className="text-sm text-[var(--md-sys-color-on-surface-variant)]">
                            GMT{tzDetails.offset >= 0 ? "+" : ""}
                            {tzDetails.offset}
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <div className="text-2xl font-bold font-mono">{formatTime(currentTime, tzId)}</div>
                            <div className="text-sm">{formatDate(currentTime, tzId)}</div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeWorldClock(tzId)}
                            className="text-[var(--md-sys-color-on-surface-variant)] hover:text-[var(--md-sys-color-error)]"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )
                  })
                ) : (
                  <div className="text-center p-8 border border-dashed rounded-lg">
                    <p>{t("noTimeZones")}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Stopwatch Tab */}
        <TabsContent value="stopwatch" className="mt-6">
          <Card className="card-modern">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Timer className="h-5 w-5 text-[var(--md-sys-color-success)]" />
                {t("stopwatch")}
                {stopwatchRunning && (
                  <Badge variant="secondary" className="text-xs">
                    <Play className="h-3 w-3 mr-1" />
                    {t("running")}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center space-y-8">
                {/* 秒表显示 */}
                <div className="bg-gradient-to-r from-[var(--md-sys-color-success-container)] to-[var(--md-sys-color-tertiary-container)] rounded-2xl p-8 w-full max-w-2xl text-center">
                  <div className={`text-4xl md:text-6xl lg:text-7xl font-bold font-mono tracking-tight mb-4 ${
                    stopwatchRunning ? 'text-[var(--md-sys-color-success)]' : 'text-[var(--md-sys-color-on-surface)]'
                  }`}>
                    {formatStopwatchTime(stopwatchTime)}
                  </div>
                  <div className="text-sm text-[var(--md-sys-color-on-surface-variant)]">
                    {stopwatchRunning ? t("timing") : stopwatchTime > 0 ? t("paused") : t("clickToStart")}
                  </div>
                </div>

                {/* 控制按钮 */}
                <div className="flex flex-wrap gap-3 justify-center">
                  {!stopwatchRunning ? (
                    <Button onClick={startStopwatch} className="min-w-[120px] h-12" size="lg">
                      <Play className="h-4 w-4 mr-2" />
                      {t("start")}
                    </Button>
                  ) : (
                    <Button onClick={pauseStopwatch} variant="secondary" className="min-w-[120px] h-12" size="lg">
                      <Pause className="h-4 w-4 mr-2" />
                      {t("pause")}
                    </Button>
                  )}

                  <Button
                    onClick={lapStopwatch}
                    variant="outline"
                    disabled={!stopwatchRunning || stopwatchTime === 0}
                    className="min-w-[120px] h-12"
                    size="lg"
                  >
                    <Timer className="h-4 w-4 mr-2" />
                    {t("lap")}
                  </Button>

                  <Button
                    onClick={resetStopwatch}
                    variant="destructive"
                    disabled={stopwatchTime === 0}
                    className="min-w-[120px] h-12"
                    size="lg"
                  >
                    <Square className="h-4 w-4 mr-2" />
                    {t("reset")}
                  </Button>
                </div>

                {stopwatchLaps.length > 0 && (
                  <div className="w-full max-w-md mt-6">
                    <h3 className="text-lg font-medium mb-3">{t("laps")}</h3>
                    <div className="bg-[var(--md-sys-color-surface-container-low)] rounded-lg overflow-hidden">
                      <div className="max-h-60 overflow-y-auto">
                        <table className="w-full">
                          <thead className="bg-[var(--md-sys-color-surface-container)]">
                            <tr>
                              <th className="px-4 py-2 text-left">{t("lap")}</th>
                              <th className="px-4 py-2 text-right">{t("lapTime")}</th>
                              <th className="px-4 py-2 text-right">{t("totalTime")}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {stopwatchLaps
                              .map((lapTime, index) => {
                                const prevLapTime = index > 0 ? stopwatchLaps[index - 1] : 0
                                const splitTime = lapTime - prevLapTime

                                return (
                                  <tr key={index} className="border-b border-[var(--md-sys-color-outline-variant)]">
                                    <td className="px-4 py-2">#{stopwatchLaps.length - index}</td>
                                    <td className="px-4 py-2 text-right font-mono">{formatStopwatchTime(splitTime)}</td>
                                    <td className="px-4 py-2 text-right font-mono">{formatStopwatchTime(lapTime)}</td>
                                  </tr>
                                )
                              })
                              .reverse()}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Timer Tab */}
        <TabsContent value="timer" className="mt-6">
          <Card className="card-modern">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <AlarmClock className="h-5 w-5 text-[var(--md-sys-color-warning)]" />
                {t("countdownTimer")}
                {timerRunning && (
                  <Badge variant="secondary" className="text-xs">
                    <Play className="h-3 w-3 mr-1" />
                    {t("running")}
                  </Badge>
                )}
                {timerCompleted && (
                  <Badge variant="destructive" className="text-xs animate-pulse">
                    {t("timeUp")}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center space-y-8">
                {/* 计时器显示 */}
                <div className="bg-gradient-to-r from-[var(--md-sys-color-warning-container)] to-[var(--md-sys-color-error-container)] rounded-2xl p-8 w-full max-w-2xl text-center">
                  <div className={`text-4xl md:text-6xl lg:text-7xl font-bold font-mono tracking-tight mb-4 ${
                    timerCompleted ? "text-[var(--md-sys-color-error)] animate-pulse" : 
                    timerRunning ? 'text-[var(--md-sys-color-warning)]' : 
                    'text-[var(--md-sys-color-on-surface)]'
                  }`}>
                    {formatTimerTime(timerTime)}
                  </div>
                  <div className="text-sm text-[var(--md-sys-color-on-surface-variant)]">
                    {timerCompleted ? t("timeUp") :
                     timerRunning ? t("countingDown") : 
                     timerTime > 0 ? t("paused") : t("setTimeToStart")}
                  </div>
                </div>

                {/* 控制按钮 */}
                <div className="flex flex-wrap gap-3 justify-center">
                  {!timerRunning ? (
                    <Button
                      onClick={startTimer}
                      className="min-w-[120px] h-12"
                      size="lg"
                      disabled={timerTime === 0 && timerDuration === 0}
                    >
                      <Play className="h-4 w-4 mr-2" />
                      {t("start")}
                    </Button>
                  ) : (
                    <Button onClick={pauseTimer} variant="secondary" className="min-w-[120px] h-12" size="lg">
                      <Pause className="h-4 w-4 mr-2" />
                      {t("pause")}
                    </Button>
                  )}

                  <Button
                    onClick={resetTimer}
                    variant="outline"
                    disabled={timerTime === timerDuration && !timerCompleted}
                    className="min-w-[120px] h-12"
                    size="lg"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    {t("reset")}
                  </Button>
                </div>

                <div className="w-full max-w-md mt-4">
                  <h3 className="text-lg font-medium mb-3">{t("presets")}</h3>
                  <div className="flex flex-wrap gap-2">
                    <Badge
                      className="cursor-pointer"
                      variant={timerDuration === 60 ? "default" : "secondary"}
                      onClick={() => setCustomTimerDuration(60)}
                    >
                      1 {t("minute")}
                    </Badge>
                    <Badge
                      className="cursor-pointer"
                      variant={timerDuration === 300 ? "default" : "secondary"}
                      onClick={() => setCustomTimerDuration(300)}
                    >
                      5 {t("minutes")}
                    </Badge>
                    <Badge
                      className="cursor-pointer"
                      variant={timerDuration === 600 ? "default" : "secondary"}
                      onClick={() => setCustomTimerDuration(600)}
                    >
                      10 {t("minutes")}
                    </Badge>
                    <Badge
                      className="cursor-pointer"
                      variant={timerDuration === 900 ? "default" : "secondary"}
                      onClick={() => setCustomTimerDuration(900)}
                    >
                      15 {t("minutes")}
                    </Badge>
                    <Badge
                      className="cursor-pointer"
                      variant={timerDuration === 1800 ? "default" : "secondary"}
                      onClick={() => setCustomTimerDuration(1800)}
                    >
                      30 {t("minutes")}
                    </Badge>
                    <Badge
                      className="cursor-pointer"
                      variant={timerDuration === 3600 ? "default" : "secondary"}
                      onClick={() => setCustomTimerDuration(3600)}
                    >
                      1 {t("hour")}
                    </Badge>
                  </div>
                </div>

                <div className="w-full max-w-md">
                  <h3 className="text-lg font-medium mb-3">{t("customTime")}</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="flex flex-col">
                      <Label htmlFor="hours">{t("hours")}</Label>
                      <input
                        id="hours"
                        type="number"
                        min="0"
                        max="24"
                        value={Math.floor(timerDuration / 3600)}
                        onChange={(e) => {
                          const hours = Number(e.target.value) || 0
                          const minutes = Math.floor((timerDuration % 3600) / 60)
                          const seconds = timerDuration % 60
                          setCustomTimerDuration(hours * 3600 + minutes * 60 + seconds)
                        }}
                        className="py-2 px-3 border rounded-md"
                      />
                    </div>
                    <div className="flex flex-col">
                      <Label htmlFor="minutes">{t("minutes")}</Label>
                      <input
                        id="minutes"
                        type="number"
                        min="0"
                        max="59"
                        value={Math.floor((timerDuration % 3600) / 60)}
                        onChange={(e) => {
                          const hours = Math.floor(timerDuration / 3600)
                          const minutes = Number(e.target.value) || 0
                          const seconds = timerDuration % 60
                          setCustomTimerDuration(hours * 3600 + minutes * 60 + seconds)
                        }}
                        className="py-2 px-3 border rounded-md"
                      />
                    </div>
                    <div className="flex flex-col">
                      <Label htmlFor="seconds">{t("seconds")}</Label>
                      <input
                        id="seconds"
                        type="number"
                        min="0"
                        max="59"
                        value={timerDuration % 60}
                        onChange={(e) => {
                          const hours = Math.floor(timerDuration / 3600)
                          const minutes = Math.floor((timerDuration % 3600) / 60)
                          const seconds = Number(e.target.value) || 0
                          setCustomTimerDuration(hours * 3600 + minutes * 60 + seconds)
                        }}
                        className="py-2 px-3 border rounded-md"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Timestamp Converter Tab */}
        <TabsContent value="timestamp">
          <Card>
            <CardHeader>
              <CardTitle>{t("timestamp")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col space-y-8">
                {/* Timestamp to Date */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">{t("timestampToDate")}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="timestamp">{t("enterTimestamp")}</Label>
                      <div className="flex space-x-2">
                        <Input
                          id="timestamp"
                          type="number"
                          placeholder="1743914460"
                          value={timestamp}
                          onChange={(e) => setTimestamp(e.target.value)}
                        />
                        <Select value={timestampUnit} onValueChange={setTimestampUnit}>
                          <SelectTrigger className="w-[120px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="seconds">{t("seconds")}</SelectItem>
                            <SelectItem value="milliseconds">{t("milliseconds")}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="flex items-end">
                      <Button onClick={convertTimestampToDate} className="w-full">
                        {t("convert")}
                      </Button>
                    </div>
                  </div>

                  {timestampResult && (
                    <div className="p-4 bg-[var(--md-sys-color-surface-container-low)] rounded-lg">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <div className="text-sm text-[var(--md-sys-color-on-surface-variant)]">{t("localTime")}</div>
                          <div className="text-lg font-mono">{timestampResult.local}</div>
                        </div>
                        <div>
                          <div className="text-sm text-[var(--md-sys-color-on-surface-variant)]">UTC</div>
                          <div className="text-lg font-mono">{timestampResult.utc}</div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Date to Timestamp */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">{t("dateToTimestamp")}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="date-input">{t("enterDate")}</Label>
                      <Input
                        id="date-input"
                        type="text"
                        placeholder={t("datePlaceholder")}
                        value={dateInput}
                        onChange={(e) => setDateInput(e.target.value)}
                      />
                    </div>
                    <div className="flex items-end">
                      <Button onClick={convertDateToTimestamp} className="w-full">
                        {t("convert")}
                      </Button>
                    </div>
                  </div>

                  {dateResult && (
                    <div className="p-4 bg-[var(--md-sys-color-surface-container-low)] rounded-lg">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <div className="text-sm text-[var(--md-sys-color-on-surface-variant)]">{t("secondsTimestamp")}</div>
                          <div className="text-lg font-mono">{dateResult.seconds}</div>
                        </div>
                        <div>
                          <div className="text-sm text-[var(--md-sys-color-on-surface-variant)]">{t("millisecondsTimestamp")}</div>
                          <div className="text-lg font-mono">{dateResult.milliseconds}</div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* UTC Time Converter */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">{t("utcConverter")}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="utc-input">{t("enterUtcTime")}</Label>
                      <Input
                        id="utc-input"
                        type="text"
                        placeholder={t("utcPlaceholder")}
                        value={utcInput}
                        onChange={(e) => setUtcInput(e.target.value)}
                      />
                      <div className="text-xs text-[var(--md-sys-color-on-surface-variant)]">{t("utcTimeNote")}</div>
                    </div>
                    <div className="flex items-end">
                      <Button onClick={convertUtcToLocal} className="w-full">
                        {t("convert")}
                      </Button>
                    </div>
                  </div>

                  {utcResult && (
                    <div className="p-4 bg-[var(--md-sys-color-surface-container-low)] rounded-lg">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <div className="text-sm text-[var(--md-sys-color-on-surface-variant)]">{t("localTime")}</div>
                          <div className="text-lg font-mono">{utcResult.local}</div>
                        </div>
                        <div>
                          <div className="text-sm text-[var(--md-sys-color-on-surface-variant)]">{t("secondsTimestamp")}</div>
                          <div className="text-lg font-mono">{utcResult.timestamp}</div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
