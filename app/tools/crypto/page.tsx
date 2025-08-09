"use client"

import type React from "react"

import { useState, useRef, useEffect, useCallback } from "react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { useTranslations } from "@/hooks/use-translations"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Copy, Check, Upload, FileText, X, Download, Lock, Unlock, RefreshCw } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Progress } from "@/components/ui/progress"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"

// 导入CryptoJS库
import CryptoJS from "crypto-js"

// 文件信息类型
interface FileInfo {
  file: File
  name: string
  size: number
  sizeFormatted: string
}

// Add the props interface at the beginning of the file, after the existing interfaces
interface CryptoPageProps {
  params?: {
    feature?: string
  }
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

// 加密算法配置
const cryptoAlgorithms = [
  {
    id: "aes",
    name: "AES",
    modes: ["CBC", "ECB", "CFB", "OFB", "CTR"],
    keySizes: [128, 192, 256],
    defaultKeySize: 256,
    requiresIV: true,
    cryptoJSSupport: true,
  },
  {
    id: "des",
    name: "DES",
    modes: ["CBC", "ECB", "CFB", "OFB"],
    keySizes: [64],
    defaultKeySize: 64,
    requiresIV: true,
    cryptoJSSupport: true,
  },
  {
    id: "tripledes",
    name: "3DES",
    modes: ["CBC", "ECB", "CFB", "OFB"],
    keySizes: [192],
    defaultKeySize: 192,
    requiresIV: true,
    cryptoJSSupport: true,
  },
  {
    id: "blowfish",
    name: "Blowfish",
    modes: ["CBC", "ECB", "CFB", "OFB"],
    keySizes: [128, 256, 448],
    defaultKeySize: 128,
    requiresIV: true,
    cryptoJSSupport: false, // CryptoJS不直接支持Blowfish
  },
  {
    id: "twofish",
    name: "Twofish",
    modes: ["CBC", "ECB", "CFB", "OFB"],
    keySizes: [128, 192, 256],
    defaultKeySize: 256,
    requiresIV: true,
    cryptoJSSupport: false, // CryptoJS不直接支持Twofish
  },
  {
    id: "idea",
    name: "IDEA",
    modes: ["CBC", "ECB", "CFB", "OFB"],
    keySizes: [128],
    defaultKeySize: 128,
    requiresIV: true,
    cryptoJSSupport: false, // CryptoJS不直接支持IDEA
  },
  {
    id: "rc5",
    name: "RC5",
    modes: ["CBC", "ECB", "CFB", "OFB"],
    keySizes: [128, 192, 256],
    defaultKeySize: 128,
    requiresIV: true,
    cryptoJSSupport: false, // CryptoJS不直接支持RC5
  },
  {
    id: "sm4",
    name: "SM4",
    modes: ["CBC", "ECB", "CFB", "OFB"],
    keySizes: [128],
    defaultKeySize: 128,
    requiresIV: true,
    cryptoJSSupport: false, // CryptoJS不直接支持SM4
  },
  {
    id: "rc4",
    name: "RC4",
    modes: ["Stream"],
    keySizes: [40, 56, 64, 80, 128, 256],
    defaultKeySize: 128,
    requiresIV: false,
    cryptoJSSupport: true,
  },
  {
    id: "rabbit",
    name: "Rabbit",
    modes: ["Stream"],
    keySizes: [128],
    defaultKeySize: 128,
    requiresIV: true,
    cryptoJSSupport: true,
  },
  {
    id: "chacha20",
    name: "ChaCha20",
    modes: ["Stream"],
    keySizes: [256],
    defaultKeySize: 256,
    requiresIV: true,
    cryptoJSSupport: false, // CryptoJS不直接支持ChaCha20
  },
  {
    id: "salsa20",
    name: "Salsa20",
    modes: ["Stream"],
    keySizes: [128, 256],
    defaultKeySize: 256,
    requiresIV: true,
    cryptoJSSupport: false, // CryptoJS不直接支持Salsa20
  },
  {
    id: "a5/1",
    name: "A5/1",
    modes: ["Stream"],
    keySizes: [64],
    defaultKeySize: 64,
    requiresIV: true,
    cryptoJSSupport: false, // CryptoJS不直接支持A5/1
  },
]

// 输入/输出格式
const formatOptions = [
  { id: "raw", name: "Raw" },
  { id: "hex", name: "HEX" },
  { id: "base64", name: "Base64" },
]

// 生成随机字节
function getRandomBytes(length: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(length))
}

// 将字节数组转换为十六进制字符串
function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

// 将十六进制字符串转换为字节数组
function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = Number.parseInt(hex.substring(i, i + 2), 16)
  }
  return bytes
}

// 将字符串转换为字节数组
function stringToBytes(str: string): Uint8Array {
  return new TextEncoder().encode(str)
}

// 将字节数组转换为字符串
function bytesToString(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes)
}

// 格式化密钥长度到标准长度
function formatKeyToLength(keyBytes: Uint8Array, targetBits: number): Uint8Array {
  const targetBytes = targetBits / 8
  if (keyBytes.length === targetBytes) return keyBytes

  if (keyBytes.length < targetBytes) {
    // 如果密钥太短，填充0
    const newKey = new Uint8Array(targetBytes)
    newKey.set(keyBytes)
    return newKey
  } else {
    // 如果密钥太长，截断
    return keyBytes.slice(0, targetBytes)
  }
}

// 格式化输出数据
const formatOutputData = (outputData: CryptoJS.lib.WordArray, format: string): string => {
  if (format === "hex") {
    return outputData.toString(CryptoJS.enc.Hex)
  } else if (format === "base64") {
    return outputData.toString(CryptoJS.enc.Base64)
  } else {
    // raw - 尝试转换为UTF-8，如果失败则使用Latin1
    try {
      const utf8String = outputData.toString(CryptoJS.enc.Utf8)
      // 验证是否为有效的UTF-8
      if (utf8String.length > 0) {
        return utf8String
      }
      return outputData.toString(CryptoJS.enc.Latin1)
    } catch (error) {
      // 如果UTF-8解码失败，回退到Latin1编码
      return outputData.toString(CryptoJS.enc.Latin1)
    }
  }
}

// Change the component definition to accept params
export default function CryptoPage({ params }: CryptoPageProps) {
  const t = useTranslations("crypto")

  // 通用状态
  const [operation, setOperation] = useState<"encrypt" | "decrypt">("encrypt")
  const [inputMode, setInputMode] = useState<"text" | "file">("text")
  const [input, setInput] = useState("")
  const [output, setOutput] = useState("")
  const [fileInfo, setFileInfo] = useState<FileInfo | null>(null)
  const [fileOutput, setFileOutput] = useState<Blob | null>(null)
  const [processing, setProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 加密算法状态
  const [algorithm, setAlgorithm] = useState("aes")
  const [mode, setMode] = useState("CBC")
  const [keySize, setKeySize] = useState(256)
  const [key, setKey] = useState("")
  const [keyFormat, setKeyFormat] = useState("hex")
  const [iv, setIv] = useState("")
  const [ivFormat, setIvFormat] = useState("hex")
  const [inputFormat, setInputFormat] = useState("raw")
  const [outputFormat, setOutputFormat] = useState("hex")
  const [notSupportedWarning, setNotSupportedWarning] = useState<string | null>(null)
  const [inputLength, setInputLength] = useState(0)
  const [keyLength, setKeyLength] = useState(0)
  const [ivLength, setIvLength] = useState(0)

  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const copyTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // 根据传入的功能参数设置初始算法
  useEffect(() => {
    if (params?.feature) {
      // 将功能名称转换为小写以进行不区分大小写的比较
      const featureLower = params.feature.toLowerCase()

      // 查找匹配的算法
      const matchedAlgorithm = cryptoAlgorithms.find(
        (algo) => algo.name.toLowerCase() === featureLower || algo.id.toLowerCase() === featureLower,
      )

      if (matchedAlgorithm) {
        setAlgorithm(matchedAlgorithm.id)

        // 如果是流密码，设置相应的模式
        if (matchedAlgorithm.modes.includes("Stream")) {
          setMode("Stream")
        }
      }
    }
  }, [params])

  // 获取当前算法配置
  const getCurrentAlgorithm = useCallback(() => {
    return cryptoAlgorithms.find((algo) => algo.id === algorithm) || cryptoAlgorithms[0]
  }, [algorithm])

  // 检查当前算法是否需要IV
  const requiresIV = useCallback(() => {
    const currentAlgo = getCurrentAlgorithm()
    return currentAlgo.requiresIV && mode !== "ECB"
  }, [getCurrentAlgorithm, mode])

  // 获取当前密钥大小（字节）
  const getKeySize = useCallback(() => {
    return keySize / 8
  }, [keySize])

  // 生成随机密钥
  const generateRandomKey = useCallback(() => {
    const keyBytes = getRandomBytes(getKeySize())
    setKey(bytesToHex(keyBytes))
  }, [getKeySize])

  // 生成随机IV
  const generateRandomIV = useCallback(() => {
    const ivBytes = getRandomBytes(16) // 大多数算法使用16字节IV
    setIv(bytesToHex(ivBytes))
  }, [])

  // 处理密钥输入
  const processKeyInput = useCallback((keyInput: string, format: string): CryptoJS.lib.WordArray => {
    try {
      // Handle empty key case
      if (!keyInput.trim()) {
        // Return an empty WordArray for empty keys
        return CryptoJS.lib.WordArray.create([0, 0, 0, 0])
      }

      if (format === "hex") {
        // Ensure we have a valid hex string
        if (!/^[0-9a-fA-F]*$/.test(keyInput.trim())) {
          throw new Error("Invalid hex key")
        }
        // Convert hex directly to WordArray
        return CryptoJS.enc.Hex.parse(keyInput.trim())
      } else if (format === "base64") {
        try {
          // Convert base64 directly to WordArray
          return CryptoJS.enc.Base64.parse(keyInput.trim())
        } catch (e) {
          throw new Error("Invalid base64 key")
        }
      } else {
        // raw format - convert to WordArray directly
        return CryptoJS.enc.Utf8.parse(keyInput)
      }
    } catch (error) {
      console.error("Key processing error:", error)
      throw new Error("Invalid key")
    }
  }, [])

  // 处理IV输入
  const processIVInput = useCallback((ivInput: string, format: string): CryptoJS.lib.WordArray => {
    try {
      // Handle empty IV case
      if (!ivInput.trim()) {
        // Return an empty WordArray for empty IVs
        return CryptoJS.lib.WordArray.create([0, 0, 0, 0])
      }

      if (format === "hex") {
        // Ensure we have a valid hex string
        if (!/^[0-9a-fA-F]*$/.test(ivInput.trim())) {
          throw new Error("Invalid hex IV")
        }
        // Convert hex directly to WordArray
        return CryptoJS.enc.Hex.parse(ivInput.trim())
      } else if (format === "base64") {
        try {
          // Convert base64 directly to WordArray
          return CryptoJS.enc.Base64.parse(ivInput.trim())
        } catch (e) {
          throw new Error("Invalid base64 IV")
        }
      } else {
        // raw format - convert to WordArray directly
        return CryptoJS.enc.Utf8.parse(ivInput)
      }
    } catch (error) {
      console.error("IV processing error:", error)
      throw new Error("Invalid IV")
    }
  }, [])

  // 处理输入数据 - 加密
  const processInputDataForEncryption = useCallback((inputData: string, format: string): CryptoJS.lib.WordArray => {
    try {
      if (format === "hex") {
        // 将十六进制转换为WordArray
        return CryptoJS.enc.Hex.parse(inputData.trim())
      } else if (format === "base64") {
        // 将Base64转换为WordArray
        return CryptoJS.enc.Base64.parse(inputData.trim())
      } else {
        // raw - 转换为UTF8 WordArray
        return CryptoJS.enc.Utf8.parse(inputData)
      }
    } catch (error) {
      throw new Error("Invalid input")
    }
  }, [])

  // 处理输入数据 - 解密
  const processInputDataForDecryption = useCallback((inputData: string, format: string): CryptoJS.lib.CipherParams => {
    try {
      let ciphertext: CryptoJS.lib.WordArray

      if (format === "hex") {
        // 确保输入是有效的十六进制
        if (!/^[0-9a-fA-F]*$/.test(inputData.trim())) {
          throw new Error("Invalid input")
        }
        // 将十六进制转换为WordArray
        ciphertext = CryptoJS.enc.Hex.parse(inputData.trim())
      } else if (format === "base64") {
        try {
          // 验证是否为有效的Base64
          atob(inputData.trim())
          // 将Base64转换为WordArray
          ciphertext = CryptoJS.enc.Base64.parse(inputData.trim())
        } catch (e) {
          throw new Error("Invalid input")
        }
      } else {
        // raw - 需要转换为WordArray
        ciphertext = CryptoJS.enc.Latin1.parse(inputData)
      }

      // 创建CipherParams对象
      return CryptoJS.lib.CipherParams.create({
        ciphertext: ciphertext,
      })
    } catch (error) {
      console.error("Input processing error:", error)
      throw new Error(error instanceof Error ? error.message : "Invalid input")
    }
  }, [])

  // 使用CryptoJS进行加密
  const encryptWithCryptoJS = useCallback(
    (
      data: string,
      keyWordArray: CryptoJS.lib.WordArray,
      ivWordArray: CryptoJS.lib.WordArray | null,
    ): CryptoJS.lib.WordArray => {
      // 根据算法和模式选择加密方法
      let encrypted: CryptoJS.lib.CipherParams

      if (algorithm === "aes") {
        // For AES, ensure we're using the correct key size
        const keySize = keyWordArray.words.length * 4 // Size in bytes
        console.log(`Using key size: ${keySize} bytes`)

        // Create encryption options
        const options: CryptoJS.lib.CipherCfg = {
          iv: ivWordArray || CryptoJS.lib.WordArray.create(),
          padding: CryptoJS.pad.Pkcs7,
        }

        // Set the mode based on user selection
        if (mode === "CBC") {
          options.mode = CryptoJS.mode.CBC
        } else if (mode === "ECB") {
          options.mode = CryptoJS.mode.ECB
        } else if (mode === "CFB") {
          options.mode = CryptoJS.mode.CFB
          options.padding = CryptoJS.pad.NoPadding
        } else if (mode === "OFB") {
          options.mode = CryptoJS.mode.OFB
          options.padding = CryptoJS.pad.NoPadding
        } else if (mode === "CTR") {
          options.mode = CryptoJS.mode.CTR
          options.padding = CryptoJS.pad.NoPadding
        }

        // Convert input data to WordArray based on format
        let dataWordArray
        if (inputFormat === "hex") {
          dataWordArray = CryptoJS.enc.Hex.parse(data)
        } else if (inputFormat === "base64") {
          dataWordArray = CryptoJS.enc.Base64.parse(data)
        } else {
          dataWordArray = CryptoJS.enc.Utf8.parse(data)
        }

        // Perform encryption
        encrypted = CryptoJS.AES.encrypt(dataWordArray, keyWordArray, options)
      } else if (algorithm === "des") {
        // Rest of the function remains the same...
        if (mode === "CBC") {
          encrypted = CryptoJS.DES.encrypt(data, keyWordArray, {
            iv: ivWordArray || CryptoJS.lib.WordArray.create(),
            mode: CryptoJS.mode.CBC,
            padding: CryptoJS.pad.Pkcs7,
          })
        } else if (mode === "ECB") {
          encrypted = CryptoJS.DES.encrypt(data, keyWordArray, { mode: CryptoJS.mode.ECB, padding: CryptoJS.pad.Pkcs7 })
        } else if (mode === "CFB") {
          encrypted = CryptoJS.DES.encrypt(data, keyWordArray, {
            iv: ivWordArray || CryptoJS.lib.WordArray.create(),
            mode: CryptoJS.mode.CFB,
            padding: CryptoJS.pad.NoPadding,
          })
        } else if (mode === "OFB") {
          encrypted = CryptoJS.DES.encrypt(data, keyWordArray, {
            iv: ivWordArray || CryptoJS.lib.WordArray.create(),
            mode: CryptoJS.mode.OFB,
            padding: CryptoJS.pad.NoPadding,
          })
        } else {
          // 默认使用CBC
          encrypted = CryptoJS.DES.encrypt(data, keyWordArray, {
            iv: ivWordArray || CryptoJS.lib.WordArray.create(),
            mode: CryptoJS.mode.CBC,
            padding: CryptoJS.pad.Pkcs7,
          })
        }
      } else if (algorithm === "tripledes") {
        if (mode === "CBC") {
          encrypted = CryptoJS.TripleDES.encrypt(data, keyWordArray, {
            iv: ivWordArray || CryptoJS.lib.WordArray.create(),
            mode: CryptoJS.mode.CBC,
            padding: CryptoJS.pad.Pkcs7,
          })
        } else if (mode === "ECB") {
          encrypted = CryptoJS.TripleDES.encrypt(data, keyWordArray, {
            mode: CryptoJS.mode.ECB,
            padding: CryptoJS.pad.Pkcs7,
          })
        } else if (mode === "CFB") {
          encrypted = CryptoJS.TripleDES.encrypt(data, keyWordArray, {
            iv: ivWordArray || CryptoJS.lib.WordArray.create(),
            mode: CryptoJS.mode.CFB,
            padding: CryptoJS.pad.NoPadding,
          })
        } else if (mode === "OFB") {
          encrypted = CryptoJS.TripleDES.encrypt(data, keyWordArray, {
            iv: ivWordArray || CryptoJS.lib.WordArray.create(),
            mode: CryptoJS.mode.OFB,
            padding: CryptoJS.pad.NoPadding,
          })
        } else {
          // 默认使用CBC
          encrypted = CryptoJS.TripleDES.encrypt(data, keyWordArray, {
            iv: ivWordArray || CryptoJS.lib.WordArray.create(),
            mode: CryptoJS.mode.CBC,
            padding: CryptoJS.pad.Pkcs7,
          })
        }
      } else if (algorithm === "rc4") {
        encrypted = CryptoJS.RC4.encrypt(data, keyWordArray)
      } else if (algorithm === "rabbit") {
        encrypted = CryptoJS.Rabbit.encrypt(data, keyWordArray, { iv: ivWordArray || CryptoJS.lib.WordArray.create() })
      } else {
        // 不支持的算法，抛出错误
        throw new Error("Algorithm not supported")
      }

      // 返回加密结果的WordArray
      return encrypted.ciphertext
    },
    [algorithm, mode, inputFormat],
  )

  // 使用CryptoJS进行解密
  const decryptWithCryptoJS = useCallback(
    (
      cipherParams: CryptoJS.lib.CipherParams,
      keyWordArray: CryptoJS.lib.WordArray,
      ivWordArray: CryptoJS.lib.WordArray | null,
    ): CryptoJS.lib.WordArray => {
      try {
        // 根据算法和模式选择解密方法
        let decrypted: CryptoJS.lib.WordArray

        if (algorithm === "aes") {
          if (mode === "CBC") {
            decrypted = CryptoJS.AES.decrypt(cipherParams, keyWordArray, {
              iv: ivWordArray || CryptoJS.lib.WordArray.create(),
              mode: CryptoJS.mode.CBC,
              padding: CryptoJS.pad.Pkcs7,
            })
          } else if (mode === "ECB") {
            decrypted = CryptoJS.AES.decrypt(cipherParams, keyWordArray, {
              mode: CryptoJS.mode.ECB,
              padding: CryptoJS.pad.Pkcs7,
            })
          } else if (mode === "CFB") {
            decrypted = CryptoJS.AES.decrypt(cipherParams, keyWordArray, {
              iv: ivWordArray || CryptoJS.lib.WordArray.create(),
              mode: CryptoJS.mode.CFB,
              padding: CryptoJS.pad.NoPadding,
            })
          } else if (mode === "OFB") {
            decrypted = CryptoJS.AES.decrypt(cipherParams, keyWordArray, {
              iv: ivWordArray || CryptoJS.lib.WordArray.create(),
              mode: CryptoJS.mode.OFB,
              padding: CryptoJS.pad.NoPadding,
            })
          } else if (mode === "CTR") {
            decrypted = CryptoJS.AES.decrypt(cipherParams, keyWordArray, {
              iv: ivWordArray || CryptoJS.lib.WordArray.create(),
              mode: CryptoJS.mode.CTR,
              padding: CryptoJS.pad.NoPadding,
            })
          } else {
            // 默认使用CBC
            decrypted = CryptoJS.AES.decrypt(cipherParams, keyWordArray, {
              iv: ivWordArray || CryptoJS.lib.WordArray.create(),
              mode: CryptoJS.mode.CBC,
              padding: CryptoJS.pad.Pkcs7,
            })
          }
        } else if (algorithm === "des") {
          if (mode === "CBC") {
            decrypted = CryptoJS.DES.decrypt(cipherParams, keyWordArray, {
              iv: ivWordArray || CryptoJS.lib.WordArray.create(),
              mode: CryptoJS.mode.CBC,
              padding: CryptoJS.pad.Pkcs7,
            })
          } else if (mode === "ECB") {
            decrypted = CryptoJS.DES.decrypt(cipherParams, keyWordArray, {
              mode: CryptoJS.mode.ECB,
              padding: CryptoJS.pad.Pkcs7,
            })
          } else if (mode === "CFB") {
            decrypted = CryptoJS.DES.decrypt(cipherParams, keyWordArray, {
              iv: ivWordArray || CryptoJS.lib.WordArray.create(),
              mode: CryptoJS.mode.CFB,
              padding: CryptoJS.pad.NoPadding,
            })
          } else if (mode === "OFB") {
            decrypted = CryptoJS.DES.decrypt(cipherParams, keyWordArray, {
              iv: ivWordArray || CryptoJS.lib.WordArray.create(),
              mode: CryptoJS.mode.OFB,
              padding: CryptoJS.pad.NoPadding,
            })
          } else {
            // 默认使用CBC
            decrypted = CryptoJS.DES.decrypt(cipherParams, keyWordArray, {
              iv: ivWordArray || CryptoJS.lib.WordArray.create(),
              mode: CryptoJS.mode.CBC,
              padding: CryptoJS.pad.Pkcs7,
            })
          }
        } else if (algorithm === "tripledes") {
          if (mode === "CBC") {
            decrypted = CryptoJS.TripleDES.decrypt(cipherParams, keyWordArray, {
              iv: ivWordArray || CryptoJS.lib.WordArray.create(),
              mode: CryptoJS.mode.CBC,
              padding: CryptoJS.pad.Pkcs7,
            })
          } else if (mode === "ECB") {
            decrypted = CryptoJS.TripleDES.decrypt(cipherParams, keyWordArray, {
              mode: CryptoJS.mode.ECB,
              padding: CryptoJS.pad.Pkcs7,
            })
          } else if (mode === "CFB") {
            decrypted = CryptoJS.TripleDES.decrypt(cipherParams, keyWordArray, {
              iv: ivWordArray || CryptoJS.lib.WordArray.create(),
              mode: CryptoJS.mode.CFB,
              padding: CryptoJS.pad.NoPadding,
            })
          } else if (mode === "OFB") {
            decrypted = CryptoJS.TripleDES.decrypt(cipherParams, keyWordArray, {
              iv: ivWordArray || CryptoJS.lib.WordArray.create(),
              mode: CryptoJS.mode.OFB,
              padding: CryptoJS.pad.NoPadding,
            })
          } else {
            // 默认使用CBC
            decrypted = CryptoJS.TripleDES.decrypt(cipherParams, keyWordArray, {
              iv: ivWordArray || CryptoJS.lib.WordArray.create(),
              mode: CryptoJS.mode.CBC,
              padding: CryptoJS.pad.Pkcs7,
            })
          }
        } else if (algorithm === "rc4") {
          decrypted = CryptoJS.RC4.decrypt(cipherParams, keyWordArray)
        } else if (algorithm === "rabbit") {
          decrypted = CryptoJS.Rabbit.decrypt(cipherParams, keyWordArray, {
            iv: ivWordArray || CryptoJS.lib.WordArray.create(),
          })
        } else {
          // 不支持的算法，抛出错误
          throw new Error("Algorithm not supported")
        }

        return decrypted
      } catch (error) {
        console.error("Decryption error:", error)
        throw new Error("Decryption failed")
      }
    },
    [algorithm, mode],
  )

  // 模拟不支持的算法
  const simulateEncryption = useCallback((data: string): CryptoJS.lib.WordArray => {
    // 这只是一个模拟，实际上不执行任何加密
    // 在实际应用中，你需要使用第三方库或服务器端实现这些算法

    // 为了演示，我们只是返回一个随机的"加密"结果
    const randomBytes = getRandomBytes(data.length + 16)
    return CryptoJS.lib.WordArray.create(Array.from(randomBytes))
  }, [])

  // 模拟不支持的算法的解密
  const simulateDecryption = useCallback((data: string): CryptoJS.lib.WordArray => {
    // 同样，这只是一个模拟
    // 返回一些随机数据作为"解密"结果
    const randomBytes = getRandomBytes(Math.max(data.length / 2, 1))
    return CryptoJS.lib.WordArray.create(Array.from(randomBytes))
  }, [])

  // 处理文本
  const processText = useCallback(async () => {
    if (!input) {
      setError(t("invalidInput"))
      return
    }

    setError(null)
    setProcessing(true)

    try {
      // 检查密钥
      if (!key && algorithm !== "aes") {
        throw new Error(t("invalidKey"))
      }

      // 检查IV（如果需要）
      if (requiresIV() && !iv && algorithm !== "aes") {
        throw new Error(t("invalidIV"))
      }

      // 处理密钥和IV
      const keyWordArray = processKeyInput(key, keyFormat)
      const ivWordArray = requiresIV() ? processIVInput(iv, ivFormat) : null

      // 加密或解密
      let outputData: CryptoJS.lib.WordArray

      const currentAlgo = getCurrentAlgorithm()

      if (currentAlgo.cryptoJSSupport) {
        // 使用CryptoJS处理支持的算法
        try {
          if (operation === "encrypt") {
            // 处理输入数据 - 加密
            const inputWordArray = processInputDataForEncryption(input, inputFormat)

            // For AES, we need to handle the input differently
            if (algorithm === "aes") {
              const options: CryptoJS.lib.CipherCfg = {
                iv: ivWordArray || CryptoJS.lib.WordArray.create(),
                padding: CryptoJS.pad.Pkcs7,
                mode:
                  mode === "ECB"
                    ? CryptoJS.mode.ECB
                    : mode === "CFB"
                      ? CryptoJS.mode.CFB
                      : mode === "OFB"
                        ? CryptoJS.mode.OFB
                        : mode === "CTR"
                          ? CryptoJS.mode.CTR
                          : CryptoJS.mode.CBC,
              }

              // For stream modes, use NoPadding
              if (mode === "CFB" || mode === "OFB" || mode === "CTR") {
                options.padding = CryptoJS.pad.NoPadding
              }

              const encrypted = CryptoJS.AES.encrypt(inputWordArray, keyWordArray, options)
              outputData = encrypted.ciphertext
            } else {
              outputData = encryptWithCryptoJS(input, keyWordArray, ivWordArray)
            }
          } else {
            // 处理输入数据 - 解密
            const cipherParams = processInputDataForDecryption(input, inputFormat)
            outputData = decryptWithCryptoJS(cipherParams, keyWordArray, ivWordArray)
          }
        } catch (error) {
          console.error("Crypto operation error:", error)
          throw new Error(
            error instanceof Error
              ? error.message
              : operation === "encrypt"
                ? t("encryptionFailed")
                : t("decryptionFailed"),
          )
        }
      } else {
        // 对于不支持的算法，显示警告并使用模拟函数
        setNotSupportedWarning(t("algorithmNotSupported"))

        if (operation === "encrypt") {
          outputData = simulateEncryption(input)
        } else {
          outputData = simulateDecryption(input)
        }
      }

      // 格式化输出
      const result = formatOutputData(outputData, outputFormat)
      setOutput(result)
    } catch (error) {
      console.error("Processing error:", error)
      setError(error instanceof Error ? error.message : t("error"))
      setOutput("")
    } finally {
      setProcessing(false)
    }
  }, [
    input,
    key,
    iv,
    requiresIV,
    getCurrentAlgorithm,
    operation,
    processKeyInput,
    processIVInput,
    keyFormat,
    ivFormat,
    inputFormat,
    outputFormat,
    processInputDataForEncryption,
    processInputDataForDecryption,
    encryptWithCryptoJS,
    decryptWithCryptoJS,
    simulateEncryption,
    simulateDecryption,
    t,
    algorithm,
    mode,
  ])

  // 处理文件
  const processFile = useCallback(async () => {
    if (!fileInfo) {
      setError(t("invalidInput"))
      return
    }

    setError(null)
    setProcessing(true)
    setProgress(0)
    setFileOutput(null)

    try {
      const file = fileInfo.file
      const reader = new FileReader()

      reader.onload = async (e) => {
        try {
          const content = e.target?.result

          if (content) {
            // 检查密钥
            if (!key) {
              throw new Error(t("invalidKey"))
            }

            // 检查IV（如果需要）
            if (requiresIV() && !iv) {
              throw new Error(t("invalidIV"))
            }

            // 处理密钥和IV
            const keyWordArray = processKeyInput(key, keyFormat)
            const ivWordArray = requiresIV() ? processIVInput(iv, ivFormat) : null

            // 处理输入数据
            let inputData: string
            if (content instanceof ArrayBuffer) {
              // 将ArrayBuffer转换为字符串
              const bytes = new Uint8Array(content)
              inputData = bytesToString(bytes)
            } else {
              // 如果是字符串，直接使用
              inputData = content as string
            }

            // 加密或解密
            let outputData: CryptoJS.lib.WordArray

            const currentAlgo = getCurrentAlgorithm()

            if (currentAlgo.cryptoJSSupport) {
              // 使用CryptoJS处理支持的算法
              if (operation === "encrypt") {
                outputData = encryptWithCryptoJS(inputData, keyWordArray, ivWordArray)
              } else {
                // 对于解密，我们需要先创建CipherParams对象
                const ciphertext = CryptoJS.enc.Latin1.parse(inputData)
                const cipherParams = CryptoJS.lib.CipherParams.create({
                  ciphertext: ciphertext,
                })
                outputData = decryptWithCryptoJS(cipherParams, keyWordArray, ivWordArray)
              }
            } else {
              // 对于不支持的算法，显示警告并使用模拟函数
              setNotSupportedWarning(t("algorithmNotSupported"))

              if (operation === "encrypt") {
                outputData = simulateEncryption(inputData)
              } else {
                outputData = simulateDecryption(inputData)
              }
            }

            // 创建结果Blob
            let outputBytes: Uint8Array
            if (outputFormat === "hex") {
              const hexStr = outputData.toString(CryptoJS.enc.Hex)
              outputBytes = hexToBytes(hexStr)
            } else if (outputFormat === "base64") {
              const base64Str = outputData.toString(CryptoJS.enc.Base64)
              const binary = atob(base64Str)
              outputBytes = new Uint8Array(binary.length)
              for (let i = 0; i < binary.length; i++) {
                outputBytes[i] = binary.charCodeAt(i)
              }
            } else {
              // raw
              const rawStr = outputData.toString(CryptoJS.enc.Latin1)
              outputBytes = stringToBytes(rawStr)
            }

            const blob = new Blob([outputBytes], { type: "application/octet-stream" })
            setFileOutput(blob)
          }
        } catch (error) {
          console.error("File processing error:", error)
          setError(error instanceof Error ? error.message : t("error"))
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
        setError(t("error"))
        setProcessing(false)
      }

      reader.readAsArrayBuffer(file)
    } catch (error) {
      console.error("File reading error:", error)
      setError(error instanceof Error ? error.message : t("error"))
      setProcessing(false)
    }
  }, [
    fileInfo,
    key,
    iv,
    requiresIV,
    processKeyInput,
    processIVInput,
    keyFormat,
    ivFormat,
    outputFormat,
    getCurrentAlgorithm,
    operation,
    encryptWithCryptoJS,
    decryptWithCryptoJS,
    simulateEncryption,
    simulateDecryption,
    t,
  ])

  // 下载文件结果
  const downloadResult = useCallback(() => {
    if (!fileOutput) return

    const url = URL.createObjectURL(fileOutput)
    const a = document.createElement("a")
    a.href = url
    a.download = `${operation === "encrypt" ? "encrypted" : "decrypted"}_${fileInfo?.name || "result"}`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [fileOutput, operation, fileInfo])

  // 复制结果
  const copyToClipboard = useCallback(() => {
    if (!output) return

    navigator.clipboard.writeText(output).then(() => {
      // 清除之前的超时
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current)
      }

      setCopied(true)

      // 设置新的超时
      copyTimeoutRef.current = setTimeout(() => {
        setCopied(false)
      }, 2000)
    })
  }, [output])

  // 清空输入
  const clearInput = useCallback(() => {
    setInput("")
    setFileInfo(null)
    setError(null)

    if (inputRef.current) {
      inputRef.current.focus()
    }
  }, [])

  // 清空输出
  const clearOutput = useCallback(() => {
    setOutput("")
    setFileOutput(null)
    setError(null)
    setNotSupportedWarning(null)
  }, [])

  // 处理文件上传
  const handleFileUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
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
    },
    [t],
  )

  // 处理文件拖放
  const handleFileDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
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
    },
    [t],
  )

  // 防止默认拖放行为
  const preventDefaults = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  // 当算法变化时，更新模式和密钥大小
  useEffect(() => {
    const currentAlgo = getCurrentAlgorithm()

    // 设置默认模式
    if (currentAlgo.modes.length > 0 && !currentAlgo.modes.includes(mode)) {
      setMode(currentAlgo.modes[0])
    }

    // 设置默认密钥大小
    if (currentAlgo.keySizes.length > 0 && !currentAlgo.keySizes.includes(keySize)) {
      setKeySize(currentAlgo.defaultKeySize)
    }

    // 清除警告
    setNotSupportedWarning(null)

    // 如果不支持CryptoJS，显示警告
    if (!currentAlgo.cryptoJSSupport) {
      setNotSupportedWarning(t("algorithmNotSupported"))
    }
  }, [algorithm, mode, keySize, t, getCurrentAlgorithm])

  // 清理复制超时
  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current)
      }
    }
  }, [])

  // 当操作模式变化时，调整输入和输出格式
  useEffect(() => {
    if (operation === "encrypt") {
      setOutputFormat("hex")
      setInputFormat("raw")
    } else {
      setOutputFormat("raw")
      setInputFormat("hex")
    }
  }, [operation])

  // 更新输入长度状态
  useEffect(() => {
    setInputLength(input.length)
    setKeyLength(key.length)
    setIvLength(iv.length)
  }, [input, key, iv])

  return (
    <div className="container mx-auto px-4 py-4 max-w-4xl">
      <h2 className="text-2xl font-bold text-center mb-6">{t("title")}</h2>
      <div className="space-y-6">
        {/* 操作选择 */}
        <div className="flex justify-center mb-6">
          <RadioGroup
            value={operation}
            onValueChange={(value) => setOperation(value as "encrypt" | "decrypt")}
            className="flex space-x-4"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="encrypt" id="encrypt" className="neumorphic-inset dark:neumorphic-inset-dark" />
              <Label htmlFor="encrypt" className="flex items-center space-x-1 cursor-pointer">
                <Lock className="h-4 w-4" />
                <span>{t("encrypt")}</span>
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="decrypt" id="decrypt" className="neumorphic-inset dark:neumorphic-inset-dark" />
              <Label htmlFor="decrypt" className="flex items-center space-x-1 cursor-pointer">
                <Unlock className="h-4 w-4" />
                <span>{t("decrypt")}</span>
              </Label>
            </div>
          </RadioGroup>
        </div>

        {/* 算法选择 */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="algorithm">{t("algorithm")}</Label>
            <Select value={algorithm} onValueChange={setAlgorithm}>
              <SelectTrigger id="algorithm" className="neumorphic-select dark:neumorphic-select-dark">
                <SelectValue placeholder={t("algorithm")} />
              </SelectTrigger>
              <SelectContent>
                {cryptoAlgorithms.map((algo) => (
                  <SelectItem key={algo.id} value={algo.id}>
                    {algo.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="mode">{t("mode")}</Label>
            <Select value={mode} onValueChange={setMode}>
              <SelectTrigger id="mode" className="neumorphic-select dark:neumorphic-select-dark">
                <SelectValue placeholder={t("mode")} />
              </SelectTrigger>
              <SelectContent>
                {getCurrentAlgorithm().modes.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* 密钥大小 */}
        <div className="space-y-2">
          <Label htmlFor="key-size">{t("keySize")}</Label>
          <Select value={keySize.toString()} onValueChange={(value) => setKeySize(Number.parseInt(value))}>
            <SelectTrigger id="key-size" className="neumorphic-select dark:neumorphic-select-dark">
              <SelectValue placeholder={t("keySize")} />
            </SelectTrigger>
            <SelectContent>
              {getCurrentAlgorithm().keySizes.map((size) => (
                <SelectItem key={size} value={size.toString()}>
                  {size} {t("bits")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* 密钥和IV */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <Label htmlFor="key">{t("key")}</Label>
            <Button
              variant="outline"
              size="sm"
              onClick={generateRandomKey}
              className="neumorphic-button dark:neumorphic-button-dark"
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              {t("generateKey")}
            </Button>
          </div>
          <div className="flex">
            <Input
              id="key"
              value={key}
              onChange={(e) => {
                setKey(e.target.value)
                setKeyLength(e.target.value.length)
              }}
              placeholder={t("keyPlaceholder")}
              className="rounded-r-none neumorphic-input dark:neumorphic-input-dark"
            />
            <Select value={keyFormat} onValueChange={setKeyFormat}>
              <SelectTrigger className="w-24 rounded-l-none neumorphic-select dark:neumorphic-select-dark">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="raw">Raw</SelectItem>
                <SelectItem value="hex">HEX</SelectItem>
                <SelectItem value="base64">Base64</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <p>
              {t("keySize")}: {keySize} {t("bits")} ({keySize / 8} bytes)
            </p>
            <p>
              {keyLength} {t("characters")}
            </p>
          </div>
        </div>

        {requiresIV() && (
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label htmlFor="iv">{t("iv")}</Label>
              <Button
                variant="outline"
                size="sm"
                onClick={generateRandomIV}
                className="neumorphic-button dark:neumorphic-button-dark"
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                {t("generateKey")}
              </Button>
            </div>
            <div className="flex">
              <Input
                id="iv"
                value={iv}
                onChange={(e) => {
                  setIv(e.target.value)
                  setIvLength(e.target.value.length)
                }}
                placeholder={t("ivPlaceholder")}
                className="rounded-r-none neumorphic-input dark:neumorphic-input-dark"
              />
              <Select value={ivFormat} onValueChange={setIvFormat}>
                <SelectTrigger className="w-24 rounded-l-none neumorphic-select dark:neumorphic-select-dark">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="raw">Raw</SelectItem>
                  <SelectItem value="hex">HEX</SelectItem>
                  <SelectItem value="base64">Base64</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="text-xs text-gray-500 text-right mt-1">
              {ivLength} {t("characters")}
            </div>
          </div>
        )}

        {/* 算法不支持警告 */}
        {notSupportedWarning && (
          <div className="bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200 p-3 rounded-md neumorphic-inset dark:neumorphic-inset-dark">
            {notSupportedWarning}
          </div>
        )}

        {/* 输入和输出区域 */}
        <Tabs value={inputMode} onValueChange={(value) => setInputMode(value as "text" | "file")}>
          <TabsList className="grid w-full grid-cols-2 mb-4 neumorphic dark:neumorphic-dark">
            <TabsTrigger
              value="text"
              className="flex items-center gap-2 data-[state=active]:neumorphic-button-active dark:data-[state=active]:neumorphic-button-active-dark"
            >
              <FileText className="h-4 w-4" />
              {t("textMode")}
            </TabsTrigger>
            <TabsTrigger
              value="file"
              className="flex items-center gap-2 data-[state=active]:neumorphic-button-active dark:data-[state=active]:neumorphic-button-active-dark"
            >
              <Upload className="h-4 w-4" />
              {t("fileMode")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="text" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* 文本输入 */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <div className="flex items-center space-x-2">
                    <Label htmlFor="input">{t("input")}</Label>
                    <Select value={inputFormat} onValueChange={setInputFormat}>
                      <SelectTrigger className="w-24 h-8 neumorphic-select dark:neumorphic-select-dark">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {formatOptions.map((option) => (
                          <SelectItem key={option.id} value={option.id}>
                            {option.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={clearInput}
                    className="neumorphic-button dark:neumorphic-button-dark"
                  >
                    {t("clearInput")}
                  </Button>
                </div>
                <Textarea
                  ref={inputRef}
                  id="input"
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value)
                    setInputLength(e.target.value.length)
                  }}
                  placeholder={t("inputPlaceholder")}
                  rows={10}
                  className="neumorphic-inset dark:neumorphic-inset-dark"
                />
                <div className="text-xs text-gray-500 text-right mt-1">
                  {inputLength} {t("characters")}
                </div>
              </div>

              {/* 文本输出 */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <div className="flex items-center space-x-2">
                    <Label htmlFor="output">{t("output")}</Label>
                    <Select value={outputFormat} onValueChange={setOutputFormat}>
                      <SelectTrigger className="w-24 h-8 neumorphic-select dark:neumorphic-select-dark">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {formatOptions.map((option) => (
                          <SelectItem key={option.id} value={option.id}>
                            {option.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={clearOutput}
                      className="neumorphic-button dark:neumorphic-button-dark"
                    >
                      {t("clearOutput")}
                    </Button>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={copyToClipboard}
                            disabled={!output}
                            className="neumorphic-button dark:neumorphic-button-dark"
                          >
                            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{copied ? t("copied") : t("copy")}</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </div>
                <Textarea
                  id="output"
                  value={output}
                  readOnly
                  placeholder={t("outputPlaceholder")}
                  rows={10}
                  className="neumorphic-inset dark:neumorphic-inset-dark"
                />
                <div className="text-xs text-gray-500 text-right mt-1">
                  {output.length} {t("characters")}
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="file" className="space-y-4">
            <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />

            {!fileInfo ? (
              <div
                className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg p-8 text-center cursor-pointer hover:border-primary dark:hover:border-primary transition-colors neumorphic dark:neumorphic-dark"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={preventDefaults}
                onDragEnter={preventDefaults}
                onDragLeave={preventDefaults}
                onDrop={handleFileDrop}
              >
                <Upload className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <p className="text-lg font-medium mb-2">{t("dropFileHere")}</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    fileInputRef.current?.click()
                  }}
                  className="neumorphic-button dark:neumorphic-button-dark"
                >
                  {t("uploadFile")}
                </Button>
              </div>
            ) : (
              <div className="border rounded-lg p-4 neumorphic dark:neumorphic-dark">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-medium">{t("fileInfo")}</h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearInput}
                    className="h-8 w-8 p-0 neumorphic-button dark:neumorphic-button-dark"
                  >
                    <X className="h-4 w-4" />
                    <span className="sr-only">{t("removeFile")}</span>
                  </Button>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-500">{t("fileName")}:</span>
                    <span className="font-medium">{fileInfo.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">{t("fileSize")}:</span>
                    <span>{fileInfo.sizeFormatted}</span>
                  </div>
                </div>

                {processing && (
                  <div className="mt-4">
                    <div className="flex justify-between mb-1">
                      <span>{t("processing")}</span>
                      <span>{progress}%</span>
                    </div>
                    <Progress value={progress} className="h-2 neumorphic-inset dark:neumorphic-inset-dark" />
                  </div>
                )}

                {fileOutput && (
                  <div className="mt-4">
                    <Button onClick={downloadResult} className="w-full neumorphic-button dark:neumorphic-button-dark">
                      <Download className="h-4 w-4 mr-2" />
                      {t("downloadResult")}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* 错误信息 */}
        {error && (
          <div className="bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-200 p-3 rounded-md neumorphic-inset dark:neumorphic-inset-dark">
            {error}
          </div>
        )}

        {/* 处理按钮 */}
        <Button
          onClick={inputMode === "text" ? processText : processFile}
          disabled={processing || (inputMode === "text" ? !input : !fileInfo)}
          className="w-full neumorphic-button dark:neumorphic-button-dark"
        >
          {processing ? t("processing") : t("process")}
        </Button>
      </div>
    </div>
  )
}
