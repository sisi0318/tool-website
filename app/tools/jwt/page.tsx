"use client"

import type React from "react"
import { useState, useCallback, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { useTranslations } from "@/hooks/use-translations"
import { Copy, Check, AlertCircle, CheckCircle, Clock, Key } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface JWTPageProps {
  params?: {
    feature?: string
  }
}

interface DecodedJWT {
  header: Record<string, any> | null
  payload: Record<string, any> | null
  signature: string
  isValid: boolean
  error?: string
}

interface TokenClaims {
  exp?: number
  iat?: number
  nbf?: number
  iss?: string
  sub?: string
  aud?: string | string[]
  jti?: string
}

// Base64 URL 解码
function base64UrlDecode(str: string): string {
  try {
    // 替换 URL 安全字符
    let base64 = str.replace(/-/g, "+").replace(/_/g, "/")
    // 添加填充
    const padding = base64.length % 4
    if (padding) {
      base64 += "=".repeat(4 - padding)
    }
    // 解码
    return decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    )
  } catch {
    throw new Error("Invalid base64 string")
  }
}

// 解析 JWT
function decodeJWT(token: string): DecodedJWT {
  try {
    const parts = token.trim().split(".")
    
    if (parts.length !== 3) {
      return {
        header: null,
        payload: null,
        signature: "",
        isValid: false,
        error: "Invalid JWT format: must have 3 parts separated by dots",
      }
    }

    const [headerB64, payloadB64, signature] = parts

    let header: Record<string, any>
    let payload: Record<string, any>

    try {
      header = JSON.parse(base64UrlDecode(headerB64))
    } catch {
      return {
        header: null,
        payload: null,
        signature,
        isValid: false,
        error: "Invalid header: cannot decode base64 or parse JSON",
      }
    }

    try {
      payload = JSON.parse(base64UrlDecode(payloadB64))
    } catch {
      return {
        header,
        payload: null,
        signature,
        isValid: false,
        error: "Invalid payload: cannot decode base64 or parse JSON",
      }
    }

    return {
      header,
      payload,
      signature,
      isValid: true,
    }
  } catch (error) {
    return {
      header: null,
      payload: null,
      signature: "",
      isValid: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

// 格式化时间戳
function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp * 1000)
  return date.toLocaleString()
}

// 检查 Token 是否过期
function isTokenExpired(exp?: number): boolean {
  if (!exp) return false
  return Date.now() > exp * 1000
}

// 获取过期状态
function getExpiryStatus(exp?: number): { status: "valid" | "expired" | "none"; message: string } {
  if (!exp) {
    return { status: "none", message: "No expiration" }
  }
  
  const now = Date.now()
  const expMs = exp * 1000
  
  if (now > expMs) {
    const diff = now - expMs
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const days = Math.floor(hours / 24)
    if (days > 0) {
      return { status: "expired", message: `Expired ${days} day(s) ago` }
    }
    return { status: "expired", message: `Expired ${hours} hour(s) ago` }
  } else {
    const diff = expMs - now
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const days = Math.floor(hours / 24)
    if (days > 0) {
      return { status: "valid", message: `Expires in ${days} day(s)` }
    }
    return { status: "valid", message: `Expires in ${hours} hour(s)` }
  }
}

export default function JWTPage({ params }: JWTPageProps) {
  const t = useTranslations("jwt")

  const [token, setToken] = useState("")
  const [decoded, setDecoded] = useState<DecodedJWT | null>(null)
  const [copied, setCopied] = useState<{ [key: string]: boolean }>({})
  const [autoFormat, setAutoFormat] = useState(true)

  const copyTimeoutRef = useRef<{ [key: string]: NodeJS.Timeout | null }>({})

  // 自动解析
  useEffect(() => {
    if (token.trim()) {
      const result = decodeJWT(token)
      setDecoded(result)
    } else {
      setDecoded(null)
    }
  }, [token])

  // 复制到剪贴板
  const copyToClipboard = useCallback((text: string, key: string) => {
    navigator.clipboard.writeText(text).then(() => {
      if (copyTimeoutRef.current[key]) {
        clearTimeout(copyTimeoutRef.current[key]!)
      }

      setCopied((prev) => ({ ...prev, [key]: true }))

      copyTimeoutRef.current[key] = setTimeout(() => {
        setCopied((prev) => ({ ...prev, [key]: false }))
      }, 2000)
    })
  }, [])

  // 格式化 JSON
  const formatJSON = (obj: Record<string, any> | null): string => {
    if (!obj) return ""
    return autoFormat ? JSON.stringify(obj, null, 2) : JSON.stringify(obj)
  }

  // 清空
  const handleClear = () => {
    setToken("")
    setDecoded(null)
  }

  // 粘贴示例
  const pasteExample = () => {
    // 一个示例 JWT（已过期的测试 token）
    const exampleToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjE1MTYyNDI2MjJ9.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c"
    setToken(exampleToken)
  }

  const expiryStatus = decoded?.payload ? getExpiryStatus(decoded.payload.exp) : null

  return (
    <div className="container mx-auto px-4 py-4 max-w-4xl">
      <h2 className="text-2xl font-bold text-center mb-6">{t("title")}</h2>

      <div className="space-y-6">
        {/* 输入区域 */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="token">{t("inputLabel")}</Label>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={pasteExample}>
                {t("example")}
              </Button>
              <Button variant="ghost" size="sm" onClick={handleClear}>
                {t("clear")}
              </Button>
            </div>
          </div>
          <Textarea
            id="token"
            placeholder={t("inputPlaceholder")}
            value={token}
            onChange={(e) => setToken(e.target.value)}
            rows={4}
            className="font-mono text-sm"
          />
        </div>

        {/* 错误提示 */}
        {decoded && !decoded.isValid && (
          <div className="flex items-center gap-2 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300">
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            <span>{decoded.error}</span>
          </div>
        )}

        {/* 解析结果 */}
        {decoded && decoded.isValid && (
          <div className="space-y-4">
            {/* 状态指示器 */}
            <div className="flex flex-wrap gap-4">
              {/* 有效性 */}
              <div className="flex items-center gap-2 px-3 py-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                <span className="text-sm text-green-700 dark:text-green-300">{t("validFormat")}</span>
              </div>

              {/* 算法 */}
              {decoded.header?.alg && (
                <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <Key className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <span className="text-sm text-blue-700 dark:text-blue-300">
                    {t("algorithm")}: {decoded.header.alg}
                  </span>
                </div>
              )}

              {/* 过期状态 */}
              {expiryStatus && expiryStatus.status !== "none" && (
                <div
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${
                    expiryStatus.status === "expired"
                      ? "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
                      : "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"
                  }`}
                >
                  <Clock
                    className={`h-4 w-4 ${
                      expiryStatus.status === "expired"
                        ? "text-red-600 dark:text-red-400"
                        : "text-green-600 dark:text-green-400"
                    }`}
                  />
                  <span
                    className={`text-sm ${
                      expiryStatus.status === "expired"
                        ? "text-red-700 dark:text-red-300"
                        : "text-green-700 dark:text-green-300"
                    }`}
                  >
                    {expiryStatus.message}
                  </span>
                </div>
              )}
            </div>

            {/* 格式化选项 */}
            <div className="flex items-center gap-2">
              <Switch id="auto-format" checked={autoFormat} onCheckedChange={setAutoFormat} />
              <Label htmlFor="auto-format" className="cursor-pointer">
                {t("formatJson")}
              </Label>
            </div>

            {/* Tabs 显示 Header/Payload */}
            <Tabs defaultValue="payload" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="header">{t("header")}</TabsTrigger>
                <TabsTrigger value="payload">{t("payload")}</TabsTrigger>
                <TabsTrigger value="signature">{t("signature")}</TabsTrigger>
              </TabsList>

              <TabsContent value="header" className="space-y-2">
                <div className="relative">
                  <pre className="p-4 bg-gray-100 dark:bg-gray-800 rounded-lg overflow-x-auto text-sm font-mono">
                    {formatJSON(decoded.header)}
                  </pre>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute top-2 right-2"
                          onClick={() => copyToClipboard(formatJSON(decoded.header), "header")}
                        >
                          {copied["header"] ? (
                            <Check className="h-4 w-4 text-green-500" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{copied["header"] ? t("copied") : t("copy")}</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </TabsContent>

              <TabsContent value="payload" className="space-y-2">
                <div className="relative">
                  <pre className="p-4 bg-gray-100 dark:bg-gray-800 rounded-lg overflow-x-auto text-sm font-mono">
                    {formatJSON(decoded.payload)}
                  </pre>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute top-2 right-2"
                          onClick={() => copyToClipboard(formatJSON(decoded.payload), "payload")}
                        >
                          {copied["payload"] ? (
                            <Check className="h-4 w-4 text-green-500" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{copied["payload"] ? t("copied") : t("copy")}</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>

                {/* 常见 Claims 解释 */}
                {decoded.payload && (
                  <div className="space-y-2 mt-4">
                    <Label>{t("claims")}</Label>
                    <div className="grid gap-2">
                      {decoded.payload.iss && (
                        <div className="flex justify-between p-2 bg-gray-50 dark:bg-gray-800/50 rounded">
                          <span className="text-gray-600 dark:text-gray-400">iss (Issuer)</span>
                          <span className="font-mono">{decoded.payload.iss}</span>
                        </div>
                      )}
                      {decoded.payload.sub && (
                        <div className="flex justify-between p-2 bg-gray-50 dark:bg-gray-800/50 rounded">
                          <span className="text-gray-600 dark:text-gray-400">sub (Subject)</span>
                          <span className="font-mono">{decoded.payload.sub}</span>
                        </div>
                      )}
                      {decoded.payload.aud && (
                        <div className="flex justify-between p-2 bg-gray-50 dark:bg-gray-800/50 rounded">
                          <span className="text-gray-600 dark:text-gray-400">aud (Audience)</span>
                          <span className="font-mono">
                            {Array.isArray(decoded.payload.aud)
                              ? decoded.payload.aud.join(", ")
                              : decoded.payload.aud}
                          </span>
                        </div>
                      )}
                      {decoded.payload.exp && (
                        <div className="flex justify-between p-2 bg-gray-50 dark:bg-gray-800/50 rounded">
                          <span className="text-gray-600 dark:text-gray-400">exp (Expiration)</span>
                          <span className="font-mono">{formatTimestamp(decoded.payload.exp)}</span>
                        </div>
                      )}
                      {decoded.payload.iat && (
                        <div className="flex justify-between p-2 bg-gray-50 dark:bg-gray-800/50 rounded">
                          <span className="text-gray-600 dark:text-gray-400">iat (Issued At)</span>
                          <span className="font-mono">{formatTimestamp(decoded.payload.iat)}</span>
                        </div>
                      )}
                      {decoded.payload.nbf && (
                        <div className="flex justify-between p-2 bg-gray-50 dark:bg-gray-800/50 rounded">
                          <span className="text-gray-600 dark:text-gray-400">nbf (Not Before)</span>
                          <span className="font-mono">{formatTimestamp(decoded.payload.nbf)}</span>
                        </div>
                      )}
                      {decoded.payload.jti && (
                        <div className="flex justify-between p-2 bg-gray-50 dark:bg-gray-800/50 rounded">
                          <span className="text-gray-600 dark:text-gray-400">jti (JWT ID)</span>
                          <span className="font-mono">{decoded.payload.jti}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="signature" className="space-y-2">
                <div className="relative">
                  <pre className="p-4 bg-gray-100 dark:bg-gray-800 rounded-lg overflow-x-auto text-sm font-mono break-all">
                    {decoded.signature}
                  </pre>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute top-2 right-2"
                          onClick={() => copyToClipboard(decoded.signature, "signature")}
                        >
                          {copied["signature"] ? (
                            <Check className="h-4 w-4 text-green-500" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{copied["signature"] ? t("copied") : t("copy")}</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {t("signatureNote")}
                </p>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </div>
    </div>
  )
}
