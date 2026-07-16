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
import { Check, Copy, FileText, Loader2, Trash2 } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import {
  calculateTextStatistics,
  calculateWordFrequency,
} from "@/lib/text-statistics"

export default function TextStatsPage() {
  const t = useTranslations("textStats")

  const [text, setText] = useState("")
  const [copied, setCopied] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const copyTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const deferredText = useDeferredValue(text)
  const isAnalyzing = deferredText !== text

  // 计算统计数据
  const stats = useMemo(
    () => calculateTextStatistics(deferredText),
    [deferredText],
  )
  
  // 计算词频
  const wordFrequencyResult = useMemo(
    () => calculateWordFrequency(deferredText),
    [deferredText],
  )
  const wordFrequency = wordFrequencyResult.items

  // 复制统计结果
  const copyStats = useCallback(() => {
    const statsText = `
${t("characters")}: ${stats.characters}
${t("charactersNoSpaces")}: ${stats.charactersNoSpaces}
${t("words")}: ${stats.words}
${t("sentences")}: ${stats.sentences}
${t("paragraphs")}: ${stats.paragraphs}
${t("lines")}: ${stats.lines}
${t("chineseCharacters")}: ${stats.chineseCharacters}
${t("englishWords")}: ${stats.englishWords}
${t("readingTime")}: ${stats.readingTime} ${t("minutes")}
${t("speakingTime")}: ${stats.speakingTime} ${t("minutes")}
    `.trim()
    
    navigator.clipboard.writeText(statsText).then(() => {
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current)
      }
      setCopied(true)
      copyTimeoutRef.current = setTimeout(() => {
        setCopied(false)
      }, 2000)
    })
  }, [stats, t])

  // 清空文本
  const handleClear = () => {
    setText("")
    textareaRef.current?.focus()
  }

  // 粘贴示例
  const pasteExample = () => {
    const example = `这是一段示例文本，用于测试文本统计功能。

This is an example paragraph in English. It contains multiple sentences! How many words can you count?

第二段中文内容。包含了数字123和标点符号，以及English混合文字。

最后一段。感谢使用！`
    setText(example)
  }

  return (
    <div className="container mx-auto px-4 py-4 max-w-4xl">
      <h2 className="text-2xl font-bold text-center mb-6">{t("title")}</h2>

      <div className="space-y-6">
        {/* 输入区域 */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="text">{t("inputLabel")}</Label>
            <div className="flex items-center gap-2">
              {isAnalyzing && (
                <span className="flex items-center gap-1 text-xs text-gray-500">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  {t("analyzing")}
                </span>
              )}
              <Button variant="ghost" size="sm" onClick={pasteExample}>
                <FileText className="h-4 w-4 mr-1" />
                {t("example")}
              </Button>
              <Button variant="ghost" size="sm" onClick={handleClear}>
                <Trash2 className="h-4 w-4 mr-1" />
                {t("clear")}
              </Button>
            </div>
          </div>
          <Textarea
            ref={textareaRef}
            id="text"
            placeholder={t("inputPlaceholder")}
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={8}
            className="font-mono text-sm"
          />
        </div>

        {/* 主要统计数据 */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          <StatCard label={t("characters")} value={stats.characters} />
          <StatCard label={t("charactersNoSpaces")} value={stats.charactersNoSpaces} />
          <StatCard label={t("words")} value={stats.words} />
          <StatCard label={t("sentences")} value={stats.sentences} />
          <StatCard label={t("paragraphs")} value={stats.paragraphs} />
          <StatCard label={t("lines")} value={stats.lines} />
          <StatCard label={t("chineseCharacters")} value={stats.chineseCharacters} />
          <StatCard label={t("englishWords")} value={stats.englishWords} />
        </div>

        {/* 详细统计 */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard label={t("numbers")} value={stats.numbers} small />
          <StatCard label={t("punctuation")} value={stats.punctuation} small />
          <StatCard label={t("spaces")} value={stats.spaces} small />
          <StatCard 
            label={t("readingTime")} 
            value={`${stats.readingTime} ${t("minutes")}`} 
            small 
          />
        </div>

        {/* 复制按钮 */}
        <div className="flex justify-center">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" onClick={copyStats}>
                  {copied ? (
                    <Check className="h-4 w-4 mr-2 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4 mr-2" />
                  )}
                  {copied ? t("copied") : t("copyStats")}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t("copyStatsTooltip")}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* 词频统计 */}
        {wordFrequency.length > 0 && (
          <div className="space-y-3">
            <Label>{t("wordFrequency")}</Label>
            {wordFrequencyResult.truncated && (
              <div className="rounded-lg bg-blue-50 p-3 text-xs text-blue-800 dark:bg-blue-950/30 dark:text-blue-200">
                {t("frequencyLimited").replace(
                  "{count}",
                  wordFrequencyResult.analyzedCharacters.toLocaleString(),
                )}
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              {wordFrequency.map(({ word, count }, index) => (
                <div
                  key={index}
                  className="px-3 py-1.5 bg-gray-100 dark:bg-gray-800 rounded-full text-sm flex items-center gap-2"
                >
                  <span className="font-medium">{word}</span>
                  <span className="text-gray-500 dark:text-gray-400 text-xs">
                    ×{count}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// 统计卡片组件
function StatCard({ 
  label, 
  value, 
  small = false 
}: { 
  label: string
  value: number | string
  small?: boolean 
}) {
  return (
    <div className={`
      p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg
      ${small ? 'p-3' : 'p-4'}
    `}>
      <div className={`
        font-bold text-primary
        ${small ? 'text-xl' : 'text-2xl'}
      `}>
        {value}
      </div>
      <div className={`
        text-gray-600 dark:text-gray-400
        ${small ? 'text-xs' : 'text-sm'}
      `}>
        {label}
      </div>
    </div>
  )
}
