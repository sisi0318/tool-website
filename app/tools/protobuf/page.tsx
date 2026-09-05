"use client"

import { copyTextToClipboard as writeClipboardText } from "@/lib/clipboard"

import type React from "react"

import { useState, useRef, useCallback, useEffect, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { JsonTreeView } from "@/components/json-tree-view"
import { ProtobufInspector } from "@/components/tools/protobuf-inspector"
import { SendToMenu } from "@/components/tools/send-to-menu"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { SegmentedControl, SegmentedControlItem } from "@/components/ui/segmented-control"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useTranslations } from "@/hooks/use-translations"
import { bytesToHex } from "@/lib/binary"
import { downloadBlob } from "@/lib/object-url"
import { Loader2, Copy, FileUp, X, Download, RefreshCw, Upload, Zap, Code, FileText, Database, Shield, Check } from "lucide-react"
import type * as Protobuf from "protobufjs"
import { inspectProtobuf, decodeProtobufWithSchema, encodeProtobuf, encodeProtobufWithSchema, loadProtobuf, parseProtobufInput, ProtobufError, type ProtobufInspection } from "@/lib/protobuf-tools"

function collectMessageTypes(pb: typeof Protobuf, namespace: Protobuf.NamespaceBase): string[] {
  const messageTypes: string[] = []

  namespace.nestedArray.forEach((item) => {
    if (item instanceof pb.Type) {
      messageTypes.push(item.fullName)
      messageTypes.push(...collectMessageTypes(pb, item))
    } else if (item instanceof pb.Namespace) {
      messageTypes.push(...collectMessageTypes(pb, item))
    }
  })

  return messageTypes
}

export default function ProtobufTool() {
  const t = useTranslations("protobuf")
  
  // 原有状态
  const [mode, setMode] = useState<"decode" | "encode">("decode")
  const [schemaMode, setSchemaMode] = useState<"schemaless" | "schema">("schemaless")
  const [protoInputMode, setProtoInputMode] = useState<"text" | "file">("text")
  const [inputMode, setInputMode] = useState<"text" | "file">("text")
  const [inputData, setInputData] = useState("")
  const [rawOutputData, setOutputData] = useState("")
  const [inspection, setInspection] = useState<{ data: ProtobufInspection; revision: number } | null>(null)
  const [inputEncoding, setInputEncoding] = useState<"auto" | "hex" | "base64">("auto")
  const [jsonInput, setJsonInput] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [protoFile, setProtoFile] = useState<File | null>(null)
  const [protoContent, setProtoContent] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState<{ [key: string]: boolean }>({})
  const [indentSize, setIndentSize] = useState(4)
  const outputData = useMemo(() => {
    if (mode !== "decode" || !rawOutputData) return rawOutputData
    try { return JSON.stringify(JSON.parse(rawOutputData), null, indentSize) } catch { return "" }
  }, [rawOutputData, mode, indentSize])
  const encodedBytes = useMemo(() => {
    if (mode !== "encode" || !rawOutputData) return undefined
    try { return parseProtobufInput(rawOutputData, "hex") } catch { return undefined }
  }, [rawOutputData, mode])
  const [root, setRoot] = useState<Protobuf.Root | null>(null)
  const [messageTypes, setMessageTypes] = useState<string[]>([])
  const [selectedMessageType, setSelectedMessageType] = useState<string>("")
  const fileInputRef = useRef<HTMLInputElement>(null)
  const protoFileInputRef = useRef<HTMLInputElement>(null)
  const copyResetTimerRef = useRef<number | null>(null)
  const protoParseRequestRef = useRef(0)
  const processingRequestRef = useRef(0)

  // 解析 proto 定义并刷新可选消息类型；文本与文件两条路径共用
  const applyParsedProto = useCallback(
    async (content: string) => {
      const requestId = ++protoParseRequestRef.current
      try {
        const pb = await loadProtobuf()
        const parsedRoot = pb.parse(content, { keepCase: true }).root
        if (requestId !== protoParseRequestRef.current) return

        setRoot(parsedRoot)

        const types = collectMessageTypes(pb, parsedRoot)
        setMessageTypes(types)

        if (types.length > 0) {
          setSelectedMessageType(types[0])
        }

        setError(null)
      } catch (err) {
        if (requestId !== protoParseRequestRef.current) return
        console.error("Proto parsing error:", err)
        setError(t("protoParseError"))
      }
    },
    [t],
  )

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
          setInputData(bytesToHex(new Uint8Array(buffer)))
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
          await applyParsedProto(content)
        }
      }
      reader.readAsText(selectedFile)
    },
    [t, applyParsedProto],
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
            setInputData(bytesToHex(new Uint8Array(buffer)))
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
            await applyParsedProto(content)
          }
        }
        reader.readAsText(droppedFile)
      }
    },
    [t, applyParsedProto],
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
    void writeClipboardText(text).then((success) => {
      if (!success) {
        setError(t("copyError"))
        return
      }

      setCopied(prev => ({ ...prev, [key]: true }))

      if (copyResetTimerRef.current !== null) {
        window.clearTimeout(copyResetTimerRef.current)
      }
      copyResetTimerRef.current = window.setTimeout(() => {
        setCopied(prev => ({ ...prev, [key]: false }))
        copyResetTimerRef.current = null
      }, 2000)
    })
  }, [t])

  // Download output as JSON file
  const downloadOutput = useCallback(() => {
    if (!outputData) return

    downloadBlob(
      new Blob([outputData], { type: "application/json" }),
      mode === "decode" ? "protobuf-decoded.json" : "protobuf-encoded.hex",
    )
  }, [outputData, mode])

  // Parse Protobuf data
  const parseProtobuf = useCallback(async () => {
    const requestId = ++processingRequestRef.current
    const requiredInput = mode === "decode" ? inputData : jsonInput
    if (!requiredInput) {
      setError(t("noInput"))
      return
    }
    if (schemaMode === "schema" && (!root || !selectedMessageType)) {
      setOutputData("")
      setIsProcessing(false)
      setError(t("schemaRequired"))
      return
    }

    setIsProcessing(true)
    setError(null)

    try {
      if (mode === "decode") {
        // Convert input to buffer
        const buffer = parseProtobufInput(inputData, inputMode === "file" ? "hex" : inputEncoding)
        const inspected = inspectProtobuf(buffer)

        let decoded
        if (schemaMode === "schema" && root && selectedMessageType) {
          // Parse using schema
          const Message = root.lookupType(selectedMessageType)
          decoded = decodeProtobufWithSchema(buffer, Message)
        } else {
          // Parse without schema
          decoded = inspected.value
        }

        // Format the output
        const result = JSON.stringify(decoded)
        setOutputData(result)
        setInspection({ data: inspected, revision: requestId })
      } else {
        // Encode JSON to Protobuf
        let encoded
        if (schemaMode === "schema" && root && selectedMessageType) {
          // Encode using schema
          encoded = encodeProtobufWithSchema(jsonInput, root.lookupType(selectedMessageType))
        } else {
          // Encode without schema
          encoded = await encodeProtobuf(jsonInput)
        }
        if (requestId === processingRequestRef.current) setOutputData(bytesToHex(encoded))
      }
    } catch (err) {
      if (requestId !== processingRequestRef.current) return
      setOutputData("")
      setInspection(null)
      setError(err instanceof ProtobufError
        ? t(`errors.${err.code}`).replace("{offset}", String(err.offset))
        : t(mode === "decode" ? "parseError" : "encodeError"))
    } finally {
      if (requestId === processingRequestRef.current) setIsProcessing(false)
    }
  }, [
    inputData,
    inputMode,
    inputEncoding,
    jsonInput,
    mode,
    schemaMode,
    root,
    selectedMessageType,
    t,
  ])

  // Clear input and output
  const clearAll = useCallback(() => {
    processingRequestRef.current += 1
    setIsProcessing(false)
    setInputData("")
    setJsonInput("")
    setOutputData("")
    setInspection(null)
    setFile(null)
    setError(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }, [])

  // Process when input changes
  useEffect(() => {
    processingRequestRef.current += 1
    setIsProcessing(false)
    setInspection(null)
    setOutputData("")
    const source = mode === "decode" ? inputData : jsonInput
    if (!source) {
      setOutputData("")
      setError(null)
      return
    }

    // Don't auto-process large inputs, and wait until the user pauses typing.
    if (source.length >= 10000) return

    const timeout = window.setTimeout(() => {
      void parseProtobuf()
    }, 250)

    return () => {
      window.clearTimeout(timeout)
      processingRequestRef.current += 1
    }
  }, [inputData, jsonInput, mode, parseProtobuf])

  useEffect(() => {
    return () => {
      if (copyResetTimerRef.current !== null) {
        window.clearTimeout(copyResetTimerRef.current)
      }
    }
  }, [])

  return (
    <div className="container mx-auto max-w-7xl px-3 py-4 sm:px-4">
      <div className="mb-6 text-center sm:mb-8">
        <h1 className="mb-2 flex items-center justify-center gap-2 text-2xl font-bold text-[var(--md-sys-color-on-surface)] sm:text-3xl">
          <Database className="h-7 w-7 text-[var(--md-sys-color-primary)] sm:h-8 sm:w-8" />
          {t("title")}
        </h1>
        <p className="mx-auto max-w-2xl text-sm text-[var(--md-sys-color-on-surface-variant)] sm:text-base">
          {t("description")}
        </p>
      </div>

      <Tabs defaultValue="decode" className="w-full" onValueChange={(value) => setMode(value as "decode" | "encode")}>
        <div className="mb-6">
          <TabsList className="grid h-14 w-full grid-cols-2 rounded-xl border border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container)] p-1.5">
            <TabsTrigger
              value="decode"
              className="flex min-w-0 items-center justify-center gap-2 rounded-lg px-2 py-3 transition-colors data-[state=active]:bg-[var(--md-sys-color-primary-container)] data-[state=active]:text-[var(--md-sys-color-on-primary-container)] sm:px-4"
            >
              <Code className="h-5 w-5" />
              <span className="truncate text-sm font-medium">{t("decodeProtobuf")}</span>
            </TabsTrigger>
            <TabsTrigger
              value="encode"
              className="flex min-w-0 items-center justify-center gap-2 rounded-lg px-2 py-3 transition-colors data-[state=active]:bg-[var(--md-sys-color-primary-container)] data-[state=active]:text-[var(--md-sys-color-on-primary-container)] sm:px-4"
            >
              <Database className="h-5 w-5" />
              <span className="truncate text-sm font-medium">{t("encodeJson")}</span>
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="w-full">
          <div className="mb-6">
            <SegmentedControl
              defaultValue="schemaless"
              onValueChange={(value) => setSchemaMode(value as "schemaless" | "schema")}
              aria-label={t("parseModeLabel")}
              className="grid h-12 w-full grid-cols-2 rounded-lg bg-[var(--md-sys-color-surface-container)] p-1"
            >
              <SegmentedControlItem
                value="schemaless"
                className="flex min-w-0 items-center justify-center gap-1 px-1 data-[state=checked]:bg-[var(--md-sys-color-surface-container-lowest)] sm:gap-2 sm:px-3"
              >
                <Zap className="h-4 w-4" />
                <span className="truncate text-sm sm:hidden">{t("schemalessShort")}</span>
                <span className="hidden text-sm sm:inline">{t("schemalessMode")}</span>
              </SegmentedControlItem>
              <SegmentedControlItem
                value="schema"
                className="flex min-w-0 items-center justify-center gap-1 px-1 data-[state=checked]:bg-[var(--md-sys-color-surface-container-lowest)] sm:gap-2 sm:px-3"
              >
                <Shield className="h-4 w-4" />
                <span className="text-sm sm:hidden">Schema</span>
                <span className="hidden text-sm sm:inline">{t("schemaMode")}</span>
              </SegmentedControlItem>
            </SegmentedControl>
          </div>

          {schemaMode === "schema" && (
            <Card className="mb-6 card-modern">
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle className="flex min-w-0 flex-wrap items-center gap-2 text-lg">
                    <FileText className="h-5 w-5 text-[var(--md-sys-color-primary)]" />
                    {t("schemaConfiguration")}
                  </CardTitle>
                  {(protoFile || protoContent) && (
                    <Button variant="outline" size="sm" onClick={removeProtoFile} className="w-full sm:ml-auto sm:w-auto">
                      <X className="mr-2 h-4 w-4" />
                      {t("removeSchema")}
                    </Button>
                  )}
                </div>
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
                      {t("textMode")}
                    </TabsTrigger>
                    <TabsTrigger value="file" className="flex items-center gap-2">
                      <Upload className="h-4 w-4" />
                      {t("fileMode")}
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

                          if (e.target.value.trim()) {
                            void applyParsedProto(e.target.value)
                          } else {
                            // 使仍在进行中的解析请求失效，避免清空后旧结果回填
                            protoParseRequestRef.current += 1
                            setRoot(null)
                            setMessageTypes([])
                            setSelectedMessageType("")
                          }
                        }}
                      />
                    </div>
                  </TabsContent>

                  <TabsContent value="file" className="space-y-4">
                    {!protoFile ? (
                      <div
                        className="cursor-pointer rounded-xl border-2 border-dashed border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container-low)] p-6 text-center transition-colors hover:bg-[var(--md-sys-color-surface-container-high)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--md-sys-color-primary)]"
                        onDrop={handleProtoDrop}
                        onDragOver={handleDragOver}
                        onClick={() => protoFileInputRef.current?.click()}
                        onKeyDown={(event) => {
                          if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) {
                            event.preventDefault()
                            protoFileInputRef.current?.click()
                          }
                        }}
                        role="button"
                        tabIndex={0}
                        aria-label={t("selectProtoFile")}
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
                    <Label htmlFor="message-type" className="text-sm font-medium">{t("messageType")}</Label>
                    <Select value={selectedMessageType} onValueChange={setSelectedMessageType}>
                      <SelectTrigger id="message-type" className="w-full h-10">
                        <SelectValue placeholder={t("selectMessageType")} />
                      </SelectTrigger>
                      <SelectContent>
                        {messageTypes.map((type) => (
                          <SelectItem key={type} value={type} className="font-mono text-sm">
                            {type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="rounded-lg bg-[var(--md-sys-color-surface-container-low)] p-2 text-xs text-[var(--md-sys-color-on-surface-variant)]">
                      {t("messageTypesFound")}: {messageTypes.length}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        <TabsContent value="decode" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Input Section */}
            <Card className="card-modern">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Upload className="h-5 w-5 text-[var(--md-sys-color-primary)]" />
                  {t("protobufInput")}
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
                      {t("textMode")}
                    </TabsTrigger>
                    <TabsTrigger value="file" className="flex items-center gap-2">
                      <FileUp className="h-4 w-4" />
                      {t("fileMode")}
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="text" className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <Label htmlFor="input-data">{t("input")}</Label>
                        <Select value={inputEncoding} onValueChange={(value) => setInputEncoding(value as typeof inputEncoding)}>
                          <SelectTrigger aria-label={t("inputEncoding")} className="h-8 w-auto min-w-0 gap-1.5 rounded-full border-0 bg-transparent px-2.5 py-1 text-xs text-md-on-surface-variant shadow-none hover:bg-md-surface-container-high focus:ring-1 focus:ring-offset-0">
                            <SelectValue>{inputEncoding === "auto" ? t("autoEncodingShort") : inputEncoding === "hex" ? "Hex" : "Base64"}</SelectValue>
                          </SelectTrigger>
                          <SelectContent align="end">
                            <SelectItem value="auto">{t("autoEncoding")}</SelectItem>
                            <SelectItem value="hex">Hex</SelectItem>
                            <SelectItem value="base64">Base64</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
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
                      className="cursor-pointer rounded-xl border-2 border-dashed border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container-low)] p-6 text-center transition-colors hover:bg-[var(--md-sys-color-surface-container-high)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--md-sys-color-primary)]"
                      onDrop={handleDrop}
                      onDragOver={handleDragOver}
                      onClick={() => fileInputRef.current?.click()}
                      onKeyDown={(event) => {
                        if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) {
                          event.preventDefault()
                          fileInputRef.current?.click()
                        }
                      }}
                      role="button"
                      tabIndex={0}
                      aria-label={file ? t("replaceDataFile") : t("selectDataFile")}
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

                {error && (
                  <div role="alert" className="mt-3 rounded-xl border border-[var(--md-sys-color-error)]/30 bg-[var(--md-sys-color-error-container)] p-3 text-sm text-[var(--md-sys-color-on-error-container)]">
                    {error}
                  </div>
                )}

                <div className="mt-4 grid grid-cols-2 gap-2 sm:flex sm:justify-between">
                  <Button variant="outline" onClick={clearAll} className="w-full sm:w-auto">
                    {t("clearInput")}
                  </Button>
                  <Button
                    onClick={parseProtobuf}
                    className="w-full sm:w-auto"
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
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle className="flex min-w-0 flex-wrap items-center gap-2 text-lg">
                    <FileText className="h-5 w-5 text-[var(--md-sys-color-primary)]" />
                    {t("jsonOutput")}
                  </CardTitle>
                  <div className="grid w-full grid-cols-2 gap-2 sm:ml-auto sm:flex sm:w-auto">
                    <SendToMenu value={mode === "decode" && outputData ? JSON.parse(outputData) : null} source="Protobuf JSON" disabled={!outputData} />
                    <Button className="w-full sm:w-auto" variant="outline" size="sm" onClick={() => copyToClipboard(outputData)} disabled={!outputData}>
                      {copied.main ? (
                        <Check className="mr-2 h-4 w-4 text-[var(--md-sys-color-primary)]" />
                      ) : (
                        <Copy className="mr-2 h-4 w-4" />
                      )}
                      {copied.main ? t("copied") : t("copy")}
                    </Button>
                    <Button className="w-full sm:w-auto" variant="outline" size="sm" onClick={downloadOutput} disabled={!outputData}>
                      <Download className="mr-2 h-4 w-4" />
                      {t("download")}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <Textarea 
                    id="output-data" 
                    className="h-[320px] bg-[var(--md-sys-color-surface-container-low)] font-mono sm:h-[400px]"
                    value={outputData} 
                    readOnly 
                    wrap="off"
                    placeholder={t("decodeResultPlaceholder")}
                  />

                  {outputData && <JsonTreeView jsonText={outputData} indentSize={indentSize} emphasizeIndentation />}
                </div>

                <div className="mt-4 space-y-4 rounded-xl bg-[var(--md-sys-color-surface-container-low)] p-4">
                  <Label className="text-sm font-medium">{t("options")}</Label>
                  
                  <div className="flex items-center space-x-2">
                    <Label htmlFor="indent-size" className="text-sm">{t("indentSize")}:</Label>
                    <Input
                      id="indent-size"
                      type="number"
                      min="0"
                      max="8"
                      value={indentSize}
                      onChange={(e) => setIndentSize(Number.parseInt(e.target.value) || 0)}
                      className="h-9 w-20"
                    />
                  </div>
                  
                  {outputData && (
                    <div className="border-t border-[var(--md-sys-color-outline-variant)] pt-2 text-xs text-[var(--md-sys-color-on-surface-variant)]">
                      {t("outputLength")}: {outputData.length} {t("characters")}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
          {inspection && <ProtobufInspector key={inspection.revision} inspection={inspection.data} readOnly={schemaMode === "schema"} onValueChange={(value) => setOutputData(JSON.stringify(value))} />}
        </TabsContent>

        <TabsContent value="encode" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* JSON Input Section */}
            <Card className="card-modern">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Code className="h-5 w-5 text-[var(--md-sys-color-primary)]" />
                  {t("jsonInput")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="json-input" className="text-sm font-medium">{t("jsonData")}</Label>
                    <Textarea
                      id="json-input"
                      placeholder='{"1": "Hello", "2": 123, "3": {"4": "World"}}'
                      className="h-[320px] bg-[var(--md-sys-color-surface-container-low)] font-mono sm:h-[400px]"
                      value={jsonInput}
                      onChange={(e) => setJsonInput(e.target.value)}
                    />
                  </div>

                  {error && (
                    <div role="alert" className="rounded-xl border border-[var(--md-sys-color-error)]/30 bg-[var(--md-sys-color-error-container)] p-3">
                      <div className="text-sm text-[var(--md-sys-color-on-error-container)]">{error}</div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 items-center gap-2 pt-2 sm:flex sm:justify-between">
                    <Button variant="outline" onClick={clearAll} size="sm" className="w-full sm:w-auto">
                      <X className="mr-2 h-4 w-4" />
                      {t("clearInput")}
                    </Button>
                    <Button
                      onClick={parseProtobuf}
                      disabled={
                        isProcessing || !jsonInput || (schemaMode === "schema" && (!root || !selectedMessageType))
                      }
                      size="lg"
                      className="w-full px-3 sm:w-auto sm:px-6"
                    >
                      {isProcessing ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          {t("encoding")}
                        </>
                      ) : (
                        <>
                          <Database className="mr-2 h-4 w-4" />
                          {t("encodeToProtobuf")}
                        </>
                      )}
                    </Button>
                  </div>
                  
                  {jsonInput && (
                    <div className="border-t border-[var(--md-sys-color-outline-variant)] pt-2 text-xs text-[var(--md-sys-color-on-surface-variant)]">
                      {t("inputLength")}: {jsonInput.length} {t("characters")}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Protobuf Output Section */}
            <Card className="card-modern">
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle className="flex min-w-0 flex-wrap items-center gap-2 text-lg">
                    <Database className="h-5 w-5 text-[var(--md-sys-color-primary)]" />
                    {t("protobufOutput")}
                  </CardTitle>
                  <div className="grid w-full grid-cols-2 gap-2 sm:ml-auto sm:flex sm:w-auto">
                    <SendToMenu value={encodedBytes} source="Protobuf" filename="encoded-protobuf.bin" disabled={!encodedBytes} />
                    <Button className="w-full sm:w-auto" variant="outline" size="sm" onClick={() => copyToClipboard(outputData)} disabled={!outputData}>
                      {copied.main ? (
                        <Check className="mr-2 h-4 w-4 text-[var(--md-sys-color-primary)]" />
                      ) : (
                        <Copy className="mr-2 h-4 w-4" />
                      )}
                      {copied.main ? t("copied") : t("copy")}
                    </Button>
                    <Button className="w-full sm:w-auto" variant="outline" size="sm" onClick={downloadOutput} disabled={!outputData}>
                      <Download className="mr-2 h-4 w-4" />
                      {t("download")}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <Textarea 
                    id="protobuf-output" 
                    className="h-[320px] bg-[var(--md-sys-color-surface-container-low)] font-mono sm:h-[400px]"
                    value={outputData} 
                    readOnly 
                    placeholder={t("encodeResultPlaceholder")}
                  />
                </div>

                <div className="mt-4 rounded-xl bg-[var(--md-sys-color-surface-container-low)] p-4">
                  <div className="text-sm text-[var(--md-sys-color-on-surface-variant)]">
                    {schemaMode === "schema" ? 
                      t("encodeSchemaHelp") :
                      t("encodeHelp")
                    }
                  </div>
                  {outputData && (
                    <div className="mt-2 border-t border-[var(--md-sys-color-outline-variant)] pt-2 text-xs text-[var(--md-sys-color-on-surface-variant)]">
                      {t("outputLength")}: {outputData.length} {t("characters")} ({t("hexFormat")})
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

