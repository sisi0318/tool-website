"use client"

import type React from "react"

import { useState, useEffect, useMemo, useCallback } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useTranslations } from "@/hooks/use-translations"
import {
  Plus,
  X,
  Hash,
  Lock,
  Code,
  History,
  Search,
  Key,
  TrendingUp,
  Share2,
  ExternalLink,
  Clock,
  FileJson,
  Smartphone,
  Calculator,
} from "lucide-react"
import dynamic from "next/dynamic"
import { type SearchResult, createSearchableFeatures, searchFeatures } from "./search-utils"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { LanguageSwitcher } from "@/components/language-switcher"

// 动态导入工具组件
const HashCalculator = dynamic(() => import("./hash/page"), { ssr: false })
const CryptoTool = dynamic(() => import("./crypto/page"), { ssr: false })
const EncodingTool = dynamic(() => import("./encoding/page"), { ssr: false })
const ClassicCipherTool = dynamic(() => import("./classic-cipher/page"), { ssr: false })
const HmacTool = dynamic(() => import("./hmac/page"), { ssr: false })
const CurrencyTool = dynamic(() => import("./currency/page"), { ssr: false })
const TimeTool = dynamic(() => import("./time/page"), { ssr: false })
const QRCodeGenerator = dynamic(() => import("./qrcode/page"), { ssr: false })
const JsonTool = dynamic(() => import("./json/page"), { ssr: false })
const ColorPickerTool = dynamic(() => import("./color/page"), { ssr: false })
const DeviceInfoTool = dynamic(() => import("./device/page"), { ssr: false })
const ProtobufTool = dynamic(() => import("./protobuf/page"), { ssr: false })
const BaseConverterTool = dynamic(() => import("./base-converter/page"), { ssr: false })
const TemperatureConverterPage = dynamic(() => import("./temperature-converter/page"), { ssr: false })
const DockerConverterPage = dynamic(() => import("./docker-converter/page"), { ssr: false })
const CrontabTool = dynamic(() => import("./crontab/page"), { ssr: false })
const ImageToBase64Tool = dynamic(() => import("./image-to-base64/page"), { ssr: false })
const ExifViewerTool = dynamic(() => import("./exif-viewer/page"), { ssr: false })
// Add the BMI calculator import to the dynamic imports section
const BMICalculator = dynamic(() => import("./bmi/page"), { ssr: false })
// Add the RegexTool import to the dynamic imports section
const RegexTool = dynamic(() => import("./regex/page"), { ssr: false })
// 添加新的导入
const QRCodeDecoder = dynamic(() => import("./qrcode-decode/page"), { ssr: false })
// Add the HTTP Tester import
const HTTPTester = dynamic(() => import("./http-tester/page"), { ssr: false })
// 在动态导入部分添加WHOIS工具
const WhoisPage = dynamic(() => import("./whois/page"), { ssr: false })

// 标签页类型
interface TabType {
  id: string
  title: string
  icon: React.ReactNode
  component: React.ReactNode
  closable: boolean
  params?: Record<string, string>
  shareableUrl?: string
  toolId: string // 添加toolId字段，方便保存和恢复
}

// 本地存储键名
const TABS_STORAGE_KEY = "tool_tabs_state"
const ACTIVE_TAB_STORAGE_KEY = "tool_active_tab"

export default function ToolsPage() {
  const t = useTranslations("tools")
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // 初始化标签页
  const [tabs, setTabs] = useState<TabType[]>([])
  const [activeTab, setActiveTab] = useState<string | null>(null)
  const [tabCounter, setTabCounter] = useState(1)
  const [showDropdown, setShowDropdown] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searchableFeatures, setSearchableFeatures] = useState<SearchResult[]>([])
  const [shareTooltip, setShareTooltip] = useState<{ [key: string]: boolean }>({})
  const [initialLoadComplete, setInitialLoadComplete] = useState(false)

  // 工具定义 - 使用useMemo避免重复创建
  const toolDefinitions = useMemo(
    () => [
      {
        id: "hash",
        title: t("hash.name"),
        icon: <Hash className="h-4 w-4" />,
        getComponent: (params?: Record<string, string>) => <HashCalculator params={params} />,
      },
      {
        id: "crypto",
        title: t("crypto.name"),
        icon: <Lock className="h-4 w-4" />,
        getComponent: (params?: Record<string, string>) => <CryptoTool params={params} />,
      },
      {
        id: "encoding",
        title: t("encoding.name"),
        icon: <Code className="h-4 w-4" />,
        getComponent: (params?: Record<string, string>) => <EncodingTool params={params} />,
      },
      {
        id: "classic-cipher",
        title: t("classicCipher.name"),
        icon: <History className="h-4 w-4" />,
        getComponent: (params?: Record<string, string>) => <ClassicCipherTool params={params} />,
      },
      {
        id: "hmac",
        title: t("hmac.name"),
        icon: <Key className="h-4 w-4" />,
        getComponent: (params?: Record<string, string>) => <HmacTool params={params} />,
      },
      {
        id: "currency",
        title: t("currency.name"),
        icon: <TrendingUp className="h-4 w-4" />,
        getComponent: (params?: Record<string, string>) => <CurrencyTool params={params} />,
      },
      {
        id: "time",
        title: t("time.name"),
        icon: <Clock className="h-4 w-4" />,
        getComponent: (params?: Record<string, string>) => <TimeTool params={params} />,
      },
      {
        id: "qrcode",
        title: t("qrcode.name"),
        icon: (
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
            className="h-4 w-4"
          >
            <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
            <path d="M8 8h2v2H8z" />
            <path d="M14 8h2v2h-2z" />
            <path d="M8 14h2v2H8z" />
            <path d="M14 14h2v2h-2z" />
          </svg>
        ),
        getComponent: (params?: Record<string, string>) => <QRCodeGenerator params={params} />,
      },
      {
        id: "json",
        title: t("json.name"),
        icon: <FileJson className="h-4 w-4" />,
        getComponent: (params?: Record<string, string>) => <JsonTool params={params} />,
      },
      {
        id: "color",
        title: t("color.name"),
        icon: (
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
            className="h-4 w-4"
          >
            <circle cx="12" cy="12" r="10"></circle>
            <circle cx="12" cy="12" r="3"></circle>
          </svg>
        ),
        getComponent: (params?: Record<string, string>) => <ColorPickerTool params={params} />,
      },
      {
        id: "device",
        title: t("device.name"),
        icon: <Smartphone className="h-4 w-4" />,
        getComponent: (params?: Record<string, string>) => <DeviceInfoTool params={params} />,
      },
      // Add the Protobuf tool to the toolDefinitions array
      {
        id: "protobuf",
        title: t("protobuf.name"),
        icon: (
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
            className="h-4 w-4"
          >
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
        ),
        getComponent: (params?: Record<string, string>) => <ProtobufTool params={params} />,
      },
      // Add the Base Converter tool to the toolDefinitions array
      {
        id: "base-converter",
        title: t("baseConverter.name"),
        icon: <Calculator className="h-4 w-4" />,
        getComponent: (params?: Record<string, string>) => <BaseConverterTool params={params} />,
      },
      // Add Temperature Converter tool
      {
        id: "temperature-converter",
        title: t("temperatureConverter.name"),
        icon: (
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
            className="h-4 w-4"
          >
            <path d="M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z" />
            <path d="M12 9a1 1 0 0 0-1-1h0a1 1 0 0 0-1 1h0a1 1 0 0 0 1 1h0a1 1 0 0 0 1-1Z" />
          </svg>
        ),
        getComponent: (params?: Record<string, string>) => <TemperatureConverterPage params={params} />,
      },
      // Add Docker Converter tool
      {
        id: "docker-converter",
        title: t("dockerConverter.name"),
        icon: (
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
            className="h-4 w-4"
          >
            <path d="M22 12.5a2.5 2.5 0 0 0-2.5-2.5H6.5A2.5 2.5 0 0 0 4 12.5V17a2 2 0 0 1-2 2v-6.5a2.5 2.5 0 0 0-2.5-2.5" />
            <path d="M22 12.5A2.5 2.5 0 0 0 19.5 10H9.5A2.5 2.5 0 0 0 7 12.5V17a2 2 0 0 1-2 2h14a2 2 0 0 0 2-2Z" />
            <path d="M17 17v-2a2 2 0 0 0-2-2H9a2 2 0 0 0-2 2v2h10Z" />
          </svg>
        ),
        getComponent: (params?: Record<string, string>) => <DockerConverterPage params={params} />,
      },
      {
        id: "crontab",
        title: t("crontab.name"),
        icon: (
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
            className="h-4 w-4"
          >
            <path d="M21 7.5V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h7.5" />
            <path d="M16 2v4" />
            <path d="M8 2v4" />
            <path d="M3 10h18" />
            <circle cx="18" cy="18" r="4" />
            <path d="M18 16.5V18l1 1" />
          </svg>
        ),
        getComponent: (params?: Record<string, string>) => <CrontabTool params={params} />,
      },
      {
        id: "image-to-base64",
        title: t("imageToBase64.name"),
        icon: (
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
            className="h-4 w-4"
          >
            <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
            <circle cx="9" cy="9" r="2" />
            <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
          </svg>
        ),
        getComponent: (params?: Record<string, string>) => <ImageToBase64Tool params={params} />,
      },
      {
        id: "exif-viewer",
        title: t("exifViewer.name"),
        icon: (
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
            className="h-4 w-4"
          >
            <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
            <circle cx="9" cy="9" r="2" />
            <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
            <path d="M8 21h13" />
          </svg>
        ),
        getComponent: (params?: Record<string, string>) => <ExifViewerTool params={params} />,
      },
      // Add the BMI tool to the toolDefinitions array
      {
        id: "bmi",
        title: t("bmi.name"),
        icon: (
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
            className="h-4 w-4"
          >
            <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
            <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
            <path d="M9 12h6"></path>
            <path d="M9 16h6"></path>
          </svg>
        ),
        getComponent: (params?: Record<string, string>) => <BMICalculator params={params} />,
      },
      // Add the regex tool to the toolDefinitions array after the BMI calculator
      {
        id: "regex",
        title: t("regex.name"),
        icon: (
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
            className="h-4 w-4"
          >
            <path d="M17 3v10"></path>
            <path d="m12.67 5.5 8.66 5"></path>
            <path d="m12.67 10.5 8.66-5"></path>
            <path d="M9 17a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2v-2z"></path>
          </svg>
        ),
        getComponent: (params?: Record<string, string>) => <RegexTool params={params} />,
      },
      // Add the QR Code Decoder tool
      {
        id: "qrcode-decode",
        title: t("qrcodeDecoder.name"),
        icon: (
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
            className="h-4 w-4"
          >
            <rect width="14" height="14" x="3" y="3" rx="2" />
            <path d="M7 7h.01" />
            <path d="M17 7h.01" />
            <path d="M7 17h.01" />
            <path d="M17 17h.01" />
            <path d="M3 21h18" />
            <path d="M21 21v-2" />
            <path d="M3 16v5" />
            <path d="M21 16v3" />
          </svg>
        ),
        getComponent: (params?: Record<string, string>) => <QRCodeDecoder params={params} />,
      },
      // Add the HTTP Tester to the toolDefinitions array
      {
        id: "http-tester",
        title: t("httpTester.name"),
        icon: (
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
            className="h-4 w-4"
          >
            <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
            <line x1="3" x2="21" y1="9" y2="9" />
            <line x1="9" x2="9" y1="3" y2="21" />
          </svg>
        ),
        getComponent: (params?: Record<string, string>) => <HTTPTester params={params} />,
      },
      // 在toolDefinitions数组中添加WHOIS工具定义，放在HTTP Tester工具之后
      {
        id: "whois",
        title: t("whois.name"),
        icon: (
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
            className="h-4 w-4"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="2" x2="22" y1="12" y2="12" />
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
          </svg>
        ),
        getComponent: (params?: Record<string, string>) => <WhoisPage params={params} />,
      },
    ],
    [t],
  )

  // 初始化可搜索功能
  useEffect(() => {
    try {
      const translations = {
        hash: { name: t("hash.name") },
        crypto: { name: t("crypto.name") },
        encoding: { name: t("encoding.name") },
        classicCipher: { name: t("classicCipher.name") },
        hmac: { name: t("hmac.name") },
        currency: { name: t("currency.name") },
        time: { name: t("time.name") },
        qrcode: { name: t("qrcode.name") },
        json: { name: t("json.name") },
        color: { name: t("color.name") },
        device: { name: t("device.name") },
        protobuf: { name: t("protobuf.name") },
        baseConverter: { name: t("baseConverter.name") },
        temperatureConverter: { name: t("temperatureConverter.name") },
        dockerConverter: { name: t("dockerConverter.name") },
        crontab: { name: t("crontab.name") },
        imageToBase64: { name: t("imageToBase64.name") },
        exifViewer: { name: t("exifViewer.name") },
        bmi: { name: t("bmi.name") },
        regex: { name: t("regex.name") },
        httpTester: { name: t("httpTester.name") },
      }

      // Make sure all translation keys exist before creating searchable features
      const validTranslations = Object.entries(translations).reduce(
        (acc: Record<string, { name: string }>, [key, value]) => {
          if (value.name) {
            acc[key] = value
          }
          return acc
        },
        {} as Record<string, { name: string }>,
      )

      setSearchableFeatures(createSearchableFeatures(validTranslations))
    } catch (error) {
      console.error("Error initializing searchable features:", error)
      // Set empty array as fallback
      setSearchableFeatures([])
    }
    // This effect should only run once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 创建可分享的URL - 使用useCallback避免重复创建
  const createShareableUrl = useCallback(
    (toolIds: string[], toolParams?: Record<string, Record<string, string>>): string => {
      if (typeof window === "undefined") return ""

      const baseUrl = `${window.location.origin}/tools`

      // Create a new URLSearchParams object
      const queryParams = new URLSearchParams()

      // Add the tool parameter with comma-separated tool IDs
      queryParams.append("tool", toolIds.join(","))

      // Add any additional parameters for each tool
      if (toolParams) {
        Object.entries(toolParams).forEach(([toolId, params]) => {
          if (params && Object.keys(params).length > 0) {
            Object.entries(params).forEach(([key, value]) => {
              // 使用工具ID作为前缀，避免参数冲突
              queryParams.append(`${toolId}_${key}`, value)
            })
          }
        })
      }

      return `${baseUrl}?${queryParams.toString()}`
    },
    [],
  )

  // 保存标签页状态到本地存储
  const saveTabsToLocalStorage = useCallback((currentTabs: TabType[], currentActiveTab: string | null) => {
    if (typeof window === "undefined") return

    try {
      // 我们需要创建一个可序列化的标签页对象
      const serializableTabs = currentTabs.map((tab) => ({
        id: tab.id,
        toolId: tab.toolId,
        params: tab.params || {},
      }))

      localStorage.setItem(TABS_STORAGE_KEY, JSON.stringify(serializableTabs))
      localStorage.setItem(ACTIVE_TAB_STORAGE_KEY, currentActiveTab || "")
    } catch (error) {
      console.error("Error saving tabs to localStorage:", error)
    }
  }, [])

  // 从本地存储恢复标签页状态
  const restoreTabsFromLocalStorage = useCallback(() => {
    if (typeof window === "undefined") return null

    try {
      const savedTabsJson = localStorage.getItem(TABS_STORAGE_KEY)
      const savedActiveTab = localStorage.getItem(ACTIVE_TAB_STORAGE_KEY)

      if (!savedTabsJson) return null

      const savedTabs = JSON.parse(savedTabsJson)

      // 验证数据格式
      if (!Array.isArray(savedTabs)) return null

      return {
        tabs: savedTabs,
        activeTab: savedActiveTab || null,
      }
    } catch (error) {
      console.error("Error restoring tabs from localStorage:", error)
      return null
    }
  }, [])

  // 更新URL以反映当前打开的标签页 - 必须在addTab之前定义
  const updateUrl = useCallback(
    (currentTabs: TabType[], currentActiveTab: string | null) => {
      if (!currentTabs.length || !currentActiveTab) {
        router.replace("/tools", { scroll: false })
        return
      }

      // 获取所有工具ID
      const toolIds = currentTabs.map((tab) => tab.toolId)

      // 收集每个工具的参数
      const toolParams: Record<string, Record<string, string>> = {}
      currentTabs.forEach((tab) => {
        if (tab.params && Object.keys(tab.params).length > 0) {
          toolParams[tab.toolId] = tab.params
        }
      })

      // 创建URL
      const url = createShareableUrl(toolIds, toolParams)

      // 更新URL，但不触发导航
      router.replace(url, { scroll: false })
    },
    [router, createShareableUrl],
  )

  // 添加新标签页 - 使用useCallback避免重复创建
  const addTab = useCallback(
    (toolId: string, params?: Record<string, string>) => {
      const tool = toolDefinitions.find((t) => t.id === toolId)
      if (!tool) return

      const id = `${toolId}-${tabCounter}`

      // 创建可分享的URL
      const shareableUrl = createShareableUrl([toolId], params ? { [toolId]: params } : undefined)

      // 添加新标签页，不检查是否重复
      const newTab: TabType = {
        id,
        title: tool.title,
        icon: tool.icon,
        component: tool.getComponent(params), // 使用getComponent函数传递参数
        closable: true,
        params,
        shareableUrl,
        toolId, // 保存工具ID
      }

      const updatedTabs = [...tabs, newTab]
      setTabs(updatedTabs)
      setActiveTab(id)
      setTabCounter((prev) => prev + 1)
      setShowDropdown(false)

      // 保存到本地存储
      saveTabsToLocalStorage(updatedTabs, id)

      // 更新URL
      updateUrl(updatedTabs, id)
    },
    [toolDefinitions, tabCounter, createShareableUrl, tabs, saveTabsToLocalStorage, updateUrl],
  )

  // 复制分享链接到剪贴板
  const copyShareLink = useCallback(
    (tabId: string, e?: React.MouseEvent) => {
      if (e) {
        e.stopPropagation() // 防止点击事件冒泡到标签页
      }

      const tab = tabs.find((t) => t.id === tabId)
      if (!tab || !tab.shareableUrl) return

      navigator.clipboard.writeText(tab.shareableUrl).then(() => {
        // 显示复制成功提示
        setShareTooltip((prev) => ({ ...prev, [tabId]: true }))

        // 2秒后隐藏提示
        setTimeout(() => {
          setShareTooltip((prev) => ({ ...prev, [tabId]: false }))
        }, 2000)
      })
    },
    [tabs],
  )

  // 关闭标签页
  const closeTab = useCallback(
    (id: string, e: React.MouseEvent) => {
      e.stopPropagation()

      const tabIndex = tabs.findIndex((tab) => tab.id === id)
      if (tabIndex === -1) return

      const newTabs = tabs.filter((tab) => tab.id !== id)
      setTabs(newTabs)

      // 如果关闭的是当前活动标签页，则切换到前一个标签页或第一个标签页
      let newActiveTab = activeTab
      if (id === activeTab) {
        if (tabIndex > 0 && newTabs.length > 0) {
          newActiveTab = newTabs[tabIndex - 1].id
        } else if (newTabs.length > 0) {
          newActiveTab = newTabs[0].id
        } else {
          newActiveTab = null
        }
        setActiveTab(newActiveTab)
      }

      // 保存到本地存储
      saveTabsToLocalStorage(newTabs, newActiveTab)

      // 更新URL
      updateUrl(newTabs, newActiveTab)

      // 如果关闭了所有标签页，强制更新URL为纯净的/tools
      if (newTabs.length === 0) {
        // Force a clean URL without any query parameters
        window.history.replaceState({}, "", "/tools")
        // Also update router state to be in sync
        router.replace("/tools", { scroll: false })
      }
    },
    [tabs, activeTab, saveTabsToLocalStorage, updateUrl, router],
  )

  // 处理搜索
  const handleSearch = useCallback(
    (term: string) => {
      setSearchTerm(term)
      const results = searchFeatures(searchableFeatures, term)
      setSearchResults(results)
    },
    [searchableFeatures],
  )

  // 打开工具并跳转到特定功能
  const openToolWithFeature = useCallback(
    (toolId: string, featureName: string) => {
      // 添加标签页，并传递参数
      addTab(toolId, { feature: featureName })

      // 清空搜索
      setSearchTerm("")
      setSearchResults([])
    },
    [addTab],
  )

  // 工具卡片组件
  const ToolCard = useCallback(
    ({ id, name, icon, onClick }: { id: string; name: string; icon: React.ReactNode; onClick: () => void }) => (
      <Card className="h-full transition-all duration-200 hover:scale-105 card-modern cursor-pointer" onClick={onClick}>
        <CardContent className="flex flex-col items-center justify-center p-6 h-full">
          <div className="mb-4 p-3 rounded-full icon-container">{icon}</div>
          <h3 className="font-medium text-center">{name}</h3>
        </CardContent>
      </Card>
    ),
    [],
  )

  // 从URL参数或本地存储中恢复标签页状态
  useEffect(() => {
    if (initialLoadComplete) return

    // 首先检查URL参数
    const toolParam = searchParams.get("tool")

    if (toolParam) {
      // 支持逗号分隔的多个工具ID
      const toolIds = toolParam.split(",").filter((id) => toolDefinitions.some((t) => t.id === id))

      if (toolIds.length > 0) {
        // 从URL参数恢复多个标签页
        const restoredTabs: TabType[] = []
        let nextTabCounter = tabCounter

        toolIds.forEach((toolId) => {
          const tool = toolDefinitions.find((t) => t.id === toolId)
          if (tool) {
            // 收集该工具的所有参数
            const params: Record<string, string> = {}
            searchParams.forEach((value, key) => {
              // 检查参数是否属于当前工具
              if (key.startsWith(`${toolId}_`)) {
                const paramName = key.substring(toolId.length + 1)
                params[paramName] = value
              } else if (key !== "tool" && toolIds.length === 1) {
                // 如果只有一个工具，也支持不带前缀的参数
                params[key] = value
              }
            })

            const id = `${toolId}-${nextTabCounter++}`
            const shareableUrl = createShareableUrl(
              [toolId],
              Object.keys(params).length > 0 ? { [toolId]: params } : undefined,
            )

            restoredTabs.push({
              id,
              title: tool.title,
              icon: tool.icon,
              component: tool.getComponent(Object.keys(params).length > 0 ? params : undefined),
              closable: true,
              params: Object.keys(params).length > 0 ? params : undefined,
              shareableUrl,
              toolId,
            })
          }
        })

        if (restoredTabs.length > 0) {
          setTabs(restoredTabs)
          setActiveTab(restoredTabs[0].id)
          setTabCounter(nextTabCounter)

          // 保存到本地存储
          saveTabsToLocalStorage(restoredTabs, restoredTabs[0].id)
        }
      }
    } else {
      // 如果URL中没有参数，尝试从本地存储恢复
      const savedState = restoreTabsFromLocalStorage()

      if (savedState && savedState.tabs.length > 0) {
        // 恢复保存的标签页
        const restoredTabs: TabType[] = []
        let nextTabCounter = tabCounter

        savedState.tabs.forEach((savedTab) => {
          const tool = toolDefinitions.find((t) => t.id === savedTab.toolId)
          if (tool) {
            const id = savedTab.id || `${savedTab.toolId}-${nextTabCounter++}`
            const shareableUrl = createShareableUrl(
              [savedTab.toolId],
              savedTab.params ? { [savedTab.toolId]: savedTab.params } : undefined,
            )

            restoredTabs.push({
              id,
              title: tool.title,
              icon: tool.icon,
              component: tool.getComponent(savedTab.params),
              closable: true,
              params: savedTab.params,
              shareableUrl,
              toolId: savedTab.toolId,
            })
          }
        })

        if (restoredTabs.length > 0) {
          setTabs(restoredTabs)
          setTabCounter(nextTabCounter)

          // 恢复活动标签页
          if (savedState.activeTab && restoredTabs.some((tab) => tab.id === savedState.activeTab)) {
            setActiveTab(savedState.activeTab)
          } else {
            setActiveTab(restoredTabs[0].id)
          }

          // 更新URL以反映当前标签页
          updateUrl(restoredTabs, savedState.activeTab || restoredTabs[0].id)
        }
      }
    }

    setInitialLoadComplete(true)
  }, [
    searchParams,
    toolDefinitions,
    tabCounter,
    createShareableUrl,
    initialLoadComplete,
    saveTabsToLocalStorage,
    restoreTabsFromLocalStorage,
    updateUrl,
  ])

  // 当活动标签页变化时保存到本地存储
  useEffect(() => {
    if (!initialLoadComplete) return

    // 保存当前活动标签页到本地存储
    if (activeTab) {
      saveTabsToLocalStorage(tabs, activeTab)

      // 更新URL以反映当前活动标签页
      updateUrl(tabs, activeTab)
    }
  }, [activeTab, tabs, initialLoadComplete, saveTabsToLocalStorage, updateUrl])

  // 点击外部关闭下拉菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const dropdownButton = document.getElementById("add-tab-button")
      const dropdownMenu = document.getElementById("add-tab-dropdown")

      if (
        dropdownButton &&
        dropdownMenu &&
        !dropdownButton.contains(event.target as Node) &&
        !dropdownMenu.contains(event.target as Node)
      ) {
        setShowDropdown(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [])

  // 创建多标签页的分享链接
  const createMultiTabShareLink = useCallback(() => {
    if (!tabs.length) return ""

    // 获取所有工具ID
    const toolIds = tabs.map((tab) => tab.toolId)

    // 收集每个工具的参数
    const toolParams: Record<string, Record<string, string>> = {}
    tabs.forEach((tab) => {
      if (tab.params && Object.keys(tab.params).length > 0) {
        toolParams[tab.toolId] = tab.params
      }
    })

    // 创建URL
    return createShareableUrl(toolIds, toolParams)
  }, [tabs, createShareableUrl])

  // 复制多标签页分享链接
  const copyMultiTabShareLink = useCallback(() => {
    const url = createMultiTabShareLink()
    if (!url) return

    navigator.clipboard.writeText(url).then(() => {
      // 显示复制成功提示
      setShareTooltip((prev) => ({ ...prev, multiTab: true }))

      // 2秒后隐提示
      setTimeout(() => {
        setShareTooltip((prev) => ({ ...prev, multiTab: false }))
      }, 2000)
    })
  }, [createMultiTabShareLink])

  return (
    <div className="container mx-auto px-4 py-8">
      {/* 搜索框 */}
      <div className="mb-6">
        <div className="relative">
          <div className="flex items-center">
            <div className="relative flex-grow">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder={t("search.placeholder")}
                className="w-full p-3 pl-10 pr-4 rounded-lg input-modern"
              />
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            </div>
            <div className="ml-2">
              <LanguageSwitcher />
            </div>
          </div>

          {searchResults.length > 0 && (
            <div className="absolute z-10 w-full mt-2 card-modern rounded-lg p-2 max-h-80 overflow-y-auto">
              {searchResults.map((result, index) => (
                <div
                  key={index}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md cursor-pointer"
                  onClick={() => openToolWithFeature(result.toolId, result.featureName)}
                >
                  <div className="font-medium">{result.featureName}</div>
                  <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center">
                    <span>{result.toolName}</span>
                    {result.featureDescription && (
                      <span className="ml-2 text-xs text-gray-400 dark:text-gray-500">
                        - {result.featureDescription}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {tabs.length > 0 ? (
        <div className="space-y-4">
          {/* 拟态风格的标签栏 */}
          <div className="relative flex flex-col">
            <div className="flex items-center bg-gray-50 dark:bg-gray-800 rounded-lg p-2 card-modern">
              <div className="flex-1 flex overflow-x-auto scrollbar-hide">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    className={`
                  px-3 py-2 flex items-center space-x-1 
                  transition-all duration-200 min-w-[100px] max-w-[150px]
                  mx-1 rounded-full
                  ${activeTab === tab.id ? "button-modern-active" : "button-modern text-gray-600 dark:text-gray-400"}
                `}
                    onClick={() => setActiveTab(tab.id)}
                  >
                    <div className="flex items-center truncate">
                      <span className="mr-1">{tab.icon}</span>
                      <span className="truncate text-sm">{tab.title}</span>
                    </div>
                    <div className="flex items-center ml-auto">
                      {/* 添加单个标签页分享按钮 */}
                      {tab.shareableUrl && (
                        <TooltipProvider>
                          <Tooltip open={shareTooltip[tab.id]}>
                            <TooltipTrigger asChild>
                              <button
                                className={`
                              rounded-full p-1 hover:bg-gray-200 dark:hover:bg-gray-700
                              ${
                                activeTab === tab.id
                                  ? "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                                  : "text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
                              }
                            `}
                                onClick={(e) => copyShareLink(tab.id, e)}
                              >
                                <ExternalLink className="h-3 w-3" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent>{shareTooltip[tab.id] ? t("linkCopied") : t("copyLink")}</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}

                      {tab.closable && (
                        <button
                          className={`
                        ml-1 rounded-full p-1 hover:bg-gray-200 dark:hover:bg-gray-700
                        ${
                          activeTab === tab.id
                            ? "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                            : "text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
                        }
                      `}
                          onClick={(e) => closeTab(tab.id, e)}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </button>
                ))}
              </div>
              <div className="flex-shrink-0 flex items-center ml-2">
                {/* 分享多标签页按钮 */}
                {tabs.length > 1 && (
                  <TooltipProvider>
                    <Tooltip open={shareTooltip.multiTab}>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 rounded-full button-modern mr-1"
                          onClick={copyMultiTabShareLink}
                        >
                          <Share2 className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{shareTooltip.multiTab ? t("linkCopied") : t("copyLink")}</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}

                {/* 加标签页按钮 */}
                <Button
                  id="add-tab-button"
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 rounded-full button-modern"
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowDropdown(!showDropdown)
                  }}
                >
                  <Plus className="h-4 w-4" />
                </Button>
                {showDropdown && (
                  <div
                    id="add-tab-dropdown"
                    className="absolute right-0 mt-1 w-48 card-modern rounded-md p-2 z-10 max-h-80 overflow-y-auto"
                  >
                    <div className="flex flex-col space-y-1">
                      {toolDefinitions.map((tool) => (
                        <Button
                          key={tool.id}
                          variant="ghost"
                          size="sm"
                          className="justify-start hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
                          onClick={(e) => {
                            e.stopPropagation()
                            addTab(tool.id)
                          }}
                        >
                          <span className="mr-2">{tool.icon}</span>
                          {tool.title}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 标签内容容器 */}
            <div className="mt-4">
              {tabs.map((tab) => (
                <div key={tab.id} className={activeTab === tab.id ? "block" : "hidden"}>
                  {tab.component}
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div>
          <h1 className="text-3xl font-bold mb-8 text-center">{t("pageTitle")}</h1>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {toolDefinitions.map((tool) => (
              <ToolCard key={tool.id} id={tool.id} name={tool.title} icon={tool.icon} onClick={() => addTab(tool.id)} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
