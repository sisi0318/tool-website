"use client"

import type React from "react"

import { useState, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useTranslations } from "@/hooks/use-translations"
import { Minus, Plus, Copy, Thermometer, Settings, ChevronUp, ChevronDown, Zap, Eye, Check, Snowflake, Sun, RefreshCw, ArrowLeftRight } from "lucide-react"

interface TemperatureConverterProps {
  params?: Record<string, string>
}

// Temperature scales and their conversion formulas
const temperatureScales = [
  {
    id: "kelvin",
    name: "Kelvin",
    chineseName: "开尔文",
    symbol: "K",
    category: "common",
    color: "text-purple-600",
    icon: "⚗️",
    toKelvin: (value: number) => value,
    fromKelvin: (kelvin: number) => kelvin,
    description: "热力学温标的基本单位",
  },
  {
    id: "celsius",
    name: "Celsius",
    chineseName: "摄氏度",
    symbol: "°C",
    category: "common",
    color: "text-blue-600",
    icon: "🌡️",
    toKelvin: (celsius: number) => celsius + 273.15,
    fromKelvin: (kelvin: number) => kelvin - 273.15,
    description: "最常用的温度单位",
  },
  {
    id: "fahrenheit",
    name: "Fahrenheit",
    chineseName: "华氏度",
    symbol: "°F",
    category: "common",
    color: "text-red-600",
    icon: "🇺🇸",
    toKelvin: (fahrenheit: number) => (fahrenheit + 459.67) * (5 / 9),
    fromKelvin: (kelvin: number) => kelvin * (9 / 5) - 459.67,
    description: "美国常用的温度单位",
  },
  {
    id: "rankine",
    name: "Rankine",
    chineseName: "兰金",
    symbol: "°R",
    category: "scientific",
    color: "text-orange-600",
    icon: "🔬",
    toKelvin: (rankine: number) => rankine * (5 / 9),
    fromKelvin: (kelvin: number) => kelvin * (9 / 5),
    description: "工程热力学中使用",
  },
  {
    id: "delisle",
    name: "Delisle",
    chineseName: "德莱尔",
    symbol: "°De",
    category: "historical",
    color: "text-green-600",
    icon: "📜",
    toKelvin: (delisle: number) => 373.15 - (delisle * 2) / 3,
    fromKelvin: (kelvin: number) => (373.15 - kelvin) * (3 / 2),
    description: "18世纪德国天文学家发明",
  },
  {
    id: "newton",
    name: "Newton",
    chineseName: "牛顿",
    symbol: "°N",
    category: "historical",
    color: "text-indigo-600",
    icon: "🍎",
    toKelvin: (newton: number) => newton * (100 / 33) + 273.15,
    fromKelvin: (kelvin: number) => (kelvin - 273.15) * (33 / 100),
    description: "牛顿提出的温度标度",
  },
  {
    id: "reaumur",
    name: "Réaumur",
    chineseName: "雷奥穆尔",
    symbol: "°Ré",
    category: "historical",
    color: "text-pink-600",
    icon: "🇫🇷",
    toKelvin: (reaumur: number) => reaumur * (5 / 4) + 273.15,
    fromKelvin: (kelvin: number) => (kelvin - 273.15) * (4 / 5),
    description: "法国科学家雷奥穆尔发明",
  },
  {
    id: "romer",
    name: "Rømer",
    chineseName: "罗默",
    symbol: "°Rø",
    category: "historical",
    color: "text-cyan-600",
    icon: "🇩🇰",
    toKelvin: (romer: number) => (romer - 7.5) * (40 / 21) + 273.15,
    fromKelvin: (kelvin: number) => (kelvin - 273.15) * (21 / 40) + 7.5,
    description: "丹麦天文学家罗默发明",
  },
]

// Common temperature presets
const temperaturePresets = [
  { name: "绝对零度", nameEn: "Absolute Zero", kelvin: 0, icon: "❄️", category: "science" },
  { name: "液氮沸点", nameEn: "Liquid Nitrogen", kelvin: 77.36, icon: "🧪", category: "science" },
  { name: "干冰升华", nameEn: "Dry Ice", kelvin: 194.65, icon: "🧊", category: "science" },
  { name: "水的冰点", nameEn: "Water Freezing", kelvin: 273.15, icon: "🧊", category: "daily" },
  { name: "室温", nameEn: "Room Temperature", kelvin: 293.15, icon: "🏠", category: "daily" },
  { name: "人体体温", nameEn: "Body Temperature", kelvin: 310.15, icon: "🩺", category: "daily" },
  { name: "水的沸点", nameEn: "Water Boiling", kelvin: 373.15, icon: "💨", category: "daily" },
  { name: "烘焙温度", nameEn: "Baking Temperature", kelvin: 453.15, icon: "🍞", category: "cooking" },
  { name: "太阳表面", nameEn: "Sun Surface", kelvin: 5778, icon: "☀️", category: "astronomy" },
  { name: "地球核心", nameEn: "Earth Core", kelvin: 6000, icon: "🌍", category: "geology" },
]

export default function TemperatureConverterPage({ params }: TemperatureConverterProps) {
  const t = useTranslations("temperatureConverter")
  const { language } = useTranslations()

  // 设置状态
  const [showTemperatureSettings, setShowTemperatureSettings] = useState(false)
  const [autoFormat, setAutoFormat] = useState(true)
  const [realTimeConversion, setRealTimeConversion] = useState(true)
  const [showDescription, setShowDescription] = useState(false)
  const [compactDisplay, setCompactDisplay] = useState(false)
  const [precision, setPrecision] = useState(2)
  
  // 主要状态
  const [temperatures, setTemperatures] = useState<Record<string, number>>(
    Object.fromEntries(temperatureScales.map((scale) => [scale.id, scale.id === "celsius" ? 20 : scale.fromKelvin(293.15)])),
  )
  const [copied, setCopied] = useState<{ [key: string]: boolean }>({})
  const [conversionHistory, setConversionHistory] = useState<Array<{
    id: string
    timestamp: Date
    input: { value: number, scale: string }
    results: Record<string, number>
  }>>([])
  const [favoritePresets, setFavoritePresets] = useState<string[]>(["celsius", "fahrenheit", "kelvin"])

  // Update all temperatures based on the changed scale
  const updateTemperatures = useCallback((value: number, scaleId: string) => {
    const scale = temperatureScales.find((s) => s.id === scaleId)
    if (!scale) return

    // Convert to Kelvin first
    const kelvin = scale.toKelvin(value)

    // Then convert from Kelvin to all other scales
    const newTemperatures = Object.fromEntries(temperatureScales.map((s) => [s.id, s.fromKelvin(kelvin)]))

    setTemperatures(newTemperatures)
  }, [])

  // Handle input change
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>, scaleId: string) => {
      const value = Number.parseFloat(e.target.value)
      if (!isNaN(value)) {
        updateTemperatures(value, scaleId)
      }
    },
    [updateTemperatures],
  )

  // Handle increment/decrement
  const handleIncrement = useCallback(
    (scaleId: string, amount: number) => {
      const currentValue = temperatures[scaleId]
      updateTemperatures(currentValue + amount, scaleId)
    },
    [temperatures, updateTemperatures],
  )

  // Copy value to clipboard
  const copyToClipboard = useCallback((text: string, key: string = "main") => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(prev => ({ ...prev, [key]: true }))
      setTimeout(() => setCopied(prev => ({ ...prev, [key]: false })), 2000)
    })
  }, [])

  // Format temperature value
  const formatTemperature = useCallback((value: number) => {
    if (!autoFormat) return value.toString()
    
    // 根据精度设置格式化
    const formatted = value.toFixed(precision)
    
    // 移除不必要的小数点后的零
    return formatted.replace(/\.?0+$/, "")
  }, [autoFormat, precision])

  // 添加到转换历史
  const addToHistory = useCallback((value: number, scaleId: string, results: Record<string, number>) => {
    const newEntry = {
      id: Date.now().toString(),
      timestamp: new Date(),
      input: { value, scale: scaleId },
      results
    }
    setConversionHistory(prev => [newEntry, ...prev.slice(0, 9)]) // 保留最近10条记录
  }, [])

  // Get the display name based on language
  const getDisplayName = useCallback(
    (scale: (typeof temperatureScales)[0]) => {
      if (language === "zh") {
        return `${scale.chineseName} (${scale.name})`
      }
      return `${scale.name} (${scale.chineseName})`
    },
    [language],
  )

  return (
    <div className="container mx-auto px-4 py-4 max-w-7xl">
      {/* 页面标题 */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-200 mb-4 flex items-center justify-center gap-2">
          <Thermometer className="h-8 w-8 text-red-600" />
          温度转换器
        </h1>
      </div>

      {/* 温度设置折叠区域 */}
      <div className="mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowTemperatureSettings(!showTemperatureSettings)}
          className="w-full text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
        >
          <div className="flex items-center gap-2">
            {showTemperatureSettings ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
            <Settings className="h-4 w-4" />
            <span>温度设置</span>
            {!showTemperatureSettings && (
              <Badge variant="secondary" className="text-xs ml-auto">
                点击查看
              </Badge>
            )}
          </div>
        </Button>

        {showTemperatureSettings && (
          <Card className="mt-3 card-modern">
            <CardContent className="py-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="flex items-center space-x-2 bg-gray-100 dark:bg-gray-800 p-3 rounded-lg">
                  <Label htmlFor="auto-format" className="cursor-pointer text-sm">
                    关闭格式化
                  </Label>
                  <Switch id="auto-format" checked={autoFormat} onCheckedChange={setAutoFormat} />
                  <Label htmlFor="auto-format" className="cursor-pointer text-sm text-blue-600">
                    自动格式化
                  </Label>
                </div>
                <div className="flex items-center space-x-2 bg-gray-100 dark:bg-gray-800 p-3 rounded-lg">
                  <Label htmlFor="real-time-conversion" className="cursor-pointer text-sm">
                    手动转换
                  </Label>
                  <Switch id="real-time-conversion" checked={realTimeConversion} onCheckedChange={setRealTimeConversion} />
                  <Label htmlFor="real-time-conversion" className="cursor-pointer text-sm text-green-600">
                    实时转换
                  </Label>
                </div>
                <div className="flex items-center space-x-2 bg-gray-100 dark:bg-gray-800 p-3 rounded-lg">
                  <Label htmlFor="show-description" className="cursor-pointer text-sm">
                    隐藏说明
                  </Label>
                  <Switch id="show-description" checked={showDescription} onCheckedChange={setShowDescription} />
                  <Label htmlFor="show-description" className="cursor-pointer text-sm text-purple-600">
                    显示说明
                  </Label>
                </div>
                <div className="flex items-center space-x-2 bg-gray-100 dark:bg-gray-800 p-3 rounded-lg">
                  <Label htmlFor="compact-display" className="cursor-pointer text-sm">
                    详细显示
                  </Label>
                  <Switch id="compact-display" checked={compactDisplay} onCheckedChange={setCompactDisplay} />
                  <Label htmlFor="compact-display" className="cursor-pointer text-sm text-orange-600">
                    紧凑显示
                  </Label>
                </div>
                <div className="flex items-center space-x-2 bg-gray-100 dark:bg-gray-800 p-3 rounded-lg col-span-full md:col-span-1">
                  <Label htmlFor="precision" className="cursor-pointer text-sm">
                    精度:
                  </Label>
                  <Select value={precision.toString()} onValueChange={(value) => setPrecision(Number.parseInt(value))}>
                    <SelectTrigger className="w-20 h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">0位</SelectItem>
                      <SelectItem value="1">1位</SelectItem>
                      <SelectItem value="2">2位</SelectItem>
                      <SelectItem value="3">3位</SelectItem>
                      <SelectItem value="4">4位</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* 温度转换器 - 所有单位统一显示 */}
      <div className="space-y-8">
        {/* 常用单位区域 */}
        <Card className="card-modern">
          <CardHeader className="pb-3">
            <CardTitle className="text-xl flex items-center gap-2">
              <Thermometer className="h-6 w-6 text-blue-600" />
              常用温度单位
              <Badge variant="secondary" className="text-xs">
                日常使用
              </Badge>
              {realTimeConversion && (
                <Badge variant="secondary" className="text-xs">
                  <Zap className="h-3 w-3 mr-1" />
                  实时转换
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {temperatureScales
                .filter(scale => scale.category === "common")
                .map((scale) => (
                  <TemperatureCard
                    key={scale.id}
                    scale={scale}
                    value={temperatures[scale.id]}
                    formatTemperature={formatTemperature}
                    onInputChange={handleInputChange}
                    onIncrement={handleIncrement}
                    onCopy={copyToClipboard}
                    copied={copied}
                    showDescription={showDescription}
                    compactDisplay={compactDisplay}
                    realTimeConversion={realTimeConversion}
                  />
                ))}
            </div>
          </CardContent>
        </Card>

        {/* 科学单位区域 */}
        <Card className="card-modern">
          <CardHeader className="pb-3">
            <CardTitle className="text-xl flex items-center gap-2">
              <Sun className="h-6 w-6 text-orange-600" />
              科学温度单位
              <Badge variant="secondary" className="text-xs">
                科学研究
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {temperatureScales
                .filter(scale => scale.category === "scientific")
                .map((scale) => (
                  <TemperatureCard
                    key={scale.id}
                    scale={scale}
                    value={temperatures[scale.id]}
                    formatTemperature={formatTemperature}
                    onInputChange={handleInputChange}
                    onIncrement={handleIncrement}
                    onCopy={copyToClipboard}
                    copied={copied}
                    showDescription={showDescription}
                    compactDisplay={compactDisplay}
                    realTimeConversion={realTimeConversion}
                  />
                ))}
            </div>
          </CardContent>
        </Card>

        {/* 历史单位区域 */}
        <Card className="card-modern">
          <CardHeader className="pb-3">
            <CardTitle className="text-xl flex items-center gap-2">
              <Snowflake className="h-6 w-6 text-cyan-600" />
              历史温度单位
              <Badge variant="secondary" className="text-xs">
                历史参考
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {temperatureScales
                .filter(scale => scale.category === "historical")
                .map((scale) => (
                  <TemperatureCard
                    key={scale.id}
                    scale={scale}
                    value={temperatures[scale.id]}
                    formatTemperature={formatTemperature}
                    onInputChange={handleInputChange}
                    onIncrement={handleIncrement}
                    onCopy={copyToClipboard}
                    copied={copied}
                    showDescription={showDescription}
                    compactDisplay={compactDisplay}
                    realTimeConversion={realTimeConversion}
                  />
                ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 预设温度 */}
      <Card className="mt-8 card-modern">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Sun className="h-5 w-5 text-yellow-600" />
            常见温度预设
            <Badge variant="secondary" className="text-xs">
              点击快速设置
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
            {temperaturePresets.map((preset, index) => (
              <Button
                key={index}
                variant="outline"
                className="h-auto p-4 flex flex-col items-center gap-2 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                onClick={() => {
                  updateTemperatures(preset.kelvin, "kelvin")
                  addToHistory(preset.kelvin, "kelvin", temperatures)
                }}
              >
                <span className="text-2xl">{preset.icon}</span>
                <div className="text-center">
                  <div className="font-medium text-sm">{preset.name}</div>
                  <div className="text-xs text-gray-500">
                    {formatTemperature(preset.kelvin - 273.15)} °C
                  </div>
                </div>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// Temperature card component
interface TemperatureCardProps {
  scale: {
    id: string
    name: string
    chineseName: string
    symbol: string
    color: string
    icon: string
    description: string
  }
  value: number
  formatTemperature: (value: number) => string
  onInputChange: (e: React.ChangeEvent<HTMLInputElement>, scaleId: string) => void
  onIncrement: (scaleId: string, amount: number) => void
  onCopy: (text: string, key: string) => void
  copied: { [key: string]: boolean }
  showDescription: boolean
  compactDisplay: boolean
  realTimeConversion: boolean
}

function TemperatureCard({
  scale,
  value,
  formatTemperature,
  onInputChange,
  onIncrement,
  onCopy,
  copied,
  showDescription,
  compactDisplay,
  realTimeConversion,
}: TemperatureCardProps) {
  const copyKey = `temp-${scale.id}`

  return (
    <Card className="card-modern">
      <CardHeader className="pb-3">
        <CardTitle className={`text-lg flex items-center gap-2 ${scale.color}`}>
          <span className="text-xl">{scale.icon}</span>
          <div className="flex-1">
            <div className="font-semibold">{scale.chineseName}</div>
            <div className="text-sm font-normal text-gray-500">{scale.name}</div>
          </div>
          {realTimeConversion && (
            <Badge variant="secondary" className="text-xs">
              <Zap className="h-3 w-3 mr-1" />
              实时
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
      <div className="space-y-4">
          {/* 温度值显示 */}
          <div className={`${compactDisplay ? 'p-3' : 'p-4'} bg-gray-50 dark:bg-gray-900 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700`}>
            <div className="flex items-center gap-2">
              <Input
                type="text"
                value={formatTemperature(value)}
                onChange={(e) => onInputChange(e, scale.id)}
                className={`font-mono text-center ${compactDisplay ? 'text-lg h-10' : 'text-2xl h-12'} border-0 bg-transparent shadow-none focus-visible:ring-0`}
              />
              <div className={`flex items-center justify-center font-semibold ${scale.color} ${compactDisplay ? 'text-lg' : 'text-xl'} min-w-[3rem]`}>
                {scale.symbol}
              </div>
            </div>
          </div>

          {/* 控制按钮 */}
          <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
              onClick={() => onIncrement(scale.id, -1)}
              className="flex-1"
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
              onClick={() => onCopy(formatTemperature(value), copyKey)}
              className="flex-1"
            >
              {copied[copyKey] ? (
                <Check className="h-4 w-4 mr-2 text-green-500" />
              ) : (
                <Copy className="h-4 w-4 mr-2" />
              )}
              {copied[copyKey] ? "已复制" : "复制"}
              </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => onIncrement(scale.id, 1)}
              className="flex-1"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {/* 说明文字 */}
          {showDescription && (
            <div className="text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 p-2 rounded">
              {scale.description}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
