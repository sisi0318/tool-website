"use client"

import { copyTextToClipboard } from "@/lib/clipboard"

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
import { zhDiff } from "@/lib/translations/zh-namespaces/diff"
import { useTextFileInput } from "@/hooks/use-text-file-input"
import { useUndoToast } from "@/hooks/use-undo-toast"
import {
  AlertTriangle,
  ArrowRightLeft,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  Eye,
  EyeOff,
  FileText,
  FileUp,
  Loader2,
  Trash2,
} from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { computeLineDiff, diffChangeStarts, diffLineNumbers, unifiedDiff, type DiffLine } from "@/lib/text-diff"
import { downloadBlob } from "@/lib/object-url"
import { SegmentedControl, SegmentedControlItem } from "@/components/ui/segmented-control"
import { StructuredDiffPanel } from "@/components/tools/structured-diff-panel"

const MAX_RENDERED_DIFF_LINES = 2_000

export default function DiffPage() {
  const t = useTranslations("diff", zhDiff)

  const [oldText, setOldText] = useState("")
  const [comparisonMode, setComparisonMode] = useState("text")
  const [newText, setNewText] = useState("")
  const [showLineNumbers, setShowLineNumbers] = useState(true)
  const tc = useTranslations("common")
  const showUndo = useUndoToast()
  // 打开文件整段替换某一侧，替换前留一份，提示里可以撤销
  const loadInto = (current: string, set: (value: string) => void) => (text: string) => {
    set(text)
    if (current.trim() && current !== text) showUndo(tc("inputReplacedByFile"), () => set(current))
  }
  const oldFile = useTextFileInput({ onText: loadInto(oldText, setOldText) })
  const newFile = useTextFileInput({ onText: loadInto(newText, setNewText) })
  const [algorithm, setAlgorithm] = useState<"simple" | "myers">("myers")
  const [ignoreWhitespace, setIgnoreWhitespace] = useState(false)
  const [copied, setCopied] = useState(false)
  // 当前停在第几处改动（diffChangeStarts 的下标）；-1 表示还没跳过
  const [currentChange, setCurrentChange] = useState(-1)
  const diffListRef = useRef<HTMLDivElement>(null)
  
  const oldTextareaRef = useRef<HTMLTextAreaElement>(null)
  const newTextareaRef = useRef<HTMLTextAreaElement>(null)
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const deferredOldText = useDeferredValue(oldText)
  const deferredNewText = useDeferredValue(newText)
  const isCalculating = deferredOldText !== oldText || deferredNewText !== newText

  // 计算差异
  const diffResult = useMemo(
    () => computeLineDiff(
      comparisonMode === "text" ? deferredOldText : "",
      comparisonMode === "text" ? deferredNewText : "",
      algorithm === "myers" ? "precise" : "quick",
      { ignoreWhitespace },
    ),
    [algorithm, comparisonMode, deferredNewText, deferredOldText, ignoreWhitespace],
  )
  const diff = diffResult.lines
  const renderedDiff = diff.slice(0, MAX_RENDERED_DIFF_LINES)
  const resultLimited = renderedDiff.length < diff.length
  // 以前显示的是差异结果的行序号；现在是两边文件里真实的行号
  const lineNumbers = useMemo(() => diffLineNumbers(renderedDiff), [renderedDiff])
  const changeStarts = useMemo(() => diffChangeStarts(renderedDiff), [renderedDiff])
  const activeChange = currentChange < changeStarts.length ? currentChange : -1

  // 上一处、下一处：滚到那处改动的第一行
  const goToChange = (step: 1 | -1) => {
    if (!changeStarts.length) return
    const next = activeChange < 0 ? (step > 0 ? 0 : changeStarts.length - 1) : (activeChange + step + changeStarts.length) % changeStarts.length
    setCurrentChange(next)
    diffListRef.current?.querySelector(`[data-diff-index="${changeStarts[next]}"]`)?.scrollIntoView?.({ block: "center" })
  }

  // 导出 unified diff，可以交给 git apply、patch 或代码评审工具
  const exportUnified = () => {
    const patch = unifiedDiff(diff)
    if (patch) downloadBlob(new Blob([patch], { type: "text/x-diff" }), "changes.diff")
  }

  // 复制差异结果
  const copyDiff = useCallback(() => {
    const diffText = diff.map(line => {
      switch (line.type) {
        case "added": return `+ ${line.content}`
        case "removed": return `- ${line.content}`
        default: return `  ${line.content}`
      }
    }).join("\n")
    
    void copyTextToClipboard(diffText).then((success) => {
      if (!success) return
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
    const numbers = lineNumbers[index]
    const isCurrent = activeChange >= 0 && changeStarts[activeChange] === index
    let lineClass = ""
    let prefix = ""
    
    switch (line.type) {
      case "added":
        lineClass = "bg-[var(--md-sys-color-primary-container)] text-[var(--md-sys-color-on-primary-container)] border-l-4 border-[var(--md-sys-color-primary)] pl-3"
        prefix = "+ "
        break
      case "removed":
        lineClass = "bg-[var(--md-sys-color-error-container)] text-[var(--md-sys-color-on-error-container)] border-l-4 border-[var(--md-sys-color-error)] pl-3"
        prefix = "- "
        break
      default:
        lineClass = "hover:bg-[var(--md-sys-color-surface-container)]"
        prefix = "  "
        break
    }
    
    return (
      <div
        key={index}
        data-diff-index={index}
        aria-current={isCurrent || undefined}
        className={`flex text-sm font-mono ${lineClass} ${isCurrent ? "ring-2 ring-inset ring-[var(--md-sys-color-tertiary)]" : ""}`}
      >
        {showLineNumbers && (
          <>
            <div className="w-10 shrink-0 text-right pr-2 text-[var(--md-sys-color-on-surface-variant)] select-none">
              {numbers?.old ?? ""}
            </div>
            <div className="w-10 shrink-0 text-right pr-3 text-[var(--md-sys-color-on-surface-variant)] select-none">
              {numbers?.new ?? ""}
            </div>
          </>
        )}
        {/* 保留空白：只改了缩进的行以前看起来一模一样 */}
        <div className="min-w-0 flex-1 whitespace-pre-wrap break-all">
          <span className="select-none">{prefix}</span>
          {line.content || <span className="text-[var(--md-sys-color-on-surface-variant)] italic">{' '}</span>}
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-4 max-w-6xl">
      <h2 className="text-2xl font-bold text-center mb-6">{t("title")}</h2>
      <SegmentedControl aria-label={t("comparisonMode")} value={comparisonMode} onValueChange={setComparisonMode} className="mb-5">
        <SegmentedControlItem value="text">{t("textMode")}</SegmentedControlItem>
        <SegmentedControlItem value="structured">{t("structuredMode")}</SegmentedControlItem>
      </SegmentedControl>

      {comparisonMode === "text" && <div className="space-y-6">
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
                variant={ignoreWhitespace ? "default" : "outline"}
                size="sm"
                aria-pressed={ignoreWhitespace}
                onClick={() => setIgnoreWhitespace(!ignoreWhitespace)}
              >
                {t("ignoreWhitespace")}
              </Button>
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
                        <Check className="h-4 w-4 mr-1 text-[var(--md-sys-color-primary)]" />
                      ) : (
                        <Copy className="h-4 w-4 mr-1" />
                      )}
                      {copied ? t("copied") : t("copy")}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{t("copyTooltip")}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <Button variant="outline" size="sm" onClick={exportUnified} disabled={diffResult.added + diffResult.removed === 0}>
                <Download className="h-4 w-4 mr-1" />
                {t("exportUnified")}
              </Button>
            </div>
          </div>
        </div>

        {/* 文本输入区域 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 原始文本 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="old-text">{t("originalText")}</Label>
              <Button type="button" variant="ghost" size="sm" onClick={oldFile.open} aria-label={`${tc("openFile")} · ${t("originalText")}`} className="h-8 gap-1.5 px-2">
                <FileUp className="h-4 w-4" />{tc("openFile")}
              </Button>
              <input {...oldFile.inputProps} />
            </div>
            <Textarea
              ref={oldTextareaRef}
              id="old-text"
              placeholder={t("originalPlaceholder")}
              value={oldText}
              onChange={(e) => setOldText(e.target.value)}
              {...oldFile.dropProps}
              rows={15}
              className="font-mono text-sm"
            />
          </div>
          
          {/* 新文本 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="new-text">{t("newText")}</Label>
              <Button type="button" variant="ghost" size="sm" onClick={newFile.open} aria-label={`${tc("openFile")} · ${t("newText")}`} className="h-8 gap-1.5 px-2">
                <FileUp className="h-4 w-4" />{tc("openFile")}
              </Button>
              <input {...newFile.inputProps} />
            </div>
            <Textarea
              ref={newTextareaRef}
              id="new-text"
              placeholder={t("newPlaceholder")}
              value={newText}
              onChange={(e) => setNewText(e.target.value)}
              {...newFile.dropProps}
              rows={15}
              className="font-mono text-sm"
            />
          </div>
        </div>

        {/* 差异显示区域 */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>{t("differences")}</Label>
            <div className="flex items-center gap-2 text-sm text-[var(--md-sys-color-on-surface-variant)]">
              {isCalculating && <Loader2 className="h-4 w-4 animate-spin" />}
              <span>
                {diffResult.added + diffResult.removed} {t("changes")}
              </span>
              {changeStarts.length > 0 && (
                <>
                  <span aria-live="polite">
                    {t("changePosition").replace("{current}", activeChange >= 0 ? String(activeChange + 1) : "-").replace("{total}", String(changeStarts.length))}
                  </span>
                  <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => goToChange(-1)} aria-label={t("previousChange")} title={t("previousChange")}>
                    <ChevronUp className="h-4 w-4" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => goToChange(1)} aria-label={t("nextChange")} title={t("nextChange")}>
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          </div>

          {algorithm === "myers" && diffResult.algorithmUsed === "quick" && (
            <div className="flex items-start gap-2 rounded-lg border border-[var(--md-sys-color-warning)]/40 bg-[var(--md-sys-color-warning-container)] p-3 text-sm text-[var(--md-sys-color-on-warning-container)]">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{t("preciseFallback")}</span>
            </div>
          )}

          {resultLimited && (
            <div className="rounded-lg bg-[var(--md-sys-color-secondary-container)] p-3 text-sm text-[var(--md-sys-color-on-secondary-container)]">
              {t("resultLimited").replace(
                "{count}",
                MAX_RENDERED_DIFF_LINES.toLocaleString(),
              )}
            </div>
          )}
          
          <div className="border rounded-lg overflow-hidden bg-[var(--md-sys-color-surface)]">
            {diff.length > 0 ? (
              <div ref={diffListRef} className="max-h-96 overflow-y-auto">
                {renderedDiff.map((line, index) => renderDiffLine(line, index))}
              </div>
            ) : (
              <div className="p-8 text-center text-[var(--md-sys-color-on-surface-variant)]">
                {t("noDifferences")}
              </div>
            )}
          </div>
          
          {/* 差异图例 */}
          <div className="flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-[var(--md-sys-color-primary)]"></div>
              <span>{t("added")}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-[var(--md-sys-color-error)]"></div>
              <span>{t("removed")}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-[var(--md-sys-color-outline-variant)]"></div>
              <span>{t("unchanged")}</span>
            </div>
          </div>
        </div>
      </div>}
      <div hidden={comparisonMode !== "structured"}>
        <StructuredDiffPanel left={oldText} right={newText} onLeftChange={setOldText} onRightChange={setNewText} active={comparisonMode === "structured"} />
      </div>
    </div>
  )
}
