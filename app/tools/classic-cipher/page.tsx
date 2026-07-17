"use client"

import { copyTextToClipboard as writeClipboardText } from "@/lib/clipboard"

import { useState, useRef, useEffect } from "react"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { useTranslations } from "@/hooks/use-translations"
import { getModularInverse } from "@/lib/classic-cipher-tools"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { 
  Copy, 
  Check, 
  ArrowLeftRight,
  ArrowRight,
  ArrowLeft,
  Settings,
  Zap,
  RefreshCw,
  ChevronUp,
  ChevronDown,
  Shield,
  AlertTriangle,
  Trash2
} from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Alert, AlertDescription } from "@/components/ui/alert"

// 经典密码算法
const classicAlgorithms = [
  { id: "caesar", category: "substitution" },
  { id: "rot13", category: "substitution" },
  { id: "atbash", category: "substitution" },
  { id: "vigenere", category: "polyalphabetic" },
  { id: "playfair", category: "polygram" },
  { id: "rail-fence", category: "transposition" },
  { id: "columnar", category: "transposition" },
  { id: "affine", category: "mathematical" },
]

export default function ClassicCipherPage() {
  const t = useTranslations("classicCipher")

  // 基础状态
  const [algorithm, setAlgorithm] = useState("caesar")
  const [showCipherInfo, setShowCipherInfo] = useState(false)
  const algorithmName = t(`algorithms.${algorithm}`)
  
  // 实时转换状态
  const [leftInput, setLeftInput] = useState("")
  const [rightInput, setRightInput] = useState("")
  const [leftType, setLeftType] = useState<"plaintext" | "ciphertext">("plaintext")
  const [autoMode, setAutoMode] = useState(true)
  const [autoSwitch, setAutoSwitch] = useState(true)
  const [leftInputLength, setLeftInputLength] = useState(0)
  const [rightInputLength, setRightInputLength] = useState(0)

  // 密码参数
  const [shift, setShift] = useState(3)
  const [key, setKey] = useState("")
  const [railCount, setRailCount] = useState(3)
  const [colKey, setColKey] = useState("")
  const [affineA, setAffineA] = useState(5)
  const [affineB, setAffineB] = useState(8)

  // 通用状态
  const [copied, setCopied] = useState<{ [key: string]: boolean }>({})
  const [error, setError] = useState<{ left?: string; right?: string }>({})

  const copyTimeoutRef = useRef<number | null>(null)

  // 凯撒密码加密
  const caesarEncrypt = (text: string, shift: number): string => {
    return text
      .split("")
      .map((char) => {
        const code = char.charCodeAt(0)

        // 处理大写字母 (ASCII 65-90)
        if (code >= 65 && code <= 90) {
          return String.fromCharCode(((code - 65 + shift) % 26) + 65)
        }

        // 处理小写字母 (ASCII 97-122)
        if (code >= 97 && code <= 122) {
          return String.fromCharCode(((code - 97 + shift) % 26) + 97)
        }

        // 其他字符保持不变
        return char
      })
      .join("")
  }

  // 凯撒密码解密
  const caesarDecrypt = (text: string, shift: number): string => {
    return caesarEncrypt(text, 26 - (shift % 26))
  }

  // 维吉尼亚密码加密
  const vigenereEncrypt = (text: string, key: string): string => {
    if (!key) return text

    let result = ""
    let keyIndex = 0

    for (let i = 0; i < text.length; i++) {
      const char = text[i]
      const code = char.charCodeAt(0)

      // 只处理����母
      if ((code >= 65 && code <= 90) || (code >= 97 && code <= 122)) {
        // 获取当前密钥字符
        const keyChar = key[keyIndex % key.length].toUpperCase()
        const keyShift = keyChar.charCodeAt(0) - 65

        // 加密
        if (code >= 65 && code <= 90) {
          result += String.fromCharCode(((code - 65 + keyShift) % 26) + 65)
        } else {
          result += String.fromCharCode(((code - 97 + keyShift) % 26) + 97)
        }

        keyIndex++
      } else {
        result += char
      }
    }

    return result
  }

  // 维吉尼亚密码解密
  const vigenereDecrypt = (text: string, key: string): string => {
    if (!key) return text

    let result = ""
    let keyIndex = 0

    for (let i = 0; i < text.length; i++) {
      const char = text[i]
      const code = char.charCodeAt(0)

      // 只处理字母
      if ((code >= 65 && code <= 90) || (code >= 97 && code <= 122)) {
        // 获取当前密钥字符
        const keyChar = key[keyIndex % key.length].toUpperCase()
        const keyShift = keyChar.charCodeAt(0) - 65

        // 解密
        if (code >= 65 && code <= 90) {
          result += String.fromCharCode(((code - 65 - keyShift + 26) % 26) + 65)
        } else {
          result += String.fromCharCode(((code - 97 - keyShift + 26) % 26) + 97)
        }

        keyIndex++
      } else {
        result += char
      }
    }

    return result
  }

  // ROT13密码（加密和解密相同）
  const rot13Cipher = (text: string): string => {
    return caesarEncrypt(text, 13)
  }

  // Atbash密码（加密和解密相同）
  const atbashCipher = (text: string): string => {
    return text
      .split("")
      .map((char) => {
        const code = char.charCodeAt(0)

        // 处理大写字母 (ASCII 65-90)
        if (code >= 65 && code <= 90) {
          return String.fromCharCode(90 - (code - 65))
        }

        // 处理小写字母 (ASCII 97-122)
        if (code >= 97 && code <= 122) {
          return String.fromCharCode(122 - (code - 97))
        }

        // 其他字符保持不变
        return char
      })
      .join("")
  }

  // 栅栏密码加密
  const railFenceEncrypt = (text: string, rails: number): string => {
    if (rails === 1) return text
    
    const fence: string[][] = Array(rails).fill(null).map(() => [])
    let rail = 0
    let direction = 1

    for (const char of text) {
      fence[rail].push(char)
      rail += direction
      
      if (rail === rails - 1 || rail === 0) {
        direction = -direction
      }
    }

    return fence.map(row => row.join('')).join('')
  }

  // 栅栏密码解密
  const railFenceDecrypt = (text: string, rails: number): string => {
    if (rails === 1) return text
    
    const fence: (string | null)[][] = Array(rails).fill(null).map(() => Array(text.length).fill(null))
    let rail = 0
    let direction = 1

    // 标记字符位置
    for (let i = 0; i < text.length; i++) {
      fence[rail][i] = '*'
      rail += direction
      
      if (rail === rails - 1 || rail === 0) {
        direction = -direction
      }
    }

    // 填充字符
    let index = 0
    for (let r = 0; r < rails; r++) {
      for (let c = 0; c < text.length; c++) {
        if (fence[r][c] === '*' && index < text.length) {
          fence[r][c] = text[index++]
        }
      }
    }

    // 读取结果
    let result = ''
    rail = 0
    direction = 1
    for (let i = 0; i < text.length; i++) {
      result += fence[rail][i]
      rail += direction
      
      if (rail === rails - 1 || rail === 0) {
        direction = -direction
      }
    }

    return result
  }

  // 仿射密码加密
  const affineEncrypt = (text: string, a: number, b: number): string => {
    getModularInverse(a, 26)
    return text
      .split("")
      .map((char) => {
        const code = char.charCodeAt(0)

        if (code >= 65 && code <= 90) {
          return String.fromCharCode(((a * (code - 65) + b) % 26) + 65)
        }
        if (code >= 97 && code <= 122) {
          return String.fromCharCode(((a * (code - 97) + b) % 26) + 97)
        }
        return char
      })
      .join("")
  }

  // 仿射密码解密
  const affineDecrypt = (text: string, a: number, b: number): string => {
    const aInv = getModularInverse(a, 26)
    
    return text
      .split("")
      .map((char) => {
        const code = char.charCodeAt(0)

        if (code >= 65 && code <= 90) {
          return String.fromCharCode(((aInv * (code - 65 - b + 26)) % 26) + 65)
        }
        if (code >= 97 && code <= 122) {
          return String.fromCharCode(((aInv * (code - 97 - b + 26)) % 26) + 97)
        }
        return char
      })
      .join("")
  }

  // 列移位密码加密
  const columnarEncrypt = (text: string, key: string): string => {
    if (!key) return text

    const cols = key.length
    const rows = Math.ceil(text.length / cols)
    const grid: string[][] = Array(rows).fill(null).map(() => Array(cols).fill(''))

    // 填充网格
    for (let i = 0; i < text.length; i++) {
      const row = Math.floor(i / cols)
      const col = i % cols
      grid[row][col] = text[i]
    }

    // 根据密钥排序列
    const sortedIndices = key.split('').map((char, index) => ({ char, index }))
      .sort((a, b) => a.char.localeCompare(b.char))
      .map(item => item.index)

    // 按列读取
    let result = ''
    for (const colIndex of sortedIndices) {
      for (let row = 0; row < rows; row++) {
        if (grid[row][colIndex]) {
          result += grid[row][colIndex]
        }
      }
    }

    return result
  }

  // 列移位密码解密
  const columnarDecrypt = (text: string, key: string): string => {
    if (!key) return text

    const cols = key.length
    const rows = Math.ceil(text.length / cols)
    const grid: string[][] = Array(rows).fill(null).map(() => Array(cols).fill(''))

    // 根据密钥排序列
    const sortedIndices = key.split('').map((char, index) => ({ char, index }))
      .sort((a, b) => a.char.localeCompare(b.char))
      .map(item => item.index)

    // 计算每列的字符数
    const colLengths = Array(cols).fill(rows)
    const remainder = text.length % cols
    if (remainder > 0) {
      for (let i = remainder; i < cols; i++) {
        colLengths[sortedIndices[i]]--
      }
    }

    // 填充网格
    let textIndex = 0
    for (let i = 0; i < cols; i++) {
      const colIndex = sortedIndices[i]
      for (let row = 0; row < colLengths[colIndex]; row++) {
        grid[row][colIndex] = text[textIndex++]
      }
    }

    // 按行读取
    let result = ''
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        if (grid[row][col]) {
          result += grid[row][col]
        }
      }
    }

    return result
  }

  // 普莱费尔密码（简化实现）
  const playfairCipher = (text: string, key: string, encrypt: boolean = true): string => {
    if (!key) return text

    // 创建5x5密钥矩阵（简化：将J替换为I）
    const alphabet = 'ABCDEFGHIKLMNOPQRSTUVWXYZ'
    const keyStr = (key + alphabet).toUpperCase().replace(/J/g, 'I')
    const matrix: string[][] = []
    const used = new Set<string>()

    // 构建密钥矩阵
    let matrixStr = ''
    for (const char of keyStr) {
      if (!used.has(char) && alphabet.includes(char)) {
        used.add(char)
        matrixStr += char
      }
    }

    for (let i = 0; i < 5; i++) {
      matrix[i] = matrixStr.slice(i * 5, (i + 1) * 5).split('')
    }

    // 查找字符位置
    const findPosition = (char: string): [number, number] => {
      for (let i = 0; i < 5; i++) {
        for (let j = 0; j < 5; j++) {
          if (matrix[i][j] === char) return [i, j]
        }
      }
      return [0, 0]
    }

    // 处理文本（简化实现，仅处理字母对）
    const cleanText = text.toUpperCase().replace(/[^A-Z]/g, '').replace(/J/g, 'I')
    let result = ''

    for (let i = 0; i < cleanText.length; i += 2) {
      let char1 = cleanText[i]
      let char2 = cleanText[i + 1] || 'X'

      if (char1 === char2) {
        char2 = 'X'
        i-- // 重新处理下一个字符
      }

      const [row1, col1] = findPosition(char1)
      const [row2, col2] = findPosition(char2)

      if (row1 === row2) {
        // 同行
        const newCol1 = encrypt ? (col1 + 1) % 5 : (col1 - 1 + 5) % 5
        const newCol2 = encrypt ? (col2 + 1) % 5 : (col2 - 1 + 5) % 5
        result += matrix[row1][newCol1] + matrix[row2][newCol2]
      } else if (col1 === col2) {
        // 同列
        const newRow1 = encrypt ? (row1 + 1) % 5 : (row1 - 1 + 5) % 5
        const newRow2 = encrypt ? (row2 + 1) % 5 : (row2 - 1 + 5) % 5
        result += matrix[newRow1][col1] + matrix[newRow2][col2]
      } else {
        // 矩形
        result += matrix[row1][col2] + matrix[row2][col1]
      }
    }

    return result
  }

  // 统一密码处理函数
  const processCipher = (text: string, algorithm: string, encrypt: boolean): string => {
    if (!text) return ""

    try {
      switch (algorithm) {
        case "caesar":
          return encrypt ? caesarEncrypt(text, shift) : caesarDecrypt(text, shift)
        case "rot13":
          return rot13Cipher(text)
        case "atbash":
          return atbashCipher(text)
        case "vigenere":
          if (!key) throw new Error(t("vigenereKeyRequired"))
          return encrypt ? vigenereEncrypt(text, key) : vigenereDecrypt(text, key)
        case "playfair":
          if (!key) throw new Error(t("playfairKeyRequired"))
          return playfairCipher(text, key, encrypt)
        case "rail-fence":
          return encrypt ? railFenceEncrypt(text, railCount) : railFenceDecrypt(text, railCount)
        case "columnar":
          if (!colKey) throw new Error(t("columnarKeyRequired"))
          return encrypt ? columnarEncrypt(text, colKey) : columnarDecrypt(text, colKey)
        case "affine":
          return encrypt ? affineEncrypt(text, affineA, affineB) : affineDecrypt(text, affineA, affineB)
        default:
          return text
      }
    } catch (error) {
      throw error
    }
  }

  // 实时转换处理
  const performTransform = (fromText: string, fromType: "plaintext" | "ciphertext", toType: "plaintext" | "ciphertext") => {
    if (!fromText) {
      return ""
    }

    try {
      if (fromType === "plaintext" && toType === "ciphertext") {
        return processCipher(fromText, algorithm, true)
      } else if (fromType === "ciphertext" && toType === "plaintext") {
        return processCipher(fromText, algorithm, false)
      }
      return fromText
    } catch (error) {
      throw error
    }
  }

  // 左侧输入变化处理
  const handleLeftInputChange = (value: string) => {
    setLeftInput(value)
    setLeftInputLength(value.length)
    setError(prev => ({ ...prev, left: undefined }))

    if (autoMode && value) {
      try {
        const rightType: "plaintext" | "ciphertext" = leftType === "plaintext" ? "ciphertext" : "plaintext"
        const result = performTransform(value, leftType, rightType)
        setRightInput(result)
        setRightInputLength(result.length)
      } catch (error) {
        setError(prev => ({ ...prev, left: error instanceof Error ? error.message : t("transformFailed") }))
      }
    }
  }

  // 手动转换
  const transformLeftToRight = () => {
    if (!leftInput) return

    try {
      const rightType: "plaintext" | "ciphertext" = leftType === "plaintext" ? "ciphertext" : "plaintext"
      const result = performTransform(leftInput, leftType, rightType)
      setRightInput(result)
      setRightInputLength(result.length)
      setError(prev => ({ ...prev, left: undefined, right: undefined }))
    } catch (error) {
      setError(prev => ({ ...prev, left: error instanceof Error ? error.message : t("transformFailed") }))
    }
  }

  const transformRightToLeft = () => {
    if (!rightInput) return

    try {
      const rightType: "plaintext" | "ciphertext" = leftType === "plaintext" ? "ciphertext" : "plaintext"
      const result = performTransform(rightInput, rightType, leftType)
      setLeftInput(result)
      setLeftInputLength(result.length)
      setError(prev => ({ ...prev, left: undefined, right: undefined }))
    } catch (error) {
      setError(prev => ({ ...prev, right: error instanceof Error ? error.message : t("transformFailed") }))
    }
  }

  // 交换输入内容
  const swapInputs = () => {
    const tempInput = leftInput
    const tempLength = leftInputLength
    
    setLeftInput(rightInput)
    setLeftInputLength(rightInputLength)
    setRightInput(tempInput)
    setRightInputLength(tempLength)
    
    // 交换类型
    setLeftType(leftType === "plaintext" ? "ciphertext" : "plaintext")
  }

  // 清空所有内容
  const clearAllInputs = () => {
    setLeftInput("")
    setRightInput("")
    setLeftInputLength(0)
    setRightInputLength(0)
    setError({})
  }

  // 复制到剪贴板
  const copyToClipboard = (text: string, key: string) => {
    if (!text) return

    void writeClipboardText(text).then((success) => {
      if (!success) return
      setCopied(prev => ({ ...prev, [key]: true }))
      if (copyTimeoutRef.current) window.clearTimeout(copyTimeoutRef.current)
      copyTimeoutRef.current = window.setTimeout(() => {
        setCopied(prev => ({ ...prev, [key]: false }))
      }, 2000)
    })
  }

  // 获取密码说明
  const getCipherDescription = (algorithm: string) => {
    if (!classicAlgorithms.some((item) => item.id === algorithm)) {
      return <p>{t("unknownAlgorithm")}</p>
    }

    return (
      <div className="space-y-2">
        {(["principle", "features", "uses"] as const).map((detail) => (
          <p key={detail}>
            <strong>{t(`descriptionLabels.${detail}`)}</strong>: {t(`descriptions.${algorithm}.${detail}`)}
          </p>
        ))}
      </div>
    )
  }

  // 获取密码示例
  const getCipherExample = (algorithm: string) => {
    const examples: Record<string, Array<{ label: string; value: string; tone: "plain" | "cipher" | "parameter" }>> = {
      caesar: [
        { label: t("plaintext"), value: "HELLO WORLD", tone: "plain" },
        { label: t("ciphertext"), value: `KHOOR ZRUOG (${t("shift")} 3)`, tone: "cipher" },
      ],
      rot13: [
        { label: t("plaintext"), value: "HELLO WORLD", tone: "plain" },
        { label: t("ciphertext"), value: "URYYB JBEYQ", tone: "cipher" },
      ],
      atbash: [
        { label: t("plaintext"), value: "HELLO WORLD", tone: "plain" },
        { label: t("ciphertext"), value: "SVOOL DLIOW", tone: "cipher" },
      ],
      vigenere: [
        { label: t("plaintext"), value: "HELLO WORLD", tone: "plain" },
        { label: t("key"), value: "KEY", tone: "parameter" },
        { label: t("ciphertext"), value: "RIJVS UYVJN", tone: "cipher" },
      ],
      playfair: [
        { label: t("plaintext"), value: "HELLO WORLD", tone: "plain" },
        { label: t("key"), value: "KEYWORD", tone: "parameter" },
        { label: t("ciphertext"), value: "DMYRANVQDB", tone: "cipher" },
      ],
      "rail-fence": [
        { label: t("plaintext"), value: "HELLO WORLD", tone: "plain" },
        { label: t("rails"), value: t("railLevels").replace("{count}", "3"), tone: "parameter" },
        { label: t("ciphertext"), value: "HOREL LOWLD", tone: "cipher" },
      ],
      columnar: [
        { label: t("plaintext"), value: "HELLO WORLD", tone: "plain" },
        { label: t("key"), value: "KEY", tone: "parameter" },
        { label: t("ciphertext"), value: "ELHLROWLOD", tone: "cipher" },
      ],
      affine: [
        { label: t("plaintext"), value: "HELLO WORLD", tone: "plain" },
        { label: t("parameters"), value: "a=5, b=8", tone: "parameter" },
        { label: t("ciphertext"), value: "RCLLA IMALX", tone: "cipher" },
      ],
    }
    const example = examples[algorithm]

    if (!example) return <div className="text-xs">{t("noExample")}</div>

    return (
      <div className="space-y-2 text-xs">
        {example.map((item) => (
          <div key={`${item.label}-${item.value}`}>
            <span className={item.tone === "plain" ? "text-[var(--md-sys-color-success)]" : item.tone === "cipher" ? "text-[var(--md-sys-color-tertiary)]" : "text-[var(--md-sys-color-primary)]"}>
              {item.label}:
            </span>{" "}
            {item.value}
          </div>
        ))}
      </div>
    )
  }

  // 自动切换效果
  useEffect(() => {
    if (autoSwitch && (leftInput || rightInput)) {
      try {
        if (leftInput) {
          const rightType: "plaintext" | "ciphertext" = leftType === "plaintext" ? "ciphertext" : "plaintext"
          const result = performTransform(leftInput, leftType, rightType)
          setRightInput(result)
          setRightInputLength(result.length)
        } else if (rightInput) {
          const rightType: "plaintext" | "ciphertext" = leftType === "plaintext" ? "ciphertext" : "plaintext"
          const result = performTransform(rightInput, rightType, leftType)
          setLeftInput(result)
          setLeftInputLength(result.length)
        }
      } catch (error) {
        // 自动切换时忽略错误
      }
    }
  }, [algorithm, shift, key, railCount, colKey, affineA, affineB, autoSwitch])

  useEffect(() => () => {
    if (copyTimeoutRef.current) window.clearTimeout(copyTimeoutRef.current)
  }, [])

  return (
    <div className="container mx-auto max-w-6xl px-3 py-4 sm:px-4">
      {/* 页面标题和控制 */}
      <div className="text-center mb-8">
        <h1 className="mb-4 text-2xl font-bold text-[var(--md-sys-color-on-surface)] sm:text-3xl">
          {t("title")}
        </h1>
        <div className="mb-4 flex flex-wrap items-center justify-center gap-3">
          <div className="flex items-center space-x-2 rounded-xl bg-[var(--md-sys-color-surface-container-low)] p-2">
            <Switch id="auto-mode" checked={autoMode} onCheckedChange={setAutoMode} />
            <Label htmlFor="auto-mode" className="cursor-pointer text-sm">
              {t("liveTransform")}
            </Label>
          </div>
          <div className="flex items-center space-x-2 rounded-xl bg-[var(--md-sys-color-surface-container-low)] p-2">
            <Switch id="auto-switch" checked={autoSwitch} onCheckedChange={setAutoSwitch} />
            <Label htmlFor="auto-switch" className="cursor-pointer text-sm">
              {t("reprocessOnAlgorithmChange")}
            </Label>
          </div>
        </div>
      </div>
      {/* 经典密码转换 */}
          {/* 密码算法选择 */}
          <div className="mb-6">
            <Tabs value={algorithm} onValueChange={setAlgorithm} className="w-full">
              <TabsList className="grid h-auto w-full grid-cols-2 gap-1 bg-[var(--md-sys-color-surface-container)] p-1 sm:grid-cols-4 lg:grid-cols-8">
              {classicAlgorithms.map((algo) => (
                  <TabsTrigger
                    key={algo.id}
                    value={algo.id}
                    className="min-w-0 whitespace-nowrap px-2 py-1.5 text-xs data-[state=active]:bg-[var(--md-sys-color-surface-container-lowest)] data-[state=active]:shadow-sm"
                  >
                  {t(`algorithms.${algo.id}`)}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>

            {/* 密码说明折叠区域 */}
            <div className="mt-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowCipherInfo(!showCipherInfo)}
                className="w-full text-sm text-[var(--md-sys-color-on-surface-variant)] hover:text-[var(--md-sys-color-on-surface)]"
              >
                <div className="flex items-center gap-2">
                  {showCipherInfo ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                  <Shield className="h-4 w-4" />
                  <span>{t("cipherInfo").replace("{algorithm}", algorithmName)}</span>
                  {!showCipherInfo && (
                    <Badge variant="secondary" className="text-xs ml-auto">
                      {t("clickToView")}
                    </Badge>
                  )}
        </div>
              </Button>

              {showCipherInfo && (
                <Card className="mt-3 card-modern">
                  <CardContent className="py-4">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* 密码说明 */}
                      <div className="space-y-3">
                        <h4 className="flex items-center gap-2 font-semibold text-[var(--md-sys-color-on-surface)]">
                          <Shield className="h-4 w-4 text-[var(--md-sys-color-success)]" />
                          {t("algorithmDescription")}
                        </h4>
                        <div className="space-y-2 text-sm text-[var(--md-sys-color-on-surface-variant)]">
                          {getCipherDescription(algorithm)}
                        </div>
                      </div>
                      
                      {/* 示例 */}
                      <div className="space-y-3">
                        <h4 className="flex items-center gap-2 font-semibold text-[var(--md-sys-color-on-surface)]">
                          <Zap className="h-4 w-4 text-[var(--md-sys-color-tertiary)]" />
                          {t("encryptionExample")}
                        </h4>
                        <div className="space-y-2 rounded-xl bg-[var(--md-sys-color-surface-container-low)] p-3">
                          {getCipherExample(algorithm)}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>

          {/* 密码参数设置 */}
          <Card className="mb-6 card-modern">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Settings className="h-4 w-4 text-[var(--md-sys-color-primary)]" />
                {t("cipherParameters")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* 各种密码参数 */}
        {algorithm === "caesar" && (
          <div className="space-y-2">
                    <Label htmlFor="shift" className="text-sm">{t("shiftRange")}</Label>
            <Input
              id="shift"
              type="number"
              min="1"
              max="25"
              value={shift}
              onChange={(e) => setShift(Number.parseInt(e.target.value) || 3)}
                      className="h-8"
            />
          </div>
        )}

        {algorithm === "vigenere" && (
          <div className="space-y-2">
                    <Label htmlFor="key" className="text-sm">{t("letterKey")}</Label>
                    <Input 
                      id="key" 
                      value={key} 
                      onChange={(e) => setKey(e.target.value.replace(/[^a-zA-Z]/g, ''))} 
                      placeholder={t("keyPlaceholder")}
                      className="h-8"
                    />
          </div>
        )}

                {algorithm === "playfair" && (
                  <div className="space-y-2">
                    <Label htmlFor="playfair-key" className="text-sm">{t("letterKey")}</Label>
                    <Input 
                      id="playfair-key" 
                      value={key} 
                      onChange={(e) => setKey(e.target.value.replace(/[^a-zA-Z]/g, ''))} 
                      placeholder={t("keyPlaceholder")}
                      className="h-8"
                    />
                  </div>
                )}

                {algorithm === "rail-fence" && (
              <div className="space-y-2">
                    <Label htmlFor="rails" className="text-sm">{t("railRange")}</Label>
                    <Input
                      id="rails"
                      type="number"
                      min="2"
                      max="10"
                      value={railCount}
                      onChange={(e) => setRailCount(Number.parseInt(e.target.value) || 3)}
                      className="h-8"
                    />
                </div>
                )}

                {algorithm === "columnar" && (
                  <div className="space-y-2">
                    <Label htmlFor="col-key" className="text-sm">{t("letterKey")}</Label>
                    <Input 
                      id="col-key" 
                      value={colKey} 
                      onChange={(e) => setColKey(e.target.value.replace(/[^a-zA-Z]/g, ''))} 
                      placeholder={t("keyPlaceholder")}
                      className="h-8"
                />
              </div>
                )}

                {algorithm === "affine" && (
                  <>
              <div className="space-y-2">
                      <Label htmlFor="affine-a" className="text-sm">{t("affineA")}</Label>
                      <Input
                        id="affine-a"
                        type="number"
                        min="1"
                        max="25"
                        value={affineA}
                        onChange={(e) => setAffineA(Number.parseInt(e.target.value) || 5)}
                        className="h-8"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="affine-b" className="text-sm">{t("affineB")}</Label>
                      <Input
                        id="affine-b"
                        type="number"
                        min="0"
                        max="25"
                        value={affineB}
                        onChange={(e) => setAffineB(Number.parseInt(e.target.value) || 8)}
                        className="h-8"
                      />
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* 主转换区域 */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            {/* 左侧输入 */}
            <Card className="card-modern">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <div className={`h-3 w-3 rounded-full ${leftType === "plaintext" ? "bg-[var(--md-sys-color-success)]" : "bg-[var(--md-sys-color-tertiary)]"}`} />
                  {leftType === "plaintext" ? t("plaintextInput") : t("ciphertextInput")}
                  <Badge variant="outline" className="text-xs ml-auto">
                    {t("characters").replace("{count}", String(leftInputLength))}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={leftInput}
                  onChange={(e) => handleLeftInputChange(e.target.value)}
                  aria-label={leftType === "plaintext" ? t("plaintextToEncrypt") : t("ciphertextToDecrypt")}
                  placeholder={leftType === "plaintext" ? t("plaintextPlaceholder") : t("ciphertextPlaceholder")}
                  rows={8}
                  className="font-mono text-sm resize-none"
                />
                {error.left && (
                  <div className="mt-2 flex items-center gap-1 text-sm text-[var(--md-sys-color-error)]">
                    <AlertTriangle className="h-3 w-3" />
                    {error.left}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 中间控制区域 */}
            <div className="flex lg:flex-col items-center justify-center gap-4">
              {/* 手动转换按钮 */}
              {!autoMode && (
                <div className="flex lg:flex-col gap-2">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          onClick={transformLeftToRight}
                          disabled={!leftInput}
                          variant="outline"
                          size="sm"
                          className="p-2"
                           aria-label={leftType === "plaintext" ? t("encrypt") : t("decrypt")}
                        >
                          <ArrowRight className="h-4 w-4" />
                    </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {leftType === "plaintext" ? t("encrypt") : t("decrypt")}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>

                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                        <Button
                          onClick={transformRightToLeft}
                          disabled={!rightInput}
                          variant="outline"
                          size="sm"
                          className="p-2"
                          aria-label={leftType === "plaintext" ? t("decryptBackToInput") : t("encryptBackToInput")}
                        >
                          <ArrowLeft className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                      <TooltipContent>
                        {leftType === "plaintext" ? t("decrypt") : t("encrypt")}
                      </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
              )}

              {/* 算法类型指示 */}
              <div className="text-center">
                <Badge variant="secondary" className="text-xs">
                  {algorithmName}
                </Badge>
                <div className="flex flex-col items-center gap-1 mt-2">
                  {autoMode && (
                    <div className="flex items-center gap-1 text-xs text-[var(--md-sys-color-success)]">
                      <Zap className="h-3 w-3" />
                      {t("liveTransformShort")}
                </div>
                  )}
                  {autoSwitch && (
                    <div className="flex items-center gap-1 text-xs text-[var(--md-sys-color-tertiary)]">
                      <RefreshCw className="h-3 w-3" />
                      {t("smartSwitch")}
              </div>
                  )}
            </div>
              </div>

              {/* 交换和清空按钮 */}
              <div className="flex lg:flex-col gap-2">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        onClick={swapInputs}
                        variant="outline"
                        size="sm"
                        className="p-2"
                        aria-label={t("swapAria")}
                      >
                        <ArrowLeftRight className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{t("swapContent")}</TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                <Button
                        onClick={clearAllInputs}
                  variant="outline"
                  size="sm"
                        className="p-2 text-[var(--md-sys-color-error)] hover:text-[var(--md-sys-color-error)]"
                        aria-label={t("clearAria")}
                >
                        <Trash2 className="h-4 w-4" />
                </Button>
                    </TooltipTrigger>
                    <TooltipContent>{t("clearAll")}</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                  </div>
                </div>

            {/* 右侧输出 */}
            <Card className="card-modern">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <div className={`h-3 w-3 rounded-full ${leftType === "plaintext" ? "bg-[var(--md-sys-color-tertiary)]" : "bg-[var(--md-sys-color-success)]"}`} />
                  {leftType === "plaintext" ? t("ciphertextOutput") : t("plaintextOutput")}
                  <Badge variant="outline" className="text-xs ml-auto">
                    {t("characters").replace("{count}", String(rightInputLength))}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="relative">
                  <Textarea
                    value={rightInput}
                    readOnly
                    aria-label={leftType === "plaintext" ? t("encryptionResult") : t("decryptionResult")}
                    placeholder={leftType === "plaintext" ? t("encryptionResultPlaceholder") : t("decryptionResultPlaceholder")}
                    rows={8}
                    className="font-mono text-sm resize-none pr-10"
                  />
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          onClick={() => copyToClipboard(rightInput, "right")}
                          disabled={!rightInput}
                          variant="ghost"
                          size="sm"
                          className="absolute top-2 right-2 p-1 h-6 w-6"
                          aria-label={copied.right ? t("resultCopied") : t("copyResult")}
                        >
                          {copied.right ? <Check className="h-3 w-3 text-[var(--md-sys-color-success)]" /> : <Copy className="h-3 w-3" />}
                    </Button>
                      </TooltipTrigger>
                      <TooltipContent>{t("copyResult")}</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  </div>
                {error.right && (
                  <div className="mt-2 flex items-center gap-1 text-sm text-[var(--md-sys-color-error)]">
                    <AlertTriangle className="h-3 w-3" />
                    {error.right}
              </div>
            )}
              </CardContent>
            </Card>
          </div>

          {/* 安全提示 */}
          <Alert className="mb-6">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>{t("securityNoticeTitle")}</strong>{t("securityNotice")}
            </AlertDescription>
          </Alert>
    </div>
  )
}
