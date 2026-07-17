"use client"

import { Card, CardContent, CardTitle, CardHeader } from "@/components/ui/card"
import type React from "react"

import { useState, useRef, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { JsonTreeView } from "@/components/json-tree-view"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useTranslations } from "@/hooks/use-translations"
import {
  Copy, Check, Plus, Trash2, Send, FileJson, Code, Database, Binary, X, ExternalLink,
  Globe, Settings, Clock, History, Bookmark, Download, Upload, Zap,
  AlertCircle, CheckCircle2, Loader2
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  HttpRequestUrlError,
  buildRequestUrl,
  encodeUrlEncodedBody,
  parseCurlCommand,
} from "@/lib/http-request-tools"
import { copyTextToClipboard } from "@/lib/clipboard"
import { FILE_SIZE_LIMITS, isFileWithinLimit } from "@/lib/file-limits"

interface RequestParam {
  id: string
  name: string
  value: string
  type: string
  enabled: boolean
  file?: File
}

interface ResponseHeader {
  name: string
  value: string
}

interface RequestHistory {
  id: string
  timestamp: number
  method: string
  url: string
  headers: Record<string, string>
  params: RequestParam[]
  body: string
  bodyType: string
  response?: string
  status?: number
  duration?: number
  formDataParams?: RequestParam[]
  binaryFile?: File | null
}

interface RequestTemplate {
  id: string
  name: string
  method: string
  url: string
  headers: RequestParam[]
  params: RequestParam[]
  body: string
  bodyType: string
  formDataParams: RequestParam[]
  binaryFile: File | null
}

async function proxyRequest(
  url: string,
  method: string,
  headers: Record<string, string>,
  params: RequestParam[],
  body: string | FormData | Blob | null,
  bodyType: string,
  signal?: AbortSignal,
) {
  const proxyUrl = "https://web-proxy.apifox.cn/api/v1/request"

  const finalUrl = buildRequestUrl(url, params)
  const targetUrl = new URL(finalUrl)

  // Build custom headers string for api-h0
  const customHeadersArray = Object.entries(headers).map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
  const defaultHeaders = [
    `User-Agent=Apifox/1.0.0 (https://apifox.com)`,
    `Accept=*/*`,
    `Host=${targetUrl.host}`,
    `Accept-Encoding=gzip%2C deflate%2C br`,
    `Connection=keep-alive`,
  ]

  const apiH0 = [...defaultHeaders, ...customHeadersArray].join(", ")

  // Prepare api-o0 and api-u headers
  const apiO0 = `method=${method},timings=true,timeout=300000,rejectUnauthorized=true,followRedirect=true`
  const apiU = finalUrl

  const requestHeaders: Record<string, string> = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0",
    "accept-language": "zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6",
    "api-h0": apiH0,
    "api-o0": apiO0,
    "api-u": apiU,
  }

  // Set Content-Type based on body type
  if (body instanceof FormData) {
    // Let browser set Content-Type for FormData
  } else if (body instanceof Blob) {
    requestHeaders["Content-Type"] = "application/octet-stream"
  } else if (bodyType === "urlencoded") {
    requestHeaders["Content-Type"] = "application/x-www-form-urlencoded"
  } else {
    requestHeaders["Content-Type"] = headers["Content-Type"] || "text/plain"
  }

  const requestOptions: RequestInit = {
    method: "POST",
    headers: requestHeaders,
    body: body || null,
    signal,
  }

  const res = await fetch(proxyUrl, requestOptions)

  // Extract response headers
  const responseHeaders: Record<string, string> = {}
  const apiH0Response = res.headers.get("api-h0") || ""
  const apiO0Response = res.headers.get("api-o0") || ""

  responseHeaders["api-h0"] = apiH0Response

  const responseText = await res.text()

  return {
    text: responseText,
    headers: responseHeaders,
    apiO0: apiO0Response,
    status: res.status,
    statusText: res.statusText,
  }
}

function parseHeaderString(headerString: string): ResponseHeader[] {
  if (!headerString) return []

  // Split by commas, but handle cases where values might contain commas
  const parts = headerString.split(", ")
  const headers: ResponseHeader[] = []

  for (const part of parts) {
    const equalIndex = part.indexOf("=")
    if (equalIndex > 0) {
      const name = part.substring(0, equalIndex)
      const value = part.substring(equalIndex + 1)
      headers.push({
        name,
        value: decodeURIComponent(value),
      })
    }
  }

  return headers
}

// Function to format JSON response
function formatJsonResponse(text: string): string {
  try {
    const parsed = JSON.parse(text)
    return JSON.stringify(parsed, null, 2)
  } catch (e) {
    return text
  }
}

function quoteShellArgument(value: string): string {
  return `'${value.replaceAll("'", `'\"'\"'`)}'`
}

function getHttpErrorMessage(error: unknown, translate: (key: string) => string): string {
  if (error instanceof HttpRequestUrlError) {
    return translate(error.code === "INVALID_URL" ? "invalidUrlDescription" : "unsupportedProtocol")
  }
  if (error instanceof Error && error.message) return error.message
  return translate("unknownError")
}

// Function to get status color
function getStatusColor(status: number): string {
  if (status >= 200 && status < 300) {
    return "bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)]"
  }
  if (status >= 300 && status < 400) {
    return "bg-[var(--md-sys-color-tertiary)] text-[var(--md-sys-color-on-tertiary)]"
  }
  if (status >= 400 && status < 500) {
    return "bg-[var(--md-sys-color-tertiary-container)] text-[var(--md-sys-color-on-tertiary-container)]"
  }
  if (status >= 500) {
    return "bg-[var(--md-sys-color-error)] text-[var(--md-sys-color-on-error)]"
  }
  return "bg-[var(--md-sys-color-surface-container-high)] text-[var(--md-sys-color-on-surface)]"
}

export default function HTTPTester() {
  const t = useTranslations("httpTester")
  const { toast } = useToast()

  // 基本请求状态
  const [url, setUrl] = useState("https://example.com")
  const [method, setMethod] = useState("GET")
  const [requestParams, setRequestParams] = useState<RequestParam[]>([
    { id: "1", name: "", value: "", type: "String", enabled: true },
  ])
  const [customHeaders, setCustomHeaders] = useState<RequestParam[]>([])
  const [formDataParams, setFormDataParams] = useState<RequestParam[]>([
    { id: "1", name: "", value: "", type: "String", enabled: true },
  ])
  const [bodyType, setBodyType] = useState<"none" | "raw" | "form-data" | "urlencoded" | "binary">("none")
  const [binaryFile, setBinaryFile] = useState<File | null>(null)
  const [body, setBody] = useState("")

  // 响应状态
  const [responseHeaders, setResponseHeaders] = useState<Record<string, ResponseHeader[]>>({})
  const [timings, setTimings] = useState<Record<string, string>>({})
  const [statusInfo, setStatusInfo] = useState<Record<string, string>>({})
  const [response, setResponse] = useState("")
  const [formattedResponse, setFormattedResponse] = useState("")
  const [isJsonResponse, setIsJsonResponse] = useState(false)

  // UI状态
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [activeTab, setActiveTab] = useState("params")
  const [responseTab, setResponseTab] = useState("response")

  // 新功能状态
  const [history, setHistory] = useState<RequestHistory[]>([])
  const [environmentVariables, setEnvironmentVariables] = useState<RequestParam[]>([
    { id: "env_1", name: "", value: "", type: "String", enabled: true },
  ])
  const [templates, setTemplates] = useState<RequestTemplate[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false)
  const [templateName, setTemplateName] = useState("")
  const [curlDialogOpen, setCurlDialogOpen] = useState(false)
  const [curlInput, setCurlInput] = useState("")

  // ID计数器
  const nextParamId = useRef(2)
  const nextHeaderId = useRef(2)
  const nextFormDataId = useRef(2)
  const nextEnvironmentVariableId = useRef(2)

  const binaryInputRef = useRef<HTMLInputElement>(null)
  const abortController = useRef<AbortController | null>(null)
  const copyResetTimerRef = useRef<number | null>(null)

  // 环境变量处理
  const replaceEnvironmentVariables = useCallback((text: string) => {
    let result = text
    environmentVariables.forEach((variable) => {
      if (!variable.enabled || !variable.name.trim()) return
      result = result.split(`{{${variable.name.trim()}}}`).join(variable.value)
    })
    return result
  }, [environmentVariables])

  const addEnvironmentVariable = () => {
    setEnvironmentVariables((variables) => [
      ...variables,
      {
        id: `env_${nextEnvironmentVariableId.current++}`,
        name: "",
        value: "",
        type: "String",
        enabled: true,
      },
    ])
  }

  const updateEnvironmentVariable = (id: string, field: keyof RequestParam, value: string | boolean) => {
    setEnvironmentVariables((variables) =>
      variables.map((variable) => (variable.id === id ? { ...variable, [field]: value } : variable)),
    )
  }

  const removeEnvironmentVariable = (id: string) => {
    setEnvironmentVariables((variables) => variables.filter((variable) => variable.id !== id))
  }

  // 保存到历史记录
  const saveToHistory = useCallback((requestData: Omit<RequestHistory, 'id' | 'timestamp'>) => {
    const historyItem: RequestHistory = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      ...requestData
    }
    setHistory(prev => [historyItem, ...prev].slice(0, 50)) // 保留最近50条记录
  }, [])

  // 从历史记录加载请求
  const loadFromHistory = useCallback((historyItem: RequestHistory) => {
    setMethod(historyItem.method)
    setUrl(historyItem.url)
    setRequestParams(historyItem.params)
    setCustomHeaders(Object.entries(historyItem.headers).map(([name, value], index) => ({
      id: `header_${index}`,
      name,
      value,
      type: "String",
      enabled: true
    })))
    setBody(historyItem.body)
    setBodyType(historyItem.bodyType as any)
    if (historyItem.formDataParams) {
      setFormDataParams(historyItem.formDataParams)
    }
    setBinaryFile(historyItem.binaryFile ?? null)

    toast({
      title: t("historyLoaded"),
      description: `${historyItem.method} ${historyItem.url}`
    })
  }, [t, toast])

  // 保存为模板
  const saveAsTemplate = useCallback(() => {
    setTemplateName("")
    setTemplateDialogOpen(true)
  }, [])

  const confirmSaveTemplate = useCallback(() => {
    const normalizedName = templateName.trim()
    if (!normalizedName) return

    const template: RequestTemplate = {
      id: crypto.randomUUID(),
      name: normalizedName,
      method,
      url,
      headers: customHeaders,
      params: requestParams,
      body,
      bodyType,
      formDataParams,
      binaryFile,
    }

    setTemplates(prev => [...prev, template])
    setTemplateDialogOpen(false)
    setTemplateName("")
    toast({
      title: t("templateSaved"),
      description: normalizedName
    })
  }, [templateName, method, url, customHeaders, requestParams, body, bodyType, formDataParams, binaryFile, t, toast])

  // 从模板加载请求
  const loadFromTemplate = useCallback((template: RequestTemplate) => {
    setMethod(template.method)
    setUrl(template.url)
    setRequestParams(template.params)
    setCustomHeaders(template.headers)
    setBody(template.body)
    setBodyType(template.bodyType as any)
    setFormDataParams(template.formDataParams)
    setBinaryFile(template.binaryFile)

    toast({
      title: t("templateLoaded"),
      description: template.name
    })
  }, [t, toast])

  // 生成 cURL 命令
  const generateCurl = useCallback(() => {
    const processedUrl = replaceEnvironmentVariables(url)
    const finalUrl = buildRequestUrl(processedUrl, requestParams)

    let curlCommand = `curl -X ${method} ${quoteShellArgument(finalUrl)}`

    // 添加自定义头部
    customHeaders.forEach(header => {
      if (header.enabled && header.name) {
        const processedValue = replaceEnvironmentVariables(header.value)
        curlCommand += ` \\\n  -H ${quoteShellArgument(`${header.name}: ${processedValue}`)}`
      }
    })

    // 添加请求体
    if (body && bodyType === "raw") {
      const processedBody = replaceEnvironmentVariables(body)
      curlCommand += ` \\\n  -d ${quoteShellArgument(processedBody)}`
    } else if (bodyType === "form-data") {
      formDataParams.forEach((param) => {
        if (!param.enabled || !param.name) return
        const value = param.type === "File" && param.file
          ? `${param.name}=@${param.file.name}`
          : `${param.name}=${replaceEnvironmentVariables(param.value)}`
        curlCommand += ` \\\n  -F ${quoteShellArgument(value)}`
      })
    } else if (bodyType === "urlencoded") {
      const encodedBody = encodeUrlEncodedBody(formDataParams, replaceEnvironmentVariables)
      if (encodedBody) curlCommand += ` \\\n  -d ${quoteShellArgument(encodedBody)}`
    }

    return curlCommand
  }, [method, url, requestParams, customHeaders, body, bodyType, formDataParams, replaceEnvironmentVariables])

  // 解析 cURL 命令
  const parseCurl = useCallback((curlCommand: string) => {
    try {
      const parsed = parseCurlCommand(curlCommand)
      buildRequestUrl(parsed.url)

      setMethod(parsed.method)
      setUrl(parsed.url)
      setRequestParams([{ id: crypto.randomUUID(), name: "", value: "", type: "String", enabled: true }])
      setCustomHeaders(parsed.headers.map((header) => ({
        id: crypto.randomUUID(),
        name: header.name,
        value: header.value,
        type: "String",
        enabled: true,
      })))
      setBody(parsed.body)
      if (parsed.body) {
        setBodyType('raw')
      } else {
        setBodyType("none")
      }

      toast({
        title: t("curlImportSuccess"),
        description: `${parsed.method} ${parsed.url}`
      })
    } catch (error) {
      toast({
        title: t("curlParseFailed"),
        description: t("curlParseFailedDescription"),
        variant: "destructive"
      })
    }
  }, [t, toast])

  // 取消请求
  const cancelRequest = useCallback(() => {
    if (abortController.current) {
      abortController.current.abort()
      setLoading(false)
      toast({
        title: t("requestCancelled"),
        description: t("requestCancelledDescription")
      })
    }
  }, [t, toast])

  const addParam = () => {
    setRequestParams([
      ...requestParams,
      {
        id: nextParamId.current.toString(),
        name: "",
        value: "",
        type: "String",
        enabled: true,
      },
    ])
    nextParamId.current += 1
  }

  const removeParam = (id: string) => {
    setRequestParams(requestParams.filter((param) => param.id !== id))
  }

  const updateParam = (id: string, field: keyof RequestParam, value: string | boolean) => {
    setRequestParams(requestParams.map((param) => (param.id === id ? { ...param, [field]: value } : param)))
  }

  const addHeader = () => {
    setCustomHeaders([
      ...customHeaders,
      {
        id: nextHeaderId.current.toString(),
        name: "",
        value: "",
        type: "String",
        enabled: true,
      },
    ])
    nextHeaderId.current += 1
  }

  const removeHeader = (id: string) => {
    setCustomHeaders(customHeaders.filter((header) => header.id !== id))
  }

  const updateHeader = (id: string, field: keyof RequestParam, value: string | boolean) => {
    setCustomHeaders(customHeaders.map((header) => (header.id === id ? { ...header, [field]: value } : header)))
  }

  // Form-data handlers
  const addFormDataParam = () => {
    setFormDataParams([
      ...formDataParams,
      {
        id: nextFormDataId.current.toString(),
        name: "",
        value: "",
        type: "String",
        enabled: true,
      },
    ])
    nextFormDataId.current += 1
  }

  const removeFormDataParam = (id: string) => {
    setFormDataParams(formDataParams.filter((param) => param.id !== id))
  }

  const updateFormDataParam = (id: string, field: keyof RequestParam, value: string | boolean) => {
    setFormDataParams(formDataParams.map((param) => (param.id === id ? { ...param, [field]: value } : param)))
  }

  const updateFormDataFile = (id: string, file: File | undefined) => {
    if (file && !isFileWithinLimit(file, FILE_SIZE_LIMITS.httpRequestBody)) {
      toast({ title: t("fileTooBig"), variant: "destructive" })
      return
    }
    setFormDataParams((params) =>
      params.map((param) => (param.id === id ? { ...param, file, value: file?.name ?? "" } : param)),
    )
  }

  // Binary file handler
  const handleBinaryFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      if (!isFileWithinLimit(files[0], FILE_SIZE_LIMITS.httpRequestBody)) {
        toast({ title: t("fileTooBig"), variant: "destructive" })
        e.target.value = ""
        return
      }
      setBinaryFile(files[0])
    }
  }

  // Clear request body
  const clearRequestBody = () => {
    setBody("")
    setBinaryFile(null)
    setFormDataParams([{ id: "1", name: "", value: "", type: "String", enabled: true }])
    nextFormDataId.current = 2
    if (binaryInputRef.current) {
      binaryInputRef.current.value = ""
    }
  }

  const handleSubmit = async () => {
    setLoading(true)
    const startTime = Date.now()

    const controller = new AbortController()
    abortController.current = controller

    try {
      // 处理环境变量
      const processedUrl = replaceEnvironmentVariables(url)

      // Convert custom headers array to headers object
      const headersObj: Record<string, string> = {}
      customHeaders.forEach((header) => {
        if (header.enabled && header.name.trim()) {
          const processedValue = replaceEnvironmentVariables(header.value)
          headersObj[header.name.trim()] = processedValue
        }
      })

      let requestBody: string | FormData | Blob | null = null

      if (bodyType === "raw") {
        requestBody = replaceEnvironmentVariables(body)
      } else if (bodyType === "form-data") {
        const formData = new FormData()
        formDataParams.forEach((param) => {
          if (param.enabled && param.name) {
            if (param.type === "File" && param.file) {
              formData.append(param.name, param.file)
            } else {
              const processedValue = replaceEnvironmentVariables(param.value)
              formData.append(param.name, processedValue)
            }
          }
        })
        requestBody = formData
      } else if (bodyType === "binary" && binaryFile) {
        requestBody = binaryFile
      } else if (bodyType === "urlencoded") {
        requestBody = encodeUrlEncodedBody(formDataParams, replaceEnvironmentVariables)
      }

      const res = await proxyRequest(
        processedUrl,
        method,
        headersObj,
        requestParams,
        requestBody,
        bodyType,
        controller.signal,
      )
      setResponse(res.text)

      // Try to format JSON response
      try {
        const formatted = formatJsonResponse(res.text)
        setFormattedResponse(formatted)
        setIsJsonResponse(formatted !== res.text)
      } catch (e) {
        setFormattedResponse(res.text)
        setIsJsonResponse(false)
      }

      // Parse response headers
      const parsedHeaders: Record<string, ResponseHeader[]> = {}
      for (const [key, value] of Object.entries(res.headers)) {
        parsedHeaders[key] = parseHeaderString(value)
      }
      setResponseHeaders(parsedHeaders)

      // Extract timings and status from api-o0 using regex
      const apiO0Response = res.apiO0

      const extractValue = (regex: RegExp): string => {
        const match = apiO0Response.match(regex)
        return match ? match[1] : "N/A"
      }

      const statusCode = extractValue(/statusCode=(\d+)/)
      const statusText = extractValue(/statusText=([^,]+)/)
      const httpVersion = extractValue(/httpVersion=([^,]+)/)
      const timingsString = extractValue(/timings=([^,]+)/)

      const timingsObj: Record<string, string> = {}
      if (timingsString !== "N/A") {
        timingsString.split("|").forEach((timing) => {
          const [name, timingValue] = timing.split(":")
          timingsObj[name] = timingValue || "N/A"
        })
      }

      const parsedStatusCode = Number.parseInt(statusCode, 10)
      const targetStatusCode = Number.isFinite(parsedStatusCode) ? parsedStatusCode : res.status
      const targetStatusText = statusText !== "N/A" ? statusText : (res.statusText || "N/A")

      const statusObj: Record<string, string> = {
        statusCode: String(targetStatusCode),
        statusText: targetStatusText,
        httpVersion: httpVersion,
      }

      setTimings(timingsObj)
      setStatusInfo(statusObj)

      setResponseTab("response")

      // 计算请求耗时
      const duration = Date.now() - startTime

      // 保存到历史记录
      saveToHistory({
        method,
        url: processedUrl,
        headers: headersObj,
        params: requestParams,
        body: typeof requestBody === 'string' ? requestBody : body,
        bodyType,
        formDataParams,
        binaryFile,
        response: res.text,
        status: targetStatusCode,
        duration
      })

      // Show success toast
      toast({
        title: `${targetStatusCode} ${targetStatusText}`,
        description: `${t("requestCompletedIn")} ${timingsObj.total || duration}ms`,
      })
    } catch (error: unknown) {
      if (error instanceof DOMException && error.name === "AbortError") {
        // 请求被取消，不显示错误
        return
      }

      const duration = Date.now() - startTime
      const localizedError = getHttpErrorMessage(error, t)
      const errorMessage = `${t("errorPrefix")}: ${localizedError}`

      setResponse(errorMessage)
      setFormattedResponse(errorMessage)
      setIsJsonResponse(false)

      // 保存失败的请求到历史记录
      saveToHistory({
        method,
        url,
        headers: {},
        params: requestParams,
        body,
        bodyType,
        formDataParams,
        binaryFile,
        response: errorMessage,
        status: 0,
        duration
      })

      // Show error toast
      toast({
        title: t("requestFailed"),
        description: localizedError,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
      if (abortController.current === controller) {
        abortController.current = null
      }
    }
  }

  const handleCopyToClipboard = () => {
    void copyTextToClipboard(isJsonResponse ? formattedResponse : response).then((success) => {
      if (!success) {
        toast({ title: t("copyFailed"), variant: "destructive" })
        return
      }
      setCopied(true)
      toast({
        title: t("copiedToClipboard"),
      })
      if (copyResetTimerRef.current !== null) {
        window.clearTimeout(copyResetTimerRef.current)
      }
      copyResetTimerRef.current = window.setTimeout(() => {
        setCopied(false)
        copyResetTimerRef.current = null
      }, 2000)
    })
  }

  // Flag to track if URL was manually changed
  const [manualUrlChange, setManualUrlChange] = useState(false)

  // Update URL when params change (仅在参数表格修改时更新)
  useEffect(() => {
    // Prevent the initial render from triggering this effect
    if (requestParams.length === 1 && !requestParams[0].name && !requestParams[0].value) {
      return
    }

    // Skip updating URL if it was manually changed
    if (manualUrlChange) {
      setManualUrlChange(false)
      return
    }

    // 只有当参数表格有实际内容时才自动更新URL
    const hasActiveParams = requestParams.some(param => param.enabled && param.name)
    if (!hasActiveParams) {
      return
    }

    try {
      // Get the base URL (everything before the first ?)
      const baseUrl = url.includes("?") ? url.split("?")[0] : url

      // Get all enabled parameters with names
      const queryParams = requestParams
        .filter((param) => param.enabled && param.name)
        .map((param) => `${encodeURIComponent(param.name)}=${encodeURIComponent(param.value || "")}`)
        .join("&")

      // Construct the new URL
      const newUrl = queryParams ? `${baseUrl}?${queryParams}` : baseUrl

      // Only update if the URL has actually changed to prevent loops
      if (newUrl !== url) {
        setUrl(newUrl)
      }
    } catch (error) {
      console.error("Error updating URL:", error)
    }
  }, [requestParams, manualUrlChange])

  // 延迟自动解析，避免输入时的干扰
  const debouncedAutoParseRef = useRef<number | undefined>(undefined)
  const autoParseStatusTimerRef = useRef<number | undefined>(undefined)
  const [autoParseStatus, setAutoParseStatus] = useState<
    { kind: "waiting" | "syncing" | "synced" | "current" | "failed"; count?: number } | null
  >(null)

  // 清理定时器
  useEffect(() => {
    return () => {
      if (debouncedAutoParseRef.current) {
        window.clearTimeout(debouncedAutoParseRef.current)
      }
      if (autoParseStatusTimerRef.current) {
        window.clearTimeout(autoParseStatusTimerRef.current)
      }
      if (copyResetTimerRef.current !== null) {
        window.clearTimeout(copyResetTimerRef.current)
      }
      if (abortController.current) {
        abortController.current.abort()
      }
    }
  }, [])

  // Handle URL change
  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newUrl = e.target.value
    setManualUrlChange(true)
    setUrl(newUrl)

    // 清除之前的延迟解析
    if (debouncedAutoParseRef.current) {
      clearTimeout(debouncedAutoParseRef.current)
    }

    // 清除状态提示
    setAutoParseStatus(null)

    // 如果URL包含查询参数，显示等待状态
    if (newUrl.includes("?")) {
      setAutoParseStatus({ kind: "waiting" })

      // 延迟1秒后自动解析，避免输入时的干扰
      debouncedAutoParseRef.current = window.setTimeout(() => {
        setAutoParseStatus({ kind: "syncing" })
        autoParseUrlParametersDebounced(newUrl)
      }, 1000)
    }
  }

  const readUrlParameters = useCallback((inputUrl: string) => {
    const parsedUrl = new URL(inputUrl)
    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
      throw new Error("UNSUPPORTED_PROTOCOL")
    }

    return Array.from(parsedUrl.searchParams.entries()).map(([name, value]) => ({
      id: crypto.randomUUID(),
      name,
      value,
      type: "String",
      enabled: true,
    } satisfies RequestParam))
  }, [])

  const clearAutoParseStatusLater = useCallback(() => {
    if (autoParseStatusTimerRef.current) {
      window.clearTimeout(autoParseStatusTimerRef.current)
    }
    autoParseStatusTimerRef.current = window.setTimeout(() => {
      setAutoParseStatus(null)
      autoParseStatusTimerRef.current = undefined
    }, 2000)
  }, [])

  const autoParseUrlParametersDebounced = useCallback((inputUrl: string) => {
    try {
      const parsedParams = readUrlParameters(inputUrl)
      if (parsedParams.length === 0) {
        setAutoParseStatus({ kind: "current" })
      } else {
        setRequestParams(parsedParams)
        setAutoParseStatus({ kind: "synced", count: parsedParams.length })
      }
    } catch (error) {
      console.error("Error auto-parsing URL parameters:", error)
      setAutoParseStatus({ kind: "failed" })
    }
    clearAutoParseStatusLater()
  }, [clearAutoParseStatusLater, readUrlParameters])

  const parseUrlParameters = () => {
    try {
      const parsedParams = readUrlParameters(url)
      if (parsedParams.length === 0) {
        toast({
          title: t("notice"),
          description: t("noQueryParameters"),
        })
        return
      }

      setManualUrlChange(true)
      setRequestParams(parsedParams)
      toast({
        title: t("parametersParsed"),
        description: `${t("syncedParameters")}: ${parsedParams.length}`,
      })
    } catch (error) {
      console.error("Error parsing URL parameters:", error)
      toast({
        title: t("parameterParseError"),
        description: t("parameterParseErrorDescription"),
        variant: "destructive",
      })
    }
  }

  // Method badge color
  const getMethodColor = (method: string) => {
    switch (method) {
      case "GET":
        return "bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)] hover:bg-[var(--md-sys-color-primary)]/90"
      case "POST":
        return "bg-[var(--md-sys-color-tertiary)] text-[var(--md-sys-color-on-tertiary)] hover:bg-[var(--md-sys-color-tertiary)]/90"
      case "PUT":
        return "bg-[var(--md-sys-color-secondary)] text-[var(--md-sys-color-on-secondary)] hover:bg-[var(--md-sys-color-secondary)]/90"
      case "DELETE":
        return "bg-[var(--md-sys-color-error)] text-[var(--md-sys-color-on-error)] hover:bg-[var(--md-sys-color-error)]/90"
      case "PATCH":
        return "bg-[var(--md-sys-color-primary-container)] text-[var(--md-sys-color-on-primary-container)] hover:bg-[var(--md-sys-color-primary-container)]/90"
      default:
        return "bg-[var(--md-sys-color-surface-container-high)] text-[var(--md-sys-color-on-surface)] hover:bg-[var(--md-sys-color-surface-container-high)]/90"
    }
  }

  // Body type icon
  const getBodyTypeIcon = (type: string) => {
    switch (type) {
      case "raw":
        return <Code className="h-4 w-4 mr-2" />
      case "form-data":
        return <Database className="h-4 w-4 mr-2" />
      case "urlencoded":
        return <FileJson className="h-4 w-4 mr-2" />
      case "binary":
        return <Binary className="h-4 w-4 mr-2" />
      default:
        return <X className="h-4 w-4 mr-2" />
    }
  }

  return (
    <div className="container mx-auto max-w-7xl px-3 py-4 sm:px-4 sm:py-6">
      <div className="mb-6 space-y-3 text-center sm:mb-8">
        <h1 className="flex items-center justify-center gap-2 text-2xl font-bold text-[var(--md-sys-color-on-surface)] sm:text-3xl">
          <Globe className="h-7 w-7 text-[var(--md-sys-color-primary)] sm:h-8 sm:w-8" />
          {t("title")}
        </h1>
        <p className="mx-auto max-w-2xl text-sm text-[var(--md-sys-color-on-surface-variant)] sm:text-base">
          {t("description")}
        </p>
        <Alert className="mx-auto max-w-2xl border-[var(--md-sys-color-tertiary)]/30 bg-[var(--md-sys-color-tertiary-container)] text-left text-[var(--md-sys-color-on-tertiary-container)]">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {t("proxyDisclosure")}
          </AlertDescription>
        </Alert>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="order-2 space-y-4 lg:order-1 lg:col-span-1">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Settings className="h-4 w-4" />
                {t("environmentVariables")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              <p className="text-xs text-muted-foreground">
                {t("environmentVariableHelp")} <code className="rounded bg-muted px-1">{'{{name}}'}</code>
              </p>
              {environmentVariables.map((variable) => (
                <div key={variable.id} className="space-y-2 rounded-md border p-2">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={variable.enabled}
                      onCheckedChange={(checked) =>
                        updateEnvironmentVariable(variable.id, "enabled", checked === true)
                      }
                      aria-label={`${t("enableEnvironmentVariable")} ${variable.name || t("unnamed")}`}
                    />
                    <Input
                      value={variable.name}
                      onChange={(event) => updateEnvironmentVariable(variable.id, "name", event.target.value)}
                      placeholder={t("variableName")}
                      aria-label={t("variableName")}
                      className="h-8"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeEnvironmentVariable(variable.id)}
                      aria-label={`${t("deleteEnvironmentVariable")} ${variable.name || t("unnamed")}`}
                      className="h-8 w-8 shrink-0"
                    >
                      <Trash2 className="h-4 w-4 text-[var(--md-sys-color-error)]" />
                    </Button>
                  </div>
                  <Input
                    value={variable.value}
                    onChange={(event) => updateEnvironmentVariable(variable.id, "value", event.target.value)}
                    placeholder={t("variableValue")}
                    aria-label={`${variable.name || t("environmentVariable")} ${t("value")}`}
                    className="h-8 font-mono text-xs"
                  />
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={addEnvironmentVariable} className="w-full gap-1">
                <Plus className="h-4 w-4" />
                {t("addVariable")}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Zap className="h-4 w-4" />
                {t("quickActions")}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-2">
              <Button
                variant="outline"
                size="sm"
                onClick={saveAsTemplate}
                className="w-full gap-2"
              >
                <Bookmark className="h-4 w-4" />
                {t("saveAsTemplate")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowHistory(!showHistory)}
                className="w-full gap-2"
              >
                <History className="h-4 w-4" />
                {t("history")} ({history.length})
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowTemplates(!showTemplates)}
                className="w-full gap-2"
              >
                <Bookmark className="h-4 w-4" />
                {t("templateLibrary")} ({templates.length})
              </Button>
            </CardContent>
          </Card>

          {showHistory && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <History className="h-4 w-4" />
                  {t("recentRequests")}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <ScrollArea className="h-64">
                  <div className="space-y-2">
                    {history.slice(0, 10).map(item => (
                      <button
                        type="button"
                        key={item.id}
                        className="w-full cursor-pointer rounded-lg border p-2 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--md-sys-color-primary)]"
                        onClick={() => loadFromHistory(item)}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <Badge
                            variant="outline"
                            className={`border-0 text-xs ${getMethodColor(item.method)}`}
                          >
                            {item.method}
                          </Badge>
                          {item.status && (
                            <Badge className={`text-xs ${getStatusColor(item.status)}`}>
                              {item.status}
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {item.url}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(item.timestamp).toLocaleString()}
                        </div>
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}

          {showTemplates && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Bookmark className="h-4 w-4" />
                  {t("requestTemplates")}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <ScrollArea className="h-64">
                  <div className="space-y-2">
                    {templates.map(template => (
                      <button
                        type="button"
                        key={template.id}
                        className="w-full cursor-pointer rounded-lg border p-2 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--md-sys-color-primary)]"
                        onClick={() => loadFromTemplate(template)}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <Badge
                            variant="outline"
                            className={`border-0 text-xs ${getMethodColor(template.method)}`}
                          >
                            {template.method}
                          </Badge>
                        </div>
                        <div className="text-sm font-medium">{template.name}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {template.url}
                        </div>
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="order-1 min-w-0 lg:order-2 lg:col-span-3">
          <Card className="overflow-visible">
            <CardContent className="p-4 md:p-6 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  <Send className="h-5 w-5 text-primary" />
                  {t("requestBuilder")}
                </h2>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      try {
                        const curl = generateCurl()
                        void copyTextToClipboard(curl).then((success) => {
                          toast({
                            title: success ? t("curlCopied") : t("copyFailed"),
                            variant: success ? "default" : "destructive",
                          })
                        })
                      } catch (error) {
                        toast({
                          title: t("invalidUrl"),
                          description: getHttpErrorMessage(error, t),
                          variant: "destructive",
                        })
                      }
                    }}
                    className="gap-2 flex-1 sm:flex-none"
                  >
                    <Download className="h-4 w-4" />
                    {t("exportCurl")}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setCurlInput("")
                      setCurlDialogOpen(true)
                    }}
                    className="gap-2 flex-1 sm:flex-none"
                  >
                    <Upload className="h-4 w-4" />
                    {t("importCurl")}
                  </Button>
                </div>
              </div>
              {/* 请求URL配置 */}
              <div className="space-y-4">
                <div className="flex flex-col md:flex-row items-stretch gap-2">
                  <div className="flex-shrink-0 w-full md:w-auto">
                    <Select value={method} onValueChange={setMethod}>
                      <SelectTrigger
                        className={`h-10 w-full border-0 font-medium shadow-sm transition-transform active:scale-95 md:h-12 md:w-[120px] ${getMethodColor(method)}`}
                      >
                        <SelectValue placeholder={t("method")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="GET">GET</SelectItem>
                        <SelectItem value="POST">POST</SelectItem>
                        <SelectItem value="PUT">PUT</SelectItem>
                        <SelectItem value="DELETE">DELETE</SelectItem>
                        <SelectItem value="PATCH">PATCH</SelectItem>
                        <SelectItem value="HEAD">HEAD</SelectItem>
                        <SelectItem value="OPTIONS">OPTIONS</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex-grow space-y-2 relative">
                    <div className="relative z-0 group">
                      <Label htmlFor="http-request-url" className="sr-only">{t("requestUrl")}</Label>
                      <Input
                        id="http-request-url"
                        className="h-10 md:h-12 pr-10 font-mono text-sm bg-muted/30 border-muted-foreground/20 focus:border-primary transition-all"
                        value={url}
                        onChange={handleUrlChange}
                        placeholder="https://example.com/api/v1/resource"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2 transform text-muted-foreground hover:bg-[var(--md-sys-color-primary-container)] hover:text-[var(--md-sys-color-on-primary-container)]"
                        onClick={parseUrlParameters}
                        title={t("parseUrlParameters")}
                        aria-label={t("parseUrlParameters")}
                      >
                        <Database className="h-4 w-4" />
                      </Button>
                    </div>

                    {/* 自动同步状态提示 */}
                    {autoParseStatus && (
                      <div className="absolute top-full left-0 mt-1 z-10 pointer-events-none">
                        <div className="inline-flex items-center gap-2 text-xs bg-background/90 backdrop-blur px-2 py-1 rounded shadow-sm border animate-in fade-in slide-in-from-top-1">
                          {autoParseStatus.kind === "waiting" && <Clock className="h-3 w-3 text-[var(--md-sys-color-tertiary)]" />}
                          {autoParseStatus.kind === "syncing" && <Loader2 className="h-3 w-3 animate-spin text-[var(--md-sys-color-primary)]" />}
                          {autoParseStatus.kind === "synced" && <CheckCircle2 className="h-3 w-3 text-[var(--md-sys-color-primary)]" />}
                          {autoParseStatus.kind === "failed" && <AlertCircle className="h-3 w-3 text-[var(--md-sys-color-error)]" />}
                          <span className="text-muted-foreground">
                            {autoParseStatus.kind === "waiting"
                              ? t("waitingToSync")
                              : autoParseStatus.kind === "syncing"
                                ? t("syncingParameters")
                                : autoParseStatus.kind === "synced"
                                  ? `${t("syncedParameters")}: ${autoParseStatus.count ?? 0}`
                                  : autoParseStatus.kind === "current"
                                    ? t("parametersCurrent")
                                    : t("parameterSyncFailed")}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 w-full md:w-auto">
                    {loading && (
                      <Button
                        variant="destructive"
                        onClick={cancelRequest}
                        className="gap-2 flex-grow md:flex-grow-0 h-10 md:h-12"
                      >
                        <X className="h-4 w-4" />
                        {t("cancel")}
                      </Button>
                    )}
                    <Button
                      onClick={handleSubmit}
                      disabled={loading}
                      className="flex-grow md:flex-grow-0 gap-2 bg-primary hover:bg-primary/90 h-10 md:h-12 px-6 shadow-md hover:shadow-lg transition-all"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span className="sr-only sm:not-sr-only">{t("loading")}</span>
                        </>
                      ) : (
                        <>
                          <Send className="h-4 w-4" />
                          <span>{t("submit")}</span>
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {/* 环境变量提示 */}
                {environmentVariables.some((variable) => variable.enabled && variable.name.trim()) && (
                  <Alert>
                    <Settings className="h-4 w-4" />
                    <AlertDescription>
                      {t("enabledVariablesPrefix")}{" "}
                      <strong>
                        {environmentVariables.filter((variable) => variable.enabled && variable.name.trim()).length}
                      </strong>{" "}
                      {t("enabledVariablesSuffix")}
                    </AlertDescription>
                  </Alert>
                )}
              </div>

              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="mb-6 grid h-auto grid-cols-3 bg-[var(--md-sys-color-surface-container)] p-1">
                  <TabsTrigger value="params" className="flex min-w-0 items-center gap-1 px-1 py-2.5 text-xs data-[state=active]:bg-[var(--md-sys-color-surface-container-lowest)] sm:gap-2 sm:px-3 sm:text-sm">
                    <Database className="hidden h-4 w-4 sm:block" />
                    <span className="truncate">{t("queryParams")}</span>
                  </TabsTrigger>
                  <TabsTrigger value="headers" className="flex min-w-0 items-center gap-1 px-1 py-2.5 text-xs data-[state=active]:bg-[var(--md-sys-color-surface-container-lowest)] sm:gap-2 sm:px-3 sm:text-sm">
                    <Code className="hidden h-4 w-4 sm:block" />
                    <span className="truncate">{t("headers")}</span>
                  </TabsTrigger>
                  <TabsTrigger value="body" className="flex min-w-0 items-center gap-1 px-1 py-2.5 text-xs data-[state=active]:bg-[var(--md-sys-color-surface-container-lowest)] sm:gap-2 sm:px-3 sm:text-sm">
                    <FileJson className="hidden h-4 w-4 sm:block" />
                    <span className="truncate">{t("body")}</span>
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="params">
                  <div className="mb-4 rounded-xl border border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container-low)] p-3">
                    <div className="flex items-start gap-2">
                      <Database className="mt-0.5 h-4 w-4 flex-shrink-0 text-[var(--md-sys-color-primary)]" />
                      <div className="text-sm text-[var(--md-sys-color-on-surface)]">
                        <div className="mb-1 font-medium">{t("urlSyncTitle")}</div>
                        <ul className="space-y-1 text-xs text-[var(--md-sys-color-on-surface-variant)]">
                          <li>• {t("urlSyncDelayed")}</li>
                          <li>• {t("urlSyncEncoding")}</li>
                          <li>• {t("urlSyncManual")}</li>
                          <li>• {t("urlSyncTable")}</li>
                          <li>• {t("urlSyncVariables")} <code className="rounded bg-[var(--md-sys-color-surface-container-high)] px-1">{'{{name}}'}</code></li>
                        </ul>
                      </div>
                    </div>
                  </div>
                  <div className="max-w-full overflow-x-auto rounded-lg border">
                    <Table className="min-w-[680px]">
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead className="w-[50px]"></TableHead>
                          <TableHead>{t("parameterName")}</TableHead>
                          <TableHead>{t("parameterValue")}</TableHead>
                          <TableHead className="w-[120px]">{t("type")}</TableHead>
                          <TableHead className="w-[80px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {requestParams.map((param) => (
                          <TableRow key={param.id}>
                            <TableCell>
                              <Checkbox
                                checked={param.enabled}
                                onCheckedChange={(checked) => updateParam(param.id, "enabled", !!checked)}
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                value={param.name}
                                onChange={(e) => updateParam(param.id, "name", e.target.value)}
                                placeholder={t("parameterName")}
                                className="h-8"
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                value={param.value}
                                onChange={(e) => updateParam(param.id, "value", e.target.value)}
                                placeholder={t("parameterValue")}
                                className="h-8"
                              />
                            </TableCell>
                            <TableCell>
                              <Select value={param.type} onValueChange={(value) => updateParam(param.id, "type", value)}>
                                <SelectTrigger className="h-8">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="String">{t("stringType")}</SelectItem>
                                  <SelectItem value="Number">{t("numberType")}</SelectItem>
                                  <SelectItem value="Boolean">{t("booleanType")}</SelectItem>
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              <Button variant="ghost" size="icon" onClick={() => removeParam(param.id)} aria-label={t("removeParameter")}>
                                <Trash2 className="h-4 w-4 text-[var(--md-sys-color-error)]" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    <div className="p-2 border-t bg-muted/20">
                      <Button variant="outline" size="sm" onClick={addParam} className="gap-1">
                        <Plus className="h-4 w-4" />
                        {t("addParameter")}
                      </Button>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="headers">
                  <div className="max-w-full overflow-x-auto rounded-lg border">
                    <Table className="min-w-[600px]">
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead className="w-[50px]"></TableHead>
                          <TableHead>{t("headerName")}</TableHead>
                          <TableHead>{t("headerValue")}</TableHead>
                          <TableHead className="w-[80px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {customHeaders.map((header) => (
                          <TableRow key={header.id}>
                            <TableCell>
                              <Checkbox
                                checked={header.enabled}
                                onCheckedChange={(checked) => updateHeader(header.id, "enabled", !!checked)}
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                value={header.name}
                                onChange={(e) => updateHeader(header.id, "name", e.target.value)}
                                placeholder={t("headerName")}
                                className="h-8"
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                value={header.value}
                                onChange={(e) => updateHeader(header.id, "value", e.target.value)}
                                placeholder={t("headerValue")}
                                className="h-8"
                              />
                            </TableCell>
                            <TableCell>
                              <Button variant="ghost" size="icon" onClick={() => removeHeader(header.id)} aria-label={t("removeHeader")}>
                                <Trash2 className="h-4 w-4 text-[var(--md-sys-color-error)]" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    <div className="p-2 border-t bg-muted/20">
                      <Button variant="outline" size="sm" onClick={addHeader} className="gap-1">
                        <Plus className="h-4 w-4" />
                        {t("addHeader")}
                      </Button>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="body">
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        variant={bodyType === "none" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setBodyType("none")}
                        className="gap-1"
                      >
                        <X className="h-4 w-4" />
                        {t("none")}
                      </Button>
                      <Button
                        variant={bodyType === "raw" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setBodyType("raw")}
                        className="gap-1"
                      >
                        <Code className="h-4 w-4" />
                        {t("raw")}
                      </Button>
                      <Button
                        variant={bodyType === "form-data" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setBodyType("form-data")}
                        className="gap-1"
                      >
                        <Database className="h-4 w-4" />
                        {t("formData")}
                      </Button>
                      <Button
                        variant={bodyType === "urlencoded" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setBodyType("urlencoded")}
                        className="gap-1"
                      >
                        <FileJson className="h-4 w-4" />
                        {t("urlencoded")}
                      </Button>
                      <Button
                        variant={bodyType === "binary" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setBodyType("binary")}
                        className="gap-1"
                      >
                        <Binary className="h-4 w-4" />
                        {t("binary")}
                      </Button>
                    </div>

                    {bodyType !== "none" && (
                      <div className="bg-muted/20 p-2 rounded-md">
                        <Badge variant="outline" className="mb-2">
                          {getBodyTypeIcon(bodyType)}
                          {bodyType === "raw"
                            ? t("raw")
                            : bodyType === "form-data"
                              ? t("formData")
                              : bodyType === "urlencoded"
                                ? t("urlencoded")
                                : t("binary")}
                        </Badge>

                        {bodyType === "raw" && (
                          <div className="relative">
                            <Textarea
                              value={body}
                              onChange={(e) => setBody(e.target.value)}
                              placeholder={t("rawBodyPlaceholder")}
                              rows={8}
                              className="font-mono text-sm"
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              className="absolute right-2 top-2"
                              onClick={clearRequestBody}
                              aria-label={t("clearBody")}
                            >
                              <Trash2 className="h-4 w-4 text-[var(--md-sys-color-error)]" />
                            </Button>
                          </div>
                        )}

                        {(bodyType === "form-data" || bodyType === "urlencoded") && (
                          <div className="max-w-full overflow-x-auto rounded-lg border">
                            <Table className="min-w-[720px]">
                              <TableHeader>
                                <TableRow className="bg-muted/50">
                                  <TableHead className="w-[50px]"></TableHead>
                                  <TableHead>{t("key")}</TableHead>
                                  <TableHead>{t("value")}</TableHead>
                                  <TableHead className="w-[120px]">{t("type")}</TableHead>
                                  <TableHead className="w-[80px]"></TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {formDataParams.map((param) => (
                                  <TableRow key={param.id}>
                                    <TableCell>
                                      <Checkbox
                                        checked={param.enabled}
                                        onCheckedChange={(checked) => updateFormDataParam(param.id, "enabled", !!checked)}
                                      />
                                    </TableCell>
                                    <TableCell>
                                      <Input
                                        value={param.name}
                                        onChange={(e) => updateFormDataParam(param.id, "name", e.target.value)}
                                        placeholder={t("key")}
                                        className="h-8"
                                      />
                                    </TableCell>
                                    <TableCell>
                                      {bodyType === "urlencoded" || param.type === "String" ? (
                                        <Input
                                          value={param.value}
                                          onChange={(e) => updateFormDataParam(param.id, "value", e.target.value)}
                                          placeholder={t("value")}
                                          className="h-8"
                                        />
                                      ) : (
                                        <div className="min-w-48">
                                          <Input
                                            type="file"
                                            onChange={(event) =>
                                              updateFormDataFile(param.id, event.target.files?.[0])
                                            }
                                            className="h-9 cursor-pointer text-xs"
                                            aria-label={t("selectFormDataFile")}
                                          />
                                          {param.file && (
                                            <span className="mt-1 block max-w-48 truncate text-xs text-[var(--md-sys-color-on-surface-variant)]">
                                              {param.file.name}
                                            </span>
                                          )}
                                        </div>
                                      )}
                                    </TableCell>
                                    <TableCell>
                                      <Select
                                        value={bodyType === "urlencoded" ? "String" : param.type}
                                        onValueChange={(value) => updateFormDataParam(param.id, "type", value)}
                                        disabled={bodyType === "urlencoded"}
                                      >
                                        <SelectTrigger className="h-8">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="String">{t("stringType")}</SelectItem>
                                          <SelectItem value="File">{t("fileType")}</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </TableCell>
                                    <TableCell>
                                      <Button variant="ghost" size="icon" onClick={() => removeFormDataParam(param.id)} aria-label={t("removeFormField")}>
                                        <Trash2 className="h-4 w-4 text-[var(--md-sys-color-error)]" />
                                      </Button>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                            <div className="p-2 border-t bg-muted/20">
                              <Button variant="outline" size="sm" onClick={addFormDataParam} className="gap-1">
                                <Plus className="h-4 w-4" />
                                {bodyType === "urlencoded" ? t("addFormField") : t("addFormData")}
                              </Button>
                            </div>
                          </div>
                        )}

                        {bodyType === "binary" && (
                          <div className="border rounded-md p-4 text-center">
                            <input type="file" ref={binaryInputRef} onChange={handleBinaryFileChange} className="hidden" />
                            <Button variant="outline" onClick={() => binaryInputRef.current?.click()} className="mx-auto">
                              {binaryFile ? binaryFile.name : t("selectBinaryFile")}
                            </Button>
                          </div>
                        )}
                      </div>
                    )}

                    {bodyType === "none" && (
                      <div className="border-2 border-dashed rounded-lg p-8 text-center text-muted-foreground bg-muted/10">
                        <X className="h-6 w-6 mx-auto mb-2 opacity-50" />
                        {t("noBody")}
                      </div>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* 响应显示区域 */}
          {(response || Object.keys(responseHeaders).length > 0) && (
            <Card className="mt-6">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-[var(--md-sys-color-primary)]" />
                  {t("responseResult")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">

                {statusInfo.statusCode && (
                  <div className="flex items-center gap-2 mb-4">
                    <Badge className={getStatusColor(Number.parseInt(statusInfo.statusCode))}>
                      {statusInfo.statusCode}
                    </Badge>
                    <span className="text-sm font-medium">{statusInfo.statusText}</span>
                    {timings.total && (
                      <Badge variant="outline" className="ml-auto">
                        {timings.total}ms
                      </Badge>
                    )}
                  </div>
                )}

                <Tabs value={responseTab} onValueChange={setResponseTab}>
                  <TabsList className="mb-4 grid h-auto grid-cols-4 bg-[var(--md-sys-color-surface-container)] p-1">
                    <TabsTrigger value="response" className="flex min-w-0 items-center gap-1 px-1 py-2 text-[11px] data-[state=active]:bg-[var(--md-sys-color-surface-container-lowest)] sm:gap-2 sm:px-3 sm:text-sm">
                      <FileJson className="hidden h-4 w-4 md:block" />
                      <span className="truncate">{t("response")}</span>
                    </TabsTrigger>
                    <TabsTrigger value="responseHeaders" className="flex min-w-0 items-center gap-1 px-1 py-2 text-[11px] data-[state=active]:bg-[var(--md-sys-color-surface-container-lowest)] sm:gap-2 sm:px-3 sm:text-sm">
                      <Code className="hidden h-4 w-4 md:block" />
                      <span className="truncate">{t("responseHeaders")}</span>
                    </TabsTrigger>
                    <TabsTrigger value="requestHeaders" className="flex min-w-0 items-center gap-1 px-1 py-2 text-[11px] data-[state=active]:bg-[var(--md-sys-color-surface-container-lowest)] sm:gap-2 sm:px-3 sm:text-sm">
                      <Code className="hidden h-4 w-4 md:block" />
                      <span className="truncate">{t("requestHeaders")}</span>
                    </TabsTrigger>
                    <TabsTrigger value="timings" className="flex min-w-0 items-center gap-1 px-1 py-2 text-[11px] data-[state=active]:bg-[var(--md-sys-color-surface-container-lowest)] sm:gap-2 sm:px-3 sm:text-sm">
                      <ExternalLink className="hidden h-4 w-4 md:block" />
                      <span className="truncate">{t("timings")}</span>
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="response">
                    <div className="space-y-4">
                      <div className="relative">
                        <Textarea
                          value={isJsonResponse ? formattedResponse : response}
                          readOnly
                          className="font-mono text-sm"
                          rows={15}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute right-2 top-2"
                          onClick={handleCopyToClipboard}
                          aria-label={t("copyResponse")}
                        >
                          {copied ? <Check className="h-4 w-4 text-[var(--md-sys-color-primary)]" /> : <Copy className="h-4 w-4" />}
                        </Button>
                      </div>

                      {isJsonResponse && formattedResponse && (
                        <JsonTreeView jsonText={formattedResponse} indentSize={2} />
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="responseHeaders">
                    <div className="max-w-full overflow-x-auto rounded-lg border">
                      <Table className="min-w-[560px]">
                        <TableHeader>
                          <TableRow className="bg-muted/50">
                            <TableHead>{t("header")}</TableHead>
                            <TableHead>{t("value")}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {Object.entries(responseHeaders)
                            .filter(([key]) => key !== "api-o0")
                            .map(([key, headers], index) =>
                              headers.map((header, i) => (
                                <TableRow key={`${key}-${i}`}>
                                  <TableCell className="font-medium">{header.name}</TableCell>
                                  <TableCell className="font-mono text-sm">{header.value}</TableCell>
                                </TableRow>
                              )),
                            )}
                        </TableBody>
                      </Table>
                    </div>
                  </TabsContent>

                  <TabsContent value="requestHeaders">
                    <div className="max-w-full overflow-x-auto rounded-lg border">
                      <Table className="min-w-[560px]">
                        <TableHeader>
                          <TableRow className="bg-muted/50">
                            <TableHead>{t("header")}</TableHead>
                            <TableHead>{t("value")}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {customHeaders
                            .filter((h) => h.enabled)
                            .map((header) => (
                              <TableRow key={header.id}>
                                <TableCell className="font-medium">{header.name}</TableCell>
                                <TableCell className="font-mono text-sm">{header.value}</TableCell>
                              </TableRow>
                            ))}
                        </TableBody>
                      </Table>
                    </div>
                  </TabsContent>

                  <TabsContent value="timings">
                    <div className="max-w-full overflow-x-auto rounded-lg border">
                      <Table className="min-w-[500px]">
                        <TableHeader>
                          <TableRow className="bg-muted/50">
                            <TableHead>{t("name")}</TableHead>
                            <TableHead>{t("value")}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {Object.entries(timings).map(([name, value]) => (
                            <TableRow key={name}>
                              <TableCell className="font-medium">{name}</TableCell>
                              <TableCell>{value ? <Badge variant="outline">{value}ms</Badge> : t("notAvailable")}</TableCell>
                            </TableRow>
                          ))}
                          <TableRow>
                            <TableCell className="font-medium">{t("statusCode")}</TableCell>
                            <TableCell>
                              <Badge className={getStatusColor(Number.parseInt(statusInfo.statusCode))}>
                                {statusInfo.statusCode}
                              </Badge>
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="font-medium">{t("statusText")}</TableCell>
                            <TableCell>{statusInfo.statusText}</TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="font-medium">{t("httpVersion")}</TableCell>
                            <TableCell>{statusInfo.httpVersion}</TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("saveTemplateTitle")}</DialogTitle>
            <DialogDescription>{t("saveTemplateDescription")}</DialogDescription>
          </DialogHeader>
          <Input
            autoFocus
            value={templateName}
            onChange={(event) => setTemplateName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && templateName.trim()) confirmSaveTemplate()
            }}
            placeholder={t("templateNamePlaceholder")}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setTemplateDialogOpen(false)}>{t("cancel")}</Button>
            <Button onClick={confirmSaveTemplate} disabled={!templateName.trim()}>{t("save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={curlDialogOpen} onOpenChange={setCurlDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("importCurlTitle")}</DialogTitle>
            <DialogDescription>{t("importCurlDescription")}</DialogDescription>
          </DialogHeader>
          <Textarea
            autoFocus
            value={curlInput}
            onChange={(event) => setCurlInput(event.target.value)}
            placeholder={'curl -X POST "https://example.com/api" \\\n  -H "Content-Type: application/json"'}
            className="min-h-48 font-mono text-sm"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCurlDialogOpen(false)}>{t("cancel")}</Button>
            <Button
              onClick={() => {
                parseCurl(curlInput)
                setCurlDialogOpen(false)
              }}
              disabled={!curlInput.trim()}
            >
              {t("import")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
