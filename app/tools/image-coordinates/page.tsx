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

interface ImageCoordinatesProps {
  params?: Record<string, string>
}

type CoordinateFormat = "pixel" | "percent" | "permille" | "permyriad"

interface Coordinate {
  x: number
  y: number
  pixelX: number
  pixelY: number
}

interface SavedPoint {
  id: number
  coord: Coordinate
  color: string
}

export default function ImageCoordinatesPage({}: ImageCoordinatesProps) {
  // 图片状态
  const [imageUrl, setImageUrl] = useState<string>("")
  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null)
  const [fileName, setFileName] = useState<string>("")
  
  // 坐标状态
  const [currentCoord, setCurrentCoord] = useState<Coordinate | null>(null)
  const [savedPoints, setSavedPoints] = useState<SavedPoint[]>([])
  const [coordinateFormat, setCoordinateFormat] = useState<CoordinateFormat>("percent")
  
  // UI 状态
  const [isDragging, setIsDragging] = useState(false)
  const [zoom, setZoom] = useState(100)
  const [showCrosshair, setShowCrosshair] = useState(true)
  const [showGrid, setShowGrid] = useState(false)
  const [copied, setCopied] = useState(false)
  
  // 手动输入坐标
  const [manualX, setManualX] = useState("")
  const [manualY, setManualY] = useState("")
  const [manualFormat, setManualFormat] = useState<CoordinateFormat>("percent")
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // 格式化坐标
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

  // 获取格式标签
  const getFormatLabel = (format: CoordinateFormat): string => {
    switch (format) {
      case "pixel": return "像素"
      case "percent": return "百分比 (%)"
      case "permille": return "千分比 (‰)"
      case "permyriad": return "万分比 (‱)"
      default: return "百分比"
    }
  }

  // 处理文件上传
  const handleFileUpload = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) return
    
    setFileName(file.name)
    setSavedPoints([])
    setCurrentCoord(null)
    
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        setImageSize({ width: img.width, height: img.height })
        setImageUrl(e.target?.result as string)
      }
      img.src = e.target?.result as string
    }
    reader.readAsDataURL(file)
  }, [])

  // 拖放处理
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFileUpload(file)
  }, [handleFileUpload])

  // 清除图片
  const clearImage = useCallback(() => {
    setImageUrl("")
    setImageSize(null)
    setFileName("")
    setSavedPoints([])
    setCurrentCoord(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }, [])

  // 处理鼠标移动
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLImageElement>) => {
    if (!imageRef.current || !imageSize) return
    
    const rect = imageRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    
    // 计算相对于显示尺寸的百分比
    const percentX = (x / rect.width) * 100
    const percentY = (y / rect.height) * 100
    
    // 计算实际像素坐标
    const pixelX = Math.round((x / rect.width) * imageSize.width)
    const pixelY = Math.round((y / rect.height) * imageSize.height)
    
    setCurrentCoord({
      x: percentX,
      y: percentY,
      pixelX: Math.max(0, Math.min(pixelX, imageSize.width - 1)),
      pixelY: Math.max(0, Math.min(pixelY, imageSize.height - 1))
    })
  }, [imageSize])

  // 处理鼠标离开
  const handleMouseLeave = useCallback(() => {
    setCurrentCoord(null)
  }, [])

  // 保存当前坐标点
  const saveCurrentPoint = useCallback(() => {
    if (!currentCoord) return
    
    const colors = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899"]
    const newPoint: SavedPoint = {
      id: Date.now(),
      coord: { ...currentCoord },
      color: colors[savedPoints.length % colors.length]
    }
    setSavedPoints(prev => [...prev, newPoint])
  }, [currentCoord, savedPoints.length])

  // 删除保存的点
  const removePoint = useCallback((id: number) => {
    setSavedPoints(prev => prev.filter(p => p.id !== id))
  }, [])

  // 复制坐标
  const copyCoordinate = useCallback(async (coord: Coordinate) => {
    const text = formatCoordinate(coord, coordinateFormat)
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }, [coordinateFormat, formatCoordinate])

  // 复制所有保存的点
  const copyAllPoints = useCallback(async () => {
    if (savedPoints.length === 0) return
    const text = savedPoints
      .map((p, i) => `点${i + 1}: ${formatCoordinate(p.coord, coordinateFormat)}`)
      .join("\n")
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }, [savedPoints, coordinateFormat, formatCoordinate])

  // 处理点击保存
  const handleImageClick = useCallback(() => {
    saveCurrentPoint()
  }, [saveCurrentPoint])

  // 手动添加坐标点
  const addManualPoint = useCallback(() => {
    if (!imageSize) return
    
    const x = parseFloat(manualX)
    const y = parseFloat(manualY)
    
    if (isNaN(x) || isNaN(y)) return
    
    let percentX: number
    let percentY: number
    let pixelX: number
    let pixelY: number
    
    switch (manualFormat) {
      case "pixel":
        pixelX = Math.max(0, Math.min(x, imageSize.width - 1))
        pixelY = Math.max(0, Math.min(y, imageSize.height - 1))
        percentX = (pixelX / imageSize.width) * 100
        percentY = (pixelY / imageSize.height) * 100
        break
      case "percent":
        percentX = Math.max(0, Math.min(x, 100))
        percentY = Math.max(0, Math.min(y, 100))
        pixelX = Math.round((percentX / 100) * imageSize.width)
        pixelY = Math.round((percentY / 100) * imageSize.height)
        break
      case "permille":
        percentX = Math.max(0, Math.min(x / 10, 100))
        percentY = Math.max(0, Math.min(y / 10, 100))
        pixelX = Math.round((percentX / 100) * imageSize.width)
        pixelY = Math.round((percentY / 100) * imageSize.height)
        break
      case "permyriad":
        percentX = Math.max(0, Math.min(x / 100, 100))
        percentY = Math.max(0, Math.min(y / 100, 100))
        pixelX = Math.round((percentX / 100) * imageSize.width)
        pixelY = Math.round((percentY / 100) * imageSize.height)
        break
      default:
        return
    }
    
    const colors = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899"]
    const newPoint: SavedPoint = {
      id: Date.now(),
      coord: { x: percentX, y: percentY, pixelX, pixelY },
      color: colors[savedPoints.length % colors.length]
    }
    setSavedPoints(prev => [...prev, newPoint])
    setManualX("")
    setManualY("")
  }, [manualX, manualY, manualFormat, imageSize, savedPoints.length])

  return (
    <div className="container mx-auto px-4 py-4 max-w-7xl">
      {/* 页面标题 */}
      <div className="text-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-200 mb-2 flex items-center justify-center gap-2">
          <Crosshair className="h-8 w-8 text-blue-600" />
          图片坐标拾取
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          上传图片，获取鼠标位置的精确坐标
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* 左侧控制面板 */}
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
                onClick={() => {
                  if (fileInputRef.current) {
                    fileInputRef.current.value = ""
                  }
                  fileInputRef.current?.click()
                }}
                onDrop={handleDrop}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
                onDragLeave={() => setIsDragging(false)}
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
              
              {imageSize && (
                <div className="mt-3 space-y-2">
                  <p className="text-sm truncate" title={fileName}>{fileName}</p>
                  <p className="text-xs text-gray-500">
                    {imageSize.width} × {imageSize.height} 像素
                  </p>
                  <Button variant="outline" size="sm" onClick={clearImage} className="w-full">
                    <Trash2 className="h-4 w-4 mr-1" />
                    清除
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>


          {/* 坐标格式 */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Ruler className="h-4 w-4 text-blue-600" />
                坐标格式
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Select value={coordinateFormat} onValueChange={(v) => setCoordinateFormat(v as CoordinateFormat)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pixel">像素 (px)</SelectItem>
                  <SelectItem value="percent">百分比 (%)</SelectItem>
                  <SelectItem value="permille">千分比 (‰)</SelectItem>
                  <SelectItem value="permyriad">万分比 (‱)</SelectItem>
                </SelectContent>
              </Select>
              
              <div className="text-xs text-gray-500 space-y-1">
                <p>• 像素: 实际图片像素位置</p>
                <p>• 百分比: 0-100%</p>
                <p>• 千分比: 0-1000‰</p>
                <p>• 万分比: 0-10000‱</p>
              </div>
            </CardContent>
          </Card>

          {/* 显示设置 */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Grid3X3 className="h-4 w-4 text-blue-600" />
                显示设置
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="show-crosshair">显示十字线</Label>
                <Switch
                  id="show-crosshair"
                  checked={showCrosshair}
                  onCheckedChange={setShowCrosshair}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="show-grid">显示网格</Label>
                <Switch
                  id="show-grid"
                  checked={showGrid}
                  onCheckedChange={setShowGrid}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm">缩放: {zoom}%</Label>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setZoom(Math.max(25, zoom - 25))}
                  >
                    <ZoomOut className="h-4 w-4" />
                  </Button>
                  <div className="flex-1 text-center text-sm">{zoom}%</div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setZoom(Math.min(200, zoom + 25))}
                  >
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 手动输入坐标 */}
          {imageSize && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Plus className="h-4 w-4 text-blue-600" />
                  手动添加坐标
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Select value={manualFormat} onValueChange={(v) => setManualFormat(v as CoordinateFormat)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pixel">像素 (px)</SelectItem>
                    <SelectItem value="percent">百分比 (%)</SelectItem>
                    <SelectItem value="permille">千分比 (‰)</SelectItem>
                    <SelectItem value="permyriad">万分比 (‱)</SelectItem>
                  </SelectContent>
                </Select>
                
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">X</Label>
                    <Input
                      type="number"
                      placeholder="X"
                      value={manualX}
                      onChange={(e) => setManualX(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addManualPoint()}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Y</Label>
                    <Input
                      type="number"
                      placeholder="Y"
                      value={manualY}
                      onChange={(e) => setManualY(e.target.value)}
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
                  添加标记点
                </Button>
                
                <div className="text-xs text-gray-500">
                  {manualFormat === "pixel" && <p>范围: 0-{imageSize.width}, 0-{imageSize.height}</p>}
                  {manualFormat === "percent" && <p>范围: 0-100</p>}
                  {manualFormat === "permille" && <p>范围: 0-1000</p>}
                  {manualFormat === "permyriad" && <p>范围: 0-10000</p>}
                </div>
              </CardContent>
            </Card>
          )}

          {/* 当前坐标 */}
          {currentCoord && (
            <Card className="border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <MousePointer2 className="h-4 w-4 text-blue-600" />
                  当前位置
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-2xl font-mono font-bold text-blue-700 dark:text-blue-400">
                  {formatCoordinate(currentCoord, coordinateFormat)}
                </div>
                <div className="text-xs text-gray-500 space-y-1">
                  <p>像素: ({currentCoord.pixelX}, {currentCoord.pixelY})</p>
                  <p>百分比: ({currentCoord.x.toFixed(2)}%, {currentCoord.y.toFixed(2)}%)</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => copyCoordinate(currentCoord)}
                    className="flex-1"
                  >
                    {copied ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
                    复制
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={saveCurrentPoint}
                    className="flex-1"
                  >
                    <MapPin className="h-4 w-4 mr-1" />
                    保存
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* 右侧预览区域 */}
        <div className="lg:col-span-3 space-y-4">
          {/* 图片预览 */}
          <Card className="min-h-[500px]">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <ImageIcon className="h-4 w-4 text-blue-600" />
                  图片预览
                </span>
                {imageSize && (
                  <Badge variant="outline">
                    点击图片保存坐标点
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!imageUrl ? (
                <div className="flex flex-col items-center justify-center h-[400px] text-gray-400">
                  <ImageIcon className="h-16 w-16 mb-4" />
                  <p>请上传图片</p>
                </div>
              ) : (
                <div 
                  ref={containerRef}
                  className="relative overflow-auto max-h-[600px] scrollbar-m3"
                >
                  <div 
                    className="relative inline-block"
                    style={{ transform: `scale(${zoom / 100})`, transformOrigin: "top left" }}
                  >
                    {/* 网格覆盖层 */}
                    {showGrid && (
                      <div 
                        className="absolute inset-0 pointer-events-none"
                        style={{
                          backgroundImage: `
                            linear-gradient(rgba(0,0,0,0.1) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(0,0,0,0.1) 1px, transparent 1px)
                          `,
                          backgroundSize: "10% 10%"
                        }}
                      />
                    )}
                    
                    {/* 图片 */}
                    <img
                      ref={imageRef}
                      src={imageUrl}
                      alt="Preview"
                      className="max-w-none cursor-crosshair"
                      onMouseMove={handleMouseMove}
                      onMouseLeave={handleMouseLeave}
                      onClick={handleImageClick}
                      draggable={false}
                    />
                    
                    {/* 十字线 */}
                    {showCrosshair && currentCoord && imageRef.current && (
                      <>
                        <div
                          className="absolute pointer-events-none bg-red-500"
                          style={{
                            left: `${currentCoord.x}%`,
                            top: 0,
                            width: "1px",
                            height: "100%",
                            opacity: 0.7
                          }}
                        />
                        <div
                          className="absolute pointer-events-none bg-red-500"
                          style={{
                            left: 0,
                            top: `${currentCoord.y}%`,
                            width: "100%",
                            height: "1px",
                            opacity: 0.7
                          }}
                        />
                      </>
                    )}
                    
                    {/* 保存的点 */}
                    {savedPoints.map((point) => (
                      <div
                        key={point.id}
                        className="absolute pointer-events-none"
                        style={{
                          left: `${point.coord.x}%`,
                          top: `${point.coord.y}%`,
                          transform: "translate(-50%, -50%)"
                        }}
                      >
                        <div
                          className="w-4 h-4 rounded-full border-2 border-white shadow-lg"
                          style={{ backgroundColor: point.color }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 保存的坐标点 */}
          {savedPoints.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-blue-600" />
                    保存的坐标点 ({savedPoints.length})
                  </span>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={copyAllPoints}>
                      <Copy className="h-4 w-4 mr-1" />
                      复制全部
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setSavedPoints([])}>
                      <Trash2 className="h-4 w-4 mr-1" />
                      清空
                    </Button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {savedPoints.map((point, index) => (
                    <div
                      key={point.id}
                      className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
                    >
                      <div
                        className="w-4 h-4 rounded-full flex-shrink-0"
                        style={{ backgroundColor: point.color }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">点 {index + 1}</p>
                        <p className="text-xs text-gray-500 font-mono truncate">
                          {formatCoordinate(point.coord, coordinateFormat)}
                        </p>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => copyCoordinate(point.coord)}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => removePoint(point.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
