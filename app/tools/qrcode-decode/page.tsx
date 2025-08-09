"use client"

import { useState, useRef, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useToast } from "@/hooks/use-toast"
import { 
  Upload, Image as ImageIcon, ScanLine, Copy, 
  Download, History, RefreshCw, Settings, 
  ExternalLink, Wifi, Phone, Mail, MapPin, User, 
  FileText, AlertTriangle, CheckCircle2, RotateCcw, 
  Eye, EyeOff, Trash2
} from "lucide-react"
import jsQR from "jsqr"

interface QRResult {
  id: string
  data: string
  timestamp: number
  type: string
  details?: any
  fileName?: string
}

interface ImageEnhancement {
  brightness: number
  contrast: number
  rotation: number
  scale: number
  grayscale: boolean
}

export default function QRCodeDecoder() {
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 基本状态
  const [activeTab, setActiveTab] = useState("upload")
  const [files, setFiles] = useState<File[]>([])
  const [selectedFileIndex, setSelectedFileIndex] = useState(0)
  const [isProcessing, setIsProcessing] = useState(false)
  const [processingProgress, setProcessingProgress] = useState(0)

  // 结果状态
  const [results, setResults] = useState<QRResult[]>([])
  const [selectedResult, setSelectedResult] = useState<QRResult | null>(null)
  const [history, setHistory] = useState<QRResult[]>([])
  const [error, setError] = useState<string | null>(null)

  // 图像增强状态
  const [imageEnhancement, setImageEnhancement] = useState<ImageEnhancement>({
    brightness: 100,
    contrast: 100,
    rotation: 0,
    scale: 100,
    grayscale: false
  })
  const [showEnhancement, setShowEnhancement] = useState(false)

  // 设置状态
  const [batchMode, setBatchMode] = useState(false)
  const [maxFileSize] = useState(10 * 1024 * 1024) // 10MB

  // 智能内容解析
  const parseQRContent = useCallback((data: string) => {
    const result: any = { type: 'text', details: {} }

    // URL 检测
    if (data.match(/^https?:\/\//)) {
      result.type = 'url'
      result.details = { url: data }
    }
    // WiFi 配置检测
    else if (data.startsWith('WIFI:')) {
      result.type = 'wifi'
      const match = data.match(/WIFI:T:([^;]*);S:([^;]*);P:([^;]*);H:([^;]*);/)
      if (match) {
        result.details = {
          type: match[1],
          ssid: match[2],
          password: match[3],
          hidden: match[4] === 'true'
        }
      }
    }
    // 电话号码检测
    else if (data.startsWith('tel:') || data.match(/^[\+]?[\d\s\-\(\)]{10,}$/)) {
      result.type = 'phone'
      result.details = { phone: data.replace('tel:', '') }
    }
    // 邮箱检测
    else if (data.startsWith('mailto:') || data.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      result.type = 'email'
      result.details = { email: data.replace('mailto:', '') }
    }
    // 地理位置检测
    else if (data.startsWith('geo:')) {
      result.type = 'location'
      const match = data.match(/geo:([^,]+),([^,?]+)/)
      if (match) {
        result.details = { 
          latitude: parseFloat(match[1]), 
          longitude: parseFloat(match[2]),
          url: `https://maps.google.com/maps?q=${match[1]},${match[2]}`
        }
      }
    }
    // vCard 检测
    else if (data.startsWith('BEGIN:VCARD')) {
      result.type = 'vcard'
      const lines = data.split('\n')
      const details: any = {}
      lines.forEach(line => {
        const colonIndex = line.indexOf(':')
        if (colonIndex > 0) {
          const key = line.substring(0, colonIndex)
          const value = line.substring(colonIndex + 1)
          details[key.toLowerCase()] = value
        }
      })
      result.details = details
    }
    // JSON 检测
    else if (data.startsWith('{') && data.endsWith('}')) {
      try {
        result.type = 'json'
        result.details = JSON.parse(data)
      } catch {
        result.type = 'text'
      }
    }

    return result
  }, [])

  // 应用图像增强
  const applyImageEnhancement = useCallback((canvas: HTMLCanvasElement, enhancement: ImageEnhancement) => {
    const ctx = canvas.getContext('2d')
    if (!ctx) return null

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const data = imageData.data

    // 应用亮度和对比度
    for (let i = 0; i < data.length; i += 4) {
      // 亮度调整
      data[i] = Math.min(255, Math.max(0, data[i] * (enhancement.brightness / 100)))
      data[i + 1] = Math.min(255, Math.max(0, data[i + 1] * (enhancement.brightness / 100)))
      data[i + 2] = Math.min(255, Math.max(0, data[i + 2] * (enhancement.brightness / 100)))

      // 对比度调整
      const contrast = (enhancement.contrast / 100)
      data[i] = Math.min(255, Math.max(0, ((data[i] / 255 - 0.5) * contrast + 0.5) * 255))
      data[i + 1] = Math.min(255, Math.max(0, ((data[i + 1] / 255 - 0.5) * contrast + 0.5) * 255))
      data[i + 2] = Math.min(255, Math.max(0, ((data[i + 2] / 255 - 0.5) * contrast + 0.5) * 255))

      // 灰度处理
      if (enhancement.grayscale) {
        const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
        data[i] = gray
        data[i + 1] = gray
        data[i + 2] = gray
      }
    }

    ctx.putImageData(imageData, 0, 0)
    return imageData
  }, [])

  // 解码二维码 - 增强版本，多种策略尝试
  const decodeQRCode = useCallback(async (imageData: ImageData, fileName?: string): Promise<QRResult | null> => {
    // 多种解码策略
    const strategies = [
      // 策略1: 标准解码
      { inversionAttempts: "dontInvert" },
      // 策略2: 尝试反色
      { inversionAttempts: "onlyInvert" },
      // 策略3: 同时尝试正常和反色
      { inversionAttempts: "attemptBoth" },
      // 策略4: 更多反色尝试
      { inversionAttempts: "invertFirst" }
    ]

    for (const strategy of strategies) {
      try {
        const code = jsQR(imageData.data, imageData.width, imageData.height, strategy)
        
        if (code && code.data) {
          const parsed = parseQRContent(code.data)
          const result: QRResult = {
            id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
            data: code.data,
            timestamp: Date.now(),
            type: parsed.type,
            details: parsed.details,
            fileName
          }
          return result
        }
      } catch (error) {
        console.error('QR解码策略失败:', strategy, error)
        continue
      }
    }

    return null
  }, [parseQRContent])

  // 处理图像文件 - 增强版本，多种预处理策略
  const processImageFile = useCallback(async (file: File, index: number, total: number) => {
    console.log(`开始处理图像文件: ${file.name} (${index + 1}/${total})`)
    return new Promise<QRResult | null>((resolve) => {
      if (!file.type.startsWith('image/')) {
        console.error('不支持的文件类型:', file.type)
        setError('只支持图像文件')
        resolve(null)
        return
      }

      const reader = new FileReader()
      reader.onload = async (e) => {
        if (!e.target?.result) {
          resolve(null)
          return
        }

        const img = new Image()
        img.crossOrigin = "anonymous"
        img.onload = async () => {
          console.log(`图像加载成功: ${file.name}, 尺寸: ${img.width}x${img.height}`)
          const canvas = document.createElement('canvas')
          const ctx = canvas.getContext('2d')
          if (!ctx) {
            console.error('无法获取Canvas 2D上下文')
            resolve(null)
            return
          }

          // 多种图像预处理策略
          const preprocessStrategies = [
            // 策略1: 用户设置的增强
            imageEnhancement,
            // 策略2: 高对比度 + 灰度
            { ...imageEnhancement, contrast: 150, brightness: 120, grayscale: true },
            // 策略3: 更高对比度
            { ...imageEnhancement, contrast: 200, brightness: 100, grayscale: true },
            // 策略4: 原始尺寸，无增强
            { brightness: 100, contrast: 100, rotation: 0, scale: 100, grayscale: false },
            // 策略5: 放大 + 高对比度
            { brightness: 110, contrast: 180, rotation: 0, scale: 150, grayscale: true },
            // 策略6: 缩小 + 锐化
            { brightness: 120, contrast: 160, rotation: 0, scale: 80, grayscale: true }
          ]

          for (let strategyIndex = 0; strategyIndex < preprocessStrategies.length; strategyIndex++) {
            const strategy = preprocessStrategies[strategyIndex]
            
            try {
              // 设置画布尺寸
              const scale = strategy.scale / 100
              canvas.width = img.width * scale
              canvas.height = img.height * scale

              // 清空画布
              ctx.clearRect(0, 0, canvas.width, canvas.height)

              // 处理旋转
              ctx.save()
              if (strategy.rotation !== 0) {
                ctx.translate(canvas.width / 2, canvas.height / 2)
                ctx.rotate((strategy.rotation * Math.PI) / 180)
                ctx.translate(-canvas.width / 2, -canvas.height / 2)
              }

              ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
              ctx.restore()

              // 应用图像增强
              const enhancedImageData = applyImageEnhancement(canvas, strategy)
              
              if (enhancedImageData) {
                const result = await decodeQRCode(enhancedImageData, file.name)
                if (result) {
                  // 成功解码，记录使用的策略
                  console.log(`成功解码使用策略 ${strategyIndex + 1}:`, strategy)
                  setProcessingProgress(((index + 1) / total) * 100)
                  resolve(result)
                  return
                }
              }
          } catch (error) {
              console.warn(`预处理策略 ${strategyIndex + 1} 失败:`, error)
              continue
          }
          }

          // 所有策略都失败
          setProcessingProgress(((index + 1) / total) * 100)
          resolve(null)
        }

        img.onerror = () => {
          console.error('图像加载失败:', file.name)
          setError('图像加载失败')
          resolve(null)
        }

        img.src = e.target.result as string
      }

      reader.onerror = () => {
        console.error('文件读取失败:', file.name)
        setError('文件读取失败')
        resolve(null)
      }

      reader.readAsDataURL(file)
    })
  }, [imageEnhancement, applyImageEnhancement, decodeQRCode])

  // 批量处理文件
  const processBatchFiles = useCallback(async (filesToProcess?: File[]) => {
    const targetFiles = filesToProcess || files
    console.log('批量处理文件:', targetFiles.length, '个文件')
    
    if (targetFiles.length === 0) {
      console.warn('没有文件需要处理')
      return
    }

    setIsProcessing(true)
    setProcessingProgress(0)
    setError(null)
    const newResults: QRResult[] = []

    for (let i = 0; i < targetFiles.length; i++) {
      console.log(`处理第 ${i + 1} 个文件:`, targetFiles[i].name)
      const result = await processImageFile(targetFiles[i], i, targetFiles.length)
      if (result) {
        newResults.push(result)
        console.log('解码成功:', result.data.substring(0, 50))
      } else {
        console.log('解码失败')
      }
    }

    setResults(newResults)
    if (newResults.length > 0) {
      setHistory(prev => [...newResults, ...prev].slice(0, 100))
      setSelectedResult(newResults[0])
      toast({
        title: "解码完成",
        description: `成功解码 ${newResults.length} 个二维码`,
      })
    } else {
      setError('未检测到二维码')
    }

    setIsProcessing(false)
    setProcessingProgress(0)
  }, [files, processImageFile, toast])

  // 处理单个文件
  const processSingleFile = useCallback(async (filesToProcess?: File[], fileIndex?: number) => {
    const targetFiles = filesToProcess || files
    const targetIndex = fileIndex !== undefined ? fileIndex : selectedFileIndex
    console.log('处理单个文件:', targetFiles.length, '个文件，索引:', targetIndex)
    
    if (targetFiles.length === 0 || targetIndex >= targetFiles.length) {
      console.warn('没有有效文件或索引超出范围')
      return
    }

    console.log('开始处理文件:', targetFiles[targetIndex].name)
    setIsProcessing(true)
    setError(null)
    
    const result = await processImageFile(targetFiles[targetIndex], 0, 1)
    
    if (result) {
      console.log('单个文件解码成功:', result.data.substring(0, 50))
      setResults([result])
      setHistory(prev => [result, ...prev].slice(0, 100))
      setSelectedResult(result)
      toast({
        title: "解码成功",
        description: result.data.length > 50 ? result.data.substring(0, 50) + '...' : result.data,
      })
    } else {
      console.log('单个文件解码失败')
      setError('未检测到二维码')
    }

    setIsProcessing(false)
  }, [files, selectedFileIndex, processImageFile, toast])

  // 文件上传处理 - 添加自动解析
  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || [])
    console.log('文件上传事件触发，选择了', selectedFiles.length, '个文件')
    
    const validFiles = selectedFiles.filter(file => {
      if (file.size > maxFileSize) {
        toast({
          title: "文件太大",
          description: `${file.name} 超过了 ${maxFileSize / 1024 / 1024}MB 限制`,
          variant: "destructive"
        })
        return false
      }
      return true
    })

    console.log('有效文件数量:', validFiles.length)
    if (validFiles.length === 0) {
      console.warn('没有有效文件')
      return
    }

    setFiles(validFiles)
    setSelectedFileIndex(0)
    setResults([])
    setError(null)

    // 直接开始解析，传递有效文件
    console.log('准备自动解析，批量模式:', batchMode)
    setTimeout(() => {
      if (batchMode) {
        console.log('调用批量处理函数')
        processBatchFiles(validFiles)
      } else {
        console.log('调用单个文件处理函数')
        processSingleFile(validFiles, 0)
      }
    }, 100) // 短暂延迟确保状态更新完成
  }, [maxFileSize, toast, batchMode, processBatchFiles, processSingleFile])

  // 拖拽处理 - 添加自动解析
  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      e.stopPropagation()

    const droppedFiles = Array.from(e.dataTransfer.files)
    const imageFiles = droppedFiles.filter(file => file.type.startsWith('image/'))

    if (imageFiles.length === 0) {
      toast({
        title: "无效文件",
        description: "请上传图像文件",
        variant: "destructive"
      })
      return
    }

    // 检查文件大小
    const validFiles = imageFiles.filter(file => {
      if (file.size > maxFileSize) {
        toast({
          title: "文件太大",
          description: `${file.name} 超过了 ${maxFileSize / 1024 / 1024}MB 限制`,
          variant: "destructive"
        })
        return false
      }
      return true
    })

    if (validFiles.length === 0) return

    setFiles(validFiles)
    setSelectedFileIndex(0)
    setResults([])
    setError(null)

    // 直接开始解析，传递有效文件
    setTimeout(() => {
      if (batchMode) {
        processBatchFiles(validFiles)
    } else {
        processSingleFile(validFiles, 0)
      }
    }, 100) // 短暂延迟确保状态更新完成
  }, [toast, maxFileSize, batchMode, processBatchFiles, processSingleFile])

  // 复制功能
  const copyToClipboard = useCallback((text: string) => {
    navigator.clipboard.writeText(text)
    toast({
      title: "已复制",
      description: "内容已复制到剪贴板",
    })
  }, [toast])

  // 导出历史记录
  const exportHistory = useCallback(() => {
    if (history.length === 0) {
      toast({
        title: "没有数据",
        description: "没有历史记录可导出",
        variant: "destructive"
      })
      return
    }

    const csvContent = [
      'Timestamp,Type,Data,Details',
      ...history.map(record => 
        `${new Date(record.timestamp).toISOString()},${record.type},"${record.data.replace(/"/g, '""')}","${JSON.stringify(record.details).replace(/"/g, '""')}"`
      )
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `qr_decode_history_${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    toast({
      title: "导出完成",
      description: "历史记录已导出为CSV文件",
    })
  }, [history, toast])

  // 渲染内容详情
  const renderContentDetails = useCallback((result: QRResult) => {
    const { type, details } = result

    switch (type) {
      case 'url':
        return (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <ExternalLink className="h-4 w-4" />
              <span className="font-medium">网址链接</span>
            </div>
            <Button
              onClick={() => window.open(details.url, '_blank')}
              className="w-full"
            >
              打开链接
            </Button>
          </div>
        )

      case 'wifi':
        return (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Wifi className="h-4 w-4" />
              <span className="font-medium">WiFi 配置</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>网络名称:</div>
              <div className="font-mono">{details.ssid}</div>
              <div>加密类型:</div>
              <div>{details.type || 'WPA'}</div>
              <div>密码:</div>
              <div className="font-mono break-all">{details.password}</div>
              <div>隐藏网络:</div>
              <div>{details.hidden ? '是' : '否'}</div>
            </div>
          </div>
        )

      case 'phone':
        return (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4" />
              <span className="font-medium">电话号码</span>
            </div>
            <Button
              onClick={() => window.open(`tel:${details.phone}`, '_self')}
              className="w-full"
            >
              拨打电话
            </Button>
          </div>
        )

      case 'email':
        return (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              <span className="font-medium">邮箱地址</span>
            </div>
            <Button
              onClick={() => window.open(`mailto:${details.email}`, '_self')}
              className="w-full"
            >
              发送邮件
            </Button>
          </div>
        )

      case 'location':
        return (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              <span className="font-medium">地理位置</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>纬度:</div>
              <div className="font-mono">{details.latitude}</div>
              <div>经度:</div>
              <div className="font-mono">{details.longitude}</div>
            </div>
            <Button
              onClick={() => window.open(details.url, '_blank')}
              className="w-full"
            >
              在地图中查看
            </Button>
          </div>
        )

      case 'vcard':
        return (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4" />
              <span className="font-medium">联系人信息</span>
            </div>
            <div className="space-y-1 text-sm">
              {details.fn && <div><strong>姓名:</strong> {details.fn}</div>}
              {details.org && <div><strong>组织:</strong> {details.org}</div>}
              {details.tel && <div><strong>电话:</strong> {details.tel}</div>}
              {details.email && <div><strong>邮箱:</strong> {details.email}</div>}
              {details.url && <div><strong>网址:</strong> {details.url}</div>}
            </div>
          </div>
        )

      default:
        return (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              <span className="font-medium">纯文本</span>
            </div>
            <div className="text-sm text-gray-600">
              文本长度: {result.data.length} 字符
            </div>
          </div>
        )
    }
  }, [])

  return (
    <TooltipProvider>
      <div className="container mx-auto py-6 px-4 max-w-6xl">
        {/* 页面标题 */}
        <div className="text-center space-y-4 mb-8">
          <h1 className="text-3xl font-bold flex items-center justify-center gap-2">
            <ScanLine className="h-8 w-8 text-blue-500" />
            二维码解码器
          </h1>
          <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            上传图片自动解码二维码，支持批量处理、多策略识别和智能内容解析
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="upload" className="flex items-center gap-2">
              <Upload className="h-4 w-4" />
              图片上传
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-2">
              <History className="h-4 w-4" />
              历史记录
            </TabsTrigger>
          </TabsList>

          {/* 图片上传页面 */}
          <TabsContent value="upload" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* 左侧：上传区域 */}
              <div className="lg:col-span-2 space-y-6">
                {/* 文件上传 */}
                <Card>
        <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        <ImageIcon className="h-5 w-5" />
                        图片上传
                      </CardTitle>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center space-x-2">
                          <Switch
                            id="batch-mode"
                            checked={batchMode}
                            onCheckedChange={setBatchMode}
                          />
                          <Label htmlFor="batch-mode" className="text-sm">批量模式</Label>
                        </div>
                      </div>
                    </div>
        </CardHeader>
        <CardContent>
          <div
                      className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                        files.length > 0 ? "border-green-500 bg-green-50 dark:bg-green-900/20" : "border-gray-300 dark:border-gray-700 hover:border-gray-400"
            }`}
            onDragOver={(e) => {
              e.preventDefault()
              e.stopPropagation()
            }}
            onDrop={handleDrop}
          >
                      {files.length === 0 ? (
                        <div className="space-y-4">
                          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
                            <Upload className="h-8 w-8 text-gray-600 dark:text-gray-400" />
                </div>
                          <div>
                            <p className="text-lg font-medium text-gray-900 dark:text-gray-100">
                              拖拽图片到这里
                            </p>
                            <p className="text-sm text-gray-500 mt-1">
                              支持 JPG、PNG、GIF、WEBP 格式，最大 10MB
                            </p>
                            <p className="text-xs text-blue-600 mt-2">
                              上传后将自动解析二维码，支持多种识别策略
                            </p>
                          </div>
                          <Button onClick={() => fileInputRef.current?.click()} size="lg">
                            <Upload className="mr-2 h-5 w-5" />
                            选择图片
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                            multiple={batchMode}
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </div>
                      ) : (
                        <div className="space-y-4">
                          <div className="flex items-center justify-center gap-2">
                            <CheckCircle2 className="h-5 w-5 text-green-500" />
                            <span className="font-medium">
                              已选择 {files.length} 个文件
                            </span>
                          </div>
                          
                          {!batchMode && files.length > 0 && (
                            <div className="space-y-2">
                              <Label>选择要处理的文件:</Label>
                              <Select
                                value={selectedFileIndex.toString()}
                                onValueChange={(value) => setSelectedFileIndex(parseInt(value))}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {files.map((file, index) => (
                                    <SelectItem key={index} value={index.toString()}>
                                      {file.name} ({(file.size / 1024).toFixed(1)}KB)
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          )}

                          <div className="flex gap-2 justify-center">
                            {isProcessing ? (
                              <div className="flex items-center gap-2 text-blue-600">
                                <RefreshCw className="h-5 w-5 animate-spin" />
                                <span className="font-medium">正在自动解析...</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 text-green-600">
                                <CheckCircle2 className="h-5 w-5" />
                                <span className="font-medium">
                                  {results.length > 0 ? '解析完成' : '等待解析结果'}
                                </span>
                              </div>
                            )}
                            
                            <Button
                              variant="outline"
                              onClick={() => {
                                setFiles([])
                                setResults([])
                                setSelectedFileIndex(0)
                                setError(null)
                                if (fileInputRef.current) fileInputRef.current.value = ""
                              }}
                              disabled={isProcessing}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              清空
                  </Button>
                </div>

                          {isProcessing && (
                            <div className="space-y-2">
                              <Progress value={processingProgress} className="w-full" />
                              <p className="text-sm text-gray-500 text-center">
                                {processingProgress.toFixed(0)}% 完成
                              </p>
                            </div>
                          )}
              </div>
            )}
          </div>

                    {/* 文件列表 */}
                    {files.length > 0 && (
                      <div className="mt-4">
                        <Label className="text-sm font-medium">文件列表:</Label>
                        <ScrollArea className="h-32 mt-2">
                          <div className="space-y-1">
                            {files.map((file, index) => (
                              <div
                                key={index}
                                className={`flex items-center justify-between p-2 rounded border ${
                                  index === selectedFileIndex && !batchMode ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : ''
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <ImageIcon className="h-4 w-4" />
                                  <span className="text-sm truncate">{file.name}</span>
                                </div>
                                <Badge variant="outline" className="text-xs">
                                  {(file.size / 1024).toFixed(1)}KB
                                </Badge>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
            </div>
          )}
                  </CardContent>
                </Card>

                {/* 图像增强 */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        <Settings className="h-5 w-5" />
                        图像增强 (可选)
                      </CardTitle>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowEnhancement(!showEnhancement)}
                      >
                        {showEnhancement ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </CardHeader>
                  {showEnhancement && (
                    <CardContent className="space-y-4">
                      <div className="text-sm text-gray-600 dark:text-gray-400 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                        <div className="flex items-center gap-2 mb-1">
                          <ScanLine className="h-4 w-4 text-blue-500" />
                          <span className="font-medium">智能识别说明</span>
                        </div>
                        <p className="text-xs">
                          系统会自动尝试多种图像处理策略来提高识别率，您可以手动调整参数来匹配特定的二维码图片。
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-sm">亮度: {imageEnhancement.brightness}%</Label>
                          <Slider
                            value={[imageEnhancement.brightness]}
                            onValueChange={([value]) => setImageEnhancement(prev => ({ ...prev, brightness: value }))}
                            min={50}
                            max={200}
                            step={5}
                            className="mt-2"
                          />
                        </div>
                        <div>
                          <Label className="text-sm">对比度: {imageEnhancement.contrast}%</Label>
                          <Slider
                            value={[imageEnhancement.contrast]}
                            onValueChange={([value]) => setImageEnhancement(prev => ({ ...prev, contrast: value }))}
                            min={50}
                            max={200}
                            step={5}
                            className="mt-2"
                          />
                        </div>
                        <div>
                          <Label className="text-sm">旋转: {imageEnhancement.rotation}°</Label>
                          <Slider
                            value={[imageEnhancement.rotation]}
                            onValueChange={([value]) => setImageEnhancement(prev => ({ ...prev, rotation: value }))}
                            min={-180}
                            max={180}
                            step={15}
                            className="mt-2"
                          />
                        </div>
                        <div>
                          <Label className="text-sm">缩放: {imageEnhancement.scale}%</Label>
                          <Slider
                            value={[imageEnhancement.scale]}
                            onValueChange={([value]) => setImageEnhancement(prev => ({ ...prev, scale: value }))}
                            min={50}
                            max={200}
                            step={5}
                            className="mt-2"
                          />
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        <Switch
                          id="grayscale"
                          checked={imageEnhancement.grayscale}
                          onCheckedChange={(checked) => setImageEnhancement(prev => ({ ...prev, grayscale: checked }))}
                        />
                        <Label htmlFor="grayscale" className="text-sm">灰度处理</Label>
                      </div>

                      <Button
                        variant="outline"
                        onClick={() => setImageEnhancement({
                          brightness: 100,
                          contrast: 100,
                          rotation: 0,
                          scale: 100,
                          grayscale: false
                        })}
                        className="w-full"
                      >
                        <RotateCcw className="mr-2 h-4 w-4" />
                        重置设置
                      </Button>
                    </CardContent>
                  )}
                </Card>
              </div>

              {/* 右侧：预览和即时结果 */}
              <div className="space-y-6">
                {/* 文件预览 */}
                {files.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">文件预览</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {!batchMode && files[selectedFileIndex] && (
                        <div className="space-y-3">
                          <img
                            src={URL.createObjectURL(files[selectedFileIndex])}
                            alt="预览"
                            className="w-full max-h-48 object-contain rounded border"
                          />
                          <div className="text-sm text-gray-600">
                            <div>文件: {files[selectedFileIndex].name}</div>
                            <div>大小: {(files[selectedFileIndex].size / 1024).toFixed(1)}KB</div>
                          </div>
            </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* 错误提示 */}
                {error && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                {/* 即时结果 */}
                {results.length > 0 && (
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">解码结果</CardTitle>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const allData = results.map(r => r.data).join('\n')
                            copyToClipboard(allData)
                          }}
                        >
                        <Copy className="mr-2 h-4 w-4" />
                          复制全部
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <ScrollArea className="h-80">
                        <div className="space-y-4">
                          {results.map((result, index) => (
                            <div key={result.id} className="p-4 border rounded-lg">
                              <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <Badge variant="outline" className="text-xs">
                                      {result.type.toUpperCase()}
                                    </Badge>
                                    <span className="text-xs text-gray-500">
                                      {new Date(result.timestamp).toLocaleTimeString()}
                      </span>
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => copyToClipboard(result.data)}
                                  >
                                    <Copy className="h-4 w-4" />
                  </Button>
                                </div>

                                {/* 智能内容解析结果 */}
                                {renderContentDetails(result)}

                                <div className="border-t pt-3">
                                  <Label className="text-sm font-medium text-gray-500">原始数据:</Label>
                                  <Textarea
                                    value={result.data}
                                    readOnly
                                    rows={3}
                                    className="text-xs font-mono mt-1"
                                  />
                                </div>

                                {result.fileName && (
                                  <div className="text-xs text-gray-500">
                                    来源: {result.fileName}
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </TabsContent>

          {/* 历史记录页面 */}
          <TabsContent value="history" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>历史记录 ({history.length})</CardTitle>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={exportHistory}
                      disabled={history.length === 0}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      导出CSV
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setHistory([])}
                      disabled={history.length === 0}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      清空记录
                  </Button>
                </div>
              </div>
              </CardHeader>
              <CardContent>
                {history.length === 0 ? (
                  <div className="text-center py-12">
                    <History className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                    <p className="text-lg font-medium text-gray-600 dark:text-gray-400 mb-2">
                      暂无历史记录
                    </p>
                    <p className="text-gray-500">
                      解码的二维码记录将在这里显示
                    </p>
                  </div>
                ) : (
                  <ScrollArea className="h-96">
                    <div className="space-y-3">
                      {history.map((record) => (
                        <div key={record.id} className="p-4 border rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs">
                                {record.type.toUpperCase()}
                              </Badge>
                              <span className="text-xs text-gray-500">
                                {new Date(record.timestamp).toLocaleString()}
                              </span>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => copyToClipboard(record.data)}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          </div>
                          
                          <div className="text-sm break-all">
                            {record.data.length > 150 ? record.data.substring(0, 150) + '...' : record.data}
                          </div>
                          
                          {record.fileName && (
                            <div className="text-xs text-gray-500 mt-2">
                              来源: {record.fileName}
            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
          )}
        </CardContent>
      </Card>
          </TabsContent>
        </Tabs>
    </div>
    </TooltipProvider>
  )
}