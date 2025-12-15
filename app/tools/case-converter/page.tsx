"use client"

import { useState, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { 
  Copy, Trash2, ArrowRightLeft, Type,
  CaseSensitive, CaseUpper, CaseLower
} from "lucide-react"
import { M3Chip } from "@/components/m3/chip"

interface CaseConverterProps {
  params?: Record<string, string>
}

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
  name: string
  description: string
  icon: React.ReactNode
}

export default function CaseConverterPage({ params }: CaseConverterProps) {
  const { toast } = useToast()
  const [inputText, setInputText] = useState("")
  const [outputText, setOutputText] = useState("")
  const [selectedCase, setSelectedCase] = useState<CaseType>("uppercase")

  const caseOptions: CaseOption[] = [
    { id: 'uppercase', name: '全大写', description: 'HELLO WORLD', icon: <CaseUpper className="h-4 w-4" /> },
    { id: 'lowercase', name: '全小写', description: 'hello world', icon: <CaseLower className="h-4 w-4" /> },
    { id: 'capitalize', name: '首字母大写', description: 'Hello world', icon: <CaseSensitive className="h-4 w-4" /> },
    { id: 'title', name: '标题格式', description: 'Hello World', icon: <Type className="h-4 w-4" /> },
    { id: 'sentence', name: '句子格式', description: 'Hello world. This is text.', icon: <Type className="h-4 w-4" /> },
    { id: 'toggle', name: '大小写反转', description: 'hELLO wORLD', icon: <ArrowRightLeft className="h-4 w-4" /> },
    { id: 'camel', name: '驼峰命名', description: 'helloWorld', icon: <Type className="h-4 w-4" /> },
    { id: 'pascal', name: '帕斯卡命名', description: 'HelloWorld', icon: <Type className="h-4 w-4" /> },
    { id: 'snake', name: '蛇形命名', description: 'hello_world', icon: <Type className="h-4 w-4" /> },
    { id: 'kebab', name: '短横线命名', description: 'hello-world', icon: <Type className="h-4 w-4" /> },
    { id: 'constant', name: '常量命名', description: 'HELLO_WORLD', icon: <Type className="h-4 w-4" /> },
  ]

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
        return text.toLowerCase().replace(/\b\w/g, char => char.toUpperCase())
      
      case 'sentence':
        return text.toLowerCase().replace(/(^\s*\w|[.!?]\s*\w)/g, char => char.toUpperCase())
      
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
      await navigator.clipboard.writeText(outputText)
      toast({ title: "已复制", description: "结果已复制到剪贴板" })
    } catch {
      toast({ title: "复制失败", variant: "destructive" })
    }
  }, [outputText, toast])

  // 清空
  const clearAll = useCallback(() => {
    setInputText("")
    setOutputText("")
  }, [])

  // 交换输入输出
  const swapText = useCallback(() => {
    setInputText(outputText)
    const result = convertCase(outputText, selectedCase)
    setOutputText(result)
  }, [outputText, selectedCase, convertCase])

  return (
    <div className="container mx-auto py-6 px-4 max-w-4xl">
      {/* 页面标题 */}
      <div className="text-center space-y-4 mb-8">
        <h1 className="text-3xl font-bold text-[var(--md-sys-color-on-surface)]">
          大小写转换工具
        </h1>
        <p className="text-[var(--md-sys-color-on-surface-variant)] max-w-2xl mx-auto">
          快速转换文本大小写，支持多种命名格式
        </p>
      </div>

      <div className="space-y-6">
        {/* 转换类型选择 */}
        <Card className="card-elevated">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-[var(--md-sys-color-on-surface)]">
              <Type className="h-5 w-5" />
              转换类型
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {caseOptions.map((option) => (
                <M3Chip
                  key={option.id}
                  variant={selectedCase === option.id ? "filter" : "suggestion"}
                  selected={selectedCase === option.id}
                  onClick={() => handleConvert(option.id)}
                  className="cursor-pointer"
                >
                  <span className="flex items-center gap-1">
                    {option.icon}
                    {option.name}
                  </span>
                </M3Chip>
              ))}
            </div>
            <p className="mt-3 text-sm text-[var(--md-sys-color-on-surface-variant)]">
              示例: {caseOptions.find(o => o.id === selectedCase)?.description}
            </p>
          </CardContent>
        </Card>

        {/* 输入输出区域 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 输入 */}
          <Card className="card-elevated">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-[var(--md-sys-color-on-surface)]">输入文本</CardTitle>
                <Button variant="ghost" size="sm" onClick={clearAll}>
                  <Trash2 className="h-4 w-4 mr-1" />
                  清空
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="在此输入要转换的文本..."
                value={inputText}
                onChange={(e) => handleInputChange(e.target.value)}
                className="min-h-[200px] resize-none"
              />
              <div className="mt-2 text-xs text-[var(--md-sys-color-on-surface-variant)]">
                字符数: {inputText.length}
              </div>
            </CardContent>
          </Card>

          {/* 输出 */}
          <Card className="card-elevated">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-[var(--md-sys-color-on-surface)]">转换结果</CardTitle>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={swapText} disabled={!outputText}>
                    <ArrowRightLeft className="h-4 w-4 mr-1" />
                    交换
                  </Button>
                  <Button variant="ghost" size="sm" onClick={copyToClipboard} disabled={!outputText}>
                    <Copy className="h-4 w-4 mr-1" />
                    复制
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Textarea
                value={outputText}
                readOnly
                className="min-h-[200px] resize-none bg-[var(--md-sys-color-surface-variant)]"
                placeholder="转换结果将显示在这里..."
              />
              <div className="mt-2 text-xs text-[var(--md-sys-color-on-surface-variant)]">
                字符数: {outputText.length}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
