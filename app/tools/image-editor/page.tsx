"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { useTranslations } from "@/hooks/use-translations"
import {
  Upload,
  Download,
  RotateCw,
  RotateCcw,
  FlipHorizontal,
  FlipVertical,
  Crop,
  Move,
  ZoomIn,
  ZoomOut,
  Undo,
  Redo,
  Trash2,
  Image as ImageIcon,
  Settings,
  ChevronUp,
  ChevronDown,
  Maximize2,
  Square,
  RectangleHorizontal,
  Circle,
  Check,
  X,
  RefreshCw,
} from "lucide-react"

interface ImageEditorProps {
  params?: Record<string, string>
}

interface ImageState {
  rotation: number
  flipH: boolean
  flipV: boolean
  cropX: number
  cropY: number
  cropWidth: number
  cropHeight: number
  brightness: number
  contrast: number
  saturation: number
  blur: number
  grayscale: boolean
  sepia: boolean
  invert: boolean
}

interface HistoryItem {
  state: ImageState
  label: string
}

const defaultState: ImageState = {
  rotation: 0,
  flipH: false,
  flipV: false,
  cropX: 0,
  cropY: 0,
  cropWidth: 100,
  cropHeight: 100,
  brightness: 100,
  contrast: 100,
  saturation: 100,
  blur: 0,
  grayscale: false,
  sepia: false,
  invert: false,
}

// 预设裁剪比例
const cropPresets = [
  { label: "自由", value: "free", icon: Move },
  { label: "1:1", value: "1:1", icon: Square },
  { label: "4:3", value: "4:3", icon: RectangleHorizontal },
  { label: "16:9", value: "16:9", icon: RectangleHorizontal },
  { label: "3:2", value: "3:2", icon: RectangleHorizontal },
  { label: "2:3", value: "2:3", icon: RectangleHorizontal },
  { label: "9:16", value: "9:16", icon: RectangleHorizontal },
]

export default function ImageEditorPage({ params }: ImageEditorProps) {
  const t = useTranslations()
  
  // 图片状态
  const [originalImage, setOriginalImage] = useState<HTMLImageElement | null>(null)
  const [imageUrl, setImageUrl] = useState<string>("")
  const [fileName, setFileName] = useState<string>("")
  const [imageState, setImageState] = useState<ImageState>(defaultState)
  
  // 历史记录
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  
  // UI 状态
  const [activeTab, setActiveTab] = useState("transform")
  const [showSettings, setShowSettings] = useState(false)
  const [cropMode, setCropMode] = useState(false)
  const [cropPreset, setCropPreset] = useState("free")
  const [outputFormat, setOutputFormat] = useState("png")
  const [outputQuality, setOutputQuality] = useState(92)
  const [isDragging, setIsDragging] = useState(false)
  const [zoom, setZoom] = useState(100)
  
  // 裁剪框状态
  const [cropBox, setCropBox] = useState({ x: 0, y: 0, width: 100, height: 100 })
  const [isCropping, setIsCropping] = useState(false)
  const [cropStart, setCropStart] = useState({ x: 0, y: 0 })
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const previewRef = useRef<HTMLDivElement>(null)


  // 添加历史记录
  const addToHistory = useCallback((newState: ImageState, label: string) => {
    setHistory(prev => {
      const newHistory = prev.slice(0, historyIndex + 1)
      newHistory.push({ state: newState, label })
      return newHistory.slice(-50) // 最多保留50条
    })
    setHistoryIndex(prev => Math.min(prev + 1, 49))
  }, [historyIndex])

  // 撤销
  const undo = useCallback(() => {
    if (historyIndex > 0) {
      setHistoryIndex(prev => prev - 1)
      setImageState(history[historyIndex - 1].state)
    }
  }, [history, historyIndex])

  // 重做
  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(prev => prev + 1)
      setImageState(history[historyIndex + 1].state)
    }
  }, [history, historyIndex])

  // 处理文件上传
  const handleFileUpload = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) return
    
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      setOriginalImage(img)
      setImageUrl(url)
      setFileName(file.name)
      setImageState(defaultState)
      setCropBox({ x: 0, y: 0, width: img.width, height: img.height })
      setHistory([{ state: defaultState, label: "原始图片" }])
      setHistoryIndex(0)
      setZoom(100)
    }
    img.src = url
  }, [])

  // 拖放处理
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFileUpload(file)
  }, [handleFileUpload])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback(() => {
    setIsDragging(false)
  }, [])

  // 旋转
  const rotate = useCallback((degrees: number) => {
    const newState = {
      ...imageState,
      rotation: (imageState.rotation + degrees + 360) % 360
    }
    setImageState(newState)
    addToHistory(newState, `旋转 ${degrees > 0 ? '+' : ''}${degrees}°`)
  }, [imageState, addToHistory])

  // 水平镜像
  const flipHorizontal = useCallback(() => {
    const newState = { ...imageState, flipH: !imageState.flipH }
    setImageState(newState)
    addToHistory(newState, imageState.flipH ? "取消水平镜像" : "水平镜像")
  }, [imageState, addToHistory])

  // 垂直镜像
  const flipVertical = useCallback(() => {
    const newState = { ...imageState, flipV: !imageState.flipV }
    setImageState(newState)
    addToHistory(newState, imageState.flipV ? "取消垂直镜像" : "垂直镜像")
  }, [imageState, addToHistory])

  // 重置所有变换
  const resetTransform = useCallback(() => {
    const newState = {
      ...imageState,
      rotation: 0,
      flipH: false,
      flipV: false,
    }
    setImageState(newState)
    addToHistory(newState, "重置变换")
  }, [imageState, addToHistory])

  // 重置滤镜
  const resetFilters = useCallback(() => {
    const newState = {
      ...imageState,
      brightness: 100,
      contrast: 100,
      saturation: 100,
      blur: 0,
      grayscale: false,
      sepia: false,
      invert: false,
    }
    setImageState(newState)
    addToHistory(newState, "重置滤镜")
  }, [imageState, addToHistory])

  // 重置全部
  const resetAll = useCallback(() => {
    if (!originalImage) return
    setImageState(defaultState)
    setCropBox({ x: 0, y: 0, width: originalImage.width, height: originalImage.height })
    addToHistory(defaultState, "重置全部")
  }, [originalImage, addToHistory])

  // 更新滤镜
  const updateFilter = useCallback((key: keyof ImageState, value: number | boolean) => {
    const newState = { ...imageState, [key]: value }
    setImageState(newState)
  }, [imageState])

  // 滤镜变化完成时添加历史
  const commitFilter = useCallback((key: string, value: number | boolean) => {
    addToHistory(imageState, `调整${key}`)
  }, [imageState, addToHistory])


  // 应用裁剪比例
  const applyCropPreset = useCallback((preset: string) => {
    if (!originalImage) return
    setCropPreset(preset)
    
    if (preset === "free") return
    
    const [w, h] = preset.split(":").map(Number)
    const ratio = w / h
    const imgRatio = originalImage.width / originalImage.height
    
    let newWidth, newHeight
    if (ratio > imgRatio) {
      newWidth = originalImage.width
      newHeight = originalImage.width / ratio
    } else {
      newHeight = originalImage.height
      newWidth = originalImage.height * ratio
    }
    
    setCropBox({
      x: (originalImage.width - newWidth) / 2,
      y: (originalImage.height - newHeight) / 2,
      width: newWidth,
      height: newHeight,
    })
  }, [originalImage])

  // 确认裁剪
  const applyCrop = useCallback(() => {
    if (!originalImage) return
    
    const newState = {
      ...imageState,
      cropX: cropBox.x,
      cropY: cropBox.y,
      cropWidth: cropBox.width,
      cropHeight: cropBox.height,
    }
    setImageState(newState)
    addToHistory(newState, "裁剪图片")
    setCropMode(false)
  }, [originalImage, imageState, cropBox, addToHistory])

  // 取消裁剪
  const cancelCrop = useCallback(() => {
    if (!originalImage) return
    setCropBox({ x: 0, y: 0, width: originalImage.width, height: originalImage.height })
    setCropMode(false)
  }, [originalImage])

  // 生成 CSS 滤镜字符串
  const getFilterString = useCallback(() => {
    const filters = []
    if (imageState.brightness !== 100) filters.push(`brightness(${imageState.brightness}%)`)
    if (imageState.contrast !== 100) filters.push(`contrast(${imageState.contrast}%)`)
    if (imageState.saturation !== 100) filters.push(`saturate(${imageState.saturation}%)`)
    if (imageState.blur > 0) filters.push(`blur(${imageState.blur}px)`)
    if (imageState.grayscale) filters.push("grayscale(100%)")
    if (imageState.sepia) filters.push("sepia(100%)")
    if (imageState.invert) filters.push("invert(100%)")
    return filters.length > 0 ? filters.join(" ") : "none"
  }, [imageState])

  // 生成变换字符串
  const getTransformString = useCallback(() => {
    const transforms = []
    transforms.push(`scale(${zoom / 100})`)
    if (imageState.rotation !== 0) transforms.push(`rotate(${imageState.rotation}deg)`)
    if (imageState.flipH) transforms.push("scaleX(-1)")
    if (imageState.flipV) transforms.push("scaleY(-1)")
    return transforms.join(" ")
  }, [imageState, zoom])

  // 导出图片
  const exportImage = useCallback(() => {
    if (!originalImage || !canvasRef.current) return
    
    const canvas = canvasRef.current
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // 计算最终尺寸
    const isRotated90 = imageState.rotation === 90 || imageState.rotation === 270
    let finalWidth = isRotated90 ? originalImage.height : originalImage.width
    let finalHeight = isRotated90 ? originalImage.width : originalImage.height

    // 如果有裁剪
    if (imageState.cropWidth !== 100 || imageState.cropHeight !== 100) {
      finalWidth = imageState.cropWidth
      finalHeight = imageState.cropHeight
    }

    canvas.width = finalWidth
    canvas.height = finalHeight

    ctx.save()
    
    // 应用滤镜
    ctx.filter = getFilterString()
    
    // 移动到中心
    ctx.translate(finalWidth / 2, finalHeight / 2)
    
    // 旋转
    ctx.rotate((imageState.rotation * Math.PI) / 180)
    
    // 镜像
    ctx.scale(imageState.flipH ? -1 : 1, imageState.flipV ? -1 : 1)
    
    // 绘制图片
    const drawWidth = isRotated90 ? finalHeight : finalWidth
    const drawHeight = isRotated90 ? finalWidth : finalHeight
    
    if (imageState.cropWidth !== 100 || imageState.cropHeight !== 100) {
      ctx.drawImage(
        originalImage,
        imageState.cropX, imageState.cropY,
        imageState.cropWidth, imageState.cropHeight,
        -drawWidth / 2, -drawHeight / 2,
        drawWidth, drawHeight
      )
    } else {
      ctx.drawImage(originalImage, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight)
    }
    
    ctx.restore()

    // 导出
    const mimeType = outputFormat === "jpg" ? "image/jpeg" : 
                     outputFormat === "webp" ? "image/webp" : "image/png"
    const quality = outputFormat === "png" ? undefined : outputQuality / 100
    
    canvas.toBlob((blob) => {
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      const baseName = fileName.replace(/\.[^/.]+$/, "")
      a.href = url
      a.download = `${baseName}_edited.${outputFormat}`
      a.click()
      URL.revokeObjectURL(url)
    }, mimeType, quality)
  }, [originalImage, imageState, outputFormat, outputQuality, fileName, getFilterString])


  return (
    <div className="container mx-auto px-4 py-4 max-w-7xl">
      {/* 页面标题 */}
      <div className="text-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-200 mb-2 flex items-center justify-center gap-2">
          <ImageIcon className="h-8 w-8 text-purple-600" />
          图片编辑器
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          裁剪、旋转、镜像、滤镜调整
        </p>
      </div>

      {/* 隐藏的 canvas 用于导出 */}
      <canvas ref={canvasRef} className="hidden" />

      {/* 设置折叠区域 */}
      <div className="mb-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowSettings(!showSettings)}
          className="w-full text-sm text-gray-600 dark:text-gray-400"
        >
          <div className="flex items-center gap-2">
            {showSettings ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            <Settings className="h-4 w-4" />
            <span>导出设置</span>
          </div>
        </Button>

        {showSettings && (
          <Card className="mt-3">
            <CardContent className="py-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>输出格式</Label>
                  <Select value={outputFormat} onValueChange={setOutputFormat}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="png">PNG (无损)</SelectItem>
                      <SelectItem value="jpg">JPG (有损)</SelectItem>
                      <SelectItem value="webp">WebP (推荐)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {outputFormat !== "png" && (
                  <div className="space-y-2">
                    <Label>输出质量: {outputQuality}%</Label>
                    <Slider
                      value={[outputQuality]}
                      onValueChange={([v]) => setOutputQuality(v)}
                      min={10}
                      max={100}
                      step={1}
                    />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* 左侧工具栏 */}
        <div className="lg:col-span-1 space-y-4">
          {/* 文件上传 */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Upload className="h-4 w-4 text-blue-600" />
                上传图片
              </CardTitle>
            </CardHeader>
            <CardContent>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
                className="hidden"
              />
              <div
                onClick={() => fileInputRef.current?.click()}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
                  isDragging
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                    : "border-gray-300 dark:border-gray-700 hover:border-blue-400"
                }`}
              >
                <Upload className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  点击或拖放图片
                </p>
              </div>
              {fileName && (
                <p className="mt-2 text-xs text-gray-500 truncate">{fileName}</p>
              )}
            </CardContent>
          </Card>

          {/* 工具选项卡 */}
          {originalImage && (
            <Card>
              <CardContent className="pt-4">
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList className="grid grid-cols-2 mb-4">
                    <TabsTrigger value="transform">变换</TabsTrigger>
                    <TabsTrigger value="filters">滤镜</TabsTrigger>
                  </TabsList>

                  <TabsContent value="transform" className="space-y-4">
                    {/* 旋转 */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">旋转</Label>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => rotate(-90)}
                          className="flex-1"
                        >
                          <RotateCcw className="h-4 w-4 mr-1" />
                          -90°
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => rotate(90)}
                          className="flex-1"
                        >
                          <RotateCw className="h-4 w-4 mr-1" />
                          +90°
                        </Button>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => rotate(-45)}
                          className="flex-1"
                        >
                          -45°
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => rotate(45)}
                          className="flex-1"
                        >
                          +45°
                        </Button>
                      </div>
                      <Badge variant="secondary" className="w-full justify-center">
                        当前: {imageState.rotation}°
                      </Badge>
                    </div>

                    {/* 镜像 */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">镜像翻转</Label>
                      <div className="flex gap-2">
                        <Button
                          variant={imageState.flipH ? "default" : "outline"}
                          size="sm"
                          onClick={flipHorizontal}
                          className="flex-1"
                        >
                          <FlipHorizontal className="h-4 w-4 mr-1" />
                          水平
                        </Button>
                        <Button
                          variant={imageState.flipV ? "default" : "outline"}
                          size="sm"
                          onClick={flipVertical}
                          className="flex-1"
                        >
                          <FlipVertical className="h-4 w-4 mr-1" />
                          垂直
                        </Button>
                      </div>
                    </div>

                    {/* 裁剪 */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">裁剪</Label>
                      {!cropMode ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCropMode(true)}
                          className="w-full"
                        >
                          <Crop className="h-4 w-4 mr-1" />
                          开始裁剪
                        </Button>
                      ) : (
                        <div className="space-y-2">
                          <Select value={cropPreset} onValueChange={applyCropPreset}>
                            <SelectTrigger>
                              <SelectValue placeholder="选择比例" />
                            </SelectTrigger>
                            <SelectContent>
                              {cropPresets.map((preset) => (
                                <SelectItem key={preset.value} value={preset.value}>
                                  {preset.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <div className="flex gap-2">
                            <Button
                              variant="default"
                              size="sm"
                              onClick={applyCrop}
                              className="flex-1"
                            >
                              <Check className="h-4 w-4 mr-1" />
                              确认
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={cancelCrop}
                              className="flex-1"
                            >
                              <X className="h-4 w-4 mr-1" />
                              取消
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={resetTransform}
                      className="w-full text-orange-600"
                    >
                      <RefreshCw className="h-4 w-4 mr-1" />
                      重置变换
                    </Button>
                  </TabsContent>

                  <TabsContent value="filters" className="space-y-4">
                    {/* 亮度 */}
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <Label className="text-sm">亮度</Label>
                        <span className="text-xs text-gray-500">{imageState.brightness}%</span>
                      </div>
                      <Slider
                        value={[imageState.brightness]}
                        onValueChange={([v]) => updateFilter("brightness", v)}
                        onValueCommit={() => commitFilter("亮度", imageState.brightness)}
                        min={0}
                        max={200}
                        step={1}
                      />
                    </div>

                    {/* 对比度 */}
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <Label className="text-sm">对比度</Label>
                        <span className="text-xs text-gray-500">{imageState.contrast}%</span>
                      </div>
                      <Slider
                        value={[imageState.contrast]}
                        onValueChange={([v]) => updateFilter("contrast", v)}
                        onValueCommit={() => commitFilter("对比度", imageState.contrast)}
                        min={0}
                        max={200}
                        step={1}
                      />
                    </div>

                    {/* 饱和度 */}
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <Label className="text-sm">饱和度</Label>
                        <span className="text-xs text-gray-500">{imageState.saturation}%</span>
                      </div>
                      <Slider
                        value={[imageState.saturation]}
                        onValueChange={([v]) => updateFilter("saturation", v)}
                        onValueCommit={() => commitFilter("饱和度", imageState.saturation)}
                        min={0}
                        max={200}
                        step={1}
                      />
                    </div>

                    {/* 模糊 */}
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <Label className="text-sm">模糊</Label>
                        <span className="text-xs text-gray-500">{imageState.blur}px</span>
                      </div>
                      <Slider
                        value={[imageState.blur]}
                        onValueChange={([v]) => updateFilter("blur", v)}
                        onValueCommit={() => commitFilter("模糊", imageState.blur)}
                        min={0}
                        max={20}
                        step={0.5}
                      />
                    </div>

                    {/* 特效开关 */}
                    <div className="space-y-3 pt-2 border-t">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm">灰度</Label>
                        <Switch
                          checked={imageState.grayscale}
                          onCheckedChange={(v) => {
                            updateFilter("grayscale", v)
                            commitFilter("灰度", v)
                          }}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label className="text-sm">复古</Label>
                        <Switch
                          checked={imageState.sepia}
                          onCheckedChange={(v) => {
                            updateFilter("sepia", v)
                            commitFilter("复古", v)
                          }}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label className="text-sm">反色</Label>
                        <Switch
                          checked={imageState.invert}
                          onCheckedChange={(v) => {
                            updateFilter("invert", v)
                            commitFilter("反色", v)
                          }}
                        />
                      </div>
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={resetFilters}
                      className="w-full text-orange-600"
                    >
                      <RefreshCw className="h-4 w-4 mr-1" />
                      重置滤镜
                    </Button>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          )}
        </div>


        {/* 右侧预览区域 */}
        <div className="lg:col-span-3 space-y-4">
          {/* 工具栏 */}
          {originalImage && (
            <Card>
              <CardContent className="py-3">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  {/* 撤销/重做 */}
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={undo}
                      disabled={historyIndex <= 0}
                    >
                      <Undo className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={redo}
                      disabled={historyIndex >= history.length - 1}
                    >
                      <Redo className="h-4 w-4" />
                    </Button>
                    <span className="text-xs text-gray-500">
                      {historyIndex + 1}/{history.length}
                    </span>
                  </div>

                  {/* 缩放 */}
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setZoom(Math.max(10, zoom - 10))}
                    >
                      <ZoomOut className="h-4 w-4" />
                    </Button>
                    <span className="text-sm w-16 text-center">{zoom}%</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setZoom(Math.min(200, zoom + 10))}
                    >
                      <ZoomIn className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setZoom(100)}
                    >
                      重置
                    </Button>
                  </div>

                  {/* 操作按钮 */}
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={resetAll}
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      重置全部
                    </Button>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={exportImage}
                    >
                      <Download className="h-4 w-4 mr-1" />
                      导出图片
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 图片预览 */}
          <Card className="min-h-[500px]">
            <CardContent className="p-4">
              {!originalImage ? (
                <div className="flex flex-col items-center justify-center h-[500px] text-gray-400">
                  <ImageIcon className="h-16 w-16 mb-4" />
                  <p>请上传图片开始编辑</p>
                </div>
              ) : (
                <div
                  ref={previewRef}
                  className="relative overflow-auto bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHJlY3Qgd2lkdGg9IjEwIiBoZWlnaHQ9IjEwIiBmaWxsPSIjZjBmMGYwIi8+PHJlY3QgeD0iMTAiIHk9IjEwIiB3aWR0aD0iMTAiIGhlaWdodD0iMTAiIGZpbGw9IiNmMGYwZjAiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiLz48L3N2Zz4=')] rounded-lg"
                  style={{ maxHeight: "600px" }}
                >
                  <div className="flex items-center justify-center min-h-[400px] p-4">
                    <div className="relative">
                      <img
                        src={imageUrl}
                        alt="Preview"
                        className="max-w-full transition-all duration-200"
                        style={{
                          transform: getTransformString(),
                          filter: getFilterString(),
                        }}
                      />
                      
                      {/* 裁剪遮罩 */}
                      {cropMode && (
                        <div className="absolute inset-0 bg-black/50 pointer-events-none">
                          <div
                            className="absolute border-2 border-white border-dashed bg-transparent"
                            style={{
                              left: `${(cropBox.x / originalImage.width) * 100}%`,
                              top: `${(cropBox.y / originalImage.height) * 100}%`,
                              width: `${(cropBox.width / originalImage.width) * 100}%`,
                              height: `${(cropBox.height / originalImage.height) * 100}%`,
                              boxShadow: "0 0 0 9999px rgba(0,0,0,0.5)",
                            }}
                          >
                            {/* 裁剪框角标 */}
                            <div className="absolute -top-1 -left-1 w-3 h-3 bg-white border border-gray-400" />
                            <div className="absolute -top-1 -right-1 w-3 h-3 bg-white border border-gray-400" />
                            <div className="absolute -bottom-1 -left-1 w-3 h-3 bg-white border border-gray-400" />
                            <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-white border border-gray-400" />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 图片信息 */}
          {originalImage && (
            <Card>
              <CardContent className="py-3">
                <div className="flex flex-wrap gap-4 text-sm text-gray-600 dark:text-gray-400">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">原始尺寸</Badge>
                    <span>{originalImage.width} × {originalImage.height}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">旋转</Badge>
                    <span>{imageState.rotation}°</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">镜像</Badge>
                    <span>
                      {imageState.flipH && imageState.flipV
                        ? "水平+垂直"
                        : imageState.flipH
                        ? "水平"
                        : imageState.flipV
                        ? "垂直"
                        : "无"}
                    </span>
                  </div>
                  {(imageState.grayscale || imageState.sepia || imageState.invert) && (
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">特效</Badge>
                      <span>
                        {[
                          imageState.grayscale && "灰度",
                          imageState.sepia && "复古",
                          imageState.invert && "反色",
                        ]
                          .filter(Boolean)
                          .join(", ")}
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
