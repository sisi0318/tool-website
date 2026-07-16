"use client"

import type React from "react"

import { useState, useEffect, useMemo, useCallback, useRef } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
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
  Clock,
  FileJson,
  Smartphone,
  Calculator,
  ArrowRight,
  GitCompareArrows,
  Star,
  KeyRound,
  ImageDown,
  ScanSearch,
  Archive,
  FileCode2,
  Table2,
  FileText,
  Database,
  Braces,
  Network,
  ShieldCheck,
  Binary,
  CalendarClock,
  Camera,
  CaseSensitive,
  CircleDot,
  ClipboardList,
  Container,
  Crosshair,
  Dices,
  FileImage,
  Globe2,
  Grid3X3,
  Image,
  Layers,
  LockKeyhole,
  PanelTop,
  PenLine,
  QrCode,
  Regex,
  ScanQrCode,
  Thermometer,
  WandSparkles,
} from "lucide-react"
import dynamic from "next/dynamic"
import { type SearchResult, createSearchableFeatures, searchFeatures } from "./search-utils"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { M3Tabs, type TabItem } from "@/components/m3/tabs"
import { M3BottomSheet } from "@/components/m3/bottom-sheet"
import { useBreakpoint } from "@/hooks/use-breakpoint"
import { useSwipe } from "@/hooks/use-swipe"
import { ToolRuntimeParamsProvider, type ToolRuntimeParams } from "@/components/tool-runtime-params"
import { useToolPreferences } from "@/hooks/use-tool-preferences"
import { haveEqualToolParams, uniqueToolIds } from "@/lib/tool-workspace"

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
const BMICalculator = dynamic(() => import("./bmi/page"), { ssr: false })
const RegexTool = dynamic(() => import("./regex/page"), { ssr: false })
const QRCodeDecoder = dynamic(() => import("./qrcode-decode/page"), { ssr: false })
const HTTPTester = dynamic(() => import("./http-tester/page"), { ssr: false })
const WhoisPage = dynamic(() => import("./whois/page"), { ssr: false })
const UUIDGenerator = dynamic(() => import("./uuid/page"), { ssr: false })
const JWTParser = dynamic(() => import("./jwt/page"), { ssr: false })
const TextStats = dynamic(() => import("./text-stats/page"), { ssr: false })
const ImageCompressTool = dynamic(() => import("./image-compress/page"), { ssr: false })
const ImageEditorTool = dynamic(() => import("./image-editor/page"), { ssr: false })
const OfficeViewerTool = dynamic(() => import("./office-viewer/page"), { ssr: false })
const MemeSplitterTool = dynamic(() => import("./meme-splitter/page"), { ssr: false })
const ImageCoordinatesTool = dynamic(() => import("./image-coordinates/page"), { ssr: false })
const CaseConverterTool = dynamic(() => import("./case-converter/page"), { ssr: false })
const TOTPTool = dynamic(() => import("./totp/page"), { ssr: false })
const JceTool = dynamic(() => import("./jce/page"), { ssr: false })
const DiffTool = dynamic(() => import("./diff/page"), { ssr: false })
const PasswordGeneratorTool = dynamic(() => import("./password-generator/page"), { ssr: false })
const ImageConvertTool = dynamic(() => import("./image-convert/page"), { ssr: false })
const DataDetectorTool = dynamic(() => import("./data-detector/page"), { ssr: false })
const CompressionTool = dynamic(() => import("./compression/page"), { ssr: false })
const XmlTool = dynamic(() => import("./xml/page"), { ssr: false })
const CsvTool = dynamic(() => import("./csv/page"), { ssr: false })
const MarkdownTool = dynamic(() => import("./markdown/page"), { ssr: false })
const SqlTool = dynamic(() => import("./sql/page"), { ssr: false })
const JsonSchemaTool = dynamic(() => import("./json-schema/page"), { ssr: false })
const SubnetTool = dynamic(() => import("./subnet/page"), { ssr: false })
const CertificateTool = dynamic(() => import("./certificate/page"), { ssr: false })
const HexBinaryTool = dynamic(() => import("./hex-binary/page"), { ssr: false })

function createToolRenderer(Component: React.ComponentType) {
  return (params?: ToolRuntimeParams) => (
    <ToolRuntimeParamsProvider params={params}>
      <Component />
    </ToolRuntimeParamsProvider>
  )
}

// 工具分类定义 - 图标配色沿用首页精选工具的柔和多色方案
type ToolCategoryId = "developer" | "security" | "image" | "text" | "network" | "life"

const TOOL_CATEGORIES: { id: ToolCategoryId; accent: string; dot: string }[] = [
  {
    id: "developer",
    accent: "bg-[#e4f2df] text-[#2f6b2f] dark:bg-[#29432a] dark:text-[#b9dfb1]",
    dot: "bg-[#4A8135]",
  },
  {
    id: "security",
    accent: "bg-[#e8e5f3] text-[#5d547c] dark:bg-[#373247] dark:text-[#cbc2ea]",
    dot: "bg-[#5d547c]",
  },
  {
    id: "image",
    accent: "bg-[#f4ead5] text-[#765a1f] dark:bg-[#493b20] dark:text-[#e7cb8d]",
    dot: "bg-[#a0742c]",
  },
  {
    id: "text",
    accent: "bg-[#dfe9f5] text-[#35567c] dark:bg-[#2c3648] dark:text-[#c2cfeb]",
    dot: "bg-[#4a6a9c]",
  },
  {
    id: "network",
    accent: "bg-[#dcefeb] text-[#006b60] dark:bg-[#17443f] dark:text-[#8bd4c9]",
    dot: "bg-[#00897B]",
  },
  {
    id: "life",
    accent: "bg-[#f5e3e3] text-[#7c4545] dark:bg-[#432e2e] dark:text-[#e8baba]",
    dot: "bg-[#a05c5c]",
  },
]

const DEFAULT_CATEGORY: ToolCategoryId = "developer"

const TOOL_CATEGORY_MAP: Record<string, ToolCategoryId> = {
  // 开发工具
  json: "developer",
  "json-schema": "developer",
  xml: "developer",
  csv: "developer",
  sql: "developer",
  regex: "developer",
  crontab: "developer",
  "docker-converter": "developer",
  protobuf: "developer",
  jce: "developer",
  "hex-binary": "developer",
  "base-converter": "developer",
  encoding: "developer",
  compression: "developer",
  "data-detector": "developer",
  // 安全加密
  hash: "security",
  hmac: "security",
  crypto: "security",
  "classic-cipher": "security",
  jwt: "security",
  totp: "security",
  "password-generator": "security",
  uuid: "security",
  certificate: "security",
  // 图片处理
  "image-compress": "image",
  "image-convert": "image",
  "image-editor": "image",
  "image-to-base64": "image",
  "exif-viewer": "image",
  "meme-splitter": "image",
  "image-coordinates": "image",
  qrcode: "image",
  "qrcode-decode": "image",
  // 文本文档
  "text-stats": "text",
  "case-converter": "text",
  diff: "text",
  markdown: "text",
  "office-viewer": "text",
  // 网络
  "http-tester": "network",
  whois: "network",
  subnet: "network",
  // 生活实用
  currency: "life",
  time: "life",
  bmi: "life",
  "temperature-converter": "life",
  color: "life",
  device: "life",
}

// 标签页类型
interface ToolTabType {
  id: string
  title: string
  icon: React.ReactNode
  component: React.ReactNode
  closable: boolean
  params?: Record<string, string>
  shareableUrl?: string
  toolId: string
}

// 本地存储键名
const TABS_STORAGE_KEY = "tool_tabs_state"
const ACTIVE_TAB_STORAGE_KEY = "tool_active_tab"

export default function ToolsPage() {
  const t = useTranslations("tools")
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { isCompact } = useBreakpoint()

  // 初始化标签页
  const [tabs, setTabs] = useState<ToolTabType[]>([])
  const [activeTab, setActiveTab] = useState<string | null>(null)
  const [tabCounter, setTabCounter] = useState(1)
  const [showDropdown, setShowDropdown] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searchableFeatures, setSearchableFeatures] = useState<SearchResult[]>([])
  const [shareTooltip, setShareTooltip] = useState<{ [key: string]: boolean }>({})
  const [initialLoadComplete, setInitialLoadComplete] = useState(false)
  const [isSearchFocused, setIsSearchFocused] = useState(false)
  const [showToolOptionsSheet, setShowToolOptionsSheet] = useState(false)
  const [activeCategory, setActiveCategory] = useState<ToolCategoryId | "all">("all")
  const searchInputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const tabContentRef = useRef<HTMLDivElement>(null)


  // 工具定义 - 使用useMemo避免重复创建
  const toolDefinitions = useMemo(
    () => [
      {
        id: "hash",
        title: t("hash.name"),
        icon: <Hash className="h-4 w-4" />,
        getComponent: createToolRenderer(HashCalculator),
      },
      {
        id: "crypto",
        title: t("crypto.name"),
        icon: <Lock className="h-4 w-4" />,
        getComponent: createToolRenderer(CryptoTool),
      },
      {
        id: "encoding",
        title: t("encoding.name"),
        icon: <Code className="h-4 w-4" />,
        getComponent: createToolRenderer(EncodingTool),
      },
      {
        id: "classic-cipher",
        title: t("classicCipher.name"),
        icon: <History className="h-4 w-4" />,
        getComponent: createToolRenderer(ClassicCipherTool),
      },
      {
        id: "hmac",
        title: t("hmac.name"),
        icon: <Key className="h-4 w-4" />,
        getComponent: createToolRenderer(HmacTool),
      },
      {
        id: "currency",
        title: t("currency.name"),
        icon: <TrendingUp className="h-4 w-4" />,
        getComponent: createToolRenderer(CurrencyTool),
      },
      {
        id: "time",
        title: t("time.name"),
        icon: <Clock className="h-4 w-4" />,
        getComponent: createToolRenderer(TimeTool),
      },
      {
        id: "qrcode",
        title: t("qrcode.name"),
        icon: <QrCode className="h-4 w-4" />,
        getComponent: createToolRenderer(QRCodeGenerator),
      },
      {
        id: "json",
        title: t("json.name"),
        icon: <FileJson className="h-4 w-4" />,
        getComponent: createToolRenderer(JsonTool),
      },
      {
        id: "color",
        title: t("color.name"),
        icon: <CircleDot className="h-4 w-4" />,
        getComponent: createToolRenderer(ColorPickerTool),
      },
      {
        id: "device",
        title: t("device.name"),
        icon: <Smartphone className="h-4 w-4" />,
        getComponent: createToolRenderer(DeviceInfoTool),
      },
      {
        id: "protobuf",
        title: t("protobuf.name"),
        icon: <Layers className="h-4 w-4" />,
        getComponent: createToolRenderer(ProtobufTool),
      },
      {
        id: "base-converter",
        title: t("baseConverter.name"),
        icon: <Calculator className="h-4 w-4" />,
        getComponent: createToolRenderer(BaseConverterTool),
      },
      {
        id: "temperature-converter",
        title: t("temperatureConverter.name"),
        icon: <Thermometer className="h-4 w-4" />,
        getComponent: createToolRenderer(TemperatureConverterPage),
      },
      {
        id: "docker-converter",
        title: t("dockerConverter.name"),
        icon: <Container className="h-4 w-4" />,
        getComponent: createToolRenderer(DockerConverterPage),
      },
      {
        id: "crontab",
        title: t("crontab.name"),
        icon: <CalendarClock className="h-4 w-4" />,
        getComponent: createToolRenderer(CrontabTool),
      },
      {
        id: "image-to-base64",
        title: t("imageToBase64.name"),
        icon: <Image className="h-4 w-4" />,
        getComponent: createToolRenderer(ImageToBase64Tool),
      },
      {
        id: "exif-viewer",
        title: t("exifViewer.name"),
        icon: <Camera className="h-4 w-4" />,
        getComponent: createToolRenderer(ExifViewerTool),
      },
      {
        id: "bmi",
        title: t("bmi.name"),
        icon: <ClipboardList className="h-4 w-4" />,
        getComponent: createToolRenderer(BMICalculator),
      },
      {
        id: "regex",
        title: t("regex.name"),
        icon: <Regex className="h-4 w-4" />,
        getComponent: createToolRenderer(RegexTool),
      },
      {
        id: "qrcode-decode",
        title: t("qrcodeDecoder.name"),
        icon: <ScanQrCode className="h-4 w-4" />,
        getComponent: createToolRenderer(QRCodeDecoder),
      },
      {
        id: "http-tester",
        title: t("httpTester.name"),
        icon: <PanelTop className="h-4 w-4" />,
        getComponent: createToolRenderer(HTTPTester),
      },
      {
        id: "whois",
        title: t("whois.name"),
        icon: <Globe2 className="h-4 w-4" />,
        getComponent: createToolRenderer(WhoisPage),
      },
      {
        id: "uuid",
        title: t("uuid.name"),
        icon: <Dices className="h-4 w-4" />,
        getComponent: createToolRenderer(UUIDGenerator),
      },
      {
        id: "jwt",
        title: t("jwt.name"),
        icon: <LockKeyhole className="h-4 w-4" />,
        getComponent: createToolRenderer(JWTParser),
      },
      {
        id: "text-stats",
        title: t("textStats.name"),
        icon: <PenLine className="h-4 w-4" />,
        getComponent: createToolRenderer(TextStats),
      },
      {
        id: "image-compress",
        title: t("imageCompress.name"),
        icon: <FileImage className="h-4 w-4" />,
        getComponent: createToolRenderer(ImageCompressTool),
      },
      {
        id: "image-editor",
        title: t("imageEditor.name"),
        icon: <WandSparkles className="h-4 w-4" />,
        getComponent: createToolRenderer(ImageEditorTool),
      },
      {
        id: "office-viewer",
        title: t("officeViewer.name"),
        icon: <FileText className="h-4 w-4" />,
        getComponent: createToolRenderer(OfficeViewerTool),
      },
      {
        id: "meme-splitter",
        title: t("memeSplitter.name"),
        icon: <Grid3X3 className="h-4 w-4" />,
        getComponent: createToolRenderer(MemeSplitterTool),
      },
      {
        id: "image-coordinates",
        title: t("imageCoordinates.name"),
        icon: <Crosshair className="h-4 w-4" />,
        getComponent: createToolRenderer(ImageCoordinatesTool),
      },
      {
        id: "case-converter",
        title: t("caseConverter.name"),
        icon: <CaseSensitive className="h-4 w-4" />,
        getComponent: createToolRenderer(CaseConverterTool),
      },
      {
        id: "totp",
        title: t("totp.name"),
        icon: <LockKeyhole className="h-4 w-4" />,
        getComponent: createToolRenderer(TOTPTool),
      },
      {
        id: "jce",
        title: t("jce.name"),
        icon: <FileCode2 className="h-4 w-4" />,
        getComponent: createToolRenderer(JceTool),
      },
      {
        id: "image-convert",
        title: t("imageConvert.name"),
        icon: <ImageDown className="h-4 w-4" />,
        getComponent: createToolRenderer(ImageConvertTool),
      },
      {
        id: "password-generator",
        title: t("passwordGenerator.name"),
        icon: <KeyRound className="h-4 w-4" />,
        getComponent: createToolRenderer(PasswordGeneratorTool),
      },
      {
        id: "data-detector",
        title: t("dataDetector.name"),
        icon: <ScanSearch className="h-4 w-4" />,
        getComponent: createToolRenderer(DataDetectorTool),
      },
      {
        id: "compression",
        title: t("compression.name"),
        icon: <Archive className="h-4 w-4" />,
        getComponent: createToolRenderer(CompressionTool),
      },
      {
        id: "xml",
        title: t("xmlTools.name"),
        icon: <FileCode2 className="h-4 w-4" />,
        getComponent: createToolRenderer(XmlTool),
      },
      {
        id: "csv",
        title: t("csvTools.name"),
        icon: <Table2 className="h-4 w-4" />,
        getComponent: createToolRenderer(CsvTool),
      },
      {
        id: "markdown",
        title: t("markdownTools.name"),
        icon: <FileText className="h-4 w-4" />,
        getComponent: createToolRenderer(MarkdownTool),
      },
      {
        id: "sql",
        title: t("sqlTools.name"),
        icon: <Database className="h-4 w-4" />,
        getComponent: createToolRenderer(SqlTool),
      },
      {
        id: "json-schema",
        title: t("jsonSchemaTools.name"),
        icon: <Braces className="h-4 w-4" />,
        getComponent: createToolRenderer(JsonSchemaTool),
      },
      {
        id: "subnet",
        title: t("subnetTools.name"),
        icon: <Network className="h-4 w-4" />,
        getComponent: createToolRenderer(SubnetTool),
      },
      {
        id: "certificate",
        title: t("certificateTools.name"),
        icon: <ShieldCheck className="h-4 w-4" />,
        getComponent: createToolRenderer(CertificateTool),
      },
      {
        id: "hex-binary",
        title: t("hexBinaryTools.name"),
        icon: <Binary className="h-4 w-4" />,
        getComponent: createToolRenderer(HexBinaryTool),
      },
      {
        id: "diff",
        title: t("diff.name"),
        icon: <GitCompareArrows className="h-4 w-4" />,
        getComponent: createToolRenderer(DiffTool),
      },
    ],
    [t],
  )


  const toolIds = useMemo(() => toolDefinitions.map((tool) => tool.id), [toolDefinitions])
  const { favoriteIds, recentIds, toggleFavorite, recordRecent } = useToolPreferences(toolIds)
  const favoriteTools = useMemo(
    () => favoriteIds.flatMap((id) => toolDefinitions.find((tool) => tool.id === id) ?? []),
    [favoriteIds, toolDefinitions],
  )
  const recentTools = useMemo(
    () => recentIds.flatMap((id) => toolDefinitions.find((tool) => tool.id === id) ?? []),
    [recentIds, toolDefinitions],
  )
  const quickAccessTools = useMemo(() => {
    const seen = new Set<string>()
    return [...favoriteTools, ...recentTools].filter((tool) => {
      if (seen.has(tool.id)) return false
      seen.add(tool.id)
      return true
    }).slice(0, 8)
  }, [favoriteTools, recentTools])

  // 按分类分组工具，保持 toolDefinitions 的原始顺序
  const toolsByCategory = useMemo(
    () =>
      TOOL_CATEGORIES.map((category) => ({
        ...category,
        tools: toolDefinitions.filter(
          (tool) => (TOOL_CATEGORY_MAP[tool.id] ?? DEFAULT_CATEGORY) === category.id,
        ),
      })),
    [toolDefinitions],
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
        qrcodeDecoder: { name: t("qrcodeDecoder.name") },
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
        whois: { name: t("whois.name") },
        imageCompress: { name: t("imageCompress.name") },
        imageEditor: { name: t("imageEditor.name") },
        imageCoordinates: { name: t("imageCoordinates.name") },
        caseConverter: { name: t("caseConverter.name") },
        totp: { name: t("totp.name") },
        jce: { name: t("jce.name") },
        diff: { name: t("diff.name") },
        passwordGenerator: { name: t("passwordGenerator.name") },
        uuid: { name: t("uuid.name") },
        jwt: { name: t("jwt.name") },
        textStats: { name: t("textStats.name") },
        imageConvert: { name: t("imageConvert.name") },
        officeViewer: { name: t("officeViewer.name") },
        memeSplitter: { name: t("memeSplitter.name") },
        dataDetector: { name: t("dataDetector.name") },
        compression: { name: t("compression.name") },
        xmlTools: { name: t("xmlTools.name") },
        csvTools: { name: t("csvTools.name") },
        markdownTools: { name: t("markdownTools.name") },
        sqlTools: { name: t("sqlTools.name") },
        jsonSchemaTools: { name: t("jsonSchemaTools.name") },
        subnetTools: { name: t("subnetTools.name") },
        certificateTools: { name: t("certificateTools.name") },
        hexBinaryTools: { name: t("hexBinaryTools.name") },
      }

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
      setSearchableFeatures([])
    }
  }, [t])

  // 创建可分享的URL
  const createShareableUrl = useCallback(
    (toolIds: string[], toolParams?: Record<string, Record<string, string>>): string => {
      if (typeof window === "undefined") return ""

      const baseUrl = `${window.location.origin}/tools`
      const queryParams = new URLSearchParams()
      queryParams.append("tool", toolIds.join(","))

      if (toolParams) {
        Object.entries(toolParams).forEach(([toolId, params]) => {
          if (params && Object.keys(params).length > 0) {
            Object.entries(params).forEach(([key, value]) => {
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
  const saveTabsToLocalStorage = useCallback((currentTabs: ToolTabType[], currentActiveTab: string | null) => {
    if (typeof window === "undefined") return

    try {
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

  // 更新URL以反映当前打开的标签页
  const updateUrl = useCallback(
    (currentTabs: ToolTabType[], currentActiveTab: string | null) => {
      if (!currentTabs.length || !currentActiveTab) {
        router.replace("/tools", { scroll: false })
        return
      }

      const toolIds = currentTabs.map((tab) => tab.toolId)
      const toolParams: Record<string, Record<string, string>> = {}
      currentTabs.forEach((tab) => {
        if (tab.params && Object.keys(tab.params).length > 0) {
          toolParams[tab.toolId] = tab.params
        }
      })

      const url = createShareableUrl(toolIds, toolParams)
      router.replace(url, { scroll: false })
    },
    [router, createShareableUrl],
  )

  // 添加新标签页
  const addTab = useCallback(
    (toolId: string, params?: Record<string, string>) => {
      const tool = toolDefinitions.find((t) => t.id === toolId)
      if (!tool) return

      const shareableUrl = createShareableUrl([toolId], params ? { [toolId]: params } : undefined)
      const existingTab = tabs.find((tab) => tab.toolId === toolId)

      if (existingTab) {
        const shouldUpdateParams = params !== undefined && !haveEqualToolParams(existingTab.params, params)
        const updatedTabs = shouldUpdateParams
          ? tabs.map((tab) =>
              tab.id === existingTab.id
                ? {
                    ...tab,
                    params,
                    component: tool.getComponent(params),
                    shareableUrl,
                  }
                : tab,
            )
          : tabs

        if (shouldUpdateParams) setTabs(updatedTabs)
        setActiveTab(existingTab.id)
        setShowDropdown(false)
        recordRecent(toolId)
        saveTabsToLocalStorage(updatedTabs, existingTab.id)
        updateUrl(updatedTabs, existingTab.id)
        return
      }

      const id = `${toolId}-${tabCounter}`

      const newTab: ToolTabType = {
        id,
        title: tool.title,
        icon: tool.icon,
        component: tool.getComponent(params),
        closable: true,
        params,
        shareableUrl,
        toolId,
      }

      const updatedTabs = [...tabs, newTab]
      setTabs(updatedTabs)
      setActiveTab(id)
      setTabCounter((prev) => prev + 1)
      setShowDropdown(false)
      recordRecent(toolId)

      saveTabsToLocalStorage(updatedTabs, id)
      updateUrl(updatedTabs, id)
    },
    [toolDefinitions, tabCounter, createShareableUrl, tabs, saveTabsToLocalStorage, updateUrl, recordRecent],
  )

  // 复制分享链接到剪贴板
  const copyShareLink = useCallback(
    (tabId: string, e?: React.MouseEvent) => {
      if (e) {
        e.stopPropagation()
      }

      const tab = tabs.find((t) => t.id === tabId)
      if (!tab || !tab.shareableUrl) return

      navigator.clipboard.writeText(tab.shareableUrl).then(() => {
        setShareTooltip((prev) => ({ ...prev, [tabId]: true }))
        setTimeout(() => {
          setShareTooltip((prev) => ({ ...prev, [tabId]: false }))
        }, 2000)
      })
    },
    [tabs],
  )

  // 关闭标签页 - 用于M3Tabs组件
  const handleTabClose = useCallback(
    (id: string) => {
      const tabIndex = tabs.findIndex((tab) => tab.id === id)
      if (tabIndex === -1) return

      const newTabs = tabs.filter((tab) => tab.id !== id)
      setTabs(newTabs)

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

      saveTabsToLocalStorage(newTabs, newActiveTab)
      updateUrl(newTabs, newActiveTab)

      if (newTabs.length === 0) {
        window.history.replaceState({}, "", "/tools")
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
      addTab(toolId, { feature: featureName })
      setSearchTerm("")
      setSearchResults([])
      setIsSearchFocused(false)
    },
    [addTab],
  )

  // 转换tabs为M3Tabs需要的格式
  const m3TabItems: TabItem[] = useMemo(() => {
    return tabs.map((tab) => ({
      id: tab.id,
      label: tab.title,
      icon: tab.icon,
      closable: tab.closable,
    }))
  }, [tabs])

  // 处理M3Tabs的标签页切换
  const handleM3TabChange = useCallback((id: string) => {
    setActiveTab(id)
  }, [])

  // Navigate to next tab
  const goToNextTab = useCallback(() => {
    if (!activeTab || tabs.length <= 1) return
    const currentIndex = tabs.findIndex((tab) => tab.id === activeTab)
    if (currentIndex < tabs.length - 1) {
      setActiveTab(tabs[currentIndex + 1].id)
    }
  }, [activeTab, tabs])

  // Navigate to previous tab
  const goToPrevTab = useCallback(() => {
    if (!activeTab || tabs.length <= 1) return
    const currentIndex = tabs.findIndex((tab) => tab.id === activeTab)
    if (currentIndex > 0) {
      setActiveTab(tabs[currentIndex - 1].id)
    }
  }, [activeTab, tabs])

  // Swipe gesture handlers for tab switching (mobile only)
  const { handlers: swipeHandlers, swipeOffset, isSwiping } = useSwipe({
    threshold: 50,
    onSwipeLeft: goToNextTab,
    onSwipeRight: goToPrevTab,
  })

  // 工具卡片组件 - M3 Expressive Style
  const ToolCard = useCallback(
    ({ id, name, icon, accent, onClick }: { id: string; name: string; icon: React.ReactNode; accent: string; onClick: () => void }) => {
      const isFavorite = favoriteIds.includes(id)

      return (
        <Card className="group relative h-full min-h-[104px] overflow-hidden rounded-[var(--md-sys-shape-corner-extra-large)] border-[var(--md-sys-color-outline-variant)]/70 bg-[var(--md-sys-color-surface-container-lowest)] shadow-sm transition duration-300 hover:-translate-y-1 hover:border-[var(--md-sys-color-primary)]/40 hover:shadow-xl sm:min-h-[128px]">
          <button
            type="button"
            onClick={onClick}
            className="h-full w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--md-sys-color-primary)]"
            aria-label={name}
          >
            <CardContent className="flex h-full items-center gap-3 p-4 pr-14 sm:gap-4 sm:p-5 sm:pr-16">
              <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl shadow-sm transition-transform duration-300 group-hover:scale-105 sm:h-12 sm:w-12 ${accent}`}>
                {icon}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="line-clamp-2 font-semibold leading-6 text-[var(--md-sys-color-on-surface)] transition-colors group-hover:text-[var(--md-sys-color-primary)]">
                  {name}
                </h3>
                <span className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-[var(--md-sys-color-on-surface-variant)] sm:mt-2">
                  {t("openTool")}
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                </span>
              </div>
            </CardContent>
          </button>
          <button
            type="button"
            onClick={() => toggleFavorite(id)}
            aria-label={isFavorite ? t("removeFavorite") : t("addFavorite")}
            aria-pressed={isFavorite}
            className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full text-[var(--md-sys-color-on-surface-variant)] transition-colors hover:bg-[var(--md-sys-color-primary)]/[0.08] hover:text-[var(--md-sys-color-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--md-sys-color-primary)]"
          >
            <Star className={`h-5 w-5 ${isFavorite ? "fill-current text-[var(--md-sys-color-primary)]" : ""}`} />
          </button>
        </Card>
      )
    },
    [favoriteIds, t, toggleFavorite],
  )

  useEffect(() => {
    const focusSearch = (event: KeyboardEvent) => {
      if (!(event.key.toLowerCase() === "k" && (event.ctrlKey || event.metaKey))) return
      event.preventDefault()
      searchInputRef.current?.focus()
      setIsSearchFocused(true)
    }

    window.addEventListener("keydown", focusSearch)
    return () => window.removeEventListener("keydown", focusSearch)
  }, [])

  // 从URL参数或本地存储中恢复标签页状态
  useEffect(() => {
    if (initialLoadComplete) return

    const toolParam = searchParams.get("tool")

    if (toolParam) {
      const toolIds = uniqueToolIds(
        toolParam.split(",").filter((id) => toolDefinitions.some((t) => t.id === id)),
      )

      if (toolIds.length > 0) {
        const restoredTabs: ToolTabType[] = []
        let nextTabCounter = tabCounter

        toolIds.forEach((toolId) => {
          const tool = toolDefinitions.find((t) => t.id === toolId)
          if (tool) {
            const params: Record<string, string> = {}
            searchParams.forEach((value, key) => {
              if (key.startsWith(`${toolId}_`)) {
                const paramName = key.substring(toolId.length + 1)
                params[paramName] = value
              } else if (key !== "tool" && toolIds.length === 1) {
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
          saveTabsToLocalStorage(restoredTabs, restoredTabs[0].id)
        }
      }
    } else {
      const savedState = restoreTabsFromLocalStorage()

      if (savedState && savedState.tabs.length > 0) {
        const restoredTabs: ToolTabType[] = []
        const restoredToolIds = new Set<string>()
        let nextTabCounter = tabCounter

        savedState.tabs.forEach((savedTab) => {
          if (restoredToolIds.has(savedTab.toolId)) return

          const tool = toolDefinitions.find((t) => t.id === savedTab.toolId)
          if (tool) {
            restoredToolIds.add(savedTab.toolId)
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

          if (savedState.activeTab && restoredTabs.some((tab) => tab.id === savedState.activeTab)) {
            setActiveTab(savedState.activeTab)
          } else {
            setActiveTab(restoredTabs[0].id)
          }

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

    if (activeTab) {
      saveTabsToLocalStorage(tabs, activeTab)
      updateUrl(tabs, activeTab)
    }
  }, [activeTab, tabs, initialLoadComplete, saveTabsToLocalStorage, updateUrl])

  // 点击外部关闭下拉菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const dropdownButton = document.getElementById("add-tab-button")
      const dropdownMenu = dropdownRef.current

      // 如果点击的是加号按钮本身，不处理（让按钮的 onClick 处理）
      if (dropdownButton && dropdownButton.contains(event.target as Node)) {
        return
      }

      // 如果下拉菜单存在且点击在菜单外部，关闭菜单
      if (dropdownMenu && !dropdownMenu.contains(event.target as Node)) {
        setShowDropdown(false)
      }

      // Close search results when clicking outside
      if (
        searchInputRef.current &&
        !searchInputRef.current.contains(event.target as Node) &&
        !(event.target as Element).closest('.search-results')
      ) {
        setIsSearchFocused(false)
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

    const toolIds = tabs.map((tab) => tab.toolId)
    const toolParams: Record<string, Record<string, string>> = {}
    tabs.forEach((tab) => {
      if (tab.params && Object.keys(tab.params).length > 0) {
        toolParams[tab.toolId] = tab.params
      }
    })

    return createShareableUrl(toolIds, toolParams)
  }, [tabs, createShareableUrl])

  // 复制多标签页分享链接
  const copyMultiTabShareLink = useCallback(() => {
    const url = createMultiTabShareLink()
    if (!url) return

    navigator.clipboard.writeText(url).then(() => {
      setShareTooltip((prev) => ({ ...prev, multiTab: true }))
      setTimeout(() => {
        setShareTooltip((prev) => ({ ...prev, multiTab: false }))
      }, 2000)
    })
  }, [createMultiTabShareLink])


  return (
    <div className={`container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 ${tabs.length > 0 ? "py-4 sm:py-6" : "py-6 sm:py-10"}`}>
      {tabs.length === 0 && (
        <section className="mb-8 max-w-3xl">
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm font-bold uppercase tracking-[0.16em] text-[var(--md-sys-color-primary)]">
              {t("eyebrow")}
            </p>
            <span className="rounded-full bg-[var(--md-sys-color-secondary-container)] px-3 py-1 text-xs font-bold text-[var(--md-sys-color-on-secondary-container)]">
              {toolDefinitions.length} {t("countSuffix")}
            </span>
          </div>
          <h1 className="mt-3 text-4xl font-bold tracking-[-0.035em] text-[var(--md-sys-color-on-surface)] sm:text-5xl">
            {t("pageTitle")}
          </h1>
          <p className="mt-4 text-base leading-7 text-[var(--md-sys-color-on-surface-variant)] sm:text-lg">
            {t("intro")}
          </p>
        </section>
      )}

      {/* M3 Expressive Search Bar */}
      <div className={tabs.length > 0 ? "mb-4 sm:mb-6" : "mb-6 sm:mb-8"}>
        <div className="relative">
            <div className="flex items-center gap-2 sm:gap-3">
            {/* M3 Expressive Search Bar with gradient border on focus */}
            <div
              className={`
                relative flex-grow
                bg-[var(--md-sys-color-surface-container-high)]
                rounded-[var(--md-sys-shape-corner-full)]
                transition-all
                duration-md-medium-2
                ease-md-expressive
                ${isSearchFocused
                  ? 'shadow-xl ring-2 ring-[var(--md-sys-color-primary)] scale-[1.01]'
                  : 'shadow-md hover:shadow-lg hover:scale-[1.005]'
                }
              `}
            >
              <div className="flex items-center px-4 py-2 sm:py-3">
                <Search className="h-5 w-5 text-[var(--md-sys-color-on-surface-variant)] mr-3 flex-shrink-0" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchTerm}
                  onChange={(e) => handleSearch(e.target.value)}
                  onFocus={() => setIsSearchFocused(true)}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      setSearchTerm("")
                      setSearchResults([])
                      setIsSearchFocused(false)
                    } else if (event.key === "Enter" && searchResults[0]) {
                      event.preventDefault()
                      openToolWithFeature(searchResults[0].toolId, searchResults[0].featureName)
                    }
                  }}
                  placeholder={t("search.placeholder")}
                  aria-label={t("search.placeholder")}
                  className="
                    workspace-search-input min-w-0 flex-grow bg-transparent border-none outline-none
                    text-[var(--md-sys-color-on-surface)]
                    placeholder:text-[var(--md-sys-color-on-surface-variant)]
                    text-base
                  "
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchTerm("")
                      setSearchResults([])
                    }}
                    aria-label={t("clearSearch")}
                    className="
                      p-1 rounded-full ml-2
                      hover:bg-[var(--md-sys-color-on-surface)]/[0.08]
                      transition-colors duration-md-short-2
                    "
                  >
                    <X className="h-4 w-4 text-[var(--md-sys-color-on-surface-variant)]" />
                  </button>
                )}
                {!searchTerm && (
                  <kbd className="ml-2 hidden items-center gap-1 rounded-lg border border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container-lowest)] px-2 py-1 text-[11px] font-semibold text-[var(--md-sys-color-on-surface-variant)] sm:inline-flex">
                    Ctrl K
                  </kbd>
                )}
              </div>
            </div>
          </div>

          {/* M3 Expressive Search Results Menu */}
          {isSearchFocused && (searchTerm.trim().length > 0 || quickAccessTools.length > 0) && (
            <div
              className="
                search-results
                absolute z-50 w-full mt-3
                bg-[var(--md-sys-color-surface-container)]
                rounded-[var(--md-sys-shape-corner-extra-large)]
                shadow-xl
                p-3 max-h-80 overflow-y-auto
                border border-[var(--md-sys-color-outline-variant)]
                animate-in fade-in-0 slide-in-from-top-3
                duration-md-medium-2
              "
            >
              {searchTerm.trim().length === 0 ? (
                <div>
                  <p className="px-3 pb-2 text-xs font-bold uppercase tracking-[0.14em] text-[var(--md-sys-color-on-surface-variant)]">
                    {t("quickAccess")}
                  </p>
                  {quickAccessTools.map((tool) => (
                    <button
                      key={tool.id}
                      type="button"
                      className="flex w-full items-center gap-3 rounded-[var(--md-sys-shape-corner-medium)] p-3 text-left transition-colors hover:bg-[var(--md-sys-color-on-surface)]/[0.08]"
                      onClick={() => addTab(tool.id)}
                    >
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--md-sys-color-secondary-container)] text-[var(--md-sys-color-on-secondary-container)]">
                        {tool.icon}
                      </span>
                      <span className="font-medium text-[var(--md-sys-color-on-surface)]">{tool.title}</span>
                      {favoriteIds.includes(tool.id) && <Star className="ml-auto h-4 w-4 fill-current text-[var(--md-sys-color-primary)]" />}
                    </button>
                  ))}
                </div>
              ) : searchResults.length > 0 ? searchResults.map((result, index) => (
                <button
                  key={index}
                  className="
                    w-full p-3 text-left
                    rounded-[var(--md-sys-shape-corner-medium)]
                    hover:bg-[var(--md-sys-color-on-surface)]/[0.08]
                    active:bg-[var(--md-sys-color-on-surface)]/[0.12]
                    transition-colors duration-md-short-2
                    flex items-start gap-3
                  "
                  onClick={() => openToolWithFeature(result.toolId, result.featureName)}
                >
                  <div className="
                    p-2 rounded-full
                    bg-[var(--md-sys-color-secondary-container)]
                    text-[var(--md-sys-color-on-secondary-container)]
                    flex-shrink-0
                  ">
                    <Search className="h-4 w-4" />
                  </div>
                  <div className="flex-grow min-w-0">
                    <div className="font-medium text-[var(--md-sys-color-on-surface)] truncate">
                      {result.featureName}
                    </div>
                    <div className="text-sm text-[var(--md-sys-color-on-surface-variant)] flex items-center mt-0.5">
                      <span>{result.toolName}</span>
                      {result.featureDescription && (
                        <span className="ml-2 text-xs opacity-70 truncate">
                          - {result.featureDescription}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              )) : (
                <div className="flex flex-col items-center px-6 py-8 text-center">
                  <Search className="h-6 w-6 text-[var(--md-sys-color-outline)]" />
                  <p className="mt-3 text-sm text-[var(--md-sys-color-on-surface-variant)]">
                    {t("noResults")}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {tabs.length > 0 ? (
        <div className="space-y-4 sm:space-y-6">
          {/* M3 Expressive Tabs with indicator animation */}
          <div className="relative flex flex-col">
            <div className="
              flex items-center
              bg-[var(--md-sys-color-surface-container)]
              rounded-[var(--md-sys-shape-corner-extra-large)]
              shadow-sm
              border border-[var(--md-sys-color-outline-variant)]/50
            ">
              {/* M3 Tabs Component */}
              <div className="flex-1 min-w-0">
                <M3Tabs
                  tabs={m3TabItems}
                  activeTab={activeTab || ""}
                  onTabChange={handleM3TabChange}
                  onTabClose={handleTabClose}
                  variant="primary"
                  scrollable
                  className="border-none bg-transparent"
                />
              </div>

              {/* Action buttons */}
              <div className="flex-shrink-0 flex items-center gap-1 px-2 border-l border-[var(--md-sys-color-outline-variant)]">
                {/* Share multi-tab button */}
                {tabs.length > 1 && (
                  <TooltipProvider>
                    <Tooltip open={shareTooltip.multiTab}>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          aria-label={t("copyLink")}
                          className="
                            p-2 rounded-full
                            hover:bg-[var(--md-sys-color-on-surface)]/[0.08]
                            active:bg-[var(--md-sys-color-on-surface)]/[0.12]
                            transition-colors duration-md-short-2
                            text-[var(--md-sys-color-on-surface-variant)]
                          "
                          onClick={copyMultiTabShareLink}
                        >
                          <Share2 className="h-5 w-5" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>{shareTooltip.multiTab ? t("linkCopied") : t("copyLink")}</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}

                {/* Add tab button with dropdown */}
                <div className="relative">
                  <button
                    id="add-tab-button"
                    type="button"
                    aria-label={t("addTool")}
                    className="
                      p-2 rounded-full
                      hover:bg-[var(--md-sys-color-on-surface)]/[0.08]
                      active:bg-[var(--md-sys-color-on-surface)]/[0.12]
                      transition-colors duration-md-short-2
                      text-[var(--md-sys-color-on-surface-variant)]
                    "
                    onClick={(e) => {
                      e.stopPropagation()
                      if (isCompact) {
                        setShowDropdown(false)
                        setShowToolOptionsSheet(true)
                      } else {
                        setShowDropdown(!showDropdown)
                      }
                    }}
                  >
                    <Plus className="h-5 w-5" />
                  </button>

                  {/* M3 Expressive Dropdown Menu */}
                  {!isCompact && showDropdown && (
                    <div
                      ref={dropdownRef}
                      className="
                        absolute right-0 top-full mt-3 z-50
                        w-64
                        bg-[var(--md-sys-color-surface-container)]
                        rounded-[var(--md-sys-shape-corner-large)]
                        shadow-xl
                        p-3
                        max-h-96 overflow-y-auto
                        border border-[var(--md-sys-color-outline-variant)]/50
                        animate-in fade-in-0 slide-in-from-top-3
                        duration-md-medium-2
                      "
                    >
                      {toolDefinitions.map((tool) => (
                        <button
                          key={tool.id}
                          className="
                            w-full flex items-center gap-3 px-4 py-3
                            rounded-[var(--md-sys-shape-corner-medium)]
                            hover:bg-[var(--md-sys-color-on-surface)]/[0.08]
                            active:bg-[var(--md-sys-color-on-surface)]/[0.16]
                            active:scale-[0.98]
                            transition-all duration-md-short-4
                            ease-md-expressive
                            text-left group
                          "
                          onClick={(e) => {
                            e.stopPropagation()
                            addTab(tool.id)
                          }}
                        >
                          <span className="
                            text-[var(--md-sys-color-on-surface-variant)]
                            group-hover:text-[var(--md-sys-color-primary)]
                            transition-colors duration-md-short-4
                          ">
                            {tool.icon}
                          </span>
                          <span className="text-[var(--md-sys-color-on-surface)] text-sm font-semibold">
                            {tool.title}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Tab content container with swipe gesture support on mobile */}
            <div
              ref={tabContentRef}
              className="mt-3 sm:mt-4"
              {...(isCompact ? swipeHandlers : {})}
              style={isCompact && isSwiping ? {
                transform: `translateX(${swipeOffset * 0.3}px)`,
                transition: 'none',
              } : undefined}
            >
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
          {(favoriteTools.length > 0 || recentTools.length > 0) && (
            <div className="mb-8 grid gap-4 lg:grid-cols-2">
              {favoriteTools.length > 0 && (
                <section className="rounded-[var(--md-sys-shape-corner-extra-large)] border border-[var(--md-sys-color-outline-variant)]/70 bg-[var(--md-sys-color-surface-container-low)] p-5">
                  <div className="mb-4 flex items-center gap-2">
                    <Star className="h-5 w-5 fill-current text-[var(--md-sys-color-primary)]" />
                    <h2 className="font-bold text-[var(--md-sys-color-on-surface)]">{t("favorites")}</h2>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {favoriteTools.map((tool) => (
                      <button key={tool.id} type="button" onClick={() => addTab(tool.id)} className="inline-flex min-h-10 items-center gap-2 rounded-full bg-[var(--md-sys-color-surface-container-lowest)] px-4 text-sm font-semibold text-[var(--md-sys-color-on-surface)] shadow-sm hover:text-[var(--md-sys-color-primary)]">
                        {tool.icon}{tool.title}
                      </button>
                    ))}
                  </div>
                </section>
              )}
              {recentTools.length > 0 && (
                <section className="rounded-[var(--md-sys-shape-corner-extra-large)] border border-[var(--md-sys-color-outline-variant)]/70 bg-[var(--md-sys-color-surface-container-low)] p-5">
                  <div className="mb-4 flex items-center gap-2">
                    <Clock className="h-5 w-5 text-[var(--md-sys-color-primary)]" />
                    <h2 className="font-bold text-[var(--md-sys-color-on-surface)]">{t("recentTools")}</h2>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {recentTools.map((tool) => (
                      <button key={tool.id} type="button" onClick={() => addTab(tool.id)} className="inline-flex min-h-10 items-center gap-2 rounded-full bg-[var(--md-sys-color-surface-container-lowest)] px-4 text-sm font-semibold text-[var(--md-sys-color-on-surface)] shadow-sm hover:text-[var(--md-sys-color-primary)]">
                        {tool.icon}{tool.title}
                      </button>
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 className="text-xl font-bold text-[var(--md-sys-color-on-surface)]">{t("allTools")}</h2>
            <span className="hidden text-sm text-[var(--md-sys-color-on-surface-variant)] sm:inline">{t("favoriteHint")}</span>
          </div>

          {/* 分类筛选 Chips */}
          <div className="-mx-4 mb-6 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0 sm:pb-0">
            <button
              type="button"
              onClick={() => setActiveCategory("all")}
              aria-pressed={activeCategory === "all"}
              className={`inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full px-4 text-sm font-semibold transition-all duration-md-short-4 ease-md-expressive active:scale-95 ${
                activeCategory === "all"
                  ? "bg-[var(--md-sys-color-secondary-container)] text-[var(--md-sys-color-on-secondary-container)] shadow-sm"
                  : "border border-[var(--md-sys-color-outline-variant)]/70 bg-[var(--md-sys-color-surface-container-lowest)] text-[var(--md-sys-color-on-surface-variant)] hover:text-[var(--md-sys-color-on-surface)]"
              }`}
            >
              {t("categories.all")}
              <span className="text-xs opacity-70">{toolDefinitions.length}</span>
            </button>
            {toolsByCategory.map((category) => (
              <button
                key={category.id}
                type="button"
                onClick={() => setActiveCategory(category.id)}
                aria-pressed={activeCategory === category.id}
                className={`inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full px-4 text-sm font-semibold transition-all duration-md-short-4 ease-md-expressive active:scale-95 ${
                  activeCategory === category.id
                    ? "bg-[var(--md-sys-color-secondary-container)] text-[var(--md-sys-color-on-secondary-container)] shadow-sm"
                    : "border border-[var(--md-sys-color-outline-variant)]/70 bg-[var(--md-sys-color-surface-container-lowest)] text-[var(--md-sys-color-on-surface-variant)] hover:text-[var(--md-sys-color-on-surface)]"
                }`}
              >
                <span className={`h-2 w-2 rounded-full ${category.dot}`} />
                {t(`categories.${category.id}`)}
                <span className="text-xs opacity-70">{category.tools.length}</span>
              </button>
            ))}
          </div>

          {activeCategory === "all" ? (
            <div className="space-y-8">
              {toolsByCategory.map((category) => (
                <section key={category.id}>
                  <div className="mb-4 flex items-center gap-2.5">
                    <span className={`h-2.5 w-2.5 rounded-full ${category.dot}`} />
                    <h3 className="font-bold text-[var(--md-sys-color-on-surface)]">{t(`categories.${category.id}`)}</h3>
                    <span className="text-sm text-[var(--md-sys-color-on-surface-variant)]">{category.tools.length}</span>
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {category.tools.map((tool) => (
                      <ToolCard key={tool.id} id={tool.id} name={tool.title} icon={tool.icon} accent={category.accent} onClick={() => addTab(tool.id)} />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            (() => {
              const selected = toolsByCategory.find((category) => category.id === activeCategory)
              return (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {(selected?.tools ?? []).map((tool) => (
                    <ToolCard
                      key={tool.id}
                      id={tool.id}
                      name={tool.title}
                      icon={tool.icon}
                      accent={selected?.accent ?? TOOL_CATEGORIES[0].accent}
                      onClick={() => addTab(tool.id)}
                    />
                  ))}
                </div>
              )
            })()
          )}
        </div>
      )}

      {/* Mobile Bottom Sheet for Tool Options */}
      <M3BottomSheet
        open={showToolOptionsSheet}
        onClose={() => setShowToolOptionsSheet(false)}
        title={t("addTool")}
        closeLabel={t("close")}
      >
        <div className="grid grid-cols-2 gap-3">
          {toolDefinitions.map((tool) => (
            <button
              key={tool.id}
              className="
                flex flex-col items-center gap-2 p-4
                rounded-[var(--md-sys-shape-corner-large)]
                bg-[var(--md-sys-color-surface-container-high)]
                hover:bg-[var(--md-sys-color-on-surface)]/[0.08]
                active:bg-[var(--md-sys-color-on-surface)]/[0.12]
                transition-colors duration-md-short-2
              "
              onClick={() => {
                addTab(tool.id)
                setShowToolOptionsSheet(false)
              }}
            >
              <div className="
                p-3 rounded-full
                bg-[var(--md-sys-color-primary-container)]
                text-[var(--md-sys-color-on-primary-container)]
              ">
                {tool.icon}
              </div>
              <span className="text-sm font-medium text-[var(--md-sys-color-on-surface)] text-center">
                {tool.title}
              </span>
            </button>
          ))}
        </div>
      </M3BottomSheet>
    </div>
  )
}
