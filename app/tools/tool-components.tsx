"use client"

import type { ComponentType } from "react"
import dynamic from "next/dynamic"
import {
  Archive,
  Binary,
  Braces,
  Calculator,
  CalendarClock,
  Camera,
  CaseSensitive,
  CircleDot,
  ClipboardList,
  Clock,
  Code,
  Container,
  Crosshair,
  Database,
  Dices,
  FileCode2,
  FileImage,
  FileJson,
  FileText,
  GitCompareArrows,
  Globe2,
  Grid3X3,
  Hash,
  History,
  Image,
  ImageDown,
  Key,
  KeyRound,
  Layers,
  Lock,
  LockKeyhole,
  Network,
  PanelTop,
  PenLine,
  QrCode,
  Regex,
  ScanQrCode,
  ScanSearch,
  ShieldCheck,
  Smartphone,
  Table2,
  Thermometer,
  TrendingUp,
  WandSparkles,
} from "lucide-react"

import type { LucideIcon } from "lucide-react"

/**
 * 工具 id → 图标与页面组件。
 *
 * 数据部分在 lib/tools/catalog.ts；这里只放 React 关注点。动态 import 的路径
 * 必须是字面量（打包器要静态分析），所以这张表只能手写，由
 * lib/tool-registry.test.ts 断言它与目录覆盖同一批 id。
 */
export interface ToolComponentEntry {
  icon: LucideIcon
  load: ComponentType
}

export const TOOL_COMPONENTS: Record<string, ToolComponentEntry> = {
  "base-converter": {
    icon: Calculator,
    load: dynamic(() => import("./base-converter/page"), { ssr: false }),
  },
  bmi: {
    icon: ClipboardList,
    load: dynamic(() => import("./bmi/page"), { ssr: false }),
  },
  "case-converter": {
    icon: CaseSensitive,
    load: dynamic(() => import("./case-converter/page"), { ssr: false }),
  },
  certificate: {
    icon: ShieldCheck,
    load: dynamic(() => import("./certificate/page"), { ssr: false }),
  },
  "classic-cipher": {
    icon: History,
    load: dynamic(() => import("./classic-cipher/page"), { ssr: false }),
  },
  color: {
    icon: CircleDot,
    load: dynamic(() => import("./color/page"), { ssr: false }),
  },
  compression: {
    icon: Archive,
    load: dynamic(() => import("./compression/page"), { ssr: false }),
  },
  crontab: {
    icon: CalendarClock,
    load: dynamic(() => import("./crontab/page"), { ssr: false }),
  },
  crypto: {
    icon: Lock,
    load: dynamic(() => import("./crypto/page"), { ssr: false }),
  },
  csv: {
    icon: Table2,
    load: dynamic(() => import("./csv/page"), { ssr: false }),
  },
  currency: {
    icon: TrendingUp,
    load: dynamic(() => import("./currency/page"), { ssr: false }),
  },
  "data-detector": {
    icon: ScanSearch,
    load: dynamic(() => import("./data-detector/page"), { ssr: false }),
  },
  device: {
    icon: Smartphone,
    load: dynamic(() => import("./device/page"), { ssr: false }),
  },
  diff: {
    icon: GitCompareArrows,
    load: dynamic(() => import("./diff/page"), { ssr: false }),
  },
  "docker-converter": {
    icon: Container,
    load: dynamic(() => import("./docker-converter/page"), { ssr: false }),
  },
  encoding: {
    icon: Code,
    load: dynamic(() => import("./encoding/page"), { ssr: false }),
  },
  "exif-viewer": {
    icon: Camera,
    load: dynamic(() => import("./exif-viewer/page"), { ssr: false }),
  },
  hash: {
    icon: Hash,
    load: dynamic(() => import("./hash/page"), { ssr: false }),
  },
  "hex-binary": {
    icon: Binary,
    load: dynamic(() => import("./hex-binary/page"), { ssr: false }),
  },
  hmac: {
    icon: Key,
    load: dynamic(() => import("./hmac/page"), { ssr: false }),
  },
  "http-tester": {
    icon: PanelTop,
    load: dynamic(() => import("./http-tester/page"), { ssr: false }),
  },
  "image-compress": {
    icon: FileImage,
    load: dynamic(() => import("./image-compress/page"), { ssr: false }),
  },
  "image-convert": {
    icon: ImageDown,
    load: dynamic(() => import("./image-convert/page"), { ssr: false }),
  },
  "image-coordinates": {
    icon: Crosshair,
    load: dynamic(() => import("./image-coordinates/page"), { ssr: false }),
  },
  "image-editor": {
    icon: WandSparkles,
    load: dynamic(() => import("./image-editor/page"), { ssr: false }),
  },
  "image-to-base64": {
    icon: Image,
    load: dynamic(() => import("./image-to-base64/page"), { ssr: false }),
  },
  jce: {
    icon: FileCode2,
    load: dynamic(() => import("./jce/page"), { ssr: false }),
  },
  json: {
    icon: FileJson,
    load: dynamic(() => import("./json/page"), { ssr: false }),
  },
  "json-schema": {
    icon: Braces,
    load: dynamic(() => import("./json-schema/page"), { ssr: false }),
  },
  jwt: {
    icon: LockKeyhole,
    load: dynamic(() => import("./jwt/page"), { ssr: false }),
  },
  markdown: {
    icon: FileText,
    load: dynamic(() => import("./markdown/page"), { ssr: false }),
  },
  "meme-splitter": {
    icon: Grid3X3,
    load: dynamic(() => import("./meme-splitter/page"), { ssr: false }),
  },
  "office-viewer": {
    icon: FileText,
    load: dynamic(() => import("./office-viewer/page"), { ssr: false }),
  },
  "password-generator": {
    icon: KeyRound,
    load: dynamic(() => import("./password-generator/page"), { ssr: false }),
  },
  protobuf: {
    icon: Layers,
    load: dynamic(() => import("./protobuf/page"), { ssr: false }),
  },
  qrcode: {
    icon: QrCode,
    load: dynamic(() => import("./qrcode/page"), { ssr: false }),
  },
  "qrcode-decode": {
    icon: ScanQrCode,
    load: dynamic(() => import("./qrcode-decode/page"), { ssr: false }),
  },
  regex: {
    icon: Regex,
    load: dynamic(() => import("./regex/page"), { ssr: false }),
  },
  sql: {
    icon: Database,
    load: dynamic(() => import("./sql/page"), { ssr: false }),
  },
  subnet: {
    icon: Network,
    load: dynamic(() => import("./subnet/page"), { ssr: false }),
  },
  "temperature-converter": {
    icon: Thermometer,
    load: dynamic(() => import("./temperature-converter/page"), { ssr: false }),
  },
  "text-stats": {
    icon: PenLine,
    load: dynamic(() => import("./text-stats/page"), { ssr: false }),
  },
  time: {
    icon: Clock,
    load: dynamic(() => import("./time/page"), { ssr: false }),
  },
  totp: {
    icon: LockKeyhole,
    load: dynamic(() => import("./totp/page"), { ssr: false }),
  },
  uuid: {
    icon: Dices,
    load: dynamic(() => import("./uuid/page"), { ssr: false }),
  },
  whois: {
    icon: Globe2,
    load: dynamic(() => import("./whois/page"), { ssr: false }),
  },
  xml: {
    icon: FileCode2,
    load: dynamic(() => import("./xml/page"), { ssr: false }),
  },
}
