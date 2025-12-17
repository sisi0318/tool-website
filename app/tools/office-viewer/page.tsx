"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useTranslations } from "@/hooks/use-translations"
import {
  Upload,
  FileText,
  FileSpreadsheet,
  Presentation,
  Download,
  Trash2,
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  File,
  AlertCircle,
  Loader2,
  Eye,
  X,
} from "lucide-react"
import * as XLSX from "xlsx"
import mammoth from "mammoth"

interface OfficeViewerProps {
  params?: Record<string, string>
}

interface FileInfo {
  name: string
  size: number
  type: "word" | "excel" | "ppt" | "unknown"
  file: File
}

interface ExcelSheet {
  name: string
  data: string[][]
}

export default function OfficeViewerPage({ params }: OfficeViewerProps) {
  const t = useTranslations("officeViewer")
  
  // 文件状态
  const [fileInfo, setFileInfo] = useState<FileInfo | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  
  // Word 预览状态
  const [wordContent, setWordContent] = useState<string>("")
  
  // Excel 预览状态
  const [excelSheets, setExcelSheets] = useState<ExcelSheet[]>([])
  const [activeSheet, setActiveSheet] = useState(0)
  
  // PPT 预览状态
  const [pptSlides, setPptSlides] = useState<string[]>([])
  const [currentSlide, setCurrentSlide] = useState(0)
  
  // UI 状态
  const [isDragging, setIsDragging] = useState(false)
  const [zoom, setZoom] = useState(100)
  const [isFullscreen, setIsFullscreen] = useState(false)
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  const previewRef = useRef<HTMLDivElement>(null)

  // 格式化文件大小
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 B"
    const k = 1024
    const sizes = ["B", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
  }

  // 检测文件类型
  const detectFileType = (file: File): "word" | "excel" | "ppt" | "unknown" => {
    const ext = file.name.split(".").pop()?.toLowerCase()
    if (["doc", "docx"].includes(ext || "")) return "word"
    if (["xls", "xlsx", "csv"].includes(ext || "")) return "excel"
    if (["ppt", "pptx"].includes(ext || "")) return "ppt"
    return "unknown"
  }

  // 处理 Word 文件
  const processWord = async (file: File) => {
    try {
      const arrayBuffer = await file.arrayBuffer()
      const result = await mammoth.convertToHtml({ arrayBuffer })
      setWordContent(result.value)
      if (result.messages.length > 0) {
        console.warn("Mammoth warnings:", result.messages)
      }
    } catch (err) {
      throw new Error("Word 文件解析失败，请确保文件格式正确")
    }
  }

  // 处理 Excel 文件
  const processExcel = async (file: File) => {
    try {
      const arrayBuffer = await file.arrayBuffer()
      const workbook = XLSX.read(arrayBuffer, { type: "array" })
      
      const sheets: ExcelSheet[] = workbook.SheetNames.map((name) => {
        const worksheet = workbook.Sheets[name]
        const data = XLSX.utils.sheet_to_json<string[]>(worksheet, { header: 1 })
        return { name, data: data as string[][] }
      })
      
      setExcelSheets(sheets)
      setActiveSheet(0)
    } catch (err) {
      throw new Error("Excel 文件解析失败，请确保文件格式正确")
    }
  }

  // 处理 PPT 文件 - 暂不支持
  const processPPT = async (file: File) => {
    setPptSlides([])
    setError("暂不支持 PPT 文件预览")
  }


  // 处理文件上传
  const handleFileUpload = useCallback(async (file: File) => {
    const type = detectFileType(file)
    
    if (type === "unknown") {
      setError("不支持的文件格式，请上传 Word 或 Excel 文件")
      return
    }
    
    setIsLoading(true)
    setError(null)
    setProgress(0)
    setWordContent("")
    setExcelSheets([])
    setPptSlides([])
    
    const info: FileInfo = {
      name: file.name,
      size: file.size,
      type,
      file,
    }
    setFileInfo(info)
    
    try {
      setProgress(30)
      
      switch (type) {
        case "word":
          await processWord(file)
          break
        case "excel":
          await processExcel(file)
          break
        case "ppt":
          await processPPT(file)
          break
      }
      
      setProgress(100)
    } catch (err: any) {
      setError(err.message || "文件处理失败")
    } finally {
      setIsLoading(false)
    }
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

  // 清除文件
  const clearFile = useCallback(() => {
    setFileInfo(null)
    setWordContent("")
    setExcelSheets([])
    setPptSlides([])
    setError(null)
    setZoom(100)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }, [])

  // 全屏切换
  const toggleFullscreen = useCallback(() => {
    if (!previewRef.current) return
    
    if (!isFullscreen) {
      previewRef.current.requestFullscreen?.()
    } else {
      document.exitFullscreen?.()
    }
  }, [isFullscreen])

  // 监听全屏变化
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }
    document.addEventListener("fullscreenchange", handleFullscreenChange)
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange)
  }, [])

  // 获取文件图标
  const getFileIcon = (type: string) => {
    switch (type) {
      case "word":
        return <FileText className="h-5 w-5 text-blue-600" />
      case "excel":
        return <FileSpreadsheet className="h-5 w-5 text-green-600" />
      case "ppt":
        return <Presentation className="h-5 w-5 text-orange-600" />
      default:
        return <File className="h-5 w-5 text-gray-600" />
    }
  }

  // 获取文件类型颜色
  const getTypeColor = (type: string) => {
    switch (type) {
      case "word":
        return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
      case "excel":
        return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
      case "ppt":
        return "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
      default:
        return "bg-gray-100 text-gray-700"
    }
  }

  return (
    <div className="container mx-auto px-4 py-4 max-w-7xl">
      {/* 页面标题 */}
      <div className="text-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-200 mb-2 flex items-center justify-center gap-2">
          <Eye className="h-8 w-8 text-blue-600" />
          Office 文档预览
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          在线预览 Word、Excel 文档
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* 左侧上传区域 */}
        <div className="lg:col-span-1 space-y-4">
          {/* 文件上传 */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Upload className="h-4 w-4 text-blue-600" />
                上传文档
              </CardTitle>
            </CardHeader>
            <CardContent>
              <input
                ref={fileInputRef}
                type="file"
                accept=".doc,.docx,.xls,.xlsx,.csv"
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
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  点击或拖放文件
                </p>
                <p className="text-xs text-gray-400">
                  支持 .doc, .docx, .xls, .xlsx, .csv
                </p>
              </div>
            </CardContent>
          </Card>

          {/* 文件信息 */}
          {fileInfo && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  {getFileIcon(fileInfo.type)}
                  文件信息
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-sm font-medium truncate" title={fileInfo.name}>
                    {fileInfo.name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {formatFileSize(fileInfo.size)}
                  </p>
                </div>
                <Badge className={getTypeColor(fileInfo.type)}>
                  {fileInfo.type.toUpperCase()}
                </Badge>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearFile}
                  className="w-full"
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  清除文件
                </Button>
              </CardContent>
            </Card>
          )}

          {/* 支持的格式 */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">支持的格式</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <FileText className="h-4 w-4 text-blue-600" />
                <span>Word: .doc, .docx</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <FileSpreadsheet className="h-4 w-4 text-green-600" />
                <span>Excel: .xls, .xlsx, .csv</span>
              </div>
            </CardContent>
          </Card>
        </div>


        {/* 右侧预览区域 */}
        <div className="lg:col-span-3 space-y-4">
          {/* 工具栏 */}
          {fileInfo && !isLoading && !error && (
            <Card>
              <CardContent className="py-3">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  {/* 缩放控制 */}
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setZoom(Math.max(50, zoom - 10))}
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

                  {/* Excel 工作表切换 */}
                  {fileInfo.type === "excel" && excelSheets.length > 1 && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-500">工作表:</span>
                      <Select
                        value={activeSheet.toString()}
                        onValueChange={(v) => setActiveSheet(parseInt(v))}
                      >
                        <SelectTrigger className="w-[180px] h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {excelSheets.map((sheet, index) => (
                            <SelectItem key={index} value={index.toString()}>
                              {sheet.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* 全屏按钮 */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={toggleFullscreen}
                  >
                    {isFullscreen ? (
                      <Minimize2 className="h-4 w-4" />
                    ) : (
                      <Maximize2 className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 预览区域 */}
          <Card className={isFullscreen ? "h-full" : "min-h-[600px]"}>
            <CardContent 
              className={`p-4 bg-white dark:bg-gray-900 ${isFullscreen ? "h-screen overflow-auto" : ""}`} 
              ref={previewRef}
            >
              {/* 加载状态 */}
              {isLoading && (
                <div className="flex flex-col items-center justify-center h-[500px]">
                  <Loader2 className="h-12 w-12 animate-spin text-blue-600 mb-4" />
                  <p className="text-gray-600 dark:text-gray-400 mb-4">正在解析文档...</p>
                  <Progress value={progress} className="w-64" />
                </div>
              )}

              {/* 错误状态 */}
              {error && !isLoading && (
                <div className="flex flex-col items-center justify-center h-[500px] text-center">
                  <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
                  <p className="text-red-600 dark:text-red-400 mb-2">{error}</p>
                  <Button variant="outline" onClick={clearFile}>
                    重新上传
                  </Button>
                </div>
              )}

              {/* 空状态 */}
              {!fileInfo && !isLoading && (
                <div className="flex flex-col items-center justify-center h-[500px] text-gray-400">
                  <File className="h-16 w-16 mb-4" />
                  <p>请上传文档开始预览</p>
                </div>
              )}

              {/* Word 预览 */}
              {fileInfo?.type === "word" && wordContent && !isLoading && !error && (
                <div
                  className="prose prose-sm dark:prose-invert max-w-none overflow-auto bg-white dark:bg-gray-900 p-4 rounded-lg text-gray-900 dark:text-gray-100"
                  style={{
                    transform: `scale(${zoom / 100})`,
                    transformOrigin: "top left",
                    maxHeight: isFullscreen ? "calc(100vh - 2rem)" : "600px",
                  }}
                  dangerouslySetInnerHTML={{ __html: wordContent }}
                />
              )}

              {/* Excel 预览 */}
              {fileInfo?.type === "excel" && excelSheets.length > 0 && !isLoading && !error && (
                <div
                  className="overflow-auto bg-white dark:bg-gray-900 rounded-lg"
                  style={{
                    maxHeight: isFullscreen ? "calc(100vh - 2rem)" : "600px",
                  }}
                >
                  <div
                    style={{
                      transform: `scale(${zoom / 100})`,
                      transformOrigin: "top left",
                    }}
                  >
                    <table className="min-w-full border-collapse bg-white dark:bg-gray-900">
                      <tbody>
                        {excelSheets[activeSheet]?.data.map((row, rowIndex) => (
                          <tr key={rowIndex} className={rowIndex === 0 ? "bg-gray-100 dark:bg-gray-800 font-semibold" : "bg-white dark:bg-gray-900"}>
                            {/* 行号 */}
                            <td className="border border-gray-300 dark:border-gray-600 px-2 py-1 text-xs text-gray-400 bg-gray-50 dark:bg-gray-800 w-10 text-center">
                              {rowIndex + 1}
                            </td>
                            {row.map((cell, cellIndex) => (
                              <td
                                key={cellIndex}
                                className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm whitespace-nowrap text-gray-900 dark:text-gray-100"
                              >
                                {cell?.toString() || ""}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {excelSheets[activeSheet]?.data.length === 0 && (
                      <div className="text-center py-8 text-gray-400">
                        此工作表为空
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Excel 统计信息 */}
          {fileInfo?.type === "excel" && excelSheets.length > 0 && !isLoading && !error && (
            <Card>
              <CardContent className="py-3">
                <div className="flex flex-wrap gap-4 text-sm text-gray-600 dark:text-gray-400">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">工作表数量</Badge>
                    <span>{excelSheets.length}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">当前工作表</Badge>
                    <span>{excelSheets[activeSheet]?.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">行数</Badge>
                    <span>{excelSheets[activeSheet]?.data.length || 0}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">列数</Badge>
                    <span>{Math.max(...(excelSheets[activeSheet]?.data.map(r => r.length) || [0]))}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
