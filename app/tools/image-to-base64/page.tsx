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
import { 
  Clipboard, Download, Upload, X, ImageIcon, 
  FileImage, Eye, Trash2, RefreshCw, AlertCircle,
  ArrowRightLeft, Zap, Maximize2
} from "lucide-react"

interface ProcessedImage {
  id: string
  file: File
  dataUrl: string
  previewUrl: string // 添加预览图片URL
  base64: string
  dimensions: { width: number; height: number }
  size: number
  format: string
}

interface ImageToBase64Props {
  params?: Record<string, string>
}

export default function ImageToBase64({ params }: ImageToBase64Props) {
  const { toast } = useToast()

  // 状态管理
  const [activeTab, setActiveTab] = useState("image-to-base64")
  const [images, setImages] = useState<ProcessedImage[]>([])
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [includePrefix, setIncludePrefix] = useState(false)
  const [outputFormat, setOutputFormat] = useState<'base64' | 'dataUrl' | 'css' | 'html'>('base64')
  const [copied, setCopied] = useState<Record<string, boolean>>({})
  
  // 性能优化相关状态
  const [showFullBase64, setShowFullBase64] = useState(false)
  const [previewQuality, setPreviewQuality] = useState(0.7) // 预览图片质量
  const [virtualizeText, setVirtualizeText] = useState(true) // 是否虚拟化长文本
  const [processingProgress, setProcessingProgress] = useState(0)

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
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      const img = new Image()

      img.onload = () => {
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
      }

      img.onerror = () => reject(new Error('预览图片生成失败'))
      img.src = URL.createObjectURL(file)
    })
  }, [previewQuality])

  // 支持的图片格式
  const supportedFormats = {
    'image/jpeg': { ext: 'jpg', name: 'JPEG' },
    'image/png': { ext: 'png', name: 'PNG' },
    'image/gif': { ext: 'gif', name: 'GIF' },
    'image/webp': { ext: 'webp', name: 'WebP' },
    'image/bmp': { ext: 'bmp', name: 'BMP' },
    'image/svg+xml': { ext: 'svg', name: 'SVG' }
  }

  // 处理单个文件（优化版本）
  const processFile = useCallback(async (file: File, onProgress?: (progress: number) => void): Promise<ProcessedImage | null> => {
    try {
      onProgress?.(10)
      
      // 验证文件类型
      if (!Object.keys(supportedFormats).includes(file.type)) {
        toast({
          title: "不支持的文件格式",
          description: `支持的格式：${Object.values(supportedFormats).map(f => f.name).join(', ')}`,
          variant: "destructive",
        })
        return null
      }

      // 验证文件大小（最大100MB）
      const maxSize = 100 * 1024 * 1024
      if (file.size > maxSize) {
        toast({
          title: "文件过大",
          description: "文件大小不能超过100MB",
          variant: "destructive",
        })
        return null
      }

      onProgress?.(30)

      // 并行处理：同时生成预览图片和读取原始文件
      const [dataUrl, previewUrl] = await Promise.all([
        // 读取原始文件
        new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = (e) => resolve(e.target?.result as string)
          reader.onerror = () => reject(new Error('文件读取失败'))
          reader.readAsDataURL(file)
        }),
        // 生成预览图片
        createPreviewImage(file).catch(() => {
          // 如果预览生成失败，使用原图
          return new Promise<string>((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = (e) => resolve(e.target?.result as string)
            reader.onerror = () => reject(new Error('预览图片生成失败'))
            reader.readAsDataURL(file)
          })
        })
      ])

      onProgress?.(70)

      // 获取图片尺寸
      const dimensions = await new Promise<{ width: number, height: number }>((resolve, reject) => {
        const img = new Image()
        img.onload = () => resolve({ width: img.width, height: img.height })
        img.onerror = () => reject(new Error('图片尺寸获取失败'))
        img.src = dataUrl
      })

      onProgress?.(90)

      const processedImage: ProcessedImage = {
        id: Math.random().toString(36).substr(2, 9),
        file,
        dataUrl,
        previewUrl,
        base64: dataUrl.split(',')[1],
        dimensions,
        size: file.size,
        format: supportedFormats[file.type as keyof typeof supportedFormats]?.name || file.type,
      }

      onProgress?.(100)
      return processedImage
    } catch (error) {
      console.error('文件处理失败:', error)
      toast({
        title: "处理失败",
        description: error instanceof Error ? error.message : "未知错误",
        variant: "destructive",
      })
      return null
    }
  }, [toast, createPreviewImage])

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
        
        toast({
          title: "处理完成",
          description: `成功处理 ${processedImages.length} 张图片`,
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
    }
  }

  // 清空所有图片
  const clearAllImages = () => {
    setImages([])
    setSelectedImageId(null)
  }

  // 处理Base64输入解码
  const handleBase64Decode = useCallback(() => {
    if (!base64Input.trim()) {
      setDecodeError("请输入Base64字符串")
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
        const format = supportedFormats[mimeType as keyof typeof supportedFormats]?.name || mimeType

        setDecodedImage({
          dataUrl,
          dimensions: { width: img.width, height: img.height },
          size,
          format
        })
        
        toast({
          title: "解码成功",
          description: `图片尺寸：${img.width}×${img.height}`,
        })
      }

      img.onerror = () => {
        setDecodeError("无效的Base64图片数据")
        setDecodedImage(null)
      }

      img.src = dataUrl
    } catch (error) {
      setDecodeError("Base64字符串格式错误")
      setDecodedImage(null)
    }
  }, [base64Input, toast])

  // 复制到剪贴板
  const copyToClipboard = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(prev => ({ ...prev, [type]: true }))
      setTimeout(() => {
        setCopied(prev => ({ ...prev, [type]: false }))
      }, 2000)
      
      toast({
        title: "已复制",
        description: "内容已复制到剪贴板",
      })
    } catch (error) {
      toast({
        title: "复制失败",
        description: "无法复制到剪贴板",
        variant: "destructive",
      })
    }
  }

  // 生成不同格式的输出
  const generateOutput = (image: ProcessedImage): string => {
    const base64Data = includePrefix ? image.dataUrl : image.base64
    
    switch (outputFormat) {
      case 'base64':
        return includePrefix ? image.dataUrl : image.base64
      case 'dataUrl':
        return image.dataUrl
      case 'css':
        return `background-image: url(${image.dataUrl});`
      case 'html':
        return `<img src="${image.dataUrl}" alt="${image.file.name}" />`
      default:
        return base64Data
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
      title: "下载完成",
      description: "图片已保存到本地",
    })
  }

  // 格式化文件大小
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  // 虚拟化Base64文本显示（优化大文本性能）
  const VirtualizedTextArea = ({ value, isLarge = false }: { value: string, isLarge?: boolean }) => {
    const displayValue = useMemo(() => {
      if (!virtualizeText || !isLarge || value.length < 50000) {
        return value
      }
      
      if (showFullBase64) {
        return value
      }
      
      // 只显示前面和后面的部分
      const start = value.substring(0, 1000)
      const end = value.substring(value.length - 1000)
      const hiddenLength = value.length - 2000
      
      return `${start}\n\n... [隐藏 ${hiddenLength.toLocaleString()} 个字符] ...\n\n${end}`
    }, [value, isLarge, showFullBase64, virtualizeText])

    const shouldShowToggle = virtualizeText && isLarge && value.length >= 50000

    return (
      <div className="space-y-2">
        <Textarea
          value={displayValue}
          readOnly
          className="font-mono text-xs h-[300px] resize-none"
        />
        {shouldShowToggle && (
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>
              {showFullBase64 ? '显示完整内容' : `仅显示部分内容 (${displayValue.length.toLocaleString()}/${value.length.toLocaleString()} 字符)`}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowFullBase64(!showFullBase64)}
            >
              {showFullBase64 ? '收起' : '显示全部'}
            </Button>
          </div>
        )}
      </div>
    )
  }

  // 选中的图片
  const selectedImage = images.find(img => img.id === selectedImageId)

  return (
    <div className="container mx-auto py-6 px-4 max-w-6xl">
      {/* 页面标题 */}
      <div className="text-center space-y-4 mb-6">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-200">
          图片 ⇄ Base64 转换器
        </h1>
        <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
          支持图片转Base64编码和Base64解码显示图片，无压缩原图质量
        </p>
      </div>

      {/* 性能优化设置 */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Zap className="h-5 w-5" />
              性能优化设置
            </CardTitle>
            <div className="flex items-center gap-4">
              <div className="flex items-center space-x-2">
                <Switch
                  id="virtualize-text"
                  checked={virtualizeText}
                  onCheckedChange={setVirtualizeText}
                />
                <Label htmlFor="virtualize-text" className="text-sm">智能显示优化</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Label className="text-sm">预览质量:</Label>
                <select
                  value={previewQuality}
                  onChange={(e) => setPreviewQuality(Number(e.target.value))}
                  className="text-sm border rounded px-2 py-1 dark:bg-gray-800 dark:border-gray-600"
                >
                  <option value={0.5}>低 (省内存)</option>
                  <option value={0.7}>中 (推荐)</option>
                  <option value={0.9}>高 (占内存)</option>
                </select>
              </div>
              {images.length > 5 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearAllImages}
                  className="text-red-600 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  清理内存
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <strong>智能显示优化:</strong> 对于大于50KB的Base64字符串，仅显示开头和结尾部分，大幅提升页面响应速度
              </div>
              <div>
                <strong>预览质量:</strong> 调整缩略图质量，降低质量可减少内存占用，但不影响原图编码质量
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
            图片 → Base64
          </TabsTrigger>
          <TabsTrigger value="base64-to-image" className="flex items-center gap-2">
            <ArrowRightLeft className="h-4 w-4" />
            Base64 → 图片
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
                    图片上传
                  </CardTitle>
                  {images.length > 0 && (
                    <Button variant="ghost" size="sm" onClick={clearAllImages}>
                      <Trash2 className="h-4 w-4" />
                      清空
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div
                  className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
                    isDragging 
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20" 
                      : "border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600"
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
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
                      <div>
                        <div className="font-medium">处理中...</div>
                        <div className="text-sm text-gray-500">正在读取和优化图片</div>
                        {processingProgress > 0 && (
                          <div className="mt-2">
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div 
                                className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                                style={{ width: `${processingProgress}%` }}
                              ></div>
                            </div>
                            <div className="text-xs text-gray-400 mt-1">
                              {Math.round(processingProgress)}%
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <ImageIcon className="mx-auto h-12 w-12 text-gray-400" />
                      <div>
                        <p className="text-lg font-medium text-gray-700 dark:text-gray-300">
                          拖拽图片到此处或点击上传
                        </p>
                        <p className="text-sm text-gray-500 mt-2">
                          支持 {Object.values(supportedFormats).map(f => f.name).join(', ')} 格式
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          单个文件最大 50MB，无压缩原图质量
                        </p>
                      </div>
                      <Button variant="outline" className="mt-4">
                        <Upload className="h-4 w-4 mr-2" />
                        选择图片
                      </Button>
                    </div>
                  )}
                </div>

                {/* 图片列表 */}
                {images.length > 0 && (
                  <div className="mt-6 space-y-3">
                    <h4 className="font-medium">已上传图片 ({images.length})</h4>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {images.map((image) => (
                        <div
                          key={image.id}
                          className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                            selectedImageId === image.id
                              ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                              : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                          }`}
                          onClick={() => setSelectedImageId(image.id)}
                        >
                          <img
                            src={image.previewUrl}
                            alt={image.file.name}
                            className="w-12 h-12 object-cover rounded"
                            loading="lazy"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm truncate">{image.file.name}</div>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="secondary" className="text-xs">
                                {image.format}
                              </Badge>
                              <span className="text-xs text-gray-500">
                                {image.dimensions.width}×{image.dimensions.height}
                              </span>
                              <span className="text-xs text-gray-500">
                                {formatFileSize(image.size)}
                              </span>
                            </div>
                          </div>
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
                  Base64 输出
                </CardTitle>
              </CardHeader>
              <CardContent>
                {selectedImage ? (
                  <div className="space-y-4">
                    {/* 输出设置 */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>输出格式</Label>
                        <Select value={outputFormat} onValueChange={(value: typeof outputFormat) => setOutputFormat(value)}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="base64">Base64</SelectItem>
                            <SelectItem value="dataUrl">Data URL</SelectItem>
                            <SelectItem value="css">CSS 样式</SelectItem>
                            <SelectItem value="html">HTML 标签</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="flex items-center space-x-2 pt-6">
                        <Switch
                          id="include-prefix"
                          checked={includePrefix}
                          onCheckedChange={setIncludePrefix}
                        />
                        <Label htmlFor="include-prefix">包含数据前缀</Label>
                      </div>
                    </div>

                    {/* 图片信息 */}
                    <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg space-y-2">
                      <div className="font-medium text-sm">{selectedImage.file.name}</div>
                      <div className="grid grid-cols-3 gap-2 text-xs text-gray-500">
                        <div>格式: {selectedImage.format}</div>
                        <div>尺寸: {selectedImage.dimensions.width}×{selectedImage.dimensions.height}</div>
                        <div>大小: {formatFileSize(selectedImage.size)}</div>
                      </div>
                    </div>
                    
                    {/* Base64 输出 */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>编码结果 ({formatFileSize(selectedImage.base64.length)})</Label>
                        <div className="flex gap-2">
                          {selectedImage.base64.length > 50000 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setVirtualizeText(!virtualizeText)}
                            >
                              {virtualizeText ? '显示全部' : '优化显示'}
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => copyToClipboard(generateOutput(selectedImage), selectedImage.id)}
                          >
                            <Clipboard className="h-4 w-4 mr-2" />
                            {copied[selectedImage.id] ? "已复制" : "复制"}
                          </Button>
                        </div>
                      </div>
                      <VirtualizedTextArea 
                        value={generateOutput(selectedImage)} 
                        isLarge={selectedImage.base64.length > 50000}
                      />
                      {selectedImage.base64.length > 50000 && (
                        <div className="text-xs text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20 p-2 rounded">
                          ⚡ 大图片已启用性能优化显示
                        </div>
                      )}
                    </div>

                    {/* 图片预览 */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>图片预览</Label>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            const img = document.querySelector('#preview-img') as HTMLImageElement
                            if (img) {
                              img.src = img.src === selectedImage.previewUrl ? selectedImage.dataUrl : selectedImage.previewUrl
                            }
                          }}
                        >
                          <Maximize2 className="h-4 w-4 mr-1" />
                          原图
                        </Button>
                      </div>
                      <div className="border rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800 flex justify-center">
                        <img
                          id="preview-img"
                          src={selectedImage.previewUrl}
                          alt={selectedImage.file.name}
                          className="max-h-[200px] object-contain cursor-pointer"
                          loading="lazy"
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-[400px] text-gray-500 dark:text-gray-400">
                    <ImageIcon className="h-12 w-12 mb-2 opacity-20" />
                    <p>选择图片查看Base64编码结果</p>
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
                  Base64 输入
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Base64 字符串</Label>
                  <Textarea
                    value={base64Input}
                    onChange={(e) => setBase64Input(e.target.value)}
                    placeholder="粘贴Base64字符串，支持带或不带data:前缀..."
                    className="font-mono text-xs h-[200px] resize-none"
                  />
                  <p className="text-xs text-gray-500">
                    支持纯Base64字符串或完整的Data URL格式
                  </p>
                  {base64Input.length > 50000 && (
                    <div className="text-xs text-blue-600 bg-blue-50 dark:bg-blue-900/20 p-2 rounded">
                      ⚡ 检测到大型Base64字符串，解码后可能占用较多内存
                    </div>
                  )}
                </div>
                
                <div className="flex gap-2">
                  <Button onClick={handleBase64Decode} className="flex-1">
                    <Eye className="h-4 w-4 mr-2" />
                    解码显示
                  </Button>
                  <Button 
                    variant="outline" 
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
                  <Alert>
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
                  解码结果
                </CardTitle>
              </CardHeader>
              <CardContent>
                {decodedImage ? (
                  <div className="space-y-4">
                    {/* 图片信息 */}
                    <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="text-gray-500">格式:</span>
                          <span className="ml-2 font-medium">{decodedImage.format}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">大小:</span>
                          <span className="ml-2 font-medium">{formatFileSize(decodedImage.size)}</span>
                        </div>
                        <div className="col-span-2">
                          <span className="text-gray-500">尺寸:</span>
                          <span className="ml-2 font-medium">
                            {decodedImage.dimensions.width} × {decodedImage.dimensions.height}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* 图片显示 */}
                    <div className="space-y-2">
                      <Label>解码图片</Label>
                      <div className="border rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800 flex justify-center">
                        <img
                          src={decodedImage.dataUrl}
                          alt="Decoded"
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
                        {copied.decoded ? "已复制" : "复制Data URL"}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={downloadDecodedImage}
                        className="flex-1"
                      >
                        <Download className="h-4 w-4 mr-2" />
                        下载图片
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-[400px] text-gray-500 dark:text-gray-400">
                    <RefreshCw className="h-12 w-12 mb-2 opacity-20" />
                    <p>输入Base64字符串查看图片</p>
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