"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { useTranslations } from "@/hooks/use-translations"
import { createHmac } from "crypto"
import { SHA3 } from "sha3"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { 
  Copy, 
  Check, 
  Upload, 
  FileText, 
  X, 
  Key,
  ArrowLeftRight,
  ArrowRight,
  ArrowLeft,
  Settings,
  Zap,
  RefreshCw,
  ChevronUp,
  ChevronDown,
  AlertTriangle,
  Trash2,
  Shuffle,

} from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Alert, AlertDescription } from "@/components/ui/alert"

// 添加参数接口
interface HmacPageProps {
  params?: {
    feature?: string
  }
}

// 哈希结果类型
interface HmacResult {
  algorithm: string
  displayName: string
  value: string
  status?: "pending" | "calculating" | "completed" | "error"
}

// 文件信息类型
interface FileInfo {
  file: File
  name: string
  size: number
  sizeFormatted: string
}

// 验证结果类型
interface VerifyResultType {
  isMatch: boolean
  matchedAlgorithm?: string
}

// 格式化文件大小
function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes"

  const k = 1024
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
}

// 最大文件大小 (100MB)
const MAX_FILE_SIZE = 100 * 1024 * 1024

// HMAC支持的哈希算法
const hmacAlgorithms = [
  { id: "md5", name: "MD5" },
  { id: "sha1", name: "SHA1" },
  { id: "sha224", name: "SHA224" },
  { id: "sha256", name: "SHA256" },
  { id: "sha384", name: "SHA384" },
  { id: "sha512", name: "SHA512" },
  { id: "sha3-224", name: "SHA3-224" },
  { id: "sha3-256", name: "SHA3-256" },
  { id: "sha3-384", name: "SHA3-384" },
  { id: "sha3-512", name: "SHA3-512" },
  { id: "ripemd160", name: "RIPEMD160" },
]

export default function HmacPage({ params }: HmacPageProps) {
  const t = useTranslations("hmac")

  // 基础状态
  const [algorithm, setAlgorithm] = useState("sha256")
  const [showBatchMode, setShowBatchMode] = useState(false)
  const [showHmacInfo, setShowHmacInfo] = useState(false)
  
  // 实时计算状态
  const [leftInput, setLeftInput] = useState("")
  const [rightInput, setRightInput] = useState("")
  const [leftType, setLeftType] = useState<"data" | "hmac">("data")
  const [autoMode, setAutoMode] = useState(true)
  const [autoSwitch, setAutoSwitch] = useState(true)
  const [leftInputLength, setLeftInputLength] = useState(0)
  const [rightInputLength, setRightInputLength] = useState(0)

  // 密钥和验证
  const [hmacKey, setHmacKey] = useState("")
  const [keyFormat, setKeyFormat] = useState("raw")

  const [verifyHash, setVerifyHash] = useState("")
  const [verifyResult, setVerifyResult] = useState<VerifyResultType | null>(null)
  const [outputFormat, setOutputFormat] = useState("hex")

  // 通用状态
  const [copied, setCopied] = useState<{ [key: string]: boolean }>({})
  const [error, setError] = useState<{ left?: string; right?: string; batch?: string }>({})

  const copyTimeoutRef = useRef<{ [key: string]: NodeJS.Timeout | null }>({})

  // 统一HMAC计算函数
  const calculateHmacValue = (data: string, key: string, algorithmId: string): string => {
    if (!data || !key) return ""

    try {
      let keyBuffer: Buffer

      // 处理密钥格式
      if (keyFormat === "hex") {
        keyBuffer = Buffer.from(key, "hex")
      } else if (keyFormat === "base64") {
        keyBuffer = Buffer.from(key, "base64")
      } else {
        keyBuffer = Buffer.from(key)
      }

      let result = ""

      // 处理SHA3算法
      if (algorithmId.startsWith("sha3-")) {
        const sizeStr = algorithmId.split("-")[1]
        const size = Number.parseInt(sizeStr) as 224 | 256 | 384 | 512
        const blockSize = 136 // SHA3-256的块大小

        // 如果密钥长度大于块大小，先哈希密钥
        let processedKey = keyBuffer
        if (processedKey.length > blockSize) {
          const keyHash = new SHA3(size)
          keyHash.update(processedKey)
          processedKey = Buffer.from(keyHash.digest())
        }

        // 填充密钥到块大小
        if (processedKey.length < blockSize) {
          const paddedKey = Buffer.alloc(blockSize)
          processedKey.copy(paddedKey)
          processedKey = paddedKey
        }

        // 创建内外填充
        const outerPadding = Buffer.alloc(blockSize, 0x5c)
        const innerPadding = Buffer.alloc(blockSize, 0x36)

        // 计算内外密钥
        const outerKey = Buffer.alloc(blockSize)
        const innerKey = Buffer.alloc(blockSize)

        for (let i = 0; i < blockSize; i++) {
          outerKey[i] = processedKey[i] ^ outerPadding[i]
          innerKey[i] = processedKey[i] ^ innerPadding[i]
        }

        // 计算内部哈希
        const innerHash = new SHA3(size)
        innerHash.update(innerKey)
        innerHash.update(data)
        const innerDigest = innerHash.digest()

        // 计算外部哈希
        const outerHash = new SHA3(size)
        outerHash.update(outerKey)
        outerHash.update(innerDigest)

        result = outputFormat === "hex" ? outerHash.digest("hex") : outerHash.digest("base64")
      } else {
        // 使用Node.js的createHmac
        const hmac = createHmac(algorithmId, keyBuffer)
        hmac.update(data)
        result = outputFormat === "hex" ? hmac.digest("hex") : hmac.digest("base64")
      }

      return result
    } catch (error) {
      throw new Error(`HMAC计算失败: ${error instanceof Error ? error.message : '未知错误'}`)
    }
  }

  // 实时转换处理
  const performTransform = (fromText: string, fromType: "data" | "hmac", toType: "data" | "hmac") => {
    if (!fromText || !hmacKey) {
      return ""
    }

    try {
      if (fromType === "data" && toType === "hmac") {
        return calculateHmacValue(fromText, hmacKey, algorithm)
      }
      // HMAC到数据的逆转换通常不可行，因为HMAC是单向函数
      return fromText
    } catch (error) {
      throw error
    }
  }

  // 左侧输入变化处理
  const handleLeftInputChange = (value: string) => {
    setLeftInput(value)
    setLeftInputLength(value.length)
    setError(prev => ({ ...prev, left: undefined }))

    if (autoMode && value && hmacKey) {
      try {
        const rightType: "data" | "hmac" = leftType === "data" ? "hmac" : "data"
        const result = performTransform(value, leftType, rightType)
        setRightInput(result)
        setRightInputLength(result.length)
      } catch (error) {
        setError(prev => ({ ...prev, left: error instanceof Error ? error.message : "转换失败" }))
      }
    }
  }

  // 右侧输入变化处理
  const handleRightInputChange = (value: string) => {
    setRightInput(value)
    setRightInputLength(value.length)
    setError(prev => ({ ...prev, right: undefined }))
    // HMAC是单向函数，不支持逆向计算
  }

  // 手动转换
  const transformLeftToRight = () => {
    if (!leftInput || !hmacKey) return

    try {
      const rightType: "data" | "hmac" = leftType === "data" ? "hmac" : "data"
      const result = performTransform(leftInput, leftType, rightType)
      setRightInput(result)
      setRightInputLength(result.length)
      setError(prev => ({ ...prev, left: undefined, right: undefined }))
    } catch (error) {
      setError(prev => ({ ...prev, left: error instanceof Error ? error.message : "转换失败" }))
    }
  }

  const transformRightToLeft = () => {
    // HMAC是单向函数，不支持逆向计算
    setError(prev => ({ ...prev, right: "HMAC是单向函数，无法逆向计算原始数据" }))
  }

  // 交换输入内容
  const swapInputs = () => {
    const tempInput = leftInput
    const tempLength = leftInputLength
    
    setLeftInput(rightInput)
    setLeftInputLength(rightInputLength)
    setRightInput(tempInput)
    setRightInputLength(tempLength)
    
    // 交换类型
    setLeftType(leftType === "data" ? "hmac" : "data")
  }

  // 清空所有内容
  const clearAllInputs = () => {
    setLeftInput("")
    setRightInput("")
    setLeftInputLength(0)
    setRightInputLength(0)
    setError({})
  }



  // 分析密钥强度
  const analyzeKeyStrength = (key: string) => {
    if (!key) return { strength: "无", score: 0, advice: "请输入密钥" }

    let score = 0
    const length = key.length

    // 长度评分
    if (length >= 32) score += 40
    else if (length >= 16) score += 30
    else if (length >= 8) score += 20
    else score += 10

    // 复杂度评分
    const hasLower = /[a-z]/.test(key)
    const hasUpper = /[A-Z]/.test(key)
    const hasNumber = /[0-9]/.test(key)
    const hasSpecial = /[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(key)

    if (hasLower) score += 10
    if (hasUpper) score += 10
    if (hasNumber) score += 10
    if (hasSpecial) score += 20

    // 熵评分
    const uniqueChars = new Set(key).size
    if (uniqueChars >= length * 0.8) score += 10
    else if (uniqueChars >= length * 0.6) score += 5

    let strength = ""
    let advice = ""

    if (score >= 80) {
      strength = "强"
      advice = "密钥强度很好"
    } else if (score >= 60) {
      strength = "中等"
      advice = "建议增加密钥长度或复杂度"
    } else if (score >= 40) {
      strength = "弱"
      advice = "密钥较弱，建议使用更长更复杂的密钥"
    } else {
      strength = "很弱"
      advice = "密钥过于简单，存在安全风险"
    }

    return { strength, score, advice }
  }

  // 生成随机密钥
  const generateRandomKey = () => {
    const length = 32 // 256位
    const array = new Uint8Array(length)
    crypto.getRandomValues(array)

    if (keyFormat === "hex") {
      setHmacKey(
        Array.from(array)
          .map((b) => b.toString(16).padStart(2, "0"))
          .join(""),
      )
    } else if (keyFormat === "base64") {
      setHmacKey(btoa(String.fromCharCode.apply(null, Array.from(array))))
    } else {
      // 生成可打印字符的随机字符串
      const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,./<>?"
      let result = ""
      for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length))
      }
      setHmacKey(result)
    }
  }

  // 复制到剪贴板
  const copyToClipboard = (text: string, key: string = "main") => {
    if (!text) return

    navigator.clipboard.writeText(text).then(() => {
      // 清除之前的超时
      if (copyTimeoutRef.current[key]) {
        clearTimeout(copyTimeoutRef.current[key]!)
      }

      setCopied(prev => ({ ...prev, [key]: true }))

      // 设置新的超时
      copyTimeoutRef.current[key] = setTimeout(() => {
        setCopied(prev => ({ ...prev, [key]: false }))
      }, 2000)
    })
  }

  // 验证HMAC值
  const verifyHmacValue = (result: string = rightInput) => {
    if (!verifyHash) {
      setVerifyResult(null)
      return
    }

    const normalizedVerifyHash = verifyHash.trim().toLowerCase()
    
    if (result) {
      const isMatch = result.toLowerCase() === normalizedVerifyHash
      const currentAlgo = hmacAlgorithms.find((algo) => algo.id === algorithm)
      setVerifyResult({
        isMatch,
        matchedAlgorithm: isMatch ? currentAlgo?.name : undefined,
      })
    } else {
      setVerifyResult(null)
    }
  }

  // 自动切换效果
  useEffect(() => {
    if (autoSwitch && leftInput && hmacKey) {
      try {
        const rightType: "data" | "hmac" = leftType === "data" ? "hmac" : "data"
        const result = performTransform(leftInput, leftType, rightType)
        setRightInput(result)
        setRightInputLength(result.length)
      } catch (error) {
        // 自动切换时忽略错误
      }
    }
  }, [algorithm, hmacKey, keyFormat, outputFormat, autoSwitch])

  // 当验证哈希变化时，验证HMAC
  useEffect(() => {
    if (verifyHash) {
      if (rightInput) {
        verifyHmacValue()
      } else {
        setVerifyResult(null)
      }
    } else {
      setVerifyResult(null)
    }
  }, [verifyHash, rightInput])

  return (
    <div className="container mx-auto px-4 py-4 max-w-6xl">
      {/* 页面标题 */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-200 mb-4">
          HMAC计算器
        </h1>
      </div>

      {/* 新界面：实时计算 */}
      {!showBatchMode && (
        <>
          {/* HMAC算法选择 */}
          <div className="mb-6">
            <Tabs value={algorithm} onValueChange={setAlgorithm} className="w-full">
              <TabsList className="grid grid-cols-3 md:grid-cols-6 lg:grid-cols-11 gap-1 w-full bg-gray-100 dark:bg-gray-800 p-1 h-auto flex-wrap justify-center">
                {hmacAlgorithms.map((algo) => (
                  <TabsTrigger
                    key={algo.id}
                    value={algo.id}
                    className="text-xs px-2 py-1.5 whitespace-nowrap data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 data-[state=active]:shadow-sm min-w-0 flex-shrink-0"
                  >
                    {algo.name}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>

            {/* 工作模式设置折叠区域 */}
            <div className="mt-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowHmacInfo(!showHmacInfo)}
                className="w-full text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
              >
                <div className="flex items-center gap-2">
                  {showHmacInfo ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                  <Settings className="h-4 w-4" />
                  <span>工作模式设置</span>
                  {!showHmacInfo && (
                    <Badge variant="secondary" className="text-xs ml-auto">
                      点击查看
                    </Badge>
                  )}
                </div>
              </Button>

              {showHmacInfo && (
                <Card className="mt-3 card-modern">
                  <CardContent className="py-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="flex items-center space-x-2 bg-gray-100 dark:bg-gray-800 p-3 rounded-lg">
                        <Label htmlFor="auto-mode" className="cursor-pointer text-sm">
                          手动模式
                        </Label>
                        <Switch id="auto-mode" checked={autoMode} onCheckedChange={setAutoMode} />
                        <Label htmlFor="auto-mode" className="cursor-pointer text-sm text-blue-600">
                          实时计算
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2 bg-gray-100 dark:bg-gray-800 p-3 rounded-lg">
                        <Label htmlFor="auto-switch" className="cursor-pointer text-sm">
                          手动切换
                        </Label>
                        <Switch id="auto-switch" checked={autoSwitch} onCheckedChange={setAutoSwitch} />
                        <Label htmlFor="auto-switch" className="cursor-pointer text-sm text-green-600">
                          智能切换
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2 bg-gray-100 dark:bg-gray-800 p-3 rounded-lg">
                        <Label htmlFor="legacy-mode" className="cursor-pointer text-sm">
                          新界面
                        </Label>
                        <Switch id="legacy-mode" checked={showBatchMode} onCheckedChange={setShowBatchMode} />
                        <Label htmlFor="legacy-mode" className="cursor-pointer text-sm">
                          批量模式
                        </Label>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>

          {/* 密钥管理 */}
          <Card className="mb-6 card-modern">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Key className="h-4 w-4 text-purple-600" />
                密钥管理
                {hmacKey && (
                  <Badge 
                    variant={analyzeKeyStrength(hmacKey).strength === "强" ? "default" : 
                            analyzeKeyStrength(hmacKey).strength === "中等" ? "secondary" : "destructive"}
                    className="text-xs ml-auto"
                  >
                    强度: {analyzeKeyStrength(hmacKey).strength}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* 密钥输入 */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label htmlFor="hmac-key" className="text-sm">密钥</Label>
                    <div className="flex items-center gap-2">
                      <Select value={keyFormat} onValueChange={setKeyFormat}>
                        <SelectTrigger className="w-24 h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="raw">Raw</SelectItem>
                          <SelectItem value="hex">HEX</SelectItem>
                          <SelectItem value="base64">Base64</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button variant="outline" size="sm" onClick={generateRandomKey}>
                        <Shuffle className="h-3 w-3 mr-1" />
                        生成
                      </Button>
                    </div>
                  </div>
                  <div className="relative">
                    <Input
                      id="hmac-key"
                      type="text"
                      value={hmacKey}
                      onChange={(e) => setHmacKey(e.target.value)}
                      placeholder="输入或生成HMAC密钥..."
                      className="pr-10"
                    />
                    <Key className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  </div>
                </div>

                {/* 密钥强度分析 */}
                {hmacKey && (
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-600">密钥强度</span>
                      <span className={`font-medium ${
                        analyzeKeyStrength(hmacKey).strength === "强" ? "text-green-600" :
                        analyzeKeyStrength(hmacKey).strength === "中等" ? "text-yellow-600" : 
                        "text-red-600"
                      }`}>
                        {analyzeKeyStrength(hmacKey).strength} ({analyzeKeyStrength(hmacKey).score}/100)
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full transition-all ${
                          analyzeKeyStrength(hmacKey).strength === "强" ? "bg-green-600" :
                          analyzeKeyStrength(hmacKey).strength === "中等" ? "bg-yellow-600" : 
                          "bg-red-600"
                        }`}
                        style={{ width: `${analyzeKeyStrength(hmacKey).score}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-500">{analyzeKeyStrength(hmacKey).advice}</p>
                  </div>
                )}

                {/* 输出格式 */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="output-format" className="text-sm">输出格式</Label>
                    <Select value={outputFormat} onValueChange={setOutputFormat}>
                      <SelectTrigger id="output-format" className="h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="hex">HEX (十六进制)</SelectItem>
                        <SelectItem value="base64">Base64</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 主计算区域 */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            {/* 左侧输入 */}
            <Card className="card-modern">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${leftType === "data" ? "bg-green-500" : "bg-blue-500"}`} />
                  {leftType === "data" ? "数据输入" : "HMAC输入"}
                  <Badge variant="outline" className="text-xs ml-auto">
                    {leftInputLength} 字符
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={leftInput}
                  onChange={(e) => handleLeftInputChange(e.target.value)}
                  placeholder={leftType === "data" ? "输入要计算HMAC的数据..." : "输入HMAC值进行验证..."}
                  rows={8}
                  className="font-mono text-sm resize-none"
                />
                {error.left && (
                  <div className="text-red-500 text-sm mt-2 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    {error.left}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 中间控制区域 */}
            <div className="flex lg:flex-col items-center justify-center gap-4">
              {/* 手动计算按钮 */}
              {!autoMode && (
                <div className="flex lg:flex-col gap-2">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          onClick={transformLeftToRight}
                          disabled={!leftInput || !hmacKey}
                          variant="outline"
                          size="sm"
                          className="p-2"
                        >
                          <ArrowRight className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        计算HMAC
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>

                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          onClick={transformRightToLeft}
                          disabled={true}
                          variant="outline"
                          size="sm"
                          className="p-2 opacity-50"
                        >
                          <ArrowLeft className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        HMAC不可逆
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              )}

              {/* 算法类型指示 */}
              <div className="text-center">
                <Badge variant="secondary" className="text-xs">
                  {hmacAlgorithms.find(a => a.id === algorithm)?.name}
                </Badge>
                <div className="flex flex-col items-center gap-1 mt-2">
                  {autoMode && (
                    <div className="flex items-center gap-1 text-xs text-green-600">
                      <Zap className="h-3 w-3" />
                      实时计算
                    </div>
                  )}
                  {autoSwitch && (
                    <div className="flex items-center gap-1 text-xs text-blue-600">
                      <RefreshCw className="h-3 w-3" />
                      智能切换
                    </div>
                  )}
                </div>
              </div>

              {/* 交换和清空按钮 */}
              <div className="flex lg:flex-col gap-2">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        onClick={swapInputs}
                        variant="outline"
                        size="sm"
                        className="p-2"
                      >
                        <ArrowLeftRight className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>交换内容</TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        onClick={clearAllInputs}
                        variant="outline"
                        size="sm"
                        className="text-red-500 hover:text-red-700 p-2"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>清空所有</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>

            {/* 右侧输出 */}
            <Card className="card-modern">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${leftType === "data" ? "bg-blue-500" : "bg-green-500"}`} />
                  {leftType === "data" ? "HMAC输出" : "验证结果"}
                  <Badge variant="outline" className="text-xs ml-auto">
                    {rightInputLength} 字符
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="relative">
                  <Textarea
                    value={rightInput}
                    onChange={(e) => handleRightInputChange(e.target.value)}
                    placeholder={leftType === "data" ? "HMAC计算结果将在这里显示..." : "验证结果将在这里显示..."}
                    rows={8}
                    className="font-mono text-sm resize-none pr-10"
                  />
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          onClick={() => copyToClipboard(rightInput, "right")}
                          disabled={!rightInput}
                          variant="ghost"
                          size="sm"
                          className="absolute top-2 right-2 p-1 h-6 w-6"
                        >
                          {copied.right ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>复制结果</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                {error.right && (
                  <div className="text-red-500 text-sm mt-2 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    {error.right}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* HMAC验证区域 */}
          <Card className="mb-6 card-modern">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Key className="h-4 w-4 text-green-600" />
                HMAC验证
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <Label htmlFor="verify-hash" className="text-sm">输入要验证的HMAC值</Label>
                <div className="flex space-x-2">
                  <Input
                    id="verify-hash"
                    placeholder="输入HMAC值进行验证..."
                    value={verifyHash}
                    onChange={(e) => setVerifyHash(e.target.value)}
                    className={`flex-1 font-mono ${
                      verifyResult === null
                        ? ""
                        : verifyResult.isMatch
                          ? "border-green-500 focus:border-green-500 focus:ring-green-500"
                          : "border-red-500 focus:border-red-500 focus:ring-red-500"
                    }`}
                  />
                  {verifyResult !== null && (
                    <div
                      className={`flex items-center px-3 rounded-md ${
                        verifyResult.isMatch
                          ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                          : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                      }`}
                    >
                      {verifyResult.isMatch ? `✓ 验证通过 (${verifyResult.matchedAlgorithm})` : "✗ 验证失败"}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>


        </>
      )}

      {/* 批量模式 - 暂时保留简化版本 */}
      {showBatchMode && (
        <div className="text-center p-8">
          <p className="text-gray-500">批量模式正在重构中...</p>
        </div>
      )}
    </div>
  )
}