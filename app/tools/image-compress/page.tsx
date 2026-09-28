"use client"

import { useState, useRef, useCallback, useEffect, useMemo } from "react"
import { useIncomingInput } from "@/hooks/use-incoming-input"
import { extensionForMime } from "@/lib/output-name"
import { useToolPref } from "@/hooks/use-tool-pref"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { FileDropZone, matchesAccept } from "@/components/tools/file-drop-zone"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { useObjectUrlRegistry } from "@/hooks/use-object-url"
import { useToast } from "@/hooks/use-toast"
import { usePasteFiles } from "@/hooks/use-paste-files"
import { createClientId } from "@/lib/client-id"
import { downloadBlob, triggerDownload } from "@/lib/object-url"
import { batchErrorCode, imageBatchZip, runImageBatch } from "@/lib/image-batch"
import { DEFAULT_BATCH_OPTIONS, IMAGE_BATCH_LIMITS, uniqueImageBase, type BatchImageJob, type ImageBatchOptions } from "@/lib/image-batch-shared"
import { OCR_LIMITS } from "@/lib/ocr-shared"
import {
  ImageIcon, Download, X, Trash2,
  Settings, Zap, FileImage, CheckCircle2,
  Maximize2, Upload, FileArchive, Loader2
} from "lucide-react"
import { Slider } from "@/components/ui/slider"
import { useTranslations } from "@/hooks/use-translations"
import { zhImageBatch } from "@/lib/translations/zh-namespaces/imageBatch"
import { zhImageCompress } from "@/lib/translations/zh-namespaces/imageCompress"
import { zhOcrTools } from "@/lib/translations/zh-namespaces/ocrTools"

/**
 * 一张图片与它当前的压缩结果。压缩在批处理的 Worker 管线里逐张进行：
 * 以前在主线程解码、编码，没有数量和大小上限，调一次质量就把所有图片同步重算一遍。
 */
interface CompressJob {
  id: string
  file: File
  /** 输出文件名的主干（不含 _compressed 与扩展名），在队列内唯一 */
  base: string
  originalUrl: string
  status: "ready" | "running" | "done" | "error"
  /** 重算期间保留上一次的结果做预览，出结果或出错时再替换 */
  output: File | null
  outputUrl: string | null
  width: number | null
  height: number | null
  newWidth: number | null
  newHeight: number | null
  error: string | null
  /** 当前结果用的质量 */
  quality: number
}

const ACCEPT = "image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
const MAX_SIDE = 32768

export default function ImageCompressPage() {
  const { toast } = useToast()
  const t = useTranslations("imageCompress", zhImageCompress)
  const bt = useTranslations("imageBatch", zhImageBatch)
  const ot = useTranslations("ocrTools", zhOcrTools)

  // 状态管理
  const [images, setImages] = useState<CompressJob[]>([])
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null)
  const [progress, setProgress] = useState<{ current: number; total: number; name: string } | null>(null)
  const [zipping, setZipping] = useState(false)

  // 压缩设置
  const [quality, setQuality] = useToolPref("image-compress", "quality", 80, (value) => Number.isInteger(value) && value >= 1 && value <= 100)
  const [outputFormat, setOutputFormat] = useToolPref<string>("image-compress", "outputFormat", "original", (value) => ["original", "jpeg", "webp", "png"].includes(value))
  const [maxWidth, setMaxWidth] = useToolPref<string>("image-compress", "maxWidth", "", (value) => /^\d{0,5}$/.test(value))
  const [maxHeight, setMaxHeight] = useToolPref<string>("image-compress", "maxHeight", "", (value) => /^\d{0,5}$/.test(value))

  // 图片预览弹窗
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const [previewTitle, setPreviewTitle] = useState<string>("")

  const imagesRef = useRef<CompressJob[]>([])
  const selectedRef = useRef<string | null>(null)
  const active = useRef<AbortController | null>(null)
  const version = useRef(0)
  const objectUrls = useObjectUrlRegistry()
  const running = progress !== null

  // 状态更新同时写进 ref，Worker 回调和对象 URL 的创建、释放只执行一次
  const updateImages = useCallback((fn: (list: CompressJob[]) => CompressJob[]) => {
    imagesRef.current = fn(imagesRef.current)
    setImages(imagesRef.current)
  }, [])

  useEffect(() => { selectedRef.current = selectedImageId }, [selectedImageId])
  useEffect(() => () => { version.current++; active.current?.abort() }, [])

  const options = useMemo<ImageBatchOptions>(() => ({
    ...DEFAULT_BATCH_OPTIONS,
    mode: "images",
    format: outputFormat === "original" ? "auto" : outputFormat as ImageBatchOptions["format"],
    quality: Math.min(100, Math.max(10, quality)),
    maxWidth: Math.min(MAX_SIDE, Number(maxWidth) || 0),
    maxHeight: Math.min(MAX_SIDE, Number(maxHeight) || 0),
  }), [quality, outputFormat, maxWidth, maxHeight])

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

  // 批处理管线的错误码（batch:… / ocr:…）转成可读文案
  const describeError = useCallback((code: string): string => {
    const [scope, key] = code.split(":")
    return scope === "ocr" ? ot(`error_${key}`) : bt(`error_${key || "convert"}`)
  }, [bt, ot])

  // 结果的实际格式（浏览器编不了 WebP 时“自动”会退回 PNG），以输出文件为准
  const formatName = (file: File | null) => (file ? extensionForMime(file.type, "img") : "-")

  /**
   * 压缩指定的图片。新一轮开始就取消上一轮：拖动滑块时只算最后的参数；
   * 上一轮还没轮到的图片一起并进来，当前选中的排在最前，预览最先更新。
   */
  const runJobs = useCallback(async (ids: string[], settings: ImageBatchOptions) => {
    // 要被这一轮取代的上一轮里还没算完的图片；没有在算的就是用户取消过的，“继续压缩”时 ids 为空，照样都带上
    const pending = active.current || ids.length === 0
      ? imagesRef.current.filter((image) => image.status === "ready" || image.status === "running").map((image) => image.id)
      : []
    const target = new Set([...ids, ...pending])
    const list: BatchImageJob[] = imagesRef.current
      .filter((image) => target.has(image.id))
      .sort((a, b) => Number(b.id === selectedRef.current) - Number(a.id === selectedRef.current))
      .map(({ id, file, base }) => ({ id, file, base: `${base}_compressed`, status: "ready" }))
    if (list.length === 0) return

    active.current?.abort()
    const ticket = ++version.current
    const controller = new AbortController()
    active.current = controller
    const kept = imagesRef.current.filter((image) => !target.has(image.id)).reduce((sum, image) => sum + (image.output?.size ?? 0), 0)
    updateImages((list) => list.map((image) => (target.has(image.id) ? { ...image, status: "ready", error: null } : image)))
    setProgress({ current: 0, total: list.length, name: "" })

    try {
      await runImageBatch(list, settings, {
        signal: controller.signal,
        onProgress: (value) => { if (ticket === version.current) setProgress(value) },
        onUpdate: (jobId, update) => {
          if (ticket !== version.current) return
          updateImages((all) => all.map((image) => {
            if (image.id !== jobId) return image
            if (update.status === "done" && update.result) {
              objectUrls.revoke(image.outputUrl)
              const output = update.result.files[0]
              return {
                ...image,
                status: "done",
                error: null,
                output,
                outputUrl: objectUrls.create(output),
                width: update.result.sourceWidth ?? image.width,
                height: update.result.sourceHeight ?? image.height,
                newWidth: update.result.width,
                newHeight: update.result.height,
                quality: settings.quality,
              }
            }
            if (update.status === "error") {
              objectUrls.revoke(image.outputUrl)
              return { ...image, status: "error", error: update.error ?? "batch:convert", output: null, outputUrl: null, newWidth: null, newHeight: null }
            }
            return { ...image, status: update.status ?? image.status }
          }))
        },
      }, undefined, kept)
    } catch (error) {
      if (ticket === version.current && !controller.signal.aborted) {
        toast({ title: t("compressFailedTitle"), description: describeError(batchErrorCode(error)), variant: "destructive" })
      }
    } finally {
      if (ticket === version.current) {
        active.current = null
        setProgress(null)
      }
    }
  }, [describeError, objectUrls, t, toast, updateImages])

  // 取消：没算完的图片清掉旧参数的结果，标成待处理，点“继续压缩”再算
  const cancel = () => {
    version.current++
    active.current?.abort()
    active.current = null
    setProgress(null)
    updateImages((list) => list.map((image) => {
      if (image.status !== "ready" && image.status !== "running") return image
      objectUrls.revoke(image.outputUrl)
      return { ...image, status: "ready", output: null, outputUrl: null, newWidth: null, newHeight: null }
    }))
    toast({ title: bt("cancelled") })
  }

  // 选择、拖放、粘贴都走这里；不支持的格式与超出上限的文件跳过并提示
  const addFiles = (files: File[]) => {
    if (files.length === 0) return
    const validFiles = files.filter((file) => matchesAccept(file, ACCEPT))
    if (validFiles.length === 0) {
      toast({
        title: t("unsupportedFormatTitle"),
        description: t("unsupportedFormatDescription"),
        variant: "destructive"
      })
      return
    }

    const used = new Set(imagesRef.current.map((image) => image.base.toLowerCase()))
    let total = imagesRef.current.reduce((sum, image) => sum + image.file.size, 0)
    let overLimit = 0
    const next: CompressJob[] = []
    for (const file of validFiles) {
      if (imagesRef.current.length + next.length >= IMAGE_BATCH_LIMITS.files || total + file.size > IMAGE_BATCH_LIMITS.inputBytes || !file.size || file.size > OCR_LIMITS.fileBytes) {
        overLimit += 1
        continue
      }
      total += file.size
      next.push({
        id: createClientId("compress"),
        file,
        base: uniqueImageBase(file.name, used),
        originalUrl: objectUrls.create(file),
        status: "ready",
        output: null,
        outputUrl: null,
        width: null,
        height: null,
        newWidth: null,
        newHeight: null,
        error: null,
        quality: options.quality,
      })
    }

    const skipped = [
      validFiles.length !== files.length ? t("filesSkippedDescription").replace("{count}", String(files.length - validFiles.length)) : "",
      overLimit ? bt("skipped") : "",
    ].filter(Boolean)
    if (skipped.length) toast({ title: t("filesSkippedTitle"), description: skipped.join(" ") })
    if (next.length === 0) return

    updateImages((list) => [...list, ...next])
    setSelectedImageId(next[0].id)
    selectedRef.current = next[0].id
    void runJobs(next.map((image) => image.id), options)
  }

  usePasteFiles(addFiles, !zipping)
  // 其它工具“在工具中打开”发来的图片
  useIncomingInput((transfer) => { if (transfer.value instanceof File) addFiles([transfer.value]) })

  // 设置变化时重新压缩全部图片；防抖之外，新一轮会取消还在算的上一轮。
  // 只跟着 options 走：runJobs 换了引用不能把排好的这次重算清掉
  const runJobsRef = useRef(runJobs)
  useEffect(() => { runJobsRef.current = runJobs }, [runJobs])
  const appliedOptions = useRef(options)
  useEffect(() => {
    if (appliedOptions.current === options) return
    appliedOptions.current = options
    if (imagesRef.current.length === 0) return
    const timer = window.setTimeout(() => void runJobsRef.current(imagesRef.current.map((image) => image.id), options), 300)
    return () => window.clearTimeout(timer)
  }, [options])

  // 下载压缩后的图片
  const downloadImage = (image: CompressJob) => {
    if (!image.output || !image.outputUrl) return
    triggerDownload(image.outputUrl, image.output.name)
  }

  // 全部打成一个 ZIP：以前是逐张触发下载，浏览器常会拦下后面的
  const downloadAll = async () => {
    const done = imagesRef.current.filter((image) => image.status === "done" && image.output)
    if (done.length === 0 || zipping) return
    setZipping(true)
    try {
      const jobs: BatchImageJob[] = done.map((image) => ({
        id: image.id,
        file: image.file,
        base: image.base,
        status: "done",
        result: { files: [image.output!], width: image.newWidth ?? 0, height: image.newHeight ?? 0, animated: false },
      }))
      downloadBlob(await imageBatchZip(jobs, options), "compressed-images.zip")
    } catch (error) {
      toast({ title: t("compressFailedTitle"), description: describeError(batchErrorCode(error)), variant: "destructive" })
    } finally {
      setZipping(false)
    }
  }

  // 删除图片
  const removeImage = (id: string) => {
    const image = imagesRef.current.find((item) => item.id === id)
    if (!image) return
    objectUrls.revoke(image.originalUrl)
    objectUrls.revoke(image.outputUrl)
    if (previewImage === image.originalUrl || previewImage === image.outputUrl) setPreviewImage(null)
    updateImages((list) => list.filter((item) => item.id !== id))
    if (selectedImageId === id) setSelectedImageId(imagesRef.current[0]?.id ?? null)
  }

  // 清空所有图片
  const clearAllImages = () => {
    version.current++
    active.current?.abort()
    active.current = null
    setProgress(null)
    imagesRef.current.forEach((image) => {
      objectUrls.revoke(image.originalUrl)
      objectUrls.revoke(image.outputUrl)
    })
    updateImages(() => [])
    setSelectedImageId(null)
    setPreviewImage(null)
  }

  // 选中的图片
  const selectedImage = images.find(img => img.id === selectedImageId)
  const readyCount = images.filter((image) => image.status === "ready").length
  const doneCount = images.filter((image) => image.status === "done").length
  const isPending = (image: CompressJob) => image.status === "running" || (running && image.status === "ready")

  // 计算总体统计
  const totalOriginalSize = images.reduce((sum, img) => sum + img.file.size, 0)
  const totalCompressedSize = images.reduce((sum, img) => sum + (img.output?.size || 0), 0)

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
              {/* 以前是只能用鼠标点的 div，键盘无法选择文件 */}
              <FileDropZone
                onFiles={addFiles}
                accept={ACCEPT}
                multiple
                disabled={zipping}
                icon={<ImageIcon className="mx-auto mb-3 h-8 w-8 text-[var(--md-sys-color-on-surface-variant)]" aria-hidden="true" />}
                title={t("dropHint")}
                hint={t("supportedFormats")}
              />
              <p className="mt-2 text-xs leading-5 text-[var(--md-sys-color-on-surface-variant)]">{bt("limits")}</p>

              {progress && (
                <div role="status" className="mt-4 space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />
                    <span className="min-w-0 flex-1 break-all">
                      {bt("phase_run")}{progress.name ? ` · ${progress.current} / ${progress.total} · ${progress.name}` : ""}
                    </span>
                    <Button variant="outline" size="sm" onClick={cancel}>{bt("cancel")}</Button>
                  </div>
                  <progress aria-label={bt("progress")} className="h-2 w-full accent-[var(--md-sys-color-primary)]" max={progress.total} value={Math.max(0, progress.current - 1)} />
                </div>
              )}
              {!running && readyCount > 0 && (
                <Button variant="outline" size="sm" className="mt-4 w-full" onClick={() => void runJobs([], options)}>
                  <Zap className="h-4 w-4 mr-1" />
                  {t("resume").replace("{count}", String(readyCount))}
                </Button>
              )}

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
                <Slider
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
                      min={1}
                      max={MAX_SIDE}
                      placeholder={t("maxWidth")}
                      aria-label={t("maxWidth")}
                      value={maxWidth}
                      onChange={(e) => setMaxWidth(e.target.value)}
                    />
                  </div>
                  <div>
                    <Input
                      type="number"
                      min={1}
                      max={MAX_SIDE}
                      placeholder={t("maxHeight")}
                      aria-label={t("maxHeight")}
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
                    onClick={() => void downloadAll()}
                    disabled={doneCount === 0 || zipping}
                  >
                    {zipping ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileArchive className="h-4 w-4 mr-2" />}
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
                          src={image.outputUrl || image.originalUrl}
                          alt={image.file.name}
                          className="w-full h-full object-contain"
                        />
                        {isPending(image) && (
                          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                          </div>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={`${bt("remove")} ${image.file.name}`}
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
                            {formatFileSize(image.file.size)}
                          </span>
                          {image.output && (
                            <>
                              <span className="text-[var(--md-sys-color-on-surface-variant)]">→</span>
                              <span className={`font-medium ${image.output.size <= image.file.size ? 'text-[var(--md-sys-color-primary)]' : 'text-[var(--md-sys-color-error)]'}`}>
                                {formatFileSize(image.output.size)}
                              </span>
                              <Badge
                                variant="secondary"
                                className={`text-xs ${image.output.size > image.file.size ? 'bg-[var(--md-sys-color-error-container)] text-[var(--md-sys-color-on-error-container)]' : ''}`}
                              >
                                {getCompressionRatio(image.file.size, image.output.size)}
                              </Badge>
                            </>
                          )}
                          {!image.output && image.status === "ready" && !running && (
                            <span className="text-[var(--md-sys-color-on-surface-variant)]">{bt("status_ready")}</span>
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
                              void runJobs([image.id], options)
                            }}
                            disabled={isPending(image)}
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
                            disabled={!image.output || isPending(image)}
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
                              {formatFileSize(selectedImage.file.size)}
                            </p>
                          </div>
                          <div className="space-y-2">
                            <p className="text-xs text-center text-[var(--md-sys-color-on-surface-variant)]">{t("compressed")}</p>
                            <div className="relative aspect-square rounded-[var(--md-sys-shape-corner-medium)] overflow-hidden bg-[var(--md-sys-color-surface-variant)] group">
                              {selectedImage.outputUrl ? (
                                <>
                                  <img
                                    src={selectedImage.outputUrl}
                                    alt={t("compressed")}
                                    className="w-full h-full object-contain"
                                  />
                                  <Button
                                    variant="secondary"
                                    size="sm"
                                    aria-label={t("previewCompressedAria")}
                                    className="absolute right-2 top-2 h-8 w-8 p-0 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
                                    onClick={() => {
                                      setPreviewImage(selectedImage.outputUrl)
                                      setPreviewTitle(`${t("compressed")} - ${selectedImage.file.name}`)
                                    }}
                                  >
                                    <Maximize2 className="h-4 w-4" />
                                  </Button>
                                </>
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <span className="text-xs text-[var(--md-sys-color-on-surface-variant)]">
                                    {selectedImage.status === "error" ? "-" : isPending(selectedImage) ? t("processing") : bt("status_ready")}
                                  </span>
                                </div>
                              )}
                            </div>
                            <p className="text-xs text-center text-[var(--md-sys-color-primary)]">
                              {selectedImage.output ? formatFileSize(selectedImage.output.size) : '-'}
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
                            <span className="text-[var(--md-sys-color-on-surface)]">{selectedImage.width && selectedImage.height ? `${selectedImage.width} × ${selectedImage.height}` : "-"}</span>
                          </div>
                          {selectedImage.newWidth && selectedImage.newHeight && (
                            <div className="flex justify-between">
                              <span className="text-[var(--md-sys-color-on-surface-variant)]">{t("compressedDimensions")}</span>
                              <span className="text-[var(--md-sys-color-on-surface)]">{selectedImage.newWidth} × {selectedImage.newHeight}</span>
                            </div>
                          )}
                          <div className="flex justify-between">
                            <span className="text-[var(--md-sys-color-on-surface-variant)]">{t("originalSize")}</span>
                            <span className="text-[var(--md-sys-color-on-surface)]">{formatFileSize(selectedImage.file.size)}</span>
                          </div>
                          {selectedImage.output && (
                            <>
                              <div className="flex justify-between">
                                <span className="text-[var(--md-sys-color-on-surface-variant)]">{t("compressedSize")}</span>
                                <span className="text-[var(--md-sys-color-primary)]">{formatFileSize(selectedImage.output.size)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-[var(--md-sys-color-on-surface-variant)]">
                                  {selectedImage.output.size <= selectedImage.file.size ? t("savedSpace") : t("increasedSize")}
                                </span>
                                <span className={`font-medium ${selectedImage.output.size <= selectedImage.file.size ? 'text-[var(--md-sys-color-primary)]' : 'text-[var(--md-sys-color-error)]'}`}>
                                  {getCompressionRatio(selectedImage.file.size, selectedImage.output.size)}
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
                              {formatName(selectedImage.output)}
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
