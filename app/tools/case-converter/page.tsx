"use client"

import { copyTextToClipboard } from "@/lib/clipboard"

import { useState, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { 
  Copy, Trash2, ArrowRightLeft, Type, FileText,
  CaseSensitive, CaseUpper, CaseLower
} from "lucide-react"
import { M3Chip } from "@/components/m3/chip"
import { toUnicodeSentenceCase, toUnicodeTitleCase } from "@/lib/case-converter-tools"
import { useTranslations } from "@/hooks/use-translations"

type CaseType = 
  | 'uppercase' 
  | 'lowercase' 
  | 'capitalize' 
  | 'sentence' 
  | 'title' 
  | 'toggle' 
  | 'camel' 
  | 'pascal' 
  | 'snake' 
  | 'kebab'
  | 'constant'

interface CaseOption {
  id: CaseType
  description: string
  icon: React.ReactNode
}

const CASE_OPTIONS: CaseOption[] = [
  { id: "uppercase", description: "HELLO WORLD", icon: <CaseUpper className="h-4 w-4" /> },
  { id: "lowercase", description: "hello world", icon: <CaseLower className="h-4 w-4" /> },
  { id: "capitalize", description: "Hello world", icon: <CaseSensitive className="h-4 w-4" /> },
  { id: "title", description: "Hello World", icon: <Type className="h-4 w-4" /> },
  { id: "sentence", description: "Hello world. This is text.", icon: <Type className="h-4 w-4" /> },
  { id: "toggle", description: "hELLO wORLD", icon: <ArrowRightLeft className="h-4 w-4" /> },
  { id: "camel", description: "helloWorld", icon: <Type className="h-4 w-4" /> },
  { id: "pascal", description: "HelloWorld", icon: <Type className="h-4 w-4" /> },
  { id: "snake", description: "hello_world", icon: <Type className="h-4 w-4" /> },
  { id: "kebab", description: "hello-world", icon: <Type className="h-4 w-4" /> },
  { id: "constant", description: "HELLO_WORLD", icon: <Type className="h-4 w-4" /> },
]

export default function CaseConverterPage() {
  const { toast } = useToast()
  const t = useTranslations("caseConverter")
  const [inputText, setInputText] = useState("")
  const [outputText, setOutputText] = useState("")
  const [selectedCase, setSelectedCase] = useState<CaseType>("uppercase")

  // 转换函数
  const convertCase = useCallback((text: string, caseType: CaseType): string => {
    if (!text) return ""

    // 辅助函数：将文本分割为单词
    const splitWords = (str: string): string[] => {
      return str
        .replace(/([a-z])([A-Z])/g, '$1 $2') // camelCase -> camel Case
        .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2') // XMLParser -> XML Parser
        .replace(/[-_]/g, ' ') // snake_case, kebab-case -> spaces
        .split(/\s+/)
        .filter(word => word.length > 0)
    }

    switch (caseType) {
      case 'uppercase':
        return text.toUpperCase()
      
      case 'lowercase':
        return text.toLowerCase()
      
      case 'capitalize':
        return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase()
      
      case 'title':
        return toUnicodeTitleCase(text)
      
      case 'sentence':
        return toUnicodeSentenceCase(text)
      
      case 'toggle':
        return text.split('').map(char => 
          char === char.toUpperCase() ? char.toLowerCase() : char.toUpperCase()
        ).join('')
      
      case 'camel': {
        const words = splitWords(text)
        return words.map((word, index) => 
          index === 0 
            ? word.toLowerCase() 
            : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        ).join('')
      }
      
      case 'pascal': {
        const words = splitWords(text)
        return words.map(word => 
          word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        ).join('')
      }

      case 'snake': {
        const words = splitWords(text)
        return words.map(word => word.toLowerCase()).join('_')
      }
      
      case 'kebab': {
        const words = splitWords(text)
        return words.map(word => word.toLowerCase()).join('-')
      }
      
      case 'constant': {
        const words = splitWords(text)
        return words.map(word => word.toUpperCase()).join('_')
      }
      
      default:
        return text
    }
  }, [])

  // 处理转换
  const handleConvert = useCallback((caseType: CaseType) => {
    setSelectedCase(caseType)
    const result = convertCase(inputText, caseType)
    setOutputText(result)
  }, [inputText, convertCase])

  // 输入变化时自动转换
  const handleInputChange = useCallback((value: string) => {
    setInputText(value)
    const result = convertCase(value, selectedCase)
    setOutputText(result)
  }, [selectedCase, convertCase])

  // 复制结果
  const copyToClipboard = useCallback(async () => {
    if (!outputText) return
    try {
      if (!await copyTextToClipboard(outputText)) throw new Error("Clipboard unavailable")
      toast({ title: t("copied"), description: t("copiedDescription") })
    } catch {
      toast({ title: t("copyFailed"), variant: "destructive" })
    }
  }, [outputText, t, toast])

  // 清空
  const clearAll = useCallback(() => {
    setInputText("")
    setOutputText("")
  }, [])

  const loadExample = useCallback(() => {
    const example = "helloWorld API response_example"
    setInputText(example)
    setOutputText(convertCase(example, selectedCase))
  }, [convertCase, selectedCase])

  // 交换输入输出
  const swapText = useCallback(() => {
    setInputText(outputText)
    const result = convertCase(outputText, selectedCase)
    setOutputText(result)
  }, [outputText, selectedCase, convertCase])

  return (
    <div className="container mx-auto max-w-4xl px-4 py-4 sm:py-6">
      {/* 页面标题 */}
      <div className="text-center space-y-4 mb-8">
        <h1 className="text-3xl font-bold text-[var(--md-sys-color-on-surface)]">
          {t("title")}
        </h1>
        <p className="text-[var(--md-sys-color-on-surface-variant)] max-w-2xl mx-auto">
          {t("description")}
        </p>
      </div>

      <div className="space-y-6">
        {/* 转换类型选择 */}
        <Card className="card-elevated">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-[var(--md-sys-color-on-surface)]">
              <Type className="h-5 w-5" />
              {t("conversionType")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {CASE_OPTIONS.map((option) => (
                <M3Chip
                  key={option.id}
                  variant={selectedCase === option.id ? "filter" : "suggestion"}
                  selected={selectedCase === option.id}
                  onClick={() => handleConvert(option.id)}
                  className="cursor-pointer"
                >
                  <span className="flex items-center gap-1">
                    {option.icon}
                    {t(`options.${option.id}`)}
                  </span>
                </M3Chip>
              ))}
            </div>
            <p className="mt-3 text-sm text-[var(--md-sys-color-on-surface-variant)]">
              {t("example")}: {CASE_OPTIONS.find((option) => option.id === selectedCase)?.description}
            </p>
          </CardContent>
        </Card>

        {/* 输入输出区域 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 输入 */}
          <Card className="card-elevated min-w-0">
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-[var(--md-sys-color-on-surface)]">{t("inputText")}</CardTitle>
                <div className="flex flex-wrap items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={loadExample}>
                    <FileText className="h-4 w-4 mr-1" />
                    {t("loadExample")}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={clearAll}>
                    <Trash2 className="h-4 w-4 mr-1" />
                    {t("clear")}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Textarea
                aria-label={t("inputText")}
                placeholder={t("inputPlaceholder")}
                value={inputText}
                onChange={(e) => handleInputChange(e.target.value)}
                className="min-h-[200px] resize-none"
              />
              <div className="mt-2 text-xs text-[var(--md-sys-color-on-surface-variant)]">
                {t("characterCount")}: {inputText.length}
              </div>
            </CardContent>
          </Card>

          {/* 输出 */}
          <Card className="card-elevated min-w-0">
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-[var(--md-sys-color-on-surface)]">{t("result")}</CardTitle>
                <div className="flex flex-wrap gap-1">
                  <Button variant="ghost" size="sm" onClick={swapText} disabled={!outputText}>
                    <ArrowRightLeft className="h-4 w-4 mr-1" />
                    {t("swap")}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={copyToClipboard} disabled={!outputText}>
                    <Copy className="h-4 w-4 mr-1" />
                    {t("copy")}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Textarea
                aria-label={t("result")}
                value={outputText}
                readOnly
                className="min-h-[200px] resize-none bg-[var(--md-sys-color-surface-container-low)]"
                placeholder={t("outputPlaceholder")}
              />
              <div className="mt-2 text-xs text-[var(--md-sys-color-on-surface-variant)]">
                {t("characterCount")}: {outputText.length}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
