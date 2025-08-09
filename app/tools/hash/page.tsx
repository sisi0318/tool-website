"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { useTranslations } from "@/hooks/use-translations"
import { createHash } from "crypto"
import { SHA3 } from "sha3"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Copy, Check, Upload, FileText, X } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Progress } from "@/components/ui/progress"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"

// 添加参数接口
interface HashPageProps {
  params?: {
    feature?: string
  }
}

// 添加CRC32函数实现
function crc32(str: string) {
  // 函数实现保持不变
  function makeCRCTable() {
    let c
    const crcTable = []
    for (let n = 0; n < 256; n++) {
      c = n
      for (let k = 0; k < 8; k++) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      }
      crcTable[n] = c
    }
    return crcTable
  }

  const crcTable = makeCRCTable()
  let crc = 0 ^ -1

  for (let i = 0; i < str.length; i++) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ str.charCodeAt(i)) & 0xff]
  }

  return (crc ^ -1) >>> 0
}

// 哈希结果类型
interface HashResult {
  algorithm: string
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
const hashCategories = [
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
        defaultRounds: 1,
      },
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
        defaultRounds: 24,
      },
    ],
  },
  {
    name: "RIPEMD",
    algorithms: [{ id: "ripemd160", name: "RIPEMD160", configurable: false }],
  },
  {
    name: "CRC",
    algorithms: [{ id: "crc32", name: "CRC32", configurable: false }],
  },
]

// 扁平化算法列表，方便查找
const allAlgorithms = hashCategories.flatMap((category) => category.algorithms)

export default function HashPage({ params }: HashPageProps) {
  const t = useTranslations("hash")

  // 哈希计算器状态
  const [inputMode, setInputMode] = useState<"text" | "file">("text")
  const [input, setInput] = useState("")
  const [fileInfo, setFileInfo] = useState<FileInfo | null>(null)
  const [fileCalculating, setFileCalculating] = useState(false)
  const [fileProgress, setFileProgress] = useState(0)
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
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cancelCalculationRef = useRef<boolean>(false)
  // Add the hmacKey state after the other state declarations

  // 复制超时
  const copyTimeoutRef = useRef<{ [key: string]: NodeJS.Timeout | null }>({})

  // 根据传入的功能参数设置初始算法
  useEffect(() => {
    if (params?.feature) {
      // 将功能名称转换为小写以进行不区分大小写的比较
      const featureLower = params.feature.toLowerCase()

      // 查找匹配的算法
      let found = false

      // 遍历所有算法类别
      for (const category of hashCategories) {
        for (const algo of category.algorithms) {
          if (algo.name.toLowerCase() === featureLower || algo.id.toLowerCase() === featureLower) {
            setAlgorithm(algo.id)
            setSelectedCategory(category.name)
            found = true
            break
          }

          // 对于可配置的算法，检查是否匹配特定大小
          if (algo.configurable && algo.sizes) {
            for (const s of algo.sizes) {
              const sizeSpecificName = `${algo.name}-${s}`.toLowerCase()
              if (sizeSpecificName === featureLower) {
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
      // 设置默认size为算法支持的第一个size
      if (algorithmObj.sizes && algorithmObj.sizes.length > 0) {
        setSize(algorithmObj.sizes[0])
      }
    }
  }, [algorithm])

  // 其余代码保持不变...
  // 这里省略了原有的函数实现，实际代码中应保留所有原有功能

  // 计算单个哈希值（文本）
  // Update the calculateSingleTextHash function to handle HMAC
  const calculateSingleTextHash = (algorithmId: string, algorithmSize?: number): string => {
    try {
      let result = ""

      // Handle HMAC algorithms

      if (algorithmId === "sha3") {
        // 使用SHA3库计算SHA3哈希
        const sha3 = new SHA3(algorithmSize || size)
        sha3.update(input)
        result = outputFormat === "hex" ? sha3.digest("hex") : sha3.digest("base64")
      } else if (algorithmId === "sha2") {
        // 使用crypto模块计算SHA2哈希
        const hashAlgorithm = `sha${algorithmSize || size}`
        const hashObj = createHash(hashAlgorithm)
        hashObj.update(input)
        result = outputFormat === "hex" ? hashObj.digest("hex") : hashObj.digest("base64")
      } else if (algorithmId === "crc32") {
        // 计算CRC32
        const crcResult = crc32(input).toString(16).padStart(8, "0")
        result = outputFormat === "hex" ? crcResult : Buffer.from(crcResult, "hex").toString("base64")
      } else {
        // 使用crypto模块计算其他哈希
        const hashObj = createHash(algorithmId)
        hashObj.update(input)
        result = outputFormat === "hex" ? hashObj.digest("hex") : hashObj.digest("base64")
      }

      return result
    } catch (error) {
      console.error(`Hash calculation error for ${algorithmId}:`, error)
      return `${t("error")}: ${algorithmId}`
    }
  }

  // 获取算法显示名称
  const getAlgorithmDisplayName = (algorithmId: string, algorithmSize?: number): string => {
    const algorithmObj = allAlgorithms.find((algo) => algo.id === algorithmId)
    if (!algorithmObj) return algorithmId

    if ((algorithmId === "sha2" || algorithmId === "sha3") && algorithmSize) {
      return `${algorithmObj.name}-${algorithmSize}`
    }

    return algorithmObj.name
  }

  // 计算所有哈希值（文本）
  const calculateAllTextHashes = () => {
    if (!input) {
      setAllHashResults([])
      return
    }

    // 创建所有算法的结果数组
    const results: HashResult[] = []

    // 计算非可配置算法
    allAlgorithms
      .filter((algo) => !algo.configurable)
      .forEach((algo) => {
        const value = calculateSingleTextHash(algo.id)
        results.push({
          algorithm: algo.id,
          displayName: algo.name,
          value,
          status: "completed",
        })
      })

    // 计算可配置算法的所有大小
    allAlgorithms
      .filter((algo) => algo.configurable)
      .forEach((algo) => {
        if (algo.sizes) {
          algo.sizes.forEach((s) => {
            const value = calculateSingleTextHash(algo.id, s)
            results.push({
              algorithm: `${algo.id}-${s}`,
              displayName: `${algo.name}-${s}`,
              value,
              status: "completed",
            })
          })
        }
      })

    setAllHashResults(results)
  }

  // 计算文件哈希
  // Update the calculateFileHash function to handle HMAC
  const calculateFileHash = async (file: File, algorithmId: string, algorithmSize?: number): Promise<string> => {
    return new Promise((resolve, reject) => {
      try {
        const fileReader = new FileReader()
        // Increase chunk size to improve performance
        const chunkSize = 5 * 1024 * 1024 // 5MB chunks
        let offset = 0
        let hash

        // Initialize hash object

        if (algorithmId === "sha3") {
          hash = new SHA3(algorithmSize || size)
        } else if (algorithmId === "sha2") {
          const hashAlgorithm = `sha${algorithmSize || size}`
          hash = createHash(hashAlgorithm)
        } else if (algorithmId === "crc32") {
          // CRC32 needs special handling as it's not streaming
          // We'll calculate it after the last read
          hash = { update: () => {}, digest: () => {} }
        } else {
          hash = createHash(algorithmId)
        }

        // Store all data for CRC32 calculation
        let fullData = ""

        fileReader.onload = (e) => {
          if (e.target?.result) {
            const chunk = e.target.result as string

            // For CRC32, we store the data
            if (algorithmId === "crc32") {
              fullData += chunk
            } else {
              // For other algorithms, we update the hash
              hash.update(chunk)
            }

            // Update progress
            offset += chunk.length
            const progress = Math.min(100, Math.round((offset / file.size) * 100))
            setFileProgress(progress)

            if (offset < file.size) {
              // Continue reading the next chunk
              readNextChunk()
            } else {
              // Finished reading
              let result

              if (algorithmId === "crc32") {
                // Calculate CRC32
                const crcResult = crc32(fullData).toString(16).padStart(8, "0")
                result = outputFormat === "hex" ? crcResult : Buffer.from(crcResult, "hex").toString("base64")
              } else {
                // Get results for other algorithms
                result = outputFormat === "hex" ? hash.digest("hex") : hash.digest("base64")
              }

              resolve(result)
            }
          }
        }

        fileReader.onerror = () => {
          reject(new Error("File reading error"))
        }

        const readNextChunk = () => {
          const slice = file.slice(offset, offset + chunkSize)
          fileReader.readAsText(slice)
        }

        // Start reading
        readNextChunk()
      } catch (error) {
        reject(error)
      }
    })
  }

  // 计算所有文件哈希
  const calculateAllFileHashes = async () => {
    if (!fileInfo) {
      setAllHashResults([])
      return
    }

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
                algorithm: `${algo.id}-${s}`,
                displayName: `${algo.name}-${s}`,
                value: "",
                status: "pending",
              })
            })
          }
        })

      // 立即设置结果数组，这样用户可以看到将要计算的所有算法
      setAllHashResults([...results])

      // 逐个计算每个算法的哈希值
      for (let i = 0; i < results.length; i++) {
        if (cancelCalculationRef.current) {
          break
        }

        const result = results[i]

        // 更新当前算法的状态为 calculating
        results[i].status = "calculating"
        setAllHashResults([...results])

        try {
          let value = ""

          // 解析算法 ID 和大小
          if (result.algorithm.includes("-")) {
            const [algoId, sizeStr] = result.algorithm.split("-")
            const algoSize = Number.parseInt(sizeStr)
            value = await calculateFileHash(fileInfo.file, algoId, algoSize)
          } else {
            value = await calculateFileHash(fileInfo.file, result.algorithm)
          }

          // 更新结果和状态
          results[i].value = value
          results[i].status = "completed"
        } catch (error) {
          console.error(`Error calculating hash for ${result.algorithm}:`, error)
          results[i].value = `${t("error")}: ${result.algorithm}`
          results[i].status = "error"
        }

        // 更新界面
        setAllHashResults([...results])
      }
    } catch (error) {
      console.error("Error calculating file hashes:", error)
    } finally {
      setFileCalculating(false)
    }
  }

  // 计算单个文件哈希
  const calculateSingleFileHash = async () => {
    if (!fileInfo) {
      setHashResult("")
      return
    }

    setFileCalculating(true)
    setFileProgress(0)

    try {
      let result

      if (algorithm === "sha3" || algorithm === "sha2") {
        result = await calculateFileHash(fileInfo.file, algorithm, size)
      } else {
        result = await calculateFileHash(fileInfo.file, algorithm)
      }

      setHashResult(result)

      // 如果有验证哈希，检查是否匹配
      if (verifyHash) {
        verifyHashValue(result)
      }
    } catch (error) {
      console.error("Error calculating file hash:", error)
      setHashResult(`${t("error")}: ${algorithm}`)
    } finally {
      setFileCalculating(false)
    }
  }

  // 计算哈希
  const calculateHash = () => {
    if (inputMode === "text") {
      if (!input) {
        setHashResult("")
        setAllHashResults([])
        return
      }

      // 计算当前选中的算法
      const result = calculateSingleTextHash(algorithm)
      setHashResult(result)

      // 如果启用了显示所有结果，计算所有算法
      if (showAllResults) {
        calculateAllTextHashes()
      }

      // 如果有验证哈希，检查是否匹配
      if (verifyHash) {
        verifyHashValue(result)
      }
    } else {
      // 文件模式
      if (showAllResults) {
        calculateAllFileHashes()
      } else {
        calculateSingleFileHash()
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

  // 清空输入
  const clearInput = () => {
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
  }

  // 处理文件上传
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      const file = files[0]

      // 检查文件大小
      if (file.size > MAX_FILE_SIZE) {
        alert(t("fileTooBig"))
        return
      }

      setFileInfo({
        file,
        name: file.name,
        size: file.size,
        sizeFormatted: formatFileSize(file.size),
      })

      // 如果自动计算开启，计算哈希
      if (autoCalculate) {
        setTimeout(() => {
          if (showAllResults) {
            calculateAllFileHashes()
          } else {
            calculateSingleFileHash()
          }
        }, 300)
      }
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
        alert(t("fileTooBig"))
        return
      }

      setFileInfo({
        file,
        name: file.name,
        size: file.size,
        sizeFormatted: formatFileSize(file.size),
      })

      // 如果自动计算开启，计算哈希
      if (autoCalculate) {
        setTimeout(() => {
          if (showAllResults) {
            calculateAllFileHashes()
          } else {
            calculateSingleFileHash()
          }
        }, 300)
      }
    }
  }

  // 防止默认拖放行为
  const preventDefaults = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
  }

  // 当输入变化且自动计算开启时，计算哈希
  useEffect(() => {
    if (autoCalculate) {
      if (inputMode === "text" && input) {
        const timer = setTimeout(() => {
          calculateHash()
        }, 300)
        return () => clearTimeout(timer)
      }
    }
  }, [input, algorithm, outputFormat, size, autoCalculate, showAllResults, inputMode])

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
      Object.values(copyTimeoutRef.current).forEach((timeout) => {
        if (timeout) {
          clearTimeout(timeout)
        }
      })
    }
  }, [])

  // 选择算法分类
  const handleCategoryChange = (category: string) => {
    setSelectedCategory(category)
    // 选择该分类下的第一个算法
    const categoryData = hashCategories.find((cat) => cat.name === category)
    if (categoryData && categoryData.algorithms.length > 0) {
      setAlgorithm(categoryData.algorithms[0].id)
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
    return getAlgorithmDisplayName(algorithm, size)
  }

  // 添加取消计算的函数
  const cancelCalculation = () => {
    cancelCalculationRef.current = true
  }

  return (
    <div className="container mx-auto px-4 py-4 max-w-3xl">
      <h2 className="text-2xl font-bold text-center mb-6">{t("title")}</h2>
      <div className="space-y-4">
        <div className="flex items-center space-x-2 mb-4">
          <Switch id="show-all-results" checked={showAllResults} onCheckedChange={setShowAllResults} />
          <Label htmlFor="show-all-results" className="cursor-pointer">
            {t("showAllResults")}
          </Label>
        </div>

        <Tabs value={inputMode} onValueChange={(value) => setInputMode(value as "text" | "file")}>
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="text" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              {t("textMode")}
            </TabsTrigger>
            <TabsTrigger value="file" className="flex items-center gap-2">
              <Upload className="h-4 w-4" />
              {t("fileMode")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="text" className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Button variant="outline" size="sm" onClick={clearInput}>
                  {t("clearInput")}
                </Button>
              </div>
              <div className="flex items-center space-x-2">
                <Label htmlFor="auto-calculate" className="text-sm cursor-pointer">
                  {t("autoCalculate")}
                </Label>
                <input
                  id="auto-calculate"
                  type="checkbox"
                  checked={autoCalculate}
                  onChange={(e) => setAutoCalculate(e.target.checked)}
                  className="rounded border-gray-300 text-primary focus:ring-primary"
                />
              </div>
            </div>

            <Textarea
              ref={inputRef}
              placeholder={t("inputPlaceholder")}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              rows={5}
              className="input-modern"
            />
          </TabsContent>

          <TabsContent value="file" className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Button variant="outline" size="sm" onClick={clearInput}>
                  {t("clearInput")}
                </Button>
              </div>
              <div className="flex items-center space-x-2">
                <Label htmlFor="auto-calculate-file" className="text-sm cursor-pointer">
                  {t("autoCalculate")}
                </Label>
                <input
                  id="auto-calculate-file"
                  type="checkbox"
                  checked={autoCalculate}
                  onChange={(e) => setAutoCalculate(e.target.checked)}
                  className="rounded border-gray-300 text-primary focus:ring-primary"
                />
              </div>
            </div>

            <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />

            {!fileInfo ? (
              <div
                className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg p-8 text-center cursor-pointer hover:border-primary dark:hover:border-primary transition-colors"
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
                >
                  {t("uploadFile")}
                </Button>
              </div>
            ) : (
              <div className="border rounded-lg p-4">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-medium">{t("fileInfo")}</h3>
                  <Button variant="ghost" size="sm" onClick={clearInput} className="h-8 w-8 p-0">
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

                {fileCalculating && (
                  <div className="mt-4">
                    <div className="flex justify-between mb-1">
                      <span>{t("calculating")}</span>
                      <span>{fileProgress}%</span>
                    </div>
                    <Progress value={fileProgress} className="h-2" />
                  </div>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>

        <Tabs defaultValue="md5" value={algorithm} onValueChange={setAlgorithm}>
          <TabsList className="grid grid-cols-5 mb-6">
            <TabsTrigger value="md5">MD5</TabsTrigger>
            <TabsTrigger value="sha1">SHA1</TabsTrigger>
            <TabsTrigger value="sha2">SHA2</TabsTrigger>
            <TabsTrigger value="sha3">SHA3</TabsTrigger>
            <TabsTrigger value="crc32">CRC32</TabsTrigger>
          </TabsList>
        </Tabs>

        {!showAllResults && isCurrentAlgorithmConfigurable() && (
          <div className="mt-4 space-y-4">
            {getCurrentAlgorithmSizes().length > 0 && (
              <div>
                <Label className="block mb-2">Size</Label>
                <RadioGroup
                  value={size.toString()}
                  onValueChange={(value) => setSize(Number.parseInt(value))}
                  className="grid grid-cols-2 gap-2"
                >
                  {getCurrentAlgorithmSizes().map((s) => (
                    <div key={s} className="flex items-center space-x-2">
                      <RadioGroupItem value={s.toString()} id={`size-${s}`} />
                      <Label htmlFor={`size-${s}`} className="cursor-pointer">
                        {s}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>
            )}
          </div>
        )}

        <div className="flex flex-col space-y-2">
          <Label htmlFor="verify-hash">{t("verify")}</Label>
          <div className="flex space-x-2">
            <Input
              id="verify-hash"
              placeholder={t("verifyPlaceholder")}
              value={verifyHash}
              onChange={(e) => setVerifyHash(e.target.value)}
              className={`flex-1 ${
                verifyResult === null
                  ? ""
                  : verifyResult.isMatch
                    ? "border-green-500 focus:border-green-500 focus:ring-green-500"
                    : "border-red-500 focus:border-red-500 focus:ring-red-500"
              }`}
            />
            {verifyResult !== null && (
              <div
                className={`flex items-center px-3 rounded-md ${
                  verifyResult.isMatch
                    ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                    : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                }`}
              >
                {verifyResult.isMatch ? `${t("verifyMatch")} (${verifyResult.matchedAlgorithm})` : t("verifyNotMatch")}
              </div>
            )}
          </div>
        </div>

        <Button onClick={calculateHash} disabled={(!input && !fileInfo) || fileCalculating} className="w-full">
          {fileCalculating ? t("calculating") : t("calculate")}
        </Button>

        {/* 单个结果显示 */}
        {hashResult && !showAllResults && (
          <div className="mt-4">
            <h3 className="text-lg font-medium mb-4">{t("result")}:</h3>
            <div className="flex items-center justify-between bg-gray-100 dark:bg-gray-800 p-3 rounded-md">
              <div className="flex items-center space-x-4">
                <span className="font-medium min-w-24">{getCurrentAlgorithmDisplayName()}:</span>
                <span className="font-mono text-sm break-all">{hashResult}</span>
              </div>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" onClick={() => copyToClipboard(hashResult)}>
                      {copied["main"] ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{copied["main"] ? t("copied") : t("copy")}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        )}

        {/* 所有结果显示 */}
        {showAllResults && allHashResults.length > 0 && (
          <div className="mt-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">{t("allResults")}:</h3>
              {fileCalculating && (
                <Button variant="outline" size="sm" onClick={cancelCalculation}>
                  {t("cancel")}
                </Button>
              )}
            </div>
            <div className="space-y-2">
              {allHashResults.map((result) => (
                <div
                  key={result.algorithm}
                  className={`flex items-center justify-between p-3 rounded-md ${
                    result.status === "calculating"
                      ? "bg-blue-50 dark:bg-blue-900/20"
                      : result.status === "error"
                        ? "bg-red-50 dark:bg-red-900/20"
                        : "bg-gray-100 dark:bg-gray-800"
                  }`}
                >
                  <div className="flex items-center space-x-4">
                    <span className="font-medium min-w-24">{result.displayName}:</span>
                    {result.status === "pending" && <span className="text-gray-500 italic">待计算</span>}
                    {result.status === "calculating" && <span className="text-blue-500 italic">计算中...</span>}
                    {(result.status === "completed" || result.status === "error") && (
                      <span className="font-mono text-sm break-all">{result.value}</span>
                    )}
                  </div>
                  {result.status === "completed" && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => copyToClipboard(result.value, result.algorithm)}
                          >
                            {copied[result.algorithm] ? (
                              <Check className="h-4 w-4 text-green-500" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{copied[result.algorithm] ? t("copied") : t("copy")}</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
