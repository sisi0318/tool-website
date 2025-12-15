"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { useToast } from "@/hooks/use-toast"
import { 
  Upload, ImageIcon, Download, X, Trash2, 
  Settings, Zap, FileImage, CheckCircle2,
  Minimize2, Maximize2
} from "lucide-react"
import { M3Slider } from "@/components/m3/slider"

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

interface ImageCompressProps {
  params?: Record<string, string>
}

export default function ImageCompressPage({ params }: ImageCompressProps) {
  const { toast } = useToast()

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
  const [maintainAspectRatio, setMaintainAspectRatio] = useState(true)
  
  // 图片预览弹窗
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const [previewTitle, setPreviewTitle] = useState<string>("")

  const fileInputRef = useRef<HTMLInputElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  
  // 用于追踪设置变化，避免新上传图片触发全部重新压缩
  const settingsRef = useRef({ quality, outputFormat, maxWidth, maxHeight })

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

  // 压缩单个图片
  const compressImage = useCallback(async (
    file: File,
    quality: number,
    format: string,
    maxW?: number,
    maxH?: number
  ): Promise<{ blob: Blob; width: number; height: number; actualFormat: string }> => {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => {
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
          reject(new Error('无法创建canvas上下文'))
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
              reject(new Error('压缩失败'))
            }
          },
          mimeType,
          outputQuality
        )
      }
      img.onerror = () => reject(new Error('图片加载失败'))
      img.src = URL.createObjectURL(file)
    })
  }, [])

  // 处理单个文件
  const processFile = useCallback(async (file: File): Promise<CompressedImage> => {
    const imageId = Math.random().toString(36).substr(2, 9)
    const originalUrl = URL.createObjectURL(file)

    // 获取原始图片尺寸
    const img = new Image()
    await new Promise<void>((resolve) => {
      img.onload = () => resolve()
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

    try {
      const maxW = maxWidth ? parseInt(maxWidth) : undefined
      const maxH = maxHeight ? parseInt(maxHeight) : undefined
      
      const { blob, width, height, actualFormat } = await compressImage(file, quality, outputFormat, maxW, maxH)
      
      processedImage.compressedUrl = URL.createObjectURL(blob)
      processedImage.compressedSize = blob.size
      processedImage.newWidth = width
      processedImage.newHeight = height
      processedImage.format = actualFormat // 使用实际输出格式
      processedImage.isProcessing = false
      
      return processedImage
    } catch (error) {
      processedImage.error = error instanceof Error ? error.message : '压缩失败'
      processedImage.isProcessing = false
      return processedImage
    }
  }, [quality, outputFormat, maxWidth, maxHeight, compressImage])

  // 处理文件选择
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return

    setIsProcessing(true)
    
    try {
      const validFiles = files.filter(file => supportedFormats.includes(file.type))
      
      if (validFiles.length === 0) {
        toast({
          title: "文件格式不支持",
          description: "请选择 JPEG、PNG 或 WebP 格式的图片",
          variant: "destructive"
        })
        return
      }

      const processedImages = await Promise.all(
        validFiles.map(file => processFile(file))
      )

      setImages(prev => [...prev, ...processedImages])
      
      if (processedImages.length > 0) {
        setSelectedImageId(processedImages[0].id)
      }

      const successCount = processedImages.filter(img => !img.error).length
      toast({
        title: "处理完成",
        description: `成功压缩 ${successCount} 张图片`,
      })
    } finally {
      setIsProcessing(false)
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

      setImages(prev => [...prev, ...processedImages])
      
      if (processedImages.length > 0) {
        setSelectedImageId(processedImages[0].id)
      }
    } finally {
      setIsProcessing(false)
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
      
      // 释放旧的压缩URL
      if (image.compressedUrl) {
        URL.revokeObjectURL(image.compressedUrl)
      }

      setImages(prev => prev.map(img => 
        img.id === imageId ? {
          ...img,
          compressedUrl: URL.createObjectURL(blob),
          compressedSize: blob.size,
          newWidth: width,
          newHeight: height,
          quality,
          format: actualFormat,
          isProcessing: false,
        } : img
      ))

      toast({
        title: "重新压缩完成",
        description: `新大小: ${formatFileSize(blob.size)}`,
      })
    } catch (error) {
      setImages(prev => prev.map(img => 
        img.id === imageId ? {
          ...img,
          error: error instanceof Error ? error.message : '压缩失败',
          isProcessing: false,
        } : img
      ))
    }
  }

  // 下载压缩后的图片
  const downloadImage = (image: CompressedImage) => {
    if (!image.compressedUrl) return

    const link = document.createElement('a')
    link.href = image.compressedUrl
    
    // 使用实际输出格式作为扩展名
    const ext = image.format || 'jpg'
    
    const baseName = image.file.name.replace(/\.[^/.]+$/, '')
    link.download = `${baseName}_compressed.${ext}`
    
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // 下载所有压缩后的图片
  const downloadAll = () => {
    const compressedImages = images.filter(img => img.compressedUrl && !img.error)
    compressedImages.forEach(img => downloadImage(img))
    
    toast({
      title: "下载完成",
      description: `已下载 ${compressedImages.length} 张图片`,
    })
  }

  // 删除图片
  const removeImage = (id: string) => {
    setImages(prev => {
      const image = prev.find(img => img.id === id)
      if (image) {
        URL.revokeObjectURL(image.originalUrl)
        if (image.compressedUrl) {
          URL.revokeObjectURL(image.compressedUrl)
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
    images.forEach(img => {
      URL.revokeObjectURL(img.originalUrl)
      if (img.compressedUrl) {
        URL.revokeObjectURL(img.compressedUrl)
      }
    })
    setImages([])
    setSelectedImageId(null)
  }

  // 当压缩设置变化时，自动重新压缩所有图片
  // 当压缩设置变化时，自动重新压缩所有图片
  useEffect(() => {
    // 检查设置是否真的变化了
    const prevSettings = settingsRef.current
    const settingsChanged = 
      prevSettings.quality !== quality ||
      prevSettings.outputFormat !== outputFormat ||
      prevSettings.maxWidth !== maxWidth ||
      prevSettings.maxHeight !== maxHeight
    
    // 更新 ref
    settingsRef.current = { quality, outputFormat, maxWidth, maxHeight }
    
    // 如果设置没变化或没有图片，不执行
    if (!settingsChanged || images.length === 0) return
    
    const recompressAll = async () => {
      const maxW = maxWidth ? parseInt(maxWidth) : undefined
      const maxH = maxHeight ? parseInt(maxHeight) : undefined
      
      // 获取当前图片列表的快照
      const currentImages = [...images]
      
      // 标记所有图片为处理中
      setImages(prev => prev.map(img => ({ ...img, isProcessing: true })))
      
      // 逐个重新压缩
      for (const image of currentImages) {
        try {
          const { blob, width, height, actualFormat } = await compressImage(image.file, quality, outputFormat, maxW, maxH)
          
          setImages(prev => prev.map(img => {
            if (img.id === image.id) {
              // 释放旧的压缩URL
              if (img.compressedUrl) {
                URL.revokeObjectURL(img.compressedUrl)
              }
              return {
                ...img,
                compressedUrl: URL.createObjectURL(blob),
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
          setImages(prev => prev.map(img => 
            img.id === image.id ? {
              ...img,
              error: error instanceof Error ? error.message : '压缩失败',
              isProcessing: false,
            } : img
          ))
        }
      }
    }
    
    // 使用防抖，避免频繁重新压缩
    const timeoutId = setTimeout(recompressAll, 300)
    return () => clearTimeout(timeoutId)
  }, [quality, outputFormat, maxWidth, maxHeight, images, compressImage])

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
          图片压缩工具
        </h1>
        <p className="text-[var(--md-sys-color-on-surface-variant)] max-w-2xl mx-auto">
          在线压缩图片，支持批量处理，可调节质量和尺寸
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
                上传图片
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
                    <div className="text-sm text-[var(--md-sys-color-on-surface-variant)]">压缩中...</div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <ImageIcon className="mx-auto h-8 w-8 text-[var(--md-sys-color-on-surface-variant)]" />
                    <div>
                      <p className="font-medium text-[var(--md-sys-color-on-surface)]">
                        拖拽图片或点击上传
                      </p>
                      <p className="text-xs text-[var(--md-sys-color-on-surface-variant)] mt-1">
                        支持 JPEG、PNG、WebP 格式
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {images.length > 0 && (
                <div className="mt-4 flex justify-between items-center">
                  <span className="text-sm text-[var(--md-sys-color-on-surface-variant)]">{images.length} 张图片</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearAllImages}
                    className="text-[var(--md-sys-color-error)] hover:text-[var(--md-sys-color-error)]"
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    清空
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
                压缩设置
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* 质量滑块 */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <Label className="text-[var(--md-sys-color-on-surface)]">压缩质量</Label>
                  <span className="text-sm font-medium text-[var(--md-sys-color-primary)]">{quality}%</span>
                </div>
                <M3Slider
                  value={[quality]}
                  onValueChange={(values) => setQuality(values[0])}
                  min={10}
                  max={100}
                  step={5}
                />
                <p className="text-xs text-[var(--md-sys-color-on-surface-variant)]">
                  质量越低，文件越小，但图片可能会失真
                </p>
              </div>

              {/* 输出格式 */}
              <div className="space-y-2">
                <Label className="text-[var(--md-sys-color-on-surface)]">输出格式</Label>
                <Select value={outputFormat} onValueChange={setOutputFormat}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="original">自动优化</SelectItem>
                    <SelectItem value="jpeg">JPEG (有损，最小体积)</SelectItem>
                    <SelectItem value="webp">WebP (推荐，高压缩比)</SelectItem>
                    <SelectItem value="png">PNG (无损，体积较大)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-[var(--md-sys-color-on-surface-variant)]">
                  自动优化会将 PNG 转为 WebP 以获得更好的压缩效果
                </p>
              </div>

              {/* 尺寸限制 */}
              <div className="space-y-2">
                <Label className="text-[var(--md-sys-color-on-surface)]">最大尺寸 (可选)</Label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Input
                      type="number"
                      placeholder="最大宽度"
                      value={maxWidth}
                      onChange={(e) => setMaxWidth(e.target.value)}
                    />
                  </div>
                  <div>
                    <Input
                      type="number"
                      placeholder="最大高度"
                      value={maxHeight}
                      onChange={(e) => setMaxHeight(e.target.value)}
                    />
                  </div>
                </div>
                <p className="text-xs text-[var(--md-sys-color-on-surface-variant)]">
                  留空则保持原尺寸
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
                    下载全部
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
                  压缩统计
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--md-sys-color-on-surface-variant)]">原始总大小</span>
                  <span className="font-medium text-[var(--md-sys-color-on-surface)]">{formatFileSize(totalOriginalSize)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--md-sys-color-on-surface-variant)]">压缩后总大小</span>
                  <span className="font-medium text-[var(--md-sys-color-on-surface)]">{formatFileSize(totalCompressedSize)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--md-sys-color-on-surface-variant)]">
                    {totalCompressedSize <= totalOriginalSize ? '节省空间' : '增加大小'}
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
                  还没有图片
                </h3>
                <p className="text-[var(--md-sys-color-on-surface-variant)]">
                  上传图片开始压缩
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
                          <p className="text-xs text-[var(--md-sys-color-error)]">{image.error}</p>
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
                            重新压缩
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
                            下载
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
                      压缩详情
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* 对比预览 */}
                      <div className="space-y-4">
                        <h4 className="font-medium text-[var(--md-sys-color-on-surface)]">对比预览</h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <p className="text-xs text-center text-[var(--md-sys-color-on-surface-variant)]">原图</p>
                            <div className="relative aspect-square rounded-[var(--md-sys-shape-corner-medium)] overflow-hidden bg-[var(--md-sys-color-surface-variant)] group">
                              <img
                                src={selectedImage.originalUrl}
                                alt="原图"
                                className="w-full h-full object-contain"
                              />
                              <Button
                                variant="secondary"
                                size="sm"
                                className="absolute top-2 right-2 h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => {
                                  setPreviewImage(selectedImage.originalUrl)
                                  setPreviewTitle(`原图 - ${selectedImage.file.name}`)
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
                            <p className="text-xs text-center text-[var(--md-sys-color-on-surface-variant)]">压缩后</p>
                            <div className="relative aspect-square rounded-[var(--md-sys-shape-corner-medium)] overflow-hidden bg-[var(--md-sys-color-surface-variant)] group">
                              {selectedImage.compressedUrl ? (
                                <>
                                  <img
                                    src={selectedImage.compressedUrl}
                                    alt="压缩后"
                                    className="w-full h-full object-contain"
                                  />
                                  <Button
                                    variant="secondary"
                                    size="sm"
                                    className="absolute top-2 right-2 h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                    onClick={() => {
                                      setPreviewImage(selectedImage.compressedUrl)
                                      setPreviewTitle(`压缩后 - ${selectedImage.file.name}`)
                                    }}
                                  >
                                    <Maximize2 className="h-4 w-4" />
                                  </Button>
                                </>
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <span className="text-xs text-[var(--md-sys-color-on-surface-variant)]">处理中...</span>
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
                        <h4 className="font-medium text-[var(--md-sys-color-on-surface)]">详细信息</h4>
                        <div className="space-y-3 text-sm">
                          <div className="flex justify-between">
                            <span className="text-[var(--md-sys-color-on-surface-variant)]">文件名</span>
                            <span className="text-[var(--md-sys-color-on-surface)] truncate max-w-[200px]">{selectedImage.file.name}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-[var(--md-sys-color-on-surface-variant)]">原始尺寸</span>
                            <span className="text-[var(--md-sys-color-on-surface)]">{selectedImage.width} × {selectedImage.height}</span>
                          </div>
                          {selectedImage.newWidth && selectedImage.newHeight && (
                            <div className="flex justify-between">
                              <span className="text-[var(--md-sys-color-on-surface-variant)]">压缩后尺寸</span>
                              <span className="text-[var(--md-sys-color-on-surface)]">{selectedImage.newWidth} × {selectedImage.newHeight}</span>
                            </div>
                          )}
                          <div className="flex justify-between">
                            <span className="text-[var(--md-sys-color-on-surface-variant)]">原始大小</span>
                            <span className="text-[var(--md-sys-color-on-surface)]">{formatFileSize(selectedImage.originalSize)}</span>
                          </div>
                          {selectedImage.compressedSize && (
                            <>
                              <div className="flex justify-between">
                                <span className="text-[var(--md-sys-color-on-surface-variant)]">压缩后大小</span>
                                <span className="text-[var(--md-sys-color-primary)]">{formatFileSize(selectedImage.compressedSize)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-[var(--md-sys-color-on-surface-variant)]">
                                  {selectedImage.compressedSize <= selectedImage.originalSize ? '节省空间' : '增加大小'}
                                </span>
                                <span className={`font-medium ${selectedImage.compressedSize <= selectedImage.originalSize ? 'text-[var(--md-sys-color-primary)]' : 'text-[var(--md-sys-color-error)]'}`}>
                                  {getCompressionRatio(selectedImage.originalSize, selectedImage.compressedSize)}
                                </span>
                              </div>
                            </>
                          )}
                          <div className="flex justify-between">
                            <span className="text-[var(--md-sys-color-on-surface-variant)]">压缩质量</span>
                            <span className="text-[var(--md-sys-color-on-surface)]">{selectedImage.quality}%</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-[var(--md-sys-color-on-surface-variant)]">输出格式</span>
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

      {/* 隐藏的canvas用于压缩 */}
      <canvas ref={canvasRef} className="hidden" />

      {/* 图片预览弹窗 */}
      {previewImage && (
        <div 
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative max-w-[90vw] max-h-[90vh]">
            <div className="absolute -top-10 left-0 right-0 flex items-center justify-between">
              <span className="text-white text-sm">{previewTitle}</span>
              <Button
                variant="ghost"
                size="sm"
                className="text-white hover:bg-white/20"
                onClick={() => setPreviewImage(null)}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
            <img
              src={previewImage}
              alt={previewTitle}
              className="max-w-full max-h-[85vh] object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </div>
  )
}
