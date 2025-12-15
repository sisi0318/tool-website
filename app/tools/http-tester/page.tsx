"use client"

import { Card, CardContent, CardDescription, CardTitle, CardHeader } from "@/components/ui/card"
import type React from "react"

import { useState, useRef, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useTranslations } from "@/hooks/use-translations"
import { 
  Copy, Check, Plus, Trash2, Send, FileJson, Code, Database, Binary, X, ExternalLink,
  Globe, Settings, Clock, History, Bookmark, Download, Upload, RotateCcw, Zap,
  Eye, EyeOff, ChevronDown, ChevronUp, AlertCircle, CheckCircle2, Loader2
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"

interface RequestParam {
  id: string
  name: string
  value: string
  type: string
  enabled: boolean
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
}

interface Environment {
  id: string
  name: string
  variables: Record<string, string>
  active: boolean
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
}

async function proxyRequest(
  url: string,
  method: string,
  headers: Record<string, string>,
  params: RequestParam[],
  body: string | FormData | Blob | null,
  bodyType: string,
) {
  const proxyUrl = "https://web-proxy.apifox.cn/api/v1/request"

  // Build URL with query parameters
  let finalUrl = url
  const queryParams = params
    .filter((param) => param.enabled && param.name)
    .map((param) => `${encodeURIComponent(param.name)}=${encodeURIComponent(param.value || "")}`)
    .join("&")

  if (queryParams) {
    // 确保基础URL不包含查询参数，避免重复
    const baseUrl = finalUrl.includes("?") ? finalUrl.split("?")[0] : finalUrl
    finalUrl = `${baseUrl}?${queryParams}`
  }

  // Build custom headers string for api-h0
  const customHeadersArray = Object.entries(headers).map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
  const defaultHeaders = [
    `User-Agent=Apifox/1.0.0 (https://apifox.com)`,
    `Accept=*/*`,
    `Host=${new URL(finalUrl).hostname}`,
    `Accept-Encoding=gzip%2C deflate%2C br`,
    `Connection=keep-alive`,
  ]

  const apiH0 = [...defaultHeaders, ...customHeadersArray].join(", ")

  // Prepare api-o0 and api-u headers
  const apiO0 = `method=${method},timings=true,timeout=300000,rejectUnauthorized=false,followRedirect=true`
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

// Function to get status color
function getStatusColor(status: number): string {
  if (status >= 200 && status < 300) return "bg-green-500"
  if (status >= 300 && status < 400) return "bg-blue-500"
  if (status >= 400 && status < 500) return "bg-yellow-500"
  if (status >= 500) return "bg-red-500"
  return "bg-gray-500"
}

interface HTTPTesterProps {
  params?: Record<string, string>
}

export default function HTTPTester({ params: routeParams }: HTTPTesterProps) {
  const t = useTranslations("httpTester")
  const { toast } = useToast()

  // 基本请求状态
  const [url, setUrl] = useState("https://example.com")
  const [method, setMethod] = useState("GET")
  const [headers, setHeaders] = useState<Record<string, string>>({})
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
  const [apiO0, setApiO0] = useState("")
  const [response, setResponse] = useState("")
  const [formattedResponse, setFormattedResponse] = useState("")
  const [isJsonResponse, setIsJsonResponse] = useState(false)

  // UI状态
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [activeTab, setActiveTab] = useState("params")
  const [responseTab, setResponseTab] = useState("response")
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  // 新功能状态
  const [history, setHistory] = useState<RequestHistory[]>([])
  const [environments, setEnvironments] = useState<Environment[]>([
    { id: "default", name: "默认环境", variables: {}, active: true }
  ])
  const [templates, setTemplates] = useState<RequestTemplate[]>([])
  const [currentEnvironment, setCurrentEnvironment] = useState("default")
  const [showHistory, setShowHistory] = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)

  // ID计数器
  const nextParamId = useRef(2)
  const nextHeaderId = useRef(2)
  const nextFormDataId = useRef(1)

  const binaryInputRef = useRef<HTMLInputElement>(null)
  const abortController = useRef<AbortController | null>(null)

  // 环境变量处理
  const replaceEnvironmentVariables = useCallback((text: string) => {
    const currentEnv = environments.find(env => env.id === currentEnvironment)
    if (!currentEnv) return text

    let result = text
    Object.entries(currentEnv.variables).forEach(([key, value]) => {
      const regex = new RegExp(`{{${key}}}`, 'g')
      result = result.replace(regex, value)
    })
    return result
  }, [environments, currentEnvironment])

  // 保存到历史记录
  const saveToHistory = useCallback((requestData: Omit<RequestHistory, 'id' | 'timestamp'>) => {
    const historyItem: RequestHistory = {
      id: Date.now().toString(),
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
    
    toast({
      title: "已加载历史请求",
      description: `${historyItem.method} ${historyItem.url}`
    })
  }, [toast])

  // 保存为模板
  const saveAsTemplate = useCallback(() => {
    const templateName = prompt("请输入模板名称:")
    if (!templateName) return

    const template: RequestTemplate = {
      id: Date.now().toString(),
      name: templateName,
      method,
      url,
      headers: customHeaders,
      params: requestParams,
      body,
      bodyType
    }
    
    setTemplates(prev => [...prev, template])
    toast({
      title: "模板已保存",
      description: templateName
    })
  }, [method, url, customHeaders, requestParams, body, bodyType, toast])

  // 从模板加载请求
  const loadFromTemplate = useCallback((template: RequestTemplate) => {
    setMethod(template.method)
    setUrl(template.url)
    setRequestParams(template.params)
    setCustomHeaders(template.headers)
    setBody(template.body)
    setBodyType(template.bodyType as any)
    
    toast({
      title: "已加载模板",
      description: template.name
    })
  }, [toast])

  // 生成 cURL 命令
  const generateCurl = useCallback(() => {
    const processedUrl = replaceEnvironmentVariables(url)
    const queryParams = requestParams
      .filter(param => param.enabled && param.name)
      .map(param => `${encodeURIComponent(param.name)}=${encodeURIComponent(param.value || "")}`)
      .join("&")
    
    const finalUrl = queryParams ? `${processedUrl}?${queryParams}` : processedUrl
    
    let curlCommand = `curl -X ${method} "${finalUrl}"`
    
    // 添加自定义头部
    customHeaders.forEach(header => {
      if (header.enabled && header.name) {
        const processedValue = replaceEnvironmentVariables(header.value)
        curlCommand += ` \\\n  -H "${header.name}: ${processedValue}"`
      }
    })
    
    // 添加请求体
    if (body && bodyType === "raw") {
      const processedBody = replaceEnvironmentVariables(body)
      curlCommand += ` \\\n  -d '${processedBody}'`
    }
    
    return curlCommand
  }, [method, url, requestParams, customHeaders, body, bodyType, replaceEnvironmentVariables])

  // 解析 cURL 命令
  const parseCurl = useCallback((curlCommand: string) => {
    try {
      const lines = curlCommand.trim().split('\n').map(line => line.trim())
      let parsedMethod = 'GET'
      let parsedUrl = ''
      const parsedHeaders: RequestParam[] = []
      let parsedBody = ''
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].replace(/\s*\\\s*$/, '') // 移除行末的 \
        
        if (line.startsWith('curl ')) {
          // 提取 URL
          const urlMatch = line.match(/"([^"]+)"/)
          if (urlMatch) {
            parsedUrl = urlMatch[1]
          }
        }
        
        if (line.includes('-X ')) {
          const methodMatch = line.match(/-X\s+(\w+)/)
          if (methodMatch) {
            parsedMethod = methodMatch[1]
          }
        }
        
        if (line.includes('-H ')) {
          const headerMatch = line.match(/-H\s+"([^:]+):\s*([^"]+)"/)
          if (headerMatch) {
            parsedHeaders.push({
              id: `header_${parsedHeaders.length}`,
              name: headerMatch[1],
              value: headerMatch[2],
              type: 'String',
              enabled: true
            })
          }
        }
        
        if (line.includes('-d ')) {
          const bodyMatch = line.match(/-d\s+'([^']+)'/)
          if (bodyMatch) {
            parsedBody = bodyMatch[1]
          }
        }
      }
      
      // 更新状态
      setMethod(parsedMethod)
      setUrl(parsedUrl)
      setCustomHeaders(parsedHeaders)
      if (parsedBody) {
        setBody(parsedBody)
        setBodyType('raw')
      }
      
      toast({
        title: "cURL 导入成功",
        description: `${parsedMethod} ${parsedUrl}`
      })
    } catch (error) {
      toast({
        title: "cURL 解析失败",
        description: "请检查 cURL 命令格式",
        variant: "destructive"
      })
    }
  }, [toast])

  // 取消请求
  const cancelRequest = useCallback(() => {
    if (abortController.current) {
      abortController.current.abort()
      setLoading(false)
      toast({
        title: "请求已取消",
        description: "HTTP请求已被用户取消"
      })
    }
  }, [toast])

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

  // Binary file handler
  const handleBinaryFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      setBinaryFile(files[0])
    }
  }

  // Clear request body
  const clearRequestBody = () => {
    setBody("")
    setBinaryFile(null)
    setFormDataParams([{ id: "1", name: "", value: "", type: "String", enabled: true }])
    if (binaryInputRef.current) {
      binaryInputRef.current.value = ""
    }
  }

  const handleSubmit = async () => {
    setLoading(true)
    const startTime = Date.now()
    
    // 创建新的 AbortController
    abortController.current = new AbortController()
    
    try {
      // 处理环境变量
      const processedUrl = replaceEnvironmentVariables(url)
      
      // Convert custom headers array to headers object
      const headersObj: Record<string, string> = {}
      customHeaders.forEach((header) => {
        if (header.enabled) {
          const processedValue = replaceEnvironmentVariables(header.value)
          headersObj[header.name] = processedValue
        }
      })

      let requestBody: string | FormData | Blob | null = null

      if (bodyType === "raw") {
        requestBody = replaceEnvironmentVariables(body)
      } else if (bodyType === "form-data") {
        const formData = new FormData()
        formDataParams.forEach((param) => {
          if (param.enabled && param.name) {
            const processedValue = replaceEnvironmentVariables(param.value)
            formData.append(param.name, processedValue)
          }
        })
        requestBody = formData
      } else if (bodyType === "binary" && binaryFile) {
        requestBody = binaryFile
      } else if (bodyType === "urlencoded") {
        requestBody = requestParams
          .filter((param) => param.enabled && param.name && param.value)
          .map((param) => `${encodeURIComponent(param.name)}=${encodeURIComponent(replaceEnvironmentVariables(param.value))}`)
          .join("&")
      }

      const res = await proxyRequest(processedUrl, method, headersObj, requestParams, requestBody, bodyType)
      setResponse(res.text)
      setApiO0(res.apiO0)

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

      const statusObj: Record<string, string> = {
        statusCode: String(res.status),
        statusText: res.statusText || "N/A",
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
        response: res.text,
        status: res.status,
        duration
      })

      // Show success toast
      toast({
        title: `${res.status} ${res.statusText}`,
        description: `Request completed in ${timingsObj.total || duration}ms`,
      })
    } catch (e: any) {
      if (e.name === 'AbortError') {
        // 请求被取消，不显示错误
        return
      }

      const duration = Date.now() - startTime
      const errorMessage = `Error: ${e.message}`
      
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
        response: errorMessage,
        status: 0,
        duration
      })

      // Show error toast
      toast({
        title: "Request Failed",
        description: e.message,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
      abortController.current = null
    }
  }

  const handleCopyToClipboard = () => {
    navigator.clipboard.writeText(isJsonResponse ? formattedResponse : response)
    setCopied(true)
    toast({
      title: t("copiedToClipboard"),
    })
    setTimeout(() => setCopied(false), 2000)
  }

  // Function to update URL and parse parameters
  const updateUrlAndParams = (newUrl: string) => {
    // Set the URL without modifying it
    setUrl(newUrl)

    // Only parse query parameters if there's a question mark in the URL
    if (newUrl.includes("?")) {
      try {
        // Extract the query string part (everything after the first ?)
        const queryString = newUrl.split("?")[1]
        if (!queryString) return

        const parsedParams: RequestParam[] = []
        // Use URLSearchParams to parse the query string
        const urlParams = new URLSearchParams(queryString)

        urlParams.forEach((value, name) => {
          parsedParams.push({
            id: nextParamId.current.toString(),
            name: name,
            value: value,
            type: "String",
            enabled: true,
          })
          nextParamId.current += 1
        })

        // If we have parsed parameters, update the state
        if (parsedParams.length > 0) {
          setRequestParams(parsedParams)
        }
      } catch (error) {
        console.error("Error parsing URL parameters:", error)
      }
    }
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
  const debouncedAutoParseRef = useRef<NodeJS.Timeout>()
  const [autoParseStatus, setAutoParseStatus] = useState<string>("")

  // 清理定时器
  useEffect(() => {
    return () => {
      if (debouncedAutoParseRef.current) {
        clearTimeout(debouncedAutoParseRef.current)
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
    setAutoParseStatus("")
    
    // 如果URL包含查询参数，显示等待状态
    if (newUrl.includes("?")) {
      setAutoParseStatus("等待同步...")
      
      // 延迟1秒后自动解析，避免输入时的干扰
      debouncedAutoParseRef.current = setTimeout(() => {
        setAutoParseStatus("正在同步参数...")
        autoParseUrlParametersDebounced(newUrl)
      }, 1000)
    }
  }

  // 延迟自动解析URL参数（保留编码，避免输入干扰）
  const autoParseUrlParametersDebounced = useCallback((inputUrl: string) => {
    // 只有当URL包含查询参数时才进行解析
    if (!inputUrl.includes("?")) {
      return
    }

    try {
      const queryString = inputUrl.split("?")[1]
      if (!queryString) return

      // 使用改进的解析逻辑，保留原始编码
      const paramPairs = queryString.split("&")
      const newParams: RequestParam[] = []
      let hasChanges = false
      
      // 获取现有参数的映射（name -> param对象）
      const existingParamsMap = new Map<string, RequestParam>()
      requestParams.forEach(param => {
        if (param.name) {
          existingParamsMap.set(param.name, param)
        }
      })

      paramPairs.forEach(pair => {
        const equalIndex = pair.indexOf("=")
        let name = ""
        let value = ""
        
        if (equalIndex > 0) {
          name = pair.substring(0, equalIndex)
          value = pair.substring(equalIndex + 1)
        } else if (equalIndex === -1) {
          // 没有等号的参数
          name = pair
          value = ""
        }

        if (name) {
          // 只对参数名进行解码，保持值的原始编码状态
          let decodedName = ""
          try {
            decodedName = decodeURIComponent(name)
          } catch {
            decodedName = name // 如果解码失败，使用原始值
          }
          
          const existingParam = existingParamsMap.get(decodedName)
          if (existingParam) {
            // 更新现有参数的值（如果值不同）
            if (existingParam.value !== value) {
              existingParam.value = value
              hasChanges = true
            }
          } else {
            // 添加新参数
            newParams.push({
              id: nextParamId.current.toString(),
              name: decodedName,
              value: value, // 保持原始编码值
              type: "String",
              enabled: true,
            })
            nextParamId.current += 1
            hasChanges = true
          }
        }
      })

      // 只有在有实际变化时才更新状态
      if (newParams.length > 0 || hasChanges) {
        setRequestParams(prevParams => [...prevParams, ...newParams])
        setAutoParseStatus(`已同步 ${newParams.length} 个新参数`)
      } else {
        setAutoParseStatus("参数已是最新")
      }

      // 2秒后清除状态提示
      setTimeout(() => {
        setAutoParseStatus("")
      }, 2000)

    } catch (error) {
      console.error("Error auto-parsing URL parameters:", error)
      setAutoParseStatus("同步失败")
      setTimeout(() => {
        setAutoParseStatus("")
      }, 2000)
    }
  }, [requestParams])

  // 旧的自动解析函数（保留兼容性）
  const autoParseUrlParameters = (inputUrl: string) => {
    setUrl(inputUrl)
    autoParseUrlParametersDebounced(inputUrl)
  }

  // Parse URL parameters on demand (手动解析按钮功能)
  const parseUrlParameters = () => {
    try {
      if (!url.includes("?")) {
        toast({
          title: "提示",
          description: "URL中没有找到查询参数",
        })
        return
      }

      const queryString = url.split("?")[1]
      if (!queryString) return

      // 手动解析查询参数，避免URLSearchParams的自动解码
      const paramPairs = queryString.split("&")
      const newParams: RequestParam[] = []
      let updatedCount = 0

      // 获取现有参数的映射
      const existingParamsMap = new Map<string, RequestParam>()
      requestParams.forEach(param => {
        if (param.name) {
          existingParamsMap.set(param.name, param)
        }
      })

      paramPairs.forEach(pair => {
        const equalIndex = pair.indexOf("=")
        let name = ""
        let value = ""
        
        if (equalIndex > 0) {
          name = pair.substring(0, equalIndex)
          value = pair.substring(equalIndex + 1)
        } else if (equalIndex === -1) {
          // 没有等号的参数
          name = pair
          value = ""
        }

        if (name) {
          // 只对参数名进行解码，保持值的原始编码状态
          const decodedName = decodeURIComponent(name)
          
          const existingParam = existingParamsMap.get(decodedName)
        if (existingParam) {
          // 更新现有参数的值
          if (existingParam.value !== value) {
            existingParam.value = value
            updatedCount++
          }
        } else {
          // 添加新参数
          newParams.push({
            id: nextParamId.current.toString(),
              name: decodedName,
              value: value, // 保持原始编码值
            type: "String",
            enabled: true,
          })
          nextParamId.current += 1
          }
        }
      })

      // 更新参数列表
      if (newParams.length > 0 || updatedCount > 0) {
        setRequestParams([...requestParams, ...newParams])
        
        // 清理URL，移除查询参数
        const baseUrl = url.split("?")[0]
        setUrl(baseUrl)

        toast({
          title: "解析成功",
          description: `添加了 ${newParams.length} 个新参数，更新了 ${updatedCount} 个现有参数`,
        })
      } else {
        toast({
          title: "提示", 
          description: "所有参数都已存在且值相同",
        })
      }

    } catch (error) {
      console.error("Error parsing URL parameters:", error)
      toast({
        title: "解析错误",
        description: "URL参数解析失败，请检查URL格式",
        variant: "destructive",
      })
    }
  }

  // Method badge color
  const getMethodColor = (method: string) => {
    switch (method) {
      case "GET":
        return "bg-blue-500 hover:bg-blue-600"
      case "POST":
        return "bg-green-500 hover:bg-green-600"
      case "PUT":
        return "bg-yellow-500 hover:bg-yellow-600"
      case "DELETE":
        return "bg-red-500 hover:bg-red-600"
      case "PATCH":
        return "bg-purple-500 hover:bg-purple-600"
      default:
        return "bg-gray-500 hover:bg-gray-600"
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
    <div className="container mx-auto py-6 px-4 max-w-7xl">
      {/* 页面标题 */}
      <div className="text-center space-y-4 mb-8">
        <h1 className="text-3xl font-bold flex items-center justify-center gap-2">
          <Globe className="h-8 w-8 text-blue-500" />
          HTTP 请求测试工具
        </h1>
        <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
          强大的HTTP客户端，支持多种请求方式、环境变量、历史记录和cURL导入导出
        </p>
        <Alert className="max-w-2xl mx-auto">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            因浏览器CORS限制，采用代理请求方式（非本地浏览器请求），介意勿用
          </AlertDescription>
        </Alert>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* 侧边栏 */}
        <div className="lg:col-span-1 space-y-4">
          {/* 环境选择 */}
      <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Settings className="h-4 w-4" />
                环境设置
              </CardTitle>
        </CardHeader>
            <CardContent className="pt-0">
              <Select value={currentEnvironment} onValueChange={setCurrentEnvironment}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {environments.map(env => (
                    <SelectItem key={env.id} value={env.id}>{env.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* 快捷操作 */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Zap className="h-4 w-4" />
                快捷操作
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
                保存为模板
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowHistory(!showHistory)}
                className="w-full gap-2"
              >
                <History className="h-4 w-4" />
                历史记录 ({history.length})
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowTemplates(!showTemplates)}
                className="w-full gap-2"
              >
                <Bookmark className="h-4 w-4" />
                模板库 ({templates.length})
              </Button>
            </CardContent>
          </Card>

          {/* 历史记录 */}
          {showHistory && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <History className="h-4 w-4" />
                  最近请求
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <ScrollArea className="h-64">
                  <div className="space-y-2">
                    {history.slice(0, 10).map(item => (
                      <div
                        key={item.id}
                        className="p-2 border rounded cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => loadFromHistory(item)}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <Badge
                            variant="outline"
                            className={`text-xs ${getMethodColor(item.method)} text-white border-0`}
                          >
                            {item.method}
                          </Badge>
                          {item.status && (
                            <Badge className={`text-xs ${getStatusColor(item.status)} text-white`}>
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
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}

          {/* 模板库 */}
          {showTemplates && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Bookmark className="h-4 w-4" />
                  请求模板
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <ScrollArea className="h-64">
                  <div className="space-y-2">
                    {templates.map(template => (
                      <div
                        key={template.id}
                        className="p-2 border rounded cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => loadFromTemplate(template)}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <Badge
                            variant="outline"
                            className={`text-xs ${getMethodColor(template.method)} text-white border-0`}
                          >
                            {template.method}
                          </Badge>
                        </div>
                        <div className="text-sm font-medium">{template.name}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {template.url}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}
        </div>

        {/* 主内容区域 */}
        <div className="lg:col-span-3">
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Send className="h-5 w-5" />
                  HTTP 请求构建器
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const curl = generateCurl()
                      navigator.clipboard.writeText(curl)
                      toast({ title: "cURL已复制到剪贴板" })
                    }}
                    className="gap-2"
                  >
                    <Download className="h-4 w-4" />
                    导出cURL
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const curlCommand = prompt("请粘贴cURL命令:")
                      if (curlCommand) parseCurl(curlCommand)
                    }}
                    className="gap-2"
                  >
                    <Upload className="h-4 w-4" />
                    导入cURL
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* 请求URL配置 */}
              <div className="space-y-4">
          <div className="flex flex-col md:flex-row items-stretch gap-2">
            <div className="flex-shrink-0 w-full md:w-auto">
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger
                  className={`w-full md:w-[120px] font-medium ${getMethodColor(method)} text-white border-0`}
                >
                  <SelectValue placeholder="Method" />
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

                              <div className="flex-grow space-y-2">
                    <div className="relative">
                      <Input
                        className="h-full pr-10"
                        value={url}
                        onChange={handleUrlChange}
                        placeholder="https://example.com?param=value (支持复杂编码和 {{变量}} 语法)"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-1 top-1/2 transform -translate-y-1/2 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                        onClick={parseUrlParameters}
                        title="手动解析URL中的查询参数到参数表格（保留原始编码）"
                      >
                        <Database className="h-4 w-4 text-blue-600" />
                      </Button>
                    </div>
                    
                    {/* 自动同步状态提示 */}
                    {autoParseStatus && (
                      <div className="flex items-center gap-2 text-xs">
                        {autoParseStatus.includes("等待") && (
                          <Clock className="h-3 w-3 text-orange-500" />
                        )}
                        {autoParseStatus.includes("正在") && (
                          <Loader2 className="h-3 w-3 text-blue-500 animate-spin" />
                        )}
                        {autoParseStatus.includes("已同步") && (
                          <CheckCircle2 className="h-3 w-3 text-green-500" />
                        )}
                        {autoParseStatus.includes("失败") && (
                          <AlertCircle className="h-3 w-3 text-red-500" />
                        )}
                        {autoParseStatus.includes("最新") && (
                          <CheckCircle2 className="h-3 w-3 text-blue-500" />
                        )}
                        <span className={`
                          ${autoParseStatus.includes("等待") ? "text-orange-600" : ""}
                          ${autoParseStatus.includes("正在") ? "text-blue-600" : ""}
                          ${autoParseStatus.includes("已同步") ? "text-green-600" : ""}
                          ${autoParseStatus.includes("失败") ? "text-red-600" : ""}
                          ${autoParseStatus.includes("最新") ? "text-blue-600" : ""}
                        `}>
                          自动同步: {autoParseStatus}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    {loading && (
                      <Button
                        variant="destructive"
                        onClick={cancelRequest}
                        className="gap-2"
                      >
                        <X className="h-4 w-4" />
                        取消
                      </Button>
                    )}
            <Button
              onClick={handleSubmit}
              disabled={loading}
              className="flex-shrink-0 gap-2 bg-primary hover:bg-primary/90"
            >
              {loading ? (
                <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          发送中...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                          发送请求
                </>
              )}
            </Button>
                  </div>
          </div>

                {/* 环境变量提示 */}
                {currentEnvironment !== 'default' && (
                  <Alert>
                    <Settings className="h-4 w-4" />
                    <AlertDescription>
                      当前使用环境: <strong>{environments.find(e => e.id === currentEnvironment)?.name}</strong>
                      ，支持在URL、请求头和请求体中使用 <code>{'{{变量名}}'}</code> 语法
                    </AlertDescription>
                  </Alert>
                )}
              </div>

              {/* 请求配置选项卡 */}
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid grid-cols-3 mb-6">
              <TabsTrigger value="params" className="flex items-center gap-2">
                <Database className="h-4 w-4" />
                    查询参数
              </TabsTrigger>
              <TabsTrigger value="headers" className="flex items-center gap-2">
                <Code className="h-4 w-4" />
                    请求头
              </TabsTrigger>
              <TabsTrigger value="body" className="flex items-center gap-2">
                <FileJson className="h-4 w-4" />
                    请求体
              </TabsTrigger>
            </TabsList>

                            <TabsContent value="params">
                  <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <div className="flex items-start gap-2">
                      <Database className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                      <div className="text-sm text-blue-800 dark:text-blue-200">
                        <div className="font-medium mb-1">URL参数自动同步说明</div>
                        <ul className="text-xs space-y-1 text-blue-700 dark:text-blue-300">
                          <li>• 输入URL后会延迟1秒自动同步参数到下方表格</li>
                          <li>• 自动同步保留复杂编码（如 %252），不会转义</li>
                          <li>• 右侧按钮可立即手动解析参数</li>
                          <li>• 在参数表格中修改参数时，特殊字符会自动编码</li>
                          <li>• 支持环境变量语法：<code className="px-1 bg-blue-100 dark:bg-blue-800 rounded">{'{{变量名}}'}</code></li>
                        </ul>
                      </div>
                    </div>
                  </div>
                  <div className="border rounded-md overflow-hidden">
                <Table>
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
                            placeholder="Query name"
                            className="h-8"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={param.value}
                            onChange={(e) => updateParam(param.id, "value", e.target.value)}
                            placeholder="Query value"
                            className="h-8"
                          />
                        </TableCell>
                        <TableCell>
                          <Select value={param.type} onValueChange={(value) => updateParam(param.id, "type", value)}>
                            <SelectTrigger className="h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="String">String</SelectItem>
                              <SelectItem value="Number">Number</SelectItem>
                              <SelectItem value="Boolean">Boolean</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => removeParam(param.id)}>
                            <Trash2 className="h-4 w-4 text-red-500" />
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
              <div className="border rounded-md overflow-hidden">
                <Table>
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
                            placeholder="Header name"
                            className="h-8"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={header.value}
                            onChange={(e) => updateHeader(header.id, "value", e.target.value)}
                            placeholder="Header value"
                            className="h-8"
                          />
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => removeHeader(header.id)}>
                            <Trash2 className="h-4 w-4 text-red-500" />
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
                          placeholder="Request body (JSON, XML, etc.)"
                          rows={8}
                          className="font-mono text-sm"
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute right-2 top-2"
                          onClick={clearRequestBody}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    )}

                    {bodyType === "form-data" && (
                      <div className="border rounded-md overflow-hidden">
                        <Table>
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
                                    placeholder="Key"
                                    className="h-8"
                                  />
                                </TableCell>
                                <TableCell>
                                  {param.type === "String" ? (
                                    <Input
                                      value={param.value}
                                      onChange={(e) => updateFormDataParam(param.id, "value", e.target.value)}
                                      placeholder="Value"
                                      className="h-8"
                                    />
                                  ) : (
                                    <div className="flex items-center justify-between">
                                      <input
                                        type="file"
                                        ref={binaryInputRef}
                                        onChange={handleBinaryFileChange}
                                        className="hidden"
                                      />
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => binaryInputRef.current?.click()}
                                      >
                                        {binaryFile ? binaryFile.name : t("selectBinaryFile")}
                                      </Button>
                                    </div>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <Select
                                    value={param.type}
                                    onValueChange={(value) => updateFormDataParam(param.id, "type", value)}
                                  >
                                    <SelectTrigger className="h-8">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="String">String</SelectItem>
                                      <SelectItem value="File">File</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </TableCell>
                                <TableCell>
                                  <Button variant="ghost" size="icon" onClick={() => removeFormDataParam(param.id)}>
                                    <Trash2 className="h-4 w-4 text-red-500" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                        <div className="p-2 border-t bg-muted/20">
                          <Button variant="outline" size="sm" onClick={addFormDataParam} className="gap-1">
                            <Plus className="h-4 w-4" />
                            {t("addFormData")}
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
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  响应结果
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">

              {statusInfo.statusCode && (
                <div className="flex items-center gap-2 mb-4">
                  <Badge className={`${getStatusColor(Number.parseInt(statusInfo.statusCode))} text-white`}>
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
                <TabsList className="grid grid-cols-4 mb-4">
                  <TabsTrigger value="response" className="flex items-center gap-2">
                    <FileJson className="h-4 w-4" />
                    {t("response")}
                  </TabsTrigger>
                  <TabsTrigger value="responseHeaders" className="flex items-center gap-2">
                    <Code className="h-4 w-4" />
                    {t("responseHeaders")}
                  </TabsTrigger>
                  <TabsTrigger value="requestHeaders" className="flex items-center gap-2">
                    <Code className="h-4 w-4" />
                    {t("requestHeaders")}
                  </TabsTrigger>
                  <TabsTrigger value="timings" className="flex items-center gap-2">
                    <ExternalLink className="h-4 w-4" />
                    {t("timings")}
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="response">
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
                    >
                      {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </TabsContent>

                <TabsContent value="responseHeaders">
                  <div className="border rounded-md overflow-hidden">
                    <Table>
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
                  <div className="border rounded-md overflow-hidden">
                    <Table>
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
                  <div className="border rounded-md overflow-hidden">
                    <Table>
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
                            <TableCell>{value ? <Badge variant="outline">{value}ms</Badge> : "N/A"}</TableCell>
                          </TableRow>
                        ))}
                        <TableRow>
                          <TableCell className="font-medium">{t("statusCode")}</TableCell>
                          <TableCell>
                            <Badge className={`${getStatusColor(Number.parseInt(statusInfo.statusCode))} text-white`}>
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
    </div>
  )
}
