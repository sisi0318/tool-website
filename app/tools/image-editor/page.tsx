"use client"

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type PointerEvent as ReactPointerEvent,
} from "react"
import {
  Check,
  ChevronDown,
  ChevronUp,
  Crop,
  Download,
  FlipHorizontal,
  FlipVertical,
  Image as ImageIcon,
  Loader2,
  Redo,
  RefreshCw,
  RotateCcw,
  RotateCw,
  Settings,
  Trash2,
  Undo,
  Upload,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useObjectUrl } from "@/hooks/use-object-url"
import { useTranslations } from "@/hooks/use-translations"
import {
  FILE_SIZE_LIMITS,
  formatFileSizeLimit,
  isFileWithinLimit,
} from "@/lib/file-limits"
import {
  DEFAULT_IMAGE_EDITOR_STATE,
  buildImageFilter,
  getImageRenderGeometry,
  getImageRenderScale,
  isFullImageCrop,
  normalizeImageCrop,
  normalizeImageRotation,
  safeEditedImageBase,
  type ImageCropRect,
  type ImageEditorState,
} from "@/lib/image-editor-tools"
import { downloadBlob } from "@/lib/object-url"

const PREVIEW_MAX_DIMENSION = 1600
const PREVIEW_MAX_PIXELS = 2_500_000
const MAX_EXPORT_DIMENSION = 16_384
const MAX_EXPORT_PIXELS = 64_000_000
const HISTORY_LIMIT = 50
const CANVAS_ERROR = "image-editor-canvas-unavailable"
const ENCODING_ERROR = "image-editor-encoding-failed"
const M3_CARD_CLASS =
  "min-w-0 rounded-[var(--md-sys-shape-corner-large)] border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container-lowest)] shadow-sm"
const M3_ICON_CLASS = "text-[var(--md-sys-color-primary)]"

const cropPresets = [
  { value: "free", labelKey: "cropFree", ratio: null },
  { value: "1:1", labelKey: "cropSquare", ratio: 1 },
  { value: "4:3", labelKey: "cropFourThree", ratio: 4 / 3 },
  { value: "16:9", labelKey: "cropSixteenNine", ratio: 16 / 9 },
  { value: "3:2", labelKey: "cropThreeTwo", ratio: 3 / 2 },
  { value: "2:3", labelKey: "cropTwoThree", ratio: 2 / 3 },
  { value: "9:16", labelKey: "cropNineSixteen", ratio: 9 / 16 },
] as const

const numericFilters = [
  {
    key: "brightness",
    labelKey: "brightness",
    minimum: 0,
    maximum: 200,
    step: 1,
    unit: "%",
  },
  {
    key: "contrast",
    labelKey: "contrast",
    minimum: 0,
    maximum: 200,
    step: 1,
    unit: "%",
  },
  {
    key: "saturation",
    labelKey: "saturation",
    minimum: 0,
    maximum: 200,
    step: 1,
    unit: "%",
  },
  {
    key: "blur",
    labelKey: "blur",
    minimum: 0,
    maximum: 20,
    step: 0.5,
    unit: "px",
  },
] as const

const booleanFilters = [
  { key: "grayscale", labelKey: "grayscale" },
  { key: "sepia", labelKey: "sepia" },
  { key: "invert", labelKey: "invert" },
] as const

function getCanvasContext(canvas: HTMLCanvasElement) {
  const context = canvas.getContext("2d")
  if (!context) throw new Error(CANVAS_ERROR)
  return context
}

function renderEditedCanvas(
  canvas: HTMLCanvasElement,
  image: HTMLImageElement,
  state: ImageEditorState,
  scale: number,
  opaqueBackground: boolean,
) {
  const geometry = getImageRenderGeometry(
    image.naturalWidth,
    image.naturalHeight,
    state,
  )
  canvas.width = Math.max(1, Math.round(geometry.outputWidth * scale))
  canvas.height = Math.max(1, Math.round(geometry.outputHeight * scale))
  const context = getCanvasContext(canvas)

  if (opaqueBackground) {
    context.fillStyle = "white"
    context.fillRect(0, 0, canvas.width, canvas.height)
  }

  context.save()
  context.translate(canvas.width / 2, canvas.height / 2)
  context.scale(scale, scale)
  context.rotate((geometry.rotation * Math.PI) / 180)
  context.scale(state.flipHorizontal ? -1 : 1, state.flipVertical ? -1 : 1)
  context.filter = buildImageFilter(state)
  context.drawImage(
    image,
    geometry.crop.x,
    geometry.crop.y,
    geometry.crop.width,
    geometry.crop.height,
    -geometry.crop.width / 2,
    -geometry.crop.height / 2,
    geometry.crop.width,
    geometry.crop.height,
  )
  context.restore()
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  mimeType: string,
  quality?: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob)
        else reject(new Error(ENCODING_ERROR))
      },
      mimeType,
      quality,
    )
  })
}

export default function ImageEditorPage() {
  const t = useTranslations("imageEditor")
  const [sourceFile, setSourceFile] = useState<File | null>(null)
  const imageUrl = useObjectUrl(sourceFile)
  const [imageMeta, setImageMeta] = useState<{
    width: number
    height: number
  } | null>(null)
  const [imageState, setImageState] = useState<ImageEditorState>(
    DEFAULT_IMAGE_EDITOR_STATE,
  )
  const [history, setHistory] = useState<ImageEditorState[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [activeTab, setActiveTab] = useState("transform")
  const [showSettings, setShowSettings] = useState(false)
  const [cropMode, setCropMode] = useState(false)
  const [cropPreset, setCropPreset] = useState("free")
  const [cropBox, setCropBox] = useState<ImageCropRect>({
    x: 0,
    y: 0,
    width: 1,
    height: 1,
  })
  const [outputFormat, setOutputFormat] = useState("png")
  const [outputQuality, setOutputQuality] = useState(92)
  const [isDragging, setIsDragging] = useState(false)
  const [zoom, setZoom] = useState(100)
  const [isExporting, setIsExporting] = useState(false)
  const [error, setError] = useState("")

  const fileInputRef = useRef<HTMLInputElement>(null)
  const previewCanvasRef = useRef<HTMLCanvasElement>(null)
  const originalImageRef = useRef<HTMLImageElement | null>(null)
  const imageStateRef = useRef<ImageEditorState>(DEFAULT_IMAGE_EDITOR_STATE)
  const historyRef = useRef<ImageEditorState[]>([])
  const historyIndexRef = useRef(-1)
  const filterFrameRef = useRef<number | null>(null)
  const pendingFilterRef = useRef<{
    key: keyof ImageEditorState
    value: number | boolean
  } | null>(null)
  const cropPointerRef = useRef<{
    pointerId: number
    startX: number
    startY: number
  } | null>(null)
  const exportIdRef = useRef(0)

  const outputGeometry = useMemo(
    () =>
      imageMeta
        ? getImageRenderGeometry(imageMeta.width, imageMeta.height, imageState)
        : null,
    [imageMeta, imageState],
  )

  const previewCanvasSize = useMemo(() => {
    if (!imageMeta) return null
    const width = cropMode
      ? imageMeta.width
      : outputGeometry?.outputWidth ?? imageMeta.width
    const height = cropMode
      ? imageMeta.height
      : outputGeometry?.outputHeight ?? imageMeta.height
    const scale = getImageRenderScale(
      width,
      height,
      PREVIEW_MAX_DIMENSION,
      PREVIEW_MAX_PIXELS,
    )
    return {
      width: Math.max(1, Math.round(width * scale)),
      height: Math.max(1, Math.round(height * scale)),
      scale,
    }
  }, [cropMode, imageMeta, outputGeometry])

  const commitState = useCallback((nextState: ImageEditorState) => {
    imageStateRef.current = nextState
    setImageState(nextState)
    const nextHistory = [
      ...historyRef.current.slice(0, historyIndexRef.current + 1),
      nextState,
    ].slice(-HISTORY_LIMIT)
    historyRef.current = nextHistory
    historyIndexRef.current = nextHistory.length - 1
    setHistory(nextHistory)
    setHistoryIndex(nextHistory.length - 1)
  }, [])

  const restoreHistoryState = useCallback((index: number) => {
    const snapshot = historyRef.current[index]
    if (!snapshot) return
    historyIndexRef.current = index
    imageStateRef.current = snapshot
    setHistoryIndex(index)
    setImageState(snapshot)
    setCropMode(false)
    if (originalImageRef.current) {
      setCropBox(
        snapshot.crop ?? {
          x: 0,
          y: 0,
          width: originalImageRef.current.naturalWidth,
          height: originalImageRef.current.naturalHeight,
        },
      )
    }
  }, [])

  const undo = useCallback(() => {
    restoreHistoryState(historyIndexRef.current - 1)
  }, [restoreHistoryState])

  const redo = useCallback(() => {
    restoreHistoryState(historyIndexRef.current + 1)
  }, [restoreHistoryState])

  useEffect(
    () => () => {
      exportIdRef.current += 1
      if (filterFrameRef.current !== null) cancelAnimationFrame(filterFrameRef.current)
    },
    [],
  )

  useEffect(() => {
    if (!imageUrl) {
      originalImageRef.current = null
      setImageMeta(null)
      return
    }

    let active = true
    const image = new Image()
    image.onload = () => {
      if (!active) return
      const initialState = { ...DEFAULT_IMAGE_EDITOR_STATE }
      originalImageRef.current = image
      imageStateRef.current = initialState
      historyRef.current = [initialState]
      historyIndexRef.current = 0
      setImageMeta({ width: image.naturalWidth, height: image.naturalHeight })
      setImageState(initialState)
      setHistory([initialState])
      setHistoryIndex(0)
      setCropBox({
        x: 0,
        y: 0,
        width: image.naturalWidth,
        height: image.naturalHeight,
      })
      setCropMode(false)
      setZoom(100)
      setError("")
    }
    image.onerror = () => {
      if (!active) return
      originalImageRef.current = null
      setImageMeta(null)
      setError(t("loadFailed"))
    }
    image.src = imageUrl

    return () => {
      active = false
      image.src = ""
    }
  }, [imageUrl, t])

  const handleFileUpload = useCallback(
    (file: File) => {
      if (!file.type.startsWith("image/")) {
        setError(t("invalidImage"))
        return
      }
      if (!isFileWithinLimit(file, FILE_SIZE_LIMITS.imageEditor)) {
        setError(
          t("imageTooLarge").replace(
            "{size}",
            formatFileSizeLimit(FILE_SIZE_LIMITS.imageEditor),
          ),
        )
        return
      }

      exportIdRef.current += 1
      setIsExporting(false)
      originalImageRef.current = null
      setImageMeta(null)
      setSourceFile(file)
      setError("")
    },
    [t],
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
    exportIdRef.current += 1
    originalImageRef.current = null
    imageStateRef.current = DEFAULT_IMAGE_EDITOR_STATE
    historyRef.current = []
    historyIndexRef.current = -1
    setSourceFile(null)
    setImageMeta(null)
    setImageState(DEFAULT_IMAGE_EDITOR_STATE)
    setHistory([])
    setHistoryIndex(-1)
    setCropMode(false)
    setIsExporting(false)
    setError("")
    if (fileInputRef.current) fileInputRef.current.value = ""
  }, [])

  const rotate = useCallback(
    (degrees: number) => {
      commitState({
        ...imageStateRef.current,
        rotation: normalizeImageRotation(imageStateRef.current.rotation + degrees),
      })
    },
    [commitState],
  )

  const flipHorizontal = useCallback(() => {
    commitState({
      ...imageStateRef.current,
      flipHorizontal: !imageStateRef.current.flipHorizontal,
    })
  }, [commitState])

  const flipVertical = useCallback(() => {
    commitState({
      ...imageStateRef.current,
      flipVertical: !imageStateRef.current.flipVertical,
    })
  }, [commitState])

  const resetTransform = useCallback(() => {
    commitState({
      ...imageStateRef.current,
      rotation: 0,
      flipHorizontal: false,
      flipVertical: false,
      crop: null,
    })
    if (originalImageRef.current) {
      setCropBox({
        x: 0,
        y: 0,
        width: originalImageRef.current.naturalWidth,
        height: originalImageRef.current.naturalHeight,
      })
    }
    setCropMode(false)
  }, [commitState])

  const resetFilters = useCallback(() => {
    commitState({
      ...imageStateRef.current,
      brightness: 100,
      contrast: 100,
      saturation: 100,
      blur: 0,
      grayscale: false,
      sepia: false,
      invert: false,
    })
  }, [commitState])

  const resetAll = useCallback(() => {
    if (!originalImageRef.current) return
    commitState({ ...DEFAULT_IMAGE_EDITOR_STATE })
    setCropBox({
      x: 0,
      y: 0,
      width: originalImageRef.current.naturalWidth,
      height: originalImageRef.current.naturalHeight,
    })
    setCropMode(false)
    setZoom(100)
  }, [commitState])

  const updateFilter = useCallback(
    (key: keyof ImageEditorState, value: number | boolean) => {
      pendingFilterRef.current = { key, value }
      if (filterFrameRef.current !== null) return
      filterFrameRef.current = requestAnimationFrame(() => {
        filterFrameRef.current = null
        const pending = pendingFilterRef.current
        pendingFilterRef.current = null
        if (!pending) return
        const nextState = { ...imageStateRef.current, [pending.key]: pending.value }
        imageStateRef.current = nextState
        setImageState(nextState)
      })
    },
    [],
  )

  const commitFilter = useCallback(
    (key: keyof ImageEditorState, value: number | boolean) => {
      if (filterFrameRef.current !== null) {
        cancelAnimationFrame(filterFrameRef.current)
        filterFrameRef.current = null
      }
      pendingFilterRef.current = null
      commitState({ ...imageStateRef.current, [key]: value })
    },
    [commitState],
  )

  const startCrop = useCallback(() => {
    const image = originalImageRef.current
    if (!image) return
    setCropBox(
      imageStateRef.current.crop ?? {
        x: 0,
        y: 0,
        width: image.naturalWidth,
        height: image.naturalHeight,
      },
    )
    setCropPreset("free")
    setCropMode(true)
    requestAnimationFrame(() => {
      previewCanvasRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      })
    })
  }, [])

  const applyCropPreset = useCallback((presetValue: string) => {
    const image = originalImageRef.current
    if (!image) return
    setCropPreset(presetValue)
    const preset = cropPresets.find((item) => item.value === presetValue)
    if (!preset?.ratio) return
    const imageRatio = image.naturalWidth / image.naturalHeight
    const width =
      preset.ratio > imageRatio
        ? image.naturalWidth
        : image.naturalHeight * preset.ratio
    const height =
      preset.ratio > imageRatio
        ? image.naturalWidth / preset.ratio
        : image.naturalHeight
    setCropBox({
      x: (image.naturalWidth - width) / 2,
      y: (image.naturalHeight - height) / 2,
      width,
      height,
    })
  }, [])

  const applyCrop = useCallback(() => {
    const image = originalImageRef.current
    if (!image) return
    const normalized = normalizeImageCrop(
      cropBox,
      image.naturalWidth,
      image.naturalHeight,
    )
    commitState({
      ...imageStateRef.current,
      crop: isFullImageCrop(normalized, image.naturalWidth, image.naturalHeight)
        ? null
        : normalized,
    })
    setCropMode(false)
  }, [commitState, cropBox])

  const cancelCrop = useCallback(() => {
    const image = originalImageRef.current
    if (!image) return
    setCropBox(
      imageStateRef.current.crop ?? {
        x: 0,
        y: 0,
        width: image.naturalWidth,
        height: image.naturalHeight,
      },
    )
    setCropMode(false)
  }, [])

  const cropPointFromEvent = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      const canvas = previewCanvasRef.current
      if (!canvas || !imageMeta) return null
      const rect = canvas.getBoundingClientRect()
      return {
        x: Math.min(
          imageMeta.width,
          Math.max(0, ((event.clientX - rect.left) / rect.width) * imageMeta.width),
        ),
        y: Math.min(
          imageMeta.height,
          Math.max(0, ((event.clientY - rect.top) / rect.height) * imageMeta.height),
        ),
      }
    },
    [imageMeta],
  )

  const handleCropPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      if (!cropMode) return
      const point = cropPointFromEvent(event)
      if (!point) return
      event.currentTarget.setPointerCapture(event.pointerId)
      cropPointerRef.current = {
        pointerId: event.pointerId,
        startX: point.x,
        startY: point.y,
      }
      setCropPreset("free")
      setCropBox({ x: point.x, y: point.y, width: 1, height: 1 })
    },
    [cropMode, cropPointFromEvent],
  )

  const handleCropPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      const start = cropPointerRef.current
      const image = originalImageRef.current
      if (!start || start.pointerId !== event.pointerId || !image) return
      const point = cropPointFromEvent(event)
      if (!point) return
      setCropBox(
        normalizeImageCrop(
          {
            x: start.startX,
            y: start.startY,
            width: point.x - start.startX,
            height: point.y - start.startY,
          },
          image.naturalWidth,
          image.naturalHeight,
        ),
      )
    },
    [cropPointFromEvent],
  )

  const finishCropPointer = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      if (cropPointerRef.current?.pointerId !== event.pointerId) return
      cropPointerRef.current = null
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId)
      }
    },
    [],
  )

  useEffect(() => {
    const image = originalImageRef.current
    const canvas = previewCanvasRef.current
    if (!image || !imageMeta || !previewCanvasSize || !canvas) return

    canvas.width = previewCanvasSize.width
    canvas.height = previewCanvasSize.height
    if (!cropMode) {
      renderEditedCanvas(
        canvas,
        image,
        imageState,
        previewCanvasSize.scale,
        false,
      )
      return
    }

    const context = getCanvasContext(canvas)
    const scale = previewCanvasSize.scale
    const styles = getComputedStyle(canvas)
    const overlay =
      styles.getPropertyValue("--md-sys-color-inverse-surface").trim() ||
      "CanvasText"
    const outline =
      styles.getPropertyValue("--md-sys-color-primary").trim() || "Highlight"
    context.save()
    context.scale(scale, scale)
    context.filter = buildImageFilter(imageState)
    context.drawImage(image, 0, 0)
    context.filter = "none"
    context.globalAlpha = 0.55
    context.fillStyle = overlay
    context.fillRect(0, 0, image.naturalWidth, image.naturalHeight)
    context.globalAlpha = 1
    context.save()
    context.beginPath()
    context.rect(cropBox.x, cropBox.y, cropBox.width, cropBox.height)
    context.clip()
    context.filter = buildImageFilter(imageState)
    context.drawImage(image, 0, 0)
    context.restore()
    context.strokeStyle = outline
    context.lineWidth = Math.max(2 / scale, 1)
    context.setLineDash([8 / scale, 6 / scale])
    context.strokeRect(cropBox.x, cropBox.y, cropBox.width, cropBox.height)
    context.restore()
  }, [
    cropBox,
    cropMode,
    imageMeta,
    imageState,
    previewCanvasSize,
  ])

  const exportImage = useCallback(async () => {
    const image = originalImageRef.current
    if (!image || isExporting) return
    const geometry = getImageRenderGeometry(
      image.naturalWidth,
      image.naturalHeight,
      imageStateRef.current,
    )
    if (
      geometry.outputWidth > MAX_EXPORT_DIMENSION ||
      geometry.outputHeight > MAX_EXPORT_DIMENSION ||
      geometry.outputWidth * geometry.outputHeight > MAX_EXPORT_PIXELS
    ) {
      setError(t("outputTooLarge"))
      return
    }

    const exportId = ++exportIdRef.current
    setIsExporting(true)
    setError("")
    try {
      const canvas = document.createElement("canvas")
      renderEditedCanvas(
        canvas,
        image,
        imageStateRef.current,
        1,
        outputFormat === "jpg",
      )
      const mimeType =
        outputFormat === "jpg"
          ? "image/jpeg"
          : outputFormat === "webp"
            ? "image/webp"
            : "image/png"
      const blob = await canvasToBlob(
        canvas,
        mimeType,
        outputFormat === "png" ? undefined : outputQuality / 100,
      )
      if (exportIdRef.current !== exportId) return
      downloadBlob(
        blob,
        `${safeEditedImageBase(sourceFile?.name ?? "")}_edited.${outputFormat}`,
      )
    } catch (caught) {
      if (exportIdRef.current !== exportId) return
      const code = caught instanceof Error ? caught.message : ""
      setError(
        code === CANVAS_ERROR ? t("canvasUnavailable") : t("exportFailed"),
      )
    } finally {
      if (exportIdRef.current === exportId) setIsExporting(false)
    }
  }, [isExporting, outputFormat, outputQuality, sourceFile?.name, t])

  const mirrorDescription =
    imageState.flipHorizontal && imageState.flipVertical
      ? t("mirrorBoth")
      : imageState.flipHorizontal
        ? t("horizontal")
        : imageState.flipVertical
          ? t("vertical")
          : t("none")
  const effectDescription = booleanFilters
    .filter(({ key }) => imageState[key])
    .map(({ labelKey }) => t(labelKey))
    .join(", ")

  return (
    <div className="container mx-auto max-w-7xl px-3 py-4 sm:px-4">
      <header className="mb-6 text-center">
        <div className="mb-2 flex items-center justify-center gap-2">
          <ImageIcon className={`h-8 w-8 ${M3_ICON_CLASS}`} aria-hidden="true" />
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
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) handleFileUpload(file)
                  event.currentTarget.value = ""
                }}
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
                <span className="block text-sm">{t("dropzone")}</span>
                <span className="mt-1 block text-xs text-[var(--md-sys-color-on-surface-variant)]">
                  {t("maximum")} {formatFileSizeLimit(FILE_SIZE_LIMITS.imageEditor)}
                </span>
              </button>
              {sourceFile && imageMeta && (
                <div className="mt-3 space-y-2">
                  <p className="break-all text-sm font-medium">{sourceFile.name}</p>
                  <p className="text-xs text-[var(--md-sys-color-on-surface-variant)]">
                    {imageMeta.width} × {imageMeta.height} {t("pixels")}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={clearImage}
                  >
                    <Trash2 className="mr-1 h-4 w-4" aria-hidden="true" />
                    {t("removeImage")}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {imageMeta && (
            <Card className={`order-4 mt-4 lg:mt-0 ${M3_CARD_CLASS}`}>
              <CardContent className="pt-4">
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList className="mb-4 grid h-auto grid-cols-2">
                    <TabsTrigger value="transform" className="min-h-10">
                      {t("transform")}
                    </TabsTrigger>
                    <TabsTrigger value="filters" className="min-h-10">
                      {t("filters")}
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="transform" className="space-y-5">
                    <section className="space-y-2">
                      <Label>{t("rotate")}</Label>
                      <div className="grid grid-cols-2 gap-2">
                        {[-90, 90, -45, 45].map((degrees) => (
                          <Button
                            key={degrees}
                            variant="outline"
                            size="sm"
                            onClick={() => rotate(degrees)}
                          >
                            {degrees === -90 ? (
                              <RotateCcw className="mr-1 h-4 w-4" aria-hidden="true" />
                            ) : degrees === 90 ? (
                              <RotateCw className="mr-1 h-4 w-4" aria-hidden="true" />
                            ) : null}
                            {degrees > 0 ? "+" : ""}
                            {degrees}°
                          </Button>
                        ))}
                      </div>
                      <Badge
                        variant="secondary"
                        className="w-full justify-center bg-[var(--md-sys-color-secondary-container)] text-[var(--md-sys-color-on-secondary-container)]"
                      >
                        {t("currentRotation").replace(
                          "{value}",
                          String(imageState.rotation),
                        )}
                      </Badge>
                    </section>

                    <section className="space-y-2">
                      <Label>{t("mirror")}</Label>
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          variant={imageState.flipHorizontal ? "default" : "outline"}
                          size="sm"
                          onClick={flipHorizontal}
                          aria-pressed={imageState.flipHorizontal}
                        >
                          <FlipHorizontal className="mr-1 h-4 w-4" aria-hidden="true" />
                          {t("horizontal")}
                        </Button>
                        <Button
                          variant={imageState.flipVertical ? "default" : "outline"}
                          size="sm"
                          onClick={flipVertical}
                          aria-pressed={imageState.flipVertical}
                        >
                          <FlipVertical className="mr-1 h-4 w-4" aria-hidden="true" />
                          {t("vertical")}
                        </Button>
                      </div>
                    </section>

                    <section className="space-y-2">
                      <Label>{t("crop")}</Label>
                      {!cropMode ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={startCrop}
                          className="w-full"
                        >
                          <Crop className="mr-1 h-4 w-4" aria-hidden="true" />
                          {imageState.crop ? t("editCrop") : t("startCrop")}
                        </Button>
                      ) : (
                        <div className="space-y-3 rounded-[var(--md-sys-shape-corner-medium)] bg-[var(--md-sys-color-surface-container)] p-3">
                          <Select value={cropPreset} onValueChange={applyCropPreset}>
                            <SelectTrigger aria-label={t("cropRatio")}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {cropPresets.map((preset) => (
                                <SelectItem key={preset.value} value={preset.value}>
                                  {t(preset.labelKey)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-[var(--md-sys-color-on-surface-variant)]">
                            {t("cropSize")
                              .replace("{width}", String(Math.round(cropBox.width)))
                              .replace("{height}", String(Math.round(cropBox.height)))}
                          </p>
                          <div className="grid grid-cols-2 gap-2">
                            <Button size="sm" onClick={applyCrop}>
                              <Check className="mr-1 h-4 w-4" aria-hidden="true" />
                              {t("apply")}
                            </Button>
                            <Button variant="outline" size="sm" onClick={cancelCrop}>
                              <X className="mr-1 h-4 w-4" aria-hidden="true" />
                              {t("cancel")}
                            </Button>
                          </div>
                        </div>
                      )}
                    </section>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={resetTransform}
                      className="w-full text-[var(--md-sys-color-tertiary)]"
                    >
                      <RefreshCw className="mr-1 h-4 w-4" aria-hidden="true" />
                      {t("resetTransform")}
                    </Button>
                  </TabsContent>

                  <TabsContent value="filters" className="space-y-5">
                    {numericFilters.map((filter) => (
                      <div key={filter.key} className="space-y-2">
                        <div className="flex items-center justify-between gap-3">
                          <Label htmlFor={`image-filter-${filter.key}`}>
                            {t(filter.labelKey)}
                          </Label>
                          <span className="text-xs tabular-nums text-[var(--md-sys-color-on-surface-variant)]">
                            {imageState[filter.key]}
                            {filter.unit}
                          </span>
                        </div>
                        <Slider
                          id={`image-filter-${filter.key}`}
                          value={[imageState[filter.key]]}
                          onValueChange={([value]) =>
                            updateFilter(filter.key, value)
                          }
                          onValueCommit={([value]) =>
                            commitFilter(filter.key, value)
                          }
                          min={filter.minimum}
                          max={filter.maximum}
                          step={filter.step}
                        />
                      </div>
                    ))}

                    <div className="space-y-3 border-t border-[var(--md-sys-color-outline-variant)] pt-4">
                      {booleanFilters.map((filter) => (
                        <div
                          key={filter.key}
                          className="flex items-center justify-between gap-3"
                        >
                          <Label htmlFor={`image-effect-${filter.key}`}>
                            {t(filter.labelKey)}
                          </Label>
                          <Switch
                            id={`image-effect-${filter.key}`}
                            checked={imageState[filter.key]}
                            onCheckedChange={(value) =>
                              commitFilter(filter.key, value)
                            }
                          />
                        </div>
                      ))}
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={resetFilters}
                      className="w-full text-[var(--md-sys-color-tertiary)]"
                    >
                      <RefreshCw className="mr-1 h-4 w-4" aria-hidden="true" />
                      {t("resetFilters")}
                    </Button>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          )}

          {imageMeta && (
            <Card className={`order-5 mt-4 lg:mt-0 ${M3_CARD_CLASS}`}>
              <CardHeader className="pb-2">
                <button
                  type="button"
                  className="flex min-h-10 w-full items-center justify-between gap-3 text-left"
                  aria-expanded={showSettings}
                  onClick={() => setShowSettings((value) => !value)}
                >
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <Settings className={`h-4 w-4 ${M3_ICON_CLASS}`} aria-hidden="true" />
                    {t("exportSettings")}
                  </span>
                  {showSettings ? (
                    <ChevronUp className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <ChevronDown className="h-4 w-4" aria-hidden="true" />
                  )}
                </button>
              </CardHeader>
              {showSettings && (
                <CardContent className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <Label htmlFor="image-output-format">{t("outputFormat")}</Label>
                    <Select value={outputFormat} onValueChange={setOutputFormat}>
                      <SelectTrigger id="image-output-format">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="png">{t("pngFormat")}</SelectItem>
                        <SelectItem value="jpg">{t("jpgFormat")}</SelectItem>
                        <SelectItem value="webp">{t("webpFormat")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {outputFormat !== "png" && (
                    <div className="space-y-2">
                      <Label htmlFor="image-output-quality">
                        {t("outputQuality").replace(
                          "{value}",
                          String(outputQuality),
                        )}
                      </Label>
                      <Slider
                        id="image-output-quality"
                        value={[outputQuality]}
                        onValueChange={([value]) => setOutputQuality(value)}
                        min={10}
                        max={100}
                        step={1}
                      />
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          )}
        </aside>

        <main className="contents lg:col-span-3 lg:block lg:space-y-4">
          {imageMeta && (
            <Card className={`order-3 mt-4 lg:mt-0 ${M3_CARD_CLASS}`}>
              <CardContent className="p-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-[auto_1fr_auto] sm:items-center">
                  <div className="flex items-center justify-center gap-2 sm:justify-start">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={undo}
                      disabled={historyIndex <= 0}
                      aria-label={t("undo")}
                    >
                      <Undo className="h-4 w-4" aria-hidden="true" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={redo}
                      disabled={historyIndex >= history.length - 1}
                      aria-label={t("redo")}
                    >
                      <Redo className="h-4 w-4" aria-hidden="true" />
                    </Button>
                    <span className="text-xs tabular-nums text-[var(--md-sys-color-on-surface-variant)]">
                      {historyIndex + 1}/{history.length}
                    </span>
                  </div>

                  <div className="flex items-center justify-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setZoom((value) => Math.max(25, value - 25))}
                      aria-label={t("zoomOut")}
                    >
                      <ZoomOut className="h-4 w-4" aria-hidden="true" />
                    </Button>
                    <span className="w-14 text-center text-sm tabular-nums">
                      {zoom}%
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setZoom((value) => Math.min(200, value + 25))}
                      aria-label={t("zoomIn")}
                    >
                      <ZoomIn className="h-4 w-4" aria-hidden="true" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setZoom(100)}>
                      {t("fit")}
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 gap-2 sm:flex">
                    <Button variant="outline" size="sm" onClick={resetAll}>
                      <Trash2 className="mr-1 h-4 w-4" aria-hidden="true" />
                      {t("resetAll")}
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => void exportImage()}
                      disabled={isExporting}
                    >
                      {isExporting ? (
                        <Loader2 className="mr-1 h-4 w-4 animate-spin" aria-hidden="true" />
                      ) : (
                        <Download className="mr-1 h-4 w-4" aria-hidden="true" />
                      )}
                      {isExporting ? t("exporting") : t("exportImage")}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Card className={`order-2 min-h-[380px] ${M3_CARD_CLASS}`}>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <ImageIcon className={`h-4 w-4 ${M3_ICON_CLASS}`} aria-hidden="true" />
                {t("preview")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!imageMeta || !previewCanvasSize ? (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex min-h-[300px] w-full flex-col items-center justify-center rounded-[var(--md-sys-shape-corner-large)] bg-[var(--md-sys-color-surface-container-low)] px-4 text-[var(--md-sys-color-on-surface-variant)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--md-sys-color-primary)]"
                >
                  <ImageIcon className="mb-3 h-14 w-14" aria-hidden="true" />
                  <span className="font-medium">{t("uploadPrompt")}</span>
                  <span className="mt-1 text-sm">{t("uploadPromptHint")}</span>
                </button>
              ) : (
                <>
                  <div
                    className="max-h-[min(65dvh,680px)] overflow-auto overscroll-contain rounded-[var(--md-sys-shape-corner-medium)] border border-[var(--md-sys-color-outline-variant)] p-2 touch-pan-x touch-pan-y scrollbar-m3"
                    aria-label={t("previewScrollAria")}
                    tabIndex={0}
                    style={{
                      WebkitOverflowScrolling: "touch",
                      backgroundColor: "var(--md-sys-color-surface-container-low)",
                      backgroundImage:
                        "linear-gradient(45deg, var(--md-sys-color-surface-container-high) 25%, transparent 25%), linear-gradient(-45deg, var(--md-sys-color-surface-container-high) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, var(--md-sys-color-surface-container-high) 75%), linear-gradient(-45deg, transparent 75%, var(--md-sys-color-surface-container-high) 75%)",
                      backgroundSize: "24px 24px",
                      backgroundPosition: "0 0, 0 12px, 12px -12px, -12px 0",
                    }}
                  >
                    <canvas
                      ref={previewCanvasRef}
                      width={previewCanvasSize.width}
                      height={previewCanvasSize.height}
                      aria-label={cropMode ? t("cropCanvasAria") : t("previewCanvasAria")}
                      onPointerDown={handleCropPointerDown}
                      onPointerMove={handleCropPointerMove}
                      onPointerUp={finishCropPointer}
                      onPointerCancel={finishCropPointer}
                      className={`mx-auto block rounded-[var(--md-sys-shape-corner-small)] shadow-sm ${
                        cropMode ? "cursor-crosshair touch-none" : ""
                      }`}
                      style={{
                        width: `min(${Math.round(
                          previewCanvasSize.width * (zoom / 100),
                        )}px, ${zoom}%)`,
                        height: "auto",
                      }}
                    />
                  </div>
                  {cropMode && (
                    <p className="mt-3 rounded-[var(--md-sys-shape-corner-medium)] bg-[var(--md-sys-color-primary-container)] p-3 text-sm text-[var(--md-sys-color-on-primary-container)]">
                      {t("cropGestureHint")}
                    </p>
                  )}
                </>
              )}

              {error && (
                <div
                  className="mt-4 rounded-[var(--md-sys-shape-corner-medium)] bg-[var(--md-sys-color-error-container)] p-3 text-sm text-[var(--md-sys-color-on-error-container)]"
                  role="alert"
                >
                  {error}
                </div>
              )}
            </CardContent>
          </Card>

          {imageMeta && outputGeometry && (
            <Card className={`order-6 mt-4 lg:mt-0 ${M3_CARD_CLASS}`}>
              <CardContent className="py-3">
                <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                  <div className="min-w-0">
                    <dt className="text-xs text-[var(--md-sys-color-on-surface-variant)]">
                      {t("originalSize")}
                    </dt>
                    <dd className="mt-1 break-words font-medium tabular-nums">
                      {imageMeta.width} × {imageMeta.height}
                    </dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-xs text-[var(--md-sys-color-on-surface-variant)]">
                      {t("outputSize")}
                    </dt>
                    <dd className="mt-1 break-words font-medium tabular-nums">
                      {outputGeometry.outputWidth} × {outputGeometry.outputHeight}
                    </dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-xs text-[var(--md-sys-color-on-surface-variant)]">
                      {t("rotationAndMirror")}
                    </dt>
                    <dd className="mt-1 break-words font-medium">
                      {imageState.rotation}° · {mirrorDescription}
                    </dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-xs text-[var(--md-sys-color-on-surface-variant)]">
                      {t("activeEffects")}
                    </dt>
                    <dd className="mt-1 break-words font-medium">
                      {effectDescription || t("none")}
                    </dd>
                  </div>
                </dl>
              </CardContent>
            </Card>
          )}
        </main>
      </div>
    </div>
  )
}
