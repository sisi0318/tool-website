"use client"

import type React from "react"

import { useState, useEffect, useMemo, useCallback, useRef } from "react"
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
  ChevronDown,
  MoreVertical,
} from "lucide-react"
import dynamic from "next/dynamic"
import { type SearchResult, createSearchableFeatures, searchFeatures } from "./search-utils"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { LanguageSwitcher } from "@/components/language-switcher"
import { M3Tabs, type TabItem } from "@/components/m3/tabs"
import { M3BottomSheet } from "@/components/m3/bottom-sheet"
import { useBreakpoint } from "@/hooks/use-breakpoint"
import { useSwipe } from "@/hooks/use-swipe"

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
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
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
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
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
      {
        id: "protobuf",
        title: t("protobuf.name"),
        icon: (
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
        ),
        getComponent: (params?: Record<string, string>) => <ProtobufTool params={params} />,
      },
      {
        id: "base-converter",
        title: t("baseConverter.name"),
        icon: <Calculator className="h-4 w-4" />,
        getComponent: (params?: Record<string, string>) => <BaseConverterTool params={params} />,
      },
      {
        id: "temperature-converter",
        title: t("temperatureConverter.name"),
        icon: (
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
            <path d="M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z" />
            <path d="M12 9a1 1 0 0 0-1-1h0a1 1 0 0 0-1 1h0a1 1 0 0 0 1 1h0a1 1 0 0 0 1-1Z" />
          </svg>
        ),
        getComponent: (params?: Record<string, string>) => <TemperatureConverterPage params={params} />,
      },
      {
        id: "docker-converter",
        title: t("dockerConverter.name"),
        icon: (
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
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
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
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
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
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
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
            <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
            <circle cx="9" cy="9" r="2" />
            <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
            <path d="M8 21h13" />
          </svg>
        ),
        getComponent: (params?: Record<string, string>) => <ExifViewerTool params={params} />,
      },
      {
        id: "bmi",
        title: t("bmi.name"),
        icon: (
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
            <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
            <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
            <path d="M9 12h6"></path>
            <path d="M9 16h6"></path>
          </svg>
        ),
        getComponent: (params?: Record<string, string>) => <BMICalculator params={params} />,
      },
      {
        id: "regex",
        title: t("regex.name"),
        icon: (
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
            <path d="M17 3v10"></path>
            <path d="m12.67 5.5 8.66 5"></path>
            <path d="m12.67 10.5 8.66-5"></path>
            <path d="M9 17a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2v-2z"></path>
          </svg>
        ),
        getComponent: (params?: Record<string, string>) => <RegexTool params={params} />,
      },
      {
        id: "qrcode-decode",
        title: t("qrcodeDecoder.name"),
        icon: (
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
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
      {
        id: "http-tester",
        title: t("httpTester.name"),
        icon: (
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
            <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
            <line x1="3" x2="21" y1="9" y2="9" />
            <line x1="9" x2="9" y1="3" y2="21" />
          </svg>
        ),
        getComponent: (params?: Record<string, string>) => <HTTPTester params={params} />,
      },
      {
        id: "whois",
        title: t("whois.name"),
        icon: (
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
            <circle cx="12" cy="12" r="10" />
            <line x1="2" x2="22" y1="12" y2="12" />
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
          </svg>
        ),
        getComponent: (params?: Record<string, string>) => <WhoisPage params={params} />,
      },
      {
        id: "uuid",
        title: t("uuid.name"),
        icon: (
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
            <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
            <path d="M7 7h.01" />
            <path d="M17 7h.01" />
            <path d="M7 17h.01" />
            <path d="M17 17h.01" />
            <path d="M12 12h.01" />
          </svg>
        ),
        getComponent: (params?: Record<string, string>) => <UUIDGenerator params={params} />,
      },
      {
        id: "jwt",
        title: t("jwt.name"),
        icon: (
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
            <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        ),
        getComponent: (params?: Record<string, string>) => <JWTParser params={params} />,
      },
      {
        id: "text-stats",
        title: t("textStats.name"),
        icon: (
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
            <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
          </svg>
        ),
        getComponent: (params?: Record<string, string>) => <TextStats params={params} />,
      },
      {
        id: "image-compress",
        title: t("imageCompress.name"),
        icon: (
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
            <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
            <circle cx="9" cy="9" r="2" />
            <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
            <path d="M14 14 8 8" />
            <path d="m8 11 3-3" />
          </svg>
        ),
        getComponent: (params?: Record<string, string>) => <ImageCompressTool params={params} />,
      },
      {
        id: "image-editor",
        title: t("imageEditor.name"),
        icon: (
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" x2="12" y1="3" y2="15" />
            <path d="m14 14-2 2-2-2" />
            <rect width="20" height="14" x="2" y="3" rx="2" />
            <circle cx="8" cy="10" r="2" />
            <path d="m22 17-5-5-5 5" />
          </svg>
        ),
        getComponent: (params?: Record<string, string>) => <ImageEditorTool params={params} />,
      },
      {
        id: "office-viewer",
        title: t("officeViewer.name"),
        icon: (
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
            <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" x2="8" y1="13" y2="13" />
            <line x1="16" x2="8" y1="17" y2="17" />
            <line x1="10" x2="8" y1="9" y2="9" />
          </svg>
        ),
        getComponent: (params?: Record<string, string>) => <OfficeViewerTool params={params} />,
      },
      {
        id: "meme-splitter",
        title: t("memeSplitter.name"),
        icon: (
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
            <rect width="18" height="18" x="3" y="3" rx="2" />
            <path d="M3 9h18" />
            <path d="M3 15h18" />
            <path d="M9 3v18" />
            <path d="M15 3v18" />
          </svg>
        ),
        getComponent: (params?: Record<string, string>) => <MemeSplitterTool params={params} />,
      },
      {
        id: "image-coordinates",
        title: t("imageCoordinates.name"),
        icon: (
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
            <circle cx="12" cy="12" r="10" />
            <line x1="22" x2="18" y1="12" y2="12" />
            <line x1="6" x2="2" y1="12" y2="12" />
            <line x1="12" x2="12" y1="6" y2="2" />
            <line x1="12" x2="12" y1="22" y2="18" />
          </svg>
        ),
        getComponent: (params?: Record<string, string>) => <ImageCoordinatesTool params={params} />,
      },
      {
        id: "case-converter",
        title: t("caseConverter.name"),
        icon: (
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
            <path d="m3 15 4-8 4 8" />
            <path d="M4 13h6" />
            <path d="M15 11h4.5a2 2 0 0 1 0 4H15V7h4a2 2 0 0 1 0 4" />
          </svg>
        ),
        getComponent: (params?: Record<string, string>) => <CaseConverterTool params={params} />,
      },
      {
        id: "totp",
        title: t("totp.name"),
        icon: (
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
            <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            <circle cx="12" cy="16" r="1" />
          </svg>
        ),
        getComponent: (params?: Record<string, string>) => <TOTPTool params={params} />,
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
        imageCompress: { name: t("imageCompress.name") },
        caseConverter: { name: t("caseConverter.name") },
        totp: { name: t("totp.name") },
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
  }, [])

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

      const id = `${toolId}-${tabCounter}`
      const shareableUrl = createShareableUrl([toolId], params ? { [toolId]: params } : undefined)

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

      saveTabsToLocalStorage(updatedTabs, id)
      updateUrl(updatedTabs, id)
    },
    [toolDefinitions, tabCounter, createShareableUrl, tabs, saveTabsToLocalStorage, updateUrl],
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

  // 关闭标签页 - 用于旧版按钮
  const closeTab = useCallback(
    (id: string, e: React.MouseEvent) => {
      e.stopPropagation()
      handleTabClose(id)
    },
    [handleTabClose],
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
    ({ id, name, icon, onClick }: { id: string; name: string; icon: React.ReactNode; onClick: () => void }) => (
      <Card
        className="
          h-full card-elevated cursor-pointer group
          hover:shadow-xl hover:-translate-y-2
          transition-all duration-[var(--md-sys-motion-duration-medium2)]
          ease-[var(--md-sys-motion-easing-expressive)]
          active:scale-[0.98] active:translate-y-0
        "
        onClick={onClick}
      >
        <CardContent className="flex flex-col items-center justify-center p-6 h-full">
          <div className="
            mb-4 p-4
            bg-gradient-to-br from-[var(--md-sys-color-primary-container)] to-[var(--md-sys-color-tertiary-container)]
            text-[var(--md-sys-color-on-primary-container)]
            rounded-[var(--md-sys-shape-corner-large)]
            transition-all duration-[var(--md-sys-motion-duration-medium2)]
            ease-[var(--md-sys-motion-easing-expressive)]
            group-hover:scale-110 group-hover:rotate-3
            shadow-md group-hover:shadow-lg
          ">
            {icon}
          </div>
          <h3 className="
            font-semibold text-center
            text-[var(--md-sys-color-on-surface)]
            group-hover:text-gradient
            transition-colors duration-[var(--md-sys-motion-duration-medium2)]
          ">
            {name}
          </h3>
        </CardContent>
      </Card>
    ),
    [],
  )

  // 从URL参数或本地存储中恢复标签页状态
  useEffect(() => {
    if (initialLoadComplete) return

    const toolParam = searchParams.get("tool")

    if (toolParam) {
      const toolIds = toolParam.split(",").filter((id) => toolDefinitions.some((t) => t.id === id))

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
    <div className="container mx-auto px-4 py-6 sm:py-8">
      {/* M3 Expressive Search Bar */}
      <div className="mb-6 sm:mb-8">
        <div className="relative">
          <div className="flex items-center gap-2 sm:gap-3">
            {/* M3 Expressive Search Bar with gradient border on focus */}
            <div
              className={`
                relative flex-grow
                bg-[var(--md-sys-color-surface-container-high)]
                rounded-[var(--md-sys-shape-corner-full)]
                transition-all
                duration-[var(--md-sys-motion-duration-medium2)]
                ease-[var(--md-sys-motion-easing-expressive)]
                ${isSearchFocused
                  ? 'shadow-xl ring-2 ring-[var(--md-sys-color-primary)] scale-[1.01]'
                  : 'shadow-md hover:shadow-lg hover:scale-[1.005]'
                }
              `}
            >
              <div className="flex items-center px-4 py-3">
                <Search className="h-5 w-5 text-[var(--md-sys-color-on-surface-variant)] mr-3 flex-shrink-0" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchTerm}
                  onChange={(e) => handleSearch(e.target.value)}
                  onFocus={() => setIsSearchFocused(true)}
                  placeholder={t("search.placeholder")}
                  className="
                    flex-grow bg-transparent border-none outline-none
                    text-[var(--md-sys-color-on-surface)]
                    placeholder:text-[var(--md-sys-color-on-surface-variant)]
                    text-base
                  "
                />
                {searchTerm && (
                  <button
                    onClick={() => {
                      setSearchTerm("")
                      setSearchResults([])
                    }}
                    className="
                      p-1 rounded-full ml-2
                      hover:bg-[var(--md-sys-color-on-surface)]/[0.08]
                      transition-colors duration-[var(--md-sys-motion-duration-short2)]
                    "
                  >
                    <X className="h-4 w-4 text-[var(--md-sys-color-on-surface-variant)]" />
                  </button>
                )}
              </div>
            </div>
            <LanguageSwitcher />
          </div>

          {/* M3 Expressive Search Results Menu */}
          {isSearchFocused && searchResults.length > 0 && (
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
                duration-[var(--md-sys-motion-duration-medium2)]
              "
            >
              {searchResults.map((result, index) => (
                <button
                  key={index}
                  className="
                    w-full p-3 text-left
                    rounded-[var(--md-sys-shape-corner-medium)]
                    hover:bg-[var(--md-sys-color-on-surface)]/[0.08]
                    active:bg-[var(--md-sys-color-on-surface)]/[0.12]
                    transition-colors duration-[var(--md-sys-motion-duration-short2)]
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
              ))}
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
              <div className="flex-1 overflow-hidden">
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
                          className="
                            p-2 rounded-full
                            hover:bg-[var(--md-sys-color-on-surface)]/[0.08]
                            active:bg-[var(--md-sys-color-on-surface)]/[0.12]
                            transition-colors duration-[var(--md-sys-motion-duration-short2)]
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
                    className="
                      p-2 rounded-full
                      hover:bg-[var(--md-sys-color-on-surface)]/[0.08]
                      active:bg-[var(--md-sys-color-on-surface)]/[0.12]
                      transition-colors duration-[var(--md-sys-motion-duration-short2)]
                      text-[var(--md-sys-color-on-surface-variant)]
                    "
                    onClick={(e) => {
                      e.stopPropagation()
                      setShowDropdown(!showDropdown)
                    }}
                  >
                    <Plus className="h-5 w-5" />
                  </button>

                  {/* M3 Expressive Dropdown Menu */}
                  {showDropdown && (
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
                        duration-[var(--md-sys-motion-duration-medium2)]
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
                            transition-all duration-[var(--md-sys-motion-duration-short4)]
                            ease-[var(--md-sys-motion-easing-expressive)]
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
                            transition-colors duration-[var(--md-sys-motion-duration-short4)]
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
              className="mt-4"
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

            {/* Mobile: More options button */}
            {isCompact && activeTab && (
              <button
                className="
                  fixed bottom-20 right-4 z-40
                  p-3 rounded-full
                  bg-[var(--md-sys-color-secondary-container)]
                  text-[var(--md-sys-color-on-secondary-container)]
                  shadow-lg
                  hover:shadow-xl
                  transition-all duration-[var(--md-sys-motion-duration-medium2)]
                  ease-[var(--md-sys-motion-easing-emphasized)]
                "
                onClick={() => setShowToolOptionsSheet(true)}
                aria-label="More options"
              >
                <MoreVertical className="h-6 w-6" />
              </button>
            )}
          </div>
        </div>
      ) : (
        <div>
          <h1 className="
            text-3xl font-bold mb-8 text-center
            text-[var(--md-sys-color-on-surface)]
          ">
            {t("pageTitle")}
          </h1>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {toolDefinitions.map((tool) => (
              <ToolCard key={tool.id} id={tool.id} name={tool.title} icon={tool.icon} onClick={() => addTab(tool.id)} />
            ))}
          </div>
        </div>
      )}

      {/* Mobile Bottom Sheet for Tool Options */}
      <M3BottomSheet
        open={showToolOptionsSheet}
        onClose={() => setShowToolOptionsSheet(false)}
        title={t("addTool") || "Add Tool"}
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
                transition-colors duration-[var(--md-sys-motion-duration-short2)]
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
