"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { useObjectUrlRegistry } from "@/hooks/use-object-url"
import { useToast } from "@/hooks/use-toast"
import { mapWithConcurrency } from "@/lib/async-pool"
import { createClientId } from "@/lib/client-id"
import {
  triggerDownload,
  withObjectUrl,
} from "@/lib/object-url"
import { 
  Upload, ImageIcon, Download, X, Trash2, 
  Settings, Zap, FileImage, CheckCircle2,
  Minimize2, Maximize2
} from "lucide-react"
import { M3Slider } from "@/components/m3/slider"
import { useTranslations } from "@/hooks/use-translations"

interface CompressedImage {
  id: string
  file: File
  originalUrl: string
  compressedUrl: string | null
  originalSize: number
  compressedSize: number | null
  isProcessing: boolean
  error: string | null
  quality: number
  format: string
  width: number
  height: number
  newWidth: number | null
  newHeight: number | null
}

// 内部错误代码到翻译键的映射
const COMPRESS_ERROR_KEYS: Record<string, string> = {
  CANVAS_UNAVAILABLE: "errorCanvasUnavailable",
  COMPRESS_FAILED: "errorCompressFailed",
  LOAD_FAILED: "errorLoadFailed",
}

export default function ImageCompressPage() {
  const { toast } = useToast()
  const t = useTranslations("imageCompress")

  // 状态管理
  const [images, setImages] = useState<CompressedImage[]>([])
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  
  // 压缩设置
  const [quality, setQuality] = useState(80)
  const [outputFormat, setOutputFormat] = useState<string>("original")
  const [maxWidth, setMaxWidth] = useState<string>("")
  const [maxHeight, setMaxHeight] = useState<string>("")
  
  // 图片预览弹窗
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const [previewTitle, setPreviewTitle] = useState<string>("")

  const fileInputRef = useRef<HTMLInputElement>(null)
  const imagesRef = useRef<CompressedImage[]>([])
  const mountedRef = useRef(true)
  const objectUrls = useObjectUrlRegistry()
  const releaseImageUrls = useCallback((image: CompressedImage) => {
    objectUrls.revoke(image.originalUrl)
    objectUrls.revoke(image.compressedUrl)
  }, [objectUrls])

  useEffect(() => {
    imagesRef.current = images
  }, [images])

  useEffect(() => {
    mountedRef.current = true

    return () => {
      mountedRef.current = false
    }
  }, [])

  // 支持的图片格式
  const supportedFormats = ['image/jpeg', 'image/png', 'image/webp']

  // 格式化文件大小
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  }

  // 计算压缩率
  const getCompressionRatio = (original: number, compressed: number): string => {
    const ratio = ((original - compressed) / original * 100)
    if (ratio >= 0) {
      return `${ratio.toFixed(1)}%`
    } else {
      // 文件变大时，显示增加的百分比
      return `+${Math.abs(ratio).toFixed(1)}%`
    }
  }

  // 将内部错误代码转换为可读文案
  const describeError = (code: string): string => {
    const key = COMPRESS_ERROR_KEYS[code]
    return key ? t(key) : code
  }

  // 压缩单个图片
  const compressImage = useCallback(async (
    file: File,
    quality: number,
    format: string,
    maxW?: number,
    maxH?: number
  ): Promise<{ blob: Blob; width: number; height: number; actualFormat: string }> => {
    return withObjectUrl(file, (sourceUrl) => new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas')
          let width = img.width
          let height = img.height

          // 调整尺寸
          if (maxW && width > maxW) {
            height = Math.round(height * (maxW / width))
            width = maxW
          }
          if (maxH && height > maxH) {
            width = Math.round(width * (maxH / height))
            height = maxH
          }

          canvas.width = width
          canvas.height = height

          const ctx = canvas.getContext('2d')
          if (!ctx) {
            reject(new Error('CANVAS_UNAVAILABLE'))
            return
          }

          // 确定输出格式
          let mimeType = file.type
          if (format !== 'original') {
            mimeType = `image/${format}`
          }

          // PNG 格式不支持质量压缩，自动转为 WebP 以获得更好的压缩
          if (mimeType === 'image/png' && format === 'original') {
            mimeType = 'image/webp'
          }

          // 提取实际格式名称
          const actualFormat = mimeType.split('/')[1]

          // 如果输出为 JPEG，需要填充白色背景
          if (mimeType === 'image/jpeg') {
            ctx.fillStyle = '#FFFFFF'
            ctx.fillRect(0, 0, width, height)
          }

          ctx.drawImage(img, 0, 0, width, height)

          // 对于 PNG 格式，quality 参数无效
          // 对于 WebP/JPEG，使用用户设置的质量（注意：100% 可能导致文件变大）
          const outputQuality = mimeType === 'image/png' ? undefined : quality / 100

          canvas.toBlob(
            (blob) => {
              if (blob) {
                resolve({ blob, width, height, actualFormat })
              } else {
                reject(new Error('COMPRESS_FAILED'))
              }
            },
            mimeType,
            outputQuality
          )
        } catch (error) {
          reject(error instanceof Error ? error : new Error('COMPRESS_FAILED'))
        }
      }
      img.onerror = () => reject(new Error('LOAD_FAILED'))
      img.src = sourceUrl
    }))
  }, [])

  // 处理单个文件
  const processFile = useCallback(async (file: File): Promise<CompressedImage> => {
    const imageId = createClientId("compress")
    const originalUrl = objectUrls.create(file)

    // 获取原始图片尺寸
    const img = new Image()
    const imageLoaded = await new Promise<boolean>((resolve) => {
      img.onload = () => resolve(true)
      img.onerror = () => resolve(false)
      img.src = originalUrl
    })

    const processedImage: CompressedImage = {
      id: imageId,
      file,
      originalUrl,
      compressedUrl: null,
      originalSize: file.size,
      compressedSize: null,
      isProcessing: true,
      error: null,
      quality,
      format: outputFormat,
      width: img.width,
      height: img.height,
      newWidth: null,
      newHeight: null,
    }

    if (!imageLoaded) {
      processedImage.error = 'LOAD_FAILED'
      processedImage.isProcessing = false
      return processedImage
    }

    try {
      const maxW = maxWidth ? parseInt(maxWidth) : undefined
      const maxH = maxHeight ? parseInt(maxHeight) : undefined
      
      const { blob, width, height, actualFormat } = await compressImage(file, quality, outputFormat, maxW, maxH)
      if (!mountedRef.current) {
        processedImage.isProcessing = false
        return processedImage
      }
      
      processedImage.compressedUrl = objectUrls.create(blob)
      processedImage.compressedSize = blob.size
      processedImage.newWidth = width
      processedImage.newHeight = height
      processedImage.format = actualFormat // 使用实际输出格式
      processedImage.isProcessing = false
      
      return processedImage
    } catch (error) {
      processedImage.error = error instanceof Error ? error.message : 'COMPRESS_FAILED'
      processedImage.isProcessing = false
      return processedImage
    }
  }, [quality, outputFormat, maxWidth, maxHeight, compressImage, objectUrls])

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

      const processedImages = await mapWithConcurrency(validFiles, 3, processFile)

      if (!mountedRef.current) {
        return
      }

      setImages(prev => [...prev, ...processedImages])
      
      if (processedImages.length > 0) {
        setSelectedImageId(processedImages[0].id)
      }

      const successCount = processedImages.filter(img => !img.error).length
      toast({
        title: t("processedTitle"),
        description: t("processedDescription").replace("{count}", String(successCount)),
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
      const processedImages = await mapWithConcurrency(files, 3, processFile)

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

  // 重新压缩选中的图片
  const recompressImage = async (imageId: string) => {
    const image = images.find(img => img.id === imageId)
    if (!image) return

    setImages(prev => prev.map(img => 
      img.id === imageId ? { ...img, isProcessing: true, error: null } : img
    ))

    try {
      const maxW = maxWidth ? parseInt(maxWidth) : undefined
      const maxH = maxHeight ? parseInt(maxHeight) : undefined
      
      const { blob, width, height, actualFormat } = await compressImage(image.file, quality, outputFormat, maxW, maxH)
      if (!mountedRef.current) return
      
      setImages(prev => prev.map(img => {
        if (img.id !== imageId) return img

        objectUrls.revoke(img.compressedUrl)
        return {
          ...img,
          compressedUrl: objectUrls.create(blob),
          compressedSize: blob.size,
          newWidth: width,
          newHeight: height,
          quality,
          format: actualFormat,
          isProcessing: false,
        }
      }))

      toast({
        title: t("recompressedTitle"),
        description: t("recompressedDescription").replace("{size}", formatFileSize(blob.size)),
      })
    } catch (error) {
      setImages(prev => prev.map(img => 
        img.id === imageId ? {
          ...img,
          error: error instanceof Error ? error.message : 'COMPRESS_FAILED',
          isProcessing: false,
        } : img
      ))
    }
  }

  // 下载压缩后的图片
  const downloadImage = (image: CompressedImage) => {
    if (!image.compressedUrl) return

    // 使用实际输出格式作为扩展名
    const ext = image.format || 'jpg'
    const baseName = image.file.name.replace(/\.[^/.]+$/, '')
    triggerDownload(image.compressedUrl, `${baseName}_compressed.${ext}`)
  }

  // 下载所有压缩后的图片
  const downloadAll = () => {
    const compressedImages = images.filter(img => img.compressedUrl && !img.error)
    compressedImages.forEach(img => downloadImage(img))
    
    toast({
      title: t("downloadedTitle"),
      description: t("downloadedDescription").replace("{count}", String(compressedImages.length)),
    })
  }

  // 删除图片
  const removeImage = (id: string) => {
    setImages(prev => {
      const image = prev.find(img => img.id === id)
      if (image) {
        releaseImageUrls(image)
        if (
          previewImage === image.originalUrl ||
          previewImage === image.compressedUrl
        ) {
          setPreviewImage(null)
        }
      }
      
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
    images.forEach(releaseImageUrls)
    setImages([])
    setSelectedImageId(null)
    setPreviewImage(null)
  }

  // 当压缩设置变化时，自动重新压缩所有图片
  useEffect(() => {
    const currentImages = [...imagesRef.current]
    if (currentImages.length === 0) return

    let cancelled = false
    
    const recompressAll = async () => {
      const maxW = maxWidth ? parseInt(maxWidth) : undefined
      const maxH = maxHeight ? parseInt(maxHeight) : undefined

      // 标记所有图片为处理中
      const imageIds = new Set(currentImages.map((image) => image.id))
      setImages(prev => prev.map(img => (
        imageIds.has(img.id) ? { ...img, isProcessing: true } : img
      )))
      
      // 逐个重新压缩
      for (const image of currentImages) {
        try {
          const { blob, width, height, actualFormat } = await compressImage(image.file, quality, outputFormat, maxW, maxH)
          if (cancelled) return
          
          setImages(prev => prev.map(img => {
            if (img.id === image.id) {
              // 释放旧的压缩URL
              objectUrls.revoke(img.compressedUrl)
              return {
                ...img,
                compressedUrl: objectUrls.create(blob),
                compressedSize: blob.size,
                newWidth: width,
                newHeight: height,
                quality,
                format: actualFormat,
                isProcessing: false,
                error: null,
              }
            }
            return img
          }))
        } catch (error) {
          if (cancelled) return
          setImages(prev => prev.map(img => 
            img.id === image.id ? {
              ...img,
              error: error instanceof Error ? error.message : 'COMPRESS_FAILED',
              isProcessing: false,
            } : img
          ))
        }
      }
    }
    
    // 使用防抖，避免频繁重新压缩
    const timeoutId = setTimeout(recompressAll, 300)
    return () => {
      cancelled = true
      clearTimeout(timeoutId)
    }
  }, [quality, outputFormat, maxWidth, maxHeight, compressImage, objectUrls])

  // 选中的图片
  const selectedImage = images.find(img => img.id === selectedImageId)

  // 计算总体统计
  const totalOriginalSize = images.reduce((sum, img) => sum + img.originalSize, 0)
  const totalCompressedSize = images.reduce((sum, img) => sum + (img.compressedSize || 0), 0)

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
        {/* 左侧：上传和设置 */}
        <div className="xl:col-span-1 space-y-6">
          {/* 上传区域 */}
          <Card className="card-elevated">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-[var(--md-sys-color-on-surface)]">
                <Upload className="h-5 w-5" />
                {t("uploadTitle")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div
                className={`border-2 border-dashed rounded-[var(--md-sys-shape-corner-large)] p-6 text-center transition-colors cursor-pointer ${
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
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleFileChange}
                  className="hidden"
                />
                
                {isProcessing ? (
                  <div className="space-y-3">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--md-sys-color-primary)] mx-auto"></div>
                    <div className="text-sm text-[var(--md-sys-color-on-surface-variant)]">{t("compressing")}</div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <ImageIcon className="mx-auto h-8 w-8 text-[var(--md-sys-color-on-surface-variant)]" />
                    <div>
                      <p className="font-medium text-[var(--md-sys-color-on-surface)]">
                        {t("dropHint")}
                      </p>
                      <p className="text-xs text-[var(--md-sys-color-on-surface-variant)] mt-1">
                        {t("supportedFormats")}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {images.length > 0 && (
                <div className="mt-4 flex justify-between items-center">
                  <span className="text-sm text-[var(--md-sys-color-on-surface-variant)]">{t("imageCount").replace("{count}", String(images.length))}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearAllImages}
                    className="text-[var(--md-sys-color-error)] hover:text-[var(--md-sys-color-error)]"
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    {t("clear")}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 压缩设置 */}
          <Card className="card-elevated">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-[var(--md-sys-color-on-surface)]">
                <Settings className="h-5 w-5" />
                {t("settingsTitle")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* 质量滑块 */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <Label className="text-[var(--md-sys-color-on-surface)]">{t("quality")}</Label>
                  <span className="text-sm font-medium text-[var(--md-sys-color-primary)]">{quality}%</span>
                </div>
                <M3Slider
                  aria-label={t("quality")}
                  value={[quality]}
                  onValueChange={(values) => setQuality(values[0])}
                  min={10}
                  max={100}
                  step={5}
                />
                <p className="text-xs text-[var(--md-sys-color-on-surface-variant)]">
                  {t("qualityHint")}
                </p>
              </div>

              {/* 输出格式 */}
              <div className="space-y-2">
                <Label className="text-[var(--md-sys-color-on-surface)]">{t("outputFormat")}</Label>
                <Select value={outputFormat} onValueChange={setOutputFormat}>
                  <SelectTrigger aria-label={t("outputFormat")}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="original">{t("formatAuto")}</SelectItem>
                    <SelectItem value="jpeg">{t("formatJpeg")}</SelectItem>
                    <SelectItem value="webp">{t("formatWebp")}</SelectItem>
                    <SelectItem value="png">{t("formatPng")}</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-[var(--md-sys-color-on-surface-variant)]">
                  {t("formatHint")}
                </p>
              </div>

              {/* 尺寸限制 */}
              <div className="space-y-2">
                <Label className="text-[var(--md-sys-color-on-surface)]">{t("maxDimensions")}</Label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Input
                      type="number"
                      placeholder={t("maxWidth")}
                      value={maxWidth}
                      onChange={(e) => setMaxWidth(e.target.value)}
                    />
                  </div>
                  <div>
                    <Input
                      type="number"
                      placeholder={t("maxHeight")}
                      value={maxHeight}
                      onChange={(e) => setMaxHeight(e.target.value)}
                    />
                  </div>
                </div>
                <p className="text-xs text-[var(--md-sys-color-on-surface-variant)]">
                  {t("dimensionsHint")}
                </p>
              </div>

              {/* 批量操作按钮 */}
              {images.length > 0 && (
                <div className="space-y-2 pt-4 border-t border-[var(--md-sys-color-outline-variant)]">
                  <Button 
                    className="w-full"
                    onClick={downloadAll}
                    disabled={!images.some(img => img.compressedUrl)}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    {t("downloadAll")}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 统计信息 */}
          {images.length > 0 && (
            <Card className="card-elevated">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-[var(--md-sys-color-on-surface)]">
                  <Zap className="h-5 w-5" />
                  {t("statsTitle")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--md-sys-color-on-surface-variant)]">{t("totalOriginalSize")}</span>
                  <span className="font-medium text-[var(--md-sys-color-on-surface)]">{formatFileSize(totalOriginalSize)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--md-sys-color-on-surface-variant)]">{t("totalCompressedSize")}</span>
                  <span className="font-medium text-[var(--md-sys-color-on-surface)]">{formatFileSize(totalCompressedSize)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--md-sys-color-on-surface-variant)]">
                    {totalCompressedSize <= totalOriginalSize ? t("savedSpace") : t("increasedSize")}
                  </span>
                  <span className={`font-medium ${totalCompressedSize <= totalOriginalSize ? 'text-[var(--md-sys-color-primary)]' : 'text-[var(--md-sys-color-error)]'}`}>
                    {totalOriginalSize > 0 ? getCompressionRatio(totalOriginalSize, totalCompressedSize) : '0%'}
                  </span>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* 右侧：图片列表和预览 */}
        <div className="xl:col-span-3 space-y-6">
          {images.length === 0 ? (
            <Card className="card-elevated">
              <CardContent className="py-16 text-center">
                <FileImage className="mx-auto h-16 w-16 text-[var(--md-sys-color-on-surface-variant)] mb-4" />
                <h3 className="text-lg font-medium text-[var(--md-sys-color-on-surface)] mb-2">
                  {t("emptyTitle")}
                </h3>
                <p className="text-[var(--md-sys-color-on-surface-variant)]">
                  {t("emptyDescription")}
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* 图片列表 */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {images.map((image) => (
                  <Card 
                    key={image.id} 
                    className={`card-elevated cursor-pointer transition-all ${
                      selectedImageId === image.id 
                        ? 'ring-2 ring-[var(--md-sys-color-primary)]' 
                        : 'hover:shadow-lg'
                    }`}
                    onClick={() => setSelectedImageId(image.id)}
                  >
                    <CardContent className="p-4">
                      {/* 图片预览 */}
                      <div className="relative aspect-video rounded-[var(--md-sys-shape-corner-medium)] overflow-hidden bg-[var(--md-sys-color-surface-variant)] mb-3">
                        <img
                          src={image.compressedUrl || image.originalUrl}
                          alt={image.file.name}
                          className="w-full h-full object-contain"
                        />
                        {image.isProcessing && (
                          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                          </div>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="absolute top-2 right-2 h-8 w-8 p-0 bg-black/50 hover:bg-black/70 text-white"
                          onClick={(e) => {
                            e.stopPropagation()
                            removeImage(image.id)
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>

                      {/* 文件信息 */}
                      <div className="space-y-2">
                        <p className="font-medium text-sm truncate text-[var(--md-sys-color-on-surface)]">
                          {image.file.name}
                        </p>
                        
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-[var(--md-sys-color-on-surface-variant)]">
                            {formatFileSize(image.originalSize)}
                          </span>
                          {image.compressedSize && (
                            <>
                              <span className="text-[var(--md-sys-color-on-surface-variant)]">→</span>
                              <span className={`font-medium ${image.compressedSize <= image.originalSize ? 'text-[var(--md-sys-color-primary)]' : 'text-[var(--md-sys-color-error)]'}`}>
                                {formatFileSize(image.compressedSize)}
                              </span>
                              <Badge 
                                variant="secondary" 
                                className={`text-xs ${image.compressedSize > image.originalSize ? 'bg-[var(--md-sys-color-error-container)] text-[var(--md-sys-color-on-error-container)]' : ''}`}
                              >
                                {getCompressionRatio(image.originalSize, image.compressedSize)}
                              </Badge>
                            </>
                          )}
                        </div>

                        {image.error && (
                          <p className="text-xs text-[var(--md-sys-color-error)]">{describeError(image.error)}</p>
                        )}

                        {/* 操作按钮 */}
                        <div className="flex gap-2 pt-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            onClick={(e) => {
                              e.stopPropagation()
                              recompressImage(image.id)
                            }}
                            disabled={image.isProcessing}
                          >
                            <Zap className="h-3 w-3 mr-1" />
                            {t("recompress")}
                          </Button>
                          <Button
                            size="sm"
                            className="flex-1"
                            onClick={(e) => {
                              e.stopPropagation()
                              downloadImage(image)
                            }}
                            disabled={!image.compressedUrl || image.isProcessing}
                          >
                            <Download className="h-3 w-3 mr-1" />
                            {t("download")}
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* 选中图片详情 */}
              {selectedImage && (
                <Card className="card-elevated">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-[var(--md-sys-color-on-surface)]">
                      <CheckCircle2 className="h-5 w-5 text-[var(--md-sys-color-primary)]" />
                      {t("detailsTitle")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* 对比预览 */}
                      <div className="space-y-4">
                        <h4 className="font-medium text-[var(--md-sys-color-on-surface)]">{t("comparisonTitle")}</h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <p className="text-xs text-center text-[var(--md-sys-color-on-surface-variant)]">{t("original")}</p>
                            <div className="relative aspect-square rounded-[var(--md-sys-shape-corner-medium)] overflow-hidden bg-[var(--md-sys-color-surface-variant)] group">
                              <img
                                src={selectedImage.originalUrl}
                                alt={t("original")}
                                className="w-full h-full object-contain"
                              />
                              <Button
                                variant="secondary"
                                size="sm"
                                aria-label={t("previewOriginalAria")}
                                className="absolute right-2 top-2 h-8 w-8 p-0 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
                                onClick={() => {
                                  setPreviewImage(selectedImage.originalUrl)
                                  setPreviewTitle(`${t("original")} - ${selectedImage.file.name}`)
                                }}
                              >
                                <Maximize2 className="h-4 w-4" />
                              </Button>
                            </div>
                            <p className="text-xs text-center text-[var(--md-sys-color-on-surface-variant)]">
                              {formatFileSize(selectedImage.originalSize)}
                            </p>
                          </div>
                          <div className="space-y-2">
                            <p className="text-xs text-center text-[var(--md-sys-color-on-surface-variant)]">{t("compressed")}</p>
                            <div className="relative aspect-square rounded-[var(--md-sys-shape-corner-medium)] overflow-hidden bg-[var(--md-sys-color-surface-variant)] group">
                              {selectedImage.compressedUrl ? (
                                <>
                                  <img
                                    src={selectedImage.compressedUrl}
                                    alt={t("compressed")}
                                    className="w-full h-full object-contain"
                                  />
                                  <Button
                                    variant="secondary"
                                    size="sm"
                                    aria-label={t("previewCompressedAria")}
                                    className="absolute right-2 top-2 h-8 w-8 p-0 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
                                    onClick={() => {
                                      setPreviewImage(selectedImage.compressedUrl)
                                      setPreviewTitle(`${t("compressed")} - ${selectedImage.file.name}`)
                                    }}
                                  >
                                    <Maximize2 className="h-4 w-4" />
                                  </Button>
                                </>
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <span className="text-xs text-[var(--md-sys-color-on-surface-variant)]">{t("processing")}</span>
                                </div>
                              )}
                            </div>
                            <p className="text-xs text-center text-[var(--md-sys-color-primary)]">
                              {selectedImage.compressedSize ? formatFileSize(selectedImage.compressedSize) : '-'}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* 详细信息 */}
                      <div className="space-y-4">
                        <h4 className="font-medium text-[var(--md-sys-color-on-surface)]">{t("infoTitle")}</h4>
                        <div className="space-y-3 text-sm">
                          <div className="flex justify-between">
                            <span className="text-[var(--md-sys-color-on-surface-variant)]">{t("fileName")}</span>
                            <span className="text-[var(--md-sys-color-on-surface)] truncate max-w-[200px]">{selectedImage.file.name}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-[var(--md-sys-color-on-surface-variant)]">{t("originalDimensions")}</span>
                            <span className="text-[var(--md-sys-color-on-surface)]">{selectedImage.width} × {selectedImage.height}</span>
                          </div>
                          {selectedImage.newWidth && selectedImage.newHeight && (
                            <div className="flex justify-between">
                              <span className="text-[var(--md-sys-color-on-surface-variant)]">{t("compressedDimensions")}</span>
                              <span className="text-[var(--md-sys-color-on-surface)]">{selectedImage.newWidth} × {selectedImage.newHeight}</span>
                            </div>
                          )}
                          <div className="flex justify-between">
                            <span className="text-[var(--md-sys-color-on-surface-variant)]">{t("originalSize")}</span>
                            <span className="text-[var(--md-sys-color-on-surface)]">{formatFileSize(selectedImage.originalSize)}</span>
                          </div>
                          {selectedImage.compressedSize && (
                            <>
                              <div className="flex justify-between">
                                <span className="text-[var(--md-sys-color-on-surface-variant)]">{t("compressedSize")}</span>
                                <span className="text-[var(--md-sys-color-primary)]">{formatFileSize(selectedImage.compressedSize)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-[var(--md-sys-color-on-surface-variant)]">
                                  {selectedImage.compressedSize <= selectedImage.originalSize ? t("savedSpace") : t("increasedSize")}
                                </span>
                                <span className={`font-medium ${selectedImage.compressedSize <= selectedImage.originalSize ? 'text-[var(--md-sys-color-primary)]' : 'text-[var(--md-sys-color-error)]'}`}>
                                  {getCompressionRatio(selectedImage.originalSize, selectedImage.compressedSize)}
                                </span>
                              </div>
                            </>
                          )}
                          <div className="flex justify-between">
                            <span className="text-[var(--md-sys-color-on-surface-variant)]">{t("quality")}</span>
                            <span className="text-[var(--md-sys-color-on-surface)]">{selectedImage.quality}%</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-[var(--md-sys-color-on-surface-variant)]">{t("outputFormat")}</span>
                            <span className="text-[var(--md-sys-color-on-surface)] uppercase">
                              {selectedImage.format}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>
      </div>

      {/* 图片预览弹窗:用 Dialog 拿到对话框语义、焦点圈禁与 Escape 关闭 */}
      <Dialog
        open={previewImage !== null}
        onOpenChange={(open) => {
          if (!open) setPreviewImage(null)
        }}
      >
        <DialogContent
          aria-describedby={undefined}
          className="max-w-[90vw] border-0 bg-transparent p-0 text-white shadow-none sm:max-w-[90vw]"
        >
          <DialogHeader>
            <DialogTitle className="pr-8 text-sm font-normal">{previewTitle}</DialogTitle>
          </DialogHeader>
          {previewImage && (
            <img
              src={previewImage}
              alt={previewTitle}
              className="max-h-[85vh] max-w-full rounded-lg object-contain"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
