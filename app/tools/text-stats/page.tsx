"use client"

import type React from "react"
import { useState, useMemo, useCallback, useRef } from "react"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { useTranslations } from "@/hooks/use-translations"
import { Copy, Check, Trash2, FileText } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface TextStatsPageProps {
  params?: {
    feature?: string
  }
}

interface TextStatistics {
  characters: number
  charactersNoSpaces: number
  words: number
  sentences: number
  paragraphs: number
  lines: number
  chineseCharacters: number
  englishWords: number
  numbers: number
  punctuation: number
  spaces: number
  readingTime: number // 分钟
  speakingTime: number // 分钟
}

interface WordFrequency {
  word: string
  count: number
}

// 计算文本统计
function calculateStats(text: string): TextStatistics {
  if (!text) {
    return {
      characters: 0,
      charactersNoSpaces: 0,
      words: 0,
      sentences: 0,
      paragraphs: 0,
      lines: 0,
      chineseCharacters: 0,
      englishWords: 0,
      numbers: 0,
      punctuation: 0,
      spaces: 0,
      readingTime: 0,
      speakingTime: 0,
    }
  }

  // 字符数
  const characters = text.length
  
  // 不含空格的字符数
  const charactersNoSpaces = text.replace(/\s/g, "").length
  
  // 空格数
  const spaces = (text.match(/\s/g) || []).length
  
  // 中文字符数
  const chineseCharacters = (text.match(/[\u4e00-\u9fa5]/g) || []).length
  
  // 英文单词数
  const englishWords = (text.match(/[a-zA-Z]+/g) || []).length
  
  // 数字数
  const numbers = (text.match(/\d/g) || []).length
  
  // 标点符号
  const punctuation = (text.match(/[.,!?;:'"()[\]{}<>，。！？；：""''（）【】《》、]/g) || []).length
  
  // 总单词数（英文单词 + 中文字符）
  const words = englishWords + chineseCharacters
  
  // 句子数（按句号、问号、感叹号分割）
  const sentences = (text.match(/[.!?。！？]+/g) || []).length || (text.trim() ? 1 : 0)
  
  // 段落数（按空行分割）
  const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim()).length || (text.trim() ? 1 : 0)
  
  // 行数
  const lines = text.split("\n").length
  
  // 阅读时间（假设每分钟阅读 200 个中文字或 250 个英文单词）
  const readingTime = Math.ceil((chineseCharacters / 200) + (englishWords / 250))
  
  // 朗读时间（假设每分钟朗读 150 个中文字或 150 个英文单词）
  const speakingTime = Math.ceil((chineseCharacters / 150) + (englishWords / 150))

  return {
    characters,
    charactersNoSpaces,
    words,
    sentences,
    paragraphs,
    lines,
    chineseCharacters,
    englishWords,
    numbers,
    punctuation,
    spaces,
    readingTime,
    speakingTime,
  }
}

// 计算词频
function calculateWordFrequency(text: string, limit: number = 10): WordFrequency[] {
  if (!text.trim()) return []
  
  const wordMap = new Map<string, number>()
  
  // 提取中文词汇（简单按字分割）
  const chineseChars = text.match(/[\u4e00-\u9fa5]+/g) || []
  chineseChars.forEach((word) => {
    // 对于中文，我们按2-4字的词组来统计
    if (word.length >= 2) {
      for (let len = 2; len <= Math.min(4, word.length); len++) {
        for (let i = 0; i <= word.length - len; i++) {
          const subWord = word.slice(i, i + len)
          wordMap.set(subWord, (wordMap.get(subWord) || 0) + 1)
        }
      }
    }
  })
  
  // 提取英文单词
  const englishWords = text.toLowerCase().match(/[a-zA-Z]+/g) || []
  englishWords.forEach((word) => {
    if (word.length >= 2) {
      wordMap.set(word, (wordMap.get(word) || 0) + 1)
    }
  })
  
  // 排序并取前N个
  return Array.from(wordMap.entries())
    .filter(([_, count]) => count >= 2) // 至少出现2次
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([word, count]) => ({ word, count }))
}

export default function TextStatsPage({ params }: TextStatsPageProps) {
  const t = useTranslations("textStats")

  const [text, setText] = useState("")
  const [copied, setCopied] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const copyTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // 计算统计数据
  const stats = useMemo(() => calculateStats(text), [text])
  
  // 计算词频
  const wordFrequency = useMemo(() => calculateWordFrequency(text), [text])

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
