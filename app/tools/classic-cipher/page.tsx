"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { useTranslations } from "@/hooks/use-translations"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { 
  Copy, 
  Check, 
  Upload, 
  FileText, 
  X, 
  Download,
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
  Info,
  Trash2
} from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Progress } from "@/components/ui/progress"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Alert, AlertDescription } from "@/components/ui/alert"

// 文件信息类型
interface FileInfo {
  file: File
  name: string
  size: number
  sizeFormatted: string
}

interface ClassicCipherProps {
  params?: Record<string, string>
}

// 格式化文件大小
function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes"

  const k = 1024
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
}

// 最大文件大小 (10MB)
const MAX_FILE_SIZE = 10 * 1024 * 1024

// 经典密码算法
const classicAlgorithms = [
  { id: "caesar", name: "凯撒密码", category: "substitution" },
  { id: "rot13", name: "ROT13", category: "substitution" },
  { id: "atbash", name: "埃特巴什密码", category: "substitution" },
  { id: "vigenere", name: "维吉尼亚密码", category: "polyalphabetic" },
  { id: "playfair", name: "普莱费尔密码", category: "polygram" },
  { id: "rail-fence", name: "栅栏密码", category: "transposition" },
  { id: "columnar", name: "列移位密码", category: "transposition" },
  { id: "affine", name: "仿射密码", category: "mathematical" },
]

export default function ClassicCipherPage({ params }: ClassicCipherProps) {
  const t = useTranslations("classicCipher")

  // 基础状态
  const [algorithm, setAlgorithm] = useState("caesar")
  const [operation, setOperation] = useState<"encrypt" | "decrypt">("encrypt")
  const [showBatchMode, setShowBatchMode] = useState(false)
  const [showCipherInfo, setShowCipherInfo] = useState(false)
  
  // 实时转换状态
  const [leftInput, setLeftInput] = useState("")
  const [rightInput, setRightInput] = useState("")
  const [leftType, setLeftType] = useState<"plaintext" | "ciphertext">("plaintext")
  const [autoMode, setAutoMode] = useState(true)
  const [autoSwitch, setAutoSwitch] = useState(true)
  const [leftInputLength, setLeftInputLength] = useState(0)
  const [rightInputLength, setRightInputLength] = useState(0)

  // 批量模式状态（保留原有功能）
  const [inputMode, setInputMode] = useState<"text" | "file">("text")
  const [input, setInput] = useState("")
  const [output, setOutput] = useState("")
  const [fileInfo, setFileInfo] = useState<FileInfo | null>(null)
  const [fileOutput, setFileOutput] = useState<Blob | null>(null)
  const [processing, setProcessing] = useState(false)
  const [progress, setProgress] = useState(0)

  // 密码参数
  const [shift, setShift] = useState(3)
  const [key, setKey] = useState("")
  const [railCount, setRailCount] = useState(3)
  const [colKey, setColKey] = useState("")
  const [affineA, setAffineA] = useState(5)
  const [affineB, setAffineB] = useState(8)

  // 通用状态
  const [copied, setCopied] = useState<{ [key: string]: boolean }>({})
  const [error, setError] = useState<{ left?: string; right?: string; batch?: string }>({})

  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const copyTimeoutRef = useRef<NodeJS.Timeout | null>(null)

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
    // 找到a的模逆
    const modInverse = (a: number, m: number): number => {
      for (let i = 1; i < m; i++) {
        if ((a * i) % m === 1) return i
      }
      return 1
    }

    const aInv = modInverse(a, 26)
    
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
          if (!key) throw new Error("维吉尼亚密码需要密钥")
          return encrypt ? vigenereEncrypt(text, key) : vigenereDecrypt(text, key)
        case "playfair":
          if (!key) throw new Error("普莱费尔密码需要密钥")
          return playfairCipher(text, key, encrypt)
        case "rail-fence":
          return encrypt ? railFenceEncrypt(text, railCount) : railFenceDecrypt(text, railCount)
        case "columnar":
          if (!colKey) throw new Error("列移位密码需要密钥")
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
        setError(prev => ({ ...prev, left: error instanceof Error ? error.message : "转换失败" }))
      }
    }
  }

  // 右侧输入变化处理
  const handleRightInputChange = (value: string) => {
    setRightInput(value)
    setRightInputLength(value.length)
    setError(prev => ({ ...prev, right: undefined }))

    if (autoMode && value) {
      try {
        const rightType: "plaintext" | "ciphertext" = leftType === "plaintext" ? "ciphertext" : "plaintext"
        const result = performTransform(value, rightType, leftType)
        setLeftInput(result)
        setLeftInputLength(result.length)
      } catch (error) {
        setError(prev => ({ ...prev, right: error instanceof Error ? error.message : "转换失败" }))
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
      setError(prev => ({ ...prev, left: error instanceof Error ? error.message : "转换失败" }))
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
      setError(prev => ({ ...prev, right: error instanceof Error ? error.message : "转换失败" }))
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

    navigator.clipboard.writeText(text).then(() => {
      setCopied(prev => ({ ...prev, [key]: true }))
      setTimeout(() => {
        setCopied(prev => ({ ...prev, [key]: false }))
      }, 2000)
    })
  }

  // 获取密码说明
  const getCipherDescription = (algorithm: string) => {
    const descriptions: Record<string, JSX.Element> = {
      caesar: (
        <div>
          <p><strong>原理</strong>: 将字母表中的每个字母向后（或向前）移动固定位数</p>
          <p><strong>特点</strong>: 最简单的替换密码，容易被频率分析破解</p>
          <p><strong>应用</strong>: 历史上用于军事通信，现在主要用于教学</p>
        </div>
      ),
      rot13: (
        <div>
          <p><strong>原理</strong>: 凯撒密码的特例，固定移位13位</p>
          <p><strong>特点</strong>: 加密和解密过程相同，自反性</p>
          <p><strong>应用</strong>: 网络论坛隐藏剧透内容，简单文本混淆</p>
        </div>
      ),
      atbash: (
        <div>
          <p><strong>原理</strong>: 将字母表首尾对应替换（A↔Z, B↔Y...）</p>
          <p><strong>特点</strong>: 古代希伯来密码，加密解密过程相同</p>
          <p><strong>应用</strong>: 《圣经》中的密码，简单替换加密</p>
        </div>
      ),
      vigenere: (
        <div>
          <p><strong>原理</strong>: 使用关键词进行多字母替换加密</p>
          <p><strong>特点</strong>: 曾被称为"不可破译的密码"</p>
          <p><strong>应用</strong>: 16-19世纪广泛使用的密码系统</p>
        </div>
      ),
      playfair: (
        <div>
          <p><strong>原理</strong>: 使用5×5字母矩阵，按字母对进行加密</p>
          <p><strong>特点</strong>: 第一个实用的双字母替换密码</p>
          <p><strong>应用</strong>: 第一次世界大战期间的军事密码</p>
        </div>
      ),
      "rail-fence": (
        <div>
          <p><strong>原理</strong>: 将文本按锯齿形写在多条"栅栏"上</p>
          <p><strong>特点</strong>: 经典的换位密码，改变字母顺序</p>
          <p><strong>应用</strong>: 古代军事通信，现代密码学教学</p>
        </div>
      ),
      columnar: (
        <div>
          <p><strong>原理</strong>: 将文本写成矩形，按密钥顺序重排列</p>
          <p><strong>特点</strong>: 换位密码的改进版本</p>
          <p><strong>应用</strong>: 军事密码系统，商业保密通信</p>
        </div>
      ),
      affine: (
        <div>
          <p><strong>原理</strong>: 使用数学函数 (ax + b) mod 26 进行替换</p>
          <p><strong>特点</strong>: 结合了数学理论的替换密码</p>
          <p><strong>应用</strong>: 密码学理论研究，数学教学</p>
        </div>
      )
    }
    
    return descriptions[algorithm] || <p>未知密码算法</p>
  }

  // 获取密码示例
  const getCipherExample = (algorithm: string) => {
    const examples: Record<string, JSX.Element> = {
      caesar: (
        <div className="space-y-2 text-xs">
          <div><span className="text-green-600">明文:</span> HELLO WORLD</div>
          <div><span className="text-blue-600">密文:</span> KHOOR ZRUOG (移位3)</div>
        </div>
      ),
      rot13: (
        <div className="space-y-2 text-xs">
          <div><span className="text-green-600">明文:</span> HELLO WORLD</div>
          <div><span className="text-blue-600">密文:</span> URYYB JBEYQ</div>
        </div>
      ),
      atbash: (
        <div className="space-y-2 text-xs">
          <div><span className="text-green-600">明文:</span> HELLO WORLD</div>
          <div><span className="text-blue-600">密文:</span> SVOOL DLIOW</div>
        </div>
      ),
      vigenere: (
        <div className="space-y-2 text-xs">
          <div><span className="text-green-600">明文:</span> HELLO WORLD</div>
          <div><span className="text-purple-600">密钥:</span> KEY</div>
          <div><span className="text-blue-600">密文:</span> RIJVS UYVJN</div>
        </div>
      ),
      playfair: (
        <div className="space-y-2 text-xs">
          <div><span className="text-green-600">明文:</span> HELLO WORLD</div>
          <div><span className="text-purple-600">密钥:</span> KEYWORD</div>
          <div><span className="text-blue-600">密文:</span> DMYRANVQDB</div>
        </div>
      ),
      "rail-fence": (
        <div className="space-y-2 text-xs">
          <div><span className="text-green-600">明文:</span> HELLO WORLD</div>
          <div><span className="text-purple-600">栅栏:</span> 3层</div>
          <div><span className="text-blue-600">密文:</span> HOREL LOWLD</div>
        </div>
      ),
      columnar: (
        <div className="space-y-2 text-xs">
          <div><span className="text-green-600">明文:</span> HELLO WORLD</div>
          <div><span className="text-purple-600">密钥:</span> KEY</div>
          <div><span className="text-blue-600">密文:</span> ELHLROWLOD</div>
        </div>
      ),
      affine: (
        <div className="space-y-2 text-xs">
          <div><span className="text-green-600">明文:</span> HELLO WORLD</div>
          <div><span className="text-purple-600">参数:</span> a=5, b=8</div>
          <div><span className="text-blue-600">密文:</span> RCLLA IMALX</div>
        </div>
      )
    }
    
    return examples[algorithm] || <div className="text-xs">暂无示例</div>
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

  // 处理文本（批量模式）
  const processText = () => {
    if (!input) {
      setError(prev => ({ ...prev, batch: "请输入要处理的文本" }))
      return
    }

    setError(prev => ({ ...prev, batch: undefined }))
    setProcessing(true)

    try {
      const result = processCipher(input, algorithm, operation === "encrypt")
      setOutput(result)
    } catch (error) {
      console.error("Processing error:", error)
      setError(prev => ({ ...prev, batch: error instanceof Error ? error.message : "处理失败" }))
      setOutput("")
    } finally {
      setProcessing(false)
    }
  }

  // 处理文件
  const processFile = async () => {
    if (!fileInfo) {
      setError(prev => ({ ...prev, batch: "请选择要处理的文件" }))
      return
    }

    setError(prev => ({ ...prev, batch: undefined }))
    setProcessing(true)
    setProgress(0)
    setFileOutput(null)

    try {
      const file = fileInfo.file
      const reader = new FileReader()

      reader.onload = (e) => {
        try {
          const content = e.target?.result

          if (typeof content === "string") {
            const result = processCipher(content, algorithm, operation === "encrypt")

            // 创建结果Blob
            const blob = new Blob([result], { type: "text/plain" })
            setFileOutput(blob)
          }
        } catch (error) {
          console.error("File processing error:", error)
          setError(prev => ({ ...prev, batch: error instanceof Error ? error.message : "文件处理失败" }))
        } finally {
          setProcessing(false)
        }
      }

      reader.onprogress = (e) => {
        if (e.lengthComputable) {
          const percentComplete = Math.round((e.loaded / e.total) * 100)
          setProgress(percentComplete)
        }
      }

      reader.onerror = () => {
        setError(prev => ({ ...prev, batch: "文件读取失败" }))
        setProcessing(false)
      }

      reader.readAsText(file)
    } catch (error) {
      console.error("File reading error:", error)
      setError(prev => ({ ...prev, batch: error instanceof Error ? error.message : "文件读取失败" }))
      setProcessing(false)
    }
  }

  // 下载文件结果
  const downloadResult = () => {
    if (!fileOutput) return

    const url = URL.createObjectURL(fileOutput)
    const a = document.createElement("a")
    a.href = url
    a.download = `${operation === "encrypt" ? "encrypted" : "decrypted"}_${fileInfo?.name || "result"}`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // 清空输入（批量模式）
  const clearInput = () => {
    setInput("")
    setFileInfo(null)
    setError(prev => ({ ...prev, batch: undefined }))

    if (inputRef.current) {
      inputRef.current.focus()
    }
  }

  // 清空输出（批量模式）
  const clearOutput = () => {
    setOutput("")
    setFileOutput(null)
    setError(prev => ({ ...prev, batch: undefined }))
  }

  // 处理文件上传
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      const file = files[0]

      // 检查文件大小
      if (file.size > MAX_FILE_SIZE) {
        setError(t("fileTooBig"))
        return
      }

      setFileInfo({
        file,
        name: file.name,
        size: file.size,
        sizeFormatted: formatFileSize(file.size),
      })

      setFileOutput(null)
      setError(null)
    }

    // 重置文件输入，以便可以再次选择同一个文件
    if (e.target) {
      e.target.value = ""
    }
  }

  // 处理文件拖放
  const handleFileDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0]

      // 检查文件大小
      if (file.size > MAX_FILE_SIZE) {
        setError(t("fileTooBig"))
        return
      }

      setFileInfo({
        file,
        name: file.name,
        size: file.size,
        sizeFormatted: formatFileSize(file.size),
      })

      setFileOutput(null)
      setError(null)
    }
  }

  // 防止默认拖放行为
  const preventDefaults = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
  }

  return (
    <div className="container mx-auto px-4 py-4 max-w-6xl">
      {/* 页面标题和控制 */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-200 mb-4">
          经典密码工具
        </h1>
        <div className="flex justify-center items-center gap-4 mb-4 flex-wrap">
          <div className="flex items-center space-x-2 bg-gray-100 dark:bg-gray-800 p-2 rounded-lg">
            <Label htmlFor="auto-mode" className="cursor-pointer text-sm">
              手动模式
            </Label>
            <Switch id="auto-mode" checked={autoMode} onCheckedChange={setAutoMode} />
            <Label htmlFor="auto-mode" className="cursor-pointer text-sm text-blue-600">
              实时转换
              </Label>
            </div>
          <div className="flex items-center space-x-2 bg-gray-100 dark:bg-gray-800 p-2 rounded-lg">
            <Label htmlFor="auto-switch" className="cursor-pointer text-sm">
              手动切换
            </Label>
            <Switch id="auto-switch" checked={autoSwitch} onCheckedChange={setAutoSwitch} />
            <Label htmlFor="auto-switch" className="cursor-pointer text-sm text-green-600">
              智能切换
              </Label>
            </div>
          <div className="flex items-center space-x-2 bg-gray-100 dark:bg-gray-800 p-2 rounded-lg">
            <Label htmlFor="legacy-mode" className="cursor-pointer text-sm">
              新界面
            </Label>
            <Switch id="legacy-mode" checked={showBatchMode} onCheckedChange={setShowBatchMode} />
            <Label htmlFor="legacy-mode" className="cursor-pointer text-sm">
              批量模式
            </Label>
        </div>
        </div>
      </div>
      {/* 新界面：左右侧转换 */}
      {!showBatchMode && (
        <>
          {/* 密码算法选择 */}
          <div className="mb-6">
            <Tabs value={algorithm} onValueChange={setAlgorithm} className="w-full">
              <TabsList className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-1 w-full bg-gray-100 dark:bg-gray-800 p-1 h-auto flex-wrap justify-center">
              {classicAlgorithms.map((algo) => (
                  <TabsTrigger
                    key={algo.id}
                    value={algo.id}
                    className="text-xs px-2 py-1.5 whitespace-nowrap data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 data-[state=active]:shadow-sm min-w-0 flex-shrink-0"
                  >
                  {algo.name}
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
                className="w-full text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
              >
                <div className="flex items-center gap-2">
                  {showCipherInfo ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                  <Shield className="h-4 w-4" />
                  <span>{classicAlgorithms.find(a => a.id === algorithm)?.name} 密码说明</span>
                  {!showCipherInfo && (
                    <Badge variant="secondary" className="text-xs ml-auto">
                      点击查看
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
                        <h4 className="font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                          <Shield className="h-4 w-4 text-green-600" />
                          算法说明
                        </h4>
                        <div className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
                          {getCipherDescription(algorithm)}
                        </div>
                      </div>
                      
                      {/* 示例 */}
                      <div className="space-y-3">
                        <h4 className="font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                          <Zap className="h-4 w-4 text-blue-600" />
                          加密示例
                        </h4>
                        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 space-y-2">
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
                <Settings className="h-4 w-4 text-blue-600" />
                密码参数
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* 各种密码参数 */}
        {algorithm === "caesar" && (
          <div className="space-y-2">
                    <Label htmlFor="shift" className="text-sm">移位数 (1-25)</Label>
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
                    <Label htmlFor="key" className="text-sm">密钥 (字母)</Label>
                    <Input 
                      id="key" 
                      value={key} 
                      onChange={(e) => setKey(e.target.value.replace(/[^a-zA-Z]/g, ''))} 
                      placeholder="输入密钥..."
                      className="h-8"
                    />
          </div>
        )}

                {algorithm === "playfair" && (
                  <div className="space-y-2">
                    <Label htmlFor="playfair-key" className="text-sm">密钥 (字母)</Label>
                    <Input 
                      id="playfair-key" 
                      value={key} 
                      onChange={(e) => setKey(e.target.value.replace(/[^a-zA-Z]/g, ''))} 
                      placeholder="输入密钥..."
                      className="h-8"
                    />
                  </div>
                )}

                {algorithm === "rail-fence" && (
              <div className="space-y-2">
                    <Label htmlFor="rails" className="text-sm">栅栏数 (2-10)</Label>
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
                    <Label htmlFor="col-key" className="text-sm">密钥 (字母)</Label>
                    <Input 
                      id="col-key" 
                      value={colKey} 
                      onChange={(e) => setColKey(e.target.value.replace(/[^a-zA-Z]/g, ''))} 
                      placeholder="输入密钥..."
                      className="h-8"
                />
              </div>
                )}

                {algorithm === "affine" && (
                  <>
              <div className="space-y-2">
                      <Label htmlFor="affine-a" className="text-sm">参数 a (与26互质)</Label>
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
                      <Label htmlFor="affine-b" className="text-sm">参数 b (0-25)</Label>
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
                  <div className={`w-3 h-3 rounded-full ${leftType === "plaintext" ? "bg-green-500" : "bg-blue-500"}`} />
                  {leftType === "plaintext" ? "明文输入" : "密文输入"}
                  <Badge variant="outline" className="text-xs ml-auto">
                    {leftInputLength} 字符
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={leftInput}
                  onChange={(e) => handleLeftInputChange(e.target.value)}
                  placeholder={leftType === "plaintext" ? "输入要加密的明文..." : "输入要解密的密文..."}
                  rows={8}
                  className="font-mono text-sm resize-none"
                />
                {error.left && (
                  <div className="text-red-500 text-sm mt-2 flex items-center gap-1">
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
                        >
                          <ArrowRight className="h-4 w-4" />
                    </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {leftType === "plaintext" ? "加密" : "解密"}
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
                        >
                          <ArrowLeft className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                      <TooltipContent>
                        {leftType === "plaintext" ? "解密" : "加密"}
                      </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
              )}

              {/* 算法类型指示 */}
              <div className="text-center">
                <Badge variant="secondary" className="text-xs">
                  {classicAlgorithms.find(a => a.id === algorithm)?.name}
                </Badge>
                <div className="flex flex-col items-center gap-1 mt-2">
                  {autoMode && (
                    <div className="flex items-center gap-1 text-xs text-green-600">
                      <Zap className="h-3 w-3" />
                      实时转换
                </div>
                  )}
                  {autoSwitch && (
                    <div className="flex items-center gap-1 text-xs text-blue-600">
                      <RefreshCw className="h-3 w-3" />
                      智能切换
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
                      >
                        <ArrowLeftRight className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>交换内容</TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                <Button
                        onClick={clearAllInputs}
                  variant="outline"
                  size="sm"
                        className="text-red-500 hover:text-red-700 p-2"
                >
                        <Trash2 className="h-4 w-4" />
                </Button>
                    </TooltipTrigger>
                    <TooltipContent>清空所有</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                  </div>
                </div>

            {/* 右侧输出 */}
            <Card className="card-modern">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${leftType === "plaintext" ? "bg-blue-500" : "bg-green-500"}`} />
                  {leftType === "plaintext" ? "密文输出" : "明文输出"}
                  <Badge variant="outline" className="text-xs ml-auto">
                    {rightInputLength} 字符
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="relative">
                  <Textarea
                    value={rightInput}
                    onChange={(e) => handleRightInputChange(e.target.value)}
                    placeholder={leftType === "plaintext" ? "加密结果将在这里显示..." : "解密结果将在这里显示..."}
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
                        >
                          {copied.right ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                    </Button>
                      </TooltipTrigger>
                      <TooltipContent>复制结果</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  </div>
                {error.right && (
                  <div className="text-red-500 text-sm mt-2 flex items-center gap-1">
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
              <strong>安全提示：</strong>经典密码算法主要用于教学和演示目的，不应用于保护敏感信息。现代应用请使用AES、RSA等现代加密算法。
            </AlertDescription>
          </Alert>
        </>
      )}

      {/* 批量模式 - 暂时保留简化版本 */}
      {showBatchMode && (
        <div className="text-center p-8">
          <p className="text-gray-500">批量模式正在重构中...</p>
      </div>
      )}
    </div>
  )
}
