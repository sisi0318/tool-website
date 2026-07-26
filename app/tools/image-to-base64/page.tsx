"use client"

import { useState, useRef, useCallback, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useToast } from "@/hooks/use-toast"
import { useTranslations } from "@/hooks/use-translations"
import { withObjectUrl } from "@/lib/object-url"
import { createClientId } from "@/lib/client-id"
import { copyTextToClipboard as writeClipboardText } from "@/lib/clipboard"
import {
  FILE_SIZE_LIMITS,
  formatFileSizeLimit,
  isFileWithinLimit,
} from "@/lib/file-limits"
import {
  Clipboard, Download, Upload, X, ImageIcon,
  FileImage, Eye, Trash2, RefreshCw, AlertCircle,
  ArrowRightLeft, Zap, Maximize2
} from "lucide-react"

interface ProcessedImage {
  id: string
  name: string
  mimeType: string
  previewUrl: string
  base64: string
  dimensions: { width: number; height: number }
  size: number
  format: string
}

type OutputFormat = "base64" | "dataUrl" | "css" | "html"

const SUPPORTED_FORMATS = {
  "image/jpeg": { ext: "jpg", name: "JPEG" },
  "image/png": { ext: "png", name: "PNG" },
  "image/gif": { ext: "gif", name: "GIF" },
  "image/webp": { ext: "webp", name: "WebP" },
  "image/bmp": { ext: "bmp", name: "BMP" },
  "image/svg+xml": { ext: "svg", name: "SVG" },
} as const

function getImageDataUrl(image: Pick<ProcessedImage, "mimeType" | "base64">): string {
  return `data:${image.mimeType};base64,${image.base64}`
}

function readFileAsBase64(file: File, errorMessage: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : ""
      const separatorIndex = result.indexOf(",")
      if (separatorIndex === -1) {
        reject(new Error(errorMessage))
        return
      }
      resolve(result.slice(separatorIndex + 1))
    }
    reader.onerror = () => reject(new Error(errorMessage))
    reader.readAsDataURL(file)
  })
}

function getImageDimensions(file: File, errorMessage: string): Promise<{ width: number; height: number }> {
  return withObjectUrl(file, (url) => new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight })
    image.onerror = () => reject(new Error(errorMessage))
    image.src = url
  }))
}

function generateImageOutput(
  image: ProcessedImage,
  outputFormat: OutputFormat,
  includePrefix: boolean,
): string {
  const dataUrl = getImageDataUrl(image)
  switch (outputFormat) {
    case "base64":
      return includePrefix ? dataUrl : image.base64
    case "dataUrl":
      return dataUrl
    case "css":
      return `background-image: url(${dataUrl});`
    case "html":
      return `<img src="${dataUrl}" alt="${image.name}" />`
    default:
      return image.base64
  }
}

function VirtualizedTextArea({
  value,
  isLarge = false,
  virtualizeText,
  showFullBase64,
  onToggleFull,
}: {
  value: string
  isLarge?: boolean
  virtualizeText: boolean
  showFullBase64: boolean
  onToggleFull: () => void
}) {
  const t = useTranslations("imageToBase64")

  const displayValue = useMemo(() => {
    if (!virtualizeText || !isLarge || value.length < 50000 || showFullBase64) {
      return value
    }

    const start = value.slice(0, 1000)
    const end = value.slice(-1000)
    const hiddenLength = value.length - 2000
    return `${start}\n\n${t("hiddenCharsMarker").replace("{count}", hiddenLength.toLocaleString())}\n\n${end}`
  }, [value, isLarge, showFullBase64, virtualizeText, t])

  const shouldShowToggle = virtualizeText && isLarge && value.length >= 50000

  return (
    <div className="space-y-2">
      <Textarea
        value={displayValue}
        readOnly
        className="font-mono text-xs h-[300px] resize-none"
      />
      {shouldShowToggle && (
        <div className="flex items-center justify-between text-xs text-[var(--md-sys-color-on-surface-variant)]">
          <span>
            {showFullBase64
              ? t("showingFullContent")
              : t("showingPartialContent")
                  .replace("{shown}", displayValue.length.toLocaleString())
                  .replace("{total}", value.length.toLocaleString())}
          </span>
          <Button variant="ghost" size="sm" onClick={onToggleFull}>
            {showFullBase64 ? t("collapse") : t("showAll")}
          </Button>
        </div>
      )}
    </div>
  )
}

export default function ImageToBase64() {
  const { toast } = useToast()
  const t = useTranslations("imageToBase64")

  // 状态管理
  const [activeTab, setActiveTab] = useState("image-to-base64")
  const [images, setImages] = useState<ProcessedImage[]>([])
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [includePrefix, setIncludePrefix] = useState(false)
  const [outputFormat, setOutputFormat] = useState<OutputFormat>("base64")
  const [copied, setCopied] = useState<Record<string, boolean>>({})

  // 性能优化相关状态
  const [showFullBase64, setShowFullBase64] = useState(false)
  const [previewQuality, setPreviewQuality] = useState(0.7) // 预览图片质量
  const [virtualizeText, setVirtualizeText] = useState(true) // 是否虚拟化长文本
  const [processingProgress, setProcessingProgress] = useState(0)
  const [showOriginalPreview, setShowOriginalPreview] = useState(false)

  // Base64 转图片相关状态
  const [base64Input, setBase64Input] = useState("")
  const [decodedImage, setDecodedImage] = useState<{
    dataUrl: string
    dimensions: { width: number; height: number }
    size: number
    format: string
  } | null>(null)
  const [decodeError, setDecodeError] = useState("")

  const fileInputRef = useRef<HTMLInputElement>(null)

  // 创建预览图片（用于缩略图，不影响原始编码）
  const createPreviewImage = useCallback((file: File): Promise<string> => {
    return withObjectUrl(file, (url) => new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      const img = new Image()

      img.onload = () => {
        try {
          // 计算预览尺寸（最大300px）
          const maxSize = 300
          let { width, height } = img

          if (width > maxSize || height > maxSize) {
            const ratio = Math.min(maxSize / width, maxSize / height)
            width *= ratio
            height *= ratio
          }

          canvas.width = width
          canvas.height = height
          ctx?.drawImage(img, 0, 0, width, height)

          // 使用较低质量生成预览
          const previewDataUrl = canvas.toDataURL('image/jpeg', previewQuality)
          resolve(previewDataUrl)
        } catch (error) {
          reject(error instanceof Error ? error : new Error(t("previewGenerationError")))
        }
      }

      img.onerror = () => reject(new Error(t("previewGenerationError")))
      img.src = url
    }))
  }, [previewQuality, t])

  // 处理单个文件（优化版本）
  const processFile = useCallback(async (file: File, onProgress?: (progress: number) => void): Promise<ProcessedImage | null> => {
    try {
      onProgress?.(10)

      // 验证文件类型
      if (!Object.keys(SUPPORTED_FORMATS).includes(file.type)) {
        toast({
          title: t("unsupportedFormatTitle"),
          description: t("supportedFormatsWithList").replace(
            "{formats}",
            Object.values(SUPPORTED_FORMATS).map(f => f.name).join(", "),
          ),
          variant: "destructive",
        })
        return null
      }

      if (!isFileWithinLimit(file, FILE_SIZE_LIMITS.imageBase64)) {
        toast({
          title: t("fileTooLargeTitle"),
          description: t("fileTooLargeDescription").replace(
            "{limit}",
            formatFileSizeLimit(FILE_SIZE_LIMITS.imageBase64),
          ),
          variant: "destructive",
        })
        return null
      }

      onProgress?.(30)

      // 并行读取编码、生成小尺寸预览并获取尺寸；只把 Base64 主体保存在状态中。
      const [base64, previewUrl, dimensions] = await Promise.all([
        readFileAsBase64(file, t("fileReadError")),
        createPreviewImage(file).catch(() => ""),
        getImageDimensions(file, t("imageDimensionsError")),
      ])

      onProgress?.(90)

      const processedImage: ProcessedImage = {
        id: createClientId("image"),
        name: file.name,
        mimeType: file.type,
        previewUrl,
        base64,
        dimensions,
        size: file.size,
        format: SUPPORTED_FORMATS[file.type as keyof typeof SUPPORTED_FORMATS]?.name || file.type,
      }

      onProgress?.(100)
      return processedImage
    } catch (error) {
      console.error('文件处理失败:', error)
      toast({
        title: t("processingFailedTitle"),
        description: error instanceof Error ? error.message : t("unknownError"),
        variant: "destructive",
      })
      return null
    }
  }, [toast, createPreviewImage, t])

  // 处理文件选择
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return

    setIsProcessing(true)
    setProcessingProgress(0)

    try {
      const processedImages: ProcessedImage[] = []

      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const processed = await processFile(file, (progress) => {
          const overallProgress = ((i * 100) + progress) / files.length
          setProcessingProgress(overallProgress)
        })
        if (processed) {
          processedImages.push(processed)
        }
      }

      if (processedImages.length > 0) {
        setImages(prev => [...prev, ...processedImages])
        setSelectedImageId(processedImages[0].id)
        setShowOriginalPreview(false)

        toast({
          title: t("processingCompleteTitle"),
          description: t("processingCompleteDescription").replace(
            "{count}",
            String(processedImages.length),
          ),
        })
      }
    } finally {
      setIsProcessing(false)
      setProcessingProgress(0)
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

    const files = Array.from(e.dataTransfer.files).filter(file => file.type.startsWith('image/'))
    if (files.length === 0) return

    setIsProcessing(true)
    setProcessingProgress(0)

    try {
      const processedImages: ProcessedImage[] = []

      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const processed = await processFile(file, (progress) => {
          const overallProgress = ((i * 100) + progress) / files.length
          setProcessingProgress(overallProgress)
        })
        if (processed) {
          processedImages.push(processed)
        }
      }

      if (processedImages.length > 0) {
        setImages(prev => [...prev, ...processedImages])
        setSelectedImageId(processedImages[0].id)
        setShowOriginalPreview(false)
      }
    } finally {
      setIsProcessing(false)
      setProcessingProgress(0)
    }
  }

  // 删除图片
  const removeImage = (id: string) => {
    setImages(prev => prev.filter(img => img.id !== id))
    if (selectedImageId === id) {
      const remaining = images.filter(img => img.id !== id)
      setSelectedImageId(remaining.length > 0 ? remaining[0].id : null)
      setShowOriginalPreview(false)
    }
  }

  // 清空所有图片
  const clearAllImages = () => {
    setImages([])
    setSelectedImageId(null)
    setShowOriginalPreview(false)
  }

  // 处理Base64输入解码
  const handleBase64Decode = useCallback(() => {
    if (!base64Input.trim()) {
      setDecodeError(t("emptyBase64Error"))
      setDecodedImage(null)
      return
    }

    try {
      setDecodeError("")
      let dataUrl = base64Input.trim()

      // 如果不包含data:前缀，尝试自动检测格式并添加
      if (!dataUrl.startsWith('data:')) {
        // 通过base64开头字符判断图片格式
        const firstChars = dataUrl.substring(0, 10)
        let mimeType = 'image/png' // 默认PNG

        if (firstChars.startsWith('/9j/')) {
          mimeType = 'image/jpeg'
        } else if (firstChars.startsWith('iVBOR')) {
          mimeType = 'image/png'
        } else if (firstChars.startsWith('R0lGOD')) {
          mimeType = 'image/gif'
        } else if (firstChars.startsWith('UklGR')) {
          mimeType = 'image/webp'
        }

        dataUrl = `data:${mimeType};base64,${dataUrl}`
      }

      // 验证是否为有效的base64图片
      const img = new Image()
      img.onload = () => {
        // 计算base64字符串的大小（估算）
        const base64Data = dataUrl.split(',')[1]
        const size = Math.round((base64Data.length * 3) / 4)

        // 确定图片格式
        const mimeType = dataUrl.match(/data:([^;]+)/)?.[1] || 'image/png'
        const format = SUPPORTED_FORMATS[mimeType as keyof typeof SUPPORTED_FORMATS]?.name || mimeType

        setDecodedImage({
          dataUrl,
          dimensions: { width: img.width, height: img.height },
          size,
          format
        })

        toast({
          title: t("decodeSuccessTitle"),
          description: t("decodeSuccessDescription")
            .replace("{width}", String(img.width))
            .replace("{height}", String(img.height)),
        })
      }

      img.onerror = () => {
        setDecodeError(t("invalidBase64Error"))
        setDecodedImage(null)
      }

      img.src = dataUrl
    } catch {
      setDecodeError(t("base64FormatError"))
      setDecodedImage(null)
    }
  }, [base64Input, toast, t])

  // 复制到剪贴板
  const copyToClipboard = async (text: string, type: string) => {
    try {
      if (!await writeClipboardText(text)) throw new Error("Clipboard unavailable")
      setCopied(prev => ({ ...prev, [type]: true }))
      setTimeout(() => {
        setCopied(prev => ({ ...prev, [type]: false }))
      }, 2000)

      toast({
        title: t("copied"),
        description: t("copiedDescription"),
      })
    } catch {
      toast({
        title: t("copyFailed"),
        description: t("copyFailedDescription"),
        variant: "destructive",
      })
    }
  }

  // 下载图片（Base64转图片时使用）
  const downloadDecodedImage = () => {
    if (!decodedImage) return

    const link = document.createElement('a')
    link.href = decodedImage.dataUrl
    link.download = `decoded_image_${Date.now()}.${decodedImage.format.toLowerCase()}`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    toast({
      title: t("downloadComplete"),
      description: t("downloadCompleteDescription"),
    })
  }

  // 格式化文件大小
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  // 选中的图片
  const selectedImage = useMemo(
    () => images.find((image) => image.id === selectedImageId),
    [images, selectedImageId],
  )
  const selectedImageDataUrl = useMemo(
    () => selectedImage ? getImageDataUrl(selectedImage) : "",
    [selectedImage],
  )
  const selectedOutput = useMemo(
    () => selectedImage
      ? generateImageOutput(selectedImage, outputFormat, includePrefix)
      : "",
    [includePrefix, outputFormat, selectedImage],
  )

  return (
    <div className="container mx-auto py-6 px-4 max-w-6xl">
      {/* 页面标题 */}
      <div className="text-center space-y-4 mb-6">
        <h1 className="text-3xl font-bold text-[var(--md-sys-color-on-surface)]">
          {t("title")}
        </h1>
        <p className="text-[var(--md-sys-color-on-surface-variant)] max-w-2xl mx-auto">
          {t("description")}
        </p>
      </div>

      {/* 性能优化设置 */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Zap className="h-5 w-5" />
              {t("performanceSettings")}
            </CardTitle>
            <div className="flex items-center gap-4">
              <div className="flex items-center space-x-2">
                <Switch
                  id="virtualize-text"
                  checked={virtualizeText}
                  onCheckedChange={setVirtualizeText}
                />
                <Label htmlFor="virtualize-text" className="text-sm">{t("smartDisplay")}</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Label className="text-sm">{t("previewQuality")}:</Label>
                <select
                  value={previewQuality}
                  onChange={(e) => setPreviewQuality(Number(e.target.value))}
                  aria-label={t("previewQuality")}
                  className="text-sm border border-[var(--md-sys-color-outline-variant)] rounded px-2 py-1 bg-[var(--md-sys-color-surface-container-low)] text-[var(--md-sys-color-on-surface)]"
                >
                  <option value={0.5}>{t("qualityLow")}</option>
                  <option value={0.7}>{t("qualityMedium")}</option>
                  <option value={0.9}>{t("qualityHigh")}</option>
                </select>
              </div>
              {images.length > 5 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearAllImages}
                  className="text-[var(--md-sys-color-error)] hover:text-[var(--md-sys-color-error)]"
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  {t("clearMemory")}
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="text-sm text-[var(--md-sys-color-on-surface-variant)]">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <strong>{t("smartDisplay")}:</strong> {t("smartDisplayHint")}
              </div>
              <div>
                <strong>{t("previewQuality")}:</strong> {t("previewQualityHint")}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 主要功能选项卡 */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="image-to-base64" className="flex items-center gap-2">
            <ImageIcon className="h-4 w-4" />
            {t("tabImageToBase64")}
          </TabsTrigger>
          <TabsTrigger value="base64-to-image" className="flex items-center gap-2">
            <ArrowRightLeft className="h-4 w-4" />
            {t("tabBase64ToImage")}
          </TabsTrigger>
        </TabsList>

        {/* 图片转Base64 */}
        <TabsContent value="image-to-base64" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 左侧：上传区域 */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Upload className="h-5 w-5" />
                    {t("imageUpload")}
                  </CardTitle>
                  {images.length > 0 && (
                    <Button variant="ghost" size="sm" onClick={clearAllImages}>
                      <Trash2 className="h-4 w-4" />
                      {t("clear")}
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div
                  className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
                    isDragging
                      ? "border-[var(--md-sys-color-primary)] bg-[var(--md-sys-color-primary-container)]/20"
                      : "border-[var(--md-sys-color-outline-variant)] hover:border-[var(--md-sys-color-outline)]"
                  }`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
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
                    <div className="space-y-4">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--md-sys-color-primary)] mx-auto"></div>
                      <div>
                        <div className="font-medium">{t("processing")}</div>
                        <div className="text-sm text-[var(--md-sys-color-on-surface-variant)]">{t("processingHint")}</div>
                        {processingProgress > 0 && (
                          <div className="mt-2">
                            <div className="w-full bg-[var(--md-sys-color-surface-container-highest)] rounded-full h-2">
                              <div
                                className="bg-[var(--md-sys-color-primary)] h-2 rounded-full transition-all duration-300"
                                style={{ width: `${processingProgress}%` }}
                              ></div>
                            </div>
                            <div className="text-xs text-[var(--md-sys-color-on-surface-variant)] mt-1">
                              {Math.round(processingProgress)}%
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <ImageIcon className="mx-auto h-12 w-12 text-[var(--md-sys-color-on-surface-variant)]" />
                      <div>
                        <p className="text-lg font-medium text-[var(--md-sys-color-on-surface)]">
                          {t("dropImageHere")}
                        </p>
                        <p className="text-sm text-[var(--md-sys-color-on-surface-variant)] mt-2">
                          {t("supportedFormatsLine").replace(
                            "{formats}",
                            Object.values(SUPPORTED_FORMATS).map(f => f.name).join(", "),
                          )}
                        </p>
                        <p className="text-xs text-[var(--md-sys-color-on-surface-variant)] mt-1">
                          {t("maxSizeNote").replace(
                            "{limit}",
                            formatFileSizeLimit(FILE_SIZE_LIMITS.imageBase64),
                          )}
                        </p>
                      </div>
                      <Button variant="outline" className="mt-4">
                        <Upload className="h-4 w-4 mr-2" />
                        {t("selectImage")}
                      </Button>
                    </div>
                  )}
                </div>

                {/* 图片列表 */}
                {images.length > 0 && (
                  <div className="mt-6 space-y-3">
                    <h4 className="font-medium">{t("uploadedImages").replace("{count}", String(images.length))}</h4>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {images.map((image) => (
                        <div
                          key={image.id}
                          className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                            selectedImageId === image.id
                              ? "border-[var(--md-sys-color-primary)] bg-[var(--md-sys-color-primary-container)]/20"
                              : "border-[var(--md-sys-color-outline-variant)] hover:border-[var(--md-sys-color-outline)]"
                          }`}
                          onClick={() => {
                            setSelectedImageId(image.id)
                            setShowOriginalPreview(false)
                          }}
                        >
                          <img
                            src={image.previewUrl || getImageDataUrl(image)}
                            alt={image.name}
                            className="w-12 h-12 object-cover rounded"
                            loading="lazy"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm truncate">{image.name}</div>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="secondary" className="text-xs">
                                {image.format}
                              </Badge>
                              <span className="text-xs text-[var(--md-sys-color-on-surface-variant)]">
                                {image.dimensions.width}×{image.dimensions.height}
                              </span>
                              <span className="text-xs text-[var(--md-sys-color-on-surface-variant)]">
                                {formatFileSize(image.size)}
                              </span>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label={t("removeImage")}
                            onClick={(e) => {
                              e.stopPropagation()
                              removeImage(image.id)
                            }}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 右侧：输出结果 */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2">
                  <FileImage className="h-5 w-5" />
                  {t("base64Output")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {selectedImage ? (
                  <div className="space-y-4">
                    {/* 输出设置 */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>{t("outputFormat")}</Label>
                        <Select value={outputFormat} onValueChange={(value: typeof outputFormat) => setOutputFormat(value)}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="base64">Base64</SelectItem>
                            <SelectItem value="dataUrl">Data URL</SelectItem>
                            <SelectItem value="css">{t("formatCss")}</SelectItem>
                            <SelectItem value="html">{t("formatHtml")}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="flex items-center space-x-2 pt-6">
                        <Switch
                          id="include-prefix"
                          checked={includePrefix}
                          onCheckedChange={setIncludePrefix}
                        />
                        <Label htmlFor="include-prefix">{t("includePrefix")}</Label>
                      </div>
                    </div>

                    {/* 图片信息 */}
                    <div className="bg-[var(--md-sys-color-surface-container-low)] p-3 rounded-lg space-y-2">
                      <div className="font-medium text-sm">{selectedImage.name}</div>
                      <div className="grid grid-cols-3 gap-2 text-xs text-[var(--md-sys-color-on-surface-variant)]">
                        <div>{t("format")}: {selectedImage.format}</div>
                        <div>{t("dimensions")}: {selectedImage.dimensions.width}×{selectedImage.dimensions.height}</div>
                        <div>{t("size")}: {formatFileSize(selectedImage.size)}</div>
                      </div>
                    </div>

                    {/* Base64 输出 */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>{t("encodedResult")} ({formatFileSize(selectedImage.base64.length)})</Label>
                        <div className="flex gap-2">
                          {selectedImage.base64.length > 50000 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setVirtualizeText(!virtualizeText)}
                            >
                              {virtualizeText ? t("showAll") : t("optimizedDisplay")}
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => copyToClipboard(selectedOutput, selectedImage.id)}
                          >
                            <Clipboard className="h-4 w-4 mr-2" />
                            {copied[selectedImage.id] ? t("copied") : t("copy")}
                          </Button>
                        </div>
                      </div>
                      <VirtualizedTextArea
                        value={selectedOutput}
                        isLarge={selectedImage.base64.length > 50000}
                        virtualizeText={virtualizeText}
                        showFullBase64={showFullBase64}
                        onToggleFull={() => setShowFullBase64((current) => !current)}
                      />
                      {selectedImage.base64.length > 50000 && (
                        <div className="text-xs text-[var(--md-sys-color-on-tertiary-container)] bg-[var(--md-sys-color-tertiary-container)] p-2 rounded">
                          {t("largeImageNotice")}
                        </div>
                      )}
                    </div>

                    {/* 图片预览 */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>{t("imagePreview")}</Label>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowOriginalPreview((current) => !current)}
                        >
                          <Maximize2 className="h-4 w-4 mr-1" />
                          {showOriginalPreview ? t("thumbnail") : t("original")}
                        </Button>
                      </div>
                      <div className="border rounded-lg overflow-hidden bg-[var(--md-sys-color-surface-container)] flex justify-center">
                        <img
                          src={showOriginalPreview || !selectedImage.previewUrl
                            ? selectedImageDataUrl
                            : selectedImage.previewUrl}
                          alt={selectedImage.name}
                          className="max-h-[200px] object-contain cursor-pointer"
                          loading="lazy"
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-[400px] text-[var(--md-sys-color-on-surface-variant)]">
                    <ImageIcon className="h-12 w-12 mb-2 opacity-20" />
                    <p>{t("selectImageToView")}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Base64转图片 */}
        <TabsContent value="base64-to-image" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 左侧：Base64输入 */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2">
                  <RefreshCw className="h-5 w-5" />
                  {t("base64InputTitle")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>{t("base64String")}</Label>
                  <Textarea
                    value={base64Input}
                    onChange={(e) => setBase64Input(e.target.value)}
                    placeholder={t("base64InputPlaceholder")}
                    className="font-mono text-xs h-[200px] resize-none"
                  />
                  <p className="text-xs text-[var(--md-sys-color-on-surface-variant)]">
                    {t("base64InputHint")}
                  </p>
                  {base64Input.length > 50000 && (
                    <div className="text-xs text-[var(--md-sys-color-on-primary-container)] bg-[var(--md-sys-color-primary-container)] p-2 rounded">
                      {t("largeBase64Warning")}
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button onClick={handleBase64Decode} className="flex-1">
                    <Eye className="h-4 w-4 mr-2" />
                    {t("decodeAndDisplay")}
                  </Button>
                  <Button
                    variant="outline"
                    aria-label={t("clear")}
                    onClick={() => {
                      setBase64Input("")
                      setDecodedImage(null)
                      setDecodeError("")
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                {decodeError && (
                  <Alert className="border-[var(--md-sys-color-error-container)] bg-[var(--md-sys-color-error-container)] text-[var(--md-sys-color-on-error-container)] [&>svg]:text-[var(--md-sys-color-on-error-container)]">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{decodeError}</AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>

            {/* 右侧：解码结果 */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2">
                  <Eye className="h-5 w-5" />
                  {t("decodeResult")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {decodedImage ? (
                  <div className="space-y-4">
                    {/* 图片信息 */}
                    <div className="bg-[var(--md-sys-color-surface-container-low)] p-3 rounded-lg">
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="text-[var(--md-sys-color-on-surface-variant)]">{t("format")}:</span>
                          <span className="ml-2 font-medium">{decodedImage.format}</span>
                        </div>
                        <div>
                          <span className="text-[var(--md-sys-color-on-surface-variant)]">{t("size")}:</span>
                          <span className="ml-2 font-medium">{formatFileSize(decodedImage.size)}</span>
                        </div>
                        <div className="col-span-2">
                          <span className="text-[var(--md-sys-color-on-surface-variant)]">{t("dimensions")}:</span>
                          <span className="ml-2 font-medium">
                            {decodedImage.dimensions.width} × {decodedImage.dimensions.height}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* 图片显示 */}
                    <div className="space-y-2">
                      <Label>{t("decodedImageLabel")}</Label>
                      <div className="border rounded-lg overflow-hidden bg-[var(--md-sys-color-surface-container)] flex justify-center">
                        <img
                          src={decodedImage.dataUrl}
                          alt={t("decodedImageAlt")}
                          className="max-h-[300px] object-contain"
                        />
                      </div>
                    </div>

                    {/* 操作按钮 */}
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={() => copyToClipboard(decodedImage.dataUrl, 'decoded')}
                        className="flex-1"
                      >
                        <Clipboard className="h-4 w-4 mr-2" />
                        {copied.decoded ? t("copied") : t("copyDataUrl")}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={downloadDecodedImage}
                        className="flex-1"
                      >
                        <Download className="h-4 w-4 mr-2" />
                        {t("downloadImage")}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-[400px] text-[var(--md-sys-color-on-surface-variant)]">
                    <RefreshCw className="h-12 w-12 mb-2 opacity-20" />
                    <p>{t("enterBase64ToView")}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
