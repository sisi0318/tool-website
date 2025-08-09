"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
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

interface JsonToolProps {
  params?: Record<string, string>
}

export default function JsonTool({ params }: JsonToolProps) {
  const t = useTranslations("json")
  
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
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [indentSize, setIndentSize] = useState(2)
  const [useTab, setUseTab] = useState(false)
  const [sortKeys, setSortKeys] = useState(false)
  const [syntaxHighlight, setSyntaxHighlight] = useState(true)
  const [wordWrap, setWordWrap] = useState(true)
  const [collapsed, setCollapsed] = useState(false)

  // 格式化JSON
  const formatJson = () => {
    try {
      const parsed = JSON.parse(jsonText)
      const formatted = JSON.stringify(parsed, sortKeys ? Object.keys(parsed).sort() : null, useTab ? "\t" : indentSize)
      setJsonText(formatted)
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

          // Still try to format what we can
          try {
            // Try to fix common issues
            const fixedJson = jsonText
              .replace(/,\s*}/g, "}") // Remove trailing commas in objects
              .replace(/,\s*\]/g, "]") // Remove trailing commas in arrays
              .replace(/(['"])?([a-zA-Z0-9_]+)(['"])?:/g, '"$2":') // Fix unquoted property names

            const parsed = JSON.parse(fixedJson)
            const formatted = JSON.stringify(
              parsed,
              sortKeys ? Object.keys(parsed).sort() : null,
              useTab ? "\t" : indentSize,
            )
            setJsonText(formatted)
          } catch (fixErr) {
            // If fixing failed, just keep the original text
          }
        }
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
        const collapsedObj: Record<string, string> = {}
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
      // Split by lines, escape each line separately, then rejoin
      const lines = jsonText.split("\n")
      const escapedLines = lines.map((line) => {
        if (line.trim() === "") return line // Preserve empty lines
        return JSON.stringify(line).slice(1, -1) // Remove the quotes added by JSON.stringify
      })
      setJsonText(escapedLines.join("\n"))
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
      // 移除开头和结尾的引号，并解析转义字符
      const unescaped = jsonText.replace(/^"|"$/g, "").replace(/\\"/g, '"').replace(/\\\\/g, "\\")
      setJsonText(unescaped)
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
      const result = jsonText.replace(/[\u4e00-\u9fa5]/g, (match) => {
        return "\\u" + match.charCodeAt(0).toString(16).padStart(4, "0")
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
  }

  // 复制到剪贴板
  const copyToClipboard = (text: string, key: string = "main") => {
    if (!text) return

    navigator.clipboard.writeText(text).then(() => {
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
    const blob = new Blob([jsonText], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "data.json"
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
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
    <div className="container mx-auto px-4 py-4 max-w-6xl">
      {/* 页面标题 */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-200 mb-4 flex items-center justify-center gap-2">
          <Code className="h-8 w-8 text-emerald-600" />
          JSON 工具
        </h1>
      </div>

      {/* JSON设置折叠区域 */}
      <div className="mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowJsonSettings(!showJsonSettings)}
          className="w-full text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
        >
          <div className="flex items-center gap-2">
            {showJsonSettings ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
            <Settings className="h-4 w-4" />
            <span>JSON设置</span>
            {!showJsonSettings && (
              <Badge variant="secondary" className="text-xs ml-auto">
                点击查看
              </Badge>
            )}
          </div>
        </Button>

        {showJsonSettings && (
          <Card className="mt-3 card-modern">
            <CardContent className="py-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="flex items-center space-x-2 bg-gray-100 dark:bg-gray-800 p-3 rounded-lg">
                  <Label htmlFor="auto-format" className="cursor-pointer text-sm">
                    手动格式化
                  </Label>
                  <Switch id="auto-format" checked={autoFormat} onCheckedChange={setAutoFormat} />
                  <Label htmlFor="auto-format" className="cursor-pointer text-sm text-blue-600">
                    自动格式化
                  </Label>
                </div>
                <div className="flex items-center space-x-2 bg-gray-100 dark:bg-gray-800 p-3 rounded-lg">
                  <Label htmlFor="real-time-validation" className="cursor-pointer text-sm">
                    关闭验证
                  </Label>
                  <Switch id="real-time-validation" checked={realTimeValidation} onCheckedChange={setRealTimeValidation} />
                  <Label htmlFor="real-time-validation" className="cursor-pointer text-sm text-green-600">
                    实时验证
                  </Label>
                </div>
                <div className="flex items-center space-x-2 bg-gray-100 dark:bg-gray-800 p-3 rounded-lg">
                  <Label htmlFor="word-wrap" className="cursor-pointer text-sm">
                    禁用换行
                  </Label>
                  <Switch id="word-wrap" checked={wordWrap} onCheckedChange={setWordWrap} />
                  <Label htmlFor="word-wrap" className="cursor-pointer text-sm text-purple-600">
                    自动换行
                  </Label>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium flex justify-between">
                      <span>缩进大小</span>
                      <span className="text-emerald-600">{indentSize} 空格</span>
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
                      <Label htmlFor="use-tab" className="text-sm">使用Tab</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch id="sort-keys" checked={sortKeys} onCheckedChange={setSortKeys} />
                      <Label htmlFor="sort-keys" className="text-sm">排序键名</Label>
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
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={uploadJson}>
            <Upload className="h-4 w-4 mr-1" />
            上传文件
          </Button>
          <Button variant="outline" size="sm" onClick={copyJsonContent}>
            {copied.json ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
            {copied.json ? "已复制" : "复制内容"}
          </Button>
          <Button variant="outline" size="sm" onClick={downloadJson}>
            <Download className="h-4 w-4 mr-1" />
            下载文件
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
            <div className="font-medium">JSON 解析错误</div>
            <div className="text-sm mt-1">{error}</div>
            {errorPosition && (
              <div className="text-xs mt-1 opacity-90">
                位置: 第 {errorPosition.line} 行, 第 {errorPosition.column} 列
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
                <FileText className="h-4 w-4 text-emerald-600" />
                JSON 编辑器
                {realTimeValidation && (
                  <Badge variant="secondary" className="text-xs">
                    <Zap className="h-3 w-3 mr-1" />
                    实时验证
                  </Badge>
                )}
                {autoFormat && (
                  <Badge variant="secondary" className="text-xs">
                    <RefreshCw className="h-3 w-3 mr-1" />
                    自动格式化
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <style jsx global>{`
                .json-editor {
                  font-family: 'JetBrains Mono', 'Fira Code', 'Monaco', 'Consolas', monospace;
                  font-size: 14px;
                  line-height: 1.6;
                  padding: 1rem;
                  width: 100%;
                  height: 70vh;
                  resize: none;
                  outline: none;
                  border: none;
                  tab-size: ${indentSize};
                  background: #f8fafc;
                  color: #1e293b;
                }
                .dark .json-editor {
                  background: #0f172a;
                  color: #e2e8f0;
                }
                .json-editor:focus {
                  background: #ffffff;
                }
                .dark .json-editor:focus {
                  background: #1e293b;
                }
              `}</style>

              <textarea
                ref={textareaRef}
                className="json-editor transition-colors"
                value={jsonText}
                onChange={(e) => {
                  setJsonText(e.target.value)
                  if (realTimeValidation) {
                    setError(null)
                    setErrorPosition(null)
                  }
                }}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                placeholder="在此输入或粘贴 JSON 内容..."
                spellCheck="false"
                style={{
                  whiteSpace: wordWrap ? "pre-wrap" : "pre",
                }}
              />
            </CardContent>
          </Card>
        </div>

        {/* 右侧：操作按钮区域 */}
        <div className="space-y-6">
          {/* 基础操作 */}
          <Card className="card-modern">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Palette className="h-4 w-4 text-blue-600" />
                基础操作
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <Button onClick={formatJson} variant="outline" size="sm" className="w-full h-10">
                  <Code className="h-4 w-4 mr-2" />
                  格式化
                </Button>
                <Button onClick={compressJson} variant="outline" size="sm" className="w-full h-10">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  压缩
                </Button>
                <Button onClick={toggleCollapse} variant="outline" size="sm" className="w-full h-10">
                  {collapsed ? (
                    <>
                      <ChevronDown className="h-4 w-4 mr-2" />
                      展开
                    </>
                  ) : (
                    <>
                      <ChevronUp className="h-4 w-4 mr-2" />
                      折叠
                    </>
                  )}
                </Button>
                <Button onClick={clearJson} variant="destructive" size="sm" className="w-full h-10">
                  <Trash2 className="h-4 w-4 mr-2" />
                  清空
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* 格式转换 */}
          <Card className="card-modern">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <RefreshCw className="h-4 w-4 text-purple-600" />
                格式转换
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <Button onClick={jsonToYaml} variant="outline" size="sm" className="w-full h-10">
                  <FileText className="h-4 w-4 mr-2" />
                  转换为 YAML
                </Button>
                <Button onClick={yamlToJson} variant="outline" size="sm" className="w-full h-10">
                  <Code className="h-4 w-4 mr-2" />
                  转换为 JSON
                </Button>
                <Button onClick={escapeJson} variant="outline" size="sm" className="w-full h-10">
                  <span className="mr-2 text-xs">{"\\'"}</span>
                  JSON 转义
                </Button>
                <Button onClick={unescapeJson} variant="outline" size="sm" className="w-full h-10">
                  <span className="mr-2 text-xs">{"'"}</span>
                  JSON 去转义
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Unicode转换 */}
          <Card className="card-modern">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4 text-orange-600" />
                Unicode 转换
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <Button onClick={unicodeToChinese} variant="outline" size="sm" className="w-full h-10">
                  <span className="mr-2 text-sm">{"\\u"}</span>
                  Unicode → 中文
                </Button>
                <Button onClick={chineseToUnicode} variant="outline" size="sm" className="w-full h-10">
                  <span className="mr-2 text-sm">{"中"}</span>
                  中文 → Unicode
                </Button>
                <div className="text-xs text-gray-500 p-2 bg-gray-50 dark:bg-gray-800 rounded text-center">
                  支持中文字符与 Unicode 编码之间的相互转换
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
