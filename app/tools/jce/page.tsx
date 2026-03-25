"use client"

import type React from "react"
import { useState, useRef, useCallback, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { useTranslations } from "@/hooks/use-translations"
import {
  Copy, FileUp, X, Download, RefreshCw, Upload, Settings,
  ChevronUp, ChevronDown, Code, FileText, Database, Check,
  Loader2, Zap, Eye, BookOpen,
} from "lucide-react"

// ==================== JCE Protocol Constants ====================

const JCE_TYPE = {
  BYTE: 0,
  SHORT: 1,
  INT: 2,
  LONG: 3,
  FLOAT: 4,
  DOUBLE: 5,
  STRING1: 6,
  STRING4: 7,
  MAP: 8,
  LIST: 9,
  STRUCT_BEGIN: 10,
  STRUCT_END: 11,
  ZERO: 12,
  SIMPLE_LIST: 13,
} as const

const JCE_TYPE_NAMES: Record<number, string> = {
  0: "Byte",
  1: "Short",
  2: "Int",
  3: "Long",
  4: "Float",
  5: "Double",
  6: "String1",
  7: "String4",
  8: "Map",
  9: "List",
  10: "Struct",
  11: "StructEnd",
  12: "Zero",
  13: "SimpleList",
}

// ==================== JCE Parser ====================

interface JceField {
  tag: number
  type: number
  typeName: string
  value: any
}

class JceParser {
  private data: Uint8Array
  private offset = 0
  private maxDepth = 32

  constructor(data: Uint8Array) {
    this.data = data
  }

  private readHead(): { tag: number; type: number } | null {
    if (this.offset >= this.data.length) return null
    const byte = this.data[this.offset++]
    const type = byte & 0x0f
    let tag = (byte >> 4) & 0x0f
    if (tag === 0x0f) {
      if (this.offset >= this.data.length) return null
      tag = this.data[this.offset++]
    }
    return { tag, type }
  }

  private readByte(): number {
    if (this.offset >= this.data.length) throw new Error("Unexpected end of data reading byte")
    return this.data[this.offset++]
  }

  private readShort(): number {
    if (this.offset + 2 > this.data.length) throw new Error("Unexpected end of data reading short")
    const v = (this.data[this.offset] << 8) | this.data[this.offset + 1]
    this.offset += 2
    return v > 0x7fff ? v - 0x10000 : v
  }

  private readInt(): number {
    if (this.offset + 4 > this.data.length) throw new Error("Unexpected end of data reading int")
    const v =
      (this.data[this.offset] << 24) |
      (this.data[this.offset + 1] << 16) |
      (this.data[this.offset + 2] << 8) |
      this.data[this.offset + 3]
    this.offset += 4
    return v
  }

  private readLong(): string {
    if (this.offset + 8 > this.data.length) throw new Error("Unexpected end of data reading long")
    let value = BigInt(0)
    for (let i = 0; i < 8; i++) {
      value = (value << BigInt(8)) | BigInt(this.data[this.offset + i])
    }
    this.offset += 8
    const signBit = BigInt(1) << BigInt(63)
    if (value >= signBit) value -= BigInt(1) << BigInt(64)
    return value.toString()
  }

  private readFloat(): number {
    if (this.offset + 4 > this.data.length) throw new Error("Unexpected end of data reading float")
    const buf = new Uint8Array(4)
    buf.set(this.data.slice(this.offset, this.offset + 4))
    this.offset += 4
    return new DataView(buf.buffer).getFloat32(0, false)
  }

  private readDouble(): number {
    if (this.offset + 8 > this.data.length) throw new Error("Unexpected end of data reading double")
    const buf = new Uint8Array(8)
    buf.set(this.data.slice(this.offset, this.offset + 8))
    this.offset += 8
    return new DataView(buf.buffer).getFloat64(0, false)
  }

  private readString1(): string {
    const length = this.readByte()
    if (this.offset + length > this.data.length) throw new Error("Unexpected end of data reading string1")
    const bytes = this.data.slice(this.offset, this.offset + length)
    this.offset += length
    return new TextDecoder("utf-8", { fatal: false }).decode(bytes)
  }

  private readString4(): string {
    if (this.offset + 4 > this.data.length) throw new Error("Unexpected end of data reading string4 length")
    const length =
      ((this.data[this.offset] << 24) |
        (this.data[this.offset + 1] << 16) |
        (this.data[this.offset + 2] << 8) |
        this.data[this.offset + 3]) >>> 0
    this.offset += 4
    if (length > 100 * 1024 * 1024) throw new Error("String4 length too large: " + length)
    if (this.offset + length > this.data.length) throw new Error("Unexpected end of data reading string4")
    const bytes = this.data.slice(this.offset, this.offset + length)
    this.offset += length
    return new TextDecoder("utf-8", { fatal: false }).decode(bytes)
  }

  private readNumberByType(type: number): number {
    switch (type) {
      case JCE_TYPE.ZERO: return 0
      case JCE_TYPE.BYTE: return this.readByte()
      case JCE_TYPE.SHORT: return this.readShort()
      case JCE_TYPE.INT: return this.readInt()
      default: throw new Error("Expected numeric type for size, got type=" + type)
    }
  }

  private readMap(depth: number): Record<string, any> {
    if (depth > this.maxDepth) throw new Error("Max nesting depth exceeded")
    const sizeHead = this.readHead()
    if (!sizeHead) throw new Error("Unexpected end of data reading map size")
    const size = this.readNumberByType(sizeHead.type)
    const map: Record<string, any> = {}
    for (let i = 0; i < size; i++) {
      const kh = this.readHead()
      if (!kh) break
      const key = this.readValueByType(kh.type, depth + 1)
      const vh = this.readHead()
      if (!vh) break
      const val = this.readValueByType(vh.type, depth + 1)
      map[String(key)] = val
    }
    return map
  }

  private readList(depth: number): any[] {
    if (depth > this.maxDepth) throw new Error("Max nesting depth exceeded")
    const sizeHead = this.readHead()
    if (!sizeHead) throw new Error("Unexpected end of data reading list size")
    const size = this.readNumberByType(sizeHead.type)
    const list: any[] = []
    for (let i = 0; i < size; i++) {
      const h = this.readHead()
      if (!h) break
      list.push(this.readValueByType(h.type, depth + 1))
    }
    return list
  }

  private readStruct(depth: number): Record<string, any> {
    if (depth > this.maxDepth) throw new Error("Max nesting depth exceeded")
    const struct: Record<string, any> = {}
    while (this.offset < this.data.length) {
      const head = this.readHead()
      if (!head) break
      if (head.type === JCE_TYPE.STRUCT_END) break
      struct[String(head.tag)] =
        head.type === JCE_TYPE.ZERO ? 0 : this.readValueByType(head.type, depth + 1)
    }
    return struct
  }

  private readSimpleList(): string {
    const elemHead = this.readHead()
    if (!elemHead) throw new Error("Unexpected end of data reading simple list element type")
    const sizeHead = this.readHead()
    if (!sizeHead) throw new Error("Unexpected end of data reading simple list size")
    const size = this.readNumberByType(sizeHead.type)
    if (size < 0 || this.offset + size > this.data.length) {
      throw new Error("Invalid simple list size: " + size)
    }
    const bytes = this.data.slice(this.offset, this.offset + size)
    this.offset += size
    if (elemHead.type === JCE_TYPE.BYTE && size > 0) {
      try {
        const str = new TextDecoder("utf-8", { fatal: true }).decode(bytes)
        if (!/[\x00-\x08\x0e-\x1f]/.test(str)) return str
      } catch { /* not valid UTF-8, fall through to hex */ }
    }
    return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("")
  }

  private readValueByType(type: number, depth = 0): any {
    switch (type) {
      case JCE_TYPE.BYTE: return this.readByte()
      case JCE_TYPE.SHORT: return this.readShort()
      case JCE_TYPE.INT: return this.readInt()
      case JCE_TYPE.LONG: return this.readLong()
      case JCE_TYPE.FLOAT: return this.readFloat()
      case JCE_TYPE.DOUBLE: return this.readDouble()
      case JCE_TYPE.STRING1: return this.readString1()
      case JCE_TYPE.STRING4: return this.readString4()
      case JCE_TYPE.MAP: return this.readMap(depth)
      case JCE_TYPE.LIST: return this.readList(depth)
      case JCE_TYPE.STRUCT_BEGIN: return this.readStruct(depth)
      case JCE_TYPE.ZERO: return 0
      case JCE_TYPE.SIMPLE_LIST: return this.readSimpleList()
      default: throw new Error("Unknown JCE type: " + type)
    }
  }

  parse(): Record<string, any> {
    const result: Record<string, any> = {}
    while (this.offset < this.data.length) {
      const head = this.readHead()
      if (!head) break
      if (head.type === JCE_TYPE.STRUCT_END) break
      result[String(head.tag)] =
        head.type === JCE_TYPE.ZERO ? 0 : this.readValueByType(head.type, 0)
    }
    return result
  }

  parseDetailed(): JceField[] {
    const fields: JceField[] = []
    while (this.offset < this.data.length) {
      const head = this.readHead()
      if (!head) break
      if (head.type === JCE_TYPE.STRUCT_END) break
      const value = head.type === JCE_TYPE.ZERO ? 0 : this.readValueByType(head.type, 0)
      fields.push({
        tag: head.tag,
        type: head.type,
        typeName: JCE_TYPE_NAMES[head.type] || `Unknown(${head.type})`,
        value,
      })
    }
    return fields
  }
}

// ==================== JCE Encoder ====================

class JceEncoder {
  private buf: number[] = []

  private writeHead(tag: number, type: number) {
    if (tag < 15) {
      this.buf.push((tag << 4) | type)
    } else {
      this.buf.push(0xf0 | type)
      this.buf.push(tag & 0xff)
    }
  }

  private writeByte(v: number) {
    this.buf.push(v & 0xff)
  }

  private writeShort(v: number) {
    if (v < 0) v += 0x10000
    this.buf.push((v >> 8) & 0xff, v & 0xff)
  }

  private writeInt(v: number) {
    this.buf.push((v >>> 24) & 0xff, (v >>> 16) & 0xff, (v >>> 8) & 0xff, v & 0xff)
  }

  private writeLong(v: bigint) {
    for (let i = 7; i >= 0; i--) this.buf.push(Number((v >> BigInt(i * 8)) & BigInt(0xff)))
  }

  private writeFloat(v: number) {
    const ab = new ArrayBuffer(4)
    new DataView(ab).setFloat32(0, v, false)
    for (const b of new Uint8Array(ab)) this.buf.push(b)
  }

  private writeDouble(v: number) {
    const ab = new ArrayBuffer(8)
    new DataView(ab).setFloat64(0, v, false)
    for (const b of new Uint8Array(ab)) this.buf.push(b)
  }

  private writeString(tag: number, value: string) {
    const bytes = new TextEncoder().encode(value)
    if (bytes.length <= 255) {
      this.writeHead(tag, JCE_TYPE.STRING1)
      this.writeByte(bytes.length)
    } else {
      this.writeHead(tag, JCE_TYPE.STRING4)
      this.writeInt(bytes.length)
    }
    for (const b of bytes) this.buf.push(b)
  }

  private writeNumber(tag: number, value: number) {
    if (value === 0) {
      this.writeHead(tag, JCE_TYPE.ZERO)
    } else if (Number.isInteger(value) && value >= -128 && value <= 127) {
      this.writeHead(tag, JCE_TYPE.BYTE)
      this.writeByte(value < 0 ? value + 256 : value)
    } else if (Number.isInteger(value) && value >= -32768 && value <= 32767) {
      this.writeHead(tag, JCE_TYPE.SHORT)
      this.writeShort(value)
    } else if (Number.isInteger(value) && value >= -2147483648 && value <= 2147483647) {
      this.writeHead(tag, JCE_TYPE.INT)
      this.writeInt(value)
    } else if (Number.isInteger(value)) {
      this.writeHead(tag, JCE_TYPE.LONG)
      this.writeLong(BigInt(value))
    } else {
      this.writeHead(tag, JCE_TYPE.DOUBLE)
      this.writeDouble(value)
    }
  }

  private writeMap(tag: number, map: Record<string, any>) {
    this.writeHead(tag, JCE_TYPE.MAP)
    const entries = Object.entries(map)
    this.writeNumber(0, entries.length)
    for (const [key, value] of entries) {
      this.writeString(0, key)
      this.writeValue(1, value)
    }
  }

  private writeList(tag: number, list: any[]) {
    this.writeHead(tag, JCE_TYPE.LIST)
    this.writeNumber(0, list.length)
    for (const item of list) this.writeValue(0, item)
  }

  private writeStruct(tag: number, struct: Record<string, any>) {
    this.writeHead(tag, JCE_TYPE.STRUCT_BEGIN)
    for (const [key, value] of Object.entries(struct)) {
      const fieldTag = parseInt(key)
      if (isNaN(fieldTag)) continue
      this.writeValue(fieldTag, value)
    }
    this.writeHead(0, JCE_TYPE.STRUCT_END)
  }

  writeValue(tag: number, value: any) {
    if (value === null || value === undefined) return
    if (typeof value === "number") {
      this.writeNumber(tag, value)
    } else if (typeof value === "string") {
      this.writeString(tag, value)
    } else if (typeof value === "boolean") {
      this.writeNumber(tag, value ? 1 : 0)
    } else if (Array.isArray(value)) {
      this.writeList(tag, value)
    } else if (typeof value === "object") {
      const keys = Object.keys(value)
      const allNumeric = keys.length > 0 && keys.every((k) => /^\d+$/.test(k))
      if (allNumeric) {
        this.writeStruct(tag, value)
      } else {
        this.writeMap(tag, value)
      }
    }
  }

  encode(data: Record<string, any>): Uint8Array {
    this.buf = []
    for (const [key, value] of Object.entries(data)) {
      const tag = parseInt(key)
      if (isNaN(tag)) continue
      this.writeValue(tag, value)
    }
    return new Uint8Array(this.buf)
  }
}

// ==================== Helpers ====================

function detectInputFormat(input: string): "hex" | "base64" | "unknown" {
  const clean = input.replace(/\s/g, "")
  if (/^[0-9a-fA-F]+$/.test(clean) && clean.length % 2 === 0 && clean.length > 0) return "hex"
  if (/^[A-Za-z0-9+/]*={0,2}$/.test(clean) && clean.length > 0) return "base64"
  return "unknown"
}

function inputToBuffer(input: string): Uint8Array {
  const format = detectInputFormat(input)
  const clean = input.replace(/\s/g, "")
  if (format === "hex") {
    return new Uint8Array(clean.match(/.{1,2}/g)!.map((b) => parseInt(b, 16)))
  }
  if (format === "base64") {
    const binary = atob(clean)
    const buffer = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) buffer[i] = binary.charCodeAt(i)
    return buffer
  }
  throw new Error("无法识别的输入格式，请输入 Hex 或 Base64 编码的数据")
}

function formatDetailedOutput(fields: JceField[], indent = 0): string {
  const pad = "  ".repeat(indent)
  return fields
    .map((f) => {
      const valStr =
        typeof f.value === "object" && f.value !== null
          ? JSON.stringify(f.value, null, 2)
              .split("\n")
              .map((l, i) => (i === 0 ? l : pad + "  " + l))
              .join("\n")
          : JSON.stringify(f.value)
      return `${pad}[Tag ${f.tag}] ${f.typeName}: ${valStr}`
    })
    .join("\n")
}

const EXAMPLE_HEX = "0001160568656c6c6f213039320001869f"

// ==================== Component ====================

interface JceToolProps {
  params?: Record<string, string>
}

export default function JceTool({ params }: JceToolProps) {
  const t = useTranslations("jce")

  const [showSettings, setShowSettings] = useState(false)
  const [autoFormat, setAutoFormat] = useState(true)
  const [showTypeInfo, setShowTypeInfo] = useState(false)

  const [mode, setMode] = useState<"decode" | "encode">("decode")
  const [inputData, setInputData] = useState("")
  const [jsonInput, setJsonInput] = useState("")
  const [outputData, setOutputData] = useState("")
  const [detailedOutput, setDetailedOutput] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState<Record<string, boolean>>({})
  const [indentSize, setIndentSize] = useState(2)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const copyToClipboard = useCallback((text: string, key = "main") => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied((p) => ({ ...p, [key]: true }))
      setTimeout(() => setCopied((p) => ({ ...p, [key]: false })), 2000)
    })
  }, [])

  const downloadOutput = useCallback(() => {
    if (!outputData) return
    const blob = new Blob([outputData], {
      type: mode === "decode" ? "application/json" : "application/octet-stream",
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = mode === "decode" ? "jce-decoded.json" : "jce-encoded.hex"
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [outputData, mode])

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0]
      if (!f) return
      if (f.size > 10 * 1024 * 1024) {
        setError(t("fileTooBig"))
        return
      }
      setFile(f)
      setError(null)
      const reader = new FileReader()
      reader.onload = (ev) => {
        if (ev.target?.result) {
          const hex = Array.from(new Uint8Array(ev.target.result as ArrayBuffer))
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("")
          setInputData(hex)
        }
      }
      reader.readAsArrayBuffer(f)
    },
    [t],
  )

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      e.stopPropagation()
      const f = e.dataTransfer.files?.[0]
      if (!f) return
      if (f.size > 10 * 1024 * 1024) {
        setError(t("fileTooBig"))
        return
      }
      setFile(f)
      setError(null)
      const reader = new FileReader()
      reader.onload = (ev) => {
        if (ev.target?.result) {
          const hex = Array.from(new Uint8Array(ev.target.result as ArrayBuffer))
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("")
          setInputData(hex)
        }
      }
      reader.readAsArrayBuffer(f)
    },
    [t],
  )

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const removeFile = useCallback(() => {
    setFile(null)
    setInputData("")
    if (fileInputRef.current) fileInputRef.current.value = ""
  }, [])

  const parseJce = useCallback(() => {
    const src = mode === "decode" ? inputData : jsonInput
    if (!src) {
      setError(t("noInput"))
      return
    }
    setIsProcessing(true)
    setError(null)

    try {
      if (mode === "decode") {
        const buffer = inputToBuffer(inputData)
        const p1 = new JceParser(buffer)
        setOutputData(JSON.stringify(p1.parse(), null, indentSize))
        const p2 = new JceParser(buffer)
        setDetailedOutput(formatDetailedOutput(p2.parseDetailed()))
      } else {
        const obj = JSON.parse(jsonInput)
        const encoder = new JceEncoder()
        const encoded = encoder.encode(obj)
        setOutputData(
          Array.from(encoded)
            .map((b) => b.toString(16).padStart(2, "0"))
            .join(""),
        )
        setDetailedOutput("")
      }
    } catch (err: any) {
      setError(err.message || t("parseError"))
    } finally {
      setIsProcessing(false)
    }
  }, [inputData, jsonInput, mode, indentSize, t])

  const clearAll = useCallback(() => {
    setInputData("")
    setJsonInput("")
    setOutputData("")
    setDetailedOutput("")
    setFile(null)
    setError(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }, [])

  const loadExample = useCallback(() => {
    setInputData(EXAMPLE_HEX)
  }, [])

  useEffect(() => {
    if (!autoFormat) return
    const src = mode === "decode" ? inputData : jsonInput
    if (src && src.length < 10000) {
      parseJce()
    } else if (!src) {
      setOutputData("")
      setDetailedOutput("")
    }
  }, [inputData, jsonInput, mode, autoFormat, parseJce])

  return (
    <div className="container mx-auto px-4 py-4 max-w-7xl">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-200 mb-4 flex items-center justify-center gap-2">
          <Database className="h-8 w-8 text-teal-600" />
          {t("title")}
        </h1>
      </div>

      {/* Settings */}
      <div className="mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowSettings(!showSettings)}
          className="w-full text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
        >
          <div className="flex items-center gap-2">
            {showSettings ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            <Settings className="h-4 w-4" />
            <span>{t("settings")}</span>
            {!showSettings && (
              <Badge variant="secondary" className="text-xs ml-auto">
                {t("clickToView")}
              </Badge>
            )}
          </div>
        </Button>

        {showSettings && (
          <Card className="mt-3 card-modern">
            <CardContent className="py-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center space-x-2 bg-gray-100 dark:bg-gray-800 p-3 rounded-lg">
                  <Label htmlFor="jce-auto-format" className="cursor-pointer text-sm">
                    {t("manualFormat")}
                  </Label>
                  <Switch id="jce-auto-format" checked={autoFormat} onCheckedChange={setAutoFormat} />
                  <Label htmlFor="jce-auto-format" className="cursor-pointer text-sm text-blue-600">
                    {t("autoFormat")}
                  </Label>
                </div>
                <div className="flex items-center space-x-2 bg-gray-100 dark:bg-gray-800 p-3 rounded-lg">
                  <Label htmlFor="jce-show-type" className="cursor-pointer text-sm">
                    {t("hideTypeInfo")}
                  </Label>
                  <Switch id="jce-show-type" checked={showTypeInfo} onCheckedChange={setShowTypeInfo} />
                  <Label htmlFor="jce-show-type" className="cursor-pointer text-sm text-green-600">
                    {t("showTypeInfo")}
                  </Label>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Mode Tabs */}
      <Tabs
        defaultValue="decode"
        className="w-full"
        onValueChange={(v) => setMode(v as "decode" | "encode")}
      >
        <div className="mb-6">
          <TabsList className="grid w-full grid-cols-2 h-14 p-2 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
            <TabsTrigger
              value="decode"
              className="flex items-center justify-center gap-2 py-3 px-4 rounded-lg data-[state=active]:bg-teal-100 dark:data-[state=active]:bg-teal-900 data-[state=active]:text-teal-700 dark:data-[state=active]:text-teal-300 transition-all duration-200"
            >
              <Code className="h-5 w-5" />
              <span className="text-sm font-medium">{t("decode")}</span>
            </TabsTrigger>
            <TabsTrigger
              value="encode"
              className="flex items-center justify-center gap-2 py-3 px-4 rounded-lg data-[state=active]:bg-blue-100 dark:data-[state=active]:bg-blue-900 data-[state=active]:text-blue-700 dark:data-[state=active]:text-blue-300 transition-all duration-200"
            >
              <Database className="h-5 w-5" />
              <span className="text-sm font-medium">{t("encode")}</span>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ===== Decode ===== */}
        <TabsContent value="decode" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Input */}
            <Card className="card-modern">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Upload className="h-5 w-5 text-teal-600" />
                  {t("jceInput")}
                  {autoFormat && (
                    <Badge variant="secondary" className="text-xs">
                      <Zap className="h-3 w-3 mr-1" />
                      {t("autoLabel")}
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="text" className="w-full">
                  <TabsList className="grid w-full grid-cols-2 mb-4">
                    <TabsTrigger value="text" className="flex items-center gap-2">
                      <Code className="h-4 w-4" />
                      {t("textInput")}
                    </TabsTrigger>
                    <TabsTrigger value="file" className="flex items-center gap-2">
                      <FileUp className="h-4 w-4" />
                      {t("fileUpload")}
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="text" className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="jce-input-data">{t("input")}</Label>
                      <Textarea
                        id="jce-input-data"
                        placeholder={t("inputPlaceholder")}
                        className="font-mono h-[300px]"
                        value={inputData}
                        onChange={(e) => setInputData(e.target.value)}
                      />
                    </div>
                  </TabsContent>

                  <TabsContent value="file" className="space-y-4">
                    <div
                      className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
                      onDrop={handleDrop}
                      onDragOver={handleDragOver}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {file ? (
                        <div className="space-y-2">
                          <div className="flex items-center justify-center space-x-2">
                            <FileUp className="h-8 w-8 text-muted-foreground" />
                            <span className="font-medium">{file.name}</span>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {(file.size / 1024).toFixed(2)} KB
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              removeFile()
                            }}
                          >
                            <X className="h-4 w-4 mr-2" />
                            {t("removeFile")}
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <FileUp className="h-8 w-8 text-muted-foreground mx-auto" />
                          <div className="text-sm text-muted-foreground">{t("dropFileHere")}</div>
                        </div>
                      )}
                      <input
                        ref={fileInputRef}
                        type="file"
                        className="hidden"
                        onChange={handleFileChange}
                        accept="*/*"
                      />
                    </div>
                  </TabsContent>
                </Tabs>

                {error && <div className="mt-2 text-sm text-red-500">{error}</div>}

                <div className="flex justify-between mt-4">
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={clearAll}>
                      {t("clearInput")}
                    </Button>
                    <Button variant="outline" onClick={loadExample}>
                      <BookOpen className="mr-2 h-4 w-4" />
                      {t("loadExample")}
                    </Button>
                  </div>
                  <Button onClick={parseJce} disabled={isProcessing || !inputData}>
                    {isProcessing ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {t("parsing")}
                      </>
                    ) : (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        {t("parse")}
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Output */}
            <Card className="card-modern">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="h-5 w-5 text-green-600" />
                  {showTypeInfo ? t("detailedOutput") : t("jsonOutput")}
                  <div className="flex space-x-2 ml-auto">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        copyToClipboard(showTypeInfo ? detailedOutput : outputData)
                      }
                      disabled={!outputData}
                    >
                      {copied.main ? (
                        <Check className="h-4 w-4 mr-2 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4 mr-2" />
                      )}
                      {copied.main ? t("copied") : t("copy")}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={downloadOutput}
                      disabled={!outputData}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      {t("download")}
                    </Button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  className="font-mono h-[400px] bg-gray-50 dark:bg-gray-900"
                  value={showTypeInfo ? detailedOutput : outputData}
                  readOnly
                  placeholder={t("outputPlaceholder")}
                />

                <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg space-y-4">
                  <Label className="text-sm font-medium">{t("outputOptions")}</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="jce-show-type-check"
                        checked={showTypeInfo}
                        onCheckedChange={(c) => setShowTypeInfo(!!c)}
                      />
                      <Label htmlFor="jce-show-type-check" className="cursor-pointer text-sm">
                        {t("showTypeInfoLabel")}
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Label htmlFor="jce-indent" className="text-sm">
                        {t("indentSize")}:
                      </Label>
                      <Input
                        id="jce-indent"
                        type="number"
                        min="0"
                        max="8"
                        value={indentSize}
                        onChange={(e) => setIndentSize(parseInt(e.target.value) || 0)}
                        className="w-16 h-8"
                      />
                    </div>
                  </div>
                  {outputData && (
                    <div className="text-xs text-gray-600 dark:text-gray-400 pt-2 border-t">
                      {t("outputLength")}: {outputData.length} {t("characters")}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ===== Encode ===== */}
        <TabsContent value="encode" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* JSON Input */}
            <Card className="card-modern">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Code className="h-5 w-5 text-blue-600" />
                  {t("jsonInputTitle")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="jce-json-input" className="text-sm font-medium">
                      {t("jsonData")}
                    </Label>
                    <Textarea
                      id="jce-json-input"
                      placeholder={t("jsonInputPlaceholder")}
                      className="font-mono h-[400px] bg-gray-50 dark:bg-gray-900"
                      value={jsonInput}
                      onChange={(e) => setJsonInput(e.target.value)}
                    />
                  </div>

                  {error && (
                    <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                      <div className="text-sm text-red-600 dark:text-red-400">{error}</div>
                    </div>
                  )}

                  <div className="flex justify-between items-center pt-2">
                    <Button variant="outline" onClick={clearAll} size="sm">
                      <X className="mr-2 h-4 w-4" />
                      {t("clearInput")}
                    </Button>
                    <Button
                      onClick={parseJce}
                      disabled={isProcessing || !jsonInput}
                      size="lg"
                      className="px-6"
                    >
                      {isProcessing ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          {t("encoding")}
                        </>
                      ) : (
                        <>
                          <Database className="mr-2 h-4 w-4" />
                          {t("encodeToJce")}
                        </>
                      )}
                    </Button>
                  </div>

                  {jsonInput && (
                    <div className="text-xs text-gray-600 dark:text-gray-400 pt-2 border-t">
                      {t("inputLength")}: {jsonInput.length} {t("characters")}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* JCE Output */}
            <Card className="card-modern">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Database className="h-5 w-5 text-teal-600" />
                  {t("jceOutput")}
                  <div className="flex space-x-2 ml-auto">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(outputData)}
                      disabled={!outputData}
                    >
                      {copied.main ? (
                        <Check className="h-4 w-4 mr-2 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4 mr-2" />
                      )}
                      {copied.main ? t("copied") : t("copy")}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={downloadOutput}
                      disabled={!outputData}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      {t("download")}
                    </Button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  className="font-mono h-[400px] bg-gray-50 dark:bg-gray-900"
                  value={outputData}
                  readOnly
                  placeholder={t("encodeOutputPlaceholder")}
                />
                <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {t("encodeHelp")}
                  </div>
                  {outputData && (
                    <div className="text-xs text-gray-600 dark:text-gray-400 mt-2 pt-2 border-t">
                      {t("outputLength")}: {outputData.length} {t("characters")} (Hex)
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Type Reference */}
      <Card className="mt-6 card-modern">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Eye className="h-5 w-5 text-gray-600" />
            {t("typeReference")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
            {Object.entries(JCE_TYPE_NAMES)
              .filter(([k]) => parseInt(k) !== JCE_TYPE.STRUCT_END)
              .map(([type, name]) => (
                <div
                  key={type}
                  className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-800 rounded-lg"
                >
                  <Badge variant="secondary" className="text-xs font-mono">
                    {type}
                  </Badge>
                  <span className="text-xs text-gray-600 dark:text-gray-400">{name}</span>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
