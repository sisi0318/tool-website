"use client"

import { useState, useRef, useCallback, useMemo } from "react"
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
import { useToast } from "@/hooks/use-toast"
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

  // 支持的图片格式
  const supportedFormats = ['image/jpeg', 'image/png', 'image/tiff', 'image/webp', 'image/bmp', 'image/gif']

  // 处理单个文件
  const processFile = useCallback(async (file: File): Promise<ProcessedImage> => {
    const imageId = Math.random().toString(36).substr(2, 9)
    const imageUrl = URL.createObjectURL(file)

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
        iptc: true,
        icc: true,
        mpf: true,
        chunked: true,
        firstChunkSize: 40000,
        chunkSize: 10000
      })

      processedImage.exifData = exif || {}
      processedImage.isProcessing = false
      
      return processedImage
    } catch (error) {
      console.error('EXIF解析错误:', error)
      processedImage.error = `解析失败: ${error instanceof Error ? error.message : '未知错误'}`
      processedImage.isProcessing = false
      return processedImage
    }
  }, [])

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
          description: "请选择有效的图片文件",
          variant: "destructive"
        })
        return
      }

      if (validFiles.length !== files.length) {
        toast({
          title: "部分文件被跳过",
          description: `${files.length - validFiles.length} 个文件格式不支持`,
        })
      }

      // 并行处理多个文件
      const processedImages = await Promise.all(
        validFiles.map(file => processFile(file))
      )

      setImages(prev => [...prev, ...processedImages])
      
      // 自动选择第一张图片
      if (processedImages.length > 0) {
        setSelectedImageId(processedImages[0].id)
      }

      toast({
        title: "处理完成",
        description: `成功处理 ${processedImages.length} 张图片`,
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

  // 删除图片
  const removeImage = (id: string) => {
    setImages(prev => {
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
    images.forEach(img => URL.revokeObjectURL(img.imageUrl))
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
      await navigator.clipboard.writeText(text)
      toast({
        title: "已复制",
        description: `${label} 已复制到剪贴板`,
      })
    } catch (error) {
      toast({
        title: "复制失败",
        description: "无法复制到剪贴板",
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
        color: "bg-blue-500"
      },
      {
        name: "image",
        icon: <ImageIcon className="h-4 w-4" />,
        fields: [],
        color: "bg-green-500"
      },
      {
        name: "location",
        icon: <MapPin className="h-4 w-4" />,
        fields: [],
        color: "bg-red-500"
      },
      {
        name: "datetime",
        icon: <Calendar className="h-4 w-4" />,
        fields: [],
        color: "bg-purple-500"
      },
      {
        name: "technical",
        icon: <Settings className="h-4 w-4" />,
        fields: [],
        color: "bg-orange-500"
      },
      {
        name: "other",
        icon: <Info className="h-4 w-4" />,
        fields: [],
        color: "bg-gray-500"
      }
    ]

    // 定义字段映射和重要性
    const fieldMappings: Record<string, { category: string, label: string, important: boolean, formatter?: (value: any) => string }> = {
      // 相机信息
      Make: { category: "camera", label: "制造商", important: true },
      Model: { category: "camera", label: "型号", important: true },
      LensMake: { category: "camera", label: "镜头制造商", important: false },
      LensModel: { category: "camera", label: "镜头型号", important: false },
      FNumber: { category: "camera", label: "光圈", important: true, formatter: (v) => `f/${v}` },
      ExposureTime: { category: "camera", label: "快门速度", important: true, formatter: (v) => v < 1 ? `1/${Math.round(1/v)}s` : `${v}s` },
      ISO: { category: "camera", label: "ISO", important: true },
      FocalLength: { category: "camera", label: "焦距", important: true, formatter: (v) => `${v}mm` },
      FocalLengthIn35mmFormat: { category: "camera", label: "35mm等效焦距", important: false, formatter: (v) => `${v}mm` },
      Flash: { category: "camera", label: "闪光灯", important: false },
      WhiteBalance: { category: "camera", label: "白平衡", important: false },
      ExposureMode: { category: "camera", label: "曝光模式", important: false },
      MeteringMode: { category: "camera", label: "测光模式", important: false },

      // 图片信息
      ImageWidth: { category: "image", label: "图片宽度", important: true, formatter: (v) => `${v}px` },
      ImageHeight: { category: "image", label: "图片高度", important: true, formatter: (v) => `${v}px` },
      XResolution: { category: "image", label: "水平分辨率", important: false, formatter: (v) => `${v} dpi` },
      YResolution: { category: "image", label: "垂直分辨率", important: false, formatter: (v) => `${v} dpi` },
      Orientation: { category: "image", label: "方向", important: false },
      ColorSpace: { category: "image", label: "色彩空间", important: false },
      BitsPerSample: { category: "image", label: "色彩深度", important: false },
      Compression: { category: "image", label: "压缩方式", important: false },
      PhotometricInterpretation: { category: "image", label: "像素构成", important: false },

      // 位置信息
      latitude: { category: "location", label: "纬度", important: true, formatter: (v) => `${v.toFixed(6)}°` },
      longitude: { category: "location", label: "经度", important: true, formatter: (v) => `${v.toFixed(6)}°` },
      GPSAltitude: { category: "location", label: "海拔", important: false, formatter: (v) => `${v}m` },
      GPSImgDirection: { category: "location", label: "拍摄方向", important: false, formatter: (v) => `${v}°` },
      GPSSpeed: { category: "location", label: "速度", important: false },

      // 日期时间
      DateTimeOriginal: { category: "datetime", label: "拍摄时间", important: true, formatter: (v) => new Date(v).toLocaleString() },
      DateTime: { category: "datetime", label: "修改时间", important: false, formatter: (v) => new Date(v).toLocaleString() },
      CreateDate: { category: "datetime", label: "创建时间", important: false, formatter: (v) => new Date(v).toLocaleString() },
      OffsetTime: { category: "datetime", label: "时区偏移", important: false },
      OffsetTimeOriginal: { category: "datetime", label: "原始时区偏移", important: false },

      // 技术信息
      Software: { category: "technical", label: "软件", important: false },
      Artist: { category: "technical", label: "作者", important: false },
      Copyright: { category: "technical", label: "版权", important: false },
      ImageDescription: { category: "technical", label: "图片描述", important: false },
      UserComment: { category: "technical", label: "用户注释", important: false },
      SceneCaptureType: { category: "technical", label: "场景类型", important: false },
      GainControl: { category: "technical", label: "增益控制", important: false },
      Contrast: { category: "technical", label: "对比度", important: false },
      Saturation: { category: "technical", label: "饱和度", important: false },
      Sharpness: { category: "technical", label: "锐度", important: false },
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
  }, [])

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
        const txtLines = [`EXIF Data for ${selectedImage.file.name}`, "=" * 50, ""]
        filteredFields.forEach(field => {
          txtLines.push(`${field.label}: ${field.formattedValue}`)
        })
        content = txtLines.join('\n')
        filename += ".txt"
        break
    }

    const blob = new Blob([content], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    toast({
      title: "导出完成",
      description: `已导出为 ${filename}`,
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
        <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-200">
          图片 EXIF 数据查看器
        </h1>
        <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
          专业的图片元数据分析工具，支持批量处理和详细的EXIF信息展示
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
                图片上传
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div
                className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${
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
                  <div className="space-y-3">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                    <div className="text-sm">解析EXIF数据...</div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <ImageIcon className="mx-auto h-8 w-8 text-gray-400" />
                    <div>
                      <p className="font-medium text-gray-700 dark:text-gray-300">
                        拖拽图片或点击上传
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        支持 JPEG、PNG、TIFF、WebP 等格式
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {images.length > 0 && (
                <div className="mt-4 flex justify-between">
                  <span className="text-sm text-gray-500">{images.length} 张图片</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearAllImages}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    清空
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
                  图片列表
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="max-h-96 overflow-y-auto">
                  {images.map((image) => (
                    <div
                      key={image.id}
                      className={`flex items-center gap-3 p-3 cursor-pointer transition-colors border-b dark:border-gray-700 last:border-b-0 ${
                        selectedImageId === image.id
                          ? "bg-blue-50 dark:bg-blue-900/20"
                          : "hover:bg-gray-50 dark:hover:bg-gray-800"
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
                          <span className="text-xs text-gray-500">
                            {(image.file.size / 1024).toFixed(1)} KB
                          </span>
                          {image.isProcessing && (
                            <Badge variant="secondary" className="text-xs">
                              处理中
                            </Badge>
                          )}
                          {image.error && (
                            <Badge variant="destructive" className="text-xs">
                              错误
                            </Badge>
                          )}
                          {image.exifData && (
                            <Badge variant="default" className="text-xs">
                              {Object.keys(image.exifData).length} 字段
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
                          <Star className={`h-4 w-4 ${image.isStarred ? 'fill-yellow-400 text-yellow-400' : ''}`} />
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
                      <div className="relative rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800">
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
                            <span className="text-gray-500">文件大小:</span>
                            <span>{(selectedImage.file.size / 1024).toFixed(1)} KB</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">文件类型:</span>
                            <span>{selectedImage.file.type}</span>
                          </div>
                          {selectedImage.exifData && (
                            <>
                              {selectedImage.exifData.ImageWidth && selectedImage.exifData.ImageHeight && (
                                <div className="flex justify-between">
                                  <span className="text-gray-500">图片尺寸:</span>
                                  <span>{selectedImage.exifData.ImageWidth} × {selectedImage.exifData.ImageHeight}</span>
                                </div>
                              )}
                              <div className="flex justify-between">
                                <span className="text-gray-500">EXIF字段:</span>
                                <span>{Object.keys(selectedImage.exifData).length} 个</span>
                              </div>
                            </>
                          )}
                        </div>
                      </div>

                      {/* 快速信息 */}
                      {selectedImage.exifData && (
                        <div className="grid grid-cols-2 gap-2">
                          {selectedImage.exifData.Make && (
                            <div className="text-center p-2 bg-gray-50 dark:bg-gray-800 rounded">
                              <Camera className="h-4 w-4 mx-auto mb-1 text-blue-500" />
                              <div className="text-xs text-gray-500">相机</div>
                              <div className="text-sm font-medium">{selectedImage.exifData.Make}</div>
                            </div>
                          )}
                          {selectedImage.exifData.DateTimeOriginal && (
                            <div className="text-center p-2 bg-gray-50 dark:bg-gray-800 rounded">
                              <Calendar className="h-4 w-4 mx-auto mb-1 text-green-500" />
                              <div className="text-xs text-gray-500">拍摄时间</div>
                              <div className="text-sm font-medium">
                                {new Date(selectedImage.exifData.DateTimeOriginal).toLocaleDateString()}
                              </div>
                            </div>
                          )}
                          {selectedImage.exifData.latitude && selectedImage.exifData.longitude && (
                            <div className="text-center p-2 bg-gray-50 dark:bg-gray-800 rounded">
                              <MapPin className="h-4 w-4 mx-auto mb-1 text-red-500" />
                              <div className="text-xs text-gray-500">位置</div>
                              <Button
                                variant="link"
                                size="sm"
                                className="text-sm font-medium h-auto p-0"
                                onClick={() => openInMaps(selectedImage.exifData!.latitude, selectedImage.exifData!.longitude)}
                              >
                                查看地图
                              </Button>
                            </div>
                          )}
                          {selectedImage.exifData.FNumber && (
                            <div className="text-center p-2 bg-gray-50 dark:bg-gray-800 rounded">
                              <Palette className="h-4 w-4 mx-auto mb-1 text-purple-500" />
                              <div className="text-xs text-gray-500">光圈</div>
                              <div className="text-sm font-medium">f/{selectedImage.exifData.FNumber}</div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* 操作按钮 */}
                      <div className="space-y-2">
                        <div className="flex gap-2">
                          <Select value={exportFormat} onValueChange={(value: "json" | "csv" | "txt") => setExportFormat(value)}>
                            <SelectTrigger className="flex-1">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="json">JSON 格式</SelectItem>
                              <SelectItem value="csv">CSV 格式</SelectItem>
                              <SelectItem value="txt">文本格式</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button onClick={exportData} disabled={!selectedImage.exifData}>
                            <Download className="h-4 w-4 mr-2" />
                            导出
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
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                          placeholder="搜索EXIF字段..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                    </div>
                    
                    <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                      <SelectTrigger className="w-48">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">所有分类</SelectItem>
                        <SelectItem value="camera">相机信息</SelectItem>
                        <SelectItem value="image">图片信息</SelectItem>
                        <SelectItem value="location">位置信息</SelectItem>
                        <SelectItem value="datetime">日期时间</SelectItem>
                        <SelectItem value="technical">技术信息</SelectItem>
                        <SelectItem value="other">其他信息</SelectItem>
                      </SelectContent>
                    </Select>

                    <div className="flex items-center space-x-2">
                      <Switch
                        id="important-only"
                        checked={showImportantOnly}
                        onCheckedChange={setShowImportantOnly}
                      />
                      <Label htmlFor="important-only" className="text-sm">仅显示重要信息</Label>
                    </div>

                    <div className="text-sm text-gray-500">
                      {filteredFields.length} 个字段
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
                              {category.name === "camera" && "相机信息"}
                              {category.name === "image" && "图片信息"}
                              {category.name === "location" && "位置信息"}
                              {category.name === "datetime" && "日期时间"}
                              {category.name === "technical" && "技术信息"}
                              {category.name === "other" && "其他信息"}
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
                              <div key={fieldIndex} className="p-3 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                                <div className="flex items-start justify-between">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                      <div className="font-medium text-sm text-gray-600 dark:text-gray-400">
                                        {field.label}
                                      </div>
                                      {field.important && (
                                        <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
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
                                      <TooltipContent>复制值</TooltipContent>
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
                    <Info className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                    <p className="text-lg font-medium text-gray-600 dark:text-gray-400 mb-2">
                      该图片没有EXIF数据
                    </p>
                    <p className="text-sm text-gray-500">
                      可能是因为图片经过了处理或者原本就不包含元数据信息
                    </p>
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <Card>
              <CardContent className="py-16 text-center">
                <ImageIcon className="h-16 w-16 mx-auto mb-4 text-gray-400" />
                <p className="text-xl font-medium text-gray-600 dark:text-gray-400 mb-2">
                  选择图片查看EXIF数据
                </p>
                <p className="text-gray-500">
                  上传图片文件开始分析元数据信息
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}