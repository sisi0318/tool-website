"use client"

import { copyTextToClipboard as writeClipboardText } from "@/lib/clipboard"

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
import { useTranslations } from "@/hooks/use-translations"
import { buildRegexHighlightSegments } from "@/lib/regex-highlight"
import { downloadBlob } from "@/lib/object-url"
import { 
  Search, Replace, Copy, Download, Upload, History, 
  RotateCcw, Settings, BookOpen,
  Zap, Target, Code, FileText, CheckCircle2, 
  AlertTriangle, Info, Clock, Hash, Eye, 
  ChevronDown, ChevronUp, Lightbulb, TestTube2
} from "lucide-react"

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

interface RegexExample {
  id: "email" | "phone" | "idCard" | "url" | "ipv4" | "date" | "password" | "han" | "html" | "json"
  pattern: string
  text: string
  flags: RegexFlags
}

interface RegexHistory {
  id: string
  pattern: string
  flags: string
  timestamp: number
  matchCount: number
}

const FLAG_OPTIONS: Array<{ key: keyof RegexFlags; flag: string; labelKey: string }> = [
  { key: "global", flag: "g", labelKey: "flags.global" },
  { key: "ignoreCase", flag: "i", labelKey: "flags.caseInsensitive" },
  { key: "multiline", flag: "m", labelKey: "flags.multiline" },
  { key: "dotAll", flag: "s", labelKey: "flags.dotAll" },
  { key: "unicode", flag: "u", labelKey: "flags.unicode" },
  { key: "sticky", flag: "y", labelKey: "flags.sticky" },
]

const REGEX_EXAMPLES: RegexExample[] = [
  {
    id: "email",
    pattern: "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$",
    text: "test@example.com\ninvalid-email\nuser.name@domain.co.uk\njohn.doe@company.org",
    flags: { global: true, ignoreCase: false, multiline: true, dotAll: false, unicode: false, sticky: false },
  },
  {
    id: "phone",
    pattern: "^1[3-9]\\d{9}$",
    text: "13812345678\n12345678901\n15987654321\n18123456789",
    flags: { global: true, ignoreCase: false, multiline: true, dotAll: false, unicode: false, sticky: false },
  },
  {
    id: "idCard",
    pattern: "^\\d{17}[0-9Xx]$",
    text: "110101199003077071\n32052119900307707X\n123456789012345678\n110101990030770711",
    flags: { global: true, ignoreCase: true, multiline: true, dotAll: false, unicode: false, sticky: false },
  },
  {
    id: "url",
    pattern: "https?:\\/\\/(www\\.)?[-a-zA-Z0-9@:%._\\+~#=]{1,256}\\.[a-zA-Z0-9()]{1,6}\\b([-a-zA-Z0-9()@:%_\\+.~#?&//=]*)",
    text: "https://example.com\nhttp://subdomain.example.co.uk/path?query=value\nhttps://github.com/user/repo\nNot a URL",
    flags: { global: true, ignoreCase: false, multiline: true, dotAll: false, unicode: false, sticky: false },
  },
  {
    id: "ipv4",
    pattern: "^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$",
    text: "192.168.1.1\n255.255.255.255\n192.168.1.300\n192.168.1\n127.0.0.1",
    flags: { global: true, ignoreCase: false, multiline: true, dotAll: false, unicode: false, sticky: false },
  },
  {
    id: "date",
    pattern: "^\\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$",
    text: "2023-01-31\n2023-13-01\n2023-02-29\n01/31/2023\n2023-12-25",
    flags: { global: true, ignoreCase: false, multiline: true, dotAll: false, unicode: false, sticky: false },
  },
  {
    id: "password",
    pattern: "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]{8,}$",
    text: "Passw0rd!\npassword\nPassword\nPassword1\nMyStr0ng#Pass",
    flags: { global: true, ignoreCase: false, multiline: true, dotAll: false, unicode: false, sticky: false },
  },
  {
    id: "han",
    pattern: "[\\u4e00-\\u9fa5]+",
    text: "Hello 世界\n中文字符串\nEnglish Text\n测试123Test",
    flags: { global: true, ignoreCase: false, multiline: false, dotAll: false, unicode: true, sticky: false },
  },
  {
    id: "html",
    pattern: "<\\/?[\\w\\s]*>|<.+[\\W]>",
    text: "<div>content</div>\n<p class=\"text\">paragraph</p>\n<br/>\n<img src=\"image.jpg\" alt=\"test\">",
    flags: { global: true, ignoreCase: true, multiline: true, dotAll: false, unicode: false, sticky: false },
  },
  {
    id: "json",
    pattern: '"[^"]*"',
    text: '{"name": "John", "age": 30, "city": "New York"}\n"hello world"\n\'single quotes\'',
    flags: { global: true, ignoreCase: false, multiline: false, dotAll: false, unicode: false, sticky: false },
  },
]

const REPLACEMENT_HELP = [
  { pattern: "$&", descriptionKey: "replacementHelp.fullMatch" },
  { pattern: "$1, $2, ...", descriptionKey: "replacementHelp.captureReference" },
  { pattern: "$`", descriptionKey: "replacementHelp.beforeMatch" },
  { pattern: "$'", descriptionKey: "replacementHelp.afterMatch" },
  { pattern: "$$", descriptionKey: "replacementHelp.literalDollar" },
  { pattern: "\\n", descriptionKey: "replacementHelp.newline" },
]

const REFERENCE_SECTIONS = [
  {
    titleKey: "cheatsheet.characterClasses",
    items: [
      [".", "cheatsheet.anyChar"],
      ["\\d", "cheatsheet.digit"],
      ["\\D", "cheatsheet.nonDigit"],
      ["\\w", "cheatsheet.wordChar"],
      ["\\W", "cheatsheet.nonWordChar"],
      ["\\s", "cheatsheet.whitespace"],
      ["\\S", "cheatsheet.nonWhitespace"],
      ["[abc]", "cheatsheet.anyOfChars"],
      ["[^abc]", "cheatsheet.notChars"],
      ["[a-z]", "cheatsheet.lowercaseRange"],
      ["[A-Z]", "cheatsheet.uppercaseRange"],
      ["[0-9]", "cheatsheet.numericRange"],
    ],
  },
  {
    titleKey: "cheatsheet.quantifiers",
    items: [
      ["*", "cheatsheet.zeroOrMore"],
      ["+", "cheatsheet.oneOrMore"],
      ["?", "cheatsheet.zeroOrOne"],
      ["{n}", "cheatsheet.exactlyN"],
      ["{n,}", "cheatsheet.nOrMore"],
      ["{n,m}", "cheatsheet.betweenNAndM"],
      ["*?", "cheatsheet.lazyZeroOrMore"],
      ["+?", "cheatsheet.lazyOneOrMore"],
      ["??", "cheatsheet.lazyZeroOrOne"],
    ],
  },
  {
    titleKey: "cheatsheet.anchors",
    items: [
      ["^", "cheatsheet.startOfLine"],
      ["$", "cheatsheet.endOfLine"],
      ["\\b", "cheatsheet.wordBoundary"],
      ["\\B", "cheatsheet.nonWordBoundary"],
      ["\\A", "cheatsheet.startOfString"],
      ["\\Z", "cheatsheet.endOfString"],
    ],
  },
  {
    titleKey: "cheatsheet.groups",
    items: [
      ["(abc)", "cheatsheet.captureGroup"],
      ["(?:abc)", "cheatsheet.nonCaptureGroup"],
      ["(?<name>abc)", "cheatsheet.namedCaptureGroup"],
      ["\\1", "cheatsheet.backreference"],
      ["(?=abc)", "cheatsheet.positiveLookahead"],
      ["(?!abc)", "cheatsheet.negativeLookahead"],
      ["(?<=abc)", "cheatsheet.positiveLookbehind"],
      ["(?<!abc)", "cheatsheet.negativeLookbehind"],
    ],
  },
  {
    titleKey: "cheatsheet.specialCharacters",
    items: [
      ["\\", "cheatsheet.escapeSpecialChar"],
      ["|", "cheatsheet.alternation"],
      ["\\n", "cheatsheet.newline"],
      ["\\r", "cheatsheet.carriageReturn"],
      ["\\t", "cheatsheet.tab"],
      ["\\f", "cheatsheet.formFeed"],
      ["\\v", "cheatsheet.verticalTab"],
      ["\\0", "cheatsheet.nullCharacter"],
    ],
  },
  {
    titleKey: "cheatsheet.flags",
    items: [
      ["g", "cheatsheet.globalFlag"],
      ["i", "cheatsheet.ignoreCaseFlag"],
      ["m", "cheatsheet.multilineFlag"],
      ["s", "cheatsheet.dotAllFlag"],
      ["u", "cheatsheet.unicodeFlag"],
      ["y", "cheatsheet.stickyFlag"],
    ],
  },
] as const

export default function RegexTester() {
  const { toast } = useToast()
  const t = useTranslations("regex")
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
  const [showFlags, setShowFlags] = useState(true)
  const [highlightMatches, setHighlightMatches] = useState(true)
  const [selectedMatch, setSelectedMatch] = useState<number | null>(null)

  // 历史记录
  const [history, setHistory] = useState<RegexHistory[]>([])

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
          setError(t("iterationLimit"))
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
  }, [pattern, testText, flags, getFlagsString, t])

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
      setReplaceResult(`${t("replaceFailed")}: ${(err as Error).message}`)
    }
  }, [pattern, testText, replaceText, getFlagsString, t])

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
  const highlightedTextSegments = useMemo(
    () => buildRegexHighlightSegments(testText, highlightMatches ? matches : []),
    [testText, matches, highlightMatches],
  )

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
  const loadExample = useCallback((example: RegexExample) => {
    setPattern(example.pattern)
    setTestText(example.text.replace(/\\n/g, "\n"))
    setFlags(example.flags)
    toast({
      title: t("exampleLoaded"),
      description: t(`examples.${example.id}`),
    })
  }, [t, toast])

  // 复制功能
  const copyToClipboard = useCallback((text: string, label: string) => {
    void writeClipboardText(text).then((success) => {
      toast({
        title: success ? t("copied") : t("copyFailed"),
        description: success ? t("copiedDescription").replace("{label}", label) : undefined,
        variant: success ? "default" : "destructive",
      })
    })
  }, [t, toast])

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
    
    downloadBlob(
      new Blob([JSON.stringify(testCase, null, 2)], { type: 'application/json' }),
      `regex-test-case-${Date.now()}.json`,
    )
    
    toast({
      title: t("exportSuccess"),
      description: t("exportSuccessDescription"),
    })
  }, [pattern, testText, flags, replaceText, matches, t, toast])

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
          title: t("importSuccess"),
          description: t("importSuccessDescription"),
        })
      } catch (err) {
        toast({
          title: t("importFailed"),
          description: t("invalidFileFormat"),
          variant: "destructive"
        })
      } finally {
        event.target.value = ""
      }
    }
    reader.readAsText(file)
  }, [flags, t, toast])

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
      <div className="container mx-auto max-w-7xl px-3 py-6 sm:px-4">
        {/* 页面标题 */}
        <div className="text-center space-y-4 mb-8">
          <h1 className="flex items-center justify-center gap-2 text-2xl font-bold sm:text-3xl">
            <Search className="h-8 w-8 text-[var(--md-sys-color-primary)]" />
            {t("title")}
          </h1>
          <p className="mx-auto max-w-2xl text-[var(--md-sys-color-on-surface-variant)]">
            {t("description")}
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="mb-6 grid h-auto w-full grid-cols-3 gap-1 p-1 sm:grid-cols-5">
            <TabsTrigger value="tester" className="flex min-h-10 items-center justify-center gap-1 px-1 text-xs sm:gap-2 sm:px-3 sm:text-sm">
              <TestTube2 className="hidden h-4 w-4 sm:block" />
              {t("tabs.tester")}
            </TabsTrigger>
            <TabsTrigger value="replace" className="flex min-h-10 items-center justify-center gap-1 px-1 text-xs sm:gap-2 sm:px-3 sm:text-sm">
              <Replace className="hidden h-4 w-4 sm:block" />
              {t("tabs.replace")}
            </TabsTrigger>
            <TabsTrigger value="examples" className="flex min-h-10 items-center justify-center gap-1 px-1 text-xs sm:gap-2 sm:px-3 sm:text-sm">
              <BookOpen className="hidden h-4 w-4 sm:block" />
              {t("tabs.examples")}
            </TabsTrigger>
            <TabsTrigger value="reference" className="flex min-h-10 items-center justify-center gap-1 px-1 text-xs sm:gap-2 sm:px-3 sm:text-sm">
              <Code className="hidden h-4 w-4 sm:block" />
              {t("tabs.reference")}
            </TabsTrigger>
            <TabsTrigger value="tools" className="flex min-h-10 items-center justify-center gap-1 px-1 text-xs sm:gap-2 sm:px-3 sm:text-sm">
              <Settings className="hidden h-4 w-4 sm:block" />
              {t("tabs.tools")}
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
                        {t("pattern")}
                      </CardTitle>
                      <div className="flex items-center gap-2">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="sm" onClick={clearAll}>
                              <RotateCcw className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>{t("clearAll")}</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="sm" onClick={() => copyToClipboard(pattern, t("pattern"))}>
                              <Copy className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>{t("copyPattern")}</TooltipContent>
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
                        placeholder={t("patternPlaceholder")}
                        className={`font-mono ${error ? "border-[var(--md-sys-color-error)]" : pattern && isValid ? "border-[var(--md-sys-color-success)]" : ""}`}
                      />
                      <span className="text-lg font-mono">/{getFlagsString()}</span>
                    </div>

                    {/* 标志位控制 */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-medium">{t("flagOptions")}</Label>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowFlags(!showFlags)}
                        >
                          {showFlags ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </Button>
                      </div>
                      
                      {showFlags && (
                        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                          {FLAG_OPTIONS.map(({ key, flag, labelKey }) => {
                            const id = `regex-flag-${key}`
                            return (
                              <div key={key} className="flex items-center space-x-2">
                                <Switch
                                  id={id}
                                  checked={flags[key]}
                                  onCheckedChange={(checked) => setFlags((prev) => ({ ...prev, [key]: checked }))}
                                />
                                <Label htmlFor={id} className="text-sm">
                                  <span className="font-mono">{flag}</span> {t(labelKey)}
                                </Label>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>

                    {/* 状态指示器 */}
                    <div className="flex items-center gap-4 text-sm">
                      {error ? (
                        <div className="flex items-center gap-2 text-[var(--md-sys-color-error)]">
                          <AlertTriangle className="h-4 w-4" />
                          <span>{t("syntaxError")}</span>
                        </div>
                      ) : pattern ? (
                        <div className="flex items-center gap-2 text-[var(--md-sys-color-success)]">
                          <CheckCircle2 className="h-4 w-4" />
                          <span>{t("syntaxValid")}</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-[var(--md-sys-color-on-surface-variant)]">
                          <Info className="h-4 w-4" />
                          <span>{t("waitingForInput")}</span>
                        </div>
                      )}
                      
                      {executionTime > 0 && (
                        <div className="flex items-center gap-2 text-[var(--md-sys-color-tertiary)]">
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
                        {t("testString")}
                      </CardTitle>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center space-x-2">
                          <Switch
                            id="highlight"
                            checked={highlightMatches}
                            onCheckedChange={setHighlightMatches}
                          />
                          <Label htmlFor="highlight" className="text-sm">{t("highlightMatches")}</Label>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => copyToClipboard(testText, t("testString"))}>
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Textarea
                      value={testText}
                      onChange={(e) => setTestText(e.target.value)}
                      placeholder={t("testStringPlaceholder")}
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
                      <strong>{t("regexError")}:</strong> {error}
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
                      {t("matchStatistics")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="rounded-xl bg-[var(--md-sys-color-primary-container)] p-3 text-center">
                        <div className="text-2xl font-bold text-[var(--md-sys-color-on-primary-container)]">{matches.length}</div>
                        <div className="text-sm text-[var(--md-sys-color-on-primary-container)]">{t("matchCount")}</div>
                      </div>
                      <div className="rounded-xl bg-[var(--md-sys-color-success-container)] p-3 text-center">
                        <div className="text-2xl font-bold text-[var(--md-sys-color-on-success-container)]">
                          {testText ? Math.round((matches.length / testText.split(/\r?\n/).length) * 100) : 0}%
                        </div>
                        <div className="text-sm text-[var(--md-sys-color-on-success-container)]">{t("matchRate")}</div>
                      </div>
                    </div>

                    {matches.length > 0 && (
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">{t("matchList")}</Label>
                        <ScrollArea className="h-40">
                          <div className="space-y-1">
                            {matches.map((match, index) => (
                              <div
                                key={index}
                                className={`p-2 rounded border cursor-pointer transition-colors ${
                                  selectedMatch === index 
                                    ? "border-[var(--md-sys-color-primary)] bg-[var(--md-sys-color-primary-container)]"
                                    : "hover:bg-[var(--md-sys-color-surface-container-low)]"
                                }`}
                                onClick={() => setSelectedMatch(selectedMatch === index ? null : index)}
                              >
                                <div className="flex items-center justify-between">
                                  <span className="text-sm font-medium">#{index + 1}</span>
                                  <Badge variant="outline" className="text-xs">
                                    {t("position")} {match.index}
                                  </Badge>
                                </div>
                                <div className="text-sm font-mono truncate mt-1">
                                  "{match.match}"
                                </div>
                                {match.groups.length > 0 && (
                                  <div className="mt-1 text-xs text-[var(--md-sys-color-on-surface-variant)]">
                                    {t("captureGroupCount").replace("{count}", String(match.groups.length))}
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
                      <CardTitle className="text-lg">{t("matchDetails")} #{selectedMatch + 1}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div>
                        <Label className="text-sm text-[var(--md-sys-color-on-surface-variant)]">{t("fullMatch")}</Label>
                        <div className="rounded bg-[var(--md-sys-color-surface-container-low)] p-2 font-mono text-sm">
                          "{matches[selectedMatch].match}"
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <Label className="text-[var(--md-sys-color-on-surface-variant)]">{t("startPosition")}</Label>
                          <div className="font-medium">{matches[selectedMatch].index}</div>
                        </div>
                        <div>
                          <Label className="text-[var(--md-sys-color-on-surface-variant)]">{t("length")}</Label>
                          <div className="font-medium">{matches[selectedMatch].length}</div>
                        </div>
                      </div>
                      
                      {matches[selectedMatch].groups.length > 0 && (
                        <div>
                          <Label className="text-sm text-[var(--md-sys-color-on-surface-variant)]">{t("groups")}</Label>
                          <div className="space-y-1 mt-2">
                            {matches[selectedMatch].groups.map((group, index) => (
                              <div key={index} className="flex items-center gap-2">
                                <Badge variant="secondary" className="text-xs">
                                  ${index + 1}
                                </Badge>
                                <span className="font-mono text-sm">
                                  "{group || t("emptyValue")}"
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {matches[selectedMatch].namedGroups && Object.keys(matches[selectedMatch].namedGroups!).length > 0 && (
                        <div>
                          <Label className="text-sm text-[var(--md-sys-color-on-surface-variant)]">{t("namedGroups")}</Label>
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
                    {t("highlightedResult")}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="whitespace-pre-wrap break-words rounded border bg-[var(--md-sys-color-surface-container-low)] p-4 font-mono text-sm">
                    {highlightedTextSegments.map((segment, index) =>
                      segment.type === "text" ? (
                        <span key={`text-${index}`}>{segment.text}</span>
                      ) : (
                        <mark
                          key={`match-${segment.matchIndex}-${segment.start}`}
                          className={
                            selectedMatch === segment.matchIndex
                              ? "cursor-pointer rounded border-2 border-[var(--md-sys-color-primary)] bg-[var(--md-sys-color-primary-container)] px-1 text-[var(--md-sys-color-on-primary-container)]"
                              : "cursor-pointer rounded bg-[var(--md-sys-color-tertiary-container)] px-1 text-[var(--md-sys-color-on-tertiary-container)]"
                          }
                          title={t("matchPosition")
                            .replace("{match}", String(segment.matchIndex + 1))
                            .replace("{position}", String(segment.start))}
                          onClick={() => setSelectedMatch(segment.matchIndex)}
                        >
                          {segment.text}
                        </mark>
                      ),
                    )}
                  </div>
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
                    {t("replacementSettings")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="replace-pattern">{t("pattern")}</Label>
                    <Input
                      id="replace-pattern"
                      value={pattern}
                      onChange={(e) => setPattern(e.target.value)}
                      placeholder={t("patternPlaceholder")}
                      className="font-mono mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="replace-text">{t("replacementText")}</Label>
                    <Input
                      id="replace-text"
                      value={replaceText}
                      onChange={(e) => setReplaceText(e.target.value)}
                      placeholder={t("replacementPlaceholder")}
                      className="font-mono mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="source-text">{t("sourceText")}</Label>
                    <Textarea
                      id="source-text"
                      value={testText}
                      onChange={(e) => setTestText(e.target.value)}
                      placeholder={t("sourceTextPlaceholder")}
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
                      {t("runReplacement")}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => copyToClipboard(replaceResult, t("replacementResult"))}
                      disabled={!replaceResult}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>{t("replacementResult")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <Textarea
                    value={replaceResult}
                    readOnly
                    placeholder={t("replacementResultPlaceholder")}
                    rows={12}
                    className="font-mono"
                  />
                  
                  {replaceResult && (
                    <div className="mt-4 rounded-xl bg-[var(--md-sys-color-secondary-container)] p-3">
                      <div className="text-sm text-[var(--md-sys-color-on-secondary-container)]">
                        <div>{t("originalLength").replace("{count}", String(testText.length))}</div>
                        <div>{t("replacedLength").replace("{count}", String(replaceResult.length))}</div>
                        <div>{t("lengthChange").replace("{count}", `${replaceResult.length - testText.length > 0 ? "+" : ""}${replaceResult.length - testText.length}`)}</div>
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
                  {t("replacementSyntaxHelp")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {REPLACEMENT_HELP.map((item) => (
                    <div key={item.pattern} className="rounded border p-3">
                      <code className="text-sm">{item.pattern}</code>
                      <div className="mt-1 text-sm text-[var(--md-sys-color-on-surface-variant)]">{t(item.descriptionKey)}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* 示例库页面 */}
          <TabsContent value="examples" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {REGEX_EXAMPLES.map((example) => (
                <Card 
                  key={example.id}
                  className="cursor-pointer transition-all hover:shadow-md hover:scale-105"
                  onClick={() => loadExample(example)}
                >
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">{t(`examples.${example.id}`)}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="rounded bg-[var(--md-sys-color-surface-container-low)] p-2">
                      <code className="text-xs break-all">{example.pattern}</code>
                    </div>
                    <p className="text-sm text-[var(--md-sys-color-on-surface-variant)]">
                      {t(`examples.${example.id}Desc`)}
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
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {REFERENCE_SECTIONS.map((section) => (
                <Card key={section.titleKey}>
                  <CardHeader>
                    <CardTitle>{t(section.titleKey)}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {section.items.map(([patternText, descriptionKey]) => (
                        <div key={patternText} className="flex items-center gap-3 rounded p-2 hover:bg-[var(--md-sys-color-surface-container-low)]">
                          <code className="min-w-16 rounded bg-[var(--md-sys-color-surface-container-high)] px-2 py-1 text-center text-sm">
                            {patternText}
                          </code>
                          <span className="text-sm">{t(descriptionKey)}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
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
                    {t("importExport")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-2">
                    <Button onClick={exportTestCase} className="flex items-center gap-2">
                      <Download className="h-4 w-4" />
                      {t("exportTestCase")}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-2"
                    >
                      <Upload className="h-4 w-4" />
                      {t("importTestCase")}
                    </Button>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json"
                    className="hidden"
                    onChange={importTestCase}
                  />
                  <p className="text-sm text-[var(--md-sys-color-on-surface-variant)]">
                    {t("exportDescription")}
                  </p>
                </CardContent>
              </Card>

              {/* 历史记录 */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <History className="h-5 w-5" />
                      {t("history")}
                    </CardTitle>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setHistory([])}
                      disabled={history.length === 0}
                    >
                      {t("clear")}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {history.length === 0 ? (
                    <p className="py-4 text-center text-sm text-[var(--md-sys-color-on-surface-variant)]">
                      {t("noHistory")}
                    </p>
                  ) : (
                    <ScrollArea className="h-40">
                      <div className="space-y-2">
                        {history.slice(0, 10).map((item) => (
                          <div
                            key={item.id}
                            className="cursor-pointer rounded border p-2 hover:bg-[var(--md-sys-color-surface-container-low)]"
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
                            <div className="text-xs text-[var(--md-sys-color-on-surface-variant)]">
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
                    {t("performance")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="rounded bg-[var(--md-sys-color-primary-container)] p-3 text-center text-[var(--md-sys-color-on-primary-container)]">
                      <div className="text-lg font-bold">{executionTime.toFixed(2)}ms</div>
                      <div className="text-sm">{t("executionTime")}</div>
                    </div>
                    <div className="rounded bg-[var(--md-sys-color-success-container)] p-3 text-center text-[var(--md-sys-color-on-success-container)]">
                      <div className="text-lg font-bold">{testText.length}</div>
                      <div className="text-sm">{t("textLength")}</div>
                    </div>
                  </div>
                  
                  {executionTime > 0 && (
                    <div className="text-sm text-[var(--md-sys-color-on-surface-variant)]">
                      <div>• {t("matchEfficiency").replace("{value}", String(testText ? Math.round(testText.length / executionTime) : 0))}</div>
                      <div>• {t("averagePerMatch").replace("{value}", String(matches.length > 0 ? (executionTime / matches.length).toFixed(2) : 0))}</div>
                      {executionTime > 100 && (
                        <div className="mt-2 text-[var(--md-sys-color-warning)]">
                          {t("slowRegexWarning")}
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
                    {t("quickActions")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setPattern("\\d+")
                        setTestText(t("quickSamples.digits"))
                      }}
                    >
                      {t("quickMatchDigits")}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setPattern("\\w+@\\w+\\.\\w+")
                        setTestText(t("quickSamples.email"))
                      }}
                    >
                      {t("quickMatchEmail")}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setPattern("https?://[^\\s]+")
                        setTestText(t("quickSamples.url"))
                      }}
                    >
                      {t("quickMatchUrl")}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setPattern("[\\u4e00-\\u9fa5]+")
                        setTestText(t("quickSamples.han"))
                      }}
                    >
                      {t("quickMatchHan")}
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
                      {t("resetFlags")}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setTestText(t("quickSamples.multiline").replace(/\\n/g, "\n"))
                      }}
                    >
                      {t("sampleText")}
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
