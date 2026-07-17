"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  FileText,
  History,
  Image as ImageIcon,
  Mail,
  MapPin,
  Phone,
  RefreshCw,
  RotateCcw,
  ScanLine,
  Settings,
  Trash2,
  Upload,
  User,
  Wifi,
  X,
} from "lucide-react"
import jsQR from "jsqr"

import { useI18n } from "@/components/i18n-provider"
import { JsonTreeView } from "@/components/json-tree-view"
import { useToolActivity } from "@/components/tool-activity"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { useObjectUrl } from "@/hooks/use-object-url"
import { useToast } from "@/hooks/use-toast"
import { useTranslations } from "@/hooks/use-translations"
import { createClientId } from "@/lib/client-id"
import { copyTextToClipboard } from "@/lib/clipboard"
import {
  FILE_SIZE_LIMITS,
  formatFileSizeLimit,
  isFileWithinLimit,
} from "@/lib/file-limits"
import { downloadBlob, withObjectUrl } from "@/lib/object-url"
import {
  csvCell,
  parseQRContent,
  type QRContentType,
} from "@/lib/qr-content-tools"

interface QRResult {
  id: string
  data: string
  timestamp: number
  type: QRContentType
  details: Record<string, unknown>
  fileName?: string
}

interface ImageEnhancement {
  brightness: number
  contrast: number
  rotation: number
  scale: number
  grayscale: boolean
}

const DEFAULT_ENHANCEMENT: ImageEnhancement = {
  brightness: 100,
  contrast: 100,
  rotation: 0,
  scale: 100,
  grayscale: false,
}

const MAX_CANVAS_PIXELS = 16_000_000
const MAX_CANVAS_DIMENSION = 4096
const HISTORY_PAGE_SIZE = 20
const QR_CARD_CLASS =
  "min-w-0 rounded-[var(--md-sys-shape-corner-large)] border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container-lowest)] shadow-sm"

async function yieldToMainThread(): Promise<void> {
  const scheduler = (globalThis as typeof globalThis & {
    scheduler?: { yield?: () => Promise<void> }
  }).scheduler

  if (scheduler?.yield) {
    await scheduler.yield()
    return
  }
  await new Promise<void>((resolve) => setTimeout(resolve, 0))
}

function loadImage(url: string, errorMessage: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error(errorMessage))
    image.src = url
  })
}

function getConstrainedCanvasGeometry(
  sourceWidth: number,
  sourceHeight: number,
  enhancement: ImageEnhancement,
) {
  const radians = (enhancement.rotation * Math.PI) / 180
  const cosine = Math.abs(Math.cos(radians))
  const sine = Math.abs(Math.sin(radians))
  let drawWidth = Math.max(1, sourceWidth * (enhancement.scale / 100))
  let drawHeight = Math.max(1, sourceHeight * (enhancement.scale / 100))

  const calculateBounds = () => ({
    width: Math.max(1, Math.ceil(drawWidth * cosine + drawHeight * sine)),
    height: Math.max(1, Math.ceil(drawWidth * sine + drawHeight * cosine)),
  })

  let bounds = calculateBounds()
  const constraint = Math.min(
    1,
    MAX_CANVAS_DIMENSION / bounds.width,
    MAX_CANVAS_DIMENSION / bounds.height,
    Math.sqrt(MAX_CANVAS_PIXELS / (bounds.width * bounds.height)),
  )
  drawWidth = Math.max(1, drawWidth * constraint)
  drawHeight = Math.max(1, drawHeight * constraint)
  bounds = calculateBounds()

  return {
    radians,
    drawWidth,
    drawHeight,
    canvasWidth: bounds.width,
    canvasHeight: bounds.height,
  }
}

function renderEnhancedImage(
  image: HTMLImageElement,
  enhancement: ImageEnhancement,
  contextError: string,
): ImageData {
  const canvas = document.createElement("canvas")
  const context = canvas.getContext("2d", { willReadFrequently: true })
  if (!context) throw new Error(contextError)

  const geometry = getConstrainedCanvasGeometry(
    image.naturalWidth,
    image.naturalHeight,
    enhancement,
  )
  canvas.width = geometry.canvasWidth
  canvas.height = geometry.canvasHeight
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = "high"
  context.filter = [
    `brightness(${enhancement.brightness}%)`,
    `contrast(${enhancement.contrast}%)`,
    enhancement.grayscale ? "grayscale(100%)" : "",
  ].filter(Boolean).join(" ")
  context.translate(canvas.width / 2, canvas.height / 2)
  context.rotate(geometry.radians)
  context.drawImage(
    image,
    -geometry.drawWidth / 2,
    -geometry.drawHeight / 2,
    geometry.drawWidth,
    geometry.drawHeight,
  )

  return context.getImageData(0, 0, canvas.width, canvas.height)
}

function detailText(details: Record<string, unknown>, key: string): string {
  const value = details[key]
  return value === undefined || value === null ? "" : String(value)
}

export default function QRCodeDecoder() {
  const t = useTranslations("qrcodeDecoder")
  const { locale } = useI18n()
  const { toast } = useToast()
  const isToolActive = useToolActivity()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const processingRunRef = useRef(0)

  const [activeTab, setActiveTab] = useState("upload")
  const [files, setFiles] = useState<File[]>([])
  const [selectedFileIndex, setSelectedFileIndex] = useState(0)
  const [isProcessing, setIsProcessing] = useState(false)
  const [processingProgress, setProcessingProgress] = useState(0)
  const [results, setResults] = useState<QRResult[]>([])
  const [history, setHistory] = useState<QRResult[]>([])
  const [historyLimit, setHistoryLimit] = useState(HISTORY_PAGE_SIZE)
  const [error, setError] = useState<string | null>(null)
  const [imageEnhancement, setImageEnhancement] = useState<ImageEnhancement>(DEFAULT_ENHANCEMENT)
  const [showEnhancement, setShowEnhancement] = useState(false)
  const [batchMode, setBatchMode] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const previewUrl = useObjectUrl(files[selectedFileIndex])

  useEffect(() => () => {
    processingRunRef.current += 1
  }, [])

  useEffect(() => {
    if (isToolActive) return
    processingRunRef.current += 1
    setIsProcessing(false)
    setProcessingProgress(0)
  }, [isToolActive])

  const decodeImageFile = useCallback(async (file: File, runId: number): Promise<QRResult | null> => {
    return withObjectUrl(file, async (url) => {
      const image = await loadImage(url, t("imageLoadError"))
      const strategies = [
        imageEnhancement,
        { ...imageEnhancement, contrast: 150, brightness: 120, grayscale: true },
        DEFAULT_ENHANCEMENT,
        { ...DEFAULT_ENHANCEMENT, brightness: 110, contrast: 180, scale: 150, grayscale: true },
      ].filter((strategy, index, list) =>
        list.findIndex((candidate) => JSON.stringify(candidate) === JSON.stringify(strategy)) === index,
      )

      for (const strategy of strategies) {
        if (runId !== processingRunRef.current) return null
        await yieldToMainThread()
        const imageData = renderEnhancedImage(image, strategy, t("canvasContextError"))
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: "attemptBoth",
        })
        if (!code?.data) continue

        const parsed = parseQRContent(code.data)
        return {
          id: createClientId("qr"),
          data: code.data,
          timestamp: Date.now(),
          type: parsed.type,
          details: parsed.details,
          fileName: file.name,
        }
      }

      return null
    })
  }, [imageEnhancement, t])

  const processFiles = useCallback(async (
    targetFiles: File[],
    processAll: boolean,
    fileIndex = 0,
  ) => {
    const selectedFiles = processAll
      ? targetFiles
      : targetFiles[fileIndex]
        ? [targetFiles[fileIndex]]
        : []
    if (selectedFiles.length === 0) return

    const runId = ++processingRunRef.current
    setIsProcessing(true)
    setProcessingProgress(0)
    setResults([])
    setError(null)

    const decoded: QRResult[] = []
    let failedFiles = 0

    try {
      for (let index = 0; index < selectedFiles.length; index += 1) {
        if (runId !== processingRunRef.current) return
        try {
          const result = await decodeImageFile(selectedFiles[index], runId)
          if (result) decoded.push(result)
        } catch (processError) {
          failedFiles += 1
          console.error("QR image processing failed:", processError)
        }
        if (runId !== processingRunRef.current) return
        setProcessingProgress(((index + 1) / selectedFiles.length) * 100)
      }

      if (runId !== processingRunRef.current) return
      setResults(decoded)
      if (decoded.length > 0) {
        setHistory((previous) => [...decoded, ...previous].slice(0, 100))
        toast({
          title: t(processAll ? "batchComplete" : "decodeSuccess"),
          description: `${t("decodedCountPrefix")} ${decoded.length} ${t("decodedCountSuffix")}`,
        })
      } else {
        setError(failedFiles > 0 ? t("imageProcessingError") : t("noQrCodeFound"))
      }
    } finally {
      if (runId === processingRunRef.current) {
        setIsProcessing(false)
        setProcessingProgress(0)
      }
    }
  }, [decodeImageFile, t, toast])

  const cancelProcessing = useCallback(() => {
    processingRunRef.current += 1
    setIsProcessing(false)
    setProcessingProgress(0)
  }, [])

  const validateAndProcessFiles = useCallback((incomingFiles: File[]) => {
    const imageFiles = incomingFiles.filter((file) => file.type.startsWith("image/"))
    if (imageFiles.length === 0) {
      toast({
        title: t("invalidFile"),
        description: t("notAnImage"),
        variant: "destructive",
      })
      return
    }

    const validFiles = imageFiles.filter((file) => {
      if (isFileWithinLimit(file, FILE_SIZE_LIMITS.qrDecodeImage)) return true
      toast({
        title: t("fileTooLarge"),
        description: `${file.name}: ${t("maximum")} ${formatFileSizeLimit(FILE_SIZE_LIMITS.qrDecodeImage)}`,
        variant: "destructive",
      })
      return false
    })
    if (validFiles.length === 0) return

    setFiles(validFiles)
    setSelectedFileIndex(0)
    setResults([])
    setError(null)
    void processFiles(validFiles, batchMode, 0)
  }, [batchMode, processFiles, t, toast])

  const openFilePicker = useCallback(() => {
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
      fileInputRef.current.click()
    }
  }, [])

  const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDragging(false)
    validateAndProcessFiles(Array.from(event.dataTransfer.files))
  }, [validateAndProcessFiles])

  const handlePaste = useCallback((event: React.ClipboardEvent<HTMLDivElement>) => {
    const pastedFiles = Array.from(event.clipboardData.files)
    if (pastedFiles.length === 0) return
    event.preventDefault()
    validateAndProcessFiles(pastedFiles)
  }, [validateAndProcessFiles])

  const pasteFromClipboard = useCallback(async () => {
    try {
      if (!navigator.clipboard?.read) throw new Error("Clipboard read is unavailable")
      const clipboardItems = await navigator.clipboard.read()
      const pastedFiles: File[] = []
      for (const item of clipboardItems) {
        const imageType = item.types.find((type) => type.startsWith("image/"))
        if (!imageType) continue
        const blob = await item.getType(imageType)
        const extension = imageType.split("/")[1]?.replace("jpeg", "jpg") || "png"
        pastedFiles.push(new File([blob], `clipboard-${Date.now()}.${extension}`, { type: imageType }))
      }
      if (pastedFiles.length === 0) throw new Error("No image in clipboard")
      validateAndProcessFiles(pastedFiles)
    } catch {
      toast({
        title: t("clipboardReadFailed"),
        description: t("clipboardReadHint"),
        variant: "destructive",
      })
    }
  }, [t, toast, validateAndProcessFiles])

  const clearCurrentFiles = useCallback(() => {
    cancelProcessing()
    setFiles([])
    setSelectedFileIndex(0)
    setResults([])
    setError(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }, [cancelProcessing])

  const selectFile = useCallback((index: number) => {
    setSelectedFileIndex(index)
    if (!batchMode) void processFiles(files, false, index)
  }, [batchMode, files, processFiles])

  const updateBatchMode = useCallback((enabled: boolean) => {
    setBatchMode(enabled)
    if (files.length > 0) void processFiles(files, enabled, selectedFileIndex)
  }, [files, processFiles, selectedFileIndex])

  const copyValue = useCallback(async (value: string) => {
    const success = await copyTextToClipboard(value)
    toast({
      title: success ? t("copied") : t("copyFailed"),
      description: success ? t("copiedDescription") : undefined,
      variant: success ? "default" : "destructive",
    })
  }, [t, toast])

  const exportHistory = useCallback(() => {
    if (history.length === 0) {
      toast({
        title: t("noData"),
        description: t("noHistoryToExport"),
        variant: "destructive",
      })
      return
    }

    const rows = [
      ["Timestamp", "Type", "Data", "Details"].map(csvCell).join(","),
      ...history.map((record) => [
        new Date(record.timestamp).toISOString(),
        record.type,
        record.data,
        record.details,
      ].map(csvCell).join(",")),
    ]
    downloadBlob(
      new Blob(["\uFEFF", rows.join("\r\n")], { type: "text/csv;charset=utf-8" }),
      `qr_decode_history_${new Date().toISOString().slice(0, 10)}.csv`,
    )
    toast({ title: t("exportComplete"), description: t("exportDescription") })
  }, [history, t, toast])

  const openExternal = useCallback((url: string) => {
    window.open(url, "_blank", "noopener,noreferrer")
  }, [])

  const renderContentDetails = useCallback((result: QRResult) => {
    const { type, details } = result
    const typeTitle = t(`type${type[0].toUpperCase()}${type.slice(1)}`)

    if (type === "url") {
      const url = detailText(details, "url")
      return (
        <div className="space-y-2">
          <div className="flex items-center gap-2 font-medium">
            <ExternalLink className="h-4 w-4" />
            {typeTitle}
          </div>
          <Button type="button" className="w-full rounded-full" onClick={() => openExternal(url)}>
            {t("openUrl")}
          </Button>
        </div>
      )
    }

    if (type === "wifi") {
      return (
        <div className="space-y-3">
          <div className="flex items-center gap-2 font-medium">
            <Wifi className="h-4 w-4" />
            {typeTitle}
          </div>
          <dl className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-2 text-sm">
            <dt className="text-[var(--md-sys-color-on-surface-variant)]">{t("networkName")}</dt>
            <dd className="min-w-0 break-all font-mono">{detailText(details, "ssid") || t("notProvided")}</dd>
            <dt className="text-[var(--md-sys-color-on-surface-variant)]">{t("encryptionType")}</dt>
            <dd>{detailText(details, "type") || "WPA"}</dd>
            <dt className="text-[var(--md-sys-color-on-surface-variant)]">{t("password")}</dt>
            <dd className="min-w-0 break-all font-mono">{detailText(details, "password") || t("notProvided")}</dd>
            <dt className="text-[var(--md-sys-color-on-surface-variant)]">{t("hiddenNetwork")}</dt>
            <dd>{details.hidden ? t("yes") : t("no")}</dd>
          </dl>
        </div>
      )
    }

    if (type === "phone") {
      const phone = detailText(details, "phone")
      return (
        <div className="space-y-2">
          <div className="flex items-center gap-2 font-medium"><Phone className="h-4 w-4" />{typeTitle}</div>
          <Button type="button" className="w-full rounded-full" onClick={() => { window.location.href = `tel:${phone}` }}>
            {t("callPhone")}
          </Button>
        </div>
      )
    }

    if (type === "email") {
      const email = detailText(details, "email")
      return (
        <div className="space-y-2">
          <div className="flex items-center gap-2 font-medium"><Mail className="h-4 w-4" />{typeTitle}</div>
          <Button type="button" className="w-full rounded-full" onClick={() => { window.location.href = `mailto:${email}` }}>
            {t("sendEmail")}
          </Button>
        </div>
      )
    }

    if (type === "location") {
      const url = detailText(details, "url")
      return (
        <div className="space-y-3">
          <div className="flex items-center gap-2 font-medium"><MapPin className="h-4 w-4" />{typeTitle}</div>
          <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-2 text-sm">
            <dt className="text-[var(--md-sys-color-on-surface-variant)]">{t("latitude")}</dt>
            <dd className="font-mono">{detailText(details, "latitude")}</dd>
            <dt className="text-[var(--md-sys-color-on-surface-variant)]">{t("longitude")}</dt>
            <dd className="font-mono">{detailText(details, "longitude")}</dd>
          </dl>
          <Button type="button" className="w-full rounded-full" onClick={() => openExternal(url)}>
            {t("viewOnMap")}
          </Button>
        </div>
      )
    }

    if (type === "vcard") {
      const fields = [
        ["fn", t("name")],
        ["org", t("organization")],
        ["tel", t("phone")],
        ["email", t("email")],
        ["url", t("website")],
      ] as const
      return (
        <div className="space-y-3">
          <div className="flex items-center gap-2 font-medium"><User className="h-4 w-4" />{typeTitle}</div>
          <dl className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-2 text-sm">
            {fields.map(([key, label]) => detailText(details, key) ? (
              <div key={key} className="contents">
                <dt className="text-[var(--md-sys-color-on-surface-variant)]">{label}</dt>
                <dd className="min-w-0 break-all">{detailText(details, key)}</dd>
              </div>
            ) : null)}
          </dl>
        </div>
      )
    }

    if (type === "json") {
      return (
        <div className="min-w-0 space-y-3">
          <div className="flex items-center gap-2 font-medium"><FileText className="h-4 w-4" />{typeTitle}</div>
          <div className="max-h-[28rem] min-w-0 touch-pan-y overflow-auto overscroll-contain [-webkit-overflow-scrolling:touch]">
            <JsonTreeView jsonText={JSON.stringify(details.value, null, 2)} indentSize={2} />
          </div>
        </div>
      )
    }

    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 font-medium"><FileText className="h-4 w-4" />{typeTitle}</div>
        <p className="text-sm text-[var(--md-sys-color-on-surface-variant)]">
          {t("textLength")} {result.data.length} {t("characters")}
        </p>
      </div>
    )
  }, [openExternal, t])

  const renderResultCard = useCallback((result: QRResult) => (
    <article
      key={result.id}
      className="min-w-0 space-y-4 rounded-2xl border border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container-low)] p-4"
    >
      <div className="flex min-w-0 items-start justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Badge variant="secondary">{t(`type${result.type[0].toUpperCase()}${result.type.slice(1)}`)}</Badge>
          <span className="text-xs text-[var(--md-sys-color-on-surface-variant)]">
            {new Date(result.timestamp).toLocaleTimeString(locale)}
          </span>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-10 w-10 shrink-0 rounded-full"
          aria-label={t("copyResultAria")}
          onClick={() => void copyValue(result.data)}
        >
          <Copy className="h-4 w-4" />
        </Button>
      </div>

      {renderContentDetails(result)}

      <div className="min-w-0 border-t border-[var(--md-sys-color-outline-variant)] pt-3">
        <Label className="text-sm font-medium text-[var(--md-sys-color-on-surface-variant)]">{t("rawData")}</Label>
        <Textarea value={result.data} readOnly rows={4} className="mt-2 min-w-0 resize-y font-mono text-xs" />
      </div>
      {result.fileName && (
        <p className="break-all text-xs text-[var(--md-sys-color-on-surface-variant)]">
          {t("source")} {result.fileName}
        </p>
      )}
    </article>
  ), [copyValue, locale, renderContentDetails, t])

  return (
    <div className="container mx-auto max-w-6xl overflow-x-clip px-3 py-4 sm:px-4 sm:py-6">
      <header className="mb-5 flex items-center gap-3 sm:mb-7 sm:justify-center">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--md-sys-color-primary-container)] text-[var(--md-sys-color-on-primary-container)]">
          <ScanLine className="h-6 w-6" />
        </span>
        <div className="min-w-0 sm:text-center">
          <h1 className="text-xl font-bold tracking-tight text-[var(--md-sys-color-on-surface)] sm:text-3xl">
            {t("title")}
          </h1>
          <p className="mt-0.5 text-xs leading-5 text-[var(--md-sys-color-on-surface-variant)] sm:text-sm">
            {t("description")}
          </p>
        </div>
      </header>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="min-w-0">
        <TabsList className="mb-5 grid h-auto w-full grid-cols-2 rounded-2xl border border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container-low)] p-1">
          <TabsTrigger value="upload" className="min-h-11 rounded-xl data-[state=active]:bg-[var(--md-sys-color-secondary-container)]">
            <Upload className="mr-2 h-4 w-4" />
            {t("uploadTab")}
          </TabsTrigger>
          <TabsTrigger value="history" className="min-h-11 rounded-xl data-[state=active]:bg-[var(--md-sys-color-secondary-container)]">
            <History className="mr-2 h-4 w-4" />
            {t("historyTab")} ({history.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="min-w-0 space-y-4">
          <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-6">
            <section className="contents lg:order-1 lg:col-span-2 lg:block">
              <Card className={`order-1 ${QR_CARD_CLASS}`}>
                <CardHeader className="pb-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <ImageIcon className="h-5 w-5 text-[var(--md-sys-color-primary)]" />
                      {t("uploadImage")}
                    </CardTitle>
                    <div className="flex items-center justify-between gap-3 rounded-full bg-[var(--md-sys-color-surface-container)] px-3 py-2 sm:justify-start">
                      <Label htmlFor="batch-mode" className="cursor-pointer text-sm">{t("batchMode")}</Label>
                      <Switch id="batch-mode" checked={batchMode} onCheckedChange={updateBatchMode} />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple={batchMode}
                    aria-label={t("chooseImages")}
                    onChange={(event) => validateAndProcessFiles(Array.from(event.target.files ?? []))}
                    className="hidden"
                  />
                  <div
                    role="button"
                    tabIndex={0}
                    aria-label={t("dropzoneAria")}
                    onClick={openFilePicker}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault()
                        openFilePicker()
                      }
                    }}
                    onPaste={handlePaste}
                    onDragEnter={() => setIsDragging(true)}
                    onDragLeave={() => setIsDragging(false)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={handleDrop}
                    className={`cursor-pointer rounded-2xl border-2 border-dashed p-5 text-center outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--md-sys-color-primary)] sm:p-8 ${
                      isDragging
                        ? "border-[var(--md-sys-color-primary)] bg-[var(--md-sys-color-primary-container)]/45"
                        : files.length > 0
                          ? "border-[var(--md-sys-color-primary)]/50 bg-[var(--md-sys-color-primary-container)]/25"
                          : "border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container-low)]"
                    }`}
                  >
                    <Upload className="mx-auto mb-3 h-10 w-10 text-[var(--md-sys-color-primary)]" />
                    <p className="font-medium text-[var(--md-sys-color-on-surface)]">{t("dropImageHere")}</p>
                    <p className="mt-1 text-xs leading-5 text-[var(--md-sys-color-on-surface-variant)]">
                      {t("supportedFormats")} · {t("maximum")} {formatFileSizeLimit(FILE_SIZE_LIMITS.qrDecodeImage)}
                    </p>
                    <p className="mt-1 text-xs text-[var(--md-sys-color-on-surface-variant)]">{t("autoDecodeHint")}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <Button type="button" className="rounded-full" onClick={openFilePicker}>
                      <Upload className="mr-2 h-4 w-4" />
                      {t("chooseImages")}
                    </Button>
                    <Button type="button" variant="outline" className="rounded-full" onClick={() => void pasteFromClipboard()}>
                      <Copy className="mr-2 h-4 w-4" />
                      {t("pasteImage")}
                    </Button>
                  </div>

                  {files.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2 text-sm">
                          <CheckCircle2 className="h-4 w-4 text-[var(--md-sys-color-primary)]" />
                          <span>{t("selectedFilesPrefix")} {files.length} {t("selectedFilesSuffix")}</span>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="rounded-full"
                          onClick={clearCurrentFiles}
                        >
                          <Trash2 className="mr-1 h-4 w-4" />
                          {t("clear")}
                        </Button>
                      </div>

                      <div className="max-h-44 space-y-1 touch-pan-y overflow-y-auto overscroll-contain pr-1 [-webkit-overflow-scrolling:touch]">
                        {files.map((file, index) => (
                          <button
                            key={`${file.name}-${file.lastModified}-${index}`}
                            type="button"
                            onClick={() => selectFile(index)}
                            className={`flex min-h-11 w-full min-w-0 items-center gap-2 rounded-xl border px-3 py-2 text-left transition-colors ${
                              index === selectedFileIndex
                                ? "border-[var(--md-sys-color-primary)] bg-[var(--md-sys-color-primary-container)]/35"
                                : "border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container-low)]"
                            }`}
                          >
                            <ImageIcon className="h-4 w-4 shrink-0" />
                            <span className="min-w-0 flex-1 truncate text-sm">{file.name}</span>
                            <Badge variant="secondary" className="shrink-0 text-[10px]">
                              {(file.size / 1024).toFixed(1)} KB
                            </Badge>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {isProcessing && (
                    <div className="space-y-3 rounded-2xl bg-[var(--md-sys-color-surface-container-low)] p-3">
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="flex items-center gap-2 font-medium">
                          <RefreshCw className="h-4 w-4 animate-spin" />
                          {t("decoding")}
                        </span>
                        <Button type="button" variant="ghost" size="sm" className="rounded-full" onClick={cancelProcessing}>
                          <X className="mr-1 h-4 w-4" />
                          {t("cancel")}
                        </Button>
                      </div>
                      <Progress value={processingProgress} />
                      <p className="text-right text-xs text-[var(--md-sys-color-on-surface-variant)]">
                        {processingProgress.toFixed(0)}%
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className={`order-3 mt-4 ${QR_CARD_CLASS}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Settings className="h-5 w-5 text-[var(--md-sys-color-primary)]" />
                      {t("imageEnhancement")}
                    </CardTitle>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="rounded-full"
                      onClick={() => setShowEnhancement((visible) => !visible)}
                      aria-expanded={showEnhancement}
                    >
                      {showEnhancement ? t("collapse") : t("expand")}
                    </Button>
                  </div>
                </CardHeader>
                {showEnhancement && (
                  <CardContent className="space-y-5">
                    <p className="rounded-xl bg-[var(--md-sys-color-secondary-container)] px-3 py-2 text-xs leading-5 text-[var(--md-sys-color-on-secondary-container)]">
                      {t("enhancementDescription")}
                    </p>
                    <div className="grid gap-5 sm:grid-cols-2">
                      {([
                        ["brightness", t("brightness"), 50, 200, 5, "%"],
                        ["contrast", t("contrast"), 50, 200, 5, "%"],
                        ["rotation", t("rotation"), -180, 180, 15, "°"],
                        ["scale", t("scale"), 50, 200, 5, "%"],
                      ] as const).map(([key, label, minimum, maximum, step, suffix]) => (
                        <div key={key} className="space-y-2">
                          <Label className="text-sm">{label}: {imageEnhancement[key]}{suffix}</Label>
                          <Slider
                            value={[imageEnhancement[key]]}
                            onValueChange={([value]) => setImageEnhancement((previous) => ({ ...previous, [key]: value }))}
                            min={minimum}
                            max={maximum}
                            step={step}
                          />
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center justify-between rounded-xl bg-[var(--md-sys-color-surface-container)] px-3 py-2">
                      <Label htmlFor="grayscale" className="cursor-pointer text-sm">{t("grayscale")}</Label>
                      <Switch
                        id="grayscale"
                        checked={imageEnhancement.grayscale}
                        onCheckedChange={(checked) => setImageEnhancement((previous) => ({ ...previous, grayscale: checked }))}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="rounded-full"
                        onClick={() => setImageEnhancement(DEFAULT_ENHANCEMENT)}
                      >
                        <RotateCcw className="mr-1 h-4 w-4" />
                        {t("resetSettings")}
                      </Button>
                      <Button
                        type="button"
                        className="rounded-full"
                        disabled={files.length === 0 || isProcessing}
                        onClick={() => void processFiles(files, batchMode, selectedFileIndex)}
                      >
                        <ScanLine className="mr-1 h-4 w-4" />
                        {t("decodeAgain")}
                      </Button>
                    </div>
                  </CardContent>
                )}
              </Card>
            </section>

            <section className="order-2 min-w-0 space-y-4 lg:col-span-1">
              {files[selectedFileIndex] && (
                <Card className={QR_CARD_CLASS}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">{t("filePreview")}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {previewUrl && (
                      <img
                        src={previewUrl}
                        alt={t("previewAlt")}
                        className="max-h-64 w-full rounded-xl border border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container-low)] object-contain"
                      />
                    )}
                    <div className="min-w-0 text-xs leading-5 text-[var(--md-sys-color-on-surface-variant)]">
                      <p className="break-all">{t("file")} {files[selectedFileIndex].name}</p>
                      <p>{t("size")} {(files[selectedFileIndex].size / 1024).toFixed(1)} KB</p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {error && (
                <Alert variant="destructive" className="rounded-2xl">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {results.length > 0 && (
                <Card className={QR_CARD_CLASS}>
                  <CardHeader className="pb-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <CardTitle className="text-lg">{t("decodedResult")} ({results.length})</CardTitle>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-fit rounded-full"
                        onClick={() => void copyValue(results.map((result) => result.data).join("\n"))}
                      >
                        <Copy className="mr-1 h-4 w-4" />
                        {t("copyAll")}
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {results.map(renderResultCard)}
                  </CardContent>
                </Card>
              )}
            </section>
          </div>
        </TabsContent>

        <TabsContent value="history" className="min-w-0">
          <Card className={QR_CARD_CLASS}>
            <CardHeader className="pb-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle>{t("historyTab")} ({history.length})</CardTitle>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-full"
                    onClick={exportHistory}
                    disabled={history.length === 0}
                  >
                    <Download className="mr-1 h-4 w-4" />
                    {t("exportCsv")}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-full"
                    onClick={() => setHistory([])}
                    disabled={history.length === 0}
                  >
                    <Trash2 className="mr-1 h-4 w-4" />
                    {t("clearHistory")}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {history.length === 0 ? (
                <div className="py-12 text-center text-[var(--md-sys-color-on-surface-variant)]">
                  <History className="mx-auto mb-4 h-12 w-12" />
                  <p className="font-medium">{t("noHistory")}</p>
                  <p className="mt-1 text-sm">{t("historyDescription")}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {history.slice(0, historyLimit).map((record) => (
                    <article
                      key={record.id}
                      className="min-w-0 rounded-2xl border border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container-low)] p-4"
                    >
                      <div className="mb-3 flex min-w-0 items-start justify-between gap-2">
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          <Badge variant="secondary">{t(`type${record.type[0].toUpperCase()}${record.type.slice(1)}`)}</Badge>
                          <span className="text-xs text-[var(--md-sys-color-on-surface-variant)]">
                            {new Date(record.timestamp).toLocaleString(locale)}
                          </span>
                        </div>
                        <div className="flex shrink-0">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-10 w-10 rounded-full"
                            aria-label={t("copyResultAria")}
                            onClick={() => void copyValue(record.data)}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-10 w-10 rounded-full"
                            aria-label={t("deleteHistoryAria")}
                            onClick={() => setHistory((previous) => previous.filter((item) => item.id !== record.id))}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <p className="break-all text-sm leading-6">
                        {record.data.length > 300 ? `${record.data.slice(0, 300)}…` : record.data}
                      </p>
                      {record.fileName && (
                        <p className="mt-2 break-all text-xs text-[var(--md-sys-color-on-surface-variant)]">
                          {t("source")} {record.fileName}
                        </p>
                      )}
                    </article>
                  ))}
                  {historyLimit < history.length && (
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full rounded-full"
                      onClick={() => setHistoryLimit((limit) => limit + HISTORY_PAGE_SIZE)}
                    >
                      {t("showMore")}
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
