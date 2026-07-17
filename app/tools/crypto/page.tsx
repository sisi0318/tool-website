"use client"

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from "react"
import {
  AlertTriangle,
  Check,
  Copy,
  Download,
  FileText,
  Info,
  Loader2,
  Lock,
  RefreshCw,
  ShieldCheck,
  Unlock,
  Upload,
  X,
} from "lucide-react"
import CryptoJS from "crypto-js"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useToolActivity } from "@/components/tool-activity"
import { useToolRuntimeParams } from "@/components/tool-runtime-params"
import { useTranslations } from "@/hooks/use-translations"
import { copyTextToClipboard } from "@/lib/clipboard"
import {
  CryptoInputError,
  bytesToHex,
  cryptoInputByteLength,
  parseCryptoInput,
  safeCryptoDownloadName,
  type CryptoInputFormat,
} from "@/lib/crypto-input"
import {
  decryptCryptoWordArray,
  encryptCryptoWordArray,
  type SupportedCryptoAlgorithm,
} from "@/lib/crypto-cipher"
import {
  bytesToCryptoWordArray,
  cryptoWordArrayToBytes,
} from "@/lib/crypto-js-bytes"
import { downloadBlob } from "@/lib/object-url"

interface FileInfo {
  file: File
  name: string
  size: number
  sizeFormatted: string
}

interface CryptoAlgorithm {
  id: SupportedCryptoAlgorithm
  name: string
  modes: string[]
  keySizes: number[]
  defaultKeySize: number
  ivBytes: number
  legacy: boolean
}

const MAX_FILE_SIZE = 10 * 1024 * 1024
const M3_CARD_CLASS =
  "min-w-0 rounded-[var(--md-sys-shape-corner-large)] border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container-lowest)] shadow-sm"
const M3_ICON_CLASS = "text-[var(--md-sys-color-primary)]"

const cryptoAlgorithms: CryptoAlgorithm[] = [
  {
    id: "aes",
    name: "AES",
    modes: ["CBC", "ECB", "CFB", "OFB", "CTR"],
    keySizes: [128, 192, 256],
    defaultKeySize: 256,
    ivBytes: 16,
    legacy: false,
  },
  {
    id: "des",
    name: "DES",
    modes: ["CBC", "ECB", "CFB", "OFB"],
    keySizes: [64],
    defaultKeySize: 64,
    ivBytes: 8,
    legacy: true,
  },
  {
    id: "tripledes",
    name: "3DES",
    modes: ["CBC", "ECB", "CFB", "OFB"],
    keySizes: [192],
    defaultKeySize: 192,
    ivBytes: 8,
    legacy: true,
  },
  {
    id: "rc4",
    name: "RC4",
    modes: ["Stream"],
    keySizes: [40, 56, 64, 80, 128, 256],
    defaultKeySize: 128,
    ivBytes: 0,
    legacy: true,
  },
  {
    id: "rabbit",
    name: "Rabbit",
    modes: ["Stream"],
    keySizes: [128],
    defaultKeySize: 128,
    ivBytes: 8,
    legacy: false,
  },
]

const unavailableAlgorithmNames = [
  "Blowfish",
  "Twofish",
  "IDEA",
  "RC5",
  "SM4",
  "ChaCha20",
  "Salsa20",
  "A5/1",
]

const formatOptions: Array<{ id: CryptoInputFormat; name: string }> = [
  { id: "raw", name: "Raw" },
  { id: "hex", name: "HEX" },
  { id: "base64", name: "Base64" },
]

function getRandomBytes(length: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(length))
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes"
  const units = ["Bytes", "KB", "MB", "GB"]
  const unitIndex = Math.min(
    units.length - 1,
    Math.floor(Math.log(bytes) / Math.log(1024)),
  )
  return `${Number.parseFloat((bytes / 1024 ** unitIndex).toFixed(2))} ${units[unitIndex]}`
}

function formatOutputData(
  outputData: CryptoJS.lib.WordArray,
  format: CryptoInputFormat,
  operation: "encrypt" | "decrypt",
): string {
  if (format === "hex") return outputData.toString(CryptoJS.enc.Hex)
  if (format === "base64") return outputData.toString(CryptoJS.enc.Base64)
  if (operation === "encrypt") return outputData.toString(CryptoJS.enc.Latin1)

  try {
    return outputData.toString(CryptoJS.enc.Utf8)
  } catch {
    return outputData.toString(CryptoJS.enc.Latin1)
  }
}

function readFileWithProgress(
  file: File,
  onProgress: (progress: number) => void,
  onReader: (reader: FileReader | null) => void,
): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    onReader(reader)
    reader.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 90))
      }
    }
    reader.onload = () => {
      onReader(null)
      if (reader.result instanceof ArrayBuffer) resolve(reader.result)
      else reject(new Error("crypto-file-read-failed"))
    }
    reader.onerror = () => {
      onReader(null)
      reject(reader.error ?? new Error("crypto-file-read-failed"))
    }
    reader.onabort = () => {
      onReader(null)
      reject(new DOMException("Crypto operation cancelled", "AbortError"))
    }
    reader.readAsArrayBuffer(file)
  })
}

export default function CryptoPage() {
  const t = useTranslations("crypto")
  const params = useToolRuntimeParams()
  const isToolActive = useToolActivity()
  const [operation, setOperation] = useState<"encrypt" | "decrypt">("encrypt")
  const [inputMode, setInputMode] = useState<"text" | "file">("text")
  const [input, setInput] = useState("")
  const [output, setOutput] = useState("")
  const [fileInfo, setFileInfo] = useState<FileInfo | null>(null)
  const [fileOutput, setFileOutput] = useState<Blob | null>(null)
  const [processing, setProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState("")
  const [routeWarning, setRouteWarning] = useState("")
  const [algorithm, setAlgorithm] =
    useState<CryptoAlgorithm["id"]>("aes")
  const [mode, setMode] = useState("CBC")
  const [keySize, setKeySize] = useState(256)
  const [key, setKey] = useState("")
  const [keyFormat, setKeyFormat] = useState<CryptoInputFormat>("hex")
  const [iv, setIv] = useState("")
  const [ivFormat, setIvFormat] = useState<CryptoInputFormat>("hex")
  const [inputFormat, setInputFormat] = useState<CryptoInputFormat>("raw")
  const [outputFormat, setOutputFormat] = useState<CryptoInputFormat>("hex")

  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const processIdRef = useRef(0)
  const fileReaderRef = useRef<FileReader | null>(null)

  const currentAlgorithm = useMemo(
    () =>
      cryptoAlgorithms.find((item) => item.id === algorithm) ??
      cryptoAlgorithms[0],
    [algorithm],
  )
  const requiresIV = currentAlgorithm.ivBytes > 0 && mode !== "ECB"
  const keyByteLength = useMemo(
    () => cryptoInputByteLength(key, keyFormat),
    [key, keyFormat],
  )
  const ivByteLength = useMemo(
    () => cryptoInputByteLength(iv, ivFormat),
    [iv, ivFormat],
  )

  const cancelProcessing = useCallback(() => {
    processIdRef.current += 1
    if (fileReaderRef.current?.readyState === FileReader.LOADING) {
      fileReaderRef.current.abort()
    }
    fileReaderRef.current = null
    setProcessing(false)
  }, [])

  const clearResults = useCallback(() => {
    setOutput("")
    setFileOutput(null)
    setProgress(0)
    setCopied(false)
    setError("")
  }, [])

  useEffect(() => {
    if (!isToolActive) cancelProcessing()
  }, [cancelProcessing, isToolActive])

  useEffect(
    () => () => {
      processIdRef.current += 1
      fileReaderRef.current?.abort()
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current)
    },
    [],
  )

  useEffect(() => {
    const feature = params?.feature?.trim()
    if (!feature) return
    const normalized = feature.toLowerCase().replace(/\s/g, "")
    const matched = cryptoAlgorithms.find(
      (item) =>
        item.id === normalized ||
        item.name.toLowerCase().replace(/\s/g, "") === normalized ||
        (item.id === "tripledes" && normalized === "3des"),
    )
    if (matched) {
      cancelProcessing()
      setAlgorithm(matched.id)
      setMode(matched.modes[0])
      setKeySize(matched.defaultKeySize)
      setRouteWarning("")
      clearResults()
      return
    }
    const unavailable = unavailableAlgorithmNames.find(
      (name) => name.toLowerCase().replace(/\s/g, "") === normalized,
    )
    if (unavailable) {
      setRouteWarning(
        t("unavailableAlgorithm").replace("{algorithm}", unavailable),
      )
    }
  }, [cancelProcessing, clearResults, params?.feature, t])

  const parseMaterial = useCallback(
    (
      value: string,
      format: CryptoInputFormat,
      expectedBytes: number,
      kind: "key" | "iv",
    ) => {
      if (!value) {
        throw new Error(kind === "key" ? t("invalidKey") : t("invalidIV"))
      }

      let bytes: Uint8Array
      try {
        bytes = parseCryptoInput(value, format, "utf8")
      } catch {
        throw new Error(
          kind === "key" ? t("invalidKeyFormat") : t("invalidIVFormat"),
        )
      }
      if (bytes.length !== expectedBytes) {
        const template =
          kind === "key" ? t("keyLengthMismatch") : t("ivLengthMismatch")
        throw new Error(
          template
            .replace("{expected}", String(expectedBytes))
            .replace("{actual}", String(bytes.length)),
        )
      }
      return bytesToCryptoWordArray(bytes)
    },
    [t],
  )

  const prepareMaterials = useCallback(() => {
    const keyWordArray = parseMaterial(
      key,
      keyFormat,
      keySize / 8,
      "key",
    )
    const ivWordArray = requiresIV
      ? parseMaterial(
          iv,
          ivFormat,
          currentAlgorithm.ivBytes,
          "iv",
        )
      : null
    return { keyWordArray, ivWordArray }
  }, [
    currentAlgorithm.ivBytes,
    iv,
    ivFormat,
    key,
    keyFormat,
    keySize,
    parseMaterial,
    requiresIV,
  ])

  const processBytes = useCallback(
    (
      inputBytes: Uint8Array,
      keyWordArray: CryptoJS.lib.WordArray,
      ivWordArray: CryptoJS.lib.WordArray | null,
    ) => {
      const data = bytesToCryptoWordArray(inputBytes)
      return operation === "encrypt"
        ? encryptCryptoWordArray(
            currentAlgorithm.id,
            data,
            keyWordArray,
            ivWordArray,
            mode,
          )
        : decryptCryptoWordArray(
            currentAlgorithm.id,
            data,
            keyWordArray,
            ivWordArray,
            mode,
          )
    },
    [currentAlgorithm.id, mode, operation],
  )

  const friendlyProcessingError = useCallback(
    (caught: unknown) => {
      if (caught instanceof CryptoInputError) return t("invalidInputFormat")
      if (
        caught instanceof Error &&
        caught.message === "crypto-empty-decryption"
      ) {
        return t("decryptionFailed")
      }
      if (caught instanceof Error && caught.message.startsWith("crypto-")) {
        return t("fileReadFailed")
      }
      if (caught instanceof Error && caught.message) return caught.message
      return operation === "encrypt"
        ? t("encryptionFailed")
        : t("decryptionFailed")
    },
    [operation, t],
  )

  const processText = useCallback(async () => {
    if (!input) {
      setError(t("invalidInput"))
      return
    }
    cancelProcessing()
    const processId = ++processIdRef.current
    setProcessing(true)
    setError("")
    setOutput("")
    await new Promise<void>((resolve) => setTimeout(resolve, 0))
    if (processIdRef.current !== processId) return

    try {
      const { keyWordArray, ivWordArray } = prepareMaterials()
      const inputBytes = parseCryptoInput(
        input,
        inputFormat,
        operation === "encrypt" ? "utf8" : "latin1",
      )
      if (inputBytes.length === 0) throw new Error(t("invalidInput"))
      const outputData = processBytes(
        inputBytes,
        keyWordArray,
        ivWordArray,
      )
      if (processIdRef.current !== processId) return
      setOutput(formatOutputData(outputData, outputFormat, operation))
    } catch (caught) {
      if (processIdRef.current === processId) {
        setError(friendlyProcessingError(caught))
      }
    } finally {
      if (processIdRef.current === processId) setProcessing(false)
    }
  }, [
    cancelProcessing,
    friendlyProcessingError,
    input,
    inputFormat,
    operation,
    outputFormat,
    prepareMaterials,
    processBytes,
    t,
  ])

  const processFile = useCallback(async () => {
    if (!fileInfo) {
      setError(t("invalidInput"))
      return
    }
    cancelProcessing()
    const processId = ++processIdRef.current
    setProcessing(true)
    setProgress(0)
    setFileOutput(null)
    setError("")

    try {
      const { keyWordArray, ivWordArray } = prepareMaterials()
      const buffer = await readFileWithProgress(
        fileInfo.file,
        setProgress,
        (reader) => {
          fileReaderRef.current = reader
        },
      )
      if (processIdRef.current !== processId) return
      setProgress(95)
      await new Promise<void>((resolve) => setTimeout(resolve, 0))
      const outputData = processBytes(
        new Uint8Array(buffer),
        keyWordArray,
        ivWordArray,
      )
      const outputBytes = cryptoWordArrayToBytes(outputData)
      if (processIdRef.current !== processId) return
      const outputBuffer = outputBytes.buffer.slice(
        outputBytes.byteOffset,
        outputBytes.byteOffset + outputBytes.byteLength,
      ) as ArrayBuffer
      setFileOutput(
        new Blob([outputBuffer], { type: "application/octet-stream" }),
      )
      setProgress(100)
    } catch (caught) {
      if (
        caught instanceof DOMException &&
        caught.name === "AbortError"
      ) {
        return
      }
      if (processIdRef.current === processId) {
        setError(friendlyProcessingError(caught))
      }
    } finally {
      if (processIdRef.current === processId) setProcessing(false)
    }
  }, [
    cancelProcessing,
    fileInfo,
    friendlyProcessingError,
    prepareMaterials,
    processBytes,
    t,
  ])

  const generateRandomKey = useCallback(() => {
    cancelProcessing()
    setKey(bytesToHex(getRandomBytes(keySize / 8)))
    setKeyFormat("hex")
    clearResults()
  }, [cancelProcessing, clearResults, keySize])

  const generateRandomIV = useCallback(() => {
    cancelProcessing()
    setIv(bytesToHex(getRandomBytes(currentAlgorithm.ivBytes)))
    setIvFormat("hex")
    clearResults()
  }, [cancelProcessing, clearResults, currentAlgorithm.ivBytes])

  const handleAlgorithmChange = useCallback(
    (nextId: string) => {
      const nextAlgorithm = cryptoAlgorithms.find((item) => item.id === nextId)
      if (!nextAlgorithm) return
      cancelProcessing()
      setAlgorithm(nextAlgorithm.id)
      setMode(nextAlgorithm.modes[0])
      setKeySize(nextAlgorithm.defaultKeySize)
      setRouteWarning("")
      clearResults()
    },
    [cancelProcessing, clearResults],
  )

  const handleOperationChange = useCallback(
    (nextOperation: "encrypt" | "decrypt") => {
      cancelProcessing()
      setOperation(nextOperation)
      setInputFormat(nextOperation === "encrypt" ? "raw" : "hex")
      setOutputFormat(nextOperation === "encrypt" ? "hex" : "raw")
      clearResults()
    },
    [cancelProcessing, clearResults],
  )

  const selectFile = useCallback(
    (file: File) => {
      cancelProcessing()
      if (file.size > MAX_FILE_SIZE) {
        setError(t("fileTooBig"))
        return
      }
      setFileInfo({
        file,
        name: file.name,
        size: file.size,
        sizeFormatted: formatFileSize(file.size),
      })
      clearResults()
    },
    [cancelProcessing, clearResults, t],
  )

  const handleFileUpload = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (file) selectFile(file)
      event.currentTarget.value = ""
    },
    [selectFile],
  )

  const handleFileDrop = useCallback(
    (event: DragEvent<HTMLElement>) => {
      event.preventDefault()
      event.stopPropagation()
      const file = event.dataTransfer.files[0]
      if (file) selectFile(file)
    },
    [selectFile],
  )

  const preventDefaults = useCallback((event: DragEvent<HTMLElement>) => {
    event.preventDefault()
    event.stopPropagation()
  }, [])

  const clearInput = useCallback(() => {
    cancelProcessing()
    setInput("")
    setFileInfo(null)
    clearResults()
    inputRef.current?.focus()
  }, [cancelProcessing, clearResults])

  const clearOutput = useCallback(() => {
    cancelProcessing()
    clearResults()
  }, [cancelProcessing, clearResults])

  const copyOutput = useCallback(() => {
    if (!output) return
    void copyTextToClipboard(output).then((success) => {
      if (!success) {
        setError(t("copyFailed"))
        return
      }
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current)
      setCopied(true)
      copyTimeoutRef.current = setTimeout(() => setCopied(false), 2000)
    })
  }, [output, t])

  const downloadResult = useCallback(() => {
    if (!fileOutput) return
    const prefix = operation === "encrypt" ? "encrypted" : "decrypted"
    downloadBlob(
      fileOutput,
      `${prefix}_${safeCryptoDownloadName(fileInfo?.name ?? "result.bin")}`,
    )
  }, [fileInfo?.name, fileOutput, operation])

  const updateKey = (value: string) => {
    cancelProcessing()
    setKey(value)
    clearResults()
  }
  const updateIv = (value: string) => {
    cancelProcessing()
    setIv(value)
    clearResults()
  }

  const warnings = [
    routeWarning,
    currentAlgorithm.legacy ? t("legacyAlgorithmWarning") : "",
    mode === "ECB" ? t("ecbWarning") : "",
  ].filter(Boolean)
  const processLabel =
    operation === "encrypt" ? t("encryptNow") : t("decryptNow")

  return (
    <div className="container mx-auto max-w-5xl px-3 py-4 sm:px-4">
      <header className="mb-6 text-center">
        <div className="mb-2 flex items-center justify-center gap-2">
          <ShieldCheck className={`h-8 w-8 ${M3_ICON_CLASS}`} aria-hidden="true" />
          <h1 className="text-2xl font-bold text-[var(--md-sys-color-on-surface)] sm:text-3xl">
            {t("title")}
          </h1>
        </div>
        <p className="text-sm text-[var(--md-sys-color-on-surface-variant)] sm:text-base">
          {t("description")}
        </p>
      </header>

      <div className="space-y-4">
        <Card className={M3_CARD_CLASS}>
          <CardContent className="pt-5">
            <RadioGroup
              value={operation}
              onValueChange={(value) =>
                handleOperationChange(value as "encrypt" | "decrypt")
              }
              className="grid grid-cols-2 gap-2"
            >
              {[
                { value: "encrypt", label: t("encrypt"), icon: Lock },
                { value: "decrypt", label: t("decrypt"), icon: Unlock },
              ].map((item) => {
                const Icon = item.icon
                const selected = operation === item.value
                return (
                  <Label
                    key={item.value}
                    htmlFor={`crypto-operation-${item.value}`}
                    className={`flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-[var(--md-sys-shape-corner-large)] border px-4 transition-colors ${
                      selected
                        ? "border-[var(--md-sys-color-primary)] bg-[var(--md-sys-color-primary-container)] text-[var(--md-sys-color-on-primary-container)]"
                        : "border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container-low)]"
                    }`}
                  >
                    <RadioGroupItem
                      id={`crypto-operation-${item.value}`}
                      value={item.value}
                    />
                    <Icon className="h-4 w-4" aria-hidden="true" />
                    {item.label}
                  </Label>
                )
              })}
            </RadioGroup>
          </CardContent>
        </Card>

        <Card className={M3_CARD_CLASS}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t("configuration")}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="crypto-algorithm">{t("algorithm")}</Label>
              <Select value={algorithm} onValueChange={handleAlgorithmChange}>
                <SelectTrigger id="crypto-algorithm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {cryptoAlgorithms.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="crypto-mode">{t("mode")}</Label>
              <Select
                value={mode}
                onValueChange={(value) => {
                  cancelProcessing()
                  setMode(value)
                  clearResults()
                }}
              >
                <SelectTrigger id="crypto-mode">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {currentAlgorithm.modes.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="crypto-key-size">{t("keySize")}</Label>
              <Select
                value={keySize.toString()}
                onValueChange={(value) => {
                  cancelProcessing()
                  setKeySize(Number.parseInt(value))
                  clearResults()
                }}
              >
                <SelectTrigger id="crypto-key-size">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {currentAlgorithm.keySizes.map((value) => (
                    <SelectItem key={value} value={value.toString()}>
                      {value} {t("bits")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card className={M3_CARD_CLASS}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t("keyMaterial")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label htmlFor="crypto-key">{t("key")}</Label>
                <Button variant="outline" size="sm" onClick={generateRandomKey}>
                  <RefreshCw className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                  {t("generateKey")}
                </Button>
              </div>
              <div className="grid grid-cols-[minmax(0,1fr)_6.75rem]">
                <Input
                  id="crypto-key"
                  value={key}
                  onChange={(event) => updateKey(event.target.value)}
                  placeholder={t("keyPlaceholder")}
                  className="min-w-0 rounded-r-none font-mono"
                  aria-invalid={
                    key.length > 0 &&
                    keyByteLength !== keySize / 8
                      ? true
                      : undefined
                  }
                />
                <Select
                  value={keyFormat}
                  onValueChange={(value: CryptoInputFormat) => {
                    cancelProcessing()
                    setKeyFormat(value)
                    clearResults()
                  }}
                >
                  <SelectTrigger
                    aria-label={t("keyFormat")}
                    className="rounded-l-none border-l-0"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {formatOptions.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-[var(--md-sys-color-on-surface-variant)]">
                {t("byteLength")
                  .replace("{expected}", String(keySize / 8))
                  .replace(
                    "{actual}",
                    keyByteLength === null ? t("invalid") : String(keyByteLength),
                  )}
              </p>
            </div>

            {requiresIV && (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Label htmlFor="crypto-iv">{t("iv")}</Label>
                  <Button variant="outline" size="sm" onClick={generateRandomIV}>
                    <RefreshCw className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                    {t("generateIV")}
                  </Button>
                </div>
                <div className="grid grid-cols-[minmax(0,1fr)_6.75rem]">
                  <Input
                    id="crypto-iv"
                    value={iv}
                    onChange={(event) => updateIv(event.target.value)}
                    placeholder={t("ivPlaceholder")}
                    className="min-w-0 rounded-r-none font-mono"
                    aria-invalid={
                      iv.length > 0 &&
                      ivByteLength !== currentAlgorithm.ivBytes
                        ? true
                        : undefined
                    }
                  />
                  <Select
                    value={ivFormat}
                    onValueChange={(value: CryptoInputFormat) => {
                      cancelProcessing()
                      setIvFormat(value)
                      clearResults()
                    }}
                  >
                    <SelectTrigger
                      aria-label={t("ivFormat")}
                      className="rounded-l-none border-l-0"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {formatOptions.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-xs text-[var(--md-sys-color-on-surface-variant)]">
                  {t("byteLength")
                    .replace("{expected}", String(currentAlgorithm.ivBytes))
                    .replace(
                      "{actual}",
                      ivByteLength === null ? t("invalid") : String(ivByteLength),
                    )}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <div
          className="flex items-start gap-2 rounded-[var(--md-sys-shape-corner-medium)] bg-[var(--md-sys-color-secondary-container)] p-3 text-sm text-[var(--md-sys-color-on-secondary-container)]"
        >
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{t("compatibilityWarning")}</span>
        </div>

        {warnings.map((warning) => (
          <div
            key={warning}
            className="flex items-start gap-2 rounded-[var(--md-sys-shape-corner-medium)] bg-[var(--md-sys-color-tertiary-container)] p-3 text-sm text-[var(--md-sys-color-on-tertiary-container)]"
            role="status"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{warning}</span>
          </div>
        ))}

        <Card className={M3_CARD_CLASS}>
          <CardContent className="pt-5">
            <Tabs
              value={inputMode}
              onValueChange={(value) => {
                cancelProcessing()
                setInputMode(value as "text" | "file")
                clearResults()
              }}
            >
              <TabsList className="mb-4 grid h-auto w-full grid-cols-2">
                <TabsTrigger value="text" className="min-h-11 gap-2">
                  <FileText className="h-4 w-4" aria-hidden="true" />
                  {t("textMode")}
                </TabsTrigger>
                <TabsTrigger value="file" className="min-h-11 gap-2">
                  <Upload className="h-4 w-4" aria-hidden="true" />
                  {t("fileMode")}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="text">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Label htmlFor="crypto-input">{t("input")}</Label>
                        <Select
                          value={inputFormat}
                          onValueChange={(value: CryptoInputFormat) => {
                            cancelProcessing()
                            setInputFormat(value)
                            clearResults()
                          }}
                        >
                          <SelectTrigger
                            aria-label={t("inputFormat")}
                            className="h-9 w-28"
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {formatOptions.map((item) => (
                              <SelectItem key={item.id} value={item.id}>
                                {item.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button variant="outline" size="sm" onClick={clearInput}>
                        {t("clearInput")}
                      </Button>
                    </div>
                    <Textarea
                      ref={inputRef}
                      id="crypto-input"
                      value={input}
                      onChange={(event) => {
                        cancelProcessing()
                        setInput(event.target.value)
                        clearResults()
                      }}
                      placeholder={t("inputPlaceholder")}
                      rows={10}
                      className="min-h-56 resize-y font-mono"
                    />
                    <p className="text-right text-xs text-[var(--md-sys-color-on-surface-variant)]">
                      {input.length} {t("characters")}
                    </p>
                  </div>

                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Label htmlFor="crypto-output">{t("output")}</Label>
                        <Select
                          value={outputFormat}
                          onValueChange={(value: CryptoInputFormat) => {
                            cancelProcessing()
                            setOutputFormat(value)
                            setOutput("")
                          }}
                        >
                          <SelectTrigger
                            aria-label={t("outputFormat")}
                            className="h-9 w-28"
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {formatOptions.map((item) => (
                              <SelectItem key={item.id} value={item.id}>
                                {item.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={clearOutput}>
                          {t("clearOutput")}
                        </Button>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={copyOutput}
                                disabled={!output}
                                aria-label={copied ? t("copied") : t("copy")}
                              >
                                {copied ? (
                                  <Check
                                    className="h-4 w-4 text-[var(--md-sys-color-primary)]"
                                    aria-hidden="true"
                                  />
                                ) : (
                                  <Copy className="h-4 w-4" aria-hidden="true" />
                                )}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              {copied ? t("copied") : t("copy")}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </div>
                    <Textarea
                      id="crypto-output"
                      value={output}
                      readOnly
                      placeholder={t("outputPlaceholder")}
                      rows={10}
                      className="min-h-56 resize-y bg-[var(--md-sys-color-surface-container-low)] font-mono"
                    />
                    <p className="text-right text-xs text-[var(--md-sys-color-on-surface-variant)]">
                      {output.length} {t("characters")}
                    </p>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="file" className="space-y-4">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  className="hidden"
                />
                {!fileInfo ? (
                  <button
                    type="button"
                    className="w-full rounded-[var(--md-sys-shape-corner-large)] border-2 border-dashed border-[var(--md-sys-color-outline)] bg-[var(--md-sys-color-surface-container-low)] p-7 text-center transition-colors hover:border-[var(--md-sys-color-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--md-sys-color-primary)]"
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={preventDefaults}
                    onDragEnter={preventDefaults}
                    onDragLeave={preventDefaults}
                    onDrop={handleFileDrop}
                  >
                    <Upload
                      className="mx-auto mb-3 h-10 w-10 text-[var(--md-sys-color-on-surface-variant)]"
                      aria-hidden="true"
                    />
                    <span className="block font-medium">{t("dropFileHere")}</span>
                    <span className="mt-2 inline-block rounded-full bg-[var(--md-sys-color-secondary-container)] px-3 py-1 text-sm text-[var(--md-sys-color-on-secondary-container)]">
                      {t("uploadFile")}
                    </span>
                  </button>
                ) : (
                  <div className="rounded-[var(--md-sys-shape-corner-medium)] border border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container-low)] p-4">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <h3 className="font-medium">{t("fileInfo")}</h3>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={clearInput}
                        aria-label={t("removeFile")}
                      >
                        <X className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    </div>
                    <dl className="grid gap-3 text-sm sm:grid-cols-2">
                      <div className="min-w-0">
                        <dt className="text-xs text-[var(--md-sys-color-on-surface-variant)]">
                          {t("fileName")}
                        </dt>
                        <dd className="mt-1 break-all font-medium">
                          {fileInfo.name}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-[var(--md-sys-color-on-surface-variant)]">
                          {t("fileSize")}
                        </dt>
                        <dd className="mt-1 font-medium">
                          {fileInfo.sizeFormatted}
                        </dd>
                      </div>
                    </dl>
                    {processing && (
                      <div className="mt-4" aria-live="polite">
                        <div className="mb-1 flex justify-between text-sm">
                          <span>{t("processing")}</span>
                          <span className="tabular-nums">{progress}%</span>
                        </div>
                        <Progress value={progress} className="h-2" />
                      </div>
                    )}
                    {fileOutput && (
                      <Button onClick={downloadResult} className="mt-4 w-full">
                        <Download className="mr-2 h-4 w-4" aria-hidden="true" />
                        {t("downloadResult")}
                      </Button>
                    )}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {error && (
          <div
            className="rounded-[var(--md-sys-shape-corner-medium)] bg-[var(--md-sys-color-error-container)] p-3 text-sm text-[var(--md-sys-color-on-error-container)]"
            role="alert"
          >
            {error}
          </div>
        )}

        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
          <Button
            onClick={() =>
              void (inputMode === "text" ? processText() : processFile())
            }
            disabled={
              processing || (inputMode === "text" ? !input : !fileInfo)
            }
            className="min-h-11 w-full"
          >
            {processing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
            ) : operation === "encrypt" ? (
              <Lock className="mr-2 h-4 w-4" aria-hidden="true" />
            ) : (
              <Unlock className="mr-2 h-4 w-4" aria-hidden="true" />
            )}
            {processing ? t("processing") : processLabel}
          </Button>
          {processing && (
            <Button
              variant="outline"
              onClick={cancelProcessing}
              className="min-h-11"
            >
              {t("cancel")}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
