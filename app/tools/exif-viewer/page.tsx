"use client"

import { copyTextToClipboard as writeClipboardText } from "@/lib/clipboard"
import { createClientId } from "@/lib/client-id"

import { useState, useRef, useCallback, useMemo, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { Progress } from "@/components/ui/progress"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useObjectUrlRegistry } from "@/hooks/use-object-url"
import { useToast } from "@/hooks/use-toast"
import { useTranslations } from "@/hooks/use-translations"
import { formatExifDate } from "@/lib/exif-date"
import { downloadBlob } from "@/lib/object-url"
import {
  Upload, ImageIcon, MapPin, Camera, Calendar, Info, X, Download,
  ExternalLink, Search, Filter, Grid3X3, List, Eye, Copy,
  FileImage, Settings, Zap, Globe, Compass, Palette,
  Maximize2, RotateCw, AlertCircle, CheckCircle2,
  ChevronDown, ChevronUp, Trash2, Star
} from "lucide-react"

interface ExifData {
  [key: string]: any
}

interface ProcessedImage {
  id: string
  file: File
  imageUrl: string
  exifData: ExifData | null
  error: string | null
  isProcessing: boolean
  isStarred: boolean
}

interface ExifField {
  key: string
  label: string
  value: any
  formattedValue: string
  category: string
  important: boolean
}

interface ExifCategory {
  name: string
  icon: React.ReactNode
  fields: ExifField[]
  color: string
}

export default function ExifViewerPage() {
  const { toast } = useToast()
  const t = useTranslations("exifViewer")

  // 状态管理
  const [images, setImages] = useState<ProcessedImage[]>([])
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<string>("all")
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  const [showImportantOnly, setShowImportantOnly] = useState(false)
  const [autoExpandCategories, setAutoExpandCategories] = useState(true)
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())
  const [exportFormat, setExportFormat] = useState<"json" | "csv" | "txt">("json")

  const fileInputRef = useRef<HTMLInputElement>(null)
  const mountedRef = useRef(true)
  const objectUrls = useObjectUrlRegistry()

  useEffect(() => {
    mountedRef.current = true

    return () => {
      mountedRef.current = false
    }
  }, [])

  // 支持的图片格式
  const supportedFormats = ['image/jpeg', 'image/png', 'image/tiff', 'image/webp', 'image/bmp', 'image/gif']

  // 处理单个文件
  const processFile = useCallback(async (file: File): Promise<ProcessedImage> => {
    const imageId = createClientId("exif")
    const imageUrl = objectUrls.create(file)

    const processedImage: ProcessedImage = {
      id: imageId,
      file,
      imageUrl,
      exifData: null,
      error: null,
      isProcessing: true,
      isStarred: false
    }

    try {
      // 动态导入 exifr
      const exifr = (await import("exifr")).default

      // 解析EXIF数据，包含所有可能的元数据
      const exif = await exifr.parse(file, {
        tiff: true,
        xmp: true,
        icc: true,
        iptc: true,
        jfif: true,
        ihdr: true,
      } as any)

      processedImage.exifData = exif || {}
      processedImage.isProcessing = false

      return processedImage
    } catch (error) {
      console.error('EXIF解析错误:', error)
      processedImage.error = t("parseFailed").replace("{error}", error instanceof Error ? error.message : t("unknownError"))
      processedImage.isProcessing = false
      return processedImage
    }
  }, [objectUrls, t])

  // 处理文件选择
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return

    setIsProcessing(true)

    try {
      const validFiles = files.filter(file => supportedFormats.includes(file.type))

      if (validFiles.length === 0) {
        toast({
          title: t("unsupportedFormatTitle"),
          description: t("unsupportedFormatDescription"),
          variant: "destructive"
        })
        return
      }

      if (validFiles.length !== files.length) {
        toast({
          title: t("filesSkippedTitle"),
          description: t("filesSkippedDescription").replace("{count}", String(files.length - validFiles.length)),
        })
      }

      // 并行处理多个文件
      const processedImages = await Promise.all(
        validFiles.map(file => processFile(file))
      )

      if (!mountedRef.current) {
        return
      }

      setImages(prev => [...prev, ...processedImages])

      // 自动选择第一张图片
      if (processedImages.length > 0) {
        setSelectedImageId(processedImages[0].id)
      }

      toast({
        title: t("processedTitle"),
        description: t("processedDescription").replace("{count}", String(processedImages.length)),
      })
    } finally {
      if (mountedRef.current) {
        setIsProcessing(false)
      }
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  // 拖拽处理
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const files = Array.from(e.dataTransfer.files).filter(file =>
      supportedFormats.includes(file.type)
    )

    if (files.length === 0) return

    setIsProcessing(true)

    try {
      const processedImages = await Promise.all(
        files.map(file => processFile(file))
      )

      if (!mountedRef.current) {
        return
      }

      setImages(prev => [...prev, ...processedImages])

      if (processedImages.length > 0) {
        setSelectedImageId(processedImages[0].id)
      }
    } finally {
      if (mountedRef.current) {
        setIsProcessing(false)
      }
    }
  }

  // 删除图片
  const removeImage = (id: string) => {
    setImages(prev => {
      const removedImage = prev.find(img => img.id === id)
      objectUrls.revoke(removedImage?.imageUrl)

      const filtered = prev.filter(img => img.id !== id)
      if (selectedImageId === id && filtered.length > 0) {
        setSelectedImageId(filtered[0].id)
      } else if (filtered.length === 0) {
        setSelectedImageId(null)
      }
      return filtered
    })
  }

  // 清空所有图片
  const clearAllImages = () => {
    images.forEach((image) => objectUrls.revoke(image.imageUrl))
    setImages([])
    setSelectedImageId(null)
  }

  // 切换收藏状态
  const toggleStar = (id: string) => {
    setImages(prev => prev.map(img =>
      img.id === id ? { ...img, isStarred: !img.isStarred } : img
    ))
  }

  // 复制到剪贴板
  const copyToClipboard = async (text: string, label: string) => {
    try {
      if (!await writeClipboardText(text)) throw new Error("Clipboard unavailable")
      toast({
        title: t("copied"),
        description: t("copiedToClipboard").replace("{label}", label),
      })
    } catch (error) {
      toast({
        title: t("copyFailed"),
        description: t("copyFailedDescription"),
        variant: "destructive"
      })
    }
  }

  // 处理EXIF数据分类
  const categorizeExifData = useCallback((exifData: ExifData): ExifCategory[] => {
    if (!exifData) return []

    const categories: ExifCategory[] = [
      {
        name: "camera",
        icon: <Camera className="h-4 w-4" />,
        fields: [],
        color: "bg-[var(--md-sys-color-primary)]"
      },
      {
        name: "image",
        icon: <ImageIcon className="h-4 w-4" />,
        fields: [],
        color: "bg-[var(--md-sys-color-success)]"
      },
      {
        name: "location",
        icon: <MapPin className="h-4 w-4" />,
        fields: [],
        color: "bg-[var(--md-sys-color-error)]"
      },
      {
        name: "datetime",
        icon: <Calendar className="h-4 w-4" />,
        fields: [],
        color: "bg-[var(--md-sys-color-tertiary)]"
      },
      {
        name: "technical",
        icon: <Settings className="h-4 w-4" />,
        fields: [],
        color: "bg-[var(--md-sys-color-warning)]"
      },
      {
        name: "other",
        icon: <Info className="h-4 w-4" />,
        fields: [],
        color: "bg-[var(--md-sys-color-outline)]"
      }
    ]

    // 定义字段映射和重要性
    const fieldMappings: Record<string, { category: string, label: string, important: boolean, formatter?: (value: any) => string }> = {
      // 相机信息
      Make: { category: "camera", label: t("make"), important: true },
      Model: { category: "camera", label: t("model"), important: true },
      LensMake: { category: "camera", label: t("lensMake"), important: false },
      LensModel: { category: "camera", label: t("lensModel"), important: false },
      FNumber: { category: "camera", label: t("aperture"), important: true, formatter: (v) => `f/${v}` },
      ExposureTime: { category: "camera", label: t("shutterSpeed"), important: true, formatter: (v) => v < 1 ? `1/${Math.round(1/v)}s` : `${v}s` },
      ISO: { category: "camera", label: t("iso"), important: true },
      FocalLength: { category: "camera", label: t("focalLength"), important: true, formatter: (v) => `${v}mm` },
      FocalLengthIn35mmFormat: { category: "camera", label: t("focalLength35mm"), important: false, formatter: (v) => `${v}mm` },
      Flash: { category: "camera", label: t("flash"), important: false },
      WhiteBalance: { category: "camera", label: t("whiteBalance"), important: false },
      ExposureMode: { category: "camera", label: t("exposureMode"), important: false },
      MeteringMode: { category: "camera", label: t("meteringMode"), important: false },

      // 图片信息
      ImageWidth: { category: "image", label: t("imageWidth"), important: true, formatter: (v) => `${v}px` },
      ImageHeight: { category: "image", label: t("imageHeight"), important: true, formatter: (v) => `${v}px` },
      XResolution: { category: "image", label: t("xResolution"), important: false, formatter: (v) => `${v} dpi` },
      YResolution: { category: "image", label: t("yResolution"), important: false, formatter: (v) => `${v} dpi` },
      Orientation: { category: "image", label: t("orientation"), important: false },
      ColorSpace: { category: "image", label: t("colorSpace"), important: false },
      BitsPerSample: { category: "image", label: t("bitDepth"), important: false },
      Compression: { category: "image", label: t("compression"), important: false },
      PhotometricInterpretation: { category: "image", label: t("photometricInterpretation"), important: false },

      // 位置信息
      latitude: { category: "location", label: t("latitude"), important: true, formatter: (v) => `${v.toFixed(6)}°` },
      longitude: { category: "location", label: t("longitude"), important: true, formatter: (v) => `${v.toFixed(6)}°` },
      GPSAltitude: { category: "location", label: t("altitude"), important: false, formatter: (v) => `${v}m` },
      GPSImgDirection: { category: "location", label: t("gpsDirection"), important: false, formatter: (v) => `${v}°` },
      GPSSpeed: { category: "location", label: t("gpsSpeed"), important: false },

      // 日期时间
      DateTimeOriginal: { category: "datetime", label: t("captureTime"), important: true, formatter: formatExifDate },
      DateTime: { category: "datetime", label: t("modifiedTime"), important: false, formatter: formatExifDate },
      CreateDate: { category: "datetime", label: t("createTime"), important: false, formatter: formatExifDate },
      OffsetTime: { category: "datetime", label: t("timezoneOffset"), important: false },
      OffsetTimeOriginal: { category: "datetime", label: t("timezoneOffsetOriginal"), important: false },

      // 技术信息
      Software: { category: "technical", label: t("software"), important: false },
      Artist: { category: "technical", label: t("artist"), important: false },
      Copyright: { category: "technical", label: t("copyright"), important: false },
      ImageDescription: { category: "technical", label: t("imageDescription"), important: false },
      UserComment: { category: "technical", label: t("userComment"), important: false },
      SceneCaptureType: { category: "technical", label: t("sceneType"), important: false },
      GainControl: { category: "technical", label: t("gainControl"), important: false },
      Contrast: { category: "technical", label: t("contrast"), important: false },
      Saturation: { category: "technical", label: t("saturation"), important: false },
      Sharpness: { category: "technical", label: t("sharpness"), important: false },
    }

    // 处理所有EXIF字段
    Object.entries(exifData).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return

      const mapping = fieldMappings[key]
      let categoryName = mapping?.category || "other"
      let label = mapping?.label || key
      let important = mapping?.important || false
      let formattedValue = ""

      // 格式化值
      if (mapping?.formatter) {
        formattedValue = mapping.formatter(value)
      } else if (typeof value === "object" && value !== null) {
        if (value.value !== undefined) {
          formattedValue = value.value.toString()
        } else {
          formattedValue = JSON.stringify(value)
        }
      } else if (Array.isArray(value)) {
        formattedValue = value.join(", ")
      } else {
        formattedValue = value.toString()
      }

      // 限制显示长度
      if (formattedValue.length > 100) {
        formattedValue = formattedValue.substring(0, 100) + "..."
      }

      const field: ExifField = {
        key,
        label,
        value,
        formattedValue,
        category: categoryName,
        important
      }

      const category = categories.find(c => c.name === categoryName)
      if (category) {
        category.fields.push(field)
      }
    })

    // 过滤掉空分类
    return categories.filter(category => category.fields.length > 0)
  }, [t])

  // 过滤EXIF字段
  const filteredFields = useMemo(() => {
    const selectedImage = images.find(img => img.id === selectedImageId)
    if (!selectedImage?.exifData) return []

    const categories = categorizeExifData(selectedImage.exifData)
    let allFields: ExifField[] = []

    categories.forEach(category => {
      if (selectedCategory === "all" || category.name === selectedCategory) {
        allFields.push(...category.fields)
      }
    })

    // 应用搜索过滤
    if (searchQuery) {
      allFields = allFields.filter(field =>
        field.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        field.formattedValue.toLowerCase().includes(searchQuery.toLowerCase()) ||
        field.key.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }

    // 应用重要性过滤
    if (showImportantOnly) {
      allFields = allFields.filter(field => field.important)
    }

    return allFields
  }, [selectedImageId, images, categorizeExifData, selectedCategory, searchQuery, showImportantOnly])

  // 导出数据
  const exportData = () => {
    const selectedImage = images.find(img => img.id === selectedImageId)
    if (!selectedImage?.exifData) return

    let content = ""
    let filename = `exif_${selectedImage.file.name.split('.')[0]}`

    switch (exportFormat) {
      case "json":
        content = JSON.stringify(selectedImage.exifData, null, 2)
        filename += ".json"
        break
      case "csv":
        const csvLines = ["Key,Label,Value"]
        filteredFields.forEach(field => {
          csvLines.push(`"${field.key}","${field.label}","${field.formattedValue.replace(/"/g, '""')}"`)
        })
        content = csvLines.join('\n')
        filename += ".csv"
        break
      case "txt":
        const txtLines = [`EXIF Data for ${selectedImage.file.name}`, "=".repeat(50), ""]
        filteredFields.forEach(field => {
          txtLines.push(`${field.label}: ${field.formattedValue}`)
        })
        content = txtLines.join('\n')
        filename += ".txt"
        break
    }

    downloadBlob(new Blob([content], { type: "text/plain" }), filename)

    toast({
      title: t("exportedTitle"),
      description: t("exportedDescription").replace("{filename}", filename),
    })
  }

  // 打开地图
  const openInMaps = (lat: number, lng: number) => {
    const url = `https://maps.google.com/maps?q=${lat},${lng}`
    window.open(url, '_blank')
  }

  // 选中的图片
  const selectedImage = images.find(img => img.id === selectedImageId)
  const categories = selectedImage?.exifData ? categorizeExifData(selectedImage.exifData) : []

  return (
    <div className="container mx-auto py-6 px-4 max-w-7xl">
      {/* 页面标题 */}
      <div className="text-center space-y-4 mb-8">
        <h1 className="text-3xl font-bold text-[var(--md-sys-color-on-surface)]">
          {t("title")}
        </h1>
        <p className="text-[var(--md-sys-color-on-surface-variant)] max-w-2xl mx-auto">
          {t("description")}
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        {/* 左侧：上传和图片列表 */}
        <div className="xl:col-span-1 space-y-6">
          {/* 上传区域 */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                {t("upload")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div
                className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${
                  isDragging
                    ? "border-[var(--md-sys-color-primary)] bg-[var(--md-sys-color-primary-container)]/45"
                    : "border-[var(--md-sys-color-outline-variant)] hover:border-[var(--md-sys-color-outline)]"
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                role="button"
                tabIndex={0}
                aria-label={t("selectImage")}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault()
                    fileInputRef.current?.click()
                  }
                }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />

                {isProcessing ? (
                  <div className="space-y-3">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--md-sys-color-primary)] mx-auto"></div>
                    <div className="text-sm">{t("parsingExif")}</div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <ImageIcon className="mx-auto h-8 w-8 text-[var(--md-sys-color-on-surface-variant)]" />
                    <div>
                      <p className="font-medium text-[var(--md-sys-color-on-surface)]">
                        {t("dropOrClickToUpload")}
                      </p>
                      <p className="text-xs text-[var(--md-sys-color-on-surface-variant)] mt-1">
                        {t("supportedFormats")}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {images.length > 0 && (
                <div className="mt-4 flex justify-between">
                  <span className="text-sm text-[var(--md-sys-color-on-surface-variant)]">{t("imageCount").replace("{count}", String(images.length))}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearAllImages}
                    className="text-[var(--md-sys-color-error)] hover:text-[var(--md-sys-color-error)]"
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    {t("clearAll")}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 图片列表 */}
          {images.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2">
                  <Grid3X3 className="h-5 w-5" />
                  {t("imageList")}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="max-h-96 overflow-y-auto">
                  {images.map((image) => (
                    <div
                      key={image.id}
                      className={`flex items-center gap-3 p-3 cursor-pointer transition-colors border-b border-[var(--md-sys-color-outline-variant)] last:border-b-0 ${
                        selectedImageId === image.id
                          ? "bg-[var(--md-sys-color-primary-container)]/45"
                          : "hover:bg-[var(--md-sys-color-surface-container-low)]"
                      }`}
                      onClick={() => setSelectedImageId(image.id)}
                    >
                      <img
                        src={image.imageUrl}
                        alt={image.file.name}
                        className="w-12 h-12 object-cover rounded"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{image.file.name}</div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-[var(--md-sys-color-on-surface-variant)]">
                            {(image.file.size / 1024).toFixed(1)} KB
                          </span>
                          {image.isProcessing && (
                            <Badge variant="secondary" className="text-xs">
                              {t("processingBadge")}
                            </Badge>
                          )}
                          {image.error && (
                            <Badge variant="destructive" className="text-xs">
                              {t("errorBadge")}
                            </Badge>
                          )}
                          {image.exifData && (
                            <Badge variant="default" className="text-xs">
                              {t("fieldCountBadge").replace("{count}", String(Object.keys(image.exifData).length))}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            toggleStar(image.id)
                          }}
                        >
                          <Star className={`h-4 w-4 ${image.isStarred ? 'fill-[var(--md-sys-color-warning)] text-[var(--md-sys-color-warning)]' : ''}`} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            removeImage(image.id)
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* 右侧：EXIF数据显示 */}
        <div className="xl:col-span-3 space-y-6">
          {selectedImage ? (
            <>
              {/* 图片预览和基本信息 */}
              <Card>
                <CardContent className="p-6">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* 图片预览 */}
                    <div>
                      <div className="relative rounded-lg overflow-hidden bg-[var(--md-sys-color-surface-container)]">
                        <img
                          src={selectedImage.imageUrl}
                          alt={selectedImage.file.name}
                          className="w-full h-64 object-contain"
                        />
                        <div className="absolute top-2 right-2">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => window.open(selectedImage.imageUrl, '_blank')}
                          >
                            <Maximize2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* 基本信息和操作 */}
                    <div className="space-y-4">
                      <div>
                        <h3 className="font-medium text-lg mb-2">{selectedImage.file.name}</h3>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-[var(--md-sys-color-on-surface-variant)]">{t("fileSize")}:</span>
                            <span>{(selectedImage.file.size / 1024).toFixed(1)} KB</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-[var(--md-sys-color-on-surface-variant)]">{t("fileType")}:</span>
                            <span>{selectedImage.file.type}</span>
                          </div>
                          {selectedImage.exifData && (
                            <>
                              {selectedImage.exifData.ImageWidth && selectedImage.exifData.ImageHeight && (
                                <div className="flex justify-between">
                                  <span className="text-[var(--md-sys-color-on-surface-variant)]">{t("dimensions")}:</span>
                                  <span>{selectedImage.exifData.ImageWidth} × {selectedImage.exifData.ImageHeight}</span>
                                </div>
                              )}
                              <div className="flex justify-between">
                                <span className="text-[var(--md-sys-color-on-surface-variant)]">{t("exifFields")}:</span>
                                <span>{t("fieldUnit").replace("{count}", String(Object.keys(selectedImage.exifData).length))}</span>
                              </div>
                            </>
                          )}
                        </div>
                      </div>

                      {/* 快速信息 */}
                      {selectedImage.exifData && (
                        <div className="grid grid-cols-2 gap-2">
                          {selectedImage.exifData.Make && (
                            <div className="text-center p-2 bg-[var(--md-sys-color-surface-container-low)] rounded">
                              <Camera className="h-4 w-4 mx-auto mb-1 text-[var(--md-sys-color-primary)]" />
                              <div className="text-xs text-[var(--md-sys-color-on-surface-variant)]">{t("camera")}</div>
                              <div className="text-sm font-medium">{selectedImage.exifData.Make}</div>
                            </div>
                          )}
                          {selectedImage.exifData.DateTimeOriginal && (
                            <div className="text-center p-2 bg-[var(--md-sys-color-surface-container-low)] rounded">
                              <Calendar className="h-4 w-4 mx-auto mb-1 text-[var(--md-sys-color-success)]" />
                              <div className="text-xs text-[var(--md-sys-color-on-surface-variant)]">{t("captureTime")}</div>
                              <div className="text-sm font-medium">
                                {formatExifDate(selectedImage.exifData.DateTimeOriginal, true)}
                              </div>
                            </div>
                          )}
                          {selectedImage.exifData.latitude && selectedImage.exifData.longitude && (
                            <div className="text-center p-2 bg-[var(--md-sys-color-surface-container-low)] rounded">
                              <MapPin className="h-4 w-4 mx-auto mb-1 text-[var(--md-sys-color-error)]" />
                              <div className="text-xs text-[var(--md-sys-color-on-surface-variant)]">{t("location")}</div>
                              <Button
                                variant="link"
                                size="sm"
                                className="text-sm font-medium h-auto p-0"
                                onClick={() => openInMaps(selectedImage.exifData!.latitude, selectedImage.exifData!.longitude)}
                              >
                                {t("viewOnMap")}
                              </Button>
                            </div>
                          )}
                          {selectedImage.exifData.FNumber && (
                            <div className="text-center p-2 bg-[var(--md-sys-color-surface-container-low)] rounded">
                              <Palette className="h-4 w-4 mx-auto mb-1 text-[var(--md-sys-color-tertiary)]" />
                              <div className="text-xs text-[var(--md-sys-color-on-surface-variant)]">{t("aperture")}</div>
                              <div className="text-sm font-medium">f/{selectedImage.exifData.FNumber}</div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* 操作按钮 */}
                      <div className="space-y-2">
                        <div className="flex gap-2">
                          <Select value={exportFormat} onValueChange={(value: "json" | "csv" | "txt") => setExportFormat(value)}>
                            <SelectTrigger className="flex-1" aria-label={t("exportFormat")}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="json">{t("jsonFormat")}</SelectItem>
                              <SelectItem value="csv">{t("csvFormat")}</SelectItem>
                              <SelectItem value="txt">{t("txtFormat")}</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button onClick={exportData} disabled={!selectedImage.exifData}>
                            <Download className="h-4 w-4 mr-2" />
                            {t("export")}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 搜索和过滤 */}
              <Card>
                <CardContent className="p-4">
                  <div className="flex flex-wrap gap-4 items-center">
                    <div className="flex-1 min-w-48">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-[var(--md-sys-color-on-surface-variant)]" />
                        <Input
                          placeholder={t("searchPlaceholder")}
                          aria-label={t("searchPlaceholder")}
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                    </div>

                    <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                      <SelectTrigger className="w-48" aria-label={t("filterCategory")}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{t("allCategories")}</SelectItem>
                        <SelectItem value="camera">{t("cameraInfo")}</SelectItem>
                        <SelectItem value="image">{t("imageInfo")}</SelectItem>
                        <SelectItem value="location">{t("locationInfo")}</SelectItem>
                        <SelectItem value="datetime">{t("dateTimeInfo")}</SelectItem>
                        <SelectItem value="technical">{t("technicalInfo")}</SelectItem>
                        <SelectItem value="other">{t("otherInfo")}</SelectItem>
                      </SelectContent>
                    </Select>

                    <div className="flex items-center space-x-2">
                      <Switch
                        id="important-only"
                        checked={showImportantOnly}
                        onCheckedChange={setShowImportantOnly}
                      />
                      <Label htmlFor="important-only" className="text-sm">{t("importantOnly")}</Label>
                    </div>

                    <div className="text-sm text-[var(--md-sys-color-on-surface-variant)]">
                      {t("fieldCount").replace("{count}", String(filteredFields.length))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* EXIF数据展示 */}
              {selectedImage.error ? (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{selectedImage.error}</AlertDescription>
                </Alert>
              ) : selectedImage.exifData ? (
                <div className="space-y-4">
                  {categories.map((category, index) => (
                    <Card key={category.name}>
                      <CardHeader
                        className="cursor-pointer"
                        onClick={() => {
                          const newExpanded = new Set(expandedCategories)
                          if (newExpanded.has(category.name)) {
                            newExpanded.delete(category.name)
                          } else {
                            newExpanded.add(category.name)
                          }
                          setExpandedCategories(newExpanded)
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`w-3 h-3 rounded-full ${category.color}`}></div>
                            {category.icon}
                            <CardTitle className="text-lg">
                              {category.name === "camera" && t("cameraInfo")}
                              {category.name === "image" && t("imageInfo")}
                              {category.name === "location" && t("locationInfo")}
                              {category.name === "datetime" && t("dateTimeInfo")}
                              {category.name === "technical" && t("technicalInfo")}
                              {category.name === "other" && t("otherInfo")}
                            </CardTitle>
                            <Badge variant="secondary">{category.fields.length}</Badge>
                          </div>
                          {expandedCategories.has(category.name) || autoExpandCategories ?
                            <ChevronUp className="h-4 w-4" /> :
                            <ChevronDown className="h-4 w-4" />
                          }
                        </div>
                      </CardHeader>

                      {(expandedCategories.has(category.name) || autoExpandCategories) && (
                        <CardContent>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {category.fields.filter(field => {
                              if (selectedCategory !== "all" && field.category !== selectedCategory) return false
                              if (searchQuery && !field.label.toLowerCase().includes(searchQuery.toLowerCase()) &&
                                  !field.formattedValue.toLowerCase().includes(searchQuery.toLowerCase()) &&
                                  !field.key.toLowerCase().includes(searchQuery.toLowerCase())) return false
                              if (showImportantOnly && !field.important) return false
                              return true
                            }).map((field, fieldIndex) => (
                              <div key={fieldIndex} className="p-3 border rounded-lg hover:bg-[var(--md-sys-color-surface-container-low)] transition-colors">
                                <div className="flex items-start justify-between">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                      <div className="font-medium text-sm text-[var(--md-sys-color-on-surface-variant)]">
                                        {field.label}
                                      </div>
                                      {field.important && (
                                        <Star className="h-3 w-3 fill-[var(--md-sys-color-warning)] text-[var(--md-sys-color-warning)]" />
                                      )}
                                    </div>
                                    <div className="text-sm break-words">
                                      {field.key === "latitude" || field.key === "longitude" ? (
                                        <Button
                                          variant="link"
                                          size="sm"
                                          className="h-auto p-0 text-left"
                                          onClick={() => selectedImage.exifData?.latitude && selectedImage.exifData?.longitude &&
                                            openInMaps(selectedImage.exifData.latitude, selectedImage.exifData.longitude)}
                                        >
                                          {field.formattedValue}
                                          <ExternalLink className="h-3 w-3 ml-1" />
                                        </Button>
                                      ) : (
                                        field.formattedValue
                                      )}
                                    </div>
                                  </div>
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => copyToClipboard(field.formattedValue, field.label)}
                                        >
                                          <Copy className="h-3 w-3" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>{t("copyValue")}</TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                </div>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      )}
                    </Card>
                  ))}
                </div>
              ) : (
                <Card>
                  <CardContent className="py-12 text-center">
                    <Info className="h-12 w-12 mx-auto mb-4 text-[var(--md-sys-color-on-surface-variant)]" />
                    <p className="text-lg font-medium text-[var(--md-sys-color-on-surface-variant)] mb-2">
                      {t("noExifTitle")}
                    </p>
                    <p className="text-sm text-[var(--md-sys-color-on-surface-variant)]">
                      {t("noExifDescription")}
                    </p>
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <Card>
              <CardContent className="py-16 text-center">
                <ImageIcon className="h-16 w-16 mx-auto mb-4 text-[var(--md-sys-color-on-surface-variant)]" />
                <p className="text-xl font-medium text-[var(--md-sys-color-on-surface-variant)] mb-2">
                  {t("selectImagePrompt")}
                </p>
                <p className="text-[var(--md-sys-color-on-surface-variant)]">
                  {t("uploadPrompt")}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
