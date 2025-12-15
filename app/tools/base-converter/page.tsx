"use client"

import type React from "react"

import { useState, useEffect, useCallback, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useTranslations } from "@/hooks/use-translations"
import { Copy, Minus, Plus, Calculator, Settings, ChevronUp, ChevronDown, Zap, Eye, Check, Hash, RefreshCw, ArrowLeftRight, Binary } from "lucide-react"
import { toast } from "@/components/ui/use-toast"

interface BaseConverterProps {
  params?: Record<string, string>
}

// Base conversion utilities
// Using '-' instead of '/' to avoid regex issues
const ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz+-"

// Common base presets
const BASE_PRESETS = [
  { name: "二进制", base: 2, icon: "010101", color: "bg-green-100 text-green-700" },
  { name: "八进制", base: 8, icon: "7654", color: "bg-blue-100 text-blue-700" },
  { name: "十进制", base: 10, icon: "1234", color: "bg-purple-100 text-purple-700" },
  { name: "十六进制", base: 16, icon: "ABCD", color: "bg-orange-100 text-orange-700" },
  { name: "Base32", base: 32, icon: "A2C4", color: "bg-pink-100 text-pink-700" },
  { name: "Base36", base: 36, icon: "Z9X7", color: "bg-indigo-100 text-indigo-700" },
  { name: "Base58", base: 58, icon: "BTC", color: "bg-yellow-100 text-yellow-700" },
  { name: "Base62", base: 62, icon: "URL", color: "bg-cyan-100 text-cyan-700" },
  { name: "Base64", base: 64, icon: "JSON", color: "bg-red-100 text-red-700" },
]

// Number format helpers
const formatNumber = (value: string, base: number): string => {
  if (!value) return ""
  
  // Add separators for readability
  if (base === 2 && value.length > 4) {
    return value.replace(/(.{4})/g, "$1 ").trim()
  }
  if (base === 8 && value.length > 3) {
    return value.replace(/(.{3})/g, "$1 ").trim()
  }
  if (base === 16 && value.length > 4) {
    return value.replace(/(.{4})/g, "$1 ").trim()
  }
  if (base === 10 && value.length > 3) {
    return value.replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1,")
  }
  
  return value
}

// Convert from any base to decimal
function toDecimal(value: string, base: number): number {
  if (base === 64) {
    try {
      // For base64, we'll use a custom implementation instead of atob
      // to avoid issues with special characters
      let result = 0
      for (let i = 0; i < value.length; i++) {
        const digit = ALPHABET.indexOf(value[i])
        if (digit === -1 || digit >= 64) {
          throw new Error(`Invalid digit for base 64: ${value[i]}`)
        }
        result = result * 64 + digit
      }
      return result
    } catch (e) {
      throw new Error("Invalid Base64 input")
    }
  }

  if (base < 2 || base > 62) {
    throw new Error(`Base ${base} not supported`)
  }

  let result = 0
  for (let i = 0; i < value.length; i++) {
    const digit = ALPHABET.indexOf(value[i])
    if (digit === -1 || digit >= base) {
      throw new Error(`Invalid digit for base ${base}: ${value[i]}`)
    }
    result = result * base + digit
  }
  return result
}

// Convert from decimal to any base
function fromDecimal(value: number, base: number): string {
  if (base === 64) {
    // Custom base64 implementation using our ALPHABET
    if (value === 0) return "0"

    let result = ""
    let temp = value
    while (temp > 0) {
      result = ALPHABET[temp % 64] + result
      temp = Math.floor(temp / 64)
    }
    return result
  }

  if (base < 2 || base > 62) {
    throw new Error(`Base ${base} not supported`)
  }

  if (value === 0) return "0"

  let result = ""
  let temp = value
  while (temp > 0) {
    result = ALPHABET[temp % base] + result
    temp = Math.floor(temp / base)
  }
  return result
}

// Convert from any base to any base
function convertBase(value: string, fromBase: number, toBase: number): string {
  if (!value) return ""
  try {
    const decimal = toDecimal(value, fromBase)
    return fromDecimal(decimal, toBase)
  } catch (e) {
    throw e
  }
}

export default function BaseConverterPage({ params }: BaseConverterProps) {
  const t = useTranslations("baseConverter")
  // Use useRef to create a stable reference to the t function
  const tRef = useRef(t)
  useEffect(() => {
    tRef.current = t
  }, [t])

  // 设置状态
  const [showConverterSettings, setShowConverterSettings] = useState(false)
  const [autoFormat, setAutoFormat] = useState(true)
  const [realTimeConversion, setRealTimeConversion] = useState(true)
  const [showBitLength, setShowBitLength] = useState(false)
  const [compactDisplay, setCompactDisplay] = useState(false)

  // 主要状态
  const [inputNumber, setInputNumber] = useState("12345")
  const [inputBase, setInputBase] = useState(10)
  const [customBase, setCustomBase] = useState(36)
  const [results, setResults] = useState<Record<string, string>>({})
  const [error, setError] = useState("")
  const [copied, setCopied] = useState<{ [key: string]: boolean }>({})
  const [activeTab, setActiveTab] = useState("standard")

  // Convert the input number to all bases
  const convertToAllBases = useCallback(() => {
    if (!inputNumber) {
      setResults({})
      setError("")
      return
    }

    try {
      const decimal = toDecimal(inputNumber, inputBase)

      const newResults = {
        binary: fromDecimal(decimal, 2),
        octal: fromDecimal(decimal, 8),
        decimal: decimal.toString(),
        hexadecimal: fromDecimal(decimal, 16),
        base32: fromDecimal(decimal, 32),
        base36: fromDecimal(decimal, 36),
        base58: fromDecimal(decimal, 58),
        base62: fromDecimal(decimal, 62),
        base64: fromDecimal(decimal, 64),
        custom: fromDecimal(decimal, customBase),
      }
      
      setResults(newResults)

      setError("")
    } catch (e) {
      setError((e as Error).message || tRef.current("invalidInput"))
      setResults({})
    }
  }, [inputNumber, inputBase, customBase])

  // Update conversions when inputs change
  useEffect(() => {
    convertToAllBases()
  }, [convertToAllBases])

  // Handle copying to clipboard
  const handleCopy = useCallback((text: string, key: string = "main") => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(prev => ({ ...prev, [key]: true }))
      setTimeout(() => setCopied(prev => ({ ...prev, [key]: false })), 2000)
      toast({
        description: "已复制到剪贴板",
        duration: 2000,
      })
    })
  }, [])

  // Increment/decrement input base
  const incrementBase = () => {
    if (inputBase < 62) setInputBase(inputBase + 1)
  }

  const decrementBase = () => {
    if (inputBase > 2) setInputBase(inputBase - 1)
  }

  // Increment/decrement custom base
  const incrementCustomBase = () => {
    if (customBase < 62) setCustomBase(customBase + 1)
  }

  const decrementCustomBase = () => {
    if (customBase > 2) setCustomBase(customBase - 1)
  }

  return (
    <div className="container mx-auto px-4 py-4 max-w-7xl">
      {/* 页面标题 */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-200 mb-4 flex items-center justify-center gap-2">
          <Calculator className="h-8 w-8 text-blue-600" />
          进制转换器
        </h1>
      </div>

      {/* 转换器设置折叠区域 */}
      <div className="mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowConverterSettings(!showConverterSettings)}
          className="w-full text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
        >
          <div className="flex items-center gap-2">
            {showConverterSettings ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
            <Settings className="h-4 w-4" />
            <span>转换器设置</span>
            {!showConverterSettings && (
              <Badge variant="secondary" className="text-xs ml-auto">
                点击查看
              </Badge>
            )}
          </div>
        </Button>

        {showConverterSettings && (
          <Card className="mt-3 card-modern">
            <CardContent className="py-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
                  <Label htmlFor="show-bit-length" className="cursor-pointer text-sm">
                    隐藏位长度
                  </Label>
                  <Switch id="show-bit-length" checked={showBitLength} onCheckedChange={setShowBitLength} />
                  <Label htmlFor="show-bit-length" className="cursor-pointer text-sm text-purple-600">
                    显示位长度
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
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* 输入卡片 */}
      <Card className="mb-6 card-modern">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Hash className="h-5 w-5 text-blue-600" />
            数字输入
            {realTimeConversion && (
              <Badge variant="secondary" className="text-xs">
                <Zap className="h-3 w-3 mr-1" />
                实时转换
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 输入数字 */}
            <div className="space-y-2">
              <Label htmlFor="inputNumber" className="text-sm font-medium">输入数字</Label>
              <Input
                id="inputNumber"
                value={inputNumber}
                onChange={(e) => setInputNumber(e.target.value)}
                className="h-12 text-lg font-mono"
                placeholder="输入要转换的数字..."
              />
            </div>

            {/* 输入进制 */}
            <div className="space-y-2">
              <Label htmlFor="inputBase" className="text-sm font-medium">输入进制 (2-64)</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="inputBase"
                  type="number"
                  min="2"
                  max="64"
                  value={inputBase}
                  onChange={(e) => setInputBase(Number.parseInt(e.target.value) || 2)}
                  className="w-20 h-10"
                />
                <Button variant="outline" size="icon" onClick={decrementBase} disabled={inputBase <= 2}>
                  <Minus className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" onClick={incrementBase} disabled={inputBase >= 64}>
                  <Plus className="h-4 w-4" />
                </Button>
                <Select value={inputBase.toString()} onValueChange={(value) => setInputBase(Number.parseInt(value))}>
                  <SelectTrigger className="w-32 h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BASE_PRESETS.map((preset) => (
                      <SelectItem key={preset.base} value={preset.base.toString()}>
                        {preset.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* 错误信息 */}
          {error && (
            <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <div className="text-sm text-red-600 dark:text-red-400">{error}</div>
            </div>
          )}

          {/* 进制快捷选择 */}
          <div className="mt-4">
            <Label className="text-sm font-medium mb-3 block">常用进制</Label>
            <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-9 gap-2">
              {BASE_PRESETS.map((preset) => (
                <Button
                  key={preset.base}
                  variant={inputBase === preset.base ? "default" : "outline"}
                  size="sm"
                  onClick={() => setInputBase(preset.base)}
                  className={`h-12 flex flex-col items-center gap-1 ${
                    inputBase === preset.base ? preset.color : ""
                  }`}
                >
                  <span className="text-xs font-mono">{preset.icon}</span>
                  <span className="text-xs">{preset.base}</span>
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 转换结果 */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="standard" className="flex items-center gap-2">
            <Binary className="h-4 w-4" />
            标准进制
          </TabsTrigger>
          <TabsTrigger value="extended" className="flex items-center gap-2">
            <Calculator className="h-4 w-4" />
            扩展进制
          </TabsTrigger>
        </TabsList>

        <TabsContent value="standard" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 二进制 */}
            <ResultCard
              title="二进制 (Base 2)"
              base={2}
              value={results.binary || ""}
              autoFormat={autoFormat}
              showBitLength={showBitLength}
              compactDisplay={compactDisplay}
              onCopy={handleCopy}
              copied={copied}
              color="text-green-600"
              icon={<Binary className="h-5 w-5" />}
            />

            {/* 八进制 */}
            <ResultCard
              title="八进制 (Base 8)"
              base={8}
              value={results.octal || ""}
              autoFormat={autoFormat}
              showBitLength={showBitLength}
              compactDisplay={compactDisplay}
              onCopy={handleCopy}
              copied={copied}
              color="text-blue-600"
              icon={<Hash className="h-5 w-5" />}
            />

            {/* 十进制 */}
            <ResultCard
              title="十进制 (Base 10)"
              base={10}
              value={results.decimal || ""}
              autoFormat={autoFormat}
              showBitLength={showBitLength}
              compactDisplay={compactDisplay}
              onCopy={handleCopy}
              copied={copied}
              color="text-purple-600"
              icon={<Calculator className="h-5 w-5" />}
            />

            {/* 十六进制 */}
            <ResultCard
              title="十六进制 (Base 16)"
              base={16}
              value={results.hexadecimal || ""}
              autoFormat={autoFormat}
              showBitLength={showBitLength}
              compactDisplay={compactDisplay}
              onCopy={handleCopy}
              copied={copied}
              color="text-orange-600"
              icon={<Hash className="h-5 w-5" />}
            />
          </div>
        </TabsContent>

        <TabsContent value="extended" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Base32 */}
            <ResultCard
              title="Base32 (Base 32)"
              base={32}
              value={results.base32 || ""}
              autoFormat={autoFormat}
              showBitLength={showBitLength}
              compactDisplay={compactDisplay}
              onCopy={handleCopy}
              copied={copied}
              color="text-pink-600"
              icon={<Hash className="h-5 w-5" />}
            />

            {/* Base36 */}
            <ResultCard
              title="Base36 (Base 36)"
              base={36}
              value={results.base36 || ""}
              autoFormat={autoFormat}
              showBitLength={showBitLength}
              compactDisplay={compactDisplay}
              onCopy={handleCopy}
              copied={copied}
              color="text-indigo-600"
              icon={<Hash className="h-5 w-5" />}
            />

            {/* Base58 */}
            <ResultCard
              title="Base58 (Base 58)"
              base={58}
              value={results.base58 || ""}
              autoFormat={autoFormat}
              showBitLength={showBitLength}
              compactDisplay={compactDisplay}
              onCopy={handleCopy}
              copied={copied}
              color="text-yellow-600"
              icon={<Hash className="h-5 w-5" />}
            />

            {/* Base62 */}
            <ResultCard
              title="Base62 (Base 62)"
              base={62}
              value={results.base62 || ""}
              autoFormat={autoFormat}
              showBitLength={showBitLength}
              compactDisplay={compactDisplay}
              onCopy={handleCopy}
              copied={copied}
              color="text-cyan-600"
              icon={<Hash className="h-5 w-5" />}
            />

            {/* Base64 */}
            <ResultCard
              title="Base64 (Base 64)"
              base={64}
              value={results.base64 || ""}
              autoFormat={autoFormat}
              showBitLength={showBitLength}
              compactDisplay={compactDisplay}
              onCopy={handleCopy}
              copied={copied}
              color="text-red-600"
              icon={<Hash className="h-5 w-5" />}
            />

            {/* 自定义进制 */}
            <Card className="card-modern">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Settings className="h-5 w-5 text-gray-600" />
                  自定义进制 (Base {customBase})
                  {autoFormat && (
                    <Badge variant="secondary" className="text-xs">
                      自动格式化
                    </Badge>
                  )}
                  <div className="flex items-center gap-2 ml-auto">
                    <Input
                      type="number"
                      min="2"
                      max="64"
                      value={customBase}
                      onChange={(e) => setCustomBase(Number.parseInt(e.target.value) || 2)}
                      className="w-16 h-8"
                    />
                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={decrementCustomBase} disabled={customBase <= 2}>
                      <Minus className="h-3 w-3" />
                    </Button>
                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={incrementCustomBase} disabled={customBase >= 64}>
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700">
                    <div className="font-mono text-lg break-all">
                      {autoFormat ? formatNumber(results.custom || "", customBase) : (results.custom || "")}
                    </div>
                    {!results.custom && (
                      <div className="text-sm text-gray-500 mt-2">转换结果将在此显示...</div>
                    )}
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <Button
                      variant="outline"
                      onClick={() => handleCopy(results.custom || "", `custom-${customBase}`)}
                      disabled={!results.custom}
                      className="flex-1 mr-2"
                    >
                      {copied[`custom-${customBase}`] ? (
                        <Check className="h-4 w-4 mr-2 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4 mr-2" />
                      )}
                      {copied[`custom-${customBase}`] ? "已复制" : "复制"}
                    </Button>
                    
                    {showBitLength && results.custom && (
                      <Badge variant="outline" className="ml-2">
                        {results.custom.length} 位
                      </Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

// Result card component
interface ResultCardProps {
  title: string
  base: number
  value: string
  autoFormat: boolean
  showBitLength: boolean
  compactDisplay: boolean
  onCopy: (text: string, key: string) => void
  copied: { [key: string]: boolean }
  color: string
  icon: React.ReactNode
}

function ResultCard({
  title,
  base,
  value,
  autoFormat,
  showBitLength,
  compactDisplay,
  onCopy,
  copied,
  color,
  icon,
}: ResultCardProps) {
  const displayValue = autoFormat ? formatNumber(value, base) : value
  const copyKey = `base-${base}`

  return (
    <Card className="card-modern">
      <CardHeader className="pb-3">
        <CardTitle className={`text-lg flex items-center gap-2 ${color}`}>
          {icon}
          {title}
          {autoFormat && (
            <Badge variant="secondary" className="text-xs">
              格式化
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {compactDisplay ? (
            <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg font-mono text-sm break-all">
              {displayValue || "转换结果将在此显示..."}
            </div>
          ) : (
            <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700">
              <div className="font-mono text-lg break-all">
                {displayValue || "转换结果将在此显示..."}
              </div>
              {value && base === 2 && value.length > 8 && (
                <div className="text-xs text-gray-500 mt-2">
                  {Math.ceil(value.length / 8)} 字节
                </div>
              )}
            </div>
          )}
          
          <div className="flex justify-between items-center">
            <Button
              variant="outline"
              onClick={() => onCopy(value, copyKey)}
              disabled={!value}
              className="flex-1 mr-2"
            >
              {copied[copyKey] ? (
                <Check className="h-4 w-4 mr-2 text-green-500" />
              ) : (
                <Copy className="h-4 w-4 mr-2" />
              )}
              {copied[copyKey] ? "已复制" : "复制"}
            </Button>
            
            {showBitLength && value && (
              <Badge variant="outline" className="ml-2">
                {value.length} 位
              </Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
