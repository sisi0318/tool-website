"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Slider } from "@/components/ui/slider"
import { Progress } from "@/components/ui/progress"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import {
  Upload,
  Download,
  Trash2,
  Grid3X3,
  Scissors,
  Image as ImageIcon,
  ZoomIn,
  ZoomOut,
  Settings,
  Eye,
  Loader2,
  CheckCircle,
  AlertCircle,
  RotateCcw,
  Package,
} from "lucide-react"

interface MemeSplitterProps {
  params?: Record<string, string>
}

interface GridCell {
  x: number
  y: number
  width: number
  height: number
  index: number
}

interface SplitResult {
  cells: GridCell[]
  images: string[] // base64 data URLs
  gridLines: { horizontal: number[]; vertical: number[] }
}

interface ProcessStep {
  name: string
  imageData: string
  description: string
}

export default function MemeSplitterPage({}: MemeSplitterProps) {
  // 图片状态
  const [originalImage, setOriginalImage] = useState<HTMLImageElement | null>(null)
  const [imageUrl, setImageUrl] = useState<string>("")
  const [fileName, setFileName] = useState<string>("")
  
  // 处理状态
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [splitResult, setSplitResult] = useState<SplitResult | null>(null)
  const [processSteps, setProcessSteps] = useState<ProcessStep[]>([])
  const [error, setError] = useState<string | null>(null)
  
  // 设置
  const [sensitivity, setSensitivity] = useState(50) // 边缘检测灵敏度
  const [minCellSize, setMinCellSize] = useState(50) // 最小单元格大小
  const [showGrid, setShowGrid] = useState(true)
  const [showProcess, setShowProcess] = useState(false)
  const [autoDetect, setAutoDetect] = useState(true)
  const [manualRows, setManualRows] = useState(4)
  const [manualCols, setManualCols] = useState(6)
  
  // 检测到的行列数（可调整）
  const [detectedRows, setDetectedRows] = useState(4)
  const [detectedCols, setDetectedCols] = useState(6)
  const [contentBounds, setContentBounds] = useState<{left: number, top: number, width: number, height: number} | null>(null)
  
  // UI 状态
  const [isDragging, setIsDragging] = useState(false)
  const [zoom, setZoom] = useState(100)
  const [selectedCells, setSelectedCells] = useState<Set<number>>(new Set())
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const previewCanvasRef = useRef<HTMLCanvasElement>(null)

  // 处理文件上传
  const handleFileUpload = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("请上传图片文件")
      return
    }
    
    setError(null)
    setSplitResult(null)
    setProcessSteps([])
    setSelectedCells(new Set())
    setFileName(file.name)
    
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        setOriginalImage(img)
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
    setOriginalImage(null)
    setImageUrl("")
    setFileName("")
    setSplitResult(null)
    setProcessSteps([])
    setError(null)
    setSelectedCells(new Set())
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }, [])


  // 智能网格检测算法 - 优化版 V3
  const detectGrid = useCallback(async (img: HTMLImageElement): Promise<SplitResult> => {
    return new Promise((resolve) => {
      const canvas = document.createElement("canvas")
      const ctx = canvas.getContext("2d")!
      canvas.width = img.width
      canvas.height = img.height
      ctx.drawImage(img, 0, 0)
      
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const { data, width, height } = imageData
      
      const steps: ProcessStep[] = []
      
      // Step 1: 检测背景色并找到内容边界
      setProgress(10)
      
      // 采样四个角和边缘来确定背景色
      const cornerSamples: number[][] = []
      const sampleSize = Math.min(50, Math.floor(Math.min(width, height) * 0.1))
      
      // 四个角采样
      for (let dy = 0; dy < sampleSize; dy++) {
        for (let dx = 0; dx < sampleSize; dx++) {
          // 左上
          let idx = (dy * width + dx) * 4
          cornerSamples.push([data[idx], data[idx + 1], data[idx + 2]])
          // 右上
          idx = (dy * width + (width - 1 - dx)) * 4
          cornerSamples.push([data[idx], data[idx + 1], data[idx + 2]])
          // 左下
          idx = ((height - 1 - dy) * width + dx) * 4
          cornerSamples.push([data[idx], data[idx + 1], data[idx + 2]])
          // 右下
          idx = ((height - 1 - dy) * width + (width - 1 - dx)) * 4
          cornerSamples.push([data[idx], data[idx + 1], data[idx + 2]])
        }
      }
      
      // 计算背景色（取众数或中位数）
      const bgR = cornerSamples.map(p => p[0]).sort((a, b) => a - b)[Math.floor(cornerSamples.length / 2)]
      const bgG = cornerSamples.map(p => p[1]).sort((a, b) => a - b)[Math.floor(cornerSamples.length / 2)]
      const bgB = cornerSamples.map(p => p[2]).sort((a, b) => a - b)[Math.floor(cornerSamples.length / 2)]
      
      // Step 2: 计算每行每列的内容密度
      setProgress(20)
      const bgThreshold = 25 + (100 - sensitivity) * 0.4
      
      const isBackground = (r: number, g: number, b: number): boolean => {
        return Math.abs(r - bgR) + Math.abs(g - bgG) + Math.abs(b - bgB) < bgThreshold
      }
      
      // 计算每列的非背景像素数
      const colDensity = new Array(width).fill(0)
      for (let x = 0; x < width; x++) {
        for (let y = 0; y < height; y++) {
          const idx = (y * width + x) * 4
          if (!isBackground(data[idx], data[idx + 1], data[idx + 2])) {
            colDensity[x]++
          }
        }
      }
      
      // 计算每行的非背景像素数
      const rowDensity = new Array(height).fill(0)
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const idx = (y * width + x) * 4
          if (!isBackground(data[idx], data[idx + 1], data[idx + 2])) {
            rowDensity[y]++
          }
        }
      }
      
      // 找内容边界 - 使用密度阈值（至少有5%的像素是非背景）
      const colThreshold = height * 0.05
      const rowThreshold = width * 0.05
      
      let contentLeft = 0, contentRight = width - 1, contentTop = 0, contentBottom = height - 1
      
      // 从左边找第一个有足够内容的列
      for (let x = 0; x < width; x++) {
        if (colDensity[x] > colThreshold) { contentLeft = x; break }
      }
      
      // 从右边找最后一个有足够内容的列
      for (let x = width - 1; x >= 0; x--) {
        if (colDensity[x] > colThreshold) { contentRight = x; break }
      }
      
      // 从上边找
      for (let y = 0; y < height; y++) {
        if (rowDensity[y] > rowThreshold) { contentTop = y; break }
      }
      
      // 从下边找
      for (let y = height - 1; y >= 0; y--) {
        if (rowDensity[y] > rowThreshold) { contentBottom = y; break }
      }
      
      // 扩展边界以包含完整的单元格（向外扩展一点）
      const margin = Math.min(width, height) * 0.01
      contentLeft = Math.max(0, contentLeft - margin)
      contentRight = Math.min(width - 1, contentRight + margin)
      contentTop = Math.max(0, contentTop - margin)
      contentBottom = Math.min(height - 1, contentBottom + margin)
      
      // 额外检查：如果右边有大片空白区域，进一步收缩
      // 检测右侧是否有连续的低密度区域
      let consecutiveLowDensity = 0
      const lowDensityThreshold = height * 0.02
      for (let x = width - 1; x >= contentLeft; x--) {
        if (colDensity[x] < lowDensityThreshold) {
          consecutiveLowDensity++
        } else {
          // 如果连续空白区域超过图片宽度的10%，认为是边缘空白
          if (consecutiveLowDensity > width * 0.1) {
            contentRight = x
          }
          break
        }
      }
      
      // 同样检查底部
      consecutiveLowDensity = 0
      const lowRowDensityThreshold = width * 0.02
      for (let y = height - 1; y >= contentTop; y--) {
        if (rowDensity[y] < lowRowDensityThreshold) {
          consecutiveLowDensity++
        } else {
          if (consecutiveLowDensity > height * 0.1) {
            contentBottom = y
          }
          break
        }
      }
      
      const contentWidth = contentRight - contentLeft + 1
      const contentHeight = contentBottom - contentTop + 1
      
      steps.push({
        name: "内容边界",
        imageData: canvas.toDataURL(),
        description: `内容区域: ${contentWidth}×${contentHeight}, 边距: 左${contentLeft} 上${contentTop} 右${width - contentRight - 1} 下${height - contentBottom - 1}`
      })
      
      // Step 3: 基于宽高比计算最佳网格
      setProgress(50)
      
      // 核心思路：
      // 1. 表情包单元格通常是正方形或接近正方形
      // 2. 根据图片方向（横向/竖向）选择合适的网格
      // 3. 优先选择单元格更接近正方形的组合
      
      const contentRatio = contentWidth / contentHeight
      const isLandscape = contentRatio > 1 // 横向图片
      
      // 根据图片方向生成候选网格
      // 横向图片：列数 > 行数，竖向图片：行数 > 列数
      const candidateGrids: [number, number][] = []
      
      for (let rows = 2; rows <= 8; rows++) {
        for (let cols = 2; cols <= 8; cols++) {
          // 根据图片方向过滤不合理的组合
          if (isLandscape && cols < rows) continue  // 横向图片，列应该>=行
          if (!isLandscape && rows < cols) continue // 竖向图片，行应该>=列
          
          candidateGrids.push([rows, cols])
        }
      }
      
      // 添加一些特殊的常见组合
      candidateGrids.push([3, 3], [4, 4], [5, 5]) // 正方形网格
      
      let bestRows = isLandscape ? 4 : 6
      let bestCols = isLandscape ? 6 : 4
      let bestScore = Infinity
      
      for (const [rows, cols] of candidateGrids) {
        // 计算单元格尺寸
        const cellWidth = contentWidth / cols
        const cellHeight = contentHeight / rows
        
        // 单元格宽高比（越接近1越好）
        const cellRatio = cellWidth / cellHeight
        
        // 只考虑单元格比例在合理范围内的组合（0.75-1.35）
        if (cellRatio < 0.75 || cellRatio > 1.35) continue
        
        // 计算与正方形的偏差
        const squareError = Math.abs(cellRatio - 1)
        
        // 总数量惩罚
        const totalCells = rows * cols
        let countPenalty = 0
        if (totalCells < 4) countPenalty = 0.5
        else if (totalCells > 36) countPenalty = 0.3
        
        // 常见网格加成
        let bonus = 0
        if ((rows === 4 && cols === 6) || (rows === 6 && cols === 4)) bonus = 0.1
        else if ((rows === 3 && cols === 4) || (rows === 4 && cols === 3)) bonus = 0.08
        else if (rows === 3 && cols === 3) bonus = 0.08
        else if (rows === 4 && cols === 4) bonus = 0.08
        else if ((rows === 4 && cols === 5) || (rows === 5 && cols === 4)) bonus = 0.05
        
        // 综合评分（越低越好）
        const score = squareError + countPenalty - bonus
        
        if (score < bestScore) {
          bestScore = score
          bestRows = rows
          bestCols = cols
        }
      }
      
      // Step 4: 保存检测结果并生成网格线
      setProgress(70)
      
      // 保存检测到的行列数和内容边界，供用户调整
      setDetectedRows(bestRows)
      setDetectedCols(bestCols)
      setContentBounds({
        left: Math.floor(contentLeft),
        top: Math.floor(contentTop),
        width: Math.ceil(contentWidth),
        height: Math.ceil(contentHeight)
      })
      
      // 使用内容边界生成网格线
      const horizontalLines: number[] = []
      const verticalLines: number[] = []
      
      for (let i = 0; i <= bestRows; i++) {
        const y = contentTop + Math.round(contentHeight * i / bestRows)
        horizontalLines.push(Math.min(y, height))
      }
      
      for (let i = 0; i <= bestCols; i++) {
        const x = contentLeft + Math.round(contentWidth * i / bestCols)
        verticalLines.push(Math.min(x, width))
      }
      
      // 保存网格检测结果
      setProgress(80)
      const gridCanvas = document.createElement("canvas")
      gridCanvas.width = width
      gridCanvas.height = height
      const gridCtx = gridCanvas.getContext("2d")!
      gridCtx.drawImage(img, 0, 0)
      
      // 绘制内容边界（蓝色虚线）
      gridCtx.strokeStyle = "rgba(0, 100, 255, 0.5)"
      gridCtx.lineWidth = 2
      gridCtx.setLineDash([5, 5])
      gridCtx.strokeRect(contentLeft, contentTop, contentWidth, contentHeight)
      gridCtx.setLineDash([])
      
      // 绘制网格线（绿色）
      gridCtx.strokeStyle = "#00ff00"
      gridCtx.lineWidth = 2
      
      horizontalLines.forEach(y => {
        gridCtx.beginPath()
        gridCtx.moveTo(contentLeft, y)
        gridCtx.lineTo(contentRight, y)
        gridCtx.stroke()
      })
      
      verticalLines.forEach(x => {
        gridCtx.beginPath()
        gridCtx.moveTo(x, contentTop)
        gridCtx.lineTo(x, contentBottom)
        gridCtx.stroke()
      })
      
      steps.push({
        name: "网格检测",
        imageData: gridCanvas.toDataURL(),
        description: `最佳匹配: ${bestRows} 行 × ${bestCols} 列 (单元格比例: ${(contentWidth / bestCols / (contentHeight / bestRows)).toFixed(2)})`
      })
      
      // Step 5: 生成切分结果
      setProgress(90)
      const cells: GridCell[] = []
      const images: string[] = []
      
      for (let row = 0; row < horizontalLines.length - 1; row++) {
        for (let col = 0; col < verticalLines.length - 1; col++) {
          const x = verticalLines[col]
          const y = horizontalLines[row]
          const cellWidth = verticalLines[col + 1] - x
          const cellHeight = horizontalLines[row + 1] - y
          
          cells.push({
            x, y,
            width: cellWidth,
            height: cellHeight,
            index: cells.length
          })
          
          // 切分图片
          const cellCanvas = document.createElement("canvas")
          cellCanvas.width = cellWidth
          cellCanvas.height = cellHeight
          const cellCtx = cellCanvas.getContext("2d")!
          cellCtx.drawImage(img, x, y, cellWidth, cellHeight, 0, 0, cellWidth, cellHeight)
          images.push(cellCanvas.toDataURL("image/png"))
        }
      }
      
      setProgress(100)
      setProcessSteps(steps)
      
      resolve({
        cells,
        images,
        gridLines: {
          horizontal: horizontalLines,
          vertical: verticalLines
        }
      })
    })
  }, [sensitivity, minCellSize, setProcessSteps])

  // 使用调整后的行列数重新切分
  const resplitWithAdjustedGrid = useCallback(async () => {
    if (!originalImage || !contentBounds) return
    
    const { left, top, width: cWidth, height: cHeight } = contentBounds
    const img = originalImage
    
    const horizontalLines: number[] = []
    const verticalLines: number[] = []
    
    for (let i = 0; i <= detectedRows; i++) {
      const y = top + Math.round(cHeight * i / detectedRows)
      horizontalLines.push(Math.min(y, img.height))
    }
    
    for (let i = 0; i <= detectedCols; i++) {
      const x = left + Math.round(cWidth * i / detectedCols)
      verticalLines.push(Math.min(x, img.width))
    }
    
    const cells: GridCell[] = []
    const images: string[] = []
    
    for (let row = 0; row < horizontalLines.length - 1; row++) {
      for (let col = 0; col < verticalLines.length - 1; col++) {
        const x = verticalLines[col]
        const y = horizontalLines[row]
        const cellWidth = verticalLines[col + 1] - x
        const cellHeight = horizontalLines[row + 1] - y
        
        cells.push({ x, y, width: cellWidth, height: cellHeight, index: cells.length })
        
        const cellCanvas = document.createElement("canvas")
        cellCanvas.width = cellWidth
        cellCanvas.height = cellHeight
        const cellCtx = cellCanvas.getContext("2d")!
        cellCtx.drawImage(img, x, y, cellWidth, cellHeight, 0, 0, cellWidth, cellHeight)
        images.push(cellCanvas.toDataURL("image/png"))
      }
    }
    
    setSplitResult({
      cells,
      images,
      gridLines: { horizontal: horizontalLines, vertical: verticalLines }
    })
    setSelectedCells(new Set(cells.map(c => c.index)))
  }, [originalImage, contentBounds, detectedRows, detectedCols])

  // 手动网格切分
  const manualSplit = useCallback(async (img: HTMLImageElement): Promise<SplitResult> => {
    const canvas = document.createElement("canvas")
    const ctx = canvas.getContext("2d")!
    canvas.width = img.width
    canvas.height = img.height
    ctx.drawImage(img, 0, 0)
    
    const cellWidth = Math.floor(img.width / manualCols)
    const cellHeight = Math.floor(img.height / manualRows)
    
    const horizontalLines = Array.from({ length: manualRows + 1 }, (_, i) => 
      i === manualRows ? img.height : i * cellHeight
    )
    const verticalLines = Array.from({ length: manualCols + 1 }, (_, i) => 
      i === manualCols ? img.width : i * cellWidth
    )
    
    const cells: GridCell[] = []
    const images: string[] = []
    
    for (let row = 0; row < manualRows; row++) {
      for (let col = 0; col < manualCols; col++) {
        const x = col * cellWidth
        const y = row * cellHeight
        const w = col === manualCols - 1 ? img.width - x : cellWidth
        const h = row === manualRows - 1 ? img.height - y : cellHeight
        
        cells.push({ x, y, width: w, height: h, index: cells.length })
        
        const cellCanvas = document.createElement("canvas")
        cellCanvas.width = w
        cellCanvas.height = h
        const cellCtx = cellCanvas.getContext("2d")!
        cellCtx.drawImage(img, x, y, w, h, 0, 0, w, h)
        images.push(cellCanvas.toDataURL("image/png"))
      }
    }
    
    return {
      cells,
      images,
      gridLines: { horizontal: horizontalLines, vertical: verticalLines }
    }
  }, [manualRows, manualCols])

  // 执行切分
  const handleSplit = useCallback(async () => {
    if (!originalImage) return
    
    setIsProcessing(true)
    setProgress(0)
    setError(null)
    
    try {
      const result = autoDetect 
        ? await detectGrid(originalImage)
        : await manualSplit(originalImage)
      
      setSplitResult(result)
      setSelectedCells(new Set(result.cells.map(c => c.index)))
    } catch (err: any) {
      setError(err.message || "切分失败")
    } finally {
      setIsProcessing(false)
    }
  }, [originalImage, autoDetect, detectGrid, manualSplit])

  // 下载单张图片
  const downloadImage = useCallback((dataUrl: string, index: number) => {
    const link = document.createElement("a")
    link.download = `${fileName.replace(/\.[^/.]+$/, "")}_${index + 1}.png`
    link.href = dataUrl
    link.click()
  }, [fileName])

  // 下载选中的图片
  const downloadSelected = useCallback(async () => {
    if (!splitResult) return
    
    const selected = Array.from(selectedCells)
    if (selected.length === 0) return
    
    if (selected.length === 1) {
      downloadImage(splitResult.images[selected[0]], selected[0])
      return
    }
    
    // 多张图片打包下载 (使用 JSZip)
    try {
      const JSZip = (await import("jszip")).default
      const zip = new JSZip()
      
      selected.forEach((index) => {
        const dataUrl = splitResult.images[index]
        const base64 = dataUrl.split(",")[1]
        zip.file(`${fileName.replace(/\.[^/.]+$/, "")}_${index + 1}.png`, base64, { base64: true })
      })
      
      const blob = await zip.generateAsync({ type: "blob" })
      const link = document.createElement("a")
      link.download = `${fileName.replace(/\.[^/.]+$/, "")}_切分.zip`
      link.href = URL.createObjectURL(blob)
      link.click()
      URL.revokeObjectURL(link.href)
    } catch (err) {
      // 如果 JSZip 不可用，逐个下载
      selected.forEach((index) => {
        setTimeout(() => downloadImage(splitResult.images[index], index), index * 100)
      })
    }
  }, [splitResult, selectedCells, fileName, downloadImage])

  // 切换选中状态
  const toggleCellSelection = useCallback((index: number) => {
    setSelectedCells(prev => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      return next
    })
  }, [])

  // 全选/取消全选
  const toggleSelectAll = useCallback(() => {
    if (!splitResult) return
    if (selectedCells.size === splitResult.cells.length) {
      setSelectedCells(new Set())
    } else {
      setSelectedCells(new Set(splitResult.cells.map(c => c.index)))
    }
  }, [splitResult, selectedCells])

  // 绘制预览
  useEffect(() => {
    if (!originalImage || !previewCanvasRef.current) return
    
    const canvas = previewCanvasRef.current
    const ctx = canvas.getContext("2d")!
    
    const scale = zoom / 100
    canvas.width = originalImage.width * scale
    canvas.height = originalImage.height * scale
    
    ctx.drawImage(originalImage, 0, 0, canvas.width, canvas.height)
    
    // 绘制网格线
    if (showGrid && splitResult) {
      ctx.strokeStyle = "rgba(74, 129, 53, 0.8)"
      ctx.lineWidth = 2
      
      splitResult.gridLines.horizontal.forEach(y => {
        ctx.beginPath()
        ctx.moveTo(0, y * scale)
        ctx.lineTo(canvas.width, y * scale)
        ctx.stroke()
      })
      
      splitResult.gridLines.vertical.forEach(x => {
        ctx.beginPath()
        ctx.moveTo(x * scale, 0)
        ctx.lineTo(x * scale, canvas.height)
        ctx.stroke()
      })
      
      // 绘制选中状态
      splitResult.cells.forEach(cell => {
        if (selectedCells.has(cell.index)) {
          ctx.fillStyle = "rgba(74, 129, 53, 0.2)"
          ctx.fillRect(cell.x * scale, cell.y * scale, cell.width * scale, cell.height * scale)
        }
      })
    }
  }, [originalImage, splitResult, showGrid, zoom, selectedCells])

  return (
    <div className="container mx-auto px-4 py-4 max-w-7xl">
      {/* 页面标题 */}
      <div className="text-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-200 mb-2 flex items-center justify-center gap-2">
          <Grid3X3 className="h-8 w-8 text-green-600" />
          智能切图
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          自动检测表情包网格，智能切分图片
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* 左侧控制面板 */}
        <div className="lg:col-span-1 space-y-4">
          {/* 文件上传 */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Upload className="h-4 w-4 text-green-600" />
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
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
                onDragLeave={() => setIsDragging(false)}
                className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
                  isDragging
                    ? "border-green-500 bg-green-50 dark:bg-green-900/20"
                    : "border-gray-300 dark:border-gray-700 hover:border-green-400"
                }`}
              >
                <Upload className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  点击或拖放图片
                </p>
              </div>
              
              {originalImage && (
                <div className="mt-3 space-y-2">
                  <p className="text-sm truncate" title={fileName}>{fileName}</p>
                  <p className="text-xs text-gray-500">
                    {originalImage.width} × {originalImage.height}
                  </p>
                  <Button variant="outline" size="sm" onClick={clearImage} className="w-full">
                    <Trash2 className="h-4 w-4 mr-1" />
                    清除
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 切分设置 */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Settings className="h-4 w-4 text-green-600" />
                切分设置
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="auto-detect">智能检测</Label>
                <Switch
                  id="auto-detect"
                  checked={autoDetect}
                  onCheckedChange={setAutoDetect}
                />
              </div>
              
              {autoDetect ? (
                <>
                  <div className="space-y-2">
                    <Label className="text-sm">检测灵敏度: {sensitivity}%</Label>
                    <Slider
                      value={[sensitivity]}
                      onValueChange={([v]) => setSensitivity(v)}
                      min={10}
                      max={90}
                      step={5}
                    />
                  </div>
                  
                  {/* 检测后可调整的行列数 */}
                  {splitResult && contentBounds && (
                    <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg space-y-3">
                      <p className="text-xs text-green-700 dark:text-green-400 font-medium">
                        检测结果（可调整）:
                      </p>
                      <div className="space-y-2">
                        <Label className="text-sm">行数: {detectedRows}</Label>
                        <Slider
                          value={[detectedRows]}
                          onValueChange={([v]) => setDetectedRows(v)}
                          min={1}
                          max={8}
                          step={1}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm">列数: {detectedCols}</Label>
                        <Slider
                          value={[detectedCols]}
                          onValueChange={([v]) => setDetectedCols(v)}
                          min={1}
                          max={10}
                          step={1}
                        />
                      </div>
                      <Button
                        onClick={resplitWithAdjustedGrid}
                        variant="outline"
                        size="sm"
                        className="w-full"
                      >
                        应用调整
                      </Button>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label className="text-sm">行数: {manualRows}</Label>
                    <Slider
                      value={[manualRows]}
                      onValueChange={([v]) => setManualRows(v)}
                      min={1}
                      max={10}
                      step={1}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm">列数: {manualCols}</Label>
                    <Slider
                      value={[manualCols]}
                      onValueChange={([v]) => setManualCols(v)}
                      min={1}
                      max={10}
                      step={1}
                    />
                  </div>
                </>
              )}
              
              <Button
                onClick={handleSplit}
                disabled={!originalImage || isProcessing}
                className="w-full bg-green-600 hover:bg-green-700"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    处理中...
                  </>
                ) : (
                  <>
                    <Scissors className="h-4 w-4 mr-2" />
                    开始切分
                  </>
                )}
              </Button>
              
              {isProcessing && (
                <Progress value={progress} className="w-full" />
              )}
            </CardContent>
          </Card>

          {/* 显示设置 */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Eye className="h-4 w-4 text-green-600" />
                显示设置
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="show-grid">显示网格</Label>
                <Switch
                  id="show-grid"
                  checked={showGrid}
                  onCheckedChange={setShowGrid}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="show-process">显示处理过程</Label>
                <Switch
                  id="show-process"
                  checked={showProcess}
                  onCheckedChange={setShowProcess}
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
                  <Slider
                    value={[zoom]}
                    onValueChange={([v]) => setZoom(v)}
                    min={25}
                    max={200}
                    step={25}
                    className="flex-1"
                  />
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
        </div>


        {/* 右侧预览区域 */}
        <div className="lg:col-span-3 space-y-4">
          {/* 预览区域 */}
          <Card className="min-h-[400px]">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <ImageIcon className="h-4 w-4 text-green-600" />
                  预览
                </span>
                {splitResult && (
                  <Badge variant="outline" className="bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                    {splitResult.cells.length} 个切片
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!originalImage ? (
                <div className="flex flex-col items-center justify-center h-[300px] text-gray-400">
                  <ImageIcon className="h-16 w-16 mb-4" />
                  <p>请上传图片开始切分</p>
                </div>
              ) : (
                <div className="overflow-auto max-h-[500px] scrollbar-m3">
                  <canvas
                    ref={previewCanvasRef}
                    className="mx-auto border border-gray-200 dark:border-gray-700 rounded-lg"
                  />
                </div>
              )}
              
              {error && (
                <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  {error}
                </div>
              )}
            </CardContent>
          </Card>

          {/* 处理过程 */}
          {showProcess && processSteps.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <RotateCcw className="h-4 w-4 text-green-600" />
                  处理过程
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {processSteps.map((step, index) => (
                    <div key={index} className="border rounded-lg p-3 dark:border-gray-700">
                      <p className="text-sm font-medium mb-2">{step.name}</p>
                      <img
                        src={step.imageData}
                        alt={step.name}
                        className="w-full rounded border dark:border-gray-600"
                      />
                      <p className="text-xs text-gray-500 mt-2">{step.description}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* 切分结果 */}
          {splitResult && splitResult.images.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    切分结果
                  </span>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={toggleSelectAll}>
                      {selectedCells.size === splitResult.cells.length ? "取消全选" : "全选"}
                    </Button>
                    <Button
                      size="sm"
                      onClick={downloadSelected}
                      disabled={selectedCells.size === 0}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <Download className="h-4 w-4 mr-1" />
                      下载选中 ({selectedCells.size})
                    </Button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {splitResult.images.map((dataUrl, index) => (
                    <div
                      key={index}
                      onClick={() => toggleCellSelection(index)}
                      className={`relative cursor-pointer rounded-lg overflow-hidden border-2 transition-all ${
                        selectedCells.has(index)
                          ? "border-green-500 ring-2 ring-green-200 dark:ring-green-800"
                          : "border-gray-200 dark:border-gray-700 hover:border-green-300"
                      }`}
                    >
                      <img
                        src={dataUrl}
                        alt={`切片 ${index + 1}`}
                        className="w-full aspect-square object-contain bg-gray-50 dark:bg-gray-800"
                      />
                      <div className="absolute top-1 left-1">
                        <Badge
                          variant="secondary"
                          className={`text-xs ${
                            selectedCells.has(index)
                              ? "bg-green-500 text-white"
                              : "bg-gray-800/70 text-white"
                          }`}
                        >
                          {index + 1}
                        </Badge>
                      </div>
                      {selectedCells.has(index) && (
                        <div className="absolute top-1 right-1">
                          <CheckCircle className="h-5 w-5 text-green-500 bg-white rounded-full" />
                        </div>
                      )}
                      <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs p-1 text-center opacity-0 hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            downloadImage(dataUrl, index)
                          }}
                          className="hover:underline"
                        >
                          下载
                        </button>
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
