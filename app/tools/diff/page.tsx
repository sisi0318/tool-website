"use client"

import type React from "react"
import { useState, useMemo, useCallback, useRef } from "react"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { useTranslations } from "@/hooks/use-translations"
import { Copy, Check, Trash2, FileText, ArrowRightLeft, Eye, EyeOff } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface DiffPageProps {
  params?: {
    feature?: string
  }
}

// Diff 类型
type DiffType = "unchanged" | "added" | "removed"

interface DiffLine {
  type: DiffType
  content: string
  lineNumber?: number
}

// 简单的行对比算法
function computeDiff(oldText: string, newText: string): DiffLine[] {
  const oldLines = oldText.split("\n")
  const newLines = newText.split("\n")
  const diff: DiffLine[] = []
  
  // 创建行映射以便快速查找
  const oldLineMap = new Map<string, number[]>()
  const newLineMap = new Map<string, number[]>()
  
  oldLines.forEach((line, index) => {
    if (!oldLineMap.has(line)) {
      oldLineMap.set(line, [])
    }
    oldLineMap.get(line)?.push(index)
  })
  
  newLines.forEach((line, index) => {
    if (!newLineMap.has(line)) {
      newLineMap.set(line, [])
    }
    newLineMap.get(line)?.push(index)
  })
  
  let oldIndex = 0
  let newIndex = 0
  
  // 简单的 diff 算法：逐行比较
  while (oldIndex < oldLines.length || newIndex < newLines.length) {
    const oldLine = oldIndex < oldLines.length ? oldLines[oldIndex] : null
    const newLine = newIndex < newLines.length ? newLines[newIndex] : null
    
    // 行相同
    if (oldLine === newLine) {
      diff.push({ type: "unchanged", content: oldLine || "" })
      oldIndex++
      newIndex++
      continue
    }
    
    // 检查新行是否存在于旧文本中（可能是移动的行）
    const existsInOld = oldLineMap.has(newLine || "")
    const existsInNew = newLineMap.has(oldLine || "")
    
    // 如果新行不存在于旧文本中，则为新增行
    if (newLine !== null && !existsInOld) {
      diff.push({ type: "added", content: newLine })
      newIndex++
      continue
    }
    
    // 如果旧行不存在于新文本中，则为删除行
    if (oldLine !== null && !existsInNew) {
      diff.push({ type: "removed", content: oldLine })
      oldIndex++
      continue
    }
    
    // 默认情况：标记为删除和新增
    if (oldLine !== null) {
      diff.push({ type: "removed", content: oldLine })
      oldIndex++
    }
    
    if (newLine !== null) {
      diff.push({ type: "added", content: newLine })
      newIndex++
    }
  }
  
  return diff
}

// 更精确的 diff 算法（Myers 差异算法简化版）
function myersDiff(oldText: string, newText: string): DiffLine[] {
  const oldLines = oldText.split("\n")
  const newLines = newText.split("\n")
  
  // 构建最长公共子序列矩阵
  const m = oldLines.length
  const n = newLines.length
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0))
  
  // 填充 DP 表
  for (let i = 0; i <= m; i++) {
    for (let j = 0; j <= n; j++) {
      if (i === 0) {
        dp[i][j] = j
      } else if (j === 0) {
        dp[i][j] = i
      } else if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1]
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1])
      }
    }
  }
  
  // 回溯构造 diff
  const diff: DiffLine[] = []
  let i = m
  let j = n
  
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      diff.unshift({ type: "unchanged", content: oldLines[i - 1] })
      i--
      j--
    } else if (j > 0 && (i === 0 || dp[i][j - 1] <= dp[i - 1][j])) {
      diff.unshift({ type: "added", content: newLines[j - 1] })
      j--
    } else if (i > 0 && (j === 0 || dp[i - 1][j] <= dp[i][j - 1])) {
      diff.unshift({ type: "removed", content: oldLines[i - 1] })
      i--
    }
  }
  
  return diff
}

export default function DiffPage({ params }: DiffPageProps) {
  const t = useTranslations("diff")

  const [oldText, setOldText] = useState("")
  const [newText, setNewText] = useState("")
  const [showLineNumbers, setShowLineNumbers] = useState(true)
  const [algorithm, setAlgorithm] = useState<"simple" | "myers">("myers")
  const [copied, setCopied] = useState(false)
  
  const oldTextareaRef = useRef<HTMLTextAreaElement>(null)
  const newTextareaRef = useRef<HTMLTextAreaElement>(null)
  const copyTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // 计算差异
  const diff = useMemo(() => {
    if (!oldText.trim() && !newText.trim()) {
      return []
    }
    
    return algorithm === "myers" 
      ? myersDiff(oldText, newText)
      : computeDiff(oldText, newText)
  }, [oldText, newText, algorithm])

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
            <div className="text-sm text-gray-500">
              {diff.filter(d => d.type !== "unchanged").length} {t("changes")}
            </div>
          </div>
          
          <div className="border rounded-lg overflow-hidden bg-white dark:bg-gray-900">
            {diff.length > 0 ? (
              <div className="max-h-96 overflow-y-auto">
                {diff.map((line, index) => renderDiffLine(line, index))}
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
