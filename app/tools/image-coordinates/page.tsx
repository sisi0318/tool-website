"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { useObjectUrl } from "@/hooks/use-object-url"
import { useTranslations } from "@/hooks/use-translations"
import {
  FILE_SIZE_LIMITS,
  formatFileSizeLimit,
  isFileWithinLimit,
} from "@/lib/file-limits"
import { copyTextToClipboard } from "@/lib/clipboard"
import { createClientId } from "@/lib/client-id"
import {
  coordinateFromManualInput,
  coordinateFromRelativePosition,
  type ImageCoordinate as Coordinate,
  type ImageCoordinateFormat as CoordinateFormat,
} from "@/lib/image-coordinate-tools"
import {
  Upload,
  Trash2,
  Crosshair,
  Copy,
  Check,
  ZoomIn,
  ZoomOut,
  MousePointer2,
  Ruler,
  Image as ImageIcon,
  MapPin,
  Grid3X3,
  Plus,
} from "lucide-react"

interface SavedPoint {
  id: string
  coord: Coordinate
  color: string
}

const POINT_COLORS = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899"]
const COORDINATE_CARD_CLASS =
  "min-w-0 rounded-[var(--md-sys-shape-corner-large)] border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container-lowest)] shadow-sm"
const COORDINATE_ICON_CLASS = "text-[var(--md-sys-color-primary)]"

export default function ImageCoordinatesPage() {
  const t = useTranslations("imageCoordinates")
  const [sourceFile, setSourceFile] = useState<File | null>(null)
  const imageUrl = useObjectUrl(sourceFile)
  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null)
  const [uploadError, setUploadError] = useState("")
  
  const [currentCoord, setCurrentCoord] = useState<Coordinate | null>(null)
  const [savedPoints, setSavedPoints] = useState<SavedPoint[]>([])
  const [coordinateFormat, setCoordinateFormat] = useState<CoordinateFormat>("percent")
  
  const [isDragging, setIsDragging] = useState(false)
  const [zoom, setZoom] = useState(100)
  const [showCrosshair, setShowCrosshair] = useState(true)
  const [showGrid, setShowGrid] = useState(false)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [manualError, setManualError] = useState("")
  
  const [manualX, setManualX] = useState("")
  const [manualY, setManualY] = useState("")
  const [manualFormat, setManualFormat] = useState<CoordinateFormat>("percent")
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const pointerFrameRef = useRef<number | null>(null)
  const pendingPointerRef = useRef<{ clientX: number; clientY: number } | null>(null)
  const pointerStartRef = useRef<{ pointerId: number; clientX: number; clientY: number } | null>(null)
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    if (pointerFrameRef.current !== null) {
      cancelAnimationFrame(pointerFrameRef.current)
    }
    if (copyTimeoutRef.current) {
      clearTimeout(copyTimeoutRef.current)
    }
  }, [])

  const formatCoordinate = useCallback((coord: Coordinate, format: CoordinateFormat): string => {
    switch (format) {
      case "pixel":
        return `(${coord.pixelX}, ${coord.pixelY})`
      case "percent":
        return `(${coord.x.toFixed(2)}%, ${coord.y.toFixed(2)}%)`
      case "permille":
        return `(${(coord.x * 10).toFixed(1)}‰, ${(coord.y * 10).toFixed(1)}‰)`
      case "permyriad":
        return `(${(coord.x * 100).toFixed(0)}‱, ${(coord.y * 100).toFixed(0)}‱)`
      default:
        return `(${coord.x.toFixed(2)}%, ${coord.y.toFixed(2)}%)`
    }
  }, [])

  const handleFileUpload = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) {
      setUploadError(t("invalidImage"))
      return
    }
    if (!isFileWithinLimit(file, FILE_SIZE_LIMITS.coordinateImage)) {
      setUploadError(`${t("imageTooLarge")} ${formatFileSizeLimit(FILE_SIZE_LIMITS.coordinateImage)}`)
      return
    }

    setSourceFile(file)
    setImageSize(null)
    setUploadError("")
    setSavedPoints([])
    setCurrentCoord(null)
    setManualError("")
    setZoom(100)
  }, [t])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFileUpload(file)
  }, [handleFileUpload])

  const clearImage = useCallback(() => {
    setSourceFile(null)
    setImageSize(null)
    setUploadError("")
    setSavedPoints([])
    setCurrentCoord(null)
    setManualError("")
    setZoom(100)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }, [])

  const getCoordinateAt = useCallback((clientX: number, clientY: number): Coordinate | null => {
    const image = imageRef.current
    if (!image || !imageSize) return null

    const rect = image.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return null

    return coordinateFromRelativePosition(
      clientX - rect.left,
      clientY - rect.top,
      rect.width,
      rect.height,
      imageSize,
    )
  }, [imageSize])

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLImageElement>) => {
    if (e.pointerType !== "mouse" && e.pointerType !== "pen") return
    pendingPointerRef.current = { clientX: e.clientX, clientY: e.clientY }
    if (pointerFrameRef.current !== null) return

    pointerFrameRef.current = requestAnimationFrame(() => {
      pointerFrameRef.current = null
      const pointer = pendingPointerRef.current
      if (!pointer) return
      setCurrentCoord(getCoordinateAt(pointer.clientX, pointer.clientY))
    })
  }, [getCoordinateAt])

  const handlePointerLeave = useCallback((event: React.PointerEvent<HTMLImageElement>) => {
    if (event.pointerType !== "mouse" && event.pointerType !== "pen") return
    pendingPointerRef.current = null
    if (pointerFrameRef.current !== null) {
      cancelAnimationFrame(pointerFrameRef.current)
      pointerFrameRef.current = null
    }
    setCurrentCoord(null)
  }, [])

  const showCopiedFeedback = useCallback((key: string) => {
    setCopiedKey(key)
    if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current)
    copyTimeoutRef.current = setTimeout(() => setCopiedKey(null), 1500)
  }, [])

  const savePoint = useCallback((coord: Coordinate) => {
    const newPoint: SavedPoint = {
      id: createClientId("coordinate"),
      coord: { ...coord },
      color: POINT_COLORS[savedPoints.length % POINT_COLORS.length],
    }
    setSavedPoints(prev => [...prev, newPoint])
  }, [savedPoints.length])

  const saveCurrentPoint = useCallback(() => {
    if (!currentCoord) return
    savePoint(currentCoord)
  }, [currentCoord, savePoint])

  const removePoint = useCallback((id: string) => {
    setSavedPoints(prev => prev.filter(p => p.id !== id))
  }, [])

  const copyCoordinate = useCallback(async (coord: Coordinate, key: string) => {
    const text = formatCoordinate(coord, coordinateFormat)
    if (await copyTextToClipboard(text)) showCopiedFeedback(key)
  }, [coordinateFormat, formatCoordinate, showCopiedFeedback])

  const copyAllPoints = useCallback(async () => {
    if (savedPoints.length === 0) return
    const text = savedPoints
      .map((p, i) => `${t("point")} ${i + 1}: ${formatCoordinate(p.coord, coordinateFormat)}`)
      .join("\n")
    if (await copyTextToClipboard(text)) showCopiedFeedback("all")
  }, [savedPoints, coordinateFormat, formatCoordinate, showCopiedFeedback, t])

  const handlePointerDown = useCallback((event: React.PointerEvent<HTMLImageElement>) => {
    pointerStartRef.current = {
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
    }
  }, [])

  const openFilePicker = useCallback(() => {
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
      fileInputRef.current.click()
    }
  }, [])

  const handlePointerUp = useCallback((event: React.PointerEvent<HTMLImageElement>) => {
    const start = pointerStartRef.current
    pointerStartRef.current = null
    if (!start || start.pointerId !== event.pointerId) return
    if (Math.hypot(event.clientX - start.clientX, event.clientY - start.clientY) > 8) return

    const coord = getCoordinateAt(event.clientX, event.clientY)
    if (!coord) return
    setCurrentCoord(coord)
    savePoint(coord)
  }, [getCoordinateAt, savePoint])

  const addManualPoint = useCallback(() => {
    if (!imageSize) return
    
    const x = parseFloat(manualX)
    const y = parseFloat(manualY)
    
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      setManualError(t("invalidCoordinates"))
      return
    }
    
    const coord = coordinateFromManualInput(x, y, manualFormat, imageSize)
    if (!coord) {
      setManualError(t("invalidCoordinates"))
      return
    }

    savePoint(coord)
    setManualX("")
    setManualY("")
    setManualError("")
  }, [manualX, manualY, manualFormat, imageSize, savePoint, t])

  return (
    <div className="container mx-auto max-w-7xl overflow-x-clip px-3 py-4 sm:px-4 sm:py-6">
      <div className="mb-5 flex items-center gap-3 sm:mb-6 sm:justify-center">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--md-sys-color-primary-container)] text-[var(--md-sys-color-on-primary-container)]">
          <Crosshair className="h-6 w-6" />
        </span>
        <div className="min-w-0 sm:text-center">
          <h1 className="text-xl font-bold tracking-tight text-[var(--md-sys-color-on-surface)] sm:text-3xl">
            {t("title")}
          </h1>
          <p className="mt-0.5 text-xs leading-5 text-[var(--md-sys-color-on-surface-variant)] sm:text-sm">
            {t("description")}
          </p>
        </div>
      </div>

      <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-4 lg:gap-6">
        <aside className="contents lg:order-1 lg:col-span-1 lg:block">
          <Card className={`order-1 ${COORDINATE_CARD_CLASS}`}>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Upload className={`h-4 w-4 ${COORDINATE_ICON_CLASS}`} />
                {t("uploadImage")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                aria-label={t("chooseImage")}
                onChange={(event) => event.target.files?.[0] && handleFileUpload(event.target.files[0])}
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
                onDrop={handleDrop}
                onDragOver={(event) => {
                  event.preventDefault()
                  setIsDragging(true)
                }}
                onDragLeave={() => setIsDragging(false)}
                className={`cursor-pointer rounded-xl border-2 border-dashed p-5 text-center outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--md-sys-color-primary)] ${
                  isDragging
                    ? "border-[var(--md-sys-color-primary)] bg-[var(--md-sys-color-primary-container)]/45"
                    : "border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container-low)] hover:border-[var(--md-sys-color-primary)]"
                }`}
              >
                <Upload className="mx-auto mb-2 h-8 w-8 text-[var(--md-sys-color-on-surface-variant)]" />
                <p className="text-sm text-[var(--md-sys-color-on-surface)]">{t("dropzone")}</p>
                <p className="mt-1 text-xs text-[var(--md-sys-color-on-surface-variant)]">
                  {t("maximum")} {formatFileSizeLimit(FILE_SIZE_LIMITS.coordinateImage)}
                </p>
              </div>

              {uploadError && (
                <p className="mt-3 rounded-lg bg-[var(--md-sys-color-error-container)] p-3 text-sm text-[var(--md-sys-color-on-error-container)]">
                  {uploadError}
                </p>
              )}

              {imageSize && (
                <div className="mt-3 space-y-2">
                  <p className="truncate text-sm" title={sourceFile?.name}>{sourceFile?.name}</p>
                  <p className="text-xs text-[var(--md-sys-color-on-surface-variant)]">
                    {imageSize.width} × {imageSize.height} {t("pixels")}
                  </p>
                  <Button variant="outline" size="sm" onClick={clearImage} className="w-full rounded-full">
                    <Trash2 className="mr-1 h-4 w-4" />
                    {t("clearImage")}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="order-3 space-y-4 lg:mt-4">
          <Card className={COORDINATE_CARD_CLASS}>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Ruler className={`h-4 w-4 ${COORDINATE_ICON_CLASS}`} />
                {t("coordinateFormat")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Select value={coordinateFormat} onValueChange={(v) => setCoordinateFormat(v as CoordinateFormat)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pixel">{t("pixelFormat")}</SelectItem>
                  <SelectItem value="percent">{t("percentFormat")}</SelectItem>
                  <SelectItem value="permille">{t("permilleFormat")}</SelectItem>
                  <SelectItem value="permyriad">{t("permyriadFormat")}</SelectItem>
                </SelectContent>
              </Select>
              
              <div className="space-y-1 text-xs leading-5 text-[var(--md-sys-color-on-surface-variant)]">
                <p>• {t("pixelDescription")}</p>
                <p>• {t("percentDescription")}</p>
                <p>• {t("permilleDescription")}</p>
                <p>• {t("permyriadDescription")}</p>
              </div>
            </CardContent>
          </Card>

          <Card className={COORDINATE_CARD_CLASS}>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Grid3X3 className={`h-4 w-4 ${COORDINATE_ICON_CLASS}`} />
                {t("displaySettings")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="show-crosshair">{t("showCrosshair")}</Label>
                <Switch
                  id="show-crosshair"
                  checked={showCrosshair}
                  onCheckedChange={setShowCrosshair}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="show-grid">{t("showGrid")}</Label>
                <Switch
                  id="show-grid"
                  checked={showGrid}
                  onCheckedChange={setShowGrid}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm">{t("zoom")}: {zoom}%</Label>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    aria-label={t("zoomOut")}
                    className="h-10 w-10 rounded-full p-0"
                    onClick={() => setZoom(Math.max(25, zoom - 25))}
                  >
                    <ZoomOut className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="min-h-10 flex-1 rounded-full text-sm"
                    onClick={() => setZoom(100)}
                    title={t("resetZoom")}
                  >
                    {zoom}%
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    aria-label={t("zoomIn")}
                    className="h-10 w-10 rounded-full p-0"
                    onClick={() => setZoom(Math.min(200, zoom + 25))}
                  >
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {imageSize && (
            <Card className={COORDINATE_CARD_CLASS}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Plus className={`h-4 w-4 ${COORDINATE_ICON_CLASS}`} />
                  {t("manualAdd")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Select value={manualFormat} onValueChange={(v) => setManualFormat(v as CoordinateFormat)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pixel">{t("pixelFormat")}</SelectItem>
                    <SelectItem value="percent">{t("percentFormat")}</SelectItem>
                    <SelectItem value="permille">{t("permilleFormat")}</SelectItem>
                    <SelectItem value="permyriad">{t("permyriadFormat")}</SelectItem>
                  </SelectContent>
                </Select>
                
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">X</Label>
                    <Input
                      type="number"
                      placeholder="X"
                      value={manualX}
                      min={0}
                      step="any"
                      onChange={(event) => {
                        setManualX(event.target.value)
                        setManualError("")
                      }}
                      onKeyDown={(e) => e.key === "Enter" && addManualPoint()}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Y</Label>
                    <Input
                      type="number"
                      placeholder="Y"
                      value={manualY}
                      min={0}
                      step="any"
                      onChange={(event) => {
                        setManualY(event.target.value)
                        setManualError("")
                      }}
                      onKeyDown={(e) => e.key === "Enter" && addManualPoint()}
                    />
                  </div>
                </div>
                
                <Button 
                  onClick={addManualPoint} 
                  className="w-full"
                  disabled={!manualX || !manualY}
                >
                  <MapPin className="h-4 w-4 mr-1" />
                  {t("addMarker")}
                </Button>

                {manualError && (
                  <p className="rounded-xl bg-[var(--md-sys-color-error-container)] px-3 py-2 text-xs text-[var(--md-sys-color-on-error-container)]">
                    {manualError}
                  </p>
                )}

                <div className="text-xs text-[var(--md-sys-color-on-surface-variant)]">
                  {manualFormat === "pixel" && <p>{t("range")}: 0-{imageSize.width - 1}, 0-{imageSize.height - 1}</p>}
                  {manualFormat === "percent" && <p>{t("range")}: 0-100</p>}
                  {manualFormat === "permille" && <p>{t("range")}: 0-1000</p>}
                  {manualFormat === "permyriad" && <p>{t("range")}: 0-10000</p>}
                </div>
              </CardContent>
            </Card>
          )}

          {currentCoord && (
            <Card className="min-w-0 rounded-[var(--md-sys-shape-corner-large)] border-[var(--md-sys-color-primary)]/30 bg-[var(--md-sys-color-primary-container)]/35">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <MousePointer2 className={`h-4 w-4 ${COORDINATE_ICON_CLASS}`} />
                  {t("currentPosition")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="break-words font-mono text-xl font-bold text-[var(--md-sys-color-on-primary-container)] [overflow-wrap:anywhere] sm:text-2xl">
                  {formatCoordinate(currentCoord, coordinateFormat)}
                </div>
                <div className="space-y-1 text-xs text-[var(--md-sys-color-on-surface-variant)]">
                  <p>{t("pixels")}: ({currentCoord.pixelX}, {currentCoord.pixelY})</p>
                  <p>{t("percentage")}: ({currentCoord.x.toFixed(2)}%, {currentCoord.y.toFixed(2)}%)</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => copyCoordinate(currentCoord, "current")}
                    className="flex-1"
                  >
                    {copiedKey === "current" ? <Check className="mr-1 h-4 w-4" /> : <Copy className="mr-1 h-4 w-4" />}
                    {copiedKey === "current" ? t("copied") : t("copy")}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={saveCurrentPoint}
                    className="flex-1"
                  >
                    <MapPin className="h-4 w-4 mr-1" />
                    {t("save")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
          </div>
        </aside>

        <main className="order-2 min-w-0 space-y-4 lg:col-span-3">
          <Card className={`min-h-[20rem] sm:min-h-[31.25rem] ${COORDINATE_CARD_CLASS}`}>
            <CardHeader className="pb-3">
              <CardTitle className="flex flex-col gap-2 text-base sm:flex-row sm:items-center sm:justify-between">
                <span className="flex items-center gap-2">
                  <ImageIcon className={`h-4 w-4 ${COORDINATE_ICON_CLASS}`} />
                  {t("preview")}
                </span>
                {imageSize && (
                  <Badge variant="outline" className="w-fit whitespace-normal text-left">
                    {t("tapHint")}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="min-w-0">
              {!imageUrl ? (
                <button
                  type="button"
                  onClick={openFilePicker}
                  className="flex h-[15rem] w-full flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container-low)] text-[var(--md-sys-color-on-surface-variant)] transition-colors hover:border-[var(--md-sys-color-primary)] sm:h-[25rem]"
                >
                  <ImageIcon className="mb-4 h-14 w-14" />
                  <span>{t("uploadPrompt")}</span>
                  <span className="mt-1 text-xs">{t("uploadPromptHint")}</span>
                </button>
              ) : (
                <div className="space-y-2">
                  {currentCoord && (
                    <div className="flex min-w-0 items-center justify-between gap-2 rounded-xl bg-[var(--md-sys-color-surface-container-low)] px-3 py-2 sm:hidden">
                      <code className="min-w-0 flex-1 truncate text-xs font-semibold" title={formatCoordinate(currentCoord, coordinateFormat)}>
                        {formatCoordinate(currentCoord, coordinateFormat)}
                      </code>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-10 w-10 shrink-0 rounded-full"
                        aria-label={t("copyCurrentAria")}
                        onClick={() => copyCoordinate(currentCoord, "preview-current")}
                      >
                        {copiedKey === "preview-current" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                  )}
                  <div
                    className="scrollbar-m3 relative max-h-[min(70dvh,37.5rem)] min-w-0 touch-pan-x touch-pan-y overflow-auto overscroll-contain rounded-xl bg-[var(--md-sys-color-surface-container-low)] [-webkit-overflow-scrolling:touch]"
                    tabIndex={0}
                    aria-label={t("imageCanvasAria")}
                  >
                    <div
                      className="relative inline-block max-w-full origin-top-left"
                      style={{ transform: `scale(${zoom / 100})` }}
                    >
                      {showGrid && (
                        <div
                          className="pointer-events-none absolute inset-0"
                          style={{
                            backgroundImage: `
                              linear-gradient(color-mix(in srgb, var(--md-sys-color-outline) 28%, transparent) 1px, transparent 1px),
                              linear-gradient(90deg, color-mix(in srgb, var(--md-sys-color-outline) 28%, transparent) 1px, transparent 1px)
                            `,
                            backgroundSize: "10% 10%",
                          }}
                        />
                      )}

                      <img
                        ref={imageRef}
                        src={imageUrl}
                        alt={t("previewAlt")}
                        className="block h-auto max-w-full cursor-crosshair select-none"
                        onLoad={(event) => {
                          setImageSize({
                            width: event.currentTarget.naturalWidth,
                            height: event.currentTarget.naturalHeight,
                          })
                        }}
                        onPointerDown={handlePointerDown}
                        onPointerMove={handlePointerMove}
                        onPointerUp={handlePointerUp}
                        onPointerCancel={() => {
                          pointerStartRef.current = null
                        }}
                        onPointerLeave={handlePointerLeave}
                        draggable={false}
                      />

                      {showCrosshair && currentCoord && imageRef.current && (
                        <>
                          <div
                            className="pointer-events-none absolute top-0 h-full w-px bg-[var(--md-sys-color-error)] opacity-70"
                            style={{ left: `${currentCoord.x}%` }}
                          />
                          <div
                            className="pointer-events-none absolute left-0 h-px w-full bg-[var(--md-sys-color-error)] opacity-70"
                            style={{ top: `${currentCoord.y}%` }}
                          />
                        </>
                      )}

                      {savedPoints.map((point, index) => (
                        <div
                          key={point.id}
                          className="pointer-events-none absolute"
                          style={{
                            left: `${point.coord.x}%`,
                            top: `${point.coord.y}%`,
                            transform: "translate(-50%, -50%)",
                          }}
                        >
                          <div
                            className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-[var(--md-sys-color-surface)] text-[9px] font-bold text-white shadow-lg"
                            style={{ backgroundColor: point.color }}
                          >
                            {index + 1}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {savedPoints.length > 0 && (
            <Card className={COORDINATE_CARD_CLASS}>
              <CardHeader className="pb-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <MapPin className={`h-4 w-4 ${COORDINATE_ICON_CLASS}`} />
                    {t("savedPoints")} ({savedPoints.length})
                  </CardTitle>
                  <div className="grid grid-cols-2 gap-2 sm:flex">
                    <Button size="sm" variant="outline" className="rounded-full" onClick={copyAllPoints}>
                      {copiedKey === "all" ? <Check className="mr-1 h-4 w-4" /> : <Copy className="mr-1 h-4 w-4" />}
                      {copiedKey === "all" ? t("copied") : t("copyAll")}
                    </Button>
                    <Button size="sm" variant="outline" className="rounded-full" onClick={() => setSavedPoints([])}>
                      <Trash2 className="mr-1 h-4 w-4" />
                      {t("clearAll")}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {savedPoints.map((point, index) => (
                    <div
                      key={point.id}
                      className="flex min-w-0 items-center gap-3 rounded-xl bg-[var(--md-sys-color-surface-container-low)] p-3"
                    >
                      <div
                        className="w-4 h-4 rounded-full flex-shrink-0"
                        style={{ backgroundColor: point.color }}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{t("point")} {index + 1}</p>
                        <p className="truncate font-mono text-xs text-[var(--md-sys-color-on-surface-variant)]">
                          {formatCoordinate(point.coord, coordinateFormat)}
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-10 w-10 rounded-full"
                          aria-label={`${t("copy")} ${t("point")} ${index + 1}`}
                          onClick={() => copyCoordinate(point.coord, point.id)}
                        >
                          {copiedKey === point.id ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-10 w-10 rounded-full"
                          aria-label={`${t("delete")} ${t("point")} ${index + 1}`}
                          onClick={() => removePoint(point.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </main>
      </div>
    </div>
  )
}
