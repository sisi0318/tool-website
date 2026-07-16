"use client"

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
}

function CronTimeline({ times, use24HourFormat }: TimelineProps) {
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
    return date.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      hour12: !use24HourFormat,
    })
  }

  const formatDate = (date: Date) => {
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    })
  }

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000)
    if (seconds < 60) return `${seconds}秒`
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}分钟`
    const hours = Math.floor(minutes / 60)
    const remainMinutes = minutes % 60
    if (hours < 24) return remainMinutes > 0 ? `${hours}小时${remainMinutes}分` : `${hours}小时`
    const days = Math.floor(hours / 24)
    const remainHours = hours % 24
    return remainHours > 0 ? `${days}天${remainHours}小时` : `${days}天`
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
      {/* 间隔统计 */}
      <div className="grid grid-cols-3 gap-2">
        <div className="text-center p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <div className="text-xs text-gray-500">最小间隔</div>
          <div className="text-sm font-medium text-blue-700 dark:text-blue-300">{formatDuration(minInterval)}</div>
        </div>
        <div className="text-center p-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
          <div className="text-xs text-gray-500">平均间隔</div>
          <div className="text-sm font-medium text-green-700 dark:text-green-300">{formatDuration(avgInterval)}</div>
        </div>
        <div className="text-center p-2 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
          <div className="text-xs text-gray-500">最大间隔</div>
          <div className="text-sm font-medium text-orange-700 dark:text-orange-300">{formatDuration(maxInterval)}</div>
        </div>
      </div>

      {/* 24小时热力图 */}
      <div>
        <div className="text-sm font-medium mb-2">24小时分布</div>
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
                      ? `rgba(59, 130, 246, ${0.15 + intensity * 0.85})`
                      : "rgba(0,0,0,0.05)",
                  }}
                  title={`${hour}:00 - ${count}次`}
                />
                {hour % 6 === 0 && (
                  <span className="text-[10px] text-gray-400">{hour}</span>
                )}
              </div>
            )
          })}
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-[10px] text-gray-400">0:00</span>
          <span className="text-[10px] text-gray-400">23:00</span>
        </div>
      </div>

      {/* 时间线 */}
      <div>
        <div className="text-sm font-medium mb-2">执行时间线</div>
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
                      className="text-[11px] fill-gray-500 dark:fill-gray-400"
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
                            className="fill-blue-500 dark:fill-blue-400"
                            opacity={0.9}
                          >
                            <title>{formatTime(t)}</title>
                          </circle>
                          <circle
                            cx={`${xPercent}%`}
                            cy={y}
                            r="8"
                            className="fill-blue-500 dark:fill-blue-400"
                            opacity={0.15}
                          />
                          {/* 时间标签 - 只在点不太密集时显示 */}
                          {(dateTimes.length <= 12 || i % Math.ceil(dateTimes.length / 12) === 0) && (
                            <text
                              x={`${xPercent}%`}
                              y={y + 16}
                              textAnchor="middle"
                              className="text-[9px] fill-gray-500 dark:fill-gray-400"
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

      {/* 每日执行次数 */}
      {dayGroups.size > 1 && (
        <div>
          <div className="text-sm font-medium mb-2">每日执行次数</div>
          <div className="space-y-1">
            {Array.from(dayGroups.entries()).map(([dateStr, dateTimes]) => (
              <div key={dateStr} className="flex items-center gap-2">
                <span className="text-xs text-gray-500 w-16 flex-shrink-0">{formatDate(dateTimes[0])}</span>
                <div className="flex-1 h-5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-400 to-blue-600 rounded-full transition-all flex items-center justify-end pr-2"
                    style={{
                      width: `${Math.max(20, (dateTimes.length / Math.max(...Array.from(dayGroups.values()).map(d => d.length))) * 100)}%`,
                    }}
                  >
                    <span className="text-[10px] text-white font-medium">{dateTimes.length}</span>
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
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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
        category: "常用模板", 
        items: [
          { name: "每分钟", value: "* * * * *", description: "每分钟执行一次" },
          { name: "每5分钟", value: "*/5 * * * *", description: "每5分钟执行一次" },
          { name: "每15分钟", value: "*/15 * * * *", description: "每15分钟执行一次" },
          { name: "每30分钟", value: "*/30 * * * *", description: "每30分钟执行一次" },
          { name: "每小时", value: "0 * * * *", description: "每小时的第0分钟执行" },
          { name: "每天凌晨", value: "0 0 * * *", description: "每天凌晨0点执行" },
        ]
      },
      {
        category: "工作时间",
        items: [
          { name: "工作日上午9点", value: "0 9 * * 1-5", description: "周一到周五上午9点" },
          { name: "工作日下午6点", value: "0 18 * * 1-5", description: "周一到周五下午6点" },
          { name: "工作时间每小时", value: "0 9-17 * * 1-5", description: "工作日9-17点每小时" },
          { name: "午休时间", value: "0 12 * * 1-5", description: "工作日中午12点" },
        ]
      },
      {
        category: "备份与维护",
        items: [
          { name: "每日备份", value: "0 2 * * *", description: "每天凌晨2点备份" },
          { name: "每周备份", value: "0 3 * * 0", description: "每周日凌晨3点备份" },
          { name: "每月备份", value: "0 4 1 * *", description: "每月1号凌晨4点备份" },
          { name: "日志清理", value: "0 1 * * *", description: "每天凌晨1点清理日志" },
          { name: "系统维护", value: "0 5 * * 6", description: "每周六凌晨5点维护" },
        ]
      },
      {
        category: "监控报告",
        items: [
          { name: "健康检查", value: "*/10 * * * *", description: "每10分钟健康检查" },
          { name: "性能监控", value: "*/30 * * * *", description: "每30分钟性能监控" },
          { name: "日报生成", value: "0 8 * * 1-5", description: "工作日早8点生成日报" },
          { name: "周报生成", value: "0 9 * * 1", description: "每周一早9点生成周报" },
          { name: "月报生成", value: "0 10 1 * *", description: "每月1号早10点生成月报" },
        ]
      },
      {
        category: "特殊时间",
        items: [
          { name: "节假日检查", value: "0 0 * * *", description: "每天检查是否为节假日" },
          { name: "周末任务", value: "0 10 * * 6,0", description: "周末上午10点执行" },
          { name: "月末处理", value: "0 23 28-31 * *", description: "每月最后几天晚11点" },
          { name: "季度报告", value: "0 0 1 1,4,7,10 *", description: "每季度第一天" },
        ]
      }
    ],
    [t],
  )

  // 时区选项
  const timezones = [
    { value: "local", label: "本地时区" },
    { value: "UTC", label: "UTC" },
    { value: "Asia/Shanghai", label: "北京时间 (UTC+8)" },
    { value: "America/New_York", label: "纽约时间 (UTC-5/-4)" },
    { value: "Europe/London", label: "伦敦时间 (UTC+0/+1)" },
    { value: "Asia/Tokyo", label: "东京时间 (UTC+9)" },
  ]

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
    
    if (parts.length < expectedParts) {
      errors.push(`表达式应包含${expectedParts}个部分，当前只有${parts.length}个`)
      return { errors, warnings, isValid: false }
    }
    
    // 验证各字段范围
    const ranges = includeSeconds 
      ? [
          { name: "秒", min: 0, max: 59, value: parts[0] },
          { name: "分钟", min: 0, max: 59, value: parts[1] },
          { name: "小时", min: 0, max: 23, value: parts[2] },
          { name: "日期", min: 1, max: 31, value: parts[3] },
          { name: "月份", min: 1, max: 12, value: parts[4] },
          { name: "星期", min: 0, max: 7, value: parts[5] },
        ]
      : [
          { name: "分钟", min: 0, max: 59, value: parts[0] },
          { name: "小时", min: 0, max: 23, value: parts[1] },
          { name: "日期", min: 1, max: 31, value: parts[2] },
          { name: "月份", min: 1, max: 12, value: parts[3] },
          { name: "星期", min: 0, max: 7, value: parts[4] },
        ]
    
    ranges.forEach(range => {
      const expanded = expandCronField(range.value, range.min, range.max)
      if (range.value !== "*" && range.value !== "?" && expanded.length === 0) {
        errors.push(`${range.name}字段"${range.value}"无效，范围应为${range.min}-${range.max}`)
      }
    })
    
    // 检查潜在问题
    if (parts[includeSeconds ? 3 : 2] !== "*" && parts[includeSeconds ? 5 : 4] !== "*") {
      warnings.push("同时指定日期和星期可能导致意外行为")
    }
    
    return { errors, warnings, isValid: errors.length === 0 }
  }, [includeSeconds])

  // Parse cron expression and generate description
  const parseCron = (expr: string) => {
    try {
      // 防止重复处理
      if (isProcessing) return
      setIsProcessing(true)

      // 使用增强的验证函数
      const validation = validateExpression(expr)
      setErrors(validation.errors)
      setWarnings(validation.warnings)
      setIsValid(validation.isValid)

      if (!validation.isValid) {
        setDescription("表达式无效")
        setNextRuns([])
        setTimelineTimes([])
        setIsProcessing(false)
        return
      }

      // 使用setTimeout来避免UI阻塞
      setTimeout(() => {
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
            return date.toLocaleString(undefined, options)
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
          setDescription("解析错误")
          setNextRuns([])
          setErrors(["解析时发生错误"])
        } finally {
          setIsProcessing(false)
        }
      }, 0)
    } catch (error) {
      console.error("Error in parseCron:", error)
      setIsValid(false)
      setDescription("解析错误")
      setNextRuns([])
      setErrors(["解析时发生错误"])
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
      clearTimeout(debounceTimerRef.current)
    }
    debounceTimerRef.current = setTimeout(() => {
      parseCron(value)
      updateBuilderFromExpression(value)
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
      title: "配置已导出",
      description: "Crontab 配置已保存为 JSON 文件",
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
              全选
            </Button>
            <Button variant="outline" size="sm" onClick={selectNone}>
              清空
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
                className="h-8 text-xs"
                onClick={() => toggleValue(value)}
              >
                {format ? format(value) : value}
              </Button>
            )
          })}
        </div>
        {selected.length > 0 && (
          <div className="text-sm text-gray-600 dark:text-gray-400">
            已选择: {selected.join(", ")}
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
    navigator.clipboard.writeText(expression)
    toast({
      title: t("copied"),
      duration: 2000,
    })
  }

  // Clear expression
  const handleClear = () => {
    const defaultExpression = includeSeconds ? "0 * * * * *" : "* * * * *"
    setExpression(defaultExpression)
    parseCron(defaultExpression)
    updateBuilderFromExpression(defaultExpression)
  }

  // 初始化解析
  useEffect(() => {
    parseCron(expression)
  }, [])

  // 自动构建表达式
  useEffect(() => {
    if (activeTab === "visual") {
      buildExpressionFromVisual()
    }
  }, [selectedMinutes, selectedHours, selectedDays, selectedMonths, selectedWeekdays, buildExpressionFromVisual, activeTab])

  return (
    <div className="container mx-auto py-6 px-4 max-w-7xl">
      {/* 页面标题和描述 */}
      <div className="text-center space-y-4 mb-8">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-200">
          Crontab 表达式生成器
        </h1>
        <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
          智能生成和解析 Crontab 表达式，支持可视化编辑和时间预览
        </p>
      </div>

      {/* 设置面板 */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Settings className="h-5 w-5" />
              全局设置
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAdvanced(!showAdvanced)}
            >
              {showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              {showAdvanced ? "收起" : "展开"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
                      包含秒字段
                    </Label>
                  </div>
                </TooltipTrigger>
                <TooltipContent>启用6位表达式（包含秒）</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <div className="flex items-center space-x-2">
              <Switch
                id="use24HourFormat"
                checked={use24HourFormat}
                onCheckedChange={setUse24HourFormat}
              />
              <Label htmlFor="use24HourFormat" className="cursor-pointer text-sm">
                24小时制
              </Label>
            </div>

            {showAdvanced && (
              <>
                <div className="flex items-center space-x-2">
                  <Label htmlFor="timezone" className="text-sm">时区:</Label>
                  <Select value={selectedTimezone} onValueChange={setSelectedTimezone}>
                    <SelectTrigger className="w-32">
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

                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowHistory(!showHistory)}
                    className="flex items-center gap-2"
                  >
                    <History className="h-4 w-4" />
                    历史记录
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={exportConfig}
                    className="flex items-center gap-2"
                  >
                    <Download className="h-4 w-4" />
                    导出
                  </Button>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 主要内容区域 */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* 左侧：输入和构建区域 */}
        <div className="xl:col-span-2 space-y-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="visual" className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                可视化
              </TabsTrigger>
              <TabsTrigger value="expression" className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                表达式
              </TabsTrigger>
              <TabsTrigger value="builder" className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                构建器
              </TabsTrigger>
              <TabsTrigger value="presets" className="flex items-center gap-2">
                <Zap className="h-4 w-4" />
                模板
              </TabsTrigger>
            </TabsList>

            {/* 可视化构建器 */}
            <TabsContent value="visual" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    可视化时间选择器
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <TimeSelector
                    label="分钟 (0-59)"
                    min={0}
                    max={59}
                    selected={selectedMinutes}
                    onChange={setSelectedMinutes}
                  />
                  
                  <TimeSelector
                    label="小时 (0-23)"
                    min={0}
                    max={23}
                    selected={selectedHours}
                    onChange={setSelectedHours}
                  />
                  
                  <TimeSelector
                    label="日期 (1-31)"
                    min={1}
                    max={31}
                    selected={selectedDays}
                    onChange={setSelectedDays}
                  />
                  
                  <TimeSelector
                    label="月份 (1-12)"
                    min={1}
                    max={12}
                    selected={selectedMonths}
                    onChange={setSelectedMonths}
                    format={(value) => {
                      const months = ['一月', '二月', '三月', '四月', '五月', '六月',
                                    '七月', '八月', '九月', '十月', '十一月', '十二月']
                      return months[value - 1] || value.toString()
                    }}
                  />
                  
                  <TimeSelector
                    label="星期 (0-6，0=周日)"
                    min={0}
                    max={6}
                    selected={selectedWeekdays}
                    onChange={setSelectedWeekdays}
                    format={(value) => {
                      const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
                      return days[value] || value.toString()
                    }}
                  />

                  <div className="border-t pt-4">
                    <Label className="text-lg font-medium">生成的表达式</Label>
                    <div className="mt-2 flex items-center gap-2">
                      <Input
                        value={expression}
                        readOnly
                        className="font-mono text-lg"
                      />
                      <Button variant="outline" size="icon" onClick={handleCopy}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* 表达式编辑器 */}
            <TabsContent value="expression">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Cron 表达式编辑
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>表达式</Label>
                    <div className="flex gap-2">
                      <Input
                        value={expression}
                        onChange={(e) => handleExpressionChange(e.target.value)}
                        placeholder="输入 cron 表达式，例如：* * * * *"
                        className={`text-lg font-mono ${!isValid ? "border-red-500" : ""}`}
                      />
                      <Button variant="outline" onClick={handleClear}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" onClick={handleCopy}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  
                  {/* 格式说明 */}
                  <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                    <Label className="font-medium">格式说明</Label>
                    <pre className="text-xs mt-2 text-gray-600 dark:text-gray-400">
                      {includeSeconds
                        ? "秒(0-59) 分(0-59) 时(0-23) 日(1-31) 月(1-12) 周(0-6)"
                        : "分(0-59) 时(0-23) 日(1-31) 月(1-12) 周(0-6)"
                      }
                    </pre>
                    <div className="text-xs mt-2 space-y-1 text-gray-600 dark:text-gray-400">
                      <div>• * = 任意值</div>
                      <div>• , = 列表分隔符 (如: 1,3,5)</div>
                      <div>• - = 范围 (如: 1-5)</div>
                      <div>• / = 步长 (如: */5)</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* 手动构建器 */}
            <TabsContent value="builder">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    手动构建器
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {includeSeconds && (
                      <div>
                        <Label htmlFor="seconds">秒 (0-59)</Label>
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
                      <Label htmlFor="minute">分钟 (0-59)</Label>
                      <Input
                        id="minute"
                        value={minute}
                        onChange={(e) => setMinute(e.target.value)}
                        placeholder="0-59"
                        className="font-mono"
                      />
                    </div>
                    <div>
                      <Label htmlFor="hour">小时 (0-23)</Label>
                      <Input
                        id="hour"
                        value={hour}
                        onChange={(e) => setHour(e.target.value)}
                        placeholder="0-23"
                        className="font-mono"
                      />
                    </div>
                    <div>
                      <Label htmlFor="dayOfMonth">日期 (1-31)</Label>
                      <Input
                        id="dayOfMonth"
                        value={dayOfMonth}
                        onChange={(e) => setDayOfMonth(e.target.value)}
                        placeholder="1-31"
                        className="font-mono"
                      />
                    </div>
                    <div>
                      <Label htmlFor="month">月份 (1-12)</Label>
                      <Input
                        id="month"
                        value={month}
                        onChange={(e) => setMonth(e.target.value)}
                        placeholder="1-12"
                        className="font-mono"
                      />
                    </div>
                    <div>
                      <Label htmlFor="dayOfWeek">星期 (0-6)</Label>
                      <Input
                        id="dayOfWeek"
                        value={dayOfWeek}
                        onChange={(e) => setDayOfWeek(e.target.value)}
                        placeholder="0-6"
                        className="font-mono"
                      />
                    </div>
                  </div>

                  <div className="flex gap-2 pt-4">
                    <Button onClick={updateExpressionFromBuilder} className="flex items-center gap-2">
                      <Play className="h-4 w-4" />
                      生成表达式
                    </Button>
                    <Button variant="outline" onClick={handleClear}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="border-t pt-4">
                    <Label>生成的表达式</Label>
                    <div className="flex gap-2 mt-2">
                      <Input value={expression} readOnly className="font-mono" />
                      <Button variant="outline" size="icon" onClick={handleCopy}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* 预设模板 */}
            <TabsContent value="presets">
              <div className="space-y-6">
                {presets.map((category) => (
                  <Card key={category.category}>
                    <CardHeader>
                      <CardTitle className="text-lg">{category.category}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {category.items.map((preset) => (
                          <Button
                            key={preset.value}
                            variant="outline"
                            className="justify-start h-auto py-4 px-4"
                            onClick={() => handlePresetSelect(preset.value)}
                          >
                            <div className="text-left w-full">
                              <div className="font-medium text-sm">{preset.name}</div>
                              <div className="text-xs text-gray-500 dark:text-gray-400 font-mono mt-1">
                                {preset.value}
                              </div>
                              <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
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

        {/* 右侧：结果显示区域 */}
        <div className="space-y-6">
          {/* 错误和警告 */}
          {(errors.length > 0 || warnings.length > 0) && (
            <div className="space-y-3">
              {errors.length > 0 && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="space-y-1">
                      <div className="font-medium">错误</div>
                      {errors.map((error, index) => (
                        <div key={index} className="text-sm">• {error}</div>
                      ))}
                    </div>
                  </AlertDescription>
                </Alert>
              )}
              
              {warnings.length > 0 && (
                <Alert className="border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-900/10">
                  <Info className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                  <AlertDescription>
                    <div className="space-y-1">
                      <div className="font-medium text-yellow-800 dark:text-yellow-200">警告</div>
                      {warnings.map((warning, index) => (
                        <div key={index} className="text-sm text-yellow-700 dark:text-yellow-300">• {warning}</div>
                      ))}
                    </div>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {/* 表达式描述 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Info className="h-5 w-5 text-blue-500" />
                表达式描述
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="text-lg font-medium">
                  {isProcessing ? "解析中..." : description}
                </div>
                
                {isValid && (
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="bg-green-100 text-green-800">
                      <Check className="h-3 w-3 mr-1" />
                      有效表达式
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(generateCrontabCommand("your-command"))
                        toast({
                          title: "已复制",
                          description: "完整的 crontab 命令已复制到剪贴板",
                          duration: 2000,
                        })
                      }}
                    >
                      复制命令
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* 执行时间预览 */}
          {isValid && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-green-500" />
                  执行时间预览
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isProcessing ? (
                  <div className="text-center py-4">
                    <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
                    <p className="mt-2 text-sm text-gray-500">计算中...</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {nextRuns.length > 0 ? (
                      nextRuns.map((run, index) => (
                        <div key={index} className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-800 rounded">
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          <span className="font-mono text-sm">{run}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-gray-500 text-center py-4">未找到执行时间</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* 时间线可视化 */}
          {isValid && timelineTimes.length >= 2 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-purple-500" />
                  执行时间线
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CronTimeline times={timelineTimes} use24HourFormat={use24HourFormat} />
              </CardContent>
            </Card>
          )}

          {/* 历史记录 */}
          {showHistory && history.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History className="h-5 w-5 text-purple-500" />
                  历史记录
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
                        <div className="text-xs text-gray-500 mt-1">{item.description}</div>
                        <div className="text-xs text-gray-400 mt-1">
                          {new Date(item.timestamp).toLocaleString()}
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
