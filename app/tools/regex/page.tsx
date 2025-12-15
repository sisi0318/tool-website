"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useToast } from "@/hooks/use-toast"
import { 
  Search, Replace, Copy, Download, Upload, History, 
  Play, Pause, RotateCcw, Settings, BookOpen, 
  Zap, Target, Code, FileText, CheckCircle2, 
  AlertTriangle, Info, Clock, Hash, Eye, 
  ChevronDown, ChevronUp, Lightbulb, TestTube2
} from "lucide-react"

interface RegexToolProps {
  params?: Record<string, string>
}

interface RegexMatch {
  index: number
  match: string
  groups: (string | undefined)[]
  namedGroups?: { [key: string]: string }
  length: number
}

interface RegexFlags {
  global: boolean
  ignoreCase: boolean
  multiline: boolean
  dotAll: boolean
  unicode: boolean
  sticky: boolean
}

interface TestCase {
  id: string
  name: string
  pattern: string
  text: string
  flags: RegexFlags
  expectedMatches: number
  description?: string
}

interface RegexHistory {
  id: string
  pattern: string
  flags: string
  timestamp: number
  matchCount: number
}

export default function RegexTester({ params }: RegexToolProps) {
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 基本状态
  const [activeTab, setActiveTab] = useState("tester")
  const [pattern, setPattern] = useState("")
  const [testText, setTestText] = useState("")
  const [replaceText, setReplaceText] = useState("")
  
  // 标志位
  const [flags, setFlags] = useState<RegexFlags>({
    global: true,
    ignoreCase: false,
    multiline: false,
    dotAll: false,
    unicode: false,
    sticky: false
  })

  // 结果状态
  const [matches, setMatches] = useState<RegexMatch[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isValid, setIsValid] = useState(true)
  const [replaceResult, setReplaceResult] = useState("")
  const [executionTime, setExecutionTime] = useState<number>(0)

  // 界面状态
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [showFlags, setShowFlags] = useState(true)
  const [highlightMatches, setHighlightMatches] = useState(true)
  const [caseSensitive, setCaseSensitive] = useState(true)
  const [selectedMatch, setSelectedMatch] = useState<number | null>(null)

  // 历史和测试用例
  const [history, setHistory] = useState<RegexHistory[]>([])
  const [testCases, setTestCases] = useState<TestCase[]>([])
  const [showHistory, setShowHistory] = useState(false)

  // 预定义示例
  const examples = [
    {
      name: "邮箱验证",
      pattern: "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$",
      text: "test@example.com\ninvalid-email\nuser.name@domain.co.uk\njohn.doe@company.org",
      description: "验证邮箱地址格式",
      flags: { global: true, ignoreCase: false, multiline: true, dotAll: false, unicode: false, sticky: false }
    },
    {
      name: "手机号码",
      pattern: "^1[3-9]\\d{9}$",
      text: "13812345678\n12345678901\n15987654321\n18123456789",
      description: "中国大陆手机号码验证",
      flags: { global: true, ignoreCase: false, multiline: true, dotAll: false, unicode: false, sticky: false }
    },
    {
      name: "身份证号",
      pattern: "^\\d{17}[0-9Xx]$",
      text: "110101199003077071\n32052119900307707X\n123456789012345678\n110101990030770711",
      description: "18位身份证号码验证",
      flags: { global: true, ignoreCase: true, multiline: true, dotAll: false, unicode: false, sticky: false }
    },
    {
      name: "URL链接",
      pattern: "https?:\\/\\/(www\\.)?[-a-zA-Z0-9@:%._\\+~#=]{1,256}\\.[a-zA-Z0-9()]{1,6}\\b([-a-zA-Z0-9()@:%_\\+.~#?&//=]*)",
      text: "https://example.com\nhttp://subdomain.example.co.uk/path?query=value\nhttps://github.com/user/repo\nNot a URL",
      description: "HTTP/HTTPS URL匹配",
      flags: { global: true, ignoreCase: false, multiline: true, dotAll: false, unicode: false, sticky: false }
    },
    {
      name: "IP地址",
      pattern: "^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$",
      text: "192.168.1.1\n255.255.255.255\n192.168.1.300\n192.168.1\n127.0.0.1",
      description: "IPv4地址验证",
      flags: { global: true, ignoreCase: false, multiline: true, dotAll: false, unicode: false, sticky: false }
    },
    {
      name: "日期格式",
      pattern: "^\\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$",
      text: "2023-01-31\n2023-13-01\n2023-02-29\n01/31/2023\n2023-12-25",
      description: "YYYY-MM-DD 日期格式",
      flags: { global: true, ignoreCase: false, multiline: true, dotAll: false, unicode: false, sticky: false }
    },
    {
      name: "密码强度",
      pattern: "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]{8,}$",
      text: "Passw0rd!\npassword\nPassword\nPassword1\nMyStr0ng#Pass",
      description: "至少8位，包含大小写字母、数字和特殊字符",
      flags: { global: true, ignoreCase: false, multiline: true, dotAll: false, unicode: false, sticky: false }
    },
    {
      name: "中文字符",
      pattern: "[\\u4e00-\\u9fa5]+",
      text: "Hello 世界\n中文字符串\nEnglish Text\n测试123Test",
      description: "匹配中文字符",
      flags: { global: true, ignoreCase: false, multiline: false, dotAll: false, unicode: true, sticky: false }
    },
    {
      name: "HTML标签",
      pattern: "<\\/?[\\w\\s]*>|<.+[\\W]>",
      text: "<div>content</div>\n<p class=\"text\">paragraph</p>\n<br/>\n<img src=\"image.jpg\" alt=\"test\">",
      description: "匹配HTML标签",
      flags: { global: true, ignoreCase: true, multiline: true, dotAll: false, unicode: false, sticky: false }
    },
    {
      name: "JSON字符串",
      pattern: '"[^"]*"',
      text: '{"name": "John", "age": 30, "city": "New York"}\n"hello world"\n\'single quotes\'',
      description: "匹配JSON中的字符串值",
      flags: { global: true, ignoreCase: false, multiline: false, dotAll: false, unicode: false, sticky: false }
    }
  ]

  // 生成标志字符串
  const getFlagsString = useCallback(() => {
    let flagsStr = ""
    if (flags.global) flagsStr += "g"
    if (flags.ignoreCase) flagsStr += "i" 
    if (flags.multiline) flagsStr += "m"
    if (flags.dotAll) flagsStr += "s"
    if (flags.unicode) flagsStr += "u"
    if (flags.sticky) flagsStr += "y"
    return flagsStr
  }, [flags])

  // 测试正则表达式
  const testRegex = useCallback(() => {
    setError(null)
    setMatches([])
    setIsValid(true)
    setExecutionTime(0)

    if (!pattern || !testText) return

    try {
      const startTime = performance.now()
      const flagsStr = getFlagsString()
      const regex = new RegExp(pattern, flagsStr)
      
      const results: RegexMatch[] = []

      if (flags.global) {
        let match
        let iterationCount = 0
        const maxIterations = 10000 // 防止无限循环

        while ((match = regex.exec(testText)) !== null && iterationCount < maxIterations) {
          results.push({
            index: match.index,
            match: match[0],
            groups: match.slice(1),
            namedGroups: match.groups,
            length: match[0].length
          })

          iterationCount++
          
          // 防止无限循环
          if (match.index === regex.lastIndex) {
            regex.lastIndex++
          }
        }

        if (iterationCount >= maxIterations) {
          setError("正则表达式执行次数过多，可能存在无限循环")
          setIsValid(false)
          return
        }
      } else {
        const match = regex.exec(testText)
        if (match) {
          results.push({
            index: match.index,
            match: match[0],
            groups: match.slice(1),
            namedGroups: match.groups,
            length: match[0].length
          })
        }
      }

      const endTime = performance.now()
      setExecutionTime(endTime - startTime)
      setMatches(results)

      // 添加到历史记录
      addToHistory(pattern, getFlagsString(), results.length)
      
    } catch (err) {
      const errorMessage = (err as Error).message
      setError(errorMessage)
      setIsValid(false)
    }
  }, [pattern, testText, flags, getFlagsString])

  // 执行替换
  const performReplace = useCallback(() => {
    if (!pattern || !testText) {
      setReplaceResult("")
      return
    }

    try {
      const flagsStr = getFlagsString()
      const regex = new RegExp(pattern, flagsStr)
      const result = testText.replace(regex, replaceText)
      setReplaceResult(result)
    } catch (err) {
      setReplaceResult("替换失败: " + (err as Error).message)
    }
  }, [pattern, testText, replaceText, getFlagsString])

  // 添加到历史记录
  const addToHistory = useCallback((pattern: string, flags: string, matchCount: number) => {
    const historyItem: RegexHistory = {
      id: Date.now().toString(),
      pattern,
      flags,
      timestamp: Date.now(),
      matchCount
    }
    
    setHistory(prev => [historyItem, ...prev.slice(0, 49)]) // 保留最近50条
  }, [])

  // 高亮显示匹配项
  const getHighlightedText = useMemo(() => {
    if (!highlightMatches || !matches.length || !testText) return testText

    let result = ""
    let lastIndex = 0

    const sortedMatches = [...matches].sort((a, b) => a.index - b.index)

    sortedMatches.forEach((match, index) => {
      // 添加匹配前的文本
      result += testText.substring(lastIndex, match.index)
      
      // 添加高亮的匹配文本
      const isSelected = selectedMatch === index
      const highlightClass = isSelected 
        ? "bg-blue-200 dark:bg-blue-800 border-2 border-blue-500" 
        : "bg-yellow-200 dark:bg-yellow-800"
      
      result += `<mark class="${highlightClass} px-1 rounded cursor-pointer" data-match-index="${index}" title="匹配 ${index + 1}: 位置 ${match.index}">${match.match}</mark>`
      
      lastIndex = match.index + match.length
    })

    // 添加最后的文本
    result += testText.substring(lastIndex)

    return result
  }, [testText, matches, highlightMatches, selectedMatch])

  // 自动执行测试
  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      testRegex()
    }, 300)

    return () => clearTimeout(debounceTimer)
  }, [pattern, testText, flags])

  // 执行替换
  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      if (replaceText !== undefined) {
        performReplace()
      }
    }, 300)

    return () => clearTimeout(debounceTimer)
  }, [pattern, testText, replaceText, flags])

  // 加载示例
  const loadExample = useCallback((example: typeof examples[0]) => {
    setPattern(example.pattern)
    setTestText(example.text.replace(/\\n/g, '\\n'))
    setFlags(example.flags)
    toast({
      title: "示例已加载",
      description: example.name,
    })
  }, [toast])

  // 复制功能
  const copyToClipboard = useCallback((text: string, label: string) => {
    navigator.clipboard.writeText(text)
    toast({
      title: "已复制",
      description: `${label}已复制到剪贴板`,
    })
  }, [toast])

  // 导出测试用例
  const exportTestCase = useCallback(() => {
    const testCase = {
      pattern,
      text: testText,
      flags,
      replaceText,
      matches: matches.length,
      timestamp: new Date().toISOString()
    }
    
    const blob = new Blob([JSON.stringify(testCase, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `regex-test-case-${Date.now()}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    
    toast({
      title: "导出成功",
      description: "测试用例已导出为JSON文件",
    })
  }, [pattern, testText, flags, replaceText, matches, toast])

  // 导入测试用例
  const importTestCase = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const testCase = JSON.parse(e.target?.result as string)
        setPattern(testCase.pattern || "")
        setTestText(testCase.text || "")
        setFlags(testCase.flags || flags)
        setReplaceText(testCase.replaceText || "")
        
        toast({
          title: "导入成功",
          description: "测试用例已导入",
        })
      } catch (err) {
        toast({
          title: "导入失败",
          description: "文件格式不正确",
          variant: "destructive"
        })
      }
    }
    reader.readAsText(file)
  }, [flags, toast])

  // 清空所有内容
  const clearAll = useCallback(() => {
    setPattern("")
    setTestText("")
    setReplaceText("")
    setMatches([])
    setError(null)
    setReplaceResult("")
    setSelectedMatch(null)
  }, [])

  return (
    <TooltipProvider>
      <div className="container mx-auto py-6 px-4 max-w-7xl">
        {/* 页面标题 */}
        <div className="text-center space-y-4 mb-8">
          <h1 className="text-3xl font-bold flex items-center justify-center gap-2">
            <Search className="h-8 w-8 text-blue-500" />
            正则表达式测试工具
          </h1>
          <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            强大的正则表达式测试、匹配、替换和学习工具
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-5 mb-6">
            <TabsTrigger value="tester" className="flex items-center gap-2">
              <TestTube2 className="h-4 w-4" />
              测试器
            </TabsTrigger>
            <TabsTrigger value="replace" className="flex items-center gap-2">
              <Replace className="h-4 w-4" />
              替换器
            </TabsTrigger>
            <TabsTrigger value="examples" className="flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              示例库
            </TabsTrigger>
            <TabsTrigger value="reference" className="flex items-center gap-2">
              <Code className="h-4 w-4" />
              语法参考
            </TabsTrigger>
            <TabsTrigger value="tools" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              工具箱
            </TabsTrigger>
          </TabsList>

          {/* 测试器页面 */}
          <TabsContent value="tester" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* 左侧：输入区域 */}
              <div className="lg:col-span-2 space-y-6">
                {/* 正则表达式输入 */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        <Target className="h-5 w-5" />
                        正则表达式
                      </CardTitle>
                      <div className="flex items-center gap-2">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="sm" onClick={clearAll}>
                              <RotateCcw className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>清空所有内容</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="sm" onClick={() => copyToClipboard(pattern, "正则表达式")}>
                              <Copy className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>复制正则表达式</TooltipContent>
                        </Tooltip>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-mono">/</span>
                      <Input
                        value={pattern}
                        onChange={(e) => setPattern(e.target.value)}
                        placeholder="输入正则表达式..."
                        className={`font-mono ${error ? 'border-red-500' : isValid ? 'border-green-500' : ''}`}
                      />
                      <span className="text-lg font-mono">/{getFlagsString()}</span>
                    </div>

                    {/* 标志位控制 */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-medium">标志位</Label>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowFlags(!showFlags)}
                        >
                          {showFlags ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </Button>
                      </div>
                      
                      {showFlags && (
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                          <div className="flex items-center space-x-2">
                            <Switch
                              id="global"
                              checked={flags.global}
                              onCheckedChange={(checked) => setFlags(prev => ({ ...prev, global: checked }))}
                            />
                            <Label htmlFor="global" className="text-sm">
                              <span className="font-mono">g</span> 全局
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Switch
                              id="ignoreCase"
                              checked={flags.ignoreCase}
                              onCheckedChange={(checked) => setFlags(prev => ({ ...prev, ignoreCase: checked }))}
                            />
                            <Label htmlFor="ignoreCase" className="text-sm">
                              <span className="font-mono">i</span> 忽略大小写
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Switch
                              id="multiline"
                              checked={flags.multiline}
                              onCheckedChange={(checked) => setFlags(prev => ({ ...prev, multiline: checked }))}
                            />
                            <Label htmlFor="multiline" className="text-sm">
                              <span className="font-mono">m</span> 多行
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Switch
                              id="dotAll"
                              checked={flags.dotAll}
                              onCheckedChange={(checked) => setFlags(prev => ({ ...prev, dotAll: checked }))}
                            />
                            <Label htmlFor="dotAll" className="text-sm">
                              <span className="font-mono">s</span> 单行
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Switch
                              id="unicode"
                              checked={flags.unicode}
                              onCheckedChange={(checked) => setFlags(prev => ({ ...prev, unicode: checked }))}
                            />
                            <Label htmlFor="unicode" className="text-sm">
                              <span className="font-mono">u</span> Unicode
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Switch
                              id="sticky"
                              checked={flags.sticky}
                              onCheckedChange={(checked) => setFlags(prev => ({ ...prev, sticky: checked }))}
                            />
                            <Label htmlFor="sticky" className="text-sm">
                              <span className="font-mono">y</span> 粘性
                            </Label>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* 状态指示器 */}
                    <div className="flex items-center gap-4 text-sm">
                      {error ? (
                        <div className="flex items-center gap-2 text-red-500">
                          <AlertTriangle className="h-4 w-4" />
                          <span>语法错误</span>
                        </div>
                      ) : pattern ? (
                        <div className="flex items-center gap-2 text-green-500">
                          <CheckCircle2 className="h-4 w-4" />
                          <span>语法正确</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-gray-500">
                          <Info className="h-4 w-4" />
                          <span>等待输入</span>
                        </div>
                      )}
                      
                      {executionTime > 0 && (
                        <div className="flex items-center gap-2 text-blue-500">
                          <Clock className="h-4 w-4" />
                          <span>{executionTime.toFixed(2)}ms</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* 测试文本输入 */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5" />
                        测试文本
                      </CardTitle>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center space-x-2">
                          <Switch
                            id="highlight"
                            checked={highlightMatches}
                            onCheckedChange={setHighlightMatches}
                          />
                          <Label htmlFor="highlight" className="text-sm">高亮匹配</Label>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => copyToClipboard(testText, "测试文本")}>
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Textarea
                      value={testText}
                      onChange={(e) => setTestText(e.target.value)}
                      placeholder="输入要测试的文本..."
                      rows={8}
                      className="font-mono"
                    />
                  </CardContent>
                </Card>

                {/* 错误提示 */}
                {error && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      <strong>正则表达式错误:</strong> {error}
                    </AlertDescription>
                  </Alert>
                )}
              </div>

              {/* 右侧：结果区域 */}
              <div className="space-y-6">
                {/* 匹配统计 */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Hash className="h-5 w-5" />
                      匹配统计
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                        <div className="text-2xl font-bold text-blue-600">{matches.length}</div>
                        <div className="text-sm text-gray-500">匹配数量</div>
                      </div>
                      <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                        <div className="text-2xl font-bold text-green-600">
                          {testText ? Math.round((matches.length / testText.split('\\n').length) * 100) : 0}%
                        </div>
                        <div className="text-sm text-gray-500">匹配率</div>
                      </div>
                    </div>

                    {matches.length > 0 && (
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">匹配列表</Label>
                        <ScrollArea className="h-40">
                          <div className="space-y-1">
                            {matches.map((match, index) => (
                              <div
                                key={index}
                                className={`p-2 rounded border cursor-pointer transition-colors ${
                                  selectedMatch === index 
                                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                                    : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                                }`}
                                onClick={() => setSelectedMatch(selectedMatch === index ? null : index)}
                              >
                                <div className="flex items-center justify-between">
                                  <span className="text-sm font-medium">#{index + 1}</span>
                                  <Badge variant="outline" className="text-xs">
                                    位置 {match.index}
                                  </Badge>
                                </div>
                                <div className="text-sm font-mono truncate mt-1">
                                  "{match.match}"
                                </div>
                                {match.groups.length > 0 && (
                                  <div className="text-xs text-gray-500 mt-1">
                                    {match.groups.length} 个捕获组
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* 选中匹配的详细信息 */}
                {selectedMatch !== null && matches[selectedMatch] && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">匹配详情 #{selectedMatch + 1}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div>
                        <Label className="text-sm text-gray-500">完整匹配</Label>
                        <div className="font-mono text-sm p-2 bg-gray-50 dark:bg-gray-800 rounded">
                          "{matches[selectedMatch].match}"
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <Label className="text-gray-500">起始位置</Label>
                          <div className="font-medium">{matches[selectedMatch].index}</div>
                        </div>
                        <div>
                          <Label className="text-gray-500">长度</Label>
                          <div className="font-medium">{matches[selectedMatch].length}</div>
                        </div>
                      </div>
                      
                      {matches[selectedMatch].groups.length > 0 && (
                        <div>
                          <Label className="text-sm text-gray-500">捕获组</Label>
                          <div className="space-y-1 mt-2">
                            {matches[selectedMatch].groups.map((group, index) => (
                              <div key={index} className="flex items-center gap-2">
                                <Badge variant="secondary" className="text-xs">
                                  ${index + 1}
                                </Badge>
                                <span className="font-mono text-sm">
                                  "{group || '<empty>'}"
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {matches[selectedMatch].namedGroups && Object.keys(matches[selectedMatch].namedGroups!).length > 0 && (
                        <div>
                          <Label className="text-sm text-gray-500">命名捕获组</Label>
                          <div className="space-y-1 mt-2">
                            {Object.entries(matches[selectedMatch].namedGroups!).map(([name, value]) => (
                              <div key={name} className="flex items-center gap-2">
                                <Badge variant="secondary" className="text-xs">
                                  {name}
                                </Badge>
                                <span className="font-mono text-sm">"{value}"</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>

            {/* 高亮显示的测试文本 */}
            {testText && highlightMatches && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Eye className="h-5 w-5" />
                    高亮结果
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div 
                    className="font-mono text-sm p-4 bg-gray-50 dark:bg-gray-800 rounded border whitespace-pre-wrap break-words"
                    dangerouslySetInnerHTML={{ __html: getHighlightedText }}
                    onClick={(e) => {
                      const target = e.target as HTMLElement
                      if (target.tagName === 'MARK') {
                        const matchIndex = parseInt(target.dataset.matchIndex || '-1')
                        if (matchIndex >= 0) {
                          setSelectedMatch(matchIndex)
                        }
                      }
                    }}
                  />
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* 替换器页面 */}
          <TabsContent value="replace" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Replace className="h-5 w-5" />
                    替换设置
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="replace-pattern">正则表达式</Label>
                    <Input
                      id="replace-pattern"
                      value={pattern}
                      onChange={(e) => setPattern(e.target.value)}
                      placeholder="输入正则表达式..."
                      className="font-mono mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="replace-text">替换文本</Label>
                    <Input
                      id="replace-text"
                      value={replaceText}
                      onChange={(e) => setReplaceText(e.target.value)}
                      placeholder="输入替换文本 (支持 $1, $2 等引用捕获组)..."
                      className="font-mono mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="source-text">原始文本</Label>
                    <Textarea
                      id="source-text"
                      value={testText}
                      onChange={(e) => setTestText(e.target.value)}
                      placeholder="输入要替换的文本..."
                      rows={6}
                      className="font-mono mt-1"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      onClick={performReplace}
                      disabled={!pattern || !testText}
                      className="flex items-center gap-2"
                    >
                      <Replace className="h-4 w-4" />
                      执行替换
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => copyToClipboard(replaceResult, "替换结果")}
                      disabled={!replaceResult}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>替换结果</CardTitle>
                </CardHeader>
                <CardContent>
                  <Textarea
                    value={replaceResult}
                    readOnly
                    placeholder="替换结果将在这里显示..."
                    rows={12}
                    className="font-mono"
                  />
                  
                  {replaceResult && (
                    <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded">
                      <div className="text-sm text-blue-800 dark:text-blue-200">
                        <div>原始长度: {testText.length} 字符</div>
                        <div>替换后长度: {replaceResult.length} 字符</div>
                        <div>变化: {replaceResult.length - testText.length > 0 ? '+' : ''}{replaceResult.length - testText.length} 字符</div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* 替换帮助 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lightbulb className="h-5 w-5" />
                  替换语法帮助
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="p-3 border rounded">
                    <code className="text-sm">$&</code>
                    <div className="text-sm text-gray-600 mt-1">整个匹配</div>
                  </div>
                  <div className="p-3 border rounded">
                    <code className="text-sm">$1, $2, ...</code>
                    <div className="text-sm text-gray-600 mt-1">捕获组引用</div>
                  </div>
                  <div className="p-3 border rounded">
                    <code className="text-sm">$`</code>
                    <div className="text-sm text-gray-600 mt-1">匹配前的文本</div>
                  </div>
                  <div className="p-3 border rounded">
                    <code className="text-sm">$'</code>
                    <div className="text-sm text-gray-600 mt-1">匹配后的文本</div>
                  </div>
                  <div className="p-3 border rounded">
                    <code className="text-sm">$$</code>
                    <div className="text-sm text-gray-600 mt-1">字面量 $</div>
                  </div>
                  <div className="p-3 border rounded">
                    <code className="text-sm">\\n</code>
                    <div className="text-sm text-gray-600 mt-1">换行符</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* 示例库页面 */}
          <TabsContent value="examples" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {examples.map((example, index) => (
                <Card 
                  key={index}
                  className="cursor-pointer transition-all hover:shadow-md hover:scale-105"
                  onClick={() => loadExample(example)}
                >
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">{example.name}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded">
                      <code className="text-xs break-all">{example.pattern}</code>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {example.description}
                    </p>
                    <div className="flex items-center gap-2">
                      {Object.entries(example.flags).map(([flag, enabled]) => 
                        enabled && (
                          <Badge key={flag} variant="secondary" className="text-xs">
                            {flag === 'global' ? 'g' : 
                             flag === 'ignoreCase' ? 'i' : 
                             flag === 'multiline' ? 'm' : 
                             flag === 'dotAll' ? 's' : 
                             flag === 'unicode' ? 'u' : 
                             flag === 'sticky' ? 'y' : flag}
                          </Badge>
                        )
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* 语法参考页面 */}
          <TabsContent value="reference" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* 字符类 */}
              <Card>
                <CardHeader>
                  <CardTitle>字符类</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {[
                      { pattern: ".", desc: "匹配除换行符外的任意字符" },
                      { pattern: "\\d", desc: "匹配数字 [0-9]" },
                      { pattern: "\\D", desc: "匹配非数字 [^0-9]" },
                      { pattern: "\\w", desc: "匹配单词字符 [a-zA-Z0-9_]" },
                      { pattern: "\\W", desc: "匹配非单词字符" },
                      { pattern: "\\s", desc: "匹配空白字符" },
                      { pattern: "\\S", desc: "匹配非空白字符" },
                      { pattern: "[abc]", desc: "匹配 a、b 或 c" },
                      { pattern: "[^abc]", desc: "匹配除 a、b、c 外的字符" },
                      { pattern: "[a-z]", desc: "匹配小写字母" },
                      { pattern: "[A-Z]", desc: "匹配大写字母" },
                      { pattern: "[0-9]", desc: "匹配数字" }
                    ].map((item, index) => (
                      <div key={index} className="flex items-center gap-3 p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-800">
                        <code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-sm min-w-16 text-center">
                          {item.pattern}
                        </code>
                        <span className="text-sm">{item.desc}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* 量词 */}
              <Card>
                <CardHeader>
                  <CardTitle>量词</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {[
                      { pattern: "*", desc: "匹配 0 次或多次" },
                      { pattern: "+", desc: "匹配 1 次或多次" },
                      { pattern: "?", desc: "匹配 0 次或 1 次" },
                      { pattern: "{n}", desc: "匹配恰好 n 次" },
                      { pattern: "{n,}", desc: "匹配至少 n 次" },
                      { pattern: "{n,m}", desc: "匹配 n 到 m 次" },
                      { pattern: "*?", desc: "非贪婪匹配 0 次或多次" },
                      { pattern: "+?", desc: "非贪婪匹配 1 次或多次" },
                      { pattern: "??", desc: "非贪婪匹配 0 次或 1 次" }
                    ].map((item, index) => (
                      <div key={index} className="flex items-center gap-3 p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-800">
                        <code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-sm min-w-16 text-center">
                          {item.pattern}
                        </code>
                        <span className="text-sm">{item.desc}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* 锚点 */}
              <Card>
                <CardHeader>
                  <CardTitle>锚点</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {[
                      { pattern: "^", desc: "行开始" },
                      { pattern: "$", desc: "行结束" },
                      { pattern: "\\b", desc: "单词边界" },
                      { pattern: "\\B", desc: "非单词边界" },
                      { pattern: "\\A", desc: "字符串开始" },
                      { pattern: "\\Z", desc: "字符串结束" }
                    ].map((item, index) => (
                      <div key={index} className="flex items-center gap-3 p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-800">
                        <code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-sm min-w-16 text-center">
                          {item.pattern}
                        </code>
                        <span className="text-sm">{item.desc}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* 分组和引用 */}
              <Card>
                <CardHeader>
                  <CardTitle>分组和引用</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {[
                      { pattern: "(abc)", desc: "捕获组" },
                      { pattern: "(?:abc)", desc: "非捕获组" },
                      { pattern: "(?<name>abc)", desc: "命名捕获组" },
                      { pattern: "\\1", desc: "反向引用第一个捕获组" },
                      { pattern: "(?=abc)", desc: "正向先行断言" },
                      { pattern: "(?!abc)", desc: "负向先行断言" },
                      { pattern: "(?<=abc)", desc: "正向后行断言" },
                      { pattern: "(?<!abc)", desc: "负向后行断言" }
                    ].map((item, index) => (
                      <div key={index} className="flex items-center gap-3 p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-800">
                        <code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-sm min-w-20 text-center">
                          {item.pattern}
                        </code>
                        <span className="text-sm">{item.desc}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* 特殊字符 */}
              <Card>
                <CardHeader>
                  <CardTitle>特殊字符</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {[
                      { pattern: "\\", desc: "转义字符" },
                      { pattern: "|", desc: "或操作符" },
                      { pattern: "\\n", desc: "换行符" },
                      { pattern: "\\r", desc: "回车符" },
                      { pattern: "\\t", desc: "制表符" },
                      { pattern: "\\f", desc: "换页符" },
                      { pattern: "\\v", desc: "垂直制表符" },
                      { pattern: "\\0", desc: "空字符" }
                    ].map((item, index) => (
                      <div key={index} className="flex items-center gap-3 p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-800">
                        <code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-sm min-w-16 text-center">
                          {item.pattern}
                        </code>
                        <span className="text-sm">{item.desc}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* 标志位 */}
              <Card>
                <CardHeader>
                  <CardTitle>标志位</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {[
                      { pattern: "g", desc: "全局匹配，找到所有匹配项" },
                      { pattern: "i", desc: "忽略大小写" },
                      { pattern: "m", desc: "多行模式，^ 和 $ 匹配行开始和结束" },
                      { pattern: "s", desc: "单行模式，. 匹配包括换行符在内的所有字符" },
                      { pattern: "u", desc: "Unicode 模式" },
                      { pattern: "y", desc: "粘性模式，从 lastIndex 开始匹配" }
                    ].map((item, index) => (
                      <div key={index} className="flex items-center gap-3 p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-800">
                        <code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-sm min-w-8 text-center">
                          {item.pattern}
                        </code>
                        <span className="text-sm">{item.desc}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* 工具箱页面 */}
          <TabsContent value="tools" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* 导入导出 */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Download className="h-5 w-5" />
                    导入导出
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-2">
                    <Button onClick={exportTestCase} className="flex items-center gap-2">
                      <Download className="h-4 w-4" />
                      导出测试用例
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-2"
                    >
                      <Upload className="h-4 w-4" />
                      导入测试用例
                    </Button>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json"
                    style={{ display: 'none' }}
                    onChange={importTestCase}
                  />
                  <p className="text-sm text-gray-500">
                    导出的文件包含当前的正则表达式、测试文本、标志位和替换设置
                  </p>
                </CardContent>
              </Card>

              {/* 历史记录 */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <History className="h-5 w-5" />
                      历史记录
                    </CardTitle>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setHistory([])}
                      disabled={history.length === 0}
                    >
                      清空
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {history.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-4">
                      暂无历史记录
                    </p>
                  ) : (
                    <ScrollArea className="h-40">
                      <div className="space-y-2">
                        {history.slice(0, 10).map((item) => (
                          <div
                            key={item.id}
                            className="p-2 border rounded cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
                            onClick={() => {
                              setPattern(item.pattern)
                              setFlags({
                                global: item.flags.includes('g'),
                                ignoreCase: item.flags.includes('i'),
                                multiline: item.flags.includes('m'),
                                dotAll: item.flags.includes('s'),
                                unicode: item.flags.includes('u'),
                                sticky: item.flags.includes('y')
                              })
                            }}
                          >
                            <div className="flex items-center justify-between">
                              <code className="text-xs truncate flex-1">
                                /{item.pattern}/{item.flags}
                              </code>
                              <Badge variant="outline" className="text-xs ml-2">
                                {item.matchCount}
                              </Badge>
                            </div>
                            <div className="text-xs text-gray-500">
                              {new Date(item.timestamp).toLocaleString()}
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>

              {/* 性能统计 */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="h-5 w-5" />
                    性能统计
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded">
                      <div className="text-lg font-bold">{executionTime.toFixed(2)}ms</div>
                      <div className="text-sm text-gray-500">执行时间</div>
                    </div>
                    <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded">
                      <div className="text-lg font-bold">{testText.length}</div>
                      <div className="text-sm text-gray-500">文本长度</div>
                    </div>
                  </div>
                  
                  {executionTime > 0 && (
                    <div className="text-sm text-gray-600">
                      <div>• 匹配效率: {testText ? Math.round(testText.length / executionTime) : 0} 字符/ms</div>
                      <div>• 平均每个匹配: {matches.length > 0 ? (executionTime / matches.length).toFixed(2) : 0}ms</div>
                      {executionTime > 100 && (
                        <div className="text-orange-600 mt-2">
                          ⚠️ 执行时间较长，考虑优化正则表达式
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* 快捷操作 */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    快捷操作
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setPattern("\\d+")
                        setTestText("找到数字: 123, 456, 789")
                      }}
                    >
                      匹配数字
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setPattern("\\w+@\\w+\\.\\w+")
                        setTestText("邮箱: user@example.com, test@domain.org")
                      }}
                    >
                      匹配邮箱
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setPattern("https?://[^\\s]+")
                        setTestText("访问 https://example.com 和 http://test.org")
                      }}
                    >
                      匹配URL
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setPattern("[\\u4e00-\\u9fa5]+")
                        setTestText("Hello 世界, English 中文混合 text")
                      }}
                    >
                      匹配中文
                    </Button>
                  </div>
                  
                  <Separator />
                  
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setFlags({
                          global: true,
                          ignoreCase: false,
                          multiline: false,
                          dotAll: false,
                          unicode: false,
                          sticky: false
                        })
                      }}
                    >
                      重置标志位
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setTestText("这里是测试文本\\n可以包含多行内容\\n用于测试正则表达式")
                      }}
                    >
                      示例文本
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </TooltipProvider>
  )
}