"use client"

import { useEffect, useRef, useState } from "react"
import {
  ArrowLeftRight,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronUp,
  ClipboardPaste,
  Copy,
  Settings,
  Trash2,
  Zap,
} from "lucide-react"

import { M3Card } from "@/components/m3/card"
import { useToolRuntimeParams } from "@/components/tool-runtime-params"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import {
  ENCODING_DEFINITIONS,
  findEncodingType,
  transformEncoding,
  type EncodingDirection,
  type EncodingType,
} from "@/lib/encoding-tools"

const COMMON_ENCODING_TYPES: EncodingType[] = ["base64", "url", "hex", "unicode", "html"]

export default function EncodingPage() {
  const params = useToolRuntimeParams()
  const [encodingType, setEncodingType] = useState<EncodingType>("base64")
  const [direction, setDirection] = useState<EncodingDirection>("encode")
  const [input, setInput] = useState("")
  const [output, setOutput] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [autoMode, setAutoMode] = useState(true)
  const [autoSwitch, setAutoSwitch] = useState(true)
  const [multiline, setMultiline] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showEncodingInfo, setShowEncodingInfo] = useState(false)
  const [copied, setCopied] = useState<Record<string, boolean>>({})
  const copyTimeoutRef = useRef<Record<string, ReturnType<typeof setTimeout> | undefined>>({})

  const selectedDefinition =
    ENCODING_DEFINITIONS.find((definition) => definition.id === encodingType) ?? ENCODING_DEFINITIONS[0]

  const runTransform = (
    value: string,
    nextType: EncodingType = encodingType,
    nextDirection: EncodingDirection = direction,
    nextMultiline: boolean = multiline,
  ) => {
    if (value.length === 0) {
      setOutput("")
      setError(null)
      return ""
    }

    try {
      const result = transformEncoding(value, nextType, nextDirection, nextMultiline)
      setOutput(result)
      setError(null)
      return result
    } catch (transformError) {
      const message = transformError instanceof Error ? transformError.message : "转换失败，请检查输入格式"
      setOutput("")
      setError(message)
      return ""
    }
  }

  const handleInputChange = (value: string) => {
    setInput(value)
    if (autoMode) {
      runTransform(value)
    } else {
      setOutput("")
      setError(null)
    }
  }

  const handleEncodingTypeChange = (nextType: EncodingType) => {
    setEncodingType(nextType)
    if (autoSwitch && input.length > 0) {
      runTransform(input, nextType)
    } else if (input.length > 0) {
      setOutput("")
      setError(null)
    }
  }

  const handleDirectionChange = (nextDirection: EncodingDirection) => {
    if (nextDirection === direction) return

    setDirection(nextDirection)
    setError(null)

    if (output.length > 0) {
      setInput(output)
      setOutput(input)
      return
    }

    if (autoMode && input.length > 0) {
      runTransform(input, encodingType, nextDirection)
    }
  }

  const reverseConversion = () => {
    if (!output.length) return

    setInput(output)
    setOutput(input)
    setDirection(direction === "encode" ? "decode" : "encode")
    setError(null)
  }

  const clearAll = () => {
    setInput("")
    setOutput("")
    setError(null)
  }

  const pasteInput = async () => {
    try {
      const text = await navigator.clipboard.readText()
      handleInputChange(text)
    } catch {
      setError("无法读取剪贴板，请检查浏览器权限后重试")
    }
  }

  const copyToClipboard = async (text: string, key: string) => {
    if (!text.length) return

    try {
      await navigator.clipboard.writeText(text)
      if (copyTimeoutRef.current[key]) clearTimeout(copyTimeoutRef.current[key])
      setCopied((current) => ({ ...current, [key]: true }))
      copyTimeoutRef.current[key] = setTimeout(() => {
        setCopied((current) => ({ ...current, [key]: false }))
      }, 2000)
    } catch {
      setError("复制失败，请检查浏览器剪贴板权限")
    }
  }

  const handleMultilineChange = (checked: boolean) => {
    setMultiline(checked)
    if (autoMode && input.length > 0) runTransform(input, encodingType, direction, checked)
  }

  const handleAutoModeChange = (checked: boolean) => {
    setAutoMode(checked)
    if (checked && input.length > 0) runTransform(input)
  }

  useEffect(() => {
    const matchedType = findEncodingType(params?.feature ?? "")
    if (!matchedType) return

    setEncodingType(matchedType)
    if (autoSwitch && input.length > 0) runTransform(input, matchedType)
  }, [params?.feature])

  useEffect(() => {
    return () => {
      Object.values(copyTimeoutRef.current).forEach((timeout) => {
        if (timeout) clearTimeout(timeout)
      })
    }
  }, [])

  return (
    <div className="container mx-auto max-w-7xl px-3 py-5 sm:px-4 sm:py-6">
      <div className="mb-6 text-center">
        <h1 className="mb-2 text-2xl font-bold text-[var(--md-sys-color-on-surface)] sm:text-3xl">
          编解码工具
        </h1>
        <p className="mx-auto max-w-2xl text-sm text-[var(--md-sys-color-on-surface-variant)]">
          选择格式和方向后直接输入；结果会在右侧实时生成，也可切换为手动转换。
        </p>
      </div>

      <M3Card variant="outlined" className="mb-5 overflow-hidden sm:mb-6">
        <div className="grid gap-4 p-4 md:grid-cols-[minmax(0,1fr)_minmax(240px,0.8fr)] md:p-5">
          <div>
            <Label className="mb-2 block text-sm font-medium">转换方向</Label>
            <div
              className="grid grid-cols-2 rounded-xl bg-[var(--md-sys-color-surface-container)] p-1"
              role="group"
              aria-label="转换方向"
            >
              <Button
                type="button"
                variant={direction === "encode" ? "default" : "ghost"}
                className="rounded-lg"
                aria-pressed={direction === "encode"}
                onClick={() => handleDirectionChange("encode")}
              >
                编码
              </Button>
              <Button
                type="button"
                variant={direction === "decode" ? "default" : "ghost"}
                className="rounded-lg"
                aria-pressed={direction === "decode"}
                onClick={() => handleDirectionChange("decode")}
              >
                解码
              </Button>
            </div>
          </div>

          <div>
            <Label className="mb-2 block text-sm font-medium" htmlFor="encoding-format">
              编码格式
            </Label>
            <Select
              value={encodingType}
              onValueChange={(value) => handleEncodingTypeChange(value as EncodingType)}
            >
              <SelectTrigger
                id="encoding-format"
                className="h-10 w-full bg-[var(--md-sys-color-surface-container-high)]"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-[320px]">
                {ENCODING_DEFINITIONS.map((definition) => (
                  <SelectItem key={definition.id} value={definition.id}>
                    {definition.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="md:col-span-2">
            <Label className="mb-2 block text-xs text-[var(--md-sys-color-on-surface-variant)]">
              常用格式
            </Label>
            <div className="flex flex-wrap gap-2">
              {COMMON_ENCODING_TYPES.map((type) => {
                const definition = ENCODING_DEFINITIONS.find((item) => item.id === type)!
                return (
                  <Button
                    key={type}
                    type="button"
                    size="sm"
                    variant={encodingType === type ? "secondary" : "outline"}
                    className="rounded-full"
                    onClick={() => handleEncodingTypeChange(type)}
                  >
                    {definition.name}
                  </Button>
                )
              })}
            </div>
          </div>
        </div>

        <div className="border-t border-[var(--md-sys-color-outline-variant)] px-3 py-2 sm:px-5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowEncodingInfo((visible) => !visible)}
            className="w-full justify-start whitespace-normal text-left text-[var(--md-sys-color-on-surface-variant)]"
            aria-expanded={showEncodingInfo}
          >
            {showEncodingInfo ? (
              <ChevronUp className="mr-2 h-4 w-4 shrink-0" />
            ) : (
              <ChevronDown className="mr-2 h-4 w-4 shrink-0" />
            )}
            {selectedDefinition.name} 格式说明与示例
          </Button>

          {showEncodingInfo && (
            <div className="grid gap-5 px-2 py-4 lg:grid-cols-2">
              <div className="space-y-2">
                <h2 className="flex items-center gap-2 font-semibold">
                  <Settings className="h-4 w-4 text-green-600" />
                  格式说明
                </h2>
                <p className="text-sm text-[var(--md-sys-color-on-surface-variant)]">
                  {selectedDefinition.description}
                </p>
                <p className="text-sm text-[var(--md-sys-color-on-surface-variant)]">
                  {selectedDefinition.usage}
                </p>
              </div>
              <div className="space-y-2">
                <h2 className="flex items-center gap-2 font-semibold">
                  <Zap className="h-4 w-4 text-blue-600" />
                  转换示例
                </h2>
                <div className="grid gap-2 rounded-xl bg-[var(--md-sys-color-surface-container)] p-3 text-xs sm:grid-cols-2">
                  <div className="min-w-0">
                    <span className="text-green-600">输入</span>
                    <code className="mt-1 block break-all rounded bg-[var(--md-sys-color-surface)] p-2">
                      {selectedDefinition.exampleInput}
                    </code>
                  </div>
                  <div className="min-w-0">
                    <span className="text-blue-600">输出</span>
                    <code className="mt-1 block break-all rounded bg-[var(--md-sys-color-surface)] p-2">
                      {selectedDefinition.exampleOutput}
                    </code>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </M3Card>

      <div className="mb-5 flex flex-col gap-4 lg:mb-6 lg:flex-row lg:gap-6">
        <M3Card variant="elevated" className="min-w-0 flex-1">
          <div className="flex h-full flex-col px-3 pb-3 pt-4 sm:px-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="flex min-w-0 items-center gap-2 text-base font-semibold">
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${direction === "encode" ? "bg-green-500" : "bg-blue-500"}`} />
                {direction === "encode" ? "原文输入" : `${selectedDefinition.name} 输入`}
              </h2>
              <div className="flex shrink-0 items-center gap-1">
                <Badge variant="outline" className="h-5 px-1.5 font-mono text-xs">
                  {input.length}
                </Badge>
                <div className="hidden gap-1 sm:flex">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={pasteInput}>
                          <ClipboardPaste className="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>粘贴内容</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => copyToClipboard(input, "input")}
                          disabled={!input.length}
                          aria-label={copied.input ? "已复制输入内容" : "复制输入内容"}
                        >
                          {copied.input ? (
                            <Check className="h-3.5 w-3.5 text-green-500" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>复制输入</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>
            </div>

            <Textarea
              value={input}
              onChange={(event) => handleInputChange(event.target.value)}
              aria-label={direction === "encode" ? "待编码文本" : "待解码文本"}
              placeholder={direction === "encode" ? "输入要编码的文本..." : `粘贴要解码的 ${selectedDefinition.name} 内容...`}
              className="min-h-[220px] flex-grow resize-y border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface)] font-mono text-sm sm:min-h-[260px]"
            />

            {error && (
              <p role="alert" className="mt-2 text-xs text-[var(--md-sys-color-error)]">
                {error}
              </p>
            )}

            <div className="mt-3 grid grid-cols-3 gap-2 sm:hidden">
              <Button type="button" variant="secondary" size="sm" className="h-9 text-xs" onClick={pasteInput}>
                粘贴
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="h-9 text-xs"
                onClick={() => copyToClipboard(input, "input")}
                disabled={!input.length}
              >
                {copied.input ? "已复制" : "复制"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-9 text-xs text-[var(--md-sys-color-error)]"
                onClick={clearAll}
                disabled={!input.length && !output.length}
              >
                清空
              </Button>
            </div>
          </div>
        </M3Card>

        <div className="flex shrink-0 flex-row items-center justify-center gap-2 lg:w-28 lg:flex-col">
          {autoMode ? (
            <div className="inline-flex h-10 items-center gap-2 rounded-full bg-[var(--md-sys-color-primary-container)] px-3 text-xs font-medium text-[var(--md-sys-color-on-primary-container)]">
              <Zap className="h-4 w-4" />
              实时
            </div>
          ) : (
            <Button
              type="button"
              size="sm"
              className="rounded-full"
              onClick={() => runTransform(input)}
              disabled={!input.length}
            >
              <ArrowRight className="mr-1.5 h-4 w-4 rotate-90 lg:rotate-0" />
              {direction === "encode" ? "编码" : "解码"}
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="rounded-full"
            onClick={reverseConversion}
            disabled={!output.length}
          >
            <ArrowLeftRight className="mr-1.5 h-4 w-4" />
            反向
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="hidden rounded-full text-[var(--md-sys-color-error)] hover:bg-[var(--md-sys-color-error-container)] sm:inline-flex"
            onClick={clearAll}
            disabled={!input.length && !output.length}
          >
            <Trash2 className="mr-1.5 h-4 w-4" />
            清空
          </Button>
        </div>

        <M3Card
          variant="filled"
          className="min-w-0 flex-1 border border-[var(--md-sys-color-outline-variant)]/50 bg-[var(--md-sys-color-surface-container)]"
        >
          <div className="flex h-full flex-col px-3 pb-3 pt-4 sm:px-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="flex min-w-0 items-center gap-2 text-base font-semibold">
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${direction === "encode" ? "bg-blue-500" : "bg-green-500"}`} />
                {direction === "encode" ? `${selectedDefinition.name} 结果` : "解码结果"}
              </h2>
              <div className="flex shrink-0 items-center gap-1">
                <Badge variant="outline" className="h-5 px-1.5 font-mono text-xs">
                  {output.length}
                </Badge>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="hidden h-7 w-7 sm:inline-flex"
                        onClick={() => copyToClipboard(output, "output")}
                        disabled={!output.length}
                        aria-label={copied.output ? "已复制转换结果" : "复制转换结果"}
                      >
                        {copied.output ? (
                          <Check className="h-3.5 w-3.5 text-green-500" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>复制结果</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>

            <Textarea
              value={output}
              readOnly
              aria-label={direction === "encode" ? "编码结果" : "解码结果"}
              placeholder={direction === "encode" ? "编码结果将在这里显示..." : "解码结果将在这里显示..."}
              className="min-h-[220px] flex-grow resize-y border-[var(--md-sys-color-outline-variant)] bg-transparent font-mono text-sm sm:min-h-[260px]"
            />

            <div className="mt-3 grid grid-cols-2 gap-2 sm:hidden">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="h-9 text-xs"
                onClick={() => copyToClipboard(output, "output")}
                disabled={!output.length}
              >
                {copied.output ? "已复制" : "复制结果"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-9 text-xs text-[var(--md-sys-color-error)]"
                onClick={() => setOutput("")}
                disabled={!output.length}
              >
                清空结果
              </Button>
            </div>
          </div>
        </M3Card>
      </div>

      <M3Card variant="outlined">
        <CardHeader className="pb-3 pt-4">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Settings className="h-4 w-4" />
              设置选项
            </CardTitle>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowSettings((visible) => !visible)}
              aria-expanded={showSettings}
            >
              {showSettings ? "收起" : "展开"}
            </Button>
          </div>
        </CardHeader>
        {showSettings && (
          <CardContent className="pb-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="flex items-center space-x-2">
                <Switch id="auto-mode" checked={autoMode} onCheckedChange={handleAutoModeChange} />
                <Label htmlFor="auto-mode" className="cursor-pointer text-sm">
                  输入时实时转换
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch id="auto-switch" checked={autoSwitch} onCheckedChange={setAutoSwitch} />
                <Label htmlFor="auto-switch" className="cursor-pointer text-sm">
                  切换格式时重新转换
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="multiline"
                  checked={multiline}
                  onCheckedChange={(checked) => handleMultilineChange(checked === true)}
                />
                <Label htmlFor="multiline" className="cursor-pointer text-sm">
                  每行单独处理
                </Label>
              </div>
            </div>
          </CardContent>
        )}
      </M3Card>
    </div>
  )
}
