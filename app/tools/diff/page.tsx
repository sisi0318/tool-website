"use client"

import type React from "react"
import {
  useCallback,
  useDeferredValue,
  useMemo,
  useRef,
  useState,
} from "react"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { useTranslations } from "@/hooks/use-translations"
import {
  AlertTriangle,
  ArrowRightLeft,
  Check,
  Copy,
  Eye,
  EyeOff,
  FileText,
  Loader2,
  Trash2,
} from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { computeLineDiff, type DiffLine } from "@/lib/text-diff"

const MAX_RENDERED_DIFF_LINES = 2_000

export default function DiffPage() {
  const t = useTranslations("diff")

  const [oldText, setOldText] = useState("")
  const [newText, setNewText] = useState("")
  const [showLineNumbers, setShowLineNumbers] = useState(true)
  const [algorithm, setAlgorithm] = useState<"simple" | "myers">("myers")
  const [copied, setCopied] = useState(false)
  
  const oldTextareaRef = useRef<HTMLTextAreaElement>(null)
  const newTextareaRef = useRef<HTMLTextAreaElement>(null)
  const copyTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const deferredOldText = useDeferredValue(oldText)
  const deferredNewText = useDeferredValue(newText)
  const isCalculating = deferredOldText !== oldText || deferredNewText !== newText

  // 计算差异
  const diffResult = useMemo(
    () => computeLineDiff(
      deferredOldText,
      deferredNewText,
      algorithm === "myers" ? "precise" : "quick",
    ),
    [algorithm, deferredNewText, deferredOldText],
  )
  const diff = diffResult.lines
  const renderedDiff = diff.slice(0, MAX_RENDERED_DIFF_LINES)
  const resultLimited = renderedDiff.length < diff.length

  // 复制差异结果
  const copyDiff = useCallback(() => {
    const diffText = diff.map(line => {
      switch (line.type) {
        case "added": return `+ ${line.content}`
        case "removed": return `- ${line.content}`
        default: return `  ${line.content}`
      }
    }).join("\n")
    
    navigator.clipboard.writeText(diffText).then(() => {
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current)
      }
      setCopied(true)
      copyTimeoutRef.current = setTimeout(() => {
        setCopied(false)
      }, 2000)
    })
  }, [diff])

  // 清空文本
  const handleClear = () => {
    setOldText("")
    setNewText("")
    oldTextareaRef.current?.focus()
  }

  // 交换文本
  const swapTexts = () => {
    const temp = oldText
    setOldText(newText)
    setNewText(temp)
  }

  // 粘贴示例
  const pasteExample = () => {
    const oldExample = `function helloWorld() {
  console.log("Hello World!");
}

// This is a sample function
function add(a, b) {
  return a + b;
}`
    
    const newExample = `function helloWorld() {
  console.log("Hello, World!");
}

// This is a sample function with documentation
/**
 * Adds two numbers together
 * @param {number} a - First number
 * @param {number} b - Second number
 * @returns {number} Sum of a and b
 */
function add(a, b) {
  return a + b;
}`
    
    setOldText(oldExample)
    setNewText(newExample)
  }

  // 渲染差异行
  const renderDiffLine = (line: DiffLine, index: number) => {
    const lineNumber = index + 1
    let lineClass = ""
    let prefix = ""
    
    switch (line.type) {
      case "added":
        lineClass = "bg-green-50 dark:bg-green-900/20 border-l-4 border-green-500 pl-3"
        prefix = "+ "
        break
      case "removed":
        lineClass = "bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 pl-3"
        prefix = "- "
        break
      default:
        lineClass = "hover:bg-gray-50 dark:hover:bg-gray-800/50"
        prefix = "  "
        break
    }
    
    return (
      <div 
        key={index} 
        className={`flex text-sm font-mono ${lineClass}`}
      >
        {showLineNumbers && (
          <div className="w-12 text-right pr-3 text-gray-400 select-none">
            {lineNumber}
          </div>
        )}
        <div className="flex-1">
          <span className="select-none">{prefix}</span>
          {line.content || <span className="text-gray-400 italic">{' '}</span>}
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-4 max-w-6xl">
      <h2 className="text-2xl font-bold text-center mb-6">{t("title")}</h2>

      <div className="space-y-6">
        {/* 控制面板 */}
        <div className="flex flex-wrap gap-4 items-center justify-between">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={pasteExample}>
              <FileText className="h-4 w-4 mr-1" />
              {t("example")}
            </Button>
            <Button variant="outline" size="sm" onClick={swapTexts}>
              <ArrowRightLeft className="h-4 w-4 mr-1" />
              {t("swap")}
            </Button>
            <Button variant="outline" size="sm" onClick={handleClear}>
              <Trash2 className="h-4 w-4 mr-1" />
              {t("clear")}
            </Button>
          </div>
          
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex items-center gap-2">
              <Button 
                variant={algorithm === "simple" ? "default" : "outline"} 
                size="sm"
                onClick={() => setAlgorithm("simple")}
              >
                {t("simpleAlgorithm")}
              </Button>
              <Button 
                variant={algorithm === "myers" ? "default" : "outline"} 
                size="sm"
                onClick={() => setAlgorithm("myers")}
              >
                {t("myersAlgorithm")}
              </Button>
            </div>
            
            <div className="flex items-center gap-2">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setShowLineNumbers(!showLineNumbers)}
              >
                {showLineNumbers ? (
                  <Eye className="h-4 w-4" />
                ) : (
                  <EyeOff className="h-4 w-4" />
                )}
                {showLineNumbers ? t("hideLineNumbers") : t("showLineNumbers")}
              </Button>
              
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="sm" onClick={copyDiff}>
                      {copied ? (
                        <Check className="h-4 w-4 mr-1 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4 mr-1" />
                      )}
                      {copied ? t("copied") : t("copy")}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{t("copyTooltip")}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        </div>

        {/* 文本输入区域 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 原始文本 */}
          <div className="space-y-2">
            <Label htmlFor="old-text">{t("originalText")}</Label>
            <Textarea
              ref={oldTextareaRef}
              id="old-text"
              placeholder={t("originalPlaceholder")}
              value={oldText}
              onChange={(e) => setOldText(e.target.value)}
              rows={15}
              className="font-mono text-sm"
            />
          </div>
          
          {/* 新文本 */}
          <div className="space-y-2">
            <Label htmlFor="new-text">{t("newText")}</Label>
            <Textarea
              ref={newTextareaRef}
              id="new-text"
              placeholder={t("newPlaceholder")}
              value={newText}
              onChange={(e) => setNewText(e.target.value)}
              rows={15}
              className="font-mono text-sm"
            />
          </div>
        </div>

        {/* 差异显示区域 */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>{t("differences")}</Label>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              {isCalculating && <Loader2 className="h-4 w-4 animate-spin" />}
              <span>
                {diffResult.added + diffResult.removed} {t("changes")}
              </span>
            </div>
          </div>

          {algorithm === "myers" && diffResult.algorithmUsed === "quick" && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{t("preciseFallback")}</span>
            </div>
          )}

          {resultLimited && (
            <div className="rounded-lg bg-blue-50 p-3 text-sm text-blue-800 dark:bg-blue-950/30 dark:text-blue-200">
              {t("resultLimited").replace(
                "{count}",
                MAX_RENDERED_DIFF_LINES.toLocaleString(),
              )}
            </div>
          )}
          
          <div className="border rounded-lg overflow-hidden bg-white dark:bg-gray-900">
            {diff.length > 0 ? (
              <div className="max-h-96 overflow-y-auto">
                {renderedDiff.map((line, index) => renderDiffLine(line, index))}
              </div>
            ) : (
              <div className="p-8 text-center text-gray-500">
                {t("noDifferences")}
              </div>
            )}
          </div>
          
          {/* 差异图例 */}
          <div className="flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-green-500"></div>
              <span>{t("added")}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-red-500"></div>
              <span>{t("removed")}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-gray-300 dark:bg-gray-600"></div>
              <span>{t("unchanged")}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
