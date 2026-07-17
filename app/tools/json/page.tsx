"use client"

import { copyTextToClipboard as writeClipboardText } from "@/lib/clipboard"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { JsonTreeView } from "@/components/json-tree-view"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useTranslations } from "@/hooks/use-translations"
import { Clipboard, Download, Upload, AlertCircle, Check, ChevronDown, ChevronUp, Trash2, Settings, Palette, FileText, Zap, RefreshCw, Copy, Code } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import yaml from "js-yaml"
import { useToolRuntimeParams } from "@/components/tool-runtime-params"
import { escapeJsonText, tryRepairCommonJson, unescapeJsonText } from "@/lib/json-text-tools"
import { downloadBlob } from "@/lib/object-url"

export default function JsonTool() {
  const t = useTranslations("json")
  const params = useToolRuntimeParams()
  
  // 基础状态
  const [showJsonSettings, setShowJsonSettings] = useState(false)
  const [autoFormat, setAutoFormat] = useState(false)
  const [realTimeValidation, setRealTimeValidation] = useState(true)
  const [copied, setCopied] = useState<{ [key: string]: boolean }>({})
  
  const [jsonText, setJsonText] = useState<string>(
    '{\n  "person": {\n    "name": "张三",\n    "age": 30,\n    "isStudent": false,\n    "hobbies": ["编程", "阅读", "旅行"],\n    "address": {\n      "city": "北京",\n      "zipCode": "100000"\n    }\n  },\n  "company": "示例公司",\n  "department": null\n}',
  )
  const [originalJson, setOriginalJson] = useState<string>("")
  const [error, setError] = useState<string | null>(null)
  const [errorPosition, setErrorPosition] = useState<{ line: number; column: number } | null>(null)
  const [repairSuggestion, setRepairSuggestion] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [indentSize, setIndentSize] = useState(2)
  const [useTab, setUseTab] = useState(false)
  const [sortKeys, setSortKeys] = useState(false)
  const [wordWrap, setWordWrap] = useState(true)
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    if (!realTimeValidation) {
      setError(null)
      setErrorPosition(null)
      setRepairSuggestion(null)
      return
    }

    const timeoutId = window.setTimeout(() => {
      if (!jsonText.trim()) {
        setError(null)
        setErrorPosition(null)
        setRepairSuggestion(null)
        return
      }

      try {
        JSON.parse(jsonText)
        setError(null)
        setErrorPosition(null)
        setRepairSuggestion(null)
      } catch (err) {
        if (!(err instanceof Error)) return

        setError(err.message)
        const posMatch = err.message.match(/at position (\d+)/)
        if (posMatch?.[1]) {
          const position = Number.parseInt(posMatch[1], 10)
          const lines = jsonText.substring(0, position).split("\n")
          setErrorPosition({
            line: lines.length,
            column: lines[lines.length - 1].length + 1,
          })
        } else {
          setErrorPosition(null)
        }

        const repaired = tryRepairCommonJson(jsonText)
        setRepairSuggestion(
          repaired === null
            ? null
            : JSON.stringify(
                repaired,
                sortKeys && repaired && typeof repaired === "object" && !Array.isArray(repaired)
                  ? Object.keys(repaired).sort()
                  : null,
                useTab ? "\t" : indentSize,
              ),
        )
      }
    }, 300)

    return () => window.clearTimeout(timeoutId)
  }, [indentSize, jsonText, realTimeValidation, sortKeys, useTab])

  // 格式化JSON
  const formatJson = () => {
    try {
      const parsed = JSON.parse(jsonText)
      const formatted = JSON.stringify(parsed, sortKeys ? Object.keys(parsed).sort() : null, useTab ? "\t" : indentSize)
      setJsonText(formatted)
      setError(null)
      setErrorPosition(null)
      setRepairSuggestion(null)
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message)

        // Try to extract line and column from error message
        const posMatch = err.message.match(/at position (\d+)/)
        if (posMatch && posMatch[1]) {
          const position = Number.parseInt(posMatch[1], 10)
          const lines = jsonText.substring(0, position).split("\n")
          setErrorPosition({
            line: lines.length,
            column: lines[lines.length - 1].length + 1,
          })

        }

        const repaired = tryRepairCommonJson(jsonText)
        setRepairSuggestion(
          repaired === null
            ? null
            : JSON.stringify(
                repaired,
                sortKeys && repaired && typeof repaired === "object" && !Array.isArray(repaired)
                  ? Object.keys(repaired).sort()
                  : null,
                useTab ? "\t" : indentSize,
              ),
        )
      }
    }
  }

  // 压缩JSON
  const compressJson = () => {
    try {
      const parsed = JSON.parse(jsonText)
      setJsonText(JSON.stringify(parsed))
      setError(null)
      setErrorPosition(null)
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message)

        // Try to extract line and column from error message
        const posMatch = err.message.match(/at position (\d+)/)
        if (posMatch && posMatch[1]) {
          const position = Number.parseInt(posMatch[1], 10)
          const lines = jsonText.substring(0, position).split("\n")
          setErrorPosition({
            line: lines.length,
            column: lines[lines.length - 1].length + 1,
          })
        }
      }
    }
  }

  // 折叠/展开JSON
  const toggleCollapse = () => {
    try {
      if (collapsed) {
        // 如果当前是折叠状态，则展开为原始JSON
        setJsonText(originalJson)
      } else {
        // 如果当前是展开状态，则折叠并保存原始JSON
        setOriginalJson(jsonText)
        const parsed = JSON.parse(jsonText)

        // 创建一个只有顶层键的对象
        const collapsedObj: Record<string, string | number | boolean | null> = {}
        Object.keys(parsed).forEach((key) => {
          const value = parsed[key]
          if (value === null) {
            collapsedObj[key] = null
          } else if (typeof value === "object") {
            collapsedObj[key] = Array.isArray(value) ? `[Array(${value.length})]` : "{...}"
          } else {
            collapsedObj[key] = value
          }
        })

        setJsonText(JSON.stringify(collapsedObj, null, useTab ? "\t" : indentSize))
      }
      setCollapsed(!collapsed)
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message)
      }
    }
  }

  // JSON转YAML
  const jsonToYaml = () => {
    try {
      const parsed = JSON.parse(jsonText)
      const yamlText = yaml.dump(parsed, { indent: indentSize })
      setJsonText(yamlText)
      setError(null)
      setErrorPosition(null)
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message)
      }
    }
  }

  // YAML转JSON
  const yamlToJson = () => {
    try {
      const parsed = yaml.load(jsonText)
      const formatted = JSON.stringify(
        parsed,
        sortKeys ? Object.keys(parsed as object).sort() : null,
        useTab ? "\t" : indentSize,
      )
      setJsonText(formatted)
      setError(null)
      setErrorPosition(null)
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message)
      }
    }
  }

  // 转义JSON
  const escapeJson = () => {
    try {
      setJsonText(escapeJsonText(jsonText))
      setError(null)
      setErrorPosition(null)
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message)
      }
    }
  }

  // 去转义JSON
  const unescapeJson = () => {
    try {
      setJsonText(unescapeJsonText(jsonText))
      setError(null)
      setErrorPosition(null)
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message)
      }
    }
  }

  // Unicode转中文
  const unicodeToChinese = () => {
    try {
      const result = jsonText.replace(/\\u[\dA-Fa-f]{4}/g, (match) => {
        return String.fromCharCode(Number.parseInt(match.replace(/\\u/g, ""), 16))
      })
      setJsonText(result)
      setError(null)
      setErrorPosition(null)
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message)
      }
    }
  }

  // 中文转Unicode
  const chineseToUnicode = () => {
    try {
      const result = jsonText.replace(/\p{Script=Han}/gu, (match) => {
        const codePoint = match.codePointAt(0)!
        if (codePoint <= 0xffff) {
          return `\\u${codePoint.toString(16).padStart(4, "0")}`
        }

        const offset = codePoint - 0x10000
        const high = 0xd800 + (offset >> 10)
        const low = 0xdc00 + (offset & 0x3ff)
        return `\\u${high.toString(16)}\\u${low.toString(16)}`
      })
      setJsonText(result)
      setError(null)
      setErrorPosition(null)
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message)
      }
    }
  }

  // 清空
  const clearJson = () => {
    setJsonText("")
    setError(null)
    setErrorPosition(null)
    setRepairSuggestion(null)
  }

  // 复制到剪贴板
  const copyToClipboard = (text: string, key: string = "main") => {
    if (!text) return

    void writeClipboardText(text).then((success) => {
      if (!success) return
      setCopied(prev => ({ ...prev, [key]: true }))

      setTimeout(() => {
        setCopied(prev => ({ ...prev, [key]: false }))
      }, 2000)
    })
  }

  // 复制JSON内容
  const copyJsonContent = () => {
    copyToClipboard(jsonText, "json")
  }

  // 下载JSON文件
  const downloadJson = () => {
    downloadBlob(new Blob([jsonText], { type: "application/json" }), "data.json")
  }

  // 上传JSON文件
  const uploadJson = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click()
    }
  }

  // 处理文件上传
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      const content = e.target?.result as string
      setJsonText(content)
      try {
        // 尝试解析以验证是否为有效的JSON
        JSON.parse(content)
        setError(null)
        setErrorPosition(null)
      } catch (err) {
        if (err instanceof Error) {
          setError(err.message)

          // Try to extract line and column from error message
          const posMatch = err.message.match(/at position (\d+)/)
          if (posMatch && posMatch[1]) {
            const position = Number.parseInt(posMatch[1], 10)
            const lines = content.substring(0, position).split("\n")
            setErrorPosition({
              line: lines.length,
              column: lines[lines.length - 1].length + 1,
            })
          }
        }
      }
    }
    reader.readAsText(file)

    // 重置文件输入，以便可以再次上传相同的文件
    if (event.target) {
      event.target.value = ""
    }
  }

  // 处理文件拖放
  const handleDrop = (event: React.DragEvent<HTMLTextAreaElement>) => {
    event.preventDefault()
    event.stopPropagation()

    const file = event.dataTransfer.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      const content = e.target?.result as string
      setJsonText(content)
      try {
        // 尝试解析以验证是否为有效的JSON
        JSON.parse(content)
        setError(null)
        setErrorPosition(null)
      } catch (err) {
        if (err instanceof Error) {
          setError(err.message)

          // Try to extract line and column from error message
          const posMatch = err.message.match(/at position (\d+)/)
          if (posMatch && posMatch[1]) {
            const position = Number.parseInt(posMatch[1], 10)
            const lines = content.substring(0, position).split("\n")
            setErrorPosition({
              line: lines.length,
              column: lines[lines.length - 1].length + 1,
            })
          }
        }
      }
    }
    reader.readAsText(file)
  }

  // 防止默认拖放行为
  const handleDragOver = (event: React.DragEvent<HTMLTextAreaElement>) => {
    event.preventDefault()
    event.stopPropagation()
  }

  // 初始化时检查是否有特定功能参数
  useEffect(() => {
    if (params?.feature) {
      // 根据功能参数执行相应操作
      switch (params.feature.toLowerCase()) {
        case "format":
          formatJson()
          break
        case "minify":
          compressJson()
          break
        // 可以添加更多功能
      }
    }
  }, [params])

  return (
    <div className="container mx-auto max-w-6xl px-3 py-4 sm:px-4">
      {/* 页面标题 */}
      <div className="text-center mb-8">
        <h1 className="mb-4 flex items-center justify-center gap-2 text-2xl font-bold text-[var(--md-sys-color-on-surface)] sm:text-3xl">
          <Code className="h-8 w-8 text-[var(--md-sys-color-primary)]" />
          {t("title")}
        </h1>
      </div>

      {/* JSON设置折叠区域 */}
      <div className="mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowJsonSettings(!showJsonSettings)}
          className="w-full text-sm text-[var(--md-sys-color-on-surface-variant)] hover:text-[var(--md-sys-color-on-surface)]"
        >
          <div className="flex items-center gap-2">
            {showJsonSettings ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
            <Settings className="h-4 w-4" />
            <span>{t("settings")}</span>
            {!showJsonSettings && (
              <Badge variant="secondary" className="text-xs ml-auto">
                {t("settingsHint")}
              </Badge>
            )}
          </div>
        </Button>

        {showJsonSettings && (
          <Card className="mt-3 card-modern">
            <CardContent className="py-4">
              <div className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-3">
                <div className="flex min-h-12 items-center justify-between gap-3 rounded-xl bg-[var(--md-sys-color-surface-container-low)] p-3">
                  <Label htmlFor="auto-format" className="cursor-pointer text-sm">
                    {t("autoFormat")}
                  </Label>
                  <Switch id="auto-format" checked={autoFormat} onCheckedChange={setAutoFormat} />
                </div>
                <div className="flex min-h-12 items-center justify-between gap-3 rounded-xl bg-[var(--md-sys-color-surface-container-low)] p-3">
                  <Label htmlFor="real-time-validation" className="cursor-pointer text-sm">
                    {t("realTimeValidation")}
                  </Label>
                  <Switch id="real-time-validation" checked={realTimeValidation} onCheckedChange={setRealTimeValidation} />
                </div>
                <div className="flex min-h-12 items-center justify-between gap-3 rounded-xl bg-[var(--md-sys-color-surface-container-low)] p-3">
                  <Label htmlFor="word-wrap" className="cursor-pointer text-sm">
                    {t("wordWrap")}
                  </Label>
                  <Switch id="word-wrap" checked={wordWrap} onCheckedChange={setWordWrap} />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium flex justify-between">
                      <span>{t("indentSize")}</span>
                      <span className="text-[var(--md-sys-color-primary)]">{t("spaces").replace("{count}", String(indentSize))}</span>
                    </Label>
                    <Slider
                      value={[indentSize]}
                      onValueChange={(value) => setIndentSize(value[0])}
                      min={1}
                      max={8}
                      step={1}
                      className="mt-2"
                    />
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center space-x-2">
                      <Switch id="use-tab" checked={useTab} onCheckedChange={setUseTab} />
                      <Label htmlFor="use-tab" className="text-sm">{t("useTab")}</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch id="sort-keys" checked={sortKeys} onCheckedChange={setSortKeys} />
                      <Label htmlFor="sort-keys" className="text-sm">{t("sortKeys")}</Label>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* 工具栏 */}
      <div className="mb-6">
        <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap sm:items-center">
          <Button variant="outline" size="sm" onClick={uploadJson} className="min-w-0 px-2 sm:px-3">
            <Upload className="h-4 w-4 mr-1" />
            <span className="truncate">{t("uploadFile")}</span>
          </Button>
          <Button variant="outline" size="sm" onClick={copyJsonContent} className="min-w-0 px-2 sm:px-3">
            {copied.json ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
            <span className="truncate">{copied.json ? t("copied") : t("copyContent")}</span>
          </Button>
          <Button variant="outline" size="sm" onClick={downloadJson} className="min-w-0 px-2 sm:px-3">
            <Download className="h-4 w-4 mr-1" />
            <span className="truncate">{t("downloadFile")}</span>
          </Button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".json,.yaml,.yml,application/json,text/yaml"
            className="hidden"
          />
        </div>
      </div>

      {/* 错误提示 */}
      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <div className="font-medium">{t("parseError")}</div>
            <div className="text-sm mt-1">{error}</div>
            {errorPosition && (
              <div className="text-xs mt-1 opacity-90">
                {t("position")
                  .replace("{line}", String(errorPosition.line))
                  .replace("{column}", String(errorPosition.column))}
              </div>
            )}
            {repairSuggestion && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-xs">{t("repairPrompt")}</span>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setJsonText(repairSuggestion)
                    setRepairSuggestion(null)
                    setError(null)
                    setErrorPosition(null)
                  }}
                >
                  {t("applyRepair")}
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setRepairSuggestion(null)}>
                  {t("keepOriginal")}
                </Button>
              </div>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* 主要内容区域 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 左侧：JSON编辑器 */}
        <div className="lg:col-span-2">
          <Card className="card-modern">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4 text-[var(--md-sys-color-primary)]" />
                {t("editor")}
                {realTimeValidation && (
                  <Badge variant="secondary" className="text-xs">
                    <Zap className="h-3 w-3 mr-1" />
                    {t("realTimeValidation")}
                  </Badge>
                )}
                {autoFormat && (
                  <Badge variant="secondary" className="text-xs">
                    <RefreshCw className="h-3 w-3 mr-1" />
                    {t("autoFormat")}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <textarea
                ref={textareaRef}
                className="h-[62vh] min-h-96 max-h-[48rem] w-full resize-none border-0 bg-[var(--md-sys-color-surface-container-low)] p-4 font-mono text-sm leading-relaxed text-[var(--md-sys-color-on-surface)] outline-none transition-colors focus:bg-[var(--md-sys-color-surface-container-lowest)]"
                value={jsonText}
                onChange={(e) => {
                  setJsonText(e.target.value)
                  setRepairSuggestion(null)
                }}
                onBlur={() => {
                  if (autoFormat && jsonText.trim()) formatJson()
                }}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                placeholder={t("inputPlaceholder")}
                spellCheck="false"
                style={{
                  whiteSpace: wordWrap ? "pre-wrap" : "pre",
                  tabSize: indentSize,
                }}
              />
            </CardContent>
          </Card>

          <Card className="card-modern mt-6">
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Clipboard className="h-4 w-4 text-[var(--md-sys-color-tertiary)]" />
                  {t("treeView")}
                </CardTitle>
                <Badge variant="secondary" className="text-xs">
                  {t("copyable")}
                </Badge>
                <Badge variant="secondary" className="text-xs">
                  {t("collapsible")}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <JsonTreeView jsonText={jsonText} indentSize={indentSize} />
            </CardContent>
          </Card>
        </div>

        {/* 右侧：操作按钮区域 */}
        <div className="space-y-6">
          {/* 基础操作 */}
          <Card className="card-modern">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Palette className="h-4 w-4 text-[var(--md-sys-color-primary)]" />
                {t("basicActions")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <Button onClick={formatJson} variant="outline" size="sm" className="w-full h-10">
                  <Code className="h-4 w-4 mr-2" />
                  {t("format")}
                </Button>
                <Button onClick={compressJson} variant="outline" size="sm" className="w-full h-10">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  {t("compress")}
                </Button>
                <Button onClick={toggleCollapse} variant="outline" size="sm" className="w-full h-10">
                  {collapsed ? (
                    <>
                      <ChevronDown className="h-4 w-4 mr-2" />
                      {t("expand")}
                    </>
                  ) : (
                    <>
                      <ChevronUp className="h-4 w-4 mr-2" />
                      {t("collapse")}
                    </>
                  )}
                </Button>
                <Button onClick={clearJson} variant="destructive" size="sm" className="w-full h-10">
                  <Trash2 className="h-4 w-4 mr-2" />
                  {t("clear")}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* 格式转换 */}
          <Card className="card-modern">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <RefreshCw className="h-4 w-4 text-[var(--md-sys-color-tertiary)]" />
                {t("formatConversion")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <Button onClick={jsonToYaml} variant="outline" size="sm" className="w-full h-10">
                  <FileText className="h-4 w-4 mr-2" />
                  {t("jsonToYaml")}
                </Button>
                <Button onClick={yamlToJson} variant="outline" size="sm" className="w-full h-10">
                  <Code className="h-4 w-4 mr-2" />
                  {t("yamlToJson")}
                </Button>
                <Button onClick={escapeJson} variant="outline" size="sm" className="w-full h-10">
                  <span className="mr-2 text-xs">{"\\'"}</span>
                  {t("escape")}
                </Button>
                <Button onClick={unescapeJson} variant="outline" size="sm" className="w-full h-10">
                  <span className="mr-2 text-xs">{"'"}</span>
                  {t("unescape")}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Unicode转换 */}
          <Card className="card-modern">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4 text-[var(--md-sys-color-warning)]" />
                {t("unicodeConversion")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <Button onClick={unicodeToChinese} variant="outline" size="sm" className="w-full h-10">
                  <span className="mr-2 text-sm">{"\\u"}</span>
                  {t("unicodeToChinese")}
                </Button>
                <Button onClick={chineseToUnicode} variant="outline" size="sm" className="w-full h-10">
                  <span className="mr-2 text-sm">{"中"}</span>
                  {t("chineseToUnicode")}
                </Button>
                <div className="rounded bg-[var(--md-sys-color-surface-container-low)] p-2 text-center text-xs text-[var(--md-sys-color-on-surface-variant)]">
                  {t("unicodeHint")}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
