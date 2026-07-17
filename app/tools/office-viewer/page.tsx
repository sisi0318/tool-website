"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useTranslations } from "@/hooks/use-translations"
import {
  FILE_SIZE_LIMITS,
  formatFileSizeLimit,
  isFileWithinLimit,
} from "@/lib/file-limits"
import { sanitizeDocumentHtml } from "@/lib/sanitize-document-html"
import {
  Upload,
  FileText,
  FileSpreadsheet,
  Presentation,
  Trash2,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  File,
  AlertCircle,
  Loader2,
  Eye,
} from "lucide-react"
import * as XLSX from "xlsx"
import mammoth from "mammoth"

interface FileInfo {
  name: string
  size: number
  type: "word" | "excel" | "ppt" | "unknown"
}

interface ExcelSheet {
  name: string
  data: string[][]
}

export default function OfficeViewerPage() {
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
  const [pptReady, setPptReady] = useState(false)
  const [pptArrayBuffer, setPptArrayBuffer] = useState<ArrayBuffer | null>(null)
  const pptContainerRef = useRef<HTMLDivElement>(null)
  
  // UI 状态
  const [isDragging, setIsDragging] = useState(false)
  const [zoom, setZoom] = useState(100)
  const [isFullscreen, setIsFullscreen] = useState(false)
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  const previewRef = useRef<HTMLDivElement>(null)
  const uploadRequestRef = useRef(0)

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
    if (ext === "docx") return "word"
    if (["xls", "xlsx", "csv"].includes(ext || "")) return "excel"
    if (ext === "pptx") return "ppt"
    return "unknown"
  }

  // 处理 Word 文件
  const processWord = useCallback(async (file: File) => {
    try {
      const arrayBuffer = await file.arrayBuffer()
      const result = await mammoth.convertToHtml({ arrayBuffer })
      if (result.messages.length > 0) {
        console.warn("Mammoth warnings:", result.messages)
      }
      return sanitizeDocumentHtml(result.value)
    } catch {
      throw new Error(t("wordParseError"))
    }
  }, [t])

  // 处理 Excel 文件
  const processExcel = useCallback(async (file: File) => {
    try {
      const arrayBuffer = await file.arrayBuffer()
      const workbook = XLSX.read(arrayBuffer, { type: "array" })
      
      const sheets: ExcelSheet[] = workbook.SheetNames.map((name) => {
        const worksheet = workbook.Sheets[name]
        const data = XLSX.utils.sheet_to_json<string[]>(worksheet, { header: 1 })
        return { name, data: data as string[][] }
      })
      
      return sheets
    } catch {
      throw new Error(t("excelParseError"))
    }
  }, [t])

  // 处理 PPT 文件 - 只存储 ArrayBuffer，实际渲染由 useEffect 处理
  const processPPT = useCallback(async (file: File) => {
    try {
      const arrayBuffer = await file.arrayBuffer()
      return arrayBuffer
    } catch (err) {
      console.error("PPT parse error:", err)
      throw new Error(t("pptParseError"))
    }
  }, [t])

  // PPT 渲染 - 当容器和数据都准备好时执行
  useEffect(() => {
    let cancelled = false

    const initPptPreview = async () => {
      if (
        isLoading ||
        !pptArrayBuffer ||
        !pptContainerRef.current ||
        fileInfo?.type !== "ppt"
      ) {
        return
      }
      const container = pptContainerRef.current
      
      try {
        // 动态导入 pptx-preview
        const pptxPreview = await import("pptx-preview")
        if (cancelled) return
        
        // 清空容器
        container.innerHTML = ""
        
        // 初始化预览器
        const previewer = pptxPreview.init(container, {
          width: 800,
          height: 600,
        })
        
        // 预览 PPT
        await previewer.preview(pptArrayBuffer)
        if (cancelled) return
        setPptReady(true)
      } catch (err) {
        if (cancelled) return
        console.error("PPT render error:", err)
        setError(t("pptRenderError"))
      }
    }
    
    void initPptPreview()
    return () => {
      cancelled = true
    }
  }, [fileInfo, isLoading, pptArrayBuffer, t])

  const resetPreview = useCallback(() => {
    setFileInfo(null)
    setWordContent("")
    setExcelSheets([])
    setActiveSheet(0)
    setPptReady(false)
    setPptArrayBuffer(null)
    setProgress(0)
    setIsLoading(false)
    if (pptContainerRef.current) {
      pptContainerRef.current.innerHTML = ""
    }
  }, [])

  // 处理文件上传
  const handleFileUpload = useCallback(async (file: File) => {
    const requestId = ++uploadRequestRef.current

    if (!isFileWithinLimit(file, FILE_SIZE_LIMITS.officeDocument)) {
      resetPreview()
      setError(`${t("fileTooLarge")} ${formatFileSizeLimit(FILE_SIZE_LIMITS.officeDocument)}`)
      return
    }

    const type = detectFileType(file)
    
    if (type === "unknown") {
      resetPreview()
      setError(t("unsupportedFormat"))
      return
    }
    
    resetPreview()
    setIsLoading(true)
    setError(null)
    
    const info: FileInfo = {
      name: file.name,
      size: file.size,
      type,
    }
    setFileInfo(info)
    
    try {
      setProgress(30)
      
      switch (type) {
        case "word": {
          const content = await processWord(file)
          if (requestId !== uploadRequestRef.current) return
          setWordContent(content)
          break
        }
        case "excel": {
          const sheets = await processExcel(file)
          if (requestId !== uploadRequestRef.current) return
          setExcelSheets(sheets)
          setActiveSheet(0)
          break
        }
        case "ppt": {
          const arrayBuffer = await processPPT(file)
          if (requestId !== uploadRequestRef.current) return
          setPptArrayBuffer(arrayBuffer)
          break
        }
      }
      
      if (requestId !== uploadRequestRef.current) return
      setProgress(100)
    } catch (err: unknown) {
      if (requestId !== uploadRequestRef.current) return
      setError(err instanceof Error ? err.message : t("fileProcessFailed"))
    } finally {
      if (requestId === uploadRequestRef.current) setIsLoading(false)
    }
  }, [processExcel, processPPT, processWord, resetPreview, t])

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
    uploadRequestRef.current += 1
    resetPreview()
    setIsLoading(false)
    setError(null)
    setZoom(100)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }, [resetPreview])

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
        return <FileText className="h-5 w-5 text-[var(--md-sys-color-primary)]" />
      case "excel":
        return <FileSpreadsheet className="h-5 w-5 text-[var(--md-sys-color-tertiary)]" />
      case "ppt":
        return <Presentation className="h-5 w-5 text-[var(--md-sys-color-secondary)]" />
      default:
        return <File className="h-5 w-5 text-[var(--md-sys-color-on-surface-variant)]" />
    }
  }

  // 获取文件类型颜色
  const getTypeColor = (type: string) => {
    switch (type) {
      case "word":
        return "bg-[var(--md-sys-color-primary-container)] text-[var(--md-sys-color-on-primary-container)]"
      case "excel":
        return "bg-[var(--md-sys-color-tertiary-container)] text-[var(--md-sys-color-on-tertiary-container)]"
      case "ppt":
        return "bg-[var(--md-sys-color-secondary-container)] text-[var(--md-sys-color-on-secondary-container)]"
      default:
        return "bg-[var(--md-sys-color-surface-container-high)] text-[var(--md-sys-color-on-surface)]"
    }
  }

  return (
    <div className="container mx-auto max-w-7xl px-4 py-4 sm:py-6">
      {/* 页面标题 */}
      <div className="text-center mb-6">
        <h1 className="mb-2 flex items-center justify-center gap-2 text-2xl font-bold text-[var(--md-sys-color-on-surface)] sm:text-3xl">
          <Eye className="h-7 w-7 text-[var(--md-sys-color-primary)] sm:h-8 sm:w-8" />
          {t("title")}
        </h1>
        <p className="text-[var(--md-sys-color-on-surface-variant)]">
          {t("description")}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4 lg:gap-6">
        {/* 左侧上传区域 */}
        <div className="lg:col-span-1 space-y-4">
          {/* 文件上传 */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Upload className="h-4 w-4 text-[var(--md-sys-color-primary)]" />
                {t("uploadDocument")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <input
                ref={fileInputRef}
                type="file"
                accept=".docx,.xls,.xlsx,.csv,.pptx"
                onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                aria-label={t("selectDocument")}
                className={`w-full cursor-pointer rounded-xl border-2 border-dashed p-6 text-center transition-colors ${
                  isDragging
                    ? "border-[var(--md-sys-color-primary)] bg-[var(--md-sys-color-primary-container)]"
                    : "border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container-low)] hover:border-[var(--md-sys-color-primary)]"
                }`}
              >
                <Upload className="mx-auto mb-2 h-8 w-8 text-[var(--md-sys-color-on-surface-variant)]" />
                <p className="mb-2 text-sm text-[var(--md-sys-color-on-surface)]">
                  {t("dropPrompt")}
                </p>
                <p className="text-xs text-[var(--md-sys-color-on-surface-variant)]">
                  {t("supportedHint")} {formatFileSizeLimit(FILE_SIZE_LIMITS.officeDocument)}
                </p>
              </button>
            </CardContent>
          </Card>

          {/* 文件信息 */}
          {fileInfo && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  {getFileIcon(fileInfo.type)}
                  {t("fileInformation")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-sm font-medium truncate" title={fileInfo.name}>
                    {fileInfo.name}
                  </p>
                  <p className="text-xs text-[var(--md-sys-color-on-surface-variant)]">
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
                   {t("clearFile")}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* 支持的格式 */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{t("supportedFormats")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <FileText className="h-4 w-4 text-[var(--md-sys-color-primary)]" />
                <span>Word: .docx</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <FileSpreadsheet className="h-4 w-4 text-[var(--md-sys-color-tertiary)]" />
                <span>Excel: .xls, .xlsx, .csv</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Presentation className="h-4 w-4 text-[var(--md-sys-color-secondary)]" />
                <span>PowerPoint: .pptx</span>
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
                <div className="flex flex-wrap items-center justify-between gap-3">
                  {/* 缩放控制 */}
                  <div className="flex flex-wrap items-center gap-1 sm:gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setZoom(Math.max(50, zoom - 10))}
                      aria-label={t("zoomOut")}
                    >
                      <ZoomOut className="h-4 w-4" />
                    </Button>
                    <span className="text-sm w-16 text-center">{zoom}%</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setZoom(Math.min(200, zoom + 10))}
                      aria-label={t("zoomIn")}
                    >
                      <ZoomIn className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setZoom(100)}
                    >
                      {t("reset")}
                    </Button>
                  </div>

                  {/* Excel 工作表切换 */}
                  {fileInfo.type === "excel" && excelSheets.length > 1 && (
                    <div className="flex min-w-0 flex-1 items-center gap-2 sm:flex-none">
                      <span className="shrink-0 text-sm text-[var(--md-sys-color-on-surface-variant)]">{t("worksheet")}:</span>
                      <Select
                        value={activeSheet.toString()}
                        onValueChange={(v) => setActiveSheet(parseInt(v))}
                      >
                        <SelectTrigger className="h-8 min-w-0 flex-1 sm:w-[180px]">
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
                    aria-label={isFullscreen ? t("exitFullscreen") : t("enterFullscreen")}
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
          <Card className={isFullscreen ? "h-full" : "min-h-[420px] sm:min-h-[600px]"}>
            <CardContent 
              className={`scrollbar-m3 bg-[var(--md-sys-color-surface-container-lowest)] p-2 sm:p-4 ${isFullscreen ? "h-screen overflow-auto" : "max-h-[65vh] overflow-auto sm:max-h-[600px]"}`}
              ref={previewRef}
            >
              {/* 加载状态 */}
              {isLoading && (
                <div className="flex min-h-[360px] flex-col items-center justify-center sm:h-[500px]">
                  <Loader2 className="mb-4 h-12 w-12 animate-spin text-[var(--md-sys-color-primary)]" />
                  <p className="mb-4 text-[var(--md-sys-color-on-surface-variant)]">{t("loadingDocument")}</p>
                  <Progress value={progress} className="w-full max-w-64" />
                </div>
              )}

              {/* 错误状态 */}
              {error && !isLoading && (
                <div className="flex min-h-[360px] flex-col items-center justify-center text-center sm:h-[500px]">
                  <AlertCircle className="mb-4 h-12 w-12 text-[var(--md-sys-color-error)]" />
                  <p className="mb-2 text-[var(--md-sys-color-error)]">{error}</p>
                  <Button variant="outline" onClick={clearFile}>
                    {t("uploadAgain")}
                  </Button>
                </div>
              )}

              {/* 空状态 */}
              {!fileInfo && !isLoading && !error && (
                <div className="flex min-h-[360px] flex-col items-center justify-center text-[var(--md-sys-color-on-surface-variant)] sm:h-[500px]">
                  <File className="h-16 w-16 mb-4" />
                  <p>{t("emptyState")}</p>
                </div>
              )}

              {/* Word 预览 */}
              {fileInfo?.type === "word" && wordContent && !isLoading && !error && (
                <div
                  className="prose prose-sm dark:prose-invert max-w-none overflow-auto rounded-lg bg-[var(--md-sys-color-surface)] p-4 text-[var(--md-sys-color-on-surface)]"
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
                  className="overflow-auto rounded-lg bg-[var(--md-sys-color-surface)]"
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
                    <table className="min-w-full border-collapse bg-[var(--md-sys-color-surface)]">
                      <tbody>
                        {excelSheets[activeSheet]?.data.map((row, rowIndex) => (
                          <tr key={rowIndex} className={rowIndex === 0 ? "bg-[var(--md-sys-color-surface-container-high)] font-semibold" : "bg-[var(--md-sys-color-surface)]"}>
                            {/* 行号 */}
                            <td className="w-10 border border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container-low)] px-2 py-1 text-center text-xs text-[var(--md-sys-color-on-surface-variant)]">
                              {rowIndex + 1}
                            </td>
                            {row.map((cell, cellIndex) => (
                              <td
                                key={cellIndex}
                                className="whitespace-nowrap border border-[var(--md-sys-color-outline-variant)] px-3 py-2 text-sm text-[var(--md-sys-color-on-surface)]"
                              >
                                {cell?.toString() || ""}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {excelSheets[activeSheet]?.data.length === 0 && (
                      <div className="py-8 text-center text-[var(--md-sys-color-on-surface-variant)]">
                        {t("emptyWorksheet")}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* PPT 预览 */}
              {fileInfo?.type === "ppt" && !isLoading && !error && (
                <div className="relative min-h-[320px] overflow-auto rounded-lg bg-[var(--md-sys-color-surface-container-low)]">
                  {!pptReady && (
                    <div className="absolute inset-0 z-10 flex min-h-[320px] flex-col items-center justify-center gap-3 bg-[var(--md-sys-color-surface-container-low)]">
                      <Loader2 className="h-10 w-10 animate-spin text-[var(--md-sys-color-primary)]" />
                      <p className="text-sm text-[var(--md-sys-color-on-surface-variant)]">
                        {t("renderingPresentation")}
                      </p>
                    </div>
                  )}
                  <div
                    ref={pptContainerRef}
                    className="min-w-max p-2 sm:p-4"
                    style={{
                      transform: `scale(${zoom / 100})`,
                      transformOrigin: "top left",
                    }}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Excel 统计信息 */}
          {fileInfo?.type === "excel" && excelSheets.length > 0 && !isLoading && !error && (
            <Card>
              <CardContent className="py-3">
                <div className="flex flex-wrap gap-4 text-sm text-[var(--md-sys-color-on-surface-variant)]">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{t("worksheetCount")}</Badge>
                    <span>{excelSheets.length}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{t("currentWorksheet")}</Badge>
                    <span>{excelSheets[activeSheet]?.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{t("rowCount")}</Badge>
                    <span>{excelSheets[activeSheet]?.data.length || 0}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{t("columnCount")}</Badge>
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
