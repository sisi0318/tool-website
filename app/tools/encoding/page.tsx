"use client"

import React, { useState, useRef, useEffect, useMemo } from "react"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { useTranslations } from "@/hooks/use-translations"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ArrowLeftRight,
  Copy,
  Check,
  Trash2,
  ArrowRight,
  ArrowLeft,
  Settings,
  Zap,
  RefreshCw,
  ChevronUp,
  ChevronDown
} from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { M3Card } from "@/components/m3/card"
import { M3Tabs, type TabItem } from "@/components/m3/tabs"
import { M3Button } from "@/components/m3/button" // Assuming exist or use Button with className

// 添加参数接口
interface EncodingPageProps {
  params?: {
    feature?: string
  }
}

// 编码类型
const encodingTypes = [
  { id: "base64", name: "Base64" },
  { id: "url", name: "URL" },
  { id: "hex", name: "HEX" },
  { id: "unicode", name: "Unicode" },
  { id: "utf8", name: "UTF-8" },
  { id: "ascii", name: "ASCII" },
  { id: "base32", name: "Base32" },
  { id: "base58", name: "Base58" },
  { id: "base85", name: "Base85" },
  { id: "binary", name: "Binary" },
  { id: "octal", name: "Octal" },
  { id: "html", name: "HTML" },
  { id: "morse", name: "Morse" },
  { id: "rot13", name: "ROT13" },
  { id: "punycode", name: "Punycode" },
  { id: "quoted", name: "Quoted-Printable" },
]

export default function EncodingPage({ params }: EncodingPageProps) {
  const t = useTranslations("encoding")

  // 状态
  const [encodingType, setEncodingType] = useState("base64")
  const [leftInput, setLeftInput] = useState("")
  const [rightInput, setRightInput] = useState("")
  const [leftType, setLeftType] = useState<"text" | "encoded">("text") // 左侧是原文还是编码
  const [multiline, setMultiline] = useState(false)
  const [copied, setCopied] = useState<{ [key: string]: boolean }>({})
  const [error, setError] = useState<{ left?: string; right?: string }>({})
  const [autoMode, setAutoMode] = useState(true) // 自动转换模式
  const [autoSwitch, setAutoSwitch] = useState(true) // 切换编码类型时自动转换
  const [showSettings, setShowSettings] = useState(false)

  // 字符长度统计
  const [leftInputLength, setLeftInputLength] = useState(0)
  const [rightInputLength, setRightInputLength] = useState(0)

  // 编码说明折叠状态
  const [showEncodingInfo, setShowEncodingInfo] = useState(false)

  // 旧状态兼容（保留现有功能）
  const [encodeInput, setEncodeInput] = useState("")
  const [decodeInput, setDecodeInput] = useState("")
  const [showAllResults, setShowAllResults] = useState(false)
  const [allEncodeResults, setAllEncodeResults] = useState<{ type: string; result: string }[]>([])
  const [allDecodeResults, setAllDecodeResults] = useState<{ type: string; result: string }[]>([])
  const [encodeInputLength, setEncodeInputLength] = useState(0)
  const [decodeInputLength, setDecodeInputLength] = useState(0)

  const encodeInputRef = useRef<HTMLTextAreaElement>(null)
  const decodeInputRef = useRef<HTMLTextAreaElement>(null)
  const leftInputRef = useRef<HTMLTextAreaElement>(null)
  const rightInputRef = useRef<HTMLTextAreaElement>(null)
  const copyTimeoutRef = useRef<{ [key: string]: NodeJS.Timeout | null }>({})

  // 新的转换函数
  const performTransform = (input: string, fromType: "text" | "encoded", toType: "text" | "encoded"): string => {
    if (!input.trim()) return ""

    try {
      setError({}) // 清除错误

      if (fromType === "text" && toType === "encoded") {
        // 编码
        switch (encodingType) {
          case "base64": return base64Encode(input)
          case "url": return urlEncode(input)
          case "hex": return hexEncode(input)
          case "unicode": return unicodeEncode(input)
          case "utf8": return utf8Encode(input)
          case "ascii": return asciiEncode(input)
          case "base32": return base32Encode(input)
          case "base58": return base58Encode(input)
          case "base85": return base85Encode(input)
          case "binary": return binaryEncode(input)
          case "octal": return octalEncode(input)
          case "html": return htmlEncode(input)
          case "morse": return morseEncode(input)
          case "rot13": return rot13Encode(input)
          case "punycode": return punycodeEncode(input)
          case "quoted": return quotedEncode(input)
          case "base": return baseEncode(input)
          default: return base64Encode(input)
        }
      } else if (fromType === "encoded" && toType === "text") {
        // 解码
        switch (encodingType) {
          case "base64": return base64Decode(input)
          case "url": return urlDecode(input)
          case "hex": return hexDecode(input)
          case "unicode": return unicodeDecode(input)
          case "utf8": return utf8Decode(input)
          case "ascii": return asciiDecode(input)
          case "base32": return base32Decode(input)
          case "base58": return base58Decode(input)
          case "base85": return base85Decode(input)
          case "binary": return binaryDecode(input)
          case "octal": return octalDecode(input)
          case "html": return htmlDecode(input)
          case "morse": return morseDecode(input)
          case "rot13": return rot13Decode(input)
          case "punycode": return punycodeDecode(input)
          case "quoted": return quotedDecode(input)
          case "base": return baseDecode(input)
          default: return base64Decode(input)
        }
      }
      return input // 相同类型直接返回
    } catch (error) {
      console.error("Transform error:", error)
      const side = fromType === "text" ? "left" : "right"
      setError(prev => ({ ...prev, [side]: "转换失败，请检查输入格式" }))
      return ""
    }
  }

  // 自动转换逻辑
  const handleLeftInputChange = (value: string) => {
    setLeftInput(value)
    setLeftInputLength(value.length)

    if (autoMode && value.trim()) {
      const targetType = leftType === "text" ? "encoded" : "text"
      const result = performTransform(value, leftType, targetType)
      setRightInput(result)
      setRightInputLength(result.length)
    } else if (!value.trim()) {
      setRightInput("")
      setRightInputLength(0)
    }
  }

  const handleRightInputChange = (value: string) => {
    setRightInput(value)
    setRightInputLength(value.length)

    if (autoMode && value.trim()) {
      const targetType = leftType === "text" ? "text" : "encoded"
      const result = performTransform(value, leftType === "text" ? "encoded" : "text", targetType)
      setLeftInput(result)
      setLeftInputLength(result.length)
    } else if (!value.trim()) {
      setLeftInput("")
      setLeftInputLength(0)
    }
  }

  // 手动转换
  const transformLeftToRight = () => {
    if (leftInput.trim()) {
      const targetType = leftType === "text" ? "encoded" : "text"
      const result = performTransform(leftInput, leftType, targetType)
      setRightInput(result)
      setRightInputLength(result.length)
    }
  }

  const transformRightToLeft = () => {
    if (rightInput.trim()) {
      const targetType = leftType === "text" ? "text" : "encoded"
      const result = performTransform(rightInput, leftType === "text" ? "encoded" : "text", targetType)
      setLeftInput(result)
      setLeftInputLength(result.length)
    }
  }

  // 交换左右内容
  const swapInputs = () => {
    const tempInput = leftInput
    const tempLength = leftInputLength

    setLeftInput(rightInput)
    setLeftInputLength(rightInputLength)
    setRightInput(tempInput)
    setRightInputLength(tempLength)

    // 交换类型
    setLeftType(leftType === "text" ? "encoded" : "text")
  }

  // 清空所有内容
  const clearAllInputs = () => {
    setLeftInput("")
    setRightInput("")
    setLeftInputLength(0)
    setRightInputLength(0)
    setError({})
  }

  // 获取编码格式说明
  const getEncodingDescription = (type: string) => {
    const descriptions: Record<string, JSX.Element> = {
      base64: (
        <div>
          <p><strong>用途</strong>: 二进制数据在文本协议中的传输编码</p>
          <p><strong>特点</strong>: 使用64个可打印字符，每3个字节编码为4个字符</p>
          <p><strong>应用</strong>: 邮件附件、网页嵌入图片、API数据传输</p>
        </div>
      ),
      url: (
        <div>
          <p><strong>用途</strong>: URL参数和表单数据的安全编码</p>
          <p><strong>特点</strong>: 将特殊字符转换为%XX格式</p>
          <p><strong>应用</strong>: Web表单、URL参数、HTTP请求</p>
        </div>
      ),
      hex: (
        <div>
          <p><strong>用途</strong>: 二进制数据的十六进制表示</p>
          <p><strong>特点</strong>: 每个字节用两个十六进制字符表示</p>
          <p><strong>应用</strong>: 密码学、调试、颜色代码</p>
        </div>
      ),
      unicode: (
        <div>
          <p><strong>用途</strong>: Unicode字符的转义序列表示</p>
          <p><strong>特点</strong>: 使用\uXXXX格式表示Unicode字符</p>
          <p><strong>应用</strong>: JavaScript字符串、JSON数据、国际化</p>
        </div>
      ),
      utf8: (
        <div>
          <p><strong>用途</strong>: UTF-8编码的字节序列表示</p>
          <p><strong>特点</strong>: 显示字符的UTF-8字节组成</p>
          <p><strong>应用</strong>: 字符编码调试、协议分析</p>
        </div>
      ),
      ascii: (
        <div>
          <p><strong>用途</strong>: ASCII字符的数值代码表示</p>
          <p><strong>特点</strong>: 每个字符对应一个0-127的数字</p>
          <p><strong>应用</strong>: 底层编程、协议实现、字符分析</p>
        </div>
      ),
      base32: (
        <div>
          <p><strong>用途</strong>: 32进制编码，常用于密钥表示</p>
          <p><strong>特点</strong>: 使用32个字符，避免易混淆字符</p>
          <p><strong>应用</strong>: TOTP密钥、Git哈希短码</p>
        </div>
      ),
      base58: (
        <div>
          <p><strong>用途</strong>: 区块链地址编码，去除易混淆字符</p>
          <p><strong>特点</strong>: 不包含0、O、I、l等易混淆字符</p>
          <p><strong>应用</strong>: 比特币地址、区块链钱包</p>
        </div>
      ),
      base85: (
        <div>
          <p><strong>用途</strong>: 高效的85进制编码</p>
          <p><strong>特点</strong>: 比Base64更高效，5个字符编码4个字节</p>
          <p><strong>应用</strong>: PDF文件、PostScript、Git打包</p>
        </div>
      ),
      binary: (
        <div>
          <p><strong>用途</strong>: 二进制位表示</p>
          <p><strong>特点</strong>: 每个字节用8个0和1表示</p>
          <p><strong>应用</strong>: 底层编程、位操作、教学演示</p>
        </div>
      ),
      octal: (
        <div>
          <p><strong>用途</strong>: 八进制转义序列</p>
          <p><strong>特点</strong>: 使用\XXX格式表示字节</p>
          <p><strong>应用</strong>: Unix文件权限、C语言转义序列</p>
        </div>
      ),
      html: (
        <div>
          <p><strong>用途</strong>: HTML特殊字符编码</p>
          <p><strong>特点</strong>: 将HTML特殊字符转换为实体引用</p>
          <p><strong>应用</strong>: XSS防护、HTML内容安全、Web开发</p>
        </div>
      ),
      morse: (
        <div>
          <p><strong>用途</strong>: 摩尔斯电码通信</p>
          <p><strong>特点</strong>: 使用点(.)和线(-)的组合</p>
          <p><strong>应用</strong>: 业余无线电、应急通信、历史通信</p>
        </div>
      ),
      rot13: (
        <div>
          <p><strong>用途</strong>: 简单的字母替换密码</p>
          <p><strong>特点</strong>: 每个字母向后移动13位</p>
          <p><strong>应用</strong>: 文本混淆、论坛剧透隐藏</p>
        </div>
      ),
      punycode: (
        <div>
          <p><strong>用途</strong>: 国际化域名编码</p>
          <p><strong>特点</strong>: 将Unicode域名转换为ASCII</p>
          <p><strong>应用</strong>: 国际化域名、多语言网址</p>
        </div>
      ),
      quoted: (
        <div>
          <p><strong>用途</strong>: 邮件传输编码</p>
          <p><strong>特点</strong>: 8位数据在7位系统中传输</p>
          <p><strong>应用</strong>: 电子邮件、MIME编码</p>
        </div>
      )
    }

    return descriptions[type] || <p>未知编码格式</p>
  }

  // 获取编码示例
  const getEncodingExample = (type: string) => {
    const examples: Record<string, JSX.Element> = {
      base64: (
        <div className="space-y-2 text-xs">
          <div><span className="text-green-600">原文:</span> Hello World!</div>
          <div><span className="text-blue-600">编码:</span> SGVsbG8gV29ybGQh</div>
        </div>
      ),
      url: (
        <div className="space-y-2 text-xs">
          <div><span className="text-green-600">原文:</span> Hello World!</div>
          <div><span className="text-blue-600">编码:</span> Hello%20World%21</div>
        </div>
      ),
      hex: (
        <div className="space-y-2 text-xs">
          <div><span className="text-green-600">原文:</span> Hello</div>
          <div><span className="text-blue-600">编码:</span> 48656c6c6f</div>
        </div>
      ),
      unicode: (
        <div className="space-y-2 text-xs">
          <div><span className="text-green-600">原文:</span> Hello</div>
          <div><span className="text-blue-600">编码:</span> \u0048\u0065\u006c\u006c\u006f</div>
        </div>
      ),
      utf8: (
        <div className="space-y-2 text-xs">
          <div><span className="text-green-600">原文:</span> Hello</div>
          <div><span className="text-blue-600">编码:</span> 48 65 6c 6c 6f</div>
        </div>
      ),
      ascii: (
        <div className="space-y-2 text-xs">
          <div><span className="text-green-600">原文:</span> Hello</div>
          <div><span className="text-blue-600">编码:</span> 72 101 108 108 111</div>
        </div>
      ),
      base32: (
        <div className="space-y-2 text-xs">
          <div><span className="text-green-600">原文:</span> Hello</div>
          <div><span className="text-blue-600">编码:</span> JBSWY3DP</div>
        </div>
      ),
      base58: (
        <div className="space-y-2 text-xs">
          <div><span className="text-green-600">原文:</span> Hello</div>
          <div><span className="text-blue-600">编码:</span> 9Ajdvzr</div>
        </div>
      ),
      base85: (
        <div className="space-y-2 text-xs">
          <div><span className="text-green-600">原文:</span> Hello</div>
          <div><span className="text-blue-600">编码:</span> 9jqo^</div>
        </div>
      ),
      binary: (
        <div className="space-y-2 text-xs">
          <div><span className="text-green-600">原文:</span> Hi</div>
          <div><span className="text-blue-600">编码:</span> 01001000 01101001</div>
        </div>
      ),
      octal: (
        <div className="space-y-2 text-xs">
          <div><span className="text-green-600">原文:</span> Hi</div>
          <div><span className="text-blue-600">编码:</span> \110\151</div>
        </div>
      ),
      html: (
        <div className="space-y-2 text-xs">
          <div><span className="text-green-600">原文:</span> &lt;script&gt;</div>
          <div><span className="text-blue-600">编码:</span> &amp;lt;script&amp;gt;</div>
        </div>
      ),
      morse: (
        <div className="space-y-2 text-xs">
          <div><span className="text-green-600">原文:</span> SOS</div>
          <div><span className="text-blue-600">编码:</span> ... --- ...</div>
        </div>
      ),
      rot13: (
        <div className="space-y-2 text-xs">
          <div><span className="text-green-600">原文:</span> Hello</div>
          <div><span className="text-blue-600">编码:</span> Uryyb</div>
        </div>
      ),
      punycode: (
        <div className="space-y-2 text-xs">
          <div><span className="text-green-600">原文:</span> 测试.com</div>
          <div><span className="text-blue-600">编码:</span> xn--0zwm56d.com</div>
        </div>
      ),
      quoted: (
        <div className="space-y-2 text-xs">
          <div><span className="text-green-600">原文:</span> 你好世界</div>
          <div><span className="text-blue-600">编码:</span> =E4=BD=A0=E5=A5=BD=E4=B8=96=E7=95=8C</div>
        </div>
      )
    }

    return examples[type] || <div className="text-xs">暂无示例</div>
  }

  // 根据传入的功能参数设置初始编码类型
  useEffect(() => {
    if (params?.feature) {
      // 将功能名称转换为小写以进行不区分大小写的比较
      const featureLower = params.feature.toLowerCase()

      // 查找匹配的编码类型
      const matchedType = encodingTypes.find(
        (type) => type.name.toLowerCase() === featureLower || type.id.toLowerCase() === featureLower,
      )

      if (matchedType) {
        setEncodingType(matchedType.id)
      }
    }
  }, [params])

  // Base64编码
  const base64Encode = (text: string): string => {
    try {
      if (multiline) {
        // 处理多行文本，每行单独编码
        return text
          .split("\n")
          .map((line) => (line.trim() ? btoa(unescape(encodeURIComponent(line))) : ""))
          .join("\n")
      }
      return btoa(unescape(encodeURIComponent(text)))
    } catch (error) {
      setError((prev) => ({ ...prev, encode: t("invalidInput") }))
      return ""
    }
  }

  // Base64解码
  const base64Decode = (text: string): string => {
    try {
      if (multiline) {
        // 处理多行文本，每行单独解码
        return text
          .split("\n")
          .map((line) => {
            try {
              return line.trim() ? decodeURIComponent(escape(atob(line))) : ""
            } catch {
              return `[${t("invalidInput")}: ${line}]`
            }
          })
          .join("\n")
      }
      return decodeURIComponent(escape(atob(text)))
    } catch (error) {
      setError((prev) => ({ ...prev, decode: t("invalidInput") }))
      return ""
    }
  }

  // URL编码
  const urlEncode = (text: string): string => {
    try {
      if (multiline) {
        // 处理多行文本，每行单独编码
        return text
          .split("\n")
          .map((line) => (line.trim() ? encodeURIComponent(line) : ""))
          .join("\n")
      }
      return encodeURIComponent(text)
    } catch (error) {
      setError((prev) => ({ ...prev, encode: t("invalidInput") }))
      return ""
    }
  }

  // URL解码
  const urlDecode = (text: string): string => {
    try {
      if (multiline) {
        // 处理多行文本，每行单独解码
        return text
          .split("\n")
          .map((line) => {
            try {
              return line.trim() ? decodeURIComponent(line) : ""
            } catch {
              return `[${t("invalidInput")}: ${line}]`
            }
          })
          .join("\n")
      }
      return decodeURIComponent(text)
    } catch (error) {
      setError((prev) => ({ ...prev, decode: t("invalidInput") }))
      return ""
    }
  }

  // Hex编码
  const hexEncode = (text: string): string => {
    try {
      if (multiline) {
        // 处理多行文本，每行单独编码
        return text
          .split("\n")
          .map((line) => {
            if (!line.trim()) return ""
            return Array.from(new TextEncoder().encode(line))
              .map((b) => b.toString(16).padStart(2, "0"))
              .join("")
          })
          .join("\n")
      }
      return Array.from(new TextEncoder().encode(text))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("")
    } catch (error) {
      setError((prev) => ({ ...prev, encode: t("invalidInput") }))
      return ""
    }
  }

  // Hex解码
  const hexDecode = (text: string): string => {
    try {
      if (multiline) {
        // 处理多行文本，每行单独解码
        return text
          .split("\n")
          .map((line) => {
            try {
              if (!line.trim()) return ""
              // 移除所有空格和换行符
              const cleanHex = line.replace(/\s+/g, "")
              // 确保是有效的十六进制字符串
              if (!/^[0-9a-fA-F]*$/.test(cleanHex)) {
                return `[${t("invalidInput")}: ${line}]`
              }

              const bytes = new Uint8Array(cleanHex.match(/.{1,2}/g)?.map((byte) => Number.parseInt(byte, 16)) || [])
              return new TextDecoder().decode(bytes)
            } catch {
              return `[${t("invalidInput")}: ${line}]`
            }
          })
          .join("\n")
      }

      // 移除所有空格和换行符
      const cleanHex = text.replace(/\s+/g, "")
      // 确保是有效的十六进制字符串
      if (!/^[0-9a-fA-F]*$/.test(cleanHex)) {
        throw new Error("Invalid hex string")
      }

      const bytes = new Uint8Array(cleanHex.match(/.{1,2}/g)?.map((byte) => Number.parseInt(byte, 16)) || [])
      return new TextDecoder().decode(bytes)
    } catch (error) {
      setError((prev) => ({ ...prev, decode: t("invalidInput") }))
      return ""
    }
  }

  // Unicode编码
  const unicodeEncode = (text: string): string => {
    try {
      if (multiline) {
        // 处理多行文本，每行单独编码
        return text
          .split("\n")
          .map((line) => {
            if (!line.trim()) return ""
            return Array.from(line)
              .map((char) => {
                const code = char.charCodeAt(0)
                return `\\u${code.toString(16).padStart(4, "0")}`
              })
              .join("")
          })
          .join("\n")
      }

      return Array.from(text)
        .map((char) => {
          const code = char.charCodeAt(0)
          return `\\u${code.toString(16).padStart(4, "0")}`
        })
        .join("")
    } catch (error) {
      setError((prev) => ({ ...prev, encode: t("invalidInput") }))
      return ""
    }
  }

  // Unicode解码
  const unicodeDecode = (text: string): string => {
    try {
      if (multiline) {
        // 处理多行文本，每行单独解码
        return text
          .split("\n")
          .map((line) => {
            try {
              if (!line.trim()) return ""
              return line.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(Number.parseInt(hex, 16)))
            } catch {
              return `[${t("invalidInput")}: ${line}]`
            }
          })
          .join("\n")
      }

      return text.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(Number.parseInt(hex, 16)))
    } catch (error) {
      setError((prev) => ({ ...prev, decode: t("invalidInput") }))
      return ""
    }
  }

  // UTF-8编码
  const utf8Encode = (text: string): string => {
    try {
      if (multiline) {
        // 处理多行文本，每行单独编码
        return text
          .split("\n")
          .map((line) => {
            if (!line.trim()) return ""
            const bytes = new TextEncoder().encode(line)
            return Array.from(bytes)
              .map((b) => b.toString(16).padStart(2, "0"))
              .join(" ")
          })
          .join("\n")
      }

      const bytes = new TextEncoder().encode(text)
      return Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join(" ")
    } catch (error) {
      setError((prev) => ({ ...prev, encode: t("invalidInput") }))
      return ""
    }
  }

  // UTF-8解码
  const utf8Decode = (text: string): string => {
    try {
      if (multiline) {
        // 处理多行文本，每行单独解码
        return text
          .split("\n")
          .map((line) => {
            try {
              if (!line.trim()) return ""
              const bytes = line
                .trim()
                .split(/\s+/)
                .map((hex) => Number.parseInt(hex, 16))
              return new TextDecoder().decode(new Uint8Array(bytes))
            } catch {
              return `[${t("invalidInput")}: ${line}]`
            }
          })
          .join("\n")
      }

      const bytes = text
        .trim()
        .split(/\s+/)
        .map((hex) => Number.parseInt(hex, 16))
      return new TextDecoder().decode(new Uint8Array(bytes))
    } catch (error) {
      setError((prev) => ({ ...prev, decode: t("invalidInput") }))
      return ""
    }
  }

  // ASCII编码
  const asciiEncode = (text: string): string => {
    try {
      if (multiline) {
        // 处理多行文本，每行单独编码
        return text
          .split("\n")
          .map((line) => {
            if (!line.trim()) return ""
            return Array.from(line)
              .map((char) => char.charCodeAt(0).toString())
              .join(" ")
          })
          .join("\n")
      }

      return Array.from(text)
        .map((char) => char.charCodeAt(0).toString())
        .join(" ")
    } catch (error) {
      setError((prev) => ({ ...prev, encode: t("invalidInput") }))
      return ""
    }
  }

  // ASCII解码
  const asciiDecode = (text: string): string => {
    try {
      if (multiline) {
        // 处理多行文本，每行单独解码
        return text
          .split("\n")
          .map((line) => {
            try {
              if (!line.trim()) return ""
              return line
                .trim()
                .split(/\s+/)
                .map((code) => String.fromCharCode(Number.parseInt(code, 10)))
                .join("")
            } catch {
              return `[${t("invalidInput")}: ${line}]`
            }
          })
          .join("\n")
      }

      return text
        .trim()
        .split(/\s+/)
        .map((code) => String.fromCharCode(Number.parseInt(code, 10)))
        .join("")
    } catch (error) {
      setError((prev) => ({ ...prev, decode: t("invalidInput") }))
      return ""
    }
  }

  // Base32编码
  const base32Encode = (text: string): string => {
    try {
      const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"

      if (multiline) {
        // 处理多行文本，每行单独编码
        return text
          .split("\n")
          .map((line) => {
            if (!line.trim()) return ""

            // 将字符串转换为字节数组
            const bytes = new TextEncoder().encode(line)
            let result = ""
            let bits = 0
            let value = 0

            for (let i = 0; i < bytes.length; i++) {
              value = (value << 8) | bytes[i]
              bits += 8

              while (bits >= 5) {
                bits -= 5
                result += alphabet[(value >>> bits) & 31]
              }
            }

            if (bits > 0) {
              result += alphabet[(value << (5 - bits)) & 31]
            }

            // 添加填充
            while (result.length % 8 !== 0) {
              result += "="
            }

            return result
          })
          .join("\n")
      }

      // 将字符串转换为字节数组
      const bytes = new TextEncoder().encode(text)
      let result = ""
      let bits = 0
      let value = 0

      for (let i = 0; i < bytes.length; i++) {
        value = (value << 8) | bytes[i]
        bits += 8

        while (bits >= 5) {
          bits -= 5
          result += alphabet[(value >>> bits) & 31]
        }
      }

      if (bits > 0) {
        result += alphabet[(value << (5 - bits)) & 31]
      }

      // 添加填充
      while (result.length % 8 !== 0) {
        result += "="
      }

      return result
    } catch (error) {
      setError((prev) => ({ ...prev, encode: t("invalidInput") }))
      return ""
    }
  }

  // Base32解码
  const base32Decode = (text: string): string => {
    try {
      const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"

      if (multiline) {
        // 处理多行文本，每行单独解码
        return text
          .split("\n")
          .map((line) => {
            try {
              if (!line.trim()) return ""

              // 移除填充和空格
              line = line.replace(/\s+/g, "").replace(/=+$/, "")

              const result = []
              let bits = 0
              let value = 0

              for (let i = 0; i < line.length; i++) {
                const char = line[i].toUpperCase()
                const index = alphabet.indexOf(char)

                if (index === -1) {
                  throw new Error(`Invalid character: ${char}`)
                }

                value = (value << 5) | index
                bits += 5

                if (bits >= 8) {
                  bits -= 8
                  result.push((value >>> bits) & 255)
                }
              }

              return new TextDecoder().decode(new Uint8Array(result))
            } catch {
              return `[${t("invalidInput")}: ${line}]`
            }
          })
          .join("\n")
      }

      // 移除填充和空格
      text = text.replace(/\s+/g, "").replace(/=+$/, "")

      const result = []
      let bits = 0
      let value = 0

      for (let i = 0; i < text.length; i++) {
        const char = text[i].toUpperCase()
        const index = alphabet.indexOf(char)

        if (index === -1) {
          throw new Error(`Invalid character: ${char}`)
        }

        value = (value << 5) | index
        bits += 5

        if (bits >= 8) {
          bits -= 8
          result.push((value >>> bits) & 255)
        }
      }

      return new TextDecoder().decode(new Uint8Array(result))
    } catch (error) {
      setError((prev) => ({ ...prev, decode: t("invalidInput") }))
      return ""
    }
  }

  // 自定义进制编码（支持2-36进制）
  const baseEncode = (text: string): string => {
    try {
      // 默认从10进制转到16进制
      const fromBase = 10
      const toBase = 16

      if (multiline) {
        // 处理多行文本，每行单独编码
        return text
          .split("\n")
          .map((line) => {
            if (!line.trim()) return ""

            try {
              // 尝试将输入解析为数字
              const num = Number.parseInt(line.trim(), fromBase)
              if (isNaN(num)) {
                return `[${t("invalidInput")}: ${line}]`
              }

              return num.toString(toBase).toUpperCase()
            } catch {
              return `[${t("invalidInput")}: ${line}]`
            }
          })
          .join("\n")
      }

      // 尝试将输入解析为数字
      const num = Number.parseInt(text.trim(), fromBase)
      if (isNaN(num)) {
        throw new Error("Invalid number")
      }

      return num.toString(toBase).toUpperCase()
    } catch (error) {
      setError((prev) => ({ ...prev, encode: t("invalidInput") }))
      return ""
    }
  }

  // 自定义进制解码（支持2-36进制）
  const baseDecode = (text: string): string => {
    try {
      // 默认从16进制转到10进制
      const fromBase = 16
      const toBase = 10

      if (multiline) {
        // 处理多行文本，每行单独解码
        return text
          .split("\n")
          .map((line) => {
            if (!line.trim()) return ""

            try {
              // 移除空格和前缀（如0x）
              const cleanInput = line.trim().replace(/^0x/i, "").replace(/\s+/g, "")

              // 检查是否为有效的fromBase进制数
              const validChars = new RegExp(
                `^[0-9${fromBase > 10 ? "a-" + String.fromCharCode(87 + fromBase) : ""}${fromBase > 10 ? "A-" + String.fromCharCode(55 + fromBase) : ""}]+$`,
              )

              if (!validChars.test(cleanInput)) {
                return `[${t("invalidInput")}: ${line}]`
              }

              const num = Number.parseInt(cleanInput, fromBase)
              if (isNaN(num)) {
                return `[${t("invalidInput")}: ${line}]`
              }

              return num.toString(toBase)
            } catch {
              return `[${t("invalidInput")}: ${line}]`
            }
          })
          .join("\n")
      }

      // 移除空格和前缀（如0x）
      const cleanInput = text.trim().replace(/^0x/i, "").replace(/\s+/g, "")

      // 检查是否为有效的fromBase进制数
      const validChars = new RegExp(
        `^[0-9${fromBase > 10 ? "a-" + String.fromCharCode(87 + fromBase) : ""}${fromBase > 10 ? "A-" + String.fromCharCode(55 + fromBase) : ""}]+$`,
      )

      if (!validChars.test(cleanInput)) {
        throw new Error("Invalid input for the selected base")
      }

      const num = Number.parseInt(cleanInput, fromBase)
      if (isNaN(num)) {
        throw new Error("Invalid number")
      }

      return num.toString(toBase)
    } catch (error) {
      setError((prev) => ({ ...prev, decode: t("invalidInput") }))
      return ""
    }
  }

  // Base58编码 (用于比特币地址等)
  const base58Encode = (text: string): string => {
    try {
      const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"
      const bytes = new TextEncoder().encode(text)

      if (multiline) {
        return text
          .split("\n")
          .map((line) => {
            if (!line.trim()) return ""
            const lineBytes = new TextEncoder().encode(line)
            return encodeBase58(lineBytes, alphabet)
          })
          .join("\n")
      }

      return encodeBase58(bytes, alphabet)
    } catch (error) {
      setError((prev) => ({ ...prev, encode: t("invalidInput") }))
      return ""
    }
  }

  const base58Decode = (text: string): string => {
    try {
      const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"

      if (multiline) {
        return text
          .split("\n")
          .map((line) => {
            try {
              if (!line.trim()) return ""
              const bytes = decodeBase58(line.trim(), alphabet)
              return new TextDecoder().decode(bytes)
            } catch {
              return `[${t("invalidInput")}: ${line}]`
            }
          })
          .join("\n")
      }

      const bytes = decodeBase58(text.trim(), alphabet)
      return new TextDecoder().decode(bytes)
    } catch (error) {
      setError((prev) => ({ ...prev, decode: t("invalidInput") }))
      return ""
    }
  }

  // Base58辅助函数
  const encodeBase58 = (bytes: Uint8Array, alphabet: string): string => {
    let num = BigInt(0)
    for (const byte of bytes) {
      num = num * BigInt(256) + BigInt(byte)
    }

    let result = ""
    while (num > 0) {
      result = alphabet[Number(num % BigInt(58))] + result
      num = num / BigInt(58)
    }

    // 处理前导零
    for (const byte of bytes) {
      if (byte === 0) result = alphabet[0] + result
      else break
    }

    return result || alphabet[0]
  }

  const decodeBase58 = (text: string, alphabet: string): Uint8Array => {
    let num = BigInt(0)
    for (const char of text) {
      const index = alphabet.indexOf(char)
      if (index === -1) throw new Error("Invalid character")
      num = num * BigInt(58) + BigInt(index)
    }

    const bytes: number[] = []
    while (num > 0) {
      bytes.unshift(Number(num % BigInt(256)))
      num = num / BigInt(256)
    }

    // 处理前导零
    for (const char of text) {
      if (char === alphabet[0]) bytes.unshift(0)
      else break
    }

    return new Uint8Array(bytes)
  }

  // Base85编码 (ASCII85)
  const base85Encode = (text: string): string => {
    try {
      const bytes = new TextEncoder().encode(text)

      if (multiline) {
        return text
          .split("\n")
          .map((line) => {
            if (!line.trim()) return ""
            const lineBytes = new TextEncoder().encode(line)
            return encodeBase85(lineBytes)
          })
          .join("\n")
      }

      return encodeBase85(bytes)
    } catch (error) {
      setError((prev) => ({ ...prev, encode: t("invalidInput") }))
      return ""
    }
  }

  const base85Decode = (text: string): string => {
    try {
      if (multiline) {
        return text
          .split("\n")
          .map((line) => {
            try {
              if (!line.trim()) return ""
              const bytes = decodeBase85(line.trim())
              return new TextDecoder().decode(bytes)
            } catch {
              return `[${t("invalidInput")}: ${line}]`
            }
          })
          .join("\n")
      }

      const bytes = decodeBase85(text.trim())
      return new TextDecoder().decode(bytes)
    } catch (error) {
      setError((prev) => ({ ...prev, decode: t("invalidInput") }))
      return ""
    }
  }

  // Base85辅助函数
  const encodeBase85 = (bytes: Uint8Array): string => {
    let result = ""
    for (let i = 0; i < bytes.length; i += 4) {
      let value = 0
      for (let j = 0; j < 4 && i + j < bytes.length; j++) {
        value = value * 256 + (bytes[i + j] || 0)
      }

      if (value === 0 && i + 4 <= bytes.length) {
        result += "z"
      } else {
        const chars = []
        for (let k = 0; k < 5; k++) {
          chars.unshift(String.fromCharCode(33 + (value % 85)))
          value = Math.floor(value / 85)
        }
        result += chars.join("")
      }
    }

    return result
  }

  const decodeBase85 = (text: string): Uint8Array => {
    const result: number[] = []

    for (let i = 0; i < text.length; i += 5) {
      if (text[i] === "z") {
        result.push(0, 0, 0, 0)
        i -= 4
        continue
      }

      let value = 0
      for (let j = 0; j < 5 && i + j < text.length; j++) {
        const charCode = text.charCodeAt(i + j) - 33
        if (charCode < 0 || charCode >= 85) throw new Error("Invalid character")
        value = value * 85 + charCode
      }

      for (let k = 3; k >= 0; k--) {
        result.push((value >>> (k * 8)) & 255)
      }
    }

    return new Uint8Array(result)
  }

  // 二进制编码
  const binaryEncode = (text: string): string => {
    try {
      if (multiline) {
        return text
          .split("\n")
          .map((line) => {
            if (!line.trim()) return ""
            return Array.from(new TextEncoder().encode(line))
              .map(byte => byte.toString(2).padStart(8, '0'))
              .join(' ')
          })
          .join("\n")
      }

      return Array.from(new TextEncoder().encode(text))
        .map(byte => byte.toString(2).padStart(8, '0'))
        .join(' ')
    } catch (error) {
      setError((prev) => ({ ...prev, encode: t("invalidInput") }))
      return ""
    }
  }

  const binaryDecode = (text: string): string => {
    try {
      if (multiline) {
        return text
          .split("\n")
          .map((line) => {
            try {
              if (!line.trim()) return ""
              const bytes = line.trim().split(/\s+/)
                .map(bin => parseInt(bin, 2))
              return new TextDecoder().decode(new Uint8Array(bytes))
            } catch {
              return `[${t("invalidInput")}: ${line}]`
            }
          })
          .join("\n")
      }

      const bytes = text.trim().split(/\s+/)
        .map(bin => parseInt(bin, 2))
      return new TextDecoder().decode(new Uint8Array(bytes))
    } catch (error) {
      setError((prev) => ({ ...prev, decode: t("invalidInput") }))
      return ""
    }
  }

  // 八进制编码
  const octalEncode = (text: string): string => {
    try {
      if (multiline) {
        return text
          .split("\n")
          .map((line) => {
            if (!line.trim()) return ""
            return Array.from(new TextEncoder().encode(line))
              .map(byte => '\\' + byte.toString(8).padStart(3, '0'))
              .join('')
          })
          .join("\n")
      }

      return Array.from(new TextEncoder().encode(text))
        .map(byte => '\\' + byte.toString(8).padStart(3, '0'))
        .join('')
    } catch (error) {
      setError((prev) => ({ ...prev, encode: t("invalidInput") }))
      return ""
    }
  }

  const octalDecode = (text: string): string => {
    try {
      if (multiline) {
        return text
          .split("\n")
          .map((line) => {
            try {
              if (!line.trim()) return ""
              const octals = line.match(/\\(\d{1,3})/g) || []
              const bytes = octals.map(oct => parseInt(oct.slice(1), 8))
              return new TextDecoder().decode(new Uint8Array(bytes))
            } catch {
              return `[${t("invalidInput")}: ${line}]`
            }
          })
          .join("\n")
      }

      const octals = text.match(/\\(\d{1,3})/g) || []
      const bytes = octals.map(oct => parseInt(oct.slice(1), 8))
      return new TextDecoder().decode(new Uint8Array(bytes))
    } catch (error) {
      setError((prev) => ({ ...prev, decode: t("invalidInput") }))
      return ""
    }
  }

  // HTML实体编码
  const htmlEncode = (text: string): string => {
    try {
      const htmlEntities: Record<string, string> = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
        ' ': '&nbsp;'
      }

      return text.replace(/[&<>"' ]/g, char => htmlEntities[char] || char)
    } catch (error) {
      setError((prev) => ({ ...prev, encode: t("invalidInput") }))
      return ""
    }
  }

  const htmlDecode = (text: string): string => {
    try {
      const htmlEntities: Record<string, string> = {
        '&amp;': '&',
        '&lt;': '<',
        '&gt;': '>',
        '&quot;': '"',
        '&#39;': "'",
        '&nbsp;': ' '
      }

      return text.replace(/&[a-zA-Z0-9#]+;/g, entity => htmlEntities[entity] || entity)
    } catch (error) {
      setError((prev) => ({ ...prev, decode: t("invalidInput") }))
      return ""
    }
  }

  // 摩尔斯电码
  const morseEncode = (text: string): string => {
    try {
      const morseCode: Record<string, string> = {
        'A': '.-', 'B': '-...', 'C': '-.-.', 'D': '-..', 'E': '.', 'F': '..-.',
        'G': '--.', 'H': '....', 'I': '..', 'J': '.---', 'K': '-.-', 'L': '.-..',
        'M': '--', 'N': '-.', 'O': '---', 'P': '.--.', 'Q': '--.-', 'R': '.-.',
        'S': '...', 'T': '-', 'U': '..-', 'V': '...-', 'W': '.--', 'X': '-..-',
        'Y': '-.--', 'Z': '--..', '0': '-----', '1': '.----', '2': '..---',
        '3': '...--', '4': '....-', '5': '.....', '6': '-....', '7': '--...',
        '8': '---..', '9': '----.', ' ': '/', '.': '.-.-.-', ',': '--..--',
        '?': '..--..', "'": '.----.', '!': '-.-.--', '/': '-..-.', '(': '-.--.',
        ')': '-.--.-', '&': '.-...', ':': '---...', ';': '-.-.-.', '=': '-...-',
        '+': '.-.-.', '-': '-....-', '_': '..--.-', '"': '.-..-.', '$': '...-..-',
        '@': '.--.-.'
      }

      return text.toUpperCase()
        .split('')
        .map(char => morseCode[char] || char)
        .join(' ')
    } catch (error) {
      setError((prev) => ({ ...prev, encode: t("invalidInput") }))
      return ""
    }
  }

  const morseDecode = (text: string): string => {
    try {
      const morseToChar: Record<string, string> = {
        '.-': 'A', '-...': 'B', '-.-.': 'C', '-..': 'D', '.': 'E', '..-.': 'F',
        '--.': 'G', '....': 'H', '..': 'I', '.---': 'J', '-.-': 'K', '.-..': 'L',
        '--': 'M', '-.': 'N', '---': 'O', '.--.': 'P', '--.-': 'Q', '.-.': 'R',
        '...': 'S', '-': 'T', '..-': 'U', '...-': 'V', '.--': 'W', '-..-': 'X',
        '-.--': 'Y', '--..': 'Z', '-----': '0', '.----': '1', '..---': '2',
        '...--': '3', '....-': '4', '.....': '5', '-....': '6', '--...': '7',
        '---..': '8', '----.': '9', '/': ' ', '.-.-.-': '.', '--..--': ',',
        '..--..': '?', '.----.': "'", '-.-.--': '!', '-..-.': '/', '-.--.': '(',
        '-.--.-': ')', '.-...': '&', '---...': ':', '-.-.-.': ';', '-...-': '=',
        '.-.-.': '+', '-....-': '-', '..--.-': '_', '.-..-.': '"', '...-..-': '$',
        '.--.-': '@'
      }

      return text.split(' ')
        .map(morse => morseToChar[morse] || morse)
        .join('')
    } catch (error) {
      setError((prev) => ({ ...prev, decode: t("invalidInput") }))
      return ""
    }
  }

  // ROT13编码
  const rot13Encode = (text: string): string => {
    try {
      return text.replace(/[a-zA-Z]/g, char => {
        const start = char <= 'Z' ? 65 : 97
        return String.fromCharCode(((char.charCodeAt(0) - start + 13) % 26) + start)
      })
    } catch (error) {
      setError((prev) => ({ ...prev, encode: t("invalidInput") }))
      return ""
    }
  }

  const rot13Decode = rot13Encode // ROT13是自己的逆运算

  // Punycode编码 (用于国际化域名)
  const punycodeEncode = (text: string): string => {
    try {
      // 简化的Punycode实现
      const encoded = text.split('').map(char => {
        const code = char.charCodeAt(0)
        return code > 127 ? `xn--${code.toString(36)}` : char
      }).join('')

      return encoded
    } catch (error) {
      setError((prev) => ({ ...prev, encode: t("invalidInput") }))
      return ""
    }
  }

  const punycodeDecode = (text: string): string => {
    try {
      // 简化的Punycode解码
      return text.replace(/xn--([a-z0-9]+)/g, (match, code) => {
        const charCode = parseInt(code, 36)
        return String.fromCharCode(charCode)
      })
    } catch (error) {
      setError((prev) => ({ ...prev, decode: t("invalidInput") }))
      return ""
    }
  }

  // Quoted-Printable编码
  const quotedEncode = (text: string): string => {
    try {
      if (multiline) {
        return text
          .split("\n")
          .map((line) => {
            if (!line.trim()) return ""
            // 将字符串转换为UTF-8字节，然后编码每个字节
            const utf8Bytes = new TextEncoder().encode(line)
            let result = ""
            for (const byte of utf8Bytes) {
              if (byte >= 0x20 && byte <= 0x7E && byte !== 0x3D) { // 可打印ASCII字符，除了=号
                result += String.fromCharCode(byte)
              } else {
                result += `=${byte.toString(16).toUpperCase().padStart(2, '0')}`
              }
            }
            return result.replace(/ $/gm, '=20') // 行尾空格编码
          })
          .join("\n")
      }

      // 将字符串转换为UTF-8字节，然后编码每个字节
      const utf8Bytes = new TextEncoder().encode(text)
      let result = ""
      for (const byte of utf8Bytes) {
        if (byte >= 0x20 && byte <= 0x7E && byte !== 0x3D) { // 可打印ASCII字符，除了=号
          result += String.fromCharCode(byte)
        } else {
          result += `=${byte.toString(16).toUpperCase().padStart(2, '0')}`
        }
      }
      return result.replace(/ $/gm, '=20') // 行尾空格编码
    } catch (error) {
      setError((prev) => ({ ...prev, encode: t("invalidInput") }))
      return ""
    }
  }

  const quotedDecode = (text: string): string => {
    try {
      if (multiline) {
        return text
          .split("\n")
          .map((line) => {
            try {
              if (!line.trim()) return ""

              // 收集所有字节
              const bytes = []
              let i = 0
              while (i < line.length) {
                if (line[i] === '=' && i + 2 < line.length) {
                  const hex = line.substring(i + 1, i + 3)
                  if (/^[0-9A-F]{2}$/i.test(hex)) {
                    bytes.push(parseInt(hex, 16))
                    i += 3
                  } else {
                    bytes.push(line.charCodeAt(i))
                    i += 1
                  }
                } else {
                  bytes.push(line.charCodeAt(i))
                  i += 1
                }
              }

              // 使用TextDecoder解码UTF-8字节序列
              return new TextDecoder('utf-8').decode(new Uint8Array(bytes))
            } catch {
              return `[${t("invalidInput")}: ${line}]`
            }
          })
          .join("\n")
      }

      // 收集所有字节
      const bytes = []
      let i = 0
      while (i < text.length) {
        if (text[i] === '=' && i + 2 < text.length) {
          const hex = text.substring(i + 1, i + 3)
          if (/^[0-9A-F]{2}$/i.test(hex)) {
            bytes.push(parseInt(hex, 16))
            i += 3
          } else {
            bytes.push(text.charCodeAt(i))
            i += 1
          }
        } else {
          bytes.push(text.charCodeAt(i))
          i += 1
        }
      }

      // 使用TextDecoder解码UTF-8字节序列
      return new TextDecoder('utf-8').decode(new Uint8Array(bytes))
    } catch (error) {
      setError((prev) => ({ ...prev, decode: t("invalidInput") }))
      return ""
    }
  }

  // 执行所有编码操作
  const encodeAll = (text: string) => {
    if (!text) return []

    // Clear any existing errors when in batch mode
    if (showAllResults) {
      setError({})
    }

    const results = encodingTypes.map((type) => {
      let result = ""
      try {
        switch (type.id) {
          case "base64":
            result = multiline
              ? text
                .split("\n")
                .map((line) => (line.trim() ? btoa(unescape(encodeURIComponent(line))) : ""))
                .join("\n")
              : btoa(unescape(encodeURIComponent(text)))
            break
          case "url":
            result = multiline
              ? text
                .split("\n")
                .map((line) => (line.trim() ? encodeURIComponent(line) : ""))
                .join("\n")
              : encodeURIComponent(text)
            break
          case "hex":
            result = hexEncode(text)
            break
          case "unicode":
            result = unicodeEncode(text)
            break
          case "utf8":
            result = utf8Encode(text)
            break
          case "ascii":
            result = asciiEncode(text)
            break
          case "base32":
            result = base32Encode(text)
            break
          case "base58":
            result = base58Encode(text)
            break
          case "base85":
            result = base85Encode(text)
            break
          case "binary":
            result = binaryEncode(text)
            break
          case "octal":
            result = octalEncode(text)
            break
          case "html":
            result = htmlEncode(text)
            break
          case "morse":
            result = morseEncode(text)
            break
          case "rot13":
            result = rot13Encode(text)
            break
          case "punycode":
            result = punycodeEncode(text)
            break
          case "quoted":
            result = quotedEncode(text)
            break
          case "base":
            result = baseEncode(text)
            break
        }
      } catch (error) {
        result = `[${t("error")}]`
      }
      return { type: type.name, result }
    })

    return results
  }

  // 执行所有解码操作
  const decodeAll = (text: string) => {
    if (!text) return []

    // Clear any existing errors when in batch mode
    if (showAllResults) {
      setError({})
    }

    const results = encodingTypes.map((type) => {
      let result = ""
      try {
        switch (type.id) {
          case "base64":
            result = multiline
              ? text
                .split("\n")
                .map((line) => {
                  try {
                    return line.trim() ? decodeURIComponent(escape(atob(line))) : ""
                  } catch {
                    return `[${t("invalidInput")}: ${line}]`
                  }
                })
                .join("\n")
              : decodeURIComponent(escape(atob(text)))
            break
          case "url":
            result = multiline
              ? text
                .split("\n")
                .map((line) => {
                  try {
                    return line.trim() ? decodeURIComponent(line) : ""
                  } catch {
                    return `[${t("invalidInput")}: ${line}]`
                  }
                })
                .join("\n")
              : decodeURIComponent(text)
            break
          case "hex":
            result = hexDecode(text)
            break
          case "unicode":
            result = unicodeDecode(text)
            break
          case "utf8":
            result = utf8Decode(text)
            break
          case "ascii":
            result = asciiDecode(text)
            break
          case "base32":
            result = base32Decode(text)
            break
          case "base58":
            result = base58Decode(text)
            break
          case "base85":
            result = base85Decode(text)
            break
          case "binary":
            result = binaryDecode(text)
            break
          case "octal":
            result = octalDecode(text)
            break
          case "html":
            result = htmlDecode(text)
            break
          case "morse":
            result = morseDecode(text)
            break
          case "rot13":
            result = rot13Decode(text)
            break
          case "punycode":
            result = punycodeDecode(text)
            break
          case "quoted":
            result = quotedDecode(text)
            break
          case "base":
            result = baseDecode(text)
            break
        }
      } catch (error) {
        result = `[${t("invalidInput")}]`
      }
      return { type: type.name, result }
    })

    return results
  }

  // 处理编码
  const handleEncode = () => {
    // Always clear errors
    setError({})

    if (!encodeInput) {
      setDecodeInput("")
      setDecodeInputLength(0) // 重置解码输入长度
      setAllEncodeResults([])
      return
    }

    try {
      // In batch mode, always execute all encoding operations
      if (showAllResults) {
        // Execute all encoding operations
        const results = encodeAll(encodeInput)
        setAllEncodeResults(results)
        setAllDecodeResults([]) // Clear decode results when showing encode results
        setDecodeInput("")
        setDecodeInputLength(0) // 重置解码输入长度
      } else {
        // Only execute the currently selected encoding operation
        let result = ""
        // Process based on encoding type
        switch (encodingType) {
          case "base64":
            result = base64Encode(encodeInput)
            break
          case "url":
            result = urlEncode(encodeInput)
            break
          case "hex":
            result = hexEncode(encodeInput)
            break
          case "unicode":
            result = unicodeEncode(encodeInput)
            break
          case "utf8":
            result = utf8Encode(encodeInput)
            break
          case "ascii":
            result = asciiEncode(encodeInput)
            break
          case "base32":
            result = base32Encode(encodeInput)
            break
          case "base58":
            result = base58Encode(encodeInput)
            break
          case "base85":
            result = base85Encode(encodeInput)
            break
          case "binary":
            result = binaryEncode(encodeInput)
            break
          case "octal":
            result = octalEncode(encodeInput)
            break
          case "html":
            result = htmlEncode(encodeInput)
            break
          case "morse":
            result = morseEncode(encodeInput)
            break
          case "rot13":
            result = rot13Encode(encodeInput)
            break
          case "punycode":
            result = punycodeEncode(encodeInput)
            break
          case "quoted":
            result = quotedEncode(encodeInput)
            break
          case "base":
            result = baseEncode(encodeInput)
            break
          default:
            result = base64Encode(encodeInput)
        }
        setDecodeInput(result)
        setDecodeInputLength(result.length) // 更新解码输入长度
        setAllEncodeResults([])
      }
    } catch (error) {
      console.error("Encoding error:", error)
      if (!showAllResults) {
        setError((prev) => ({ ...prev, encode: t("error") }))
      }
      setDecodeInput("")
      setDecodeInputLength(0) // 重置解码输入长度
    }
  }

  // 处理解码
  const handleDecode = () => {
    // Always clear errors
    setError({})

    if (!decodeInput) {
      setEncodeInput("")
      setEncodeInputLength(0) // 重置编码输入长度
      setAllDecodeResults([])
      return
    }

    try {
      // In batch mode, always execute all decoding operations
      if (showAllResults) {
        // Execute all decoding operations
        const results = decodeAll(decodeInput)
        setAllDecodeResults(results)
        setAllEncodeResults([]) // Clear encode results when showing encode results
        setEncodeInput("")
        setEncodeInputLength(0) // 重置编码输入长度
      } else {
        // Only execute the currently selected decoding operation
        let result = ""
        // Process based on encoding type
        switch (encodingType) {
          case "base64":
            result = base64Decode(decodeInput)
            break
          case "url":
            result = urlDecode(decodeInput)
            break
          case "hex":
            result = hexDecode(decodeInput)
            break
          case "unicode":
            result = unicodeDecode(decodeInput)
            break
          case "utf8":
            result = utf8Decode(decodeInput)
            break
          case "ascii":
            result = asciiDecode(decodeInput)
            break
          case "base32":
            result = base32Decode(decodeInput)
            break
          case "base58":
            result = base58Decode(decodeInput)
            break
          case "base85":
            result = base85Decode(decodeInput)
            break
          case "binary":
            result = binaryDecode(decodeInput)
            break
          case "octal":
            result = octalDecode(decodeInput)
            break
          case "html":
            result = htmlDecode(decodeInput)
            break
          case "morse":
            result = morseDecode(decodeInput)
            break
          case "rot13":
            result = rot13Decode(decodeInput)
            break
          case "punycode":
            result = punycodeDecode(decodeInput)
            break
          case "quoted":
            result = quotedDecode(decodeInput)
            break
          case "base":
            result = baseDecode(decodeInput)
            break
          default:
            result = base64Decode(decodeInput)
        }
        setEncodeInput(result)
        setEncodeInputLength(result.length) // 更新编码输入长度
        setAllDecodeResults([])
      }
    } catch (error) {
      console.error("Decoding error:", error)
      if (!showAllResults) {
        setError((prev) => ({ ...prev, decode: t("error") }))
      }
      setEncodeInput("")
      setEncodeInputLength(0) // 重置编码输入长度
    }
  }

  // 复制结果
  const copyToClipboard = (text: string, key: string) => {
    if (!text) return

    navigator.clipboard.writeText(text).then(() => {
      // 清除之前的超时
      if (copyTimeoutRef.current[key]) {
        clearTimeout(copyTimeoutRef.current[key]!)
      }

      setCopied((prev) => ({ ...prev, [key]: true }))

      // 设置新的超时
      copyTimeoutRef.current[key] = setTimeout(() => {
        setCopied((prev) => ({ ...prev, [key]: false }))
      }, 2000)
    })
  }

  // 清空输入和输出
  const clearAll = () => {
    setEncodeInput("")
    setEncodeInputLength(0) // 重置编码输入长度
    setDecodeInput("")
    setDecodeInputLength(0) // 重置解码输入长度
    setError({})
    setAllEncodeResults([])
    setAllDecodeResults([])
  }

  // 清理复制超时
  useEffect(() => {
    return () => {
      Object.values(copyTimeoutRef.current).forEach((timeout) => {
        if (timeout) {
          clearTimeout(timeout)
        }
      })
    }
  }, [])

  // 当showAllResults变化时，清除结果
  useEffect(() => {
    // 清除单一模式和批量模式的结果
    if (showAllResults) {
      setDecodeInput("")
      setEncodeInput("")
    } else {
      setAllEncodeResults([])
      setAllDecodeResults([])
    }
  }, [showAllResults])

  // 监听编码类型切换，自动重新转换
  useEffect(() => {
    if (!autoSwitch) return

    // 如果有左侧输入内容，自动重新转换到右侧
    if (leftInput.trim()) {
      const targetType = leftType === "text" ? "encoded" : "text"
      const result = performTransform(leftInput, leftType, targetType)
      setRightInput(result)
      setRightInputLength(result.length)
    }
    // 如果有右侧输入内容，自动重新转换到左侧
    else if (rightInput.trim()) {
      const targetType = leftType === "text" ? "text" : "encoded"
      const result = performTransform(rightInput, leftType === "text" ? "encoded" : "text", targetType)
      setLeftInput(result)
      setLeftInputLength(result.length)
    }
  }, [encodingType, autoSwitch]) // 监听编码类型和自动切换开关的变化

  // 初始化字符长度计数
  useEffect(() => {
    setEncodeInputLength(encodeInput.length)
    setDecodeInputLength(decodeInput.length)
  }, [])

  // M3 Tabs items
  const tabItems: TabItem[] = React.useMemo(() => encodingTypes.map(t => ({
    id: t.id,
    label: t.name,
  })), [])

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      {/* 标题和模式切换 */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-200 mb-4">
          编解码工具
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
            <Switch id="legacy-mode" checked={showAllResults} onCheckedChange={setShowAllResults} />
            <Label htmlFor="legacy-mode" className="cursor-pointer text-sm">
              批量模式
            </Label>
          </div>
        </div>
      </div>

      {/* 新界面：左右侧转换 */}
      {!showAllResults && (
        <>
          {/* 编码类型选择 */}
          {/* 编码类型选择 */}
          <div className="mb-6">
            {/* 移动端：下拉选择 */}
            <div className="md:hidden mb-4">
              <Label className="mb-2 block text-sm font-medium text-[var(--md-sys-color-on-surface-variant)]">选择编码格式</Label>
              <Select value={encodingType} onValueChange={setEncodingType}>
                <SelectTrigger className="w-full input-modern h-12 bg-[var(--md-sys-color-surface-container-high)] border-none">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{encodingTypes.find(t => t.id === encodingType)?.name}</span>
                  </div>
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {encodingTypes.map((type) => (
                    <SelectItem key={type.id} value={type.id}>
                      {type.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 桌面端：Scrollable Tabs */}
            <div className="hidden md:block">
              <M3Tabs
                tabs={tabItems}
                activeTab={encodingType}
                onTabChange={setEncodingType}
                scrollable
                variant="secondary"
                className="w-full"
              />
            </div>

            {/* 编码说明折叠区域 */}
            <div className="mt-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowEncodingInfo(!showEncodingInfo)}
                className="w-full text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
              >
                <div className="flex items-center gap-2">
                  {showEncodingInfo ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                  <Settings className="h-4 w-4" />
                  <span>{encodingTypes.find(t => t.id === encodingType)?.name} 编码说明</span>
                  {!showEncodingInfo && (
                    <Badge variant="secondary" className="text-xs ml-auto">
                      点击查看
                    </Badge>
                  )}
                </div>
              </Button>

              {showEncodingInfo && (
                <Card className="mt-3 card-modern">
                  <CardContent className="py-4">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* 编码说明 */}
                      <div className="space-y-3">
                        <h4 className="font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                          <Settings className="h-4 w-4 text-green-600" />
                          格式说明
                        </h4>
                        <div className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
                          {getEncodingDescription(encodingType)}
                        </div>
                      </div>

                      {/* 示例 */}
                      <div className="space-y-3">
                        <h4 className="font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                          <Zap className="h-4 w-4 text-blue-600" />
                          转换示例
                        </h4>
                        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 space-y-2">
                          {getEncodingExample(encodingType)}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>

          {/* 主转换区域 - M3 Optimized */}
          <div className="flex flex-col lg:flex-row gap-4 lg:gap-6 mb-6">
            {/* 左侧输入 */}
            <M3Card variant="elevated" className="flex-1 min-w-0">
              <div className="px-4 pt-4 pb-3 flex flex-col h-full">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-base font-semibold flex items-center gap-2">
                    <div className={`w-2.5 h-2.5 rounded-full ${leftType === "text" ? "bg-green-500" : "bg-blue-500"}`} />
                    {leftType === "text" ? "原文" : "编码文本"}
                  </h3>
                  <div className="flex gap-1 items-center">
                    <Badge variant="outline" className="text-xs font-mono h-5 px-1.5 border-[var(--md-sys-color-outline)] text-[var(--md-sys-color-on-surface-variant)]">
                      {leftInputLength}
                    </Badge>
                    <div className="hidden md:flex gap-1">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => {
                                navigator.clipboard.readText().then(text => handleLeftInputChange(text)).catch(console.error)
                              }}
                            >
                              <span className="text-xs">粘贴</span>
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>粘贴内容</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => copyToClipboard(leftInput, "left")}
                              disabled={!leftInput.trim()}
                            >
                              {copied.left ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>复制内容</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </div>
                </div>

                <Textarea
                  ref={leftInputRef}
                  value={leftInput}
                  onChange={(e) => handleLeftInputChange(e.target.value)}
                  placeholder={leftType === "text" ? "输入要编码的文本..." : "输入要解码的文本..."}
                  rows={8}
                  className="font-mono text-sm resize-none bg-[var(--md-sys-color-surface)] border-[var(--md-sys-color-outline-variant)] focus:border-[var(--md-sys-color-primary)] flex-grow"
                />
                {error.left && (
                  <div className="text-[var(--md-sys-color-error)] text-xs mt-2 flex items-center gap-1">
                    <span className="w-1 h-1 bg-[var(--md-sys-color-error)] rounded-full" />
                    {error.left}
                  </div>
                )}

                {/* Mobile Quick Actions */}
                <div className="grid grid-cols-3 gap-2 mt-3 md:hidden">
                  <Button
                    variant="secondary"
                    size="sm"
                    className="h-8 text-xs bg-[var(--md-sys-color-secondary-container)] text-[var(--md-sys-color-on-secondary-container)] hover:bg-[var(--md-sys-color-secondary-container)]/80 border-none shadow-none"
                    onClick={() => {
                      navigator.clipboard.readText().then(text => handleLeftInputChange(text)).catch(console.error)
                    }}
                  >
                    粘贴
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="h-8 text-xs bg-[var(--md-sys-color-secondary-container)] text-[var(--md-sys-color-on-secondary-container)] hover:bg-[var(--md-sys-color-secondary-container)]/80 border-none shadow-none"
                    onClick={() => copyToClipboard(leftInput, "left")}
                    disabled={!leftInput.trim()}
                  >
                    {copied.left ? "已复制" : "复制"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs text-[var(--md-sys-color-error)] hover:bg-[var(--md-sys-color-error-container)]"
                    onClick={() => {
                      setLeftInput("")
                      setLeftInputLength(0)
                    }}
                  >
                    清空
                  </Button>
                </div>
              </div>
            </M3Card>

            {/* 中间控制区域 */}
            <div className="flex flex-row lg:flex-col items-center justify-center gap-4 py-0 lg:py-2 shrink-0">
              <div className="flex lg:flex-col gap-3 items-center">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        onClick={autoMode ? undefined : transformLeftToRight}
                        disabled={!leftInput.trim() && !autoMode}
                        className={`rounded-full w-10 h-10 p-0 shadow-sm transition-all ${autoMode
                            ? "bg-[var(--md-sys-color-surface-container-highest)] text-[var(--md-sys-color-on-surface-variant)] cursor-default"
                            : "bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)] hover:bg-[var(--md-sys-color-primary)]/90"
                          }`}
                      >
                        {autoMode ? <Zap className="h-5 w-5" /> : <ArrowRight className="h-5 w-5 lg:rotate-0 rotate-90" />}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{autoMode ? "实时转换开启中" : "点击转换"}</TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        onClick={swapInputs}
                        variant="outline"
                        className="rounded-full w-10 h-10 p-0 border-[var(--md-sys-color-outline)] bg-[var(--md-sys-color-surface)] hover:bg-[var(--md-sys-color-surface-container-highest)]"
                      >
                        <ArrowLeftRight className="h-4 w-4 text-[var(--md-sys-color-on-surface-variant)]" />
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
                        variant="ghost"
                        className="rounded-full w-10 h-10 p-0 text-[var(--md-sys-color-error)] hover:bg-[var(--md-sys-color-error-container)]"
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
            <M3Card variant="filled" className="flex-1 min-w-0 bg-[var(--md-sys-color-surface-container)] border border-[var(--md-sys-color-outline-variant)]/50">
              <div className="px-4 pt-4 pb-3 flex flex-col h-full">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-base font-semibold flex items-center gap-2">
                    <div className={`w-2.5 h-2.5 rounded-full ${leftType === "text" ? "bg-blue-500" : "bg-green-500"}`} />
                    {leftType === "text" ? "编码结果" : "解码结果"}
                  </h3>
                  <div className="flex gap-1 items-center">
                    <Badge variant="outline" className="text-xs font-mono h-5 px-1.5 border-[var(--md-sys-color-outline)] text-[var(--md-sys-color-on-surface-variant)]">
                      {rightInputLength}
                    </Badge>
                    {/* Desktop Actions */}
                    <div className="hidden md:flex">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => copyToClipboard(rightInput, "right")}
                              disabled={!rightInput.trim()}
                            >
                              {copied.right ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>复制结果</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </div>
                </div>

                <Textarea
                  ref={rightInputRef}
                  value={rightInput}
                  onChange={(e) => handleRightInputChange(e.target.value)}
                  placeholder={leftType === "text" ? "编码结果将在这里显示..." : "解码结果将在这里显示..."}
                  rows={8}
                  className="font-mono text-sm resize-none bg-transparent border-[var(--md-sys-color-outline-variant)] focus:border-[var(--md-sys-color-primary)] flex-grow"
                />

                {error.right && (
                  <div className="text-[var(--md-sys-color-error)] text-xs mt-2 flex items-center gap-1">
                    <span className="w-1 h-1 bg-[var(--md-sys-color-error)] rounded-full" />
                    {error.right}
                  </div>
                )}

                {/* Mobile Quick Actions */}
                <div className="grid grid-cols-2 gap-2 mt-3 md:hidden">
                  <Button
                    variant="secondary"
                    size="sm"
                    className="h-8 text-xs bg-[var(--md-sys-color-secondary-container)] text-[var(--md-sys-color-on-secondary-container)] border-none shadow-none"
                    onClick={() => copyToClipboard(rightInput, "right")}
                    disabled={!rightInput.trim()}
                  >
                    {copied.right ? "已复制" : "复制结果"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs text-[var(--md-sys-color-error)] hover:bg-[var(--md-sys-color-error-container)]"
                    onClick={() => {
                      setRightInput("")
                      setRightInputLength(0)
                    }}
                  >
                    清空
                  </Button>
                </div>
              </div>
            </M3Card>
          </div>

          {/* 设置选项 */}
          <M3Card variant="outlined" className="card-modern">
            <CardHeader className="pb-3 pt-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  设置选项
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowSettings(!showSettings)}
                >
                  {showSettings ? "收起" : "展开"}
                </Button>
              </div>
            </CardHeader>
            {showSettings && (
              <CardContent className="pb-4">
                <div className="flex flex-wrap gap-4 items-center">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="multiline"
                      checked={multiline}
                      onCheckedChange={(checked) => setMultiline(checked as boolean)}
                    />
                    <Label htmlFor="multiline" className="cursor-pointer text-sm">
                      多行处理模式
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Label className="text-sm">输入类型:</Label>
                    <Select value={leftType} onValueChange={(value: "text" | "encoded") => setLeftType(value)}>
                      <SelectTrigger className="w-32 h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="text">原文</SelectItem>
                        <SelectItem value="encoded">编码文本</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            )}
          </M3Card>
        </>
      )
      }

      {/* 批量模式：优化界面 */}
      {
        showAllResults && (
          <div className="space-y-6">
            {/* 编码格式选择器 */}
            <Card className="card-modern">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Zap className="h-5 w-5 text-blue-600" />
                  编码格式选择
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2">
                  {encodingTypes.map((type) => (
                    <Button
                      key={type.id}
                      variant={encodingType === type.id ? "default" : "outline"}
                      size="sm"
                      onClick={() => setEncodingType(type.id)}
                      className="text-xs h-8"
                    >
                      {type.name}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* 编码说明和示例 - 可折叠 */}
            <Card className="card-modern">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Settings className="h-5 w-5 text-green-600" />
                    {encodingTypes.find(t => t.id === encodingType)?.name} 编码说明
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowEncodingInfo(!showEncodingInfo)}
                    className="text-gray-600 dark:text-gray-400"
                  >
                    {showEncodingInfo ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <>
                        <ChevronDown className="h-4 w-4 mr-1" />
                        <Badge variant="secondary" className="text-xs">
                          点击查看
                        </Badge>
                      </>
                    )}
                  </Button>
                </div>
              </CardHeader>
              {showEncodingInfo && (
                <CardContent>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* 编码说明 */}
                    <div className="space-y-3">
                      <h4 className="font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                        <Settings className="h-4 w-4 text-green-600" />
                        格式说明
                      </h4>
                      <div className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
                        {getEncodingDescription(encodingType)}
                      </div>
                    </div>

                    {/* 示例 */}
                    <div className="space-y-3">
                      <h4 className="font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                        <Zap className="h-4 w-4 text-blue-600" />
                        转换示例
                      </h4>
                      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 space-y-2">
                        {getEncodingExample(encodingType)}
                      </div>
                    </div>
                  </div>
                </CardContent>
              )}
            </Card>

            {/* 输入区域 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* 编码输入 */}
              <Card className="card-modern">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                    原文输入
                    <Badge variant="outline" className="text-xs ml-auto">
                      {encodeInputLength} 字符
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Textarea
                    id="encode-input"
                    ref={encodeInputRef}
                    value={encodeInput}
                    onChange={(e) => {
                      setEncodeInput(e.target.value)
                      setEncodeInputLength(e.target.value.length)
                    }}
                    placeholder="输入要编码的文本..."
                    rows={6}
                    className="font-mono text-sm resize-none"
                  />
                  {error.left && (
                    <div className="text-red-500 text-sm mt-2 flex items-center gap-1">
                      <span className="w-1 h-1 bg-red-500 rounded-full" />
                      {error.left}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* 解码输入 */}
              <Card className="card-modern">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-blue-500" />
                    编码输入
                    <Badge variant="outline" className="text-xs ml-auto">
                      {decodeInputLength} 字符
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Textarea
                    id="decode-input"
                    ref={decodeInputRef}
                    value={decodeInput}
                    onChange={(e) => {
                      setDecodeInput(e.target.value)
                      setDecodeInputLength(e.target.value.length)
                    }}
                    placeholder="输入要解码的文本..."
                    rows={6}
                    className="font-mono text-sm resize-none"
                  />
                  {error.right && (
                    <div className="text-red-500 text-sm mt-2 flex items-center gap-1">
                      <span className="w-1 h-1 bg-red-500 rounded-full" />
                      {error.right}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* 控制区域 */}
            <Card className="card-modern">
              <CardContent className="py-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="multiline-batch"
                        checked={multiline}
                        onCheckedChange={(checked) => setMultiline(checked as boolean)}
                      />
                      <Label htmlFor="multiline-batch" className="cursor-pointer text-sm">
                        多行处理模式
                      </Label>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                    <Button
                      onClick={handleEncode}
                      className="flex-1 sm:flex-none bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white"
                      size="sm"
                    >
                      <Zap className="h-4 w-4 mr-2" />
                      批量编码
                    </Button>
                    <Button
                      onClick={handleDecode}
                      className="flex-1 sm:flex-none bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white"
                      size="sm"
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      批量解码
                    </Button>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="outline" onClick={clearAll} size="sm" className="text-red-500 hover:text-red-700">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>清空所有内容</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 批量结果显示 */}
            {(allEncodeResults.length > 0 || allDecodeResults.length > 0) && (
              <Card className="card-modern">
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Check className="h-5 w-5 text-green-600" />
                    批量转换结果
                    <Badge variant="secondary" className="ml-auto">
                      {allEncodeResults.length + allDecodeResults.length} 个结果
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {[...allEncodeResults, ...allDecodeResults].map((result, index) => (
                      <div
                        key={index}
                        className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge variant="outline" className="text-xs font-medium">
                                {result.type}
                              </Badge>
                              <span className="text-xs text-gray-500">
                                {result.result.length} 字符
                              </span>
                            </div>
                            <div className="font-mono text-sm break-all bg-white dark:bg-gray-900 p-2 rounded border">
                              {result.result || <span className="text-gray-400">空结果</span>}
                            </div>
                          </div>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => copyToClipboard(result.result, `batch-${index}`)}
                                  className="flex-shrink-0"
                                  disabled={!result.result}
                                >
                                  {copied[`batch-${index}`] ?
                                    <Check className="h-4 w-4 text-green-500" /> :
                                    <Copy className="h-4 w-4" />
                                  }
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>复制结果</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )
      }
    </div >
  )
}
