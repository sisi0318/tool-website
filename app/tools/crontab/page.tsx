"use client"

import { copyTextToClipboard } from "@/lib/clipboard"

import { useState, useMemo, useEffect, useCallback, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useToast } from "@/hooks/use-toast"
import { useTranslations } from "@/hooks/use-translations"
import { useI18n } from "@/components/i18n-provider"
import { Copy, Trash2, Clock, Calendar, Play, AlertCircle, Info, Zap, Settings, ChevronDown, ChevronUp, Download, History, Check } from "lucide-react"
import {
  expandCronField,
  generateCronDescription,
  getNextExecutionTimes,
} from "@/lib/crontab-tools"
import { downloadBlob } from "@/lib/object-url"

// ============ 时间线可视化组件 ============

interface TimelineProps {
  times: Date[]
  use24HourFormat: boolean
  translate: (key: string) => string
  locale: string
}

function formatTranslation(
  translate: (key: string) => string,
  key: string,
  values: Record<string, string | number> = {},
) {
  return Object.entries(values).reduce(
    (message, [name, value]) => message.replaceAll(`{{${name}}}`, String(value)),
    translate(key),
  )
}

function CronTimeline({ times, use24HourFormat, translate, locale }: TimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  if (times.length < 2) return null

  const start = times[0].getTime()
  const end = times[times.length - 1].getTime()
  const totalSpan = end - start

  if (totalSpan <= 0) return null

  // 计算间隔统计
  const intervals = times.slice(1).map((t, i) => t.getTime() - times[i].getTime())
  const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length
  const minInterval = Math.min(...intervals)
  const maxInterval = Math.max(...intervals)

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString(locale, {
      hour: "2-digit",
      minute: "2-digit",
      hour12: !use24HourFormat,
    })
  }

  const formatDate = (date: Date) => {
    return date.toLocaleDateString(locale, {
      month: "short",
      day: "numeric",
    })
  }

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000)
    if (seconds < 60) return formatTranslation(translate, "durationSeconds", { value: seconds })
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return formatTranslation(translate, "durationMinutes", { value: minutes })
    const hours = Math.floor(minutes / 60)
    const remainMinutes = minutes % 60
    if (hours < 24) {
      return remainMinutes > 0
        ? formatTranslation(translate, "durationHoursMinutes", { hours, minutes: remainMinutes })
        : formatTranslation(translate, "durationHours", { value: hours })
    }
    const days = Math.floor(hours / 24)
    const remainHours = hours % 24
    return remainHours > 0
      ? formatTranslation(translate, "durationDaysHours", { days, hours: remainHours })
      : formatTranslation(translate, "durationDays", { value: days })
  }

  // 按日期分组
  const dayGroups: Map<string, Date[]> = new Map()
  times.forEach((t) => {
    const key = t.toLocaleDateString()
    if (!dayGroups.has(key)) dayGroups.set(key, [])
    dayGroups.get(key)!.push(t)
  })

  // 24小时热力图数据
  const hourCounts = new Array(24).fill(0)
  times.forEach((t) => {
    hourCounts[t.getHours()]++
  })
  const maxHourCount = Math.max(...hourCounts, 1)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl bg-[var(--md-sys-color-surface-container-low)] p-2 text-center">
          <div className="text-xs text-[var(--md-sys-color-on-surface-variant)]">{translate("minimumInterval")}</div>
          <div className="text-sm font-medium text-[var(--md-sys-color-primary)]">{formatDuration(minInterval)}</div>
        </div>
        <div className="rounded-xl bg-[var(--md-sys-color-surface-container-low)] p-2 text-center">
          <div className="text-xs text-[var(--md-sys-color-on-surface-variant)]">{translate("averageInterval")}</div>
          <div className="text-sm font-medium text-[var(--md-sys-color-primary)]">{formatDuration(avgInterval)}</div>
        </div>
        <div className="rounded-xl bg-[var(--md-sys-color-surface-container-low)] p-2 text-center">
          <div className="text-xs text-[var(--md-sys-color-on-surface-variant)]">{translate("maximumInterval")}</div>
          <div className="text-sm font-medium text-[var(--md-sys-color-primary)]">{formatDuration(maxInterval)}</div>
        </div>
      </div>

      <div>
        <div className="mb-2 text-sm font-medium">{translate("hourDistribution")}</div>
        <div className="flex gap-[2px]" ref={containerRef}>
          {hourCounts.map((count, hour) => {
            const intensity = count / maxHourCount
            return (
              <div key={hour} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className="w-full rounded-sm transition-all"
                  style={{
                    height: "24px",
                    backgroundColor: count > 0
                      ? "var(--md-sys-color-primary)"
                      : "var(--md-sys-color-surface-container-high)",
                    opacity: count > 0 ? 0.15 + intensity * 0.85 : 1,
                  }}
                  title={formatTranslation(translate, "hourRunCount", { hour, count })}
                />
                {hour % 6 === 0 && (
                  <span className="text-[10px] text-[var(--md-sys-color-on-surface-variant)]">{hour}</span>
                )}
              </div>
            )
          })}
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-[10px] text-[var(--md-sys-color-on-surface-variant)]">0:00</span>
          <span className="text-[10px] text-[var(--md-sys-color-on-surface-variant)]">23:00</span>
        </div>
      </div>

      <div>
        <div className="mb-2 text-sm font-medium">{translate("executionTimeline")}</div>
        <div className="relative overflow-x-auto scrollbar-m3 pb-2">
          <div className="min-w-[400px]">
            {/* SVG 时间线 */}
            <svg width="100%" height={Math.max(60, dayGroups.size * 40 + 30)} className="overflow-visible">
              {Array.from(dayGroups.entries()).map(([dateStr, dateTimes], groupIdx) => {
                const y = groupIdx * 40 + 20
                return (
                  <g key={dateStr}>
                    {/* 日期标签 */}
                    <text
                      x="0"
                      y={y + 4}
                      className="fill-[var(--md-sys-color-on-surface-variant)] text-[11px]"
                      fontWeight="500"
                    >
                      {formatDate(dateTimes[0])}
                    </text>
                    {/* 时间轴线 */}
                    <line
                      x1="60"
                      y1={y}
                      x2="100%"
                      y2={y}
                      stroke="currentColor"
                      strokeOpacity="0.15"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                    {/* 执行点 */}
                    {dateTimes.map((t, i) => {
                      const dayStart = new Date(t)
                      dayStart.setHours(0, 0, 0, 0)
                      const dayEnd = new Date(t)
                      dayEnd.setHours(23, 59, 59, 999)
                      const progress = (t.getTime() - dayStart.getTime()) / (dayEnd.getTime() - dayStart.getTime())
                      // Map to 60px - 95% of container
                      const xPercent = 15 + progress * 80

                      return (
                        <g key={i}>
                          <circle
                            cx={`${xPercent}%`}
                            cy={y}
                            r="5"
                            className="fill-[var(--md-sys-color-primary)]"
                            opacity={0.9}
                          >
                            <title>{formatTime(t)}</title>
                          </circle>
                          <circle
                            cx={`${xPercent}%`}
                            cy={y}
                            r="8"
                            className="fill-[var(--md-sys-color-primary)]"
                            opacity={0.15}
                          />
                          {/* 时间标签 - 只在点不太密集时显示 */}
                          {(dateTimes.length <= 12 || i % Math.ceil(dateTimes.length / 12) === 0) && (
                            <text
                              x={`${xPercent}%`}
                              y={y + 16}
                              textAnchor="middle"
                              className="fill-[var(--md-sys-color-on-surface-variant)] text-[9px]"
                            >
                              {formatTime(t)}
                            </text>
                          )}
                        </g>
                      )
                    })}
                  </g>
                )
              })}
            </svg>
          </div>
        </div>
      </div>

      {dayGroups.size > 1 && (
        <div>
          <div className="mb-2 text-sm font-medium">{translate("dailyRunCount")}</div>
          <div className="space-y-1">
            {Array.from(dayGroups.entries()).map(([dateStr, dateTimes]) => (
              <div key={dateStr} className="flex items-center gap-2">
                <span className="w-16 flex-shrink-0 text-xs text-[var(--md-sys-color-on-surface-variant)]">{formatDate(dateTimes[0])}</span>
                <div className="h-5 flex-1 overflow-hidden rounded-full bg-[var(--md-sys-color-surface-container-high)]">
                  <div
                    className="flex h-full items-center justify-end rounded-full bg-[var(--md-sys-color-primary)] pr-2 transition-all"
                    style={{
                      width: `${Math.max(20, (dateTimes.length / Math.max(...Array.from(dayGroups.values()).map(d => d.length))) * 100)}%`,
                    }}
                  >
                    <span className="text-[10px] font-medium text-[var(--md-sys-color-on-primary)]">{dateTimes.length}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function CrontabPage() {
  const t = useTranslations("crontab")
  const { locale } = useI18n()
  const { toast } = useToast()

  const [expression, setExpression] = useState("* * * * *")
  const [isValid, setIsValid] = useState(true)
  const [description, setDescription] = useState("")
  const [use24HourFormat, setUse24HourFormat] = useState(true)
  const [includeSeconds, setIncludeSeconds] = useState(false)
  const [nextRuns, setNextRuns] = useState<string[]>([])
  const [timelineTimes, setTimelineTimes] = useState<Date[]>([])
  const [activeTab, setActiveTab] = useState("visual")
  const [isProcessing, setIsProcessing] = useState(false)

  // 新增状态
  const [errors, setErrors] = useState<string[]>([])
  const [warnings, setWarnings] = useState<string[]>([])
  const [history, setHistory] = useState<Array<{expression: string, timestamp: number, description: string}>>([])
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [selectedTimezone, setSelectedTimezone] = useState("local")
  const [showHistory, setShowHistory] = useState(false)
  const debounceTimerRef = useRef<number | null>(null)
  const parseTimerRef = useRef<number | null>(null)

  // Builder state
  const [seconds, setSeconds] = useState("0")
  const [minute, setMinute] = useState("*")
  const [hour, setHour] = useState("*")
  const [dayOfMonth, setDayOfMonth] = useState("*")
  const [month, setMonth] = useState("*")
  const [dayOfWeek, setDayOfWeek] = useState("*")
  const [year, setYear] = useState("")

  // Visual builder state
  const [selectedMinutes, setSelectedMinutes] = useState<number[]>([])
  const [selectedHours, setSelectedHours] = useState<number[]>([])
  const [selectedDays, setSelectedDays] = useState<number[]>([])
  const [selectedMonths, setSelectedMonths] = useState<number[]>([])
  const [selectedWeekdays, setSelectedWeekdays] = useState<number[]>([])

  // 扩展的预设模板
  const presets = useMemo(
    () => [
      { 
        category: t("presetCommon"),
        items: [
          { name: t("presetEveryMinute"), value: "* * * * *", description: t("presetEveryMinuteDescription") },
          { name: t("presetEvery5Minutes"), value: "*/5 * * * *", description: t("presetEvery5MinutesDescription") },
          { name: t("presetEvery15Minutes"), value: "*/15 * * * *", description: t("presetEvery15MinutesDescription") },
          { name: t("presetEvery30Minutes"), value: "*/30 * * * *", description: t("presetEvery30MinutesDescription") },
          { name: t("presetEveryHour"), value: "0 * * * *", description: t("presetEveryHourDescription") },
          { name: t("presetEveryDay"), value: "0 0 * * *", description: t("presetEveryDayDescription") },
        ]
      },
      {
        category: t("presetWorkHours"),
        items: [
          { name: t("presetWeekday9"), value: "0 9 * * 1-5", description: t("presetWeekday9Description") },
          { name: t("presetWeekday18"), value: "0 18 * * 1-5", description: t("presetWeekday18Description") },
          { name: t("presetWorkHourly"), value: "0 9-17 * * 1-5", description: t("presetWorkHourlyDescription") },
          { name: t("presetLunch"), value: "0 12 * * 1-5", description: t("presetLunchDescription") },
        ]
      },
      {
        category: t("presetBackupMaintenance"),
        items: [
          { name: t("presetDailyBackup"), value: "0 2 * * *", description: t("presetDailyBackupDescription") },
          { name: t("presetWeeklyBackup"), value: "0 3 * * 0", description: t("presetWeeklyBackupDescription") },
          { name: t("presetMonthlyBackup"), value: "0 4 1 * *", description: t("presetMonthlyBackupDescription") },
          { name: t("presetLogCleanup"), value: "0 1 * * *", description: t("presetLogCleanupDescription") },
          { name: t("presetMaintenance"), value: "0 5 * * 6", description: t("presetMaintenanceDescription") },
        ]
      },
      {
        category: t("presetMonitoringReports"),
        items: [
          { name: t("presetHealthCheck"), value: "*/10 * * * *", description: t("presetHealthCheckDescription") },
          { name: t("presetPerformance"), value: "*/30 * * * *", description: t("presetPerformanceDescription") },
          { name: t("presetDailyReport"), value: "0 8 * * 1-5", description: t("presetDailyReportDescription") },
          { name: t("presetWeeklyReport"), value: "0 9 * * 1", description: t("presetWeeklyReportDescription") },
          { name: t("presetMonthlyReport"), value: "0 10 1 * *", description: t("presetMonthlyReportDescription") },
        ]
      },
      {
        category: t("presetSpecial"),
        items: [
          { name: t("presetHoliday"), value: "0 0 * * *", description: t("presetHolidayDescription") },
          { name: t("presetWeekend"), value: "0 10 * * 6,0", description: t("presetWeekendDescription") },
          { name: t("presetMonthEnd"), value: "0 23 28-31 * *", description: t("presetMonthEndDescription") },
          { name: t("presetQuarterly"), value: "0 0 1 1,4,7,10 *", description: t("presetQuarterlyDescription") },
        ]
      }
    ],
    [t],
  )

  // 时区选项
  const timezones = useMemo(() => [
    { value: "local", label: t("timezoneLocal") },
    { value: "UTC", label: "UTC" },
    { value: "Asia/Shanghai", label: t("timezoneShanghai") },
    { value: "America/New_York", label: t("timezoneNewYork") },
    { value: "Europe/London", label: t("timezoneLondon") },
    { value: "Asia/Tokyo", label: t("timezoneTokyo") },
  ], [t])

  // 添加到历史记录
  const addToHistory = useCallback((expr: string, desc: string) => {
    setHistory(prev => {
      const newEntry = { expression: expr, timestamp: Date.now(), description: desc }
      const filtered = prev.filter(item => item.expression !== expr)
      return [newEntry, ...filtered].slice(0, 10) // 保留最近10条
    })
  }, [])

  // 可视化构建器 - 将选择转换为cron表达式
  const buildExpressionFromVisual = useCallback(() => {
    const minutePart = selectedMinutes.length === 0 ? "*" : 
                      selectedMinutes.length === 60 ? "*" :
                      selectedMinutes.join(",")
    
    const hourPart = selectedHours.length === 0 ? "*" :
                     selectedHours.length === 24 ? "*" :
                     selectedHours.join(",")
    
    const dayPart = selectedDays.length === 0 ? "*" :
                    selectedDays.length === 31 ? "*" :
                    selectedDays.join(",")
    
    const monthPart = selectedMonths.length === 0 ? "*" :
                      selectedMonths.length === 12 ? "*" :
                      selectedMonths.join(",")
    
    const weekdayPart = selectedWeekdays.length === 0 ? "*" :
                        selectedWeekdays.length === 7 ? "*" :
                        selectedWeekdays.join(",")

    const expr = includeSeconds 
      ? `0 ${minutePart} ${hourPart} ${dayPart} ${monthPart} ${weekdayPart}`
      : `${minutePart} ${hourPart} ${dayPart} ${monthPart} ${weekdayPart}`
    
    setExpression(expr)
    parseCron(expr)
  }, [selectedMinutes, selectedHours, selectedDays, selectedMonths, selectedWeekdays, includeSeconds])

  // 增强的验证函数
  const validateExpression = useCallback((expr: string) => {
    const errors: string[] = []
    const warnings: string[] = []
    
    const parts = expr.trim().split(/\s+/)
    const expectedParts = includeSeconds ? 6 : 5
    
    if (parts.length !== expectedParts && parts.length !== expectedParts + 1) {
      errors.push(formatTranslation(t, "invalidPartCount", {
        expected: `${expectedParts}-${expectedParts + 1}`,
        actual: parts.length,
      }))
      return { errors, warnings, isValid: false }
    }
    
    // 验证各字段范围
    const ranges = includeSeconds 
      ? [
          { name: t("seconds"), min: 0, max: 59, value: parts[0] },
          { name: t("minute"), min: 0, max: 59, value: parts[1] },
          { name: t("hour"), min: 0, max: 23, value: parts[2] },
          { name: t("dayOfMonth"), min: 1, max: 31, value: parts[3] },
          { name: t("month"), min: 1, max: 12, value: parts[4] },
          { name: t("dayOfWeek"), min: 0, max: 7, value: parts[5] },
        ]
      : [
          { name: t("minute"), min: 0, max: 59, value: parts[0] },
          { name: t("hour"), min: 0, max: 23, value: parts[1] },
          { name: t("dayOfMonth"), min: 1, max: 31, value: parts[2] },
          { name: t("month"), min: 1, max: 12, value: parts[3] },
          { name: t("dayOfWeek"), min: 0, max: 7, value: parts[4] },
        ]

    if (parts.length === expectedParts + 1) {
      ranges.push({
        name: t("year"),
        min: 1970,
        max: 2199,
        value: parts[expectedParts],
      })
    }
    
    ranges.forEach(range => {
      const expanded = expandCronField(range.value, range.min, range.max)
      if (range.value !== "*" && range.value !== "?" && expanded.length === 0) {
        errors.push(formatTranslation(t, "invalidFieldRange", {
          field: range.name,
          value: range.value,
          min: range.min,
          max: range.max,
        }))
      }
    })
    
    // 检查潜在问题
    if (parts[includeSeconds ? 3 : 2] !== "*" && parts[includeSeconds ? 5 : 4] !== "*") {
      warnings.push(t("dayAndWeekWarning"))
    }
    
    return { errors, warnings, isValid: errors.length === 0 }
  }, [includeSeconds, t])

  // Parse cron expression and generate description
  const parseCron = (expr: string) => {
    try {
      if (parseTimerRef.current !== null) {
        window.clearTimeout(parseTimerRef.current)
        parseTimerRef.current = null
      }
      setIsProcessing(true)

      // 使用增强的验证函数
      const validation = validateExpression(expr)
      setErrors(validation.errors)
      setWarnings(validation.warnings)
      setIsValid(validation.isValid)

      if (!validation.isValid) {
        setDescription(t("invalidExpression"))
        setNextRuns([])
        setTimelineTimes([])
        setIsProcessing(false)
        return
      }

      parseTimerRef.current = window.setTimeout(() => {
        try {
          // 生成人类可读的描述
          const desc = generateCronDescription(expr, includeSeconds, t)
          setDescription(desc)

          // 生成下一个执行时间
          const nextRunTimes = getNextExecutionTimes(expr, includeSeconds, 8)
          const formattedTimes = nextRunTimes.map((date) => {
            const options: Intl.DateTimeFormatOptions = {
              year: "numeric",
              month: "short",
              day: "numeric",
              hour: use24HourFormat ? "2-digit" : "numeric",
              minute: "2-digit",
              second: includeSeconds ? "2-digit" : undefined,
              hour12: !use24HourFormat,
              timeZone: selectedTimezone === "local" ? undefined : selectedTimezone,
            }
            return date.toLocaleString(locale, options)
          })

          setNextRuns(formattedTimes)

          // 生成更多执行时间用于时间线可视化
          const timelineData = getNextExecutionTimes(expr, includeSeconds, 50)
          setTimelineTimes(timelineData)
          
          // 添加到历史记录
          if (validation.isValid) {
            addToHistory(expr, desc)
          }
        } catch (error) {
          console.error("Error parsing cron:", error)
          setIsValid(false)
          setDescription(t("parseError"))
          setNextRuns([])
          setErrors([t("parseFailed")])
        } finally {
          setIsProcessing(false)
          parseTimerRef.current = null
        }
      }, 0)
    } catch (error) {
      console.error("Error in parseCron:", error)
      setIsValid(false)
      setDescription(t("parseError"))
      setNextRuns([])
      setErrors([t("parseFailed")])
      setIsProcessing(false)
    }
  }

  // Update expression from builder
  const updateExpressionFromBuilder = () => {
    let expr = ""

    if (includeSeconds) {
      expr = `${seconds} ${minute} ${hour} ${dayOfMonth} ${month} ${dayOfWeek}`
      if (year) expr += ` ${year}`
    } else {
      expr = `${minute} ${hour} ${dayOfMonth} ${month} ${dayOfWeek}`
      if (year) expr += ` ${year}`
    }

    setExpression(expr)
    parseCron(expr)
  }

  // Update builder from expression
  const updateBuilderFromExpression = (expr: string) => {
    const parts = expr.trim().split(/\s+/)

    if (includeSeconds && parts.length >= 6) {
      setSeconds(parts[0])
      setMinute(parts[1])
      setHour(parts[2])
      setDayOfMonth(parts[3])
      setMonth(parts[4])
      setDayOfWeek(parts[5])
      setYear(parts[6] || "")
    } else if (!includeSeconds && parts.length >= 5) {
      setSeconds("0")
      setMinute(parts[0])
      setHour(parts[1])
      setDayOfMonth(parts[2])
      setMonth(parts[3])
      setDayOfWeek(parts[4])
      setYear(parts[5] || "")
    }
  }

  // Handle expression change
  const handleExpressionChange = (value: string) => {
    setExpression(value)
    // 使用防抖处理输入，避免频繁计算
    if (debounceTimerRef.current) {
      window.clearTimeout(debounceTimerRef.current)
    }
    debounceTimerRef.current = window.setTimeout(() => {
      parseCron(value)
      updateBuilderFromExpression(value)
      debounceTimerRef.current = null
    }, 300)
  }

  // Handle preset selection
  const handlePresetSelect = (value: string) => {
    setExpression(value)
    parseCron(value)
    updateBuilderFromExpression(value)
  }

  // 导出配置
  const exportConfig = () => {
    const config = {
      expression,
      description,
      nextRuns: nextRuns.slice(0, 5),
      settings: {
        includeSeconds,
        use24HourFormat,
        timezone: selectedTimezone,
      },
      generatedAt: new Date().toISOString(),
    }
    
    downloadBlob(
      new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' }),
      `crontab-${expression.replace(/[^\w]/g, '_')}.json`,
    )
    
    toast({
      title: t("exported"),
      description: t("exportedDescription"),
      duration: 2000,
    })
  }

  // 生成 crontab 命令
  const generateCrontabCommand = (command: string = "your-command-here") => {
    return `${expression} ${command}`
  }

  // 可视化选择器组件
  const TimeSelector = ({ 
    label, 
    min, 
    max, 
    selected, 
    onChange, 
    format 
  }: {
    label: string
    min: number
    max: number
    selected: number[]
    onChange: (values: number[]) => void
    format?: (value: number) => string
  }) => {
    const toggleValue = (value: number) => {
      if (selected.includes(value)) {
        onChange(selected.filter(v => v !== value))
      } else {
        onChange([...selected, value].sort((a, b) => a - b))
      }
    }

    const selectAll = () => {
      onChange(Array.from({ length: max - min + 1 }, (_, i) => min + i))
    }

    const selectNone = () => {
      onChange([])
    }

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="font-medium">{label}</Label>
          <div className="space-x-2">
            <Button variant="outline" size="sm" onClick={selectAll}>
              {t("selectAll")}
            </Button>
            <Button variant="outline" size="sm" onClick={selectNone}>
              {t("clearInput")}
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 gap-1">
          {Array.from({ length: max - min + 1 }, (_, i) => {
            const value = min + i
            const isSelected = selected.includes(value)
            return (
              <Button
                key={value}
                variant={isSelected ? "default" : "outline"}
                size="sm"
                className="h-8 min-w-0 px-1 text-xs"
                onClick={() => toggleValue(value)}
                aria-pressed={isSelected}
              >
                <span className="truncate">{format ? format(value) : value}</span>
              </Button>
            )
          })}
        </div>
        {selected.length > 0 && (
          <div className="text-sm text-[var(--md-sys-color-on-surface-variant)]">
            {t("selected")}: {selected.join(", ")}
          </div>
        )}
      </div>
    )
  }

  // Toggle seconds inclusion
  const handleIncludeSecondsChange = (checked: boolean) => {
    setIncludeSeconds(checked)

    // Update expression format
    if (checked) {
      // Add seconds to expression
      setExpression(`0 ${expression}`)
    } else {
      // Remove seconds from expression
      const parts = expression.split(" ")
      if (parts.length > 5) {
        setExpression(parts.slice(1).join(" "))
      }
    }
  }

  // Copy expression to clipboard
  const handleCopy = () => {
    void copyTextToClipboard(expression).then((success) => {
      toast({
        title: success ? t("copied") : t("copyFailed"),
        duration: 2000,
        variant: success ? "default" : "destructive",
      })
    })
  }

  // Clear expression
  const handleClear = () => {
    const defaultExpression = includeSeconds ? "0 * * * * *" : "* * * * *"
    setExpression(defaultExpression)
    parseCron(defaultExpression)
    updateBuilderFromExpression(defaultExpression)
  }

  useEffect(() => {
    parseCron(expression)
  }, [includeSeconds, use24HourFormat, selectedTimezone, t])

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        window.clearTimeout(debounceTimerRef.current)
      }
      if (parseTimerRef.current !== null) {
        window.clearTimeout(parseTimerRef.current)
      }
    }
  }, [])

  // 自动构建表达式
  useEffect(() => {
    if (activeTab === "visual") {
      buildExpressionFromVisual()
    }
  }, [selectedMinutes, selectedHours, selectedDays, selectedMonths, selectedWeekdays, buildExpressionFromVisual, activeTab])

  return (
    <div className="container mx-auto max-w-7xl px-3 py-4 sm:px-4 sm:py-6">
      <div className="mb-6 space-y-2 text-center sm:mb-8">
        <h1 className="text-2xl font-bold text-[var(--md-sys-color-on-surface)] sm:text-3xl">
          {t("title")}
        </h1>
        <p className="mx-auto max-w-2xl text-sm text-[var(--md-sys-color-on-surface-variant)] sm:text-base">
          {t("description")}
        </p>
      </div>

      <Card className="mb-6">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Settings className="h-5 w-5" />
              {t("globalSettings")}
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAdvanced(!showAdvanced)}
              aria-expanded={showAdvanced}
            >
              {showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              {showAdvanced ? t("collapse") : t("expand")}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="includeSeconds"
                      checked={includeSeconds}
                      onCheckedChange={handleIncludeSecondsChange}
                    />
                    <Label htmlFor="includeSeconds" className="cursor-pointer text-sm">
                      {t("includeSeconds")}
                    </Label>
                  </div>
                </TooltipTrigger>
                <TooltipContent>{t("includeSecondsHelp")}</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <div className="flex items-center space-x-2">
              <Switch
                id="use24HourFormat"
                checked={use24HourFormat}
                onCheckedChange={setUse24HourFormat}
              />
              <Label htmlFor="use24HourFormat" className="cursor-pointer text-sm">
                {t("use24HourFormat")}
              </Label>
            </div>

            {showAdvanced && (
              <>
                <div className="flex min-w-0 items-center space-x-2">
                  <Label htmlFor="timezone" className="shrink-0 text-sm">{t("displayTimezone")}:</Label>
                  <Select value={selectedTimezone} onValueChange={setSelectedTimezone}>
                    <SelectTrigger className="min-w-0 flex-1 lg:w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {timezones.map(tz => (
                        <SelectItem key={tz.value} value={tz.value}>
                          {tz.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowHistory(!showHistory)}
                    className="flex items-center gap-2"
                  >
                    <History className="h-4 w-4" />
                    {t("history")}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={exportConfig}
                    className="flex items-center gap-2"
                  >
                    <Download className="h-4 w-4" />
                    {t("export")}
                  </Button>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid h-auto w-full grid-cols-4 bg-[var(--md-sys-color-surface-container)] p-1">
              <TabsTrigger value="visual" className="flex min-w-0 items-center gap-1 px-1 py-2.5 text-xs data-[state=active]:bg-[var(--md-sys-color-surface-container-lowest)] sm:gap-2 sm:px-3 sm:text-sm">
                <Calendar className="hidden h-4 w-4 sm:block" />
                <span className="truncate">{t("visual")}</span>
              </TabsTrigger>
              <TabsTrigger value="expression" className="flex min-w-0 items-center gap-1 px-1 py-2.5 text-xs data-[state=active]:bg-[var(--md-sys-color-surface-container-lowest)] sm:gap-2 sm:px-3 sm:text-sm">
                <Clock className="hidden h-4 w-4 sm:block" />
                <span className="truncate">{t("expressionTab")}</span>
              </TabsTrigger>
              <TabsTrigger value="builder" className="flex min-w-0 items-center gap-1 px-1 py-2.5 text-xs data-[state=active]:bg-[var(--md-sys-color-surface-container-lowest)] sm:gap-2 sm:px-3 sm:text-sm">
                <Settings className="hidden h-4 w-4 sm:block" />
                <span className="truncate">{t("builderTab")}</span>
              </TabsTrigger>
              <TabsTrigger value="presets" className="flex min-w-0 items-center gap-1 px-1 py-2.5 text-xs data-[state=active]:bg-[var(--md-sys-color-surface-container-lowest)] sm:gap-2 sm:px-3 sm:text-sm">
                <Zap className="hidden h-4 w-4 sm:block" />
                <span className="truncate">{t("templatesTab")}</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="visual" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    {t("visualTimeSelector")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <TimeSelector
                    label={t("minute_range")}
                    min={0}
                    max={59}
                    selected={selectedMinutes}
                    onChange={setSelectedMinutes}
                  />
                  
                  <TimeSelector
                    label={t("hour_range")}
                    min={0}
                    max={23}
                    selected={selectedHours}
                    onChange={setSelectedHours}
                  />
                  
                  <TimeSelector
                    label={t("day_range")}
                    min={1}
                    max={31}
                    selected={selectedDays}
                    onChange={setSelectedDays}
                  />
                  
                  <TimeSelector
                    label={t("monthNumericRange")}
                    min={1}
                    max={12}
                    selected={selectedMonths}
                    onChange={setSelectedMonths}
                    format={(value) => {
                      return new Intl.DateTimeFormat(locale, { month: "short" })
                        .format(new Date(2024, value - 1, 1))
                    }}
                  />
                  
                  <TimeSelector
                    label={t("weekdayNumericRange")}
                    min={0}
                    max={6}
                    selected={selectedWeekdays}
                    onChange={setSelectedWeekdays}
                    format={(value) => {
                      return new Intl.DateTimeFormat(locale, { weekday: "short" })
                        .format(new Date(2024, 0, 7 + value))
                    }}
                  />

                  <div className="border-t border-[var(--md-sys-color-outline-variant)] pt-4">
                    <Label className="text-lg font-medium">{t("generatedExpression")}</Label>
                    <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                      <Input
                        value={expression}
                        readOnly
                        className="min-w-0 font-mono text-base sm:text-lg"
                        aria-label={t("generatedExpression")}
                      />
                      <Button variant="outline" size="icon" onClick={handleCopy} aria-label={t("copy")}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="expression">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    {t("expressionEditor")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="cron-expression">{t("expression")}</Label>
                    <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-2">
                      <Input
                        id="cron-expression"
                        value={expression}
                        onChange={(e) => handleExpressionChange(e.target.value)}
                        placeholder={t("expressionPlaceholder")}
                        aria-invalid={!isValid}
                        className={`min-w-0 font-mono text-base sm:text-lg ${!isValid ? "border-[var(--md-sys-color-error)]" : ""}`}
                      />
                      <Button variant="outline" size="icon" onClick={handleClear} aria-label={t("clearInput")}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="icon" onClick={handleCopy} aria-label={t("copy")}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  
                  <div className="rounded-xl bg-[var(--md-sys-color-surface-container-low)] p-4">
                    <Label className="font-medium">{t("formatGuide")}</Label>
                    <pre className="mt-2 overflow-x-auto text-xs text-[var(--md-sys-color-on-surface-variant)]">
                      {includeSeconds
                        ? t("formatWithSeconds")
                        : t("formatWithoutSeconds")
                      }
                    </pre>
                    <div className="mt-2 space-y-1 text-xs text-[var(--md-sys-color-on-surface-variant)]">
                      <div>• {t("syntaxAny")}</div>
                      <div>• {t("syntaxList")}</div>
                      <div>• {t("syntaxRange")}</div>
                      <div>• {t("syntaxStep")}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="builder">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    {t("manualBuilder")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {includeSeconds && (
                      <div>
                        <Label htmlFor="seconds">{t("seconds_range")}</Label>
                        <Input
                          id="seconds"
                          value={seconds}
                          onChange={(e) => setSeconds(e.target.value)}
                          placeholder="0-59"
                          className="font-mono"
                        />
                      </div>
                    )}
                    <div>
                      <Label htmlFor="minute">{t("minute_range")}</Label>
                      <Input
                        id="minute"
                        value={minute}
                        onChange={(e) => setMinute(e.target.value)}
                        placeholder="0-59"
                        className="font-mono"
                      />
                    </div>
                    <div>
                      <Label htmlFor="hour">{t("hour_range")}</Label>
                      <Input
                        id="hour"
                        value={hour}
                        onChange={(e) => setHour(e.target.value)}
                        placeholder="0-23"
                        className="font-mono"
                      />
                    </div>
                    <div>
                      <Label htmlFor="dayOfMonth">{t("day_range")}</Label>
                      <Input
                        id="dayOfMonth"
                        value={dayOfMonth}
                        onChange={(e) => setDayOfMonth(e.target.value)}
                        placeholder="1-31"
                        className="font-mono"
                      />
                    </div>
                    <div>
                      <Label htmlFor="month">{t("monthNumericRange")}</Label>
                      <Input
                        id="month"
                        value={month}
                        onChange={(e) => setMonth(e.target.value)}
                        placeholder="1-12"
                        className="font-mono"
                      />
                    </div>
                    <div>
                      <Label htmlFor="dayOfWeek">{t("weekdayShortRange")}</Label>
                      <Input
                        id="dayOfWeek"
                        value={dayOfWeek}
                        onChange={(e) => setDayOfWeek(e.target.value)}
                        placeholder="0-6"
                        className="font-mono"
                      />
                    </div>
                    <div>
                      <Label htmlFor="year">{t("year_range")}</Label>
                      <Input
                        id="year"
                        value={year}
                        onChange={(event) => setYear(event.target.value)}
                        placeholder={t("optional")}
                        className="font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 pt-4 sm:flex">
                    <Button onClick={updateExpressionFromBuilder} className="flex min-w-0 items-center gap-2">
                      <Play className="h-4 w-4" />
                      {t("generateExpression")}
                    </Button>
                    <Button variant="outline" size="icon" onClick={handleClear} aria-label={t("clearInput")}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="border-t border-[var(--md-sys-color-outline-variant)] pt-4">
                    <Label>{t("generatedExpression")}</Label>
                    <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                      <Input value={expression} readOnly className="min-w-0 font-mono" aria-label={t("generatedExpression")} />
                      <Button variant="outline" size="icon" onClick={handleCopy} aria-label={t("copy")}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="presets">
              <div className="space-y-6">
                {presets.map((category) => (
                  <Card key={category.category}>
                    <CardHeader>
                      <CardTitle className="text-lg">{category.category}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        {category.items.map((preset) => (
                          <Button
                            key={preset.value}
                            variant="outline"
                            className="h-auto min-w-0 justify-start px-4 py-4"
                            onClick={() => handlePresetSelect(preset.value)}
                          >
                            <div className="min-w-0 w-full text-left">
                              <div className="font-medium text-sm">{preset.name}</div>
                              <div className="mt-1 break-all font-mono text-xs text-[var(--md-sys-color-on-surface-variant)]">
                                {preset.value}
                              </div>
                              <div className="mt-1 whitespace-normal text-xs text-[var(--md-sys-color-on-surface-variant)]">
                                {preset.description}
                              </div>
                            </div>
                          </Button>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <div className="space-y-6">
          {(errors.length > 0 || warnings.length > 0) && (
            <div className="space-y-3">
              {errors.length > 0 && (
                <Alert className="border-[var(--md-sys-color-error)]/30 bg-[var(--md-sys-color-error-container)] text-[var(--md-sys-color-on-error-container)]">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="space-y-1">
                      <div className="font-medium">{t("errors")}</div>
                      {errors.map((error, index) => (
                        <div key={index} className="text-sm">• {error}</div>
                      ))}
                    </div>
                  </AlertDescription>
                </Alert>
              )}
              
              {warnings.length > 0 && (
                <Alert className="border-[var(--md-sys-color-tertiary)]/30 bg-[var(--md-sys-color-tertiary-container)] text-[var(--md-sys-color-on-tertiary-container)]">
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    <div className="space-y-1">
                      <div className="font-medium">{t("warnings")}</div>
                      {warnings.map((warning, index) => (
                        <div key={index} className="text-sm">• {warning}</div>
                      ))}
                    </div>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Info className="h-5 w-5 text-[var(--md-sys-color-primary)]" />
                {t("expressionDescription")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="text-lg font-medium">
                  {isProcessing ? t("parsing") : description}
                </div>
                
                {isValid && (
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className="bg-[var(--md-sys-color-primary-container)] text-[var(--md-sys-color-on-primary-container)] hover:bg-[var(--md-sys-color-primary-container)]">
                      <Check className="h-3 w-3 mr-1" />
                      {t("validExpression")}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        void copyTextToClipboard(generateCrontabCommand("your-command")).then((success) => {
                          toast({
                            title: success ? t("copied") : t("copyFailed"),
                            description: success ? t("commandCopiedDescription") : undefined,
                            duration: 2000,
                            variant: success ? "default" : "destructive",
                          })
                        })
                      }}
                    >
                      {t("copyCommand")}
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {isValid && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-[var(--md-sys-color-primary)]" />
                  {t("executionPreview")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isProcessing ? (
                  <div className="py-4 text-center" role="status">
                    <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-[var(--md-sys-color-outline-variant)] border-t-[var(--md-sys-color-primary)]"></div>
                    <p className="mt-2 text-sm text-[var(--md-sys-color-on-surface-variant)]">{t("calculating")}</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {nextRuns.length > 0 ? (
                      nextRuns.map((run, index) => (
                        <div key={index} className="flex items-start gap-2 rounded-xl bg-[var(--md-sys-color-surface-container-low)] p-2">
                          <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[var(--md-sys-color-primary)]"></div>
                          <span className="min-w-0 break-words font-mono text-sm">{run}</span>
                        </div>
                      ))
                    ) : (
                      <p className="py-4 text-center text-[var(--md-sys-color-on-surface-variant)]">{t("noScheduledRuns")}</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {isValid && timelineTimes.length >= 2 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-[var(--md-sys-color-primary)]" />
                  {t("executionTimeline")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CronTimeline
                  times={timelineTimes}
                  use24HourFormat={use24HourFormat}
                  translate={t}
                  locale={locale}
                />
              </CardContent>
            </Card>
          )}

          {showHistory && history.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History className="h-5 w-5 text-[var(--md-sys-color-primary)]" />
                  {t("history")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {history.map((item, index) => (
                    <Button
                      key={index}
                      variant="ghost"
                      className="w-full justify-start h-auto p-3"
                      onClick={() => {
                        setExpression(item.expression)
                        parseCron(item.expression)
                      }}
                    >
                      <div className="text-left w-full">
                        <div className="font-mono text-sm">{item.expression}</div>
                        <div className="mt-1 whitespace-normal text-xs text-[var(--md-sys-color-on-surface-variant)]">{item.description}</div>
                        <div className="mt-1 text-xs text-[var(--md-sys-color-on-surface-variant)]">
                          {new Date(item.timestamp).toLocaleString(locale)}
                        </div>
                      </div>
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
