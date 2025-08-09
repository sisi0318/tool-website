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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { useTranslations } from "@/hooks/use-translations"
import { Loader2, Copy, FileUp, X, Download, RefreshCw, ArrowLeftRight, Upload, Settings, ChevronUp, ChevronDown, Zap, Eye, Code, FileText, Database, Shield, Check } from "lucide-react"
import * as protobuf from "protobufjs"

interface ProtobufToolProps {
  params?: Record<string, string>
}

export default function ProtobufTool({ params }: ProtobufToolProps) {
  const t = useTranslations("protobuf")
  
  // 设置状态
  const [showProtobufSettings, setShowProtobufSettings] = useState(false)
  const [autoFormat, setAutoFormat] = useState(true)
  const [realTimeValidation, setRealTimeValidation] = useState(true)
  const [enableCompression, setEnableCompression] = useState(false)
  const [strictMode, setStrictMode] = useState(false)
  
  // 原有状态
  const [mode, setMode] = useState<"decode" | "encode">("decode")
  const [schemaMode, setSchemaMode] = useState<"schemaless" | "schema">("schemaless")
  const [protoInputMode, setProtoInputMode] = useState<"text" | "file">("text")
  const [inputMode, setInputMode] = useState<"text" | "file">("text")
  const [inputData, setInputData] = useState("")
  const [outputData, setOutputData] = useState("")
  const [jsonInput, setJsonInput] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [protoFile, setProtoFile] = useState<File | null>(null)
  const [protoContent, setProtoContent] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState<{ [key: string]: boolean }>({})
  const [indentSize, setIndentSize] = useState(2)
  const [showFieldIds, setShowFieldIds] = useState(true)
  const [root, setRoot] = useState<protobuf.Root | null>(null)
  const [messageTypes, setMessageTypes] = useState<string[]>([])
  const [selectedMessageType, setSelectedMessageType] = useState<string>("")
  const fileInputRef = useRef<HTMLInputElement>(null)
  const protoFileInputRef = useRef<HTMLInputElement>(null)

  // Detect input format (base64 or hex)
  const detectInputFormat = (input: string): "base64" | "hex" | "unknown" => {
    // Remove whitespace
    const cleanInput = input.replace(/\s/g, "")

    // Check if it's hex (only contains hex characters)
    if (/^[0-9a-fA-F]+$/.test(cleanInput)) {
      return "hex"
    }

    // Check if it's base64 (contains only base64 characters and has valid padding)
    if (/^[A-Za-z0-9+/]*={0,2}$/.test(cleanInput)) {
      return "base64"
    }

    return "unknown"
  }

  // Convert input to buffer based on detected format
  const inputToBuffer = (input: string): Uint8Array => {
    const format = detectInputFormat(input)
    const cleanInput = input.replace(/\s/g, "")

    if (format === "hex") {
      return new Uint8Array(cleanInput.match(/.{1,2}/g)!.map((byte) => Number.parseInt(byte, 16)))
    } else if (format === "base64") {
      try {
        const binary = atob(cleanInput)
        const buffer = new Uint8Array(binary.length)
        for (let i = 0; i < binary.length; i++) {
          buffer[i] = binary.charCodeAt(i)
        }
        return buffer
      } catch (e) {
        throw new Error("Invalid base64 input")
      }
    } else {
      throw new Error("Unknown input format")
    }
  }

  // Handle file upload
  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFile = e.target.files?.[0]
      if (!selectedFile) return

      // Check file size (10MB limit)
      if (selectedFile.size > 10 * 1024 * 1024) {
        setError(t("fileTooBig"))
        return
      }

      setFile(selectedFile)
      setError(null)

      // Read file content
      const reader = new FileReader()
      reader.onload = async (event) => {
        if (event.target?.result) {
          const buffer = event.target.result as ArrayBuffer
          setInputData(Buffer.from(buffer).toString("hex"))
        }
      }
      reader.readAsArrayBuffer(selectedFile)
    },
    [t],
  )

  // Handle proto file upload
  const handleProtoFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFile = e.target.files?.[0]
      if (!selectedFile) return

      // Check file size (1MB limit)
      if (selectedFile.size > 1 * 1024 * 1024) {
        setError(t("protoFileTooBig"))
        return
      }

      setProtoFile(selectedFile)
      setError(null)

      // Read file content
      const reader = new FileReader()
      reader.onload = async (event) => {
        if (event.target?.result) {
          const content = event.target.result as string
          setProtoContent(content)

          try {
            // Parse the proto file
            const parsedRoot = protobuf.parse(content, { keepCase: true }).root

            // Set the root directly since it's already parsed
            setRoot(parsedRoot)

            // Get all message types
            const types: string[] = []
            parsedRoot.nestedArray.forEach((obj) => {
              if (obj instanceof protobuf.Type) {
                types.push(obj.fullName)
              }
            })
            setMessageTypes(types)

            if (types.length > 0) {
              setSelectedMessageType(types[0])
            }
          } catch (err) {
            console.error("Proto parsing error:", err)
            setError(t("protoParseError"))
          }
        }
      }
      reader.readAsText(selectedFile)
    },
    [t],
  )

  // Handle drag and drop
  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      e.stopPropagation()

      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        const droppedFile = e.dataTransfer.files[0]

        // Check file size (10MB limit)
        if (droppedFile.size > 10 * 1024 * 1024) {
          setError(t("fileTooBig"))
          return
        }

        setFile(droppedFile)
        setError(null)

        // Read file content
        const reader = new FileReader()
        reader.onload = async (event) => {
          if (event.target?.result) {
            const buffer = event.target.result as ArrayBuffer
            setInputData(Buffer.from(buffer).toString("hex"))
          }
        }
        reader.readAsArrayBuffer(droppedFile)
      }
    },
    [t],
  )

  // Handle proto file drag and drop
  const handleProtoDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      e.stopPropagation()

      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        const droppedFile = e.dataTransfer.files[0]

        // Check file size (1MB limit)
        if (droppedFile.size > 1 * 1024 * 1024) {
          setError(t("protoFileTooBig"))
          return
        }

        setProtoFile(droppedFile)
        setError(null)

        // Read file content
        const reader = new FileReader()
        reader.onload = async (event) => {
          if (event.target?.result) {
            const content = event.target.result as string
            setProtoContent(content)

            try {
              // Parse the proto file
              const parsedRoot = protobuf.parse(content, { keepCase: true }).root

              // Set the root directly since it's already parsed
              setRoot(parsedRoot)

              // Get all message types
              const types: string[] = []
              parsedRoot.nestedArray.forEach((obj) => {
                if (obj instanceof protobuf.Type) {
                  types.push(obj.fullName)
                }
              })
              setMessageTypes(types)

              if (types.length > 0) {
                setSelectedMessageType(types[0])
              }
            } catch (err) {
              console.error("Proto parsing error:", err)
              setError(t("protoParseError"))
            }
          }
        }
        reader.readAsText(droppedFile)
      }
    },
    [t],
  )

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  // Remove file
  const removeFile = useCallback(() => {
    setFile(null)
    setInputData("")
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }, [])

  // Remove proto file
  const removeProtoFile = useCallback(() => {
    setProtoFile(null)
    setProtoContent("")
    setRoot(null)
    setMessageTypes([])
    setSelectedMessageType("")
    if (protoFileInputRef.current) {
      protoFileInputRef.current.value = ""
    }
  }, [])

  // Copy output to clipboard
  const copyToClipboard = useCallback((text: string, key: string = "main") => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(prev => ({ ...prev, [key]: true }))
      setTimeout(() => setCopied(prev => ({ ...prev, [key]: false })), 2000)
    })
  }, [])

  // Download output as JSON file
  const downloadOutput = useCallback(() => {
    if (!outputData) return

    const blob = new Blob([outputData], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = mode === "decode" ? "protobuf-decoded.json" : "protobuf-encoded.hex"
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [outputData, mode])

  // Encode JSON to Protobuf
  const encodeJsonToProtobuf = useCallback((jsonStr: string) => {
    try {
      const jsonObj = JSON.parse(jsonStr)

      // Create a writer
      const writer = new protobuf.Writer()

      // Helper function to encode a value with a tag
      const encodeValue = (tag: number, value: any, writer: protobuf.Writer) => {
        if (value === null || value === undefined) return

        // Determine wire type
        let wireType = 2 // Default to length-delimited (string, bytes, embedded message)

        if (typeof value === "number") {
          if (Number.isInteger(value)) {
            wireType = 0 // Varint
          } else {
            wireType = 1 // 64-bit
          }
        } else if (typeof value === "boolean") {
          wireType = 0 // Varint
          value = value ? 1 : 0
        } else if (typeof value === "string") {
          // Keep as string, wireType 2
        } else if (typeof value === "object") {
          // Recursively encode objects
          const nestedWriter = new protobuf.Writer()
          encodeObject(value, nestedWriter)
          value = nestedWriter.finish()
        }

        // Write field header (tag << 3 | wire_type)
        writer.uint32((tag << 3) | wireType)

        // Write value based on wire type
        switch (wireType) {
          case 0: // Varint
            writer.int64(value)
            break
          case 1: // 64-bit
            writer.double(value)
            break
          case 2: // Length-delimited
            if (typeof value === "string") {
              writer.string(value)
            } else {
              writer.bytes(value)
            }
            break
        }
      }

      // Recursively encode an object
      const encodeObject = (obj: any, writer: protobuf.Writer) => {
        for (const key in obj) {
          if (Object.prototype.hasOwnProperty.call(obj, key)) {
            const tag = Number.parseInt(key)
            if (isNaN(tag)) continue // Skip non-numeric keys

            const value = obj[key]

            if (Array.isArray(value)) {
              // Handle repeated fields
              for (const item of value) {
                encodeValue(tag, item, writer)
              }
            } else {
              encodeValue(tag, value, writer)
            }
          }
        }
      }

      // Encode the root object
      encodeObject(jsonObj, writer)

      // Get the final buffer
      const buffer = writer.finish()

      // Convert to hex string
      return Array.from(buffer)
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("")
    } catch (err) {
      console.error("JSON to Protobuf encoding error:", err)
      throw err
    }
  }, [])

  // Encode JSON to Protobuf using schema
  const encodeJsonToProtobufWithSchema = useCallback(
    (jsonStr: string, messageType: string) => {
      try {
        if (!root) {
          throw new Error("No proto schema loaded")
        }

        const jsonObj = JSON.parse(jsonStr)
        const Message = root.lookupType(messageType)

        // Verify the object
        const errMsg = Message.verify(jsonObj)
        if (errMsg) {
          throw new Error(`Invalid message object: ${errMsg}`)
        }

        // Create a message instance
        const message = Message.create(jsonObj)

        // Encode the message
        const buffer = Message.encode(message).finish()

        // Convert to hex string
        return Array.from(buffer)
          .map((byte) => byte.toString(16).padStart(2, "0"))
          .join("")
      } catch (err) {
        console.error("Schema-based JSON to Protobuf encoding error:", err)
        throw err
      }
    },
    [root],
  )

  // Parse Protobuf data
  const parseProtobuf = useCallback(async () => {
    if (!inputData) {
      setError(t("noInput"))
      return
    }

    setIsProcessing(true)
    setError(null)

    try {
      if (mode === "decode") {
        // Convert input to buffer
        const buffer = inputToBuffer(inputData)

        let decoded
        if (schemaMode === "schema" && root && selectedMessageType) {
          // Parse using schema
          const Message = root.lookupType(selectedMessageType)
          decoded = Message.decode(buffer).toJSON()
        } else {
          // Parse without schema
          decoded = decodeProtobuf(buffer)
        }

        // Format the output
        const result = JSON.stringify(decoded, null, indentSize)
        setOutputData(result)
      } else {
        // Encode JSON to Protobuf
        let encoded
        if (schemaMode === "schema" && root && selectedMessageType) {
          // Encode using schema
          encoded = encodeJsonToProtobufWithSchema(jsonInput, selectedMessageType)
        } else {
          // Encode without schema
          encoded = encodeJsonToProtobuf(jsonInput)
        }
        setOutputData(encoded)
      }
    } catch (err) {
      console.error("Protobuf processing error:", err)
      setError(t(mode === "decode" ? "parseError" : "encodeError"))
    } finally {
      setIsProcessing(false)
    }
  }, [
    inputData,
    jsonInput,
    mode,
    schemaMode,
    root,
    selectedMessageType,
    indentSize,
    t,
    encodeJsonToProtobuf,
    encodeJsonToProtobufWithSchema,
  ])

  // Decode Protobuf without schema
  const decodeProtobuf = (buffer: Uint8Array): any => {
    // This function implements a simple Protobuf decoder that doesn't require schema
    // It tries to identify fields and their types based on wire format
    const reader = protobuf.Reader.create(buffer)
    const result: Record<string, any> = {}

    while (reader.pos < reader.len) {
      const tag = reader.uint32()
      const fieldNumber = tag >>> 3
      const wireType = tag & 7

      let value: any

      // Decode based on wire type
      switch (wireType) {
        case 0: // Varint
          value = reader.uint64()
          break
        case 1: // Fixed64
          value = reader.fixed64()
          break
        case 2: // Length-delimited (string, bytes, embedded message, packed repeated)
          const bytes = reader.bytes()

          // Try to decode as string
          try {
            const str = new TextDecoder().decode(bytes)
            if (/^[\x20-\x7E\s]*$/.test(str)) {
              // Printable ASCII string
              value = str
            } else {
              // Try to decode as nested message
              try {
                value = decodeProtobuf(bytes)
              } catch (e) {
                // Store as base64 if can't be decoded further
                value = Buffer.from(bytes).toString("base64")
              }
            }
          } catch (e) {
            // Store as base64 if not a valid UTF-8 string
            value = Buffer.from(bytes).toString("base64")
          }
          break
        case 5: // Fixed32
          value = reader.fixed32()
          break
        default:
          // Skip unknown wire types
          reader.skipType(wireType)
          continue
      }

      // Store in result
      if (result[fieldNumber] !== undefined) {
        // Handle repeated fields
        if (!Array.isArray(result[fieldNumber])) {
          result[fieldNumber] = [result[fieldNumber]]
        }
        result[fieldNumber].push(value)
      } else {
        result[fieldNumber] = value
      }
    }

    return result
  }

  // Format Protobuf output
  const formatProtobufOutput = (decoded: any, showFieldIds: boolean, indent: number): string => {
    // Helper function to process each field
    const processField = (field: any, path: string[] = []): any => {
      if (field === null || field === undefined) {
        return null
      }

      if (Array.isArray(field)) {
        return field.map((item) => processField(item, path))
      }

      if (typeof field === "object") {
        const result: Record<string, any> = {}

        for (const [key, value] of Object.entries(field)) {
          const newPath = [...path, key]
          const fieldId = key.match(/^(\d+)$/) ? key : null

          if (fieldId && !showFieldIds) {
            // Skip numeric keys if showFieldIds is false
            continue
          }

          result[key] = processField(value, newPath)
        }

        return result
      }

      return field
    }

    const processed = processField(decoded)
    return JSON.stringify(processed, null, indent)
  }

  // Clear input and output
  const clearAll = useCallback(() => {
    setInputData("")
    setJsonInput("")
    setOutputData("")
    setFile(null)
    setError(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }, [])

  // Process when input changes
  useEffect(() => {
    if ((mode === "decode" && inputData) || (mode === "encode" && jsonInput)) {
      // Don't auto-process for large inputs to avoid performance issues
      const inputSize = mode === "decode" ? inputData.length : jsonInput.length
      if (inputSize < 10000) {
        parseProtobuf()
      }
    } else {
      setOutputData("")
    }
  }, [inputData, jsonInput, mode, parseProtobuf])

  return (
    <div className="container mx-auto px-4 py-4 max-w-7xl">
      {/* 页面标题 */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-200 mb-4 flex items-center justify-center gap-2">
          <Database className="h-8 w-8 text-purple-600" />
          Protobuf 解析器
        </h1>
      </div>

      {/* Protobuf设置折叠区域 */}
      <div className="mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowProtobufSettings(!showProtobufSettings)}
          className="w-full text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
        >
          <div className="flex items-center gap-2">
            {showProtobufSettings ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
            <Settings className="h-4 w-4" />
            <span>Protobuf 设置</span>
            {!showProtobufSettings && (
              <Badge variant="secondary" className="text-xs ml-auto">
                点击查看
              </Badge>
            )}
          </div>
        </Button>

        {showProtobufSettings && (
          <Card className="mt-3 card-modern">
            <CardContent className="py-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="flex items-center space-x-2 bg-gray-100 dark:bg-gray-800 p-3 rounded-lg">
                  <Label htmlFor="auto-format" className="cursor-pointer text-sm">
                    手动格式化
                  </Label>
                  <Switch id="auto-format" checked={autoFormat} onCheckedChange={setAutoFormat} />
                  <Label htmlFor="auto-format" className="cursor-pointer text-sm text-blue-600">
                    自动格式化
                  </Label>
                </div>
                <div className="flex items-center space-x-2 bg-gray-100 dark:bg-gray-800 p-3 rounded-lg">
                  <Label htmlFor="real-time-validation" className="cursor-pointer text-sm">
                    延迟验证
                  </Label>
                  <Switch id="real-time-validation" checked={realTimeValidation} onCheckedChange={setRealTimeValidation} />
                  <Label htmlFor="real-time-validation" className="cursor-pointer text-sm text-green-600">
                    实时验证
                  </Label>
                </div>
                <div className="flex items-center space-x-2 bg-gray-100 dark:bg-gray-800 p-3 rounded-lg">
                  <Label htmlFor="enable-compression" className="cursor-pointer text-sm">
                    禁用压缩
                  </Label>
                  <Switch id="enable-compression" checked={enableCompression} onCheckedChange={setEnableCompression} />
                  <Label htmlFor="enable-compression" className="cursor-pointer text-sm text-purple-600">
                    启用压缩
                  </Label>
                </div>
                <div className="flex items-center space-x-2 bg-gray-100 dark:bg-gray-800 p-3 rounded-lg">
                  <Label htmlFor="strict-mode" className="cursor-pointer text-sm">
                    宽松模式
                  </Label>
                  <Switch id="strict-mode" checked={strictMode} onCheckedChange={setStrictMode} />
                  <Label htmlFor="strict-mode" className="cursor-pointer text-sm text-orange-600">
                    严格模式
                  </Label>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <Tabs defaultValue="decode" className="w-full" onValueChange={(value) => setMode(value as "decode" | "encode")}>
        <div className="mb-6">
          <TabsList className="grid w-full grid-cols-2 h-14 p-2 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
            <TabsTrigger
              value="decode"
              className="flex items-center justify-center gap-2 py-3 px-4 rounded-lg data-[state=active]:bg-purple-100 dark:data-[state=active]:bg-purple-900 data-[state=active]:text-purple-700 dark:data-[state=active]:text-purple-300 transition-all duration-200"
            >
              <Code className="h-5 w-5" />
              <span className="text-sm font-medium">解码 Protobuf</span>
            </TabsTrigger>
            <TabsTrigger
              value="encode"
              className="flex items-center justify-center gap-2 py-3 px-4 rounded-lg data-[state=active]:bg-blue-100 dark:data-[state=active]:bg-blue-900 data-[state=active]:text-blue-700 dark:data-[state=active]:text-blue-300 transition-all duration-200"
            >
              <Database className="h-5 w-5" />
              <span className="text-sm font-medium">编码 JSON</span>
            </TabsTrigger>
          </TabsList>
        </div>

        <Tabs
          defaultValue="schemaless"
          className="w-full"
          onValueChange={(value) => setSchemaMode(value as "schemaless" | "schema")}
        >
          <div className="mb-6">
            <TabsList className="grid w-full grid-cols-2 h-12 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg">
              <TabsTrigger 
                value="schemaless" 
                className="flex items-center justify-center gap-2 data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700"
              >
                <Zap className="h-4 w-4" />
                <span className="text-sm">无 Schema 模式</span>
                {autoFormat && (
                  <Badge variant="secondary" className="text-xs">
                    自动
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger 
                value="schema" 
                className="flex items-center justify-center gap-2 data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700"
              >
                <Shield className="h-4 w-4" />
                <span className="text-sm">Schema 模式</span>
                {strictMode && (
                  <Badge variant="secondary" className="text-xs">
                    严格
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>
          </div>

          {schemaMode === "schema" && (
            <Card className="mb-6 card-modern">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="h-5 w-5 text-green-600" />
                  Schema 配置
                  {realTimeValidation && (
                    <Badge variant="secondary" className="text-xs">
                      <Eye className="h-3 w-3 mr-1" />
                      实时验证
                    </Badge>
                  )}
                  {(protoFile || protoContent) && (
                    <Button variant="outline" size="sm" onClick={removeProtoFile} className="ml-auto">
                      <X className="h-4 w-4 mr-2" />
                      移除 Schema
                    </Button>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">

                <Tabs
                  defaultValue="text"
                  className="w-full"
                  onValueChange={(value) => setProtoInputMode(value as "text" | "file")}
                >
                  <TabsList className="grid w-full grid-cols-2 mb-4">
                    <TabsTrigger value="text" className="flex items-center gap-2">
                      <Code className="h-4 w-4" />
                      文本输入
                    </TabsTrigger>
                    <TabsTrigger value="file" className="flex items-center gap-2">
                      <Upload className="h-4 w-4" />
                      文件上传
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="text" className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="proto-content">{t("protoContent")}</Label>
                      <Textarea
                        id="proto-content"
                        placeholder={t("protoContentPlaceholder")}
                        className="font-mono h-[200px]"
                        value={protoContent}
                        onChange={(e) => {
                          setProtoContent(e.target.value)
                          setProtoFile(null)

                          try {
                            // Parse the proto content
                            if (e.target.value.trim()) {
                              const parsedRoot = protobuf.parse(e.target.value, { keepCase: true }).root

                              // Set the root directly since it's already parsed
                              setRoot(parsedRoot)

                              // Get all message types
                              const types: string[] = []
                              parsedRoot.nestedArray.forEach((obj) => {
                                if (obj instanceof protobuf.Type) {
                                  types.push(obj.fullName)
                                }
                              })
                              setMessageTypes(types)

                              if (types.length > 0) {
                                setSelectedMessageType(types[0])
                              }

                              setError(null)
                            } else {
                              setRoot(null)
                              setMessageTypes([])
                              setSelectedMessageType("")
                            }
                          } catch (err) {
                            console.error("Proto parsing error:", err)
                            setError(t("protoParseError"))
                          }
                        }}
                      />
                    </div>
                  </TabsContent>

                  <TabsContent value="file" className="space-y-4">
                    {!protoFile ? (
                      <div
                        className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
                        onDrop={handleProtoDrop}
                        onDragOver={handleDragOver}
                        onClick={() => protoFileInputRef.current?.click()}
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-center">
                            <Upload className="h-8 w-8 text-muted-foreground" />
                          </div>
                          <div className="text-sm text-muted-foreground">{t("dropProtoFileHere")}</div>
                        </div>
                        <input
                          ref={protoFileInputRef}
                          type="file"
                          className="hidden"
                          onChange={handleProtoFileChange}
                          accept=".proto"
                        />
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="flex items-center space-x-2">
                          <FileUp className="h-5 w-5 text-muted-foreground" />
                          <span className="font-medium">{protoFile.name}</span>
                          <span className="text-sm text-muted-foreground">
                            ({(protoFile.size / 1024).toFixed(2)} KB)
                          </span>
                        </div>
                      </div>
                    )}
                  </TabsContent>
                </Tabs>

                {messageTypes.length > 0 && (
                  <div className="space-y-2">
                    <Label htmlFor="message-type" className="text-sm font-medium">消息类型</Label>
                    <Select value={selectedMessageType} onValueChange={setSelectedMessageType}>
                      <SelectTrigger id="message-type" className="w-full h-10">
                        <SelectValue placeholder="选择消息类型" />
                      </SelectTrigger>
                      <SelectContent>
                        {messageTypes.map((type) => (
                          <SelectItem key={type} value={type} className="font-mono text-sm">
                            {type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="text-xs text-gray-500 bg-gray-50 dark:bg-gray-800 p-2 rounded">
                      已找到 {messageTypes.length} 个消息类型
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </Tabs>

        <TabsContent value="decode" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Input Section */}
            <Card className="card-modern">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Upload className="h-5 w-5 text-purple-600" />
                  Protobuf 输入
                  {realTimeValidation && (
                    <Badge variant="secondary" className="text-xs">
                      <Zap className="h-3 w-3 mr-1" />
                      实时验证
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs
                  defaultValue="text"
                  className="w-full"
                  onValueChange={(value) => setInputMode(value as "text" | "file")}
                >
                  <TabsList className="grid w-full grid-cols-2 mb-4">
                    <TabsTrigger value="text" className="flex items-center gap-2">
                      <Code className="h-4 w-4" />
                      文本输入
                    </TabsTrigger>
                    <TabsTrigger value="file" className="flex items-center gap-2">
                      <FileUp className="h-4 w-4" />
                      文件上传
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="text" className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="input-data">{t("input")}</Label>
                      <Textarea
                        id="input-data"
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
                          <div className="text-sm text-muted-foreground">{(file.size / 1024).toFixed(2)} KB</div>
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
                          <div className="flex items-center justify-center">
                            <FileUp className="h-8 w-8 text-muted-foreground" />
                          </div>
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
                  <Button variant="outline" onClick={clearAll}>
                    {t("clearInput")}
                  </Button>
                  <Button
                    onClick={parseProtobuf}
                    disabled={
                      isProcessing || !inputData || (schemaMode === "schema" && (!root || !selectedMessageType))
                    }
                  >
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

            {/* Output Section */}
            <Card className="card-modern">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="h-5 w-5 text-green-600" />
                  JSON 输出
                  {autoFormat && (
                    <Badge variant="secondary" className="text-xs">
                      <RefreshCw className="h-3 w-3 mr-1" />
                      自动格式化
                    </Badge>
                  )}
                  <div className="flex space-x-2 ml-auto">
                    <Button variant="outline" size="sm" onClick={() => copyToClipboard(outputData)} disabled={!outputData}>
                      {copied.main ? (
                        <Check className="h-4 w-4 mr-2 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4 mr-2" />
                      )}
                      {copied.main ? "已复制" : "复制"}
                    </Button>
                    <Button variant="outline" size="sm" onClick={downloadOutput} disabled={!outputData}>
                      <Download className="h-4 w-4 mr-2" />
                      下载
                    </Button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <Textarea 
                    id="output-data" 
                    className="font-mono h-[400px] bg-gray-50 dark:bg-gray-900" 
                    value={outputData} 
                    readOnly 
                    placeholder="解析结果将在此显示..."
                  />
                </div>

                <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg space-y-4">
                  <Label className="text-sm font-medium">输出选项</Label>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="show-field-ids"
                        checked={showFieldIds}
                        onCheckedChange={(checked) => setShowFieldIds(!!checked)}
                      />
                      <Label htmlFor="show-field-ids" className="cursor-pointer text-sm">
                        显示字段 ID
                      </Label>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Label htmlFor="indent-size" className="text-sm">缩进空格:</Label>
                      <Input
                        id="indent-size"
                        type="number"
                        min="0"
                        max="8"
                        value={indentSize}
                        onChange={(e) => setIndentSize(Number.parseInt(e.target.value) || 0)}
                        className="w-16 h-8"
                      />
                    </div>
                  </div>
                  
                  {outputData && (
                    <div className="text-xs text-gray-600 dark:text-gray-400 pt-2 border-t">
                      输出长度: {outputData.length} 字符
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="encode" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* JSON Input Section */}
            <Card className="card-modern">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Code className="h-5 w-5 text-blue-600" />
                  JSON 输入
                  {realTimeValidation && (
                    <Badge variant="secondary" className="text-xs">
                      <Zap className="h-3 w-3 mr-1" />
                      实时验证
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="json-input" className="text-sm font-medium">JSON 数据</Label>
                    <Textarea
                      id="json-input"
                      placeholder='{"1": "Hello", "2": 123, "3": {"4": "World"}}'
                      className="font-mono h-[400px] bg-gray-50 dark:bg-gray-900"
                      value={jsonInput}
                      onChange={(e) => setJsonInput(e.target.value)}
                    />
                  </div>

                  {error && (
                    <div className="mt-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                      <div className="text-sm text-red-600 dark:text-red-400">{error}</div>
                    </div>
                  )}

                  <div className="flex justify-between items-center pt-2">
                    <Button variant="outline" onClick={clearAll} size="sm">
                      <X className="mr-2 h-4 w-4" />
                      清空输入
                    </Button>
                    <Button
                      onClick={parseProtobuf}
                      disabled={
                        isProcessing || !jsonInput || (schemaMode === "schema" && (!root || !selectedMessageType))
                      }
                      size="lg"
                      className="px-6"
                    >
                      {isProcessing ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          编码中...
                        </>
                      ) : (
                        <>
                          <Database className="mr-2 h-4 w-4" />
                          编码为 Protobuf
                        </>
                      )}
                    </Button>
                  </div>
                  
                  {jsonInput && (
                    <div className="text-xs text-gray-600 dark:text-gray-400 pt-2 border-t">
                      输入长度: {jsonInput.length} 字符
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Protobuf Output Section */}
            <Card className="card-modern">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Database className="h-5 w-5 text-purple-600" />
                  Protobuf 输出
                  {enableCompression && (
                    <Badge variant="secondary" className="text-xs">
                      <Zap className="h-3 w-3 mr-1" />
                      压缩
                    </Badge>
                  )}
                  <div className="flex space-x-2 ml-auto">
                    <Button variant="outline" size="sm" onClick={() => copyToClipboard(outputData)} disabled={!outputData}>
                      {copied.main ? (
                        <Check className="h-4 w-4 mr-2 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4 mr-2" />
                      )}
                      {copied.main ? "已复制" : "复制"}
                    </Button>
                    <Button variant="outline" size="sm" onClick={downloadOutput} disabled={!outputData}>
                      <Download className="h-4 w-4 mr-2" />
                      下载
                    </Button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <Textarea 
                    id="protobuf-output" 
                    className="font-mono h-[400px] bg-gray-50 dark:bg-gray-900" 
                    value={outputData} 
                    readOnly 
                    placeholder="编码结果将在此显示..."
                  />
                </div>

                <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {schemaMode === "schema" ? 
                      "使用 Schema 模式进行编码，确保数据类型和字段映射正确。" : 
                      "无 Schema 模式编码，字段号需要手动指定为数字键。"
                    }
                  </div>
                  {outputData && (
                    <div className="text-xs text-gray-600 dark:text-gray-400 mt-2 pt-2 border-t">
                      输出长度: {outputData.length} 字符 (Hex格式)
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

