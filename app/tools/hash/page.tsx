"use client"

import { copyTextToClipboard as writeClipboardText } from "@/lib/clipboard"

import type React from "react"

import { useState, useRef, useEffect, useCallback } from "react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useTranslations } from "@/hooks/use-translations"
import { createHash } from "crypto"
import { Keccak, SHA3, SHAKE } from "sha3"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"
import { Copy, Check, Upload, FileText, X } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Progress } from "@/components/ui/progress"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { cn } from "@/lib/utils"
import { useToolRuntimeParams } from "@/components/tool-runtime-params"
import { useToolActivity } from "@/components/tool-activity"

// 添加参数接口
interface HashAlgorithm {
  id: string
  name: string
  configurable: boolean
  sizes?: number[]
}

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let value = n
    for (let k = 0; k < 8; k++) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
    }
    table[n] = value >>> 0
  }
  return table
})()

function updateCrc32(crc: number, bytes: Uint8Array): number {
  for (let i = 0; i < bytes.length; i++) {
    crc = (crc >>> 8) ^ CRC32_TABLE[(crc ^ bytes[i]) & 0xff]
  }
  return crc >>> 0
}

// 基于字节的 CRC32，保证文本与文件模式都按原始字节计算
function crc32Bytes(bytes: Uint8Array) {
  const crc = updateCrc32(0xffffffff, bytes)
  return (crc ^ -1) >>> 0
}

function crc32Text(str: string) {
  return crc32Bytes(new TextEncoder().encode(str))
}

// 哈希结果类型
interface HashResult {
  algorithm: string
  algorithmSize?: number
  displayName: string
  value: string
  status?: "pending" | "calculating" | "completed" | "error"
}

// 文件信息类型
interface FileInfo {
  file: File
  name: string
  size: number
  sizeFormatted: string
}

// 验证结果类型
interface VerifyResultType {
  isMatch: boolean
  matchedAlgorithm?: string
}

interface IncrementalHasher {
  update: (bytes: Uint8Array) => void
  digest: () => string
}

function createIncrementalHasher(
  algorithmId: string,
  algorithmSize: number | undefined,
  fallbackSize: number,
  outputFormat: string,
): IncrementalHasher {
  if (algorithmId === "crc32") {
    let crc = 0xffffffff
    return {
      update: (bytes) => {
        crc = updateCrc32(crc, bytes)
      },
      digest: () => {
        const hex = ((crc ^ -1) >>> 0).toString(16).padStart(8, "0")
        return outputFormat === "hex"
          ? hex
          : Buffer.from(hex, "hex").toString("base64")
      },
    }
  }

  let hash: any
  if (algorithmId === "sha3") {
    hash = new SHA3((algorithmSize || fallbackSize) as 224 | 256 | 384 | 512)
  } else if (algorithmId === "keccak") {
    hash = new Keccak((algorithmSize || fallbackSize) as 224 | 256 | 384 | 512)
  } else if (algorithmId === "shake") {
    hash = new SHAKE((algorithmSize || fallbackSize) as 128 | 256)
  } else if (algorithmId === "sha2") {
    hash = createHash(`sha${algorithmSize || fallbackSize}`)
  } else if (algorithmId === "sha512") {
    hash = createHash(`sha512-${algorithmSize || fallbackSize}`)
  } else {
    hash = createHash(algorithmId)
  }

  return {
    update: (bytes) => {
      hash.update(Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength))
    },
    digest: () => outputFormat === "hex" ? hash.digest("hex") : hash.digest("base64"),
  }
}

async function readFileInChunks(
  file: File,
  onChunk: (bytes: Uint8Array) => void,
  onProgress: (progress: number) => void,
  isCancelled: () => boolean,
): Promise<void> {
  const chunkSize = 2 * 1024 * 1024
  if (file.size === 0) {
    onProgress(100)
    return
  }

  for (let offset = 0; offset < file.size; offset += chunkSize) {
    if (isCancelled()) throw new DOMException("Hash calculation cancelled", "AbortError")
    const chunk = new Uint8Array(
      await file.slice(offset, Math.min(file.size, offset + chunkSize)).arrayBuffer(),
    )
    onChunk(chunk)
    onProgress(Math.min(100, Math.round(((offset + chunk.byteLength) / file.size) * 100)))
    await new Promise<void>((resolve) => setTimeout(resolve, 0))
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

// 最大文件大小 (100MB)
const MAX_FILE_SIZE = 100 * 1024 * 1024

// 重构哈希算法分类
const hashCategories: Array<{ name: string; algorithms: HashAlgorithm[] }> = [
  {
    name: "MD",
    algorithms: [{ id: "md5", name: "MD5", configurable: false }],
  },
  {
    name: "SHA1",
    algorithms: [{ id: "sha1", name: "SHA1", configurable: false }],
  },
  {
    name: "SHA2",
    algorithms: [
      {
        id: "sha2",
        name: "SHA2",
        configurable: true,
        sizes: [224, 256, 384, 512],
      },
      { id: "sha512", name: "SHA-512/t", configurable: true, sizes: [224, 256] },
    ],
  },
  {
    name: "SHA3",
    algorithms: [
      {
        id: "sha3",
        name: "SHA3",
        configurable: true,
        sizes: [224, 256, 384, 512],
      },
      { id: "keccak", name: "Keccak", configurable: true, sizes: [224, 256, 384, 512] },
      { id: "shake", name: "SHAKE", configurable: true, sizes: [128, 256] },
    ],
  },
  {
    name: "RIPEMD",
    algorithms: [{ id: "ripemd160", name: "RIPEMD160", configurable: false }],
  },
  {
    name: "BLAKE2",
    algorithms: [
      { id: "blake2s256", name: "BLAKE2s-256", configurable: false },
      { id: "blake2b512", name: "BLAKE2b-512", configurable: false },
    ],
  },
  {
    name: "SM3",
    algorithms: [{ id: "sm3", name: "SM3", configurable: false }],
  },
  {
    name: "CRC",
    algorithms: [{ id: "crc32", name: "CRC32", configurable: false }],
  },
]

// 扁平化算法列表，方便查找
const allAlgorithms = hashCategories.flatMap((category) => category.algorithms)

const algorithmDescriptions: Record<string, string> = {
  sha3: "sha3Description",
  keccak: "keccakDescription",
  shake: "shakeDescription",
}

const serverBackedAlgorithms = new Set(["sha512", "blake2s256", "blake2b512", "sm3"])

export default function HashPage() {
  const t = useTranslations("hash")
  const params = useToolRuntimeParams()
  const isToolActive = useToolActivity()

  // 哈希计算器状态
  const [inputMode, setInputMode] = useState<"text" | "file">("text")
  const [input, setInput] = useState("")
  const [fileInfo, setFileInfo] = useState<FileInfo | null>(null)
  const [fileCalculating, setFileCalculating] = useState(false)
  const [textCalculating, setTextCalculating] = useState(false)
  const [fileProgress, setFileProgress] = useState(0)
  const [fileError, setFileError] = useState("")
  const [algorithm, setAlgorithm] = useState("md5")
  const [selectedCategory, setSelectedCategory] = useState("MD")
  const [hashResult, setHashResult] = useState("")
  const [allHashResults, setAllHashResults] = useState<HashResult[]>([])
  const [showAllResults, setShowAllResults] = useState(false)
  const [verifyHash, setVerifyHash] = useState("")
  const [verifyResult, setVerifyResult] = useState<VerifyResultType | null>(null)
  const [autoCalculate, setAutoCalculate] = useState(false)
  const [copied, setCopied] = useState<{ [key: string]: boolean }>({})
  const [outputFormat, setOutputFormat] = useState("hex")
  const [size, setSize] = useState<number>(256)
  const [calculationError, setCalculationError] = useState("")
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cancelCalculationRef = useRef<boolean>(false)
  const calculationIdRef = useRef(0)
  const calculationAbortRef = useRef<AbortController | null>(null)
  // Add the hmacKey state after the other state declarations

  // 复制超时
  const copyTimeoutRef = useRef<{ [key: string]: ReturnType<typeof setTimeout> | null }>({})

  const stopActiveCalculation = useCallback(() => {
    cancelCalculationRef.current = true
    calculationIdRef.current += 1
    calculationAbortRef.current?.abort()
    calculationAbortRef.current = null
    setFileCalculating(false)
    setTextCalculating(false)
  }, [])

  useEffect(() => {
    if (!isToolActive) stopActiveCalculation()
  }, [isToolActive, stopActiveCalculation])

  // 根据传入的功能参数设置初始算法
  useEffect(() => {
    if (params?.feature) {
      // 将功能名称转换为小写以进行不区分大小写的比较
      const featureLower = params.feature.toLowerCase()

      // 查找匹配的算法
      let found = false
      const normalizedFeature = featureLower.replace(/\//g, "-")

      // 遍历所有算法类别
      for (const category of hashCategories) {
        for (const algo of category.algorithms) {
          if (algo.name.toLowerCase().replace(/\//g, "-") === normalizedFeature || algo.id.toLowerCase() === normalizedFeature) {
            setAlgorithm(algo.id)
            setSelectedCategory(category.name)
            found = true
            break
          }

          // 对于可配置的算法，检查是否匹配特定大小
          if (algo.configurable && algo.sizes) {
            for (const s of algo.sizes) {
              const sizeSpecificName = getAlgorithmDisplayName(algo.id, s).toLowerCase().replace(/\//g, "-")
              if (sizeSpecificName === normalizedFeature) {
                setAlgorithm(algo.id)
                setSelectedCategory(category.name)
                setSize(s)
                found = true
                break
              }
            }
          }
        }
        if (found) break
      }
    }
  }, [params])

  // 当选择算法变化时，更新size
  useEffect(() => {
    const algorithmObj = allAlgorithms.find((algo) => algo.id === algorithm)
    if (algorithmObj && algorithmObj.configurable) {
      if (algorithmObj.sizes && algorithmObj.sizes.length > 0) {
        setSize((current) =>
          algorithmObj.sizes?.includes(current)
            ? current
            : algorithmObj.sizes?.[0] ?? current,
        )
      }
    }
  }, [algorithm])

  // 其余代码保持不变...
  // 这里省略了原有的函数实现，实际代码中应保留所有原有功能

  const calculateServerHash = async (
    algorithmId: string,
    options: { algorithmSize?: number; text?: string; file?: File },
    signal?: AbortSignal,
  ): Promise<string> => {
    const formData = new FormData()
    formData.append("algorithm", algorithmId)
    formData.append("outputFormat", outputFormat)

    if (options.algorithmSize) {
      formData.append("size", options.algorithmSize.toString())
    }

    if (typeof options.text === "string") {
      formData.append("text", options.text)
    }

    if (options.file) {
      formData.append("file", options.file)
    }

    const response = await fetch("/api/hash", {
      method: "POST",
      body: formData,
      signal,
    })

    if (!response.ok) {
      throw new Error(`Hash API responded with ${response.status}`)
    }

    const data = await response.json()
    return data.result
  }

  // 计算单个哈希值（文本）
  const calculateSingleTextHash = async (
    text: string,
    algorithmId: string,
    algorithmSize?: number,
    signal?: AbortSignal,
  ): Promise<string> => {
    if (serverBackedAlgorithms.has(algorithmId)) {
      return calculateServerHash(
        algorithmId,
        {
          algorithmSize,
          text,
        },
        signal,
      )
    }

    let result = ""

    if (algorithmId === "sha3") {
      const sha3 = new SHA3((algorithmSize || size) as 224 | 256 | 384 | 512)
      sha3.update(text)
      result = outputFormat === "hex" ? sha3.digest("hex") : sha3.digest("base64")
    } else if (algorithmId === "keccak") {
      const keccak = new Keccak((algorithmSize || size) as 224 | 256 | 384 | 512)
      keccak.update(text)
      result = outputFormat === "hex" ? keccak.digest("hex") : keccak.digest("base64")
    } else if (algorithmId === "shake") {
      const shake = new SHAKE((algorithmSize || size) as 128 | 256)
      shake.update(text)
      result = outputFormat === "hex" ? shake.digest("hex") : shake.digest("base64")
    } else if (algorithmId === "sha2") {
      const hashObj = createHash(`sha${algorithmSize || size}`)
      hashObj.update(text)
      result = outputFormat === "hex" ? hashObj.digest("hex") : hashObj.digest("base64")
    } else if (algorithmId === "sha512") {
      const hashObj = createHash(`sha512-${algorithmSize || size}`)
      hashObj.update(text)
      result = outputFormat === "hex" ? hashObj.digest("hex") : hashObj.digest("base64")
    } else if (algorithmId === "crc32") {
      const crcResult = crc32Text(text).toString(16).padStart(8, "0")
      result =
        outputFormat === "hex"
          ? crcResult
          : Buffer.from(crcResult, "hex").toString("base64")
    } else {
      const hashObj = createHash(algorithmId)
      hashObj.update(text)
      result = outputFormat === "hex" ? hashObj.digest("hex") : hashObj.digest("base64")
    }

    return result
  }

  // 获取算法显示名称
  const getAlgorithmDisplayName = (algorithmId: string, algorithmSize?: number): string => {
    const algorithmObj = allAlgorithms.find((algo) => algo.id === algorithmId)
    if (!algorithmObj) return algorithmId

    // Fixed-length algorithms such as MD5 and SHA1 must never inherit the
    // size selected for a previously active configurable algorithm.
    if (!algorithmSize || !algorithmObj.configurable) {
      return algorithmObj.name
    }

    if (algorithmId === "sha2") {
      return `SHA-${algorithmSize}`
    }

    if (algorithmId === "sha3" || algorithmId === "keccak") {
      return `${algorithmObj.name}-${algorithmSize}`
    }

    if (algorithmId === "sha512") {
      return `SHA-512/${algorithmSize}`
    }

    if (algorithmId === "shake") {
      return `SHAKE${algorithmSize}`
    }

    return `${algorithmObj.name}-${algorithmSize}`
  }

  // 计算所有哈希值（文本）
  const calculateAllTextHashes = async (
    text: string,
    calculationId: number,
    signal: AbortSignal,
  ) => {
    const results: HashResult[] = []
    for (const algo of allAlgorithms) {
      if (algo.configurable && algo.sizes) {
        for (const algorithmSize of algo.sizes) {
          results.push({
            algorithm: algo.id,
            algorithmSize,
            displayName: getAlgorithmDisplayName(algo.id, algorithmSize),
            value: "",
            status: "pending",
          })
        }
      } else {
        results.push({
          algorithm: algo.id,
          displayName: algo.name,
          value: "",
          status: "pending",
        })
      }
    }

    setAllHashResults([...results])
    for (let index = 0; index < results.length; index += 1) {
      if (signal.aborted || calculationIdRef.current !== calculationId) {
        throw new DOMException("Hash calculation cancelled", "AbortError")
      }

      const result = results[index]
      result.status = "calculating"
      setAllHashResults([...results])
      try {
        result.value = await calculateSingleTextHash(
          text,
          result.algorithm,
          result.algorithmSize,
          signal,
        )
        result.status = "completed"
      } catch (error) {
        if (signal.aborted) throw error
        console.error(`Hash calculation error for ${result.algorithm}:`, error)
        result.value = `${t("error")}: ${result.displayName}`
        result.status = "error"
      }

      if (calculationIdRef.current === calculationId) {
        setAllHashResults([...results])
      }
      await new Promise<void>((resolve) => setTimeout(resolve, 0))
    }
  }

  // 计算文件哈希
  const calculateFileHash = async (
    file: File,
    algorithmId: string,
    algorithmSize: number | undefined,
    calculationId: number,
    signal: AbortSignal,
  ): Promise<string> => {
    if (serverBackedAlgorithms.has(algorithmId)) {
      return calculateServerHash(
        algorithmId,
        {
          algorithmSize,
          file,
        },
        signal,
      )
    }

    const hasher = createIncrementalHasher(algorithmId, algorithmSize, size, outputFormat)
    await readFileInChunks(
      file,
      (chunk) => hasher.update(chunk),
      setFileProgress,
      () =>
        cancelCalculationRef.current ||
        signal.aborted ||
        calculationIdRef.current !== calculationId,
    )
    return hasher.digest()
  }

  // 计算所有文件哈希
  const calculateAllFileHashes = async (
    selectedFile: FileInfo,
    calculationId: number,
    signal: AbortSignal,
  ) => {

    setFileCalculating(true)
    setFileProgress(0)
    cancelCalculationRef.current = false

    try {
      // 首先创建所有算法的结果数组，但值设为空，状态设为 pending
      const results: HashResult[] = []

      // 添加非可配置算法
      allAlgorithms
        .filter((algo) => !algo.configurable)
        .forEach((algo) => {
          results.push({
            algorithm: algo.id,
            displayName: algo.name,
            value: "",
            status: "pending",
          })
        })

      // 添加可配置算法的所有大小
      allAlgorithms
        .filter((algo) => algo.configurable)
        .forEach((algo) => {
          if (algo.sizes) {
            algo.sizes.forEach((s) => {
            results.push({
              algorithm: algo.id,
              displayName: getAlgorithmDisplayName(algo.id, s),
              value: "",
              status: "pending",
              algorithmSize: s,
            })
          })
        }
      })

      // 立即设置结果数组，这样用户可以看到将要计算的所有算法
      setAllHashResults([...results])

      const localJobs = results
        .map((result, index) => ({ result, index }))
        .filter(({ result }) => !serverBackedAlgorithms.has(result.algorithm))
      const serverJobs = results
        .map((result, index) => ({ result, index }))
        .filter(({ result }) => serverBackedAlgorithms.has(result.algorithm))

      if (localJobs.length > 0) {
        const hashers = localJobs.map(({ result, index }) => {
          results[index].status = "calculating"
          return {
            index,
            hasher: createIncrementalHasher(
              result.algorithm,
              result.algorithmSize,
              size,
              outputFormat,
            ),
          }
        })
        setAllHashResults([...results])

        const localProgressWeight = serverJobs.length > 0 ? 80 : 100
        await readFileInChunks(
          selectedFile.file,
          (chunk) => {
            hashers.forEach(({ hasher }) => hasher.update(chunk))
          },
          (progress) => setFileProgress(Math.round((progress * localProgressWeight) / 100)),
          () =>
            cancelCalculationRef.current ||
            signal.aborted ||
            calculationIdRef.current !== calculationId,
        )

        hashers.forEach(({ index, hasher }) => {
          results[index].value = hasher.digest()
          results[index].status = "completed"
        })
        setAllHashResults([...results])
      }

      if (
        !cancelCalculationRef.current &&
        !signal.aborted &&
        calculationIdRef.current === calculationId &&
        serverJobs.length > 0
      ) {
        serverJobs.forEach(({ index }) => {
          results[index].status = "calculating"
        })
        setAllHashResults([...results])

        let completedServerJobs = 0
        const serverProgressBase = localJobs.length > 0 ? 80 : 0
        const serverProgressWeight = localJobs.length > 0 ? 20 : 100
        await Promise.all(serverJobs.map(async ({ result, index }) => {
          try {
            results[index].value = await calculateServerHash(
              result.algorithm,
              {
                algorithmSize: result.algorithmSize,
                file: selectedFile.file,
              },
              signal,
            )
            results[index].status = "completed"
          } catch (error) {
            if (signal.aborted) return
            console.error(`Error calculating hash for ${result.algorithm}:`, error)
            results[index].value = `${t("error")}: ${result.algorithm}`
            results[index].status = "error"
          } finally {
            completedServerJobs += 1
            if (calculationIdRef.current === calculationId) {
              setFileProgress(
                serverProgressBase +
                  Math.round(
                    (completedServerJobs / serverJobs.length) * serverProgressWeight,
                  ),
              )
              setAllHashResults([...results])
            }
          }
        }))
      }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        console.error("Error calculating file hashes:", error)
      }
    } finally {
      if (calculationIdRef.current === calculationId) {
        setFileCalculating(false)
      }
    }
  }

  // 计算单个文件哈希
  const calculateSingleFileHash = async (
    selectedFile: FileInfo,
    calculationId: number,
    signal: AbortSignal,
  ) => {

    setFileCalculating(true)
    setFileProgress(0)
    cancelCalculationRef.current = false

    try {
      const result = await calculateFileHash(
        selectedFile.file,
        algorithm,
        isCurrentAlgorithmConfigurable() ? size : undefined,
        calculationId,
        signal,
      )
      if (calculationIdRef.current !== calculationId) return
      setHashResult(result)

      // 如果有验证哈希，检查是否匹配
      if (verifyHash) {
        verifyHashValue(result)
      }
    } catch (error) {
      if (signal.aborted || calculationIdRef.current !== calculationId) return
      console.error("Error calculating file hash:", error)
      setHashResult(`${t("error")}: ${algorithm}`)
    } finally {
      if (calculationIdRef.current === calculationId) {
        setFileCalculating(false)
      }
    }
  }

  // 计算哈希
  const calculateHash = async () => {
    stopActiveCalculation()
    const calculationId = ++calculationIdRef.current
    const controller = new AbortController()
    calculationAbortRef.current = controller
    cancelCalculationRef.current = false
    setCalculationError("")

    if (inputMode === "text") {
      if (!input) {
        setHashResult("")
        setAllHashResults([])
        return
      }

      const textSnapshot = input
      setTextCalculating(true)
      try {
        if (showAllResults) {
          setHashResult("")
          await calculateAllTextHashes(
            textSnapshot,
            calculationId,
            controller.signal,
          )
        } else {
          setAllHashResults([])
          const result = await calculateSingleTextHash(
            textSnapshot,
            algorithm,
            isCurrentAlgorithmConfigurable() ? size : undefined,
            controller.signal,
          )
          if (calculationIdRef.current !== calculationId) return
          setHashResult(result)
          if (verifyHash) verifyHashValue(result)
        }
      } catch (error) {
        if (!controller.signal.aborted && calculationIdRef.current === calculationId) {
          console.error("Error calculating text hash:", error)
          setCalculationError(t("error"))
        }
      } finally {
        if (calculationIdRef.current === calculationId) {
          setTextCalculating(false)
          calculationAbortRef.current = null
        }
      }
    } else {
      if (!fileInfo) return
      if (showAllResults) {
        await calculateAllFileHashes(fileInfo, calculationId, controller.signal)
      } else {
        await calculateSingleFileHash(fileInfo, calculationId, controller.signal)
      }
      if (calculationIdRef.current === calculationId) {
        calculationAbortRef.current = null
      }
    }
  }

  // 验证哈希值
  const verifyHashValue = (result: string = hashResult) => {
    if (!verifyHash) {
      setVerifyResult(null)
      return
    }

    const normalizedVerifyHash = verifyHash.trim().toLowerCase()

    if (showAllResults && allHashResults.length > 0) {
      // 在显示所有结果模式下，检查是否与任何一个算法结果匹配
      for (const hashResult of allHashResults) {
        if (hashResult.value && hashResult.value.toLowerCase() === normalizedVerifyHash) {
          setVerifyResult({
            isMatch: true,
            matchedAlgorithm: hashResult.displayName,
          })
          return
        }
      }
      setVerifyResult({ isMatch: false })
    } else if (result) {
      // 在单一结果模式下，只检查当前选中的算法结果
      const isMatch = result.toLowerCase() === normalizedVerifyHash
      setVerifyResult({
        isMatch,
        matchedAlgorithm: isMatch ? getCurrentAlgorithmDisplayName() : undefined,
      })
    } else {
      setVerifyResult(null)
    }
  }

  // 复制哈希结果
  const copyToClipboard = (text: string, key = "main") => {
    void writeClipboardText(text).then((success) => {
      if (!success) {
        setCopied((prev) => ({ ...prev, [key]: false }))
        return
      }
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

  // 清空输入
  const clearInput = () => {
    stopActiveCalculation()
    if (inputMode === "text") {
      setInput("")
      if (inputRef.current) {
        inputRef.current.focus()
      }
    } else {
      setFileInfo(null)
    }

    setHashResult("")
    setAllHashResults([])
    setVerifyHash("")
    setVerifyResult(null)
    setFileProgress(0)
    setFileError("")
  }

  const selectFile = (file: File) => {
    if (file.size > MAX_FILE_SIZE) {
      setFileError(t("fileTooBig"))
      return
    }

    stopActiveCalculation()
    setFileInfo({
      file,
      name: file.name,
      size: file.size,
      sizeFormatted: formatFileSize(file.size),
    })
    setHashResult("")
    setAllHashResults([])
    setFileProgress(0)
    setFileError("")
  }

  // 处理文件上传
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      selectFile(files[0])
    }

    // 重置文件输入，以便可以再次选择同一个文件
    if (e.target) {
      e.target.value = ""
    }
  }

  // 处理文件拖放
  const handleFileDrop = (e: React.DragEvent<HTMLElement>) => {
    e.preventDefault()
    e.stopPropagation()

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      selectFile(e.dataTransfer.files[0])
    }
  }

  // 防止默认拖放行为
  const preventDefaults = (e: React.DragEvent<HTMLElement>) => {
    e.preventDefault()
    e.stopPropagation()
  }

  // 当输入变化且自动计算开启时，计算哈希
  useEffect(() => {
    if (!autoCalculate) return

    if ((inputMode === "text" && !input) || (inputMode === "file" && !fileInfo)) {
      return
    }

    const timer = setTimeout(() => {
      void calculateHash()
    }, 300)
    return () => clearTimeout(timer)
  }, [input, fileInfo, algorithm, outputFormat, size, autoCalculate, showAllResults, inputMode])

  // 当验证哈希变化时，验证哈希
  useEffect(() => {
    if (verifyHash) {
      if (showAllResults && allHashResults.length > 0) {
        verifyHashValue()
      } else if (hashResult) {
        verifyHashValue()
      } else {
        setVerifyResult(null)
      }
    } else {
      setVerifyResult(null)
    }
  }, [verifyHash, showAllResults, allHashResults, hashResult])

  // 清理复制超时
  useEffect(() => {
    return () => {
      cancelCalculationRef.current = true
      calculationIdRef.current += 1
      calculationAbortRef.current?.abort()
      Object.values(copyTimeoutRef.current).forEach((timeout) => {
        if (timeout) {
          clearTimeout(timeout)
        }
      })
    }
  }, [])

  // 选择算法分类
  const handleCategoryChange = (category: string) => {
    stopActiveCalculation()
    setHashResult("")
    setAllHashResults([])
    setSelectedCategory(category)
    // 选择该分类下的第一个算法
    const categoryData = hashCategories.find((cat) => cat.name === category)
    if (categoryData && categoryData.algorithms.length > 0) {
      setAlgorithm(categoryData.algorithms[0].id)
    }
  }

  const handleAlgorithmChange = (nextAlgorithm: string) => {
    stopActiveCalculation()
    setHashResult("")
    setAllHashResults([])
    setAlgorithm(nextAlgorithm)
    const categoryData = hashCategories.find((category) =>
      category.algorithms.some((algo) => algo.id === nextAlgorithm),
    )
    if (categoryData) {
      setSelectedCategory(categoryData.name)
    }
  }

  // 获取当前算法是否可配置
  const isCurrentAlgorithmConfigurable = () => {
    const currentAlgo = allAlgorithms.find((algo) => algo.id === algorithm)
    return currentAlgo ? currentAlgo.configurable : false
  }

  // Add a function to check if the current algorithm requires a key
  // Add this after the isCurrentAlgorithmConfigurable function

  // 获取当前算法的可选size
  const getCurrentAlgorithmSizes = () => {
    const algorithmObj = allAlgorithms.find((algo) => algo.id === algorithm)
    return algorithmObj && algorithmObj.configurable ? algorithmObj.sizes || [] : []
  }

  // 获取当前选中算法的显示名称
  const getCurrentAlgorithmDisplayName = () => {
    return getAlgorithmDisplayName(algorithm, isCurrentAlgorithmConfigurable() ? size : undefined)
  }

  // 添加取消计算的函数
  const cancelCalculation = () => {
    stopActiveCalculation()
  }

  const isCalculating = fileCalculating || textCalculating

  return (
    <div className="container mx-auto max-w-5xl px-3 py-4 sm:px-4">
      <header className="mb-6 text-center">
        <h1 className="text-2xl font-bold text-[var(--md-sys-color-on-surface)] sm:text-3xl">
          {t("title")}
        </h1>
        <p className="mt-2 text-sm text-[var(--md-sys-color-on-surface-variant)] sm:text-base">
          {t("hashDescription")}
        </p>
      </header>

      <div className="space-y-4">
        <Card className="rounded-[var(--md-sys-shape-corner-large)] border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container-lowest)]">
          <CardContent className="grid gap-4 pt-5 sm:grid-cols-2">
            <div className="flex items-start justify-between gap-3 rounded-[var(--md-sys-shape-corner-medium)] bg-[var(--md-sys-color-surface-container-low)] p-3">
              <div>
                <Label htmlFor="show-all-results">{t("showAllResults")}</Label>
                <p className="mt-1 text-xs text-[var(--md-sys-color-on-surface-variant)]">
                  {t("showAllHint")}
                </p>
              </div>
              <Switch
                id="show-all-results"
                checked={showAllResults}
                onCheckedChange={(checked) => {
                  stopActiveCalculation()
                  setShowAllResults(checked)
                  setHashResult("")
                  setAllHashResults([])
                  setVerifyResult(null)
                }}
              />
            </div>
            <div className="space-y-2 rounded-[var(--md-sys-shape-corner-medium)] bg-[var(--md-sys-color-surface-container-low)] p-3">
              <Label>{t("outputFormat")}</Label>
              <RadioGroup
                value={outputFormat}
                onValueChange={(value) => {
                  stopActiveCalculation()
                  setOutputFormat(value)
                  setHashResult("")
                  setAllHashResults([])
                }}
                className="grid grid-cols-2 gap-2"
              >
                {[
                  { value: "hex", label: t("hex") },
                  { value: "base64", label: t("base64") },
                ].map((option) => (
                  <Label
                    key={option.value}
                    htmlFor={`hash-output-${option.value}`}
                    className="flex min-h-10 cursor-pointer items-center gap-2 rounded-[var(--md-sys-shape-corner-small)] border border-[var(--md-sys-color-outline-variant)] px-3"
                  >
                    <RadioGroupItem
                      id={`hash-output-${option.value}`}
                      value={option.value}
                    />
                    {option.label}
                  </Label>
                ))}
              </RadioGroup>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[var(--md-sys-shape-corner-large)] border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container-lowest)]">
          <CardContent className="pt-5">
            <Tabs
              value={inputMode}
              onValueChange={(value) => {
                stopActiveCalculation()
                setInputMode(value as "text" | "file")
                setHashResult("")
                setAllHashResults([])
                setCalculationError("")
              }}
            >
              <TabsList className="mb-4 grid h-auto w-full grid-cols-2">
                <TabsTrigger value="text" className="min-h-11 gap-2">
                  <FileText className="h-4 w-4" aria-hidden="true" />
                  {t("textMode")}
                </TabsTrigger>
                <TabsTrigger value="file" className="min-h-11 gap-2">
                  <Upload className="h-4 w-4" aria-hidden="true" />
                  {t("fileMode")}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="text" className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Label htmlFor="hash-input">{t("textInput")}</Label>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="auto-calculate" className="cursor-pointer text-sm">
                      {t("autoCalculate")}
                    </Label>
                    <Checkbox
                      id="auto-calculate"
                      checked={autoCalculate}
                      onCheckedChange={(checked) => setAutoCalculate(!!checked)}
                    />
                    <Button variant="outline" size="sm" onClick={clearInput}>
                      {t("clearInput")}
                    </Button>
                  </div>
                </div>
                <Textarea
                  id="hash-input"
                  ref={inputRef}
                  placeholder={t("inputPlaceholder")}
                  value={input}
                  onChange={(event) => {
                    stopActiveCalculation()
                    setInput(event.target.value)
                    setHashResult("")
                    setAllHashResults([])
                    setCalculationError("")
                  }}
                  rows={6}
                  className="min-h-36 resize-y font-mono"
                />
              </TabsContent>

              <TabsContent value="file" className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Label>{t("fileInput")}</Label>
                  <div className="flex items-center gap-2">
                    <Label
                      htmlFor="auto-calculate-file"
                      className="cursor-pointer text-sm"
                    >
                      {t("autoCalculate")}
                    </Label>
                    <Checkbox
                      id="auto-calculate-file"
                      checked={autoCalculate}
                      onCheckedChange={(checked) => setAutoCalculate(!!checked)}
                    />
                    <Button variant="outline" size="sm" onClick={clearInput}>
                      {t("clearInput")}
                    </Button>
                  </div>
                </div>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  className="hidden"
                />
                {fileError && (
                  <div
                    className="rounded-[var(--md-sys-shape-corner-medium)] bg-[var(--md-sys-color-error-container)] p-3 text-sm text-[var(--md-sys-color-on-error-container)]"
                    role="alert"
                  >
                    {fileError}
                  </div>
                )}
                {!fileInfo ? (
                  <button
                    type="button"
                    className="w-full rounded-[var(--md-sys-shape-corner-large)] border-2 border-dashed border-[var(--md-sys-color-outline)] bg-[var(--md-sys-color-surface-container-low)] p-7 text-center transition-colors hover:border-[var(--md-sys-color-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--md-sys-color-primary)]"
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={preventDefaults}
                    onDragEnter={preventDefaults}
                    onDragLeave={preventDefaults}
                    onDrop={handleFileDrop}
                  >
                    <Upload
                      className="mx-auto mb-3 h-10 w-10 text-[var(--md-sys-color-on-surface-variant)]"
                      aria-hidden="true"
                    />
                    <span className="block font-medium">{t("dropFileHere")}</span>
                    <span className="mt-2 inline-block rounded-full bg-[var(--md-sys-color-secondary-container)] px-3 py-1 text-sm text-[var(--md-sys-color-on-secondary-container)]">
                      {t("uploadFile")}
                    </span>
                  </button>
                ) : (
                  <div className="rounded-[var(--md-sys-shape-corner-medium)] border border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container-low)] p-4">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <h3 className="font-medium">{t("fileInfo")}</h3>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={clearInput}
                        aria-label={t("removeFile")}
                      >
                        <X className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    </div>
                    <dl className="grid gap-3 text-sm sm:grid-cols-2">
                      <div className="min-w-0">
                        <dt className="text-xs text-[var(--md-sys-color-on-surface-variant)]">
                          {t("fileName")}
                        </dt>
                        <dd className="mt-1 break-all font-medium">{fileInfo.name}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-[var(--md-sys-color-on-surface-variant)]">
                          {t("fileSize")}
                        </dt>
                        <dd className="mt-1 font-medium">{fileInfo.sizeFormatted}</dd>
                      </div>
                    </dl>
                    {fileCalculating && (
                      <div className="mt-4" aria-live="polite">
                        <div className="mb-1 flex justify-between text-sm">
                          <span>{t("calculating")}</span>
                          <span className="tabular-nums">{fileProgress}%</span>
                        </div>
                        <Progress value={fileProgress} className="h-2" />
                      </div>
                    )}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <Card className="rounded-[var(--md-sys-shape-corner-large)] border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container-lowest)]">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t("algorithm")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label>{t("algorithmCategory")}</Label>
              <div className="flex flex-wrap gap-2" aria-label={t("algorithmCategory")}>
                {hashCategories.map((category) => (
                  <Button
                    key={category.name}
                    type="button"
                    variant={
                      selectedCategory === category.name ? "default" : "outline"
                    }
                    size="sm"
                    onClick={() => handleCategoryChange(category.name)}
                  >
                    {category.name}
                  </Button>
                ))}
              </div>
            </div>

            <Tabs value={algorithm} onValueChange={handleAlgorithmChange}>
              <TabsList className="grid h-auto grid-cols-1 gap-2 bg-transparent p-0 sm:grid-cols-2 md:grid-cols-3">
                {(
                  hashCategories.find(
                    (category) => category.name === selectedCategory,
                  )?.algorithms || []
                ).map((algo) => (
                  <TabsTrigger
                    key={algo.id}
                    value={algo.id}
                    className={cn(
                      "h-auto min-h-[72px] items-start justify-start rounded-[var(--md-sys-shape-corner-large)] border border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container-low)] px-4 py-3 text-left transition-colors",
                      "data-[state=active]:border-[var(--md-sys-color-primary)] data-[state=active]:bg-[var(--md-sys-color-primary-container)] data-[state=active]:text-[var(--md-sys-color-on-primary-container)]",
                    )}
                  >
                    <span className="flex min-w-0 flex-col gap-1">
                      <span className="text-sm font-semibold">{algo.name}</span>
                      <span className="whitespace-normal text-xs text-[var(--md-sys-color-on-surface-variant)]">
                        {algorithmDescriptions[algo.id]
                          ? t(algorithmDescriptions[algo.id])
                          : algo.configurable
                            ? t("configurableOutput")
                            : t("fixedOutput")}
                      </span>
                    </span>
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>

            {!showAllResults && isCurrentAlgorithmConfigurable() && (
              <div className="space-y-2">
                <Label>{t("digestSize")}</Label>
                <RadioGroup
                  value={size.toString()}
                  onValueChange={(value) => {
                    stopActiveCalculation()
                    setSize(Number.parseInt(value))
                    setHashResult("")
                  }}
                  className="grid grid-cols-2 gap-2 sm:grid-cols-4"
                >
                  {getCurrentAlgorithmSizes().map((algorithmSize) => (
                    <Label
                      key={algorithmSize}
                      htmlFor={`size-${algorithmSize}`}
                      className="flex min-h-10 cursor-pointer items-center gap-2 rounded-[var(--md-sys-shape-corner-small)] border border-[var(--md-sys-color-outline-variant)] px-3"
                    >
                      <RadioGroupItem
                        value={algorithmSize.toString()}
                        id={`size-${algorithmSize}`}
                      />
                      {algorithmSize} {t("bits")}
                    </Label>
                  ))}
                </RadioGroup>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-[var(--md-sys-shape-corner-large)] border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container-lowest)]">
          <CardContent className="space-y-2 pt-5">
            <Label htmlFor="verify-hash">{t("verify")}</Label>
            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
              <Input
                id="verify-hash"
                placeholder={t("verifyPlaceholder")}
                value={verifyHash}
                onChange={(event) => setVerifyHash(event.target.value)}
                aria-invalid={verifyResult ? !verifyResult.isMatch : undefined}
                className={
                  verifyResult === null
                    ? ""
                    : verifyResult.isMatch
                      ? "border-[var(--md-sys-color-primary)]"
                      : "border-[var(--md-sys-color-error)]"
                }
              />
              {verifyResult !== null && (
                <div
                  className={`flex min-h-10 items-center rounded-[var(--md-sys-shape-corner-small)] px-3 text-sm ${
                    verifyResult.isMatch
                      ? "bg-[var(--md-sys-color-primary-container)] text-[var(--md-sys-color-on-primary-container)]"
                      : "bg-[var(--md-sys-color-error-container)] text-[var(--md-sys-color-on-error-container)]"
                  }`}
                  role="status"
                >
                  {verifyResult.isMatch
                    ? `${t("verifyMatch")} (${verifyResult.matchedAlgorithm})`
                    : t("verifyNotMatch")}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {calculationError && (
          <div
            className="rounded-[var(--md-sys-shape-corner-medium)] bg-[var(--md-sys-color-error-container)] p-3 text-sm text-[var(--md-sys-color-on-error-container)]"
            role="alert"
          >
            {calculationError}
          </div>
        )}

        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
          <Button
            onClick={() => void calculateHash()}
            disabled={
              (inputMode === "text" ? !input : !fileInfo) || isCalculating
            }
            className="min-h-11 w-full"
          >
            {isCalculating ? t("calculating") : t("calculate")}
          </Button>
          {isCalculating && (
            <Button
              variant="outline"
              onClick={cancelCalculation}
              className="min-h-11"
            >
              {t("cancel")}
            </Button>
          )}
        </div>

        {hashResult && !showAllResults && (
          <Card className="rounded-[var(--md-sys-shape-corner-large)] border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container-lowest)]">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{t("result")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2 rounded-[var(--md-sys-shape-corner-medium)] bg-[var(--md-sys-color-surface-container)] p-4">
                <div className="min-w-0 space-y-2">
                  <span className="block font-medium">
                    {getCurrentAlgorithmDisplayName()}
                  </span>
                  <code className="block min-w-0 break-all text-sm leading-6">
                    {hashResult}
                  </code>
                </div>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="shrink-0"
                        aria-label={copied.main ? t("copied") : t("copy")}
                        onClick={() => copyToClipboard(hashResult)}
                      >
                        {copied.main ? (
                          <Check
                            className="h-4 w-4 text-[var(--md-sys-color-primary)]"
                            aria-hidden="true"
                          />
                        ) : (
                          <Copy className="h-4 w-4" aria-hidden="true" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {copied.main ? t("copied") : t("copy")}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </CardContent>
          </Card>
        )}

        {showAllResults && allHashResults.length > 0 && (
          <Card className="rounded-[var(--md-sys-shape-corner-large)] border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container-lowest)]">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{t("allResults")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {allHashResults.map((result) => {
                const copyKey = `${result.algorithm}-${result.algorithmSize ?? "default"}`
                return (
                  <div
                    key={copyKey}
                    className={`grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2 rounded-[var(--md-sys-shape-corner-medium)] p-3 ${
                      result.status === "calculating"
                        ? "bg-[var(--md-sys-color-tertiary-container)] text-[var(--md-sys-color-on-tertiary-container)]"
                        : result.status === "error"
                          ? "bg-[var(--md-sys-color-error-container)] text-[var(--md-sys-color-on-error-container)]"
                          : "bg-[var(--md-sys-color-surface-container)]"
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{result.displayName}</span>
                        {result.status === "pending" && (
                          <span className="text-xs italic text-[var(--md-sys-color-on-surface-variant)]">
                            {t("pending")}
                          </span>
                        )}
                        {result.status === "calculating" && (
                          <span className="text-xs italic">
                            {t("calculating")}
                          </span>
                        )}
                      </div>
                      {(result.status === "completed" ||
                        result.status === "error") && (
                        <code className="mt-2 block break-all text-sm leading-6">
                          {result.value}
                        </code>
                      )}
                    </div>
                    {result.status === "completed" && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={copied[copyKey] ? t("copied") : t("copy")}
                              onClick={() =>
                                copyToClipboard(result.value, copyKey)
                              }
                            >
                              {copied[copyKey] ? (
                                <Check
                                  className="h-4 w-4 text-[var(--md-sys-color-primary)]"
                                  aria-hidden="true"
                                />
                              ) : (
                                <Copy className="h-4 w-4" aria-hidden="true" />
                              )}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            {copied[copyKey] ? t("copied") : t("copy")}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </div>
                )
              })}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
