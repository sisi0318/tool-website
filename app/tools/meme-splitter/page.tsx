"use client"

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
} from "react"
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Download,
  Eye,
  Grid3X3,
  Image as ImageIcon,
  Loader2,
  Package,
  RotateCcw,
  Scissors,
  Settings,
  Trash2,
  Upload,
  ZoomIn,
  ZoomOut,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { useToolActivity } from "@/components/tool-activity"
import { useObjectUrl } from "@/hooks/use-object-url"
import { useTranslations } from "@/hooks/use-translations"
import {
  FILE_SIZE_LIMITS,
  formatFileSizeLimit,
  isFileWithinLimit,
} from "@/lib/file-limits"
import {
  analyzeMemeGrid,
  createMemeGrid,
  getConstrainedImageSize,
  mapMemeBounds,
  safeMemeFileBase,
  type MemeBounds,
  type MemeGridCell,
} from "@/lib/meme-grid-tools"
import { downloadBlob } from "@/lib/object-url"

interface SplitResult {
  cells: MemeGridCell[]
  images: Blob[]
  gridLines: { horizontal: number[]; vertical: number[] }
}

type ProcessStep =
  | {
      kind: "bounds"
      image: Blob
      width: number
      height: number
      left: number
      top: number
      right: number
      bottom: number
    }
  | {
      kind: "grid"
      image: Blob
      rows: number
      cols: number
      ratio: number
    }

const ANALYSIS_MAX_DIMENSION = 1600
const ANALYSIS_MAX_PIXELS = 2_500_000
const PREVIEW_MAX_DIMENSION = 1400
const PREVIEW_MAX_PIXELS = 2_000_000
const CANCELLED_ERROR = "meme-processing-cancelled"
const CANVAS_ERROR = "meme-canvas-unavailable"
const ENCODING_ERROR = "meme-image-encoding-failed"
const M3_CARD_CLASS =
  "min-w-0 rounded-[var(--md-sys-shape-corner-large)] border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container-lowest)] shadow-sm"
const M3_ICON_CLASS = "text-[var(--md-sys-color-primary)]"

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error(ENCODING_ERROR))
    }, "image/png")
  })
}

async function yieldToMainThread(): Promise<void> {
  const scheduler = (
    globalThis as typeof globalThis & {
      scheduler?: { yield?: () => Promise<void> }
    }
  ).scheduler

  if (scheduler?.yield) {
    await scheduler.yield()
    return
  }

  await new Promise<void>((resolve) => setTimeout(resolve, 0))
}

function BlobPreview({
  blob,
  alt,
  className,
}: {
  blob: Blob
  alt: string
  className: string
}) {
  const url = useObjectUrl(blob)
  if (!url) return null
  return <img src={url} alt={alt} className={className} loading="lazy" />
}

export default function MemeSplitterPage() {
  const t = useTranslations("memeSplitter")
  const isToolActive = useToolActivity()
  const [sourceFile, setSourceFile] = useState<File | null>(null)
  const imageUrl = useObjectUrl(sourceFile)
  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isPackaging, setIsPackaging] = useState(false)
  const [progress, setProgress] = useState(0)
  const [splitResult, setSplitResult] = useState<SplitResult | null>(null)
  const [processSteps, setProcessSteps] = useState<ProcessStep[]>([])
  const [error, setError] = useState("")
  const [sensitivity, setSensitivity] = useState(50)
  const [showGrid, setShowGrid] = useState(true)
  const [showProcess, setShowProcess] = useState(false)
  const [autoDetect, setAutoDetect] = useState(true)
  const [manualRows, setManualRows] = useState(4)
  const [manualCols, setManualCols] = useState(6)
  const [detectedRows, setDetectedRows] = useState(4)
  const [detectedCols, setDetectedCols] = useState(6)
  const [contentBounds, setContentBounds] = useState<MemeBounds | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [zoom, setZoom] = useState(100)
  const [selectedCells, setSelectedCells] = useState<Set<number>>(new Set())

  const fileInputRef = useRef<HTMLInputElement>(null)
  const previewCanvasRef = useRef<HTMLCanvasElement>(null)
  const originalImageRef = useRef<HTMLImageElement | null>(null)
  const runIdRef = useRef(0)
  const packageIdRef = useRef(0)
  const activityRef = useRef(isToolActive)

  const fileName = sourceFile?.name ?? ""
  const previewSize = useMemo(
    () =>
      imageSize
        ? getConstrainedImageSize(
            imageSize.width,
            imageSize.height,
            PREVIEW_MAX_DIMENSION,
            PREVIEW_MAX_PIXELS,
          )
        : null,
    [imageSize],
  )

  const cancelProcessing = useCallback(() => {
    runIdRef.current += 1
    setIsProcessing(false)
  }, [])

  const ensureCurrentRun = useCallback((runId: number) => {
    if (runIdRef.current !== runId || !activityRef.current) {
      throw new Error(CANCELLED_ERROR)
    }
  }, [])

  const yieldForRun = useCallback(
    async (runId: number) => {
      await yieldToMainThread()
      ensureCurrentRun(runId)
    },
    [ensureCurrentRun],
  )

  useEffect(() => {
    activityRef.current = isToolActive
    if (!isToolActive) cancelProcessing()
  }, [cancelProcessing, isToolActive])

  useEffect(
    () => () => {
      runIdRef.current += 1
      packageIdRef.current += 1
    },
    [],
  )

  useEffect(() => {
    if (!imageUrl) {
      originalImageRef.current = null
      setImageSize(null)
      return
    }

    let cancelled = false
    const image = new Image()
    image.onload = () => {
      if (cancelled) return
      originalImageRef.current = image
      setImageSize({ width: image.naturalWidth, height: image.naturalHeight })
      setError("")
    }
    image.onerror = () => {
      if (cancelled) return
      originalImageRef.current = null
      setImageSize(null)
      setError(t("loadFailed"))
    }
    image.src = imageUrl

    return () => {
      cancelled = true
      image.src = ""
    }
  }, [imageUrl, t])

  const resetResults = useCallback(() => {
    cancelProcessing()
    packageIdRef.current += 1
    setIsPackaging(false)
    setSplitResult(null)
    setProcessSteps([])
    setSelectedCells(new Set())
    setContentBounds(null)
    setProgress(0)
  }, [cancelProcessing])

  const handleFileUpload = useCallback(
    (file: File) => {
      if (!file.type.startsWith("image/")) {
        setError(t("invalidImage"))
        return
      }
      if (!isFileWithinLimit(file, FILE_SIZE_LIMITS.memeImage)) {
        setError(
          t("imageTooLarge").replace(
            "{size}",
            formatFileSizeLimit(FILE_SIZE_LIMITS.memeImage),
          ),
        )
        return
      }

      resetResults()
      setImageSize(null)
      originalImageRef.current = null
      setSourceFile(file)
      setZoom(100)
      setError("")
    },
    [resetResults, t],
  )

  const handleDrop = useCallback(
    (event: DragEvent<HTMLElement>) => {
      event.preventDefault()
      setIsDragging(false)
      const file = event.dataTransfer.files[0]
      if (file) handleFileUpload(file)
    },
    [handleFileUpload],
  )

  const clearImage = useCallback(() => {
    resetResults()
    setSourceFile(null)
    setImageSize(null)
    setError("")
    originalImageRef.current = null
    if (fileInputRef.current) fileInputRef.current.value = ""
  }, [resetResults])

  const splitImageByGrid = useCallback(
    async (
      image: HTMLImageElement,
      bounds: MemeBounds,
      rows: number,
      cols: number,
      runId: number,
      progressStart = 70,
    ): Promise<SplitResult> => {
      const width = image.naturalWidth
      const height = image.naturalHeight
      const layout = createMemeGrid(bounds, rows, cols, width, height)
      const images: Blob[] = []

      for (let index = 0; index < layout.cells.length; index += 1) {
        ensureCurrentRun(runId)
        const cell = layout.cells[index]
        const canvas = document.createElement("canvas")
        canvas.width = cell.width
        canvas.height = cell.height
        const context = canvas.getContext("2d")
        if (!context) throw new Error(CANVAS_ERROR)
        context.drawImage(
          image,
          cell.x,
          cell.y,
          cell.width,
          cell.height,
          0,
          0,
          cell.width,
          cell.height,
        )
        images.push(await canvasToBlob(canvas))

        setProgress(
          progressStart +
            Math.round(((index + 1) / layout.cells.length) * (100 - progressStart)),
        )
        if ((index + 1) % 3 === 0) await yieldForRun(runId)
      }

      return {
        cells: layout.cells,
        images,
        gridLines: {
          horizontal: layout.horizontal,
          vertical: layout.vertical,
        },
      }
    },
    [ensureCurrentRun, yieldForRun],
  )

  const createDiagnostic = useCallback(
    async (
      source: HTMLCanvasElement,
      bounds: MemeBounds,
      rows: number,
      cols: number,
      includeGrid: boolean,
    ) => {
      const canvas = document.createElement("canvas")
      canvas.width = source.width
      canvas.height = source.height
      const context = canvas.getContext("2d")
      if (!context) throw new Error(CANVAS_ERROR)
      context.drawImage(source, 0, 0)

      const rootStyles = getComputedStyle(document.documentElement)
      const primary =
        rootStyles.getPropertyValue("--md-sys-color-primary").trim() || "CanvasText"
      const tertiary =
        rootStyles.getPropertyValue("--md-sys-color-tertiary").trim() || "Highlight"
      context.lineWidth = Math.max(2, Math.round(Math.min(canvas.width, canvas.height) / 500))
      context.strokeStyle = primary
      context.setLineDash([8, 6])
      context.strokeRect(bounds.left, bounds.top, bounds.width, bounds.height)
      context.setLineDash([])

      if (includeGrid) {
        const layout = createMemeGrid(bounds, rows, cols, canvas.width, canvas.height)
        context.strokeStyle = tertiary
        for (const y of layout.horizontal) {
          context.beginPath()
          context.moveTo(layout.vertical[0], y)
          context.lineTo(layout.vertical.at(-1) ?? canvas.width, y)
          context.stroke()
        }
        for (const x of layout.vertical) {
          context.beginPath()
          context.moveTo(x, layout.horizontal[0])
          context.lineTo(x, layout.horizontal.at(-1) ?? canvas.height)
          context.stroke()
        }
      }

      return canvasToBlob(canvas)
    },
    [],
  )

  const detectAndSplit = useCallback(
    async (image: HTMLImageElement, runId: number): Promise<SplitResult> => {
      ensureCurrentRun(runId)
      const originalWidth = image.naturalWidth
      const originalHeight = image.naturalHeight
      const analysisSize = getConstrainedImageSize(
        originalWidth,
        originalHeight,
        ANALYSIS_MAX_DIMENSION,
        ANALYSIS_MAX_PIXELS,
      )
      const analysisCanvas = document.createElement("canvas")
      analysisCanvas.width = analysisSize.width
      analysisCanvas.height = analysisSize.height
      const context = analysisCanvas.getContext("2d", { willReadFrequently: true })
      if (!context) throw new Error(CANVAS_ERROR)
      context.imageSmoothingEnabled = true
      context.imageSmoothingQuality = "high"
      context.drawImage(image, 0, 0, analysisSize.width, analysisSize.height)
      setProgress(12)
      await yieldForRun(runId)

      const imageData = context.getImageData(0, 0, analysisSize.width, analysisSize.height)
      const detection = analyzeMemeGrid(imageData, sensitivity)
      ensureCurrentRun(runId)
      setProgress(48)

      const originalBounds = mapMemeBounds(
        detection.bounds,
        analysisSize.width,
        analysisSize.height,
        originalWidth,
        originalHeight,
      )
      setDetectedRows(detection.rows)
      setDetectedCols(detection.cols)
      setContentBounds(originalBounds)

      const steps: ProcessStep[] = []
      if (showProcess) {
        steps.push({
          kind: "bounds",
          image: await createDiagnostic(
            analysisCanvas,
            detection.bounds,
            detection.rows,
            detection.cols,
            false,
          ),
          width: originalBounds.width,
          height: originalBounds.height,
          left: originalBounds.left,
          top: originalBounds.top,
          right: originalWidth - originalBounds.left - originalBounds.width,
          bottom: originalHeight - originalBounds.top - originalBounds.height,
        })
        await yieldForRun(runId)
        steps.push({
          kind: "grid",
          image: await createDiagnostic(
            analysisCanvas,
            detection.bounds,
            detection.rows,
            detection.cols,
            true,
          ),
          rows: detection.rows,
          cols: detection.cols,
          ratio:
            originalBounds.width /
            detection.cols /
            (originalBounds.height / detection.rows),
        })
      }

      ensureCurrentRun(runId)
      setProcessSteps(steps)
      setProgress(70)
      return splitImageByGrid(
        image,
        originalBounds,
        detection.rows,
        detection.cols,
        runId,
      )
    },
    [
      createDiagnostic,
      ensureCurrentRun,
      sensitivity,
      showProcess,
      splitImageByGrid,
      yieldForRun,
    ],
  )

  const errorMessage = useCallback(
    (caught: unknown) => {
      const code = caught instanceof Error ? caught.message : ""
      if (code === CANVAS_ERROR) return t("canvasUnavailable")
      if (code === ENCODING_ERROR) return t("encodingFailed")
      return t("splitFailed")
    },
    [t],
  )

  const runSplit = useCallback(
    async (
      operation: (
        image: HTMLImageElement,
        runId: number,
      ) => Promise<SplitResult>,
    ) => {
      const image = originalImageRef.current
      if (!image || !activityRef.current) return
      const runId = ++runIdRef.current
      setIsProcessing(true)
      setProgress(0)
      setError("")

      try {
        const result = await operation(image, runId)
        ensureCurrentRun(runId)
        setSplitResult(result)
        setSelectedCells(new Set(result.cells.map((cell) => cell.index)))
      } catch (caught) {
        if (caught instanceof Error && caught.message === CANCELLED_ERROR) return
        if (runIdRef.current === runId) setError(errorMessage(caught))
      } finally {
        if (runIdRef.current === runId) setIsProcessing(false)
      }
    },
    [ensureCurrentRun, errorMessage],
  )

  const handleSplit = useCallback(() => {
    if (autoDetect) {
      void runSplit(detectAndSplit)
      return
    }

    void runSplit((image, runId) => {
      setContentBounds(null)
      setProcessSteps([])
      return splitImageByGrid(
        image,
        {
          left: 0,
          top: 0,
          width: image.naturalWidth,
          height: image.naturalHeight,
        },
        manualRows,
        manualCols,
        runId,
        5,
      )
    })
  }, [
    autoDetect,
    detectAndSplit,
    manualCols,
    manualRows,
    runSplit,
    splitImageByGrid,
  ])

  const resplitWithAdjustedGrid = useCallback(() => {
    if (!contentBounds) return
    void runSplit((image, runId) =>
      splitImageByGrid(
        image,
        contentBounds,
        detectedRows,
        detectedCols,
        runId,
        5,
      ),
    )
  }, [contentBounds, detectedCols, detectedRows, runSplit, splitImageByGrid])

  const downloadImage = useCallback(
    (image: Blob, index: number) => {
      downloadBlob(image, `${safeMemeFileBase(fileName)}_${index + 1}.png`)
    },
    [fileName],
  )

  const downloadSelected = useCallback(async () => {
    if (!splitResult || isPackaging) return
    const selected = Array.from(selectedCells)
      .filter((index) => index >= 0 && index < splitResult.images.length)
      .sort((left, right) => left - right)
    if (selected.length === 0) return
    if (selected.length === 1) {
      downloadImage(splitResult.images[selected[0]], selected[0])
      return
    }

    const packageId = ++packageIdRef.current
    setIsPackaging(true)
    setError("")
    try {
      const JSZip = (await import("jszip")).default
      const zip = new JSZip()
      const baseName = safeMemeFileBase(fileName)
      for (const index of selected) {
        zip.file(`${baseName}_${index + 1}.png`, splitResult.images[index])
      }
      const blob = await zip.generateAsync({ type: "blob" })
      if (packageIdRef.current !== packageId) return
      downloadBlob(blob, `${baseName}_slices.zip`)
    } catch {
      if (packageIdRef.current === packageId) setError(t("packageFailed"))
    } finally {
      if (packageIdRef.current === packageId) setIsPackaging(false)
    }
  }, [downloadImage, fileName, isPackaging, selectedCells, splitResult, t])

  const toggleCellSelection = useCallback((index: number) => {
    setSelectedCells((previous) => {
      const next = new Set(previous)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }, [])

  const toggleSelectAll = useCallback(() => {
    if (!splitResult) return
    setSelectedCells((previous) =>
      previous.size === splitResult.cells.length
        ? new Set()
        : new Set(splitResult.cells.map((cell) => cell.index)),
    )
  }, [splitResult])

  useEffect(() => {
    const image = originalImageRef.current
    const canvas = previewCanvasRef.current
    if (!image || !imageSize || !previewSize || !canvas) return
    const context = canvas.getContext("2d")
    if (!context) return

    canvas.width = previewSize.width
    canvas.height = previewSize.height
    context.clearRect(0, 0, canvas.width, canvas.height)
    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = "high"
    context.drawImage(image, 0, 0, canvas.width, canvas.height)

    if (!showGrid || !splitResult) return
    const scaleX = canvas.width / image.naturalWidth
    const scaleY = canvas.height / image.naturalHeight
    const styles = getComputedStyle(canvas)
    const primary =
      styles.getPropertyValue("--md-sys-color-primary").trim() || "CanvasText"
    const primaryContainer =
      styles.getPropertyValue("--md-sys-color-primary-container").trim() ||
      "Highlight"
    const left = (splitResult.gridLines.vertical[0] ?? 0) * scaleX
    const right =
      (splitResult.gridLines.vertical.at(-1) ?? image.naturalWidth) * scaleX
    const top = (splitResult.gridLines.horizontal[0] ?? 0) * scaleY
    const bottom =
      (splitResult.gridLines.horizontal.at(-1) ?? image.naturalHeight) * scaleY

    context.strokeStyle = primary
    context.lineWidth = 2
    for (const y of splitResult.gridLines.horizontal) {
      context.beginPath()
      context.moveTo(left, y * scaleY)
      context.lineTo(right, y * scaleY)
      context.stroke()
    }
    for (const x of splitResult.gridLines.vertical) {
      context.beginPath()
      context.moveTo(x * scaleX, top)
      context.lineTo(x * scaleX, bottom)
      context.stroke()
    }

    context.save()
    context.globalAlpha = 0.28
    context.fillStyle = primaryContainer
    for (const cell of splitResult.cells) {
      if (!selectedCells.has(cell.index)) continue
      context.fillRect(
        cell.x * scaleX,
        cell.y * scaleY,
        cell.width * scaleX,
        cell.height * scaleY,
      )
    }
    context.restore()
  }, [imageSize, previewSize, selectedCells, showGrid, splitResult])

  const renderStepDescription = (step: ProcessStep) => {
    if (step.kind === "bounds") {
      return t("boundsDescription")
        .replace("{width}", String(step.width))
        .replace("{height}", String(step.height))
        .replace("{left}", String(step.left))
        .replace("{top}", String(step.top))
        .replace("{right}", String(step.right))
        .replace("{bottom}", String(step.bottom))
    }
    return t("gridDescription")
      .replace("{rows}", String(step.rows))
      .replace("{cols}", String(step.cols))
      .replace("{ratio}", step.ratio.toFixed(2))
  }

  return (
    <div className="container mx-auto max-w-7xl px-3 py-4 sm:px-4">
      <header className="mb-6 text-center">
        <div className="mb-2 flex items-center justify-center gap-2">
          <Grid3X3 className={`h-8 w-8 ${M3_ICON_CLASS}`} aria-hidden="true" />
          <h1 className="text-2xl font-bold text-[var(--md-sys-color-on-surface)] sm:text-3xl">
            {t("title")}
          </h1>
        </div>
        <p className="text-sm text-[var(--md-sys-color-on-surface-variant)] sm:text-base">
          {t("description")}
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4 lg:gap-6">
        <aside className="contents lg:col-span-1 lg:block lg:space-y-4">
          <Card className={`order-1 ${M3_CARD_CLASS}`}>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Upload className={`h-4 w-4 ${M3_ICON_CLASS}`} aria-hidden="true" />
                {t("uploadImage")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) handleFileUpload(file)
                }}
                className="hidden"
              />
              <button
                type="button"
                aria-label={t("dropzoneAria")}
                onClick={() => fileInputRef.current?.click()}
                onDrop={handleDrop}
                onDragOver={(event) => {
                  event.preventDefault()
                  setIsDragging(true)
                }}
                onDragLeave={() => setIsDragging(false)}
                className={`w-full rounded-[var(--md-sys-shape-corner-large)] border-2 border-dashed p-5 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--md-sys-color-primary)] ${
                  isDragging
                    ? "border-[var(--md-sys-color-primary)] bg-[var(--md-sys-color-primary-container)]"
                    : "border-[var(--md-sys-color-outline)] bg-[var(--md-sys-color-surface-container-low)] hover:border-[var(--md-sys-color-primary)]"
                }`}
              >
                <Upload
                  className="mx-auto mb-2 h-8 w-8 text-[var(--md-sys-color-on-surface-variant)]"
                  aria-hidden="true"
                />
                <span className="block text-sm text-[var(--md-sys-color-on-surface)]">
                  {t("dropzone")}
                </span>
                <span className="mt-1 block text-xs text-[var(--md-sys-color-on-surface-variant)]">
                  {t("maximum")} {formatFileSizeLimit(FILE_SIZE_LIMITS.memeImage)}
                </span>
              </button>

              {imageSize && (
                <div className="mt-3 space-y-2">
                  <p
                    className="break-all text-sm font-medium text-[var(--md-sys-color-on-surface)]"
                    title={fileName}
                  >
                    {fileName}
                  </p>
                  <p className="text-xs text-[var(--md-sys-color-on-surface-variant)]">
                    {imageSize.width} × {imageSize.height} {t("pixels")}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={clearImage}
                    className="w-full"
                  >
                    <Trash2 className="mr-1 h-4 w-4" aria-hidden="true" />
                    {t("clear")}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className={`order-3 mt-4 lg:mt-0 ${M3_CARD_CLASS}`}>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Settings className={`h-4 w-4 ${M3_ICON_CLASS}`} aria-hidden="true" />
                {t("splitSettings")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Label htmlFor="auto-detect">{t("smartDetection")}</Label>
                  <p className="mt-1 text-xs text-[var(--md-sys-color-on-surface-variant)]">
                    {autoDetect ? t("autoHint") : t("manualHint")}
                  </p>
                </div>
                <Switch
                  id="auto-detect"
                  checked={autoDetect}
                  onCheckedChange={setAutoDetect}
                />
              </div>

              {autoDetect ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="meme-sensitivity">
                      {t("sensitivity").replace("{value}", String(sensitivity))}
                    </Label>
                    <Slider
                      id="meme-sensitivity"
                      value={[sensitivity]}
                      onValueChange={([value]) => setSensitivity(value)}
                      min={10}
                      max={90}
                      step={5}
                    />
                  </div>

                  {splitResult && contentBounds && (
                    <div className="space-y-4 rounded-[var(--md-sys-shape-corner-medium)] bg-[var(--md-sys-color-primary-container)] p-3 text-[var(--md-sys-color-on-primary-container)]">
                      <div>
                        <p className="text-sm font-medium">{t("detectedGrid")}</p>
                        <p className="mt-1 text-xs opacity-80">{t("gridAdjustHint")}</p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="detected-rows">
                          {t("rowsCount").replace("{value}", String(detectedRows))}
                        </Label>
                        <Slider
                          id="detected-rows"
                          value={[detectedRows]}
                          onValueChange={([value]) => setDetectedRows(value)}
                          min={1}
                          max={8}
                          step={1}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="detected-cols">
                          {t("colsCount").replace("{value}", String(detectedCols))}
                        </Label>
                        <Slider
                          id="detected-cols"
                          value={[detectedCols]}
                          onValueChange={([value]) => setDetectedCols(value)}
                          min={1}
                          max={10}
                          step={1}
                        />
                      </div>
                      <Button
                        onClick={resplitWithAdjustedGrid}
                        variant="secondary"
                        size="sm"
                        className="w-full"
                        disabled={isProcessing}
                      >
                        {t("applyAdjustment")}
                      </Button>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="manual-rows">
                      {t("rowsCount").replace("{value}", String(manualRows))}
                    </Label>
                    <Slider
                      id="manual-rows"
                      value={[manualRows]}
                      onValueChange={([value]) => setManualRows(value)}
                      min={1}
                      max={10}
                      step={1}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="manual-cols">
                      {t("colsCount").replace("{value}", String(manualCols))}
                    </Label>
                    <Slider
                      id="manual-cols"
                      value={[manualCols]}
                      onValueChange={([value]) => setManualCols(value)}
                      min={1}
                      max={10}
                      step={1}
                    />
                  </div>
                </>
              )}

              <Button
                onClick={handleSplit}
                disabled={!imageSize || isProcessing}
                className="min-h-11 w-full"
              >
                {isProcessing ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Scissors className="mr-2 h-4 w-4" aria-hidden="true" />
                )}
                {isProcessing ? t("processing") : t("startSplit")}
              </Button>

              {isProcessing && (
                <div className="space-y-1" aria-live="polite">
                  <Progress value={progress} className="w-full" />
                  <p className="text-right text-xs text-[var(--md-sys-color-on-surface-variant)]">
                    {progress}%
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className={`order-4 mt-4 lg:mt-0 ${M3_CARD_CLASS}`}>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Eye className={`h-4 w-4 ${M3_ICON_CLASS}`} aria-hidden="true" />
                {t("displaySettings")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="show-grid">{t("showGrid")}</Label>
                <Switch
                  id="show-grid"
                  checked={showGrid}
                  onCheckedChange={setShowGrid}
                />
              </div>
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="show-process">{t("showProcess")}</Label>
                <Switch
                  id="show-process"
                  checked={showProcess}
                  onCheckedChange={setShowProcess}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("zoom").replace("{value}", String(zoom))}</Label>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label={t("zoomOut")}
                    onClick={() => setZoom((value) => Math.max(25, value - 25))}
                  >
                    <ZoomOut className="h-4 w-4" aria-hidden="true" />
                  </Button>
                  <Slider
                    value={[zoom]}
                    onValueChange={([value]) => setZoom(value)}
                    min={25}
                    max={200}
                    step={25}
                    className="min-w-0 flex-1"
                    aria-label={t("zoomControl")}
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label={t("zoomIn")}
                    onClick={() => setZoom((value) => Math.min(200, value + 25))}
                  >
                    <ZoomIn className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </aside>

        <main className="contents lg:col-span-3 lg:block lg:space-y-4">
          <Card className={`order-2 min-h-[360px] ${M3_CARD_CLASS}`}>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <ImageIcon className={`h-4 w-4 ${M3_ICON_CLASS}`} aria-hidden="true" />
                  {t("preview")}
                </CardTitle>
                {splitResult && (
                  <Badge
                    variant="secondary"
                    className="bg-[var(--md-sys-color-secondary-container)] text-[var(--md-sys-color-on-secondary-container)]"
                  >
                    {t("slicesCount").replace(
                      "{count}",
                      String(splitResult.cells.length),
                    )}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {!imageSize || !previewSize ? (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex min-h-[270px] w-full flex-col items-center justify-center rounded-[var(--md-sys-shape-corner-large)] bg-[var(--md-sys-color-surface-container-low)] px-4 text-[var(--md-sys-color-on-surface-variant)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--md-sys-color-primary)]"
                >
                  <ImageIcon className="mb-3 h-14 w-14" aria-hidden="true" />
                  <span className="font-medium">{t("uploadPrompt")}</span>
                  <span className="mt-1 text-sm">{t("uploadPromptHint")}</span>
                </button>
              ) : (
                <div
                  className="max-h-[min(62dvh,640px)] overflow-auto overscroll-contain rounded-[var(--md-sys-shape-corner-medium)] bg-[var(--md-sys-color-surface-container)] p-2 touch-pan-x touch-pan-y scrollbar-m3"
                  aria-label={t("previewScrollAria")}
                  tabIndex={0}
                  style={{ WebkitOverflowScrolling: "touch" }}
                >
                  <canvas
                    ref={previewCanvasRef}
                    className="mx-auto block rounded-[var(--md-sys-shape-corner-small)] border border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface)]"
                    style={{
                      width: `${Math.round(previewSize.width * (zoom / 100))}px`,
                      height: `${Math.round(previewSize.height * (zoom / 100))}px`,
                    }}
                  />
                </div>
              )}

              {error && (
                <div
                  className="mt-4 flex items-start gap-2 rounded-[var(--md-sys-shape-corner-medium)] bg-[var(--md-sys-color-error-container)] p-3 text-sm text-[var(--md-sys-color-on-error-container)]"
                  role="alert"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <span className="min-w-0 break-words">{error}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {showProcess && processSteps.length > 0 && (
            <Card className={`order-5 mt-4 lg:mt-0 ${M3_CARD_CLASS}`}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <RotateCcw className={`h-4 w-4 ${M3_ICON_CLASS}`} aria-hidden="true" />
                  {t("processTitle")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {processSteps.map((step) => {
                    const name =
                      step.kind === "bounds" ? t("boundsStep") : t("gridStep")
                    return (
                      <article
                        key={step.kind}
                        className="min-w-0 rounded-[var(--md-sys-shape-corner-medium)] border border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container-low)] p-3"
                      >
                        <h3 className="mb-2 text-sm font-medium">{name}</h3>
                        <BlobPreview
                          blob={step.image}
                          alt={name}
                          className="max-h-72 w-full rounded-[var(--md-sys-shape-corner-small)] border border-[var(--md-sys-color-outline-variant)] object-contain"
                        />
                        <p className="mt-2 break-words text-xs text-[var(--md-sys-color-on-surface-variant)]">
                          {renderStepDescription(step)}
                        </p>
                      </article>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {splitResult && splitResult.images.length > 0 && (
            <Card className={`order-6 mt-4 lg:mt-0 ${M3_CARD_CLASS}`}>
              <CardHeader className="pb-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <CheckCircle2
                      className={`h-4 w-4 ${M3_ICON_CLASS}`}
                      aria-hidden="true"
                    />
                    {t("results")}
                  </CardTitle>
                  <div className="grid grid-cols-2 gap-2 sm:flex">
                    <Button variant="outline" size="sm" onClick={toggleSelectAll}>
                      {selectedCells.size === splitResult.cells.length
                        ? t("clearSelection")
                        : t("selectAll")}
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => void downloadSelected()}
                      disabled={selectedCells.size === 0 || isPackaging}
                    >
                      {isPackaging ? (
                        <Loader2 className="mr-1 h-4 w-4 animate-spin" aria-hidden="true" />
                      ) : selectedCells.size > 1 ? (
                        <Package className="mr-1 h-4 w-4" aria-hidden="true" />
                      ) : (
                        <Download className="mr-1 h-4 w-4" aria-hidden="true" />
                      )}
                      <span className="truncate">
                        {isPackaging
                          ? t("packaging")
                          : t("downloadSelected").replace(
                              "{count}",
                              String(selectedCells.size),
                            )}
                      </span>
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
                  {splitResult.images.map((image, index) => {
                    const selected = selectedCells.has(index)
                    return (
                      <div
                        key={index}
                        className={`relative min-w-0 overflow-hidden rounded-[var(--md-sys-shape-corner-medium)] border-2 bg-[var(--md-sys-color-surface-container-low)] transition-colors ${
                          selected
                            ? "border-[var(--md-sys-color-primary)]"
                            : "border-[var(--md-sys-color-outline-variant)]"
                        }`}
                      >
                        <button
                          type="button"
                          aria-pressed={selected}
                          aria-label={t("selectSliceAria").replace(
                            "{index}",
                            String(index + 1),
                          )}
                          onClick={() => toggleCellSelection(index)}
                          className="block w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--md-sys-color-primary)]"
                        >
                          <BlobPreview
                            blob={image}
                            alt={t("sliceAlt").replace("{index}", String(index + 1))}
                            className="aspect-square w-full object-contain"
                          />
                          <span
                            className={`absolute left-1.5 top-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${
                              selected
                                ? "bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)]"
                                : "bg-[var(--md-sys-color-inverse-surface)] text-[var(--md-sys-color-inverse-on-surface)]"
                            }`}
                          >
                            {index + 1}
                          </span>
                          {selected && (
                            <span className="absolute right-1.5 top-1.5 rounded-full bg-[var(--md-sys-color-primary)] p-1 text-[var(--md-sys-color-on-primary)]">
                              <Check className="h-3.5 w-3.5" aria-hidden="true" />
                            </span>
                          )}
                        </button>
                        <Button
                          variant="secondary"
                          size="icon"
                          className="absolute bottom-1.5 right-1.5 h-9 w-9 shadow-sm"
                          aria-label={t("downloadSliceAria").replace(
                            "{index}",
                            String(index + 1),
                          )}
                          onClick={() => downloadImage(image, index)}
                        >
                          <Download className="h-4 w-4" aria-hidden="true" />
                        </Button>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </main>
      </div>
    </div>
  )
}
