"use client"

import { copyTextToClipboard as writeClipboardText } from "@/lib/clipboard"

import type React from "react"

import { useState, useRef, useCallback, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { JsonTreeView } from "@/components/json-tree-view"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useTranslations } from "@/hooks/use-translations"
import { bytesToBase64, bytesToHex } from "@/lib/binary"
import { downloadBlob } from "@/lib/object-url"
import { Loader2, Copy, FileUp, X, Download, RefreshCw, Upload, Zap, Code, FileText, Database, Shield, Check } from "lucide-react"
import * as protobuf from "protobufjs"

function collectMessageTypes(namespace: protobuf.NamespaceBase): string[] {
  const messageTypes: string[] = []

  namespace.nestedArray.forEach((item) => {
    if (item instanceof protobuf.Type) {
      messageTypes.push(item.fullName)
      messageTypes.push(...collectMessageTypes(item))
    } else if (item instanceof protobuf.Namespace) {
      messageTypes.push(...collectMessageTypes(item))
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
  const [outputData, setOutputData] = useState("")
  const [jsonInput, setJsonInput] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [protoFile, setProtoFile] = useState<File | null>(null)
  const [protoContent, setProtoContent] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState<{ [key: string]: boolean }>({})
  const [indentSize, setIndentSize] = useState(2)
  const [root, setRoot] = useState<protobuf.Root | null>(null)
  const [messageTypes, setMessageTypes] = useState<string[]>([])
  const [selectedMessageType, setSelectedMessageType] = useState<string>("")
  const fileInputRef = useRef<HTMLInputElement>(null)
  const protoFileInputRef = useRef<HTMLInputElement>(null)
  const copyResetTimerRef = useRef<number | null>(null)

  // Detect input format (base64 or hex)
  const detectInputFormat = (input: string): "base64" | "hex" | "unknown" => {
    // Remove whitespace
    const cleanInput = input.replace(/\s/g, "")

    // Check if it's hex (only contains hex characters)
    if (/^(?:[0-9a-fA-F]{2})+$/.test(cleanInput)) {
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

          try {
            // Parse the proto file
            const parsedRoot = protobuf.parse(content, { keepCase: true }).root

            // Set the root directly since it's already parsed
            setRoot(parsedRoot)

            // Get all message types
            const types = collectMessageTypes(parsedRoot)
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

            try {
              // Parse the proto file
              const parsedRoot = protobuf.parse(content, { keepCase: true }).root

              // Set the root directly since it's already parsed
              setRoot(parsedRoot)

              // Get all message types
              const types = collectMessageTypes(parsedRoot)
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
    const requiredInput = mode === "decode" ? inputData : jsonInput
    if (!requiredInput) {
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
          const msg = Message.decode(buffer)
          decoded = Message.toObject(msg, { longs: Number, enums: String, defaults: true })
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
      try {
        const tag = reader.uint32()
        const fieldNumber = tag >>> 3
        const wireType = tag & 7

        let value: any

        switch (wireType) {
          case 0: // Varint
            value = Number(reader.uint64().toString())
            break
          case 1: // Fixed64
            value = Number(reader.fixed64().toString())
            break
          case 2: { // Length-delimited
            const bytes = reader.bytes()
            try {
              const str = new TextDecoder("utf-8", { fatal: true }).decode(bytes)
              if (!/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(str) && str.length > 0) {
                value = str
              } else {
                try {
                  value = decodeProtobuf(bytes)
                } catch {
                  value = bytesToBase64(bytes)
                }
              }
            } catch {
              try {
                value = decodeProtobuf(bytes)
              } catch {
                value = bytesToBase64(bytes)
              }
            }
            break
          }
          case 5: // Fixed32
            value = reader.fixed32()
            break
          default:
            reader.skipType(wireType)
            continue
        }

        if (result[fieldNumber] !== undefined) {
          if (!Array.isArray(result[fieldNumber])) {
            result[fieldNumber] = [result[fieldNumber]]
          }
          result[fieldNumber].push(value)
        } else {
          result[fieldNumber] = value
        }
      } catch {
        break
      }
    }

    return result
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

    return () => window.clearTimeout(timeout)
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

        <Tabs
          defaultValue="schemaless"
          className="w-full"
          onValueChange={(value) => setSchemaMode(value as "schemaless" | "schema")}
        >
          <div className="mb-6">
            <TabsList className="grid h-12 w-full grid-cols-2 rounded-lg bg-[var(--md-sys-color-surface-container)] p-1">
              <TabsTrigger 
                value="schemaless" 
                className="flex min-w-0 items-center justify-center gap-1 px-1 data-[state=active]:bg-[var(--md-sys-color-surface-container-lowest)] sm:gap-2 sm:px-3"
              >
                <Zap className="h-4 w-4" />
                <span className="truncate text-sm sm:hidden">{t("schemalessShort")}</span>
                <span className="hidden text-sm sm:inline">{t("schemalessMode")}</span>
              </TabsTrigger>
              <TabsTrigger 
                value="schema" 
                className="flex min-w-0 items-center justify-center gap-1 px-1 data-[state=active]:bg-[var(--md-sys-color-surface-container-lowest)] sm:gap-2 sm:px-3"
              >
                <Shield className="h-4 w-4" />
                <span className="text-sm sm:hidden">Schema</span>
                <span className="hidden text-sm sm:inline">{t("schemaMode")}</span>
              </TabsTrigger>
            </TabsList>
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
        </Tabs>

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
                    <Button className="w-full sm:w-auto" variant="outline" size="sm" onClick={() => copyToClipboard(outputData)} disabled={!outputData}>
                      {copied.main ? (
                        <Check className="mr-2 h-4 w-4 text-green-500" />
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
                    placeholder={t("decodeResultPlaceholder")}
                  />

                  {outputData && <JsonTreeView jsonText={outputData} indentSize={indentSize} />}
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
                    <Button className="w-full sm:w-auto" variant="outline" size="sm" onClick={() => copyToClipboard(outputData)} disabled={!outputData}>
                      {copied.main ? (
                        <Check className="mr-2 h-4 w-4 text-green-500" />
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

