"use client"

import type React from "react"

import { useState, useCallback, useEffect, useRef } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { 
  Search, Globe, Calendar, User, Building, MapPin, Mail, Phone, RefreshCw, AlertTriangle,
  Server, Database, Copy, Download, History, Clock, Info, Network, Shield, CheckCircle2,
  ExternalLink, Activity, Zap, BarChart3, Eye, Trash2, Settings
} from "lucide-react"
import { useTranslations } from "@/hooks/use-translations"

// RDAP查询结果接口
interface RdapData {
  domainName?: string
  registrar?: string
  registrarUrl?: string
  creationDate?: string
  expiryDate?: string
  updatedDate?: string
  registrant?: {
    name?: string
    organization?: string
    email?: string
    phone?: string
    address?: string
    city?: string
    state?: string
    country?: string
    postalCode?: string
  }
  nameServers?: string[]
  status?: string[]
  dnssec?: string
  rdapServer?: string
  queryType?: 'domain' | 'ip'
  ipVersion?: 'v4' | 'v6'
  raw?: string
  error?: string
  details?: string
  queryTime?: number
  networkInfo?: {
    name?: string
    handle?: string
    startAddress?: string
    endAddress?: string
    ipVersion?: string
    type?: string
    country?: string
    parentHandle?: string
  }
}

// 查询历史记录接口
interface QueryHistory {
  id: string
  query: string
  type: 'domain' | 'ip'
  timestamp: number
  success: boolean
  rdapServer?: string
  duration?: number
}

// 支持的查询类型
type QueryType = 'domain' | 'ipv4' | 'ipv6' | 'auto'

// Helper function to extract TLD from domain
function extractTLD(domain: string): string {
  const parts = domain.split(".")
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : ""
}

// Helper function to detect query type
function detectQueryType(query: string): QueryType {
  // IPv4 address
  const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/
  if (ipv4Regex.test(query)) {
    return 'ipv4'
  }
  
  // IPv6 address (simplified check)
  const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^::1$|^::$/
  if (ipv6Regex.test(query) || query.includes(':')) {
    return 'ipv6'
  }
  
  // Domain name
  if (query.includes('.') && !query.includes(' ')) {
    return 'domain'
  }
  
  return 'auto'
}

// Helper function to get RDAP server for IP addresses
async function getIpRdapServer(ip: string, ipVersion: 'v4' | 'v6'): Promise<string | null> {
  try {
    const serviceType = ipVersion === 'v4' ? 'ipv4' : 'ipv6'
    const response = await fetch(`https://data.iana.org/rdap/${serviceType}.json`, {
      cache: "force-cache",
    })
    
    if (!response.ok) {
      return null
    }
    
    const text = await response.text()
    const jsonString = text.substring(text.indexOf("=") + 1).trim().replace(";", "")
    const data = JSON.parse(jsonString)
    
    // For IP addresses, we need more complex logic to find the right service
    // This is a simplified version
    if (data.services && data.services.length > 0) {
      // Return the first available RDAP server as fallback
      return data.services[0][1][0]
    }
    
    return null
  } catch (error) {
    console.error("Error fetching IP RDAP server:", error)
    return null
  }
}

// Helper function to parse vCard array from RDAP response
function parseVCardArray(vcardArray: any[]): Record<string, string> {
  if (!vcardArray || !Array.isArray(vcardArray) || vcardArray.length < 2) {
    return {}
  }

  const result: Record<string, string> = {}
  const fields = vcardArray[1]

  for (const field of fields) {
    if (Array.isArray(field) && field.length >= 4) {
      const [type, , , value] = field
      if (typeof value === "string") {
        result[type] = value
      }
    }
  }

  return result
}

// Helper function to find entity by role
function findEntityByRole(entities: any[], role: string): any | null {
  if (!entities || !Array.isArray(entities)) return null

  return entities.find((entity) => entity.roles && Array.isArray(entity.roles) && entity.roles.includes(role))
}

// Helper function to find RDAP base URL from dns.js
async function getRdapBaseUrl(domain: string): Promise<string | null> {
  try {
    // Fetch dns.js from IANA
    const response = await fetch("https://data.iana.org/rdap/dns.json", {
      cache: "force-cache",
    })
    if (!response.ok) {
      console.error(`Failed to fetch dns.js: ${response.status} ${response.statusText}`)
      return null
    }

    const text = await response.text()

    // Extract JSON from dns.js
    const jsonString = text
      .substring(text.indexOf("=") + 1)
      .trim()
      .replace(";", "")
    const data = JSON.parse(jsonString)

    const tld = extractTLD(domain)
    const tldData = data.services.find((service: any) => service[0].includes(tld))

    if (tldData && tldData[1] && tldData[1].length > 0) {
      return tldData[1][0] // Return the first RDAP base URL
    }

    return null
  } catch (error) {
    console.error("Error fetching or parsing dns.js:", error)
    return null
  }
}

export default function RdapQueryPage({ params }: { params?: Record<string, string> }) {
  const t = useTranslations("whois")
  const { toast } = useToast()
  
  // 基本状态
  const [query, setQuery] = useState(params?.domain || "")
  const [rdapData, setRdapData] = useState<RdapData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState("formatted")
  
  // 查询设置
  const [queryType, setQueryType] = useState<QueryType>('auto')
  const [history, setHistory] = useState<QueryHistory[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [queryStats, setQueryStats] = useState({
    total: 0,
    successful: 0,
    avgResponseTime: 0
  })

  // Function to extract domain from text
  const extractDomain = (text: string): string => {
    // Match domain patterns
    const domainRegex = /(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+)(?:\/[^\s]*)?/i
    const match = text.match(domainRegex)

    if (match && match[1]) {
      return match[1]
    }

    // If no domain pattern found, return the original text
    return text.trim()
  }

  // 保存查询历史
  const saveToHistory = useCallback((queryText: string, type: 'domain' | 'ip', success: boolean, server?: string, duration?: number) => {
    const historyItem: QueryHistory = {
      id: Date.now().toString(),
      query: queryText,
      type,
      timestamp: Date.now(),
      success,
      rdapServer: server,
      duration
    }
    
    setHistory(prev => [historyItem, ...prev].slice(0, 50)) // 保留最近50条
    
    // 更新统计
    setQueryStats(prev => ({
      total: prev.total + 1,
      successful: prev.successful + (success ? 1 : 0),
      avgResponseTime: duration ? Math.round((prev.avgResponseTime * prev.total + duration) / (prev.total + 1)) : prev.avgResponseTime
    }))
  }, [])

  const fetchRdapData = useCallback(async (queryText: string) => {
    if (!queryText) return

    setLoading(true)
    setError(null)
    const startTime = Date.now()

    try {
      const detectedType = detectQueryType(queryText)
      const actualQueryType = queryType === 'auto' ? detectedType : queryType
      
      let rdapBaseUrl: string | null = null
      let rdapUrl: string = ""
      let queryTarget: string = ""

      if (actualQueryType === 'domain') {
        queryTarget = extractDomain(queryText)
        rdapBaseUrl = await getRdapBaseUrl(queryTarget)
        rdapUrl = `${rdapBaseUrl}domain/${encodeURIComponent(queryTarget)}`
      } else if (actualQueryType === 'ipv4' || actualQueryType === 'ipv6') {
        queryTarget = queryText.trim()
        const ipVersion = actualQueryType === 'ipv4' ? 'v4' : 'v6'
        rdapBaseUrl = await getIpRdapServer(queryTarget, ipVersion)
        rdapUrl = `${rdapBaseUrl}ip/${encodeURIComponent(queryTarget)}`
      } else {
        throw new Error("无法确定查询类型，请选择具体的查询类型")
      }

      if (!rdapBaseUrl) {
        const duration = Date.now() - startTime
        saveToHistory(queryText, actualQueryType === 'domain' ? 'domain' : 'ip', false, undefined, duration)
        return setRdapData({
          error: "无法确定此查询的RDAP服务器",
          domainName: queryTarget,
          raw: JSON.stringify({ error: "Could not determine RDAP server" }, null, 2),
          queryType: actualQueryType === 'domain' ? 'domain' : 'ip',
          rdapServer: "未知"
        })
      }

      console.log(`Querying RDAP server: ${rdapUrl}`)
      const response = await fetch(rdapUrl)

      // 特殊处理404错误
      if (response.status === 404) {
        const duration = Date.now() - startTime
        saveToHistory(queryText, actualQueryType === 'domain' ? 'domain' : 'ip', false, rdapBaseUrl, duration)
        return setRdapData({
          error: "我们无法连接到已识别的注册管理机构的 RDAP 服务器。",
          domainName: queryTarget,
          raw: JSON.stringify({ error: "RDAP server returned 404 Not Found" }, null, 2),
          queryType: actualQueryType === 'domain' ? 'domain' : 'ip',
          rdapServer: rdapBaseUrl
        })
      }

      if (!response.ok) {
        throw new Error(`RDAP server returned ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      const duration = Date.now() - startTime
      console.log("RDAP primary response received")

      // Step 2: Check if there's a related link to get more detailed information
      let detailedData = null
      if (data.links && Array.isArray(data.links)) {
        const relatedLink = data.links.find((link: any) => link.rel === "related" && link.href)

        if (relatedLink && relatedLink.href) {
          try {
            console.log(`Fetching related data from: ${relatedLink.href}`)
            const detailedResponse = await fetch(relatedLink.href)

            if (detailedResponse.ok) {
              detailedData = await detailedResponse.json()
              console.log("RDAP detailed response received")
            }
          } catch (error) {
            console.error("Error fetching detailed RDAP data:", error)
            // Continue with primary data if detailed fetch fails
          }
        }
      }

      // Combine data from both responses, with detailed data taking precedence
      const combinedData = detailedData || data
      const queryTargetName = combinedData.ldhName || queryTarget

      // Process different types of RDAP responses
      let resultData: RdapData

      if (actualQueryType === 'domain') {
        // Domain RDAP response processing
        const events = combinedData.events || []
        const registrationEvent = events.find((e: any) => e.eventAction === "registration")
        const expirationEvent = events.find((e: any) => e.eventAction === "expiration")
        const updateEvent = events.find(
          (e: any) => e.eventAction === "last changed" || e.eventAction === "last update of RDAP database",
        )

        const registrarEntity = findEntityByRole(combinedData.entities, "registrar")
        const registrarVCard = registrarEntity ? parseVCardArray(registrarEntity.vcardArray) : {}

        const registrantEntity = findEntityByRole(combinedData.entities, "registrant")
        const registrantVCard = registrantEntity ? parseVCardArray(registrantEntity.vcardArray) : {}

        resultData = {
          domainName: queryTargetName,
          registrar:
            registrarVCard.org ||
            registrarVCard.fn ||
            (registrarEntity?.publicIds?.[0]?.identifier
              ? `IANA ID: ${registrarEntity.publicIds[0].identifier}`
              : "Unknown"),
          registrarUrl: registrarVCard.url,
          creationDate: registrationEvent?.eventDate,
          expiryDate: expirationEvent?.eventDate,
          updatedDate: updateEvent?.eventDate,
          registrant: {
            name: registrantVCard.fn || "Redacted for Privacy",
            organization: registrantVCard.org,
            email: registrantVCard.email,
            phone: registrantVCard.tel,
            address: registrantVCard.adr,
            city: registrantVCard.locality,
            state: registrantVCard.region,
            country: registrantVCard.country,
            postalCode: registrantVCard["postal-code"],
          },
          nameServers: (combinedData.nameservers || []).map((ns: any) => ns.ldhName),
          status: combinedData.status || [],
          dnssec: combinedData.secureDNS?.delegationSigned ? "signed" : "unsigned",
          queryType: 'domain',
          rdapServer: rdapBaseUrl,
          queryTime: duration,
          raw: JSON.stringify(combinedData, null, 2),
        }
      } else {
        // IP RDAP response processing
        resultData = {
          domainName: queryTargetName,
          queryType: 'ip',
          ipVersion: actualQueryType === 'ipv4' ? 'v4' : 'v6',
          rdapServer: rdapBaseUrl,
          queryTime: duration,
          networkInfo: {
            name: combinedData.name,
            handle: combinedData.handle,
            startAddress: combinedData.startAddress,
            endAddress: combinedData.endAddress,
            ipVersion: combinedData.ipVersion,
            type: combinedData.type,
            country: combinedData.country,
            parentHandle: combinedData.parentHandle
          },
          status: combinedData.status || [],
          raw: JSON.stringify(combinedData, null, 2),
        }
      }

      // Save successful query to history
      saveToHistory(queryText, actualQueryType === 'domain' ? 'domain' : 'ip', true, rdapBaseUrl, duration)
      
      setRdapData(resultData)
      
      toast({
        title: "查询成功",
        description: `RDAP查询完成，耗时 ${duration}ms`
      })
    } catch (error) {
      const duration = Date.now() - startTime
      console.error("RDAP lookup error:", error)
      
      const detectedType = detectQueryType(queryText)
      const actualQueryType = queryType === 'auto' ? detectedType : queryType
      
      saveToHistory(queryText, actualQueryType === 'domain' ? 'domain' : 'ip', false, undefined, duration)
      
      setRdapData({
        error: "获取RDAP信息失败，请稍后重试。",
        details: error instanceof Error ? error.message : String(error),
        queryType: actualQueryType === 'domain' ? 'domain' : 'ip',
        domainName: queryText,
        raw: JSON.stringify({ error: error instanceof Error ? error.message : String(error) }, null, 2),
      })
      
      toast({
        title: "查询失败",
        description: error instanceof Error ? error.message : "网络错误",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }, [queryType, saveToHistory, toast])

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    fetchRdapData(query)
  }

  // Load from history
  const loadFromHistory = (historyItem: QueryHistory) => {
    setQuery(historyItem.query)
    setQueryType(historyItem.type === 'domain' ? 'domain' : 'auto')
    fetchRdapData(historyItem.query)
  }

  // Copy function
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast({
      title: "已复制",
      description: "内容已复制到剪贴板"
    })
  }

  // Auto-fetch if domain is provided in params
  useEffect(() => {
    if (params?.domain) {
      setQuery(params.domain)
      fetchRdapData(params.domain)
    }
  }, [params?.domain, fetchRdapData])

  // 在formatDate函数中添加更好的错误处理
  const formatDate = (dateString?: string) => {
    if (!dateString) return "N/A"
    try {
      // RDAP dates are in ISO 8601 format
      const date = new Date(dateString)
      if (isNaN(date.getTime())) return dateString
      return date.toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    } catch (e) {
      return dateString
    }
  }

  return (
    <div className="container mx-auto py-6 px-4 max-w-7xl">
      {/* 页面标题 */}
      <div className="text-center space-y-4 mb-8">
        <h1 className="text-3xl font-bold flex items-center justify-center gap-2">
          <Database className="h-8 w-8 text-blue-500" />
          RDAP 查询工具
        </h1>
        <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
          现代化的注册数据访问协议（RDAP）查询工具，支持域名和IP地址查询，提供结构化的JSON数据
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* 侧边栏 - 查询设置和历史 */}
        <div className="lg:col-span-1 space-y-4">
          {/* 查询类型选择 */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Settings className="h-4 w-4" />
                查询设置
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-sm font-medium">查询类型</Label>
                <Select value={queryType} onValueChange={(value: QueryType) => setQueryType(value)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">自动检测</SelectItem>
                    <SelectItem value="domain">域名</SelectItem>
                    <SelectItem value="ipv4">IPv4地址</SelectItem>
                    <SelectItem value="ipv6">IPv6地址</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {/* 查询统计 */}
              <div className="p-3 bg-muted rounded-lg space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>总查询数:</span>
                  <Badge variant="outline">{queryStats.total}</Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span>成功率:</span>
                  <Badge variant="outline">
                    {queryStats.total > 0 ? Math.round((queryStats.successful / queryStats.total) * 100) : 0}%
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span>平均响应:</span>
                  <Badge variant="outline">{queryStats.avgResponseTime}ms</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 查询历史 */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <History className="h-4 w-4" />
                  查询历史 ({history.length})
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowHistory(!showHistory)}
                >
                  <Eye className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            {showHistory && (
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
                            variant={item.success ? "default" : "destructive"}
                            className="text-xs"
                          >
                            {item.type.toUpperCase()}
                          </Badge>
                          {item.duration && (
                            <span className="text-xs text-muted-foreground">
                              {item.duration}ms
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {item.query}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(item.timestamp).toLocaleString()}
                        </div>
                      </div>
                    ))}
                    {history.length === 0 && (
                      <div className="text-center text-muted-foreground text-sm py-4">
                        暂无查询历史
                      </div>
                    )}
                  </div>
                </ScrollArea>
                {history.length > 0 && (
                  <div className="pt-3 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setHistory([])}
                      className="w-full gap-2"
                    >
                      <Trash2 className="h-4 w-4" />
                      清空历史
                    </Button>
                  </div>
                )}
              </CardContent>
            )}
          </Card>
        </div>

        {/* 主内容区域 */}
        <div className="lg:col-span-3">
          {/* 查询表单 */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-5 w-5" />
                RDAP 查询
              </CardTitle>
              <CardDescription>
                输入域名（如 example.com）或IP地址（IPv4/IPv6）进行RDAP查询
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="flex gap-2">
                  <div className="relative flex-grow">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      type="text"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="输入域名或IP地址 (如: example.com, 8.8.8.8, 2001:4860:4860::8888)"
                      className="pl-10"
                    />
                  </div>
                  <Button type="submit" disabled={loading} className="gap-2">
                    {loading ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        查询中...
                      </>
                    ) : (
                      <>
                        <Database className="h-4 w-4" />
                        查询
                      </>
                    )}
                  </Button>
                </div>
                
                {/* 查询类型自动检测提示 */}
                {query && (
                  <div className="text-sm text-muted-foreground">
                    检测到查询类型: <Badge variant="outline" className="ml-1">
                      {detectQueryType(query).toUpperCase()}
                    </Badge>
                  </div>
                )}
              </form>
            </CardContent>
          </Card>

          {/* 加载状态 */}
          {loading && (
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <RefreshCw className="h-5 w-5 animate-spin text-blue-500" />
                  <span className="text-lg font-medium">正在查询 RDAP 数据...</span>
                </div>
                <div className="space-y-4">
                  <Skeleton className="h-8 w-1/3" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    <div className="space-y-2">
                      <Skeleton className="h-6 w-1/2" />
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-full" />
                    </div>
                    <div className="space-y-2">
                      <Skeleton className="h-6 w-1/2" />
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-full" />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 错误显示 */}
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>查询失败</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* 查询结果 */}
          {rdapData && !loading && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    {(rdapData!.queryType || 'domain') === 'domain' ? (
                      <Globe className="h-5 w-5 text-blue-500" />
                    ) : (
                      <Network className="h-5 w-5 text-green-500" />
                    )}
                    {rdapData!.domainName || query}
                    {rdapData!.ipVersion && (
                      <Badge variant="outline" className="ml-2">
                        IPv{rdapData!.ipVersion === 'v4' ? '4' : '6'}
                      </Badge>
                    )}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(rdapData!.raw || '')}
                      className="gap-2"
                    >
                      <Copy className="h-4 w-4" />
                      复制数据
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const blob = new Blob([rdapData!.raw || ''], { type: 'application/json' })
                        const url = URL.createObjectURL(blob)
                        const a = document.createElement('a')
                        a.href = url
                        a.download = `rdap-${query}-${Date.now()}.json`
                        a.click()
                        URL.revokeObjectURL(url)
                      }}
                      className="gap-2"
                    >
                      <Download className="h-4 w-4" />
                      导出JSON
                    </Button>
                  </div>
                </div>
                {rdapData!.rdapServer && (
                  <CardDescription className="flex items-center gap-2">
                    <Server className="h-4 w-4" />
                    RDAP服务器: <code className="text-sm bg-muted px-1 rounded">{rdapData!.rdapServer}</code>
                    {rdapData!.queryTime && (
                      <>
                        <Clock className="h-4 w-4 ml-2" />
                        查询耗时: {rdapData!.queryTime}ms
                      </>
                    )}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList className="mb-6">
                    <TabsTrigger value="formatted" className="gap-2">
                      <Info className="h-4 w-4" />
                      格式化数据
                    </TabsTrigger>
                    <TabsTrigger value="raw" className="gap-2">
                      <Database className="h-4 w-4" />
                      原始JSON
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="formatted" className="space-y-6">
                    {rdapData!.error ? (
                      <Alert>
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>无法获取数据</AlertTitle>
                        <AlertDescription>{rdapData!.error}</AlertDescription>
                      </Alert>
                    ) : (
                      <div className="space-y-6">
                        {/* 域名信息 */}
                        {(rdapData!.queryType || 'domain') === 'domain' && (
                          <Accordion type="multiple" defaultValue={["domain-info", "registrant-info"]}>
                            {/* 域名基本信息 */}
                            <AccordionItem value="domain-info">
                              <AccordionTrigger className="text-lg font-semibold">
                                <div className="flex items-center gap-2">
                                  <Globe className="h-5 w-5" />
                                  域名信息
                                </div>
                              </AccordionTrigger>
                              <AccordionContent className="space-y-4">
                                {rdapData!.registrar && (
                                  <div className="flex items-center gap-2">
                                    <Building className="h-4 w-4 text-muted-foreground" />
                                    <span className="font-medium">注册商:</span>
                                    <span>{rdapData!.registrar}</span>
                                    {rdapData!.registrarUrl && (
                                      <a
                                        href={rdapData!.registrarUrl.startsWith("http") ? rdapData!.registrarUrl : `https://${rdapData!.registrarUrl}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-blue-500 hover:underline inline-flex items-center gap-1"
                                      >
                                        <ExternalLink className="h-3 w-3" />
                                        访问
                                      </a>
                                    )}
                                  </div>
                                )}

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                  {rdapData!.creationDate && (
                                    <div className="flex flex-col gap-1">
                                      <div className="flex items-center gap-2">
                                        <Calendar className="h-4 w-4 text-green-500" />
                                        <span className="font-medium text-sm">创建时间</span>
                                      </div>
                                      <span className="text-sm text-muted-foreground">
                                        {formatDate(rdapData!.creationDate)}
                                      </span>
                                    </div>
                                  )}

                                  {rdapData!.expiryDate && (
                                    <div className="flex flex-col gap-1">
                                      <div className="flex items-center gap-2">
                                        <Calendar className="h-4 w-4 text-red-500" />
                                        <span className="font-medium text-sm">过期时间</span>
                                      </div>
                                      <span className="text-sm text-muted-foreground">
                                        {formatDate(rdapData!.expiryDate)}
                                      </span>
                                    </div>
                                  )}

                                  {rdapData!.updatedDate && (
                                    <div className="flex flex-col gap-1">
                                      <div className="flex items-center gap-2">
                                        <Calendar className="h-4 w-4 text-blue-500" />
                                        <span className="font-medium text-sm">更新时间</span>
                                      </div>
                                      <span className="text-sm text-muted-foreground">
                                        {formatDate(rdapData!.updatedDate)}
                                      </span>
                                    </div>
                                  )}
                                </div>

                                {rdapData!.status && rdapData!.status.length > 0 && (
                                  <div>
                                    <div className="flex items-center gap-2 mb-2">
                                      <Shield className="h-4 w-4 text-muted-foreground" />
                                      <span className="font-medium">域名状态:</span>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                      {rdapData!.status.map((status, index) => (
                                        <Badge key={index} variant="outline" className="text-xs">
                                          {status}
                                        </Badge>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {rdapData!.nameServers && rdapData!.nameServers.length > 0 && (
                                  <div>
                                    <div className="flex items-center gap-2 mb-2">
                                      <Server className="h-4 w-4 text-muted-foreground" />
                                      <span className="font-medium">域名服务器:</span>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                      {rdapData!.nameServers.map((ns, index) => (
                                        <code key={index} className="text-sm bg-muted px-2 py-1 rounded">
                                          {ns}
                                        </code>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {rdapData!.dnssec && (
                                  <div className="flex items-center gap-2">
                                    <Shield className="h-4 w-4 text-muted-foreground" />
                                    <span className="font-medium">DNSSEC:</span>
                                    <Badge variant={rdapData!.dnssec === 'signed' ? 'default' : 'outline'}>
                                      {rdapData!.dnssec === 'signed' ? '已签名' : '未签名'}
                                    </Badge>
                                  </div>
                                )}
                              </AccordionContent>
                            </AccordionItem>

                            {/* 注册人信息 */}
                            {rdapData!.registrant && (
                              <AccordionItem value="registrant-info">
                                <AccordionTrigger className="text-lg font-semibold">
                                  <div className="flex items-center gap-2">
                                    <User className="h-5 w-5" />
                                    注册人信息
                                  </div>
                                </AccordionTrigger>
                                <AccordionContent className="space-y-4">
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {rdapData!.registrant.name && (
                                      <div className="flex items-center gap-2">
                                        <User className="h-4 w-4 text-muted-foreground" />
                                        <span className="font-medium">姓名:</span>
                                        <span>{rdapData!.registrant.name}</span>
                                      </div>
                                    )}

                                    {rdapData!.registrant.organization && (
                                      <div className="flex items-center gap-2">
                                        <Building className="h-4 w-4 text-muted-foreground" />
                                        <span className="font-medium">组织:</span>
                                        <span>{rdapData!.registrant.organization}</span>
                                      </div>
                                    )}

                                    {rdapData!.registrant.email && (
                                      <div className="flex items-center gap-2">
                                        <Mail className="h-4 w-4 text-muted-foreground" />
                                        <span className="font-medium">邮箱:</span>
                                        <span className="break-all">{rdapData!.registrant.email}</span>
                                      </div>
                                    )}

                                    {rdapData!.registrant.phone && (
                                      <div className="flex items-center gap-2">
                                        <Phone className="h-4 w-4 text-muted-foreground" />
                                        <span className="font-medium">电话:</span>
                                        <span>{rdapData!.registrant.phone}</span>
                                      </div>
                                    )}
                                  </div>

                                  {(rdapData!.registrant.address || rdapData!.registrant.city || rdapData!.registrant.country) && (
                                    <div>
                                      <div className="flex items-center gap-2 mb-2">
                                        <MapPin className="h-4 w-4 text-muted-foreground" />
                                        <span className="font-medium">地址:</span>
                                      </div>
                                      <address className="not-italic text-sm text-muted-foreground space-y-1">
                                        {rdapData!.registrant.address && <div>{rdapData!.registrant.address}</div>}
                                        <div>
                                          {rdapData!.registrant.city && `${rdapData!.registrant.city}, `}
                                          {rdapData!.registrant.state && `${rdapData!.registrant.state} `}
                                          {rdapData!.registrant.postalCode && rdapData!.registrant.postalCode}
                                        </div>
                                        {rdapData!.registrant.country && <div>{rdapData!.registrant.country}</div>}
                                      </address>
                                    </div>
                                  )}
                                </AccordionContent>
                              </AccordionItem>
                            )}
                          </Accordion>
                        )}

                        {/* IP地址信息 */}
                        {(rdapData!.queryType || 'domain') === 'ip' && rdapData!.networkInfo && (
                          <Accordion type="multiple" defaultValue={["network-info"]}>
                            <AccordionItem value="network-info">
                              <AccordionTrigger className="text-lg font-semibold">
                                <div className="flex items-center gap-2">
                                  <Network className="h-5 w-5" />
                                  网络信息
                                </div>
                              </AccordionTrigger>
                              <AccordionContent className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  {rdapData!.networkInfo.name && (
                                    <div className="flex items-center gap-2">
                                      <Database className="h-4 w-4 text-muted-foreground" />
                                      <span className="font-medium">网络名称:</span>
                                      <span>{rdapData!.networkInfo.name}</span>
                                    </div>
                                  )}

                                  {rdapData!.networkInfo.handle && (
                                    <div className="flex items-center gap-2">
                                      <Info className="h-4 w-4 text-muted-foreground" />
                                      <span className="font-medium">网络句柄:</span>
                                      <code className="text-sm bg-muted px-1 rounded">{rdapData!.networkInfo.handle}</code>
                                    </div>
                                  )}

                                  {rdapData!.networkInfo.startAddress && (
                                    <div className="flex items-center gap-2">
                                      <Activity className="h-4 w-4 text-green-500" />
                                      <span className="font-medium">起始地址:</span>
                                      <code className="text-sm bg-muted px-1 rounded">{rdapData!.networkInfo.startAddress}</code>
                                    </div>
                                  )}

                                  {rdapData!.networkInfo.endAddress && (
                                    <div className="flex items-center gap-2">
                                      <Activity className="h-4 w-4 text-red-500" />
                                      <span className="font-medium">结束地址:</span>
                                      <code className="text-sm bg-muted px-1 rounded">{rdapData!.networkInfo.endAddress}</code>
                                    </div>
                                  )}

                                  {rdapData!.networkInfo.type && (
                                    <div className="flex items-center gap-2">
                                      <Network className="h-4 w-4 text-muted-foreground" />
                                      <span className="font-medium">网络类型:</span>
                                      <Badge variant="outline">{rdapData!.networkInfo.type}</Badge>
                                    </div>
                                  )}

                                  {rdapData!.networkInfo.country && (
                                    <div className="flex items-center gap-2">
                                      <Globe className="h-4 w-4 text-muted-foreground" />
                                      <span className="font-medium">国家:</span>
                                      <span>{rdapData!.networkInfo.country}</span>
                                    </div>
                                  )}
                                </div>

                                {rdapData!.status && rdapData!.status.length > 0 && (
                                  <div>
                                    <div className="flex items-center gap-2 mb-2">
                                      <Shield className="h-4 w-4 text-muted-foreground" />
                                      <span className="font-medium">网络状态:</span>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                      {rdapData!.status.map((status, index) => (
                                        <Badge key={index} variant="outline" className="text-xs">
                                          {status}
                                        </Badge>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </AccordionContent>
                            </AccordionItem>
                          </Accordion>
                        )}
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="raw">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold">原始 RDAP JSON 数据</h3>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => copyToClipboard(rdapData!.raw || '')}
                          className="gap-2"
                        >
                          <Copy className="h-4 w-4" />
                          复制JSON
                        </Button>
                      </div>
                      {rdapData!.raw ? (
                        <ScrollArea className="h-96">
                          <pre className="bg-muted p-4 rounded-md text-sm overflow-x-auto whitespace-pre-wrap">
                            {rdapData!.raw}
                          </pre>
                        </ScrollArea>
                      ) : (
                        <div className="text-center text-muted-foreground py-8">
                          无原始数据
                        </div>
                      )}
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
