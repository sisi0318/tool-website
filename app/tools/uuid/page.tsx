"use client"

import type React from "react"
import { useState, useCallback, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { useTranslations } from "@/hooks/use-translations"
import { Copy, Check, RefreshCw, Trash2 } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { generateUuidV1, generateUuidV4 } from "@/lib/uuid-tools"

// 空 UUID
const NIL_UUID = "00000000-0000-0000-0000-000000000000"

export default function UUIDPage() {
  const t = useTranslations("uuid")

  const [version, setVersion] = useState<"v4" | "v1" | "nil">("v4")
  const [count, setCount] = useState(1)
  const [uppercase, setUppercase] = useState(false)
  const [withHyphens, setWithHyphens] = useState(true)
  const [withBraces, setWithBraces] = useState(false)
  const [withQuotes, setWithQuotes] = useState(false)
  const [generatedUUIDs, setGeneratedUUIDs] = useState<string[]>([])
  const [copied, setCopied] = useState<{ [key: string]: boolean }>({})

  const copyTimeoutRef = useRef<{ [key: string]: NodeJS.Timeout | null }>({})

  // 格式化 UUID
  const formatUUID = useCallback(
    (uuid: string): string => {
      let result = uuid

      if (!withHyphens) {
        result = result.replace(/-/g, "")
      }

      if (uppercase) {
        result = result.toUpperCase()
      }

      if (withBraces) {
        result = `{${result}}`
      }

      if (withQuotes) {
        result = `"${result}"`
      }

      return result
    },
    [uppercase, withHyphens, withBraces, withQuotes]
  )

  // 生成 UUID
  const generateUUIDs = useCallback(() => {
    const uuids: string[] = []
    const actualCount = Math.min(Math.max(1, count), 100) // 限制 1-100

    for (let i = 0; i < actualCount; i++) {
      let uuid: string
      switch (version) {
        case "v1":
          uuid = generateUuidV1()
          break
        case "nil":
          uuid = NIL_UUID
          break
        case "v4":
        default:
          uuid = generateUuidV4()
          break
      }
      uuids.push(formatUUID(uuid))
    }

    setGeneratedUUIDs(uuids)
  }, [version, count, formatUUID])

  useEffect(() => {
    setGeneratedUUIDs([generateUuidV4()])
  }, [])

  // 复制单个 UUID
  const copyToClipboard = useCallback((text: string, key: string) => {
    navigator.clipboard.writeText(text).then(() => {
      if (copyTimeoutRef.current[key]) {
        clearTimeout(copyTimeoutRef.current[key]!)
      }

      setCopied((prev) => ({ ...prev, [key]: true }))

      copyTimeoutRef.current[key] = setTimeout(() => {
        setCopied((prev) => ({ ...prev, [key]: false }))
      }, 2000)
    })
  }, [])

  // 复制所有 UUID
  const copyAllUUIDs = useCallback(() => {
    const text = generatedUUIDs.join("\n")
    copyToClipboard(text, "all")
  }, [generatedUUIDs, copyToClipboard])

  // 清空结果
  const clearResults = useCallback(() => {
    setGeneratedUUIDs([])
    setCopied({})
  }, [])

  // 处理数量输入
  const handleCountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value) || 1
    setCount(Math.min(Math.max(1, value), 100))
  }

  return (
    <div className="container mx-auto px-4 py-4 max-w-3xl">
      <h2 className="text-2xl font-bold text-center mb-6">{t("title")}</h2>

      <div className="space-y-6">
        {/* UUID 版本选择 */}
        <div className="space-y-3">
          <Label>{t("version")}</Label>
          <RadioGroup
            value={version}
            onValueChange={(value) => setVersion(value as "v4" | "v1" | "nil")}
            className="flex flex-wrap gap-4"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="v4" id="v4" />
              <Label htmlFor="v4" className="cursor-pointer">
                UUID v4 ({t("random")})
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="v1" id="v1" />
              <Label htmlFor="v1" className="cursor-pointer">
                UUID v1 ({t("timeBased")})
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="nil" id="nil" />
              <Label htmlFor="nil" className="cursor-pointer">
                Nil UUID
              </Label>
            </div>
          </RadioGroup>
        </div>

        {/* 生成数量 */}
        <div className="space-y-2">
          <Label htmlFor="count">{t("count")} (1-100)</Label>
          <Input
            id="count"
            type="number"
            min={1}
            max={100}
            value={count}
            onChange={handleCountChange}
            className="w-32"
          />
        </div>

        {/* 格式选项 */}
        <div className="space-y-4">
          <Label>{t("formatOptions")}</Label>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center space-x-2">
              <Switch
                id="uppercase"
                checked={uppercase}
                onCheckedChange={setUppercase}
              />
              <Label htmlFor="uppercase" className="cursor-pointer">
                {t("uppercase")}
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="hyphens"
                checked={withHyphens}
                onCheckedChange={setWithHyphens}
              />
              <Label htmlFor="hyphens" className="cursor-pointer">
                {t("withHyphens")}
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="braces"
                checked={withBraces}
                onCheckedChange={setWithBraces}
              />
              <Label htmlFor="braces" className="cursor-pointer">
                {t("withBraces")}
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="quotes"
                checked={withQuotes}
                onCheckedChange={setWithQuotes}
              />
              <Label htmlFor="quotes" className="cursor-pointer">
                {t("withQuotes")}
              </Label>
            </div>
          </div>
        </div>

        {/* 生成按钮 */}
        <div className="grid grid-cols-2 gap-2 sm:flex sm:gap-3">
          <Button onClick={generateUUIDs} className="col-span-2 w-full sm:flex-1">
            <RefreshCw className="h-4 w-4 mr-2" />
            {t("generate")}
          </Button>
          {generatedUUIDs.length > 0 && (
            <>
              <Button variant="outline" onClick={copyAllUUIDs} className="w-full sm:w-auto">
                <Copy className="h-4 w-4 mr-2" />
                {copied["all"] ? t("copied") : t("copyAll")}
              </Button>
              <Button variant="outline" onClick={clearResults} className="w-full sm:w-auto">
                <Trash2 className="h-4 w-4 mr-2" />
                {t("clear")}
              </Button>
            </>
          )}
        </div>

        {/* 结果显示 */}
        {generatedUUIDs.length > 0 && (
          <div className="space-y-3">
            <Label>{t("result")} ({generatedUUIDs.length})</Label>
            
            {generatedUUIDs.length === 1 ? (
              // 单个 UUID 显示
              <div className="flex items-center justify-between bg-gray-100 dark:bg-gray-800 p-4 rounded-lg">
                <code className="font-mono text-lg break-all flex-1">
                  {generatedUUIDs[0]}
                </code>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => copyToClipboard(generatedUUIDs[0], "0")}
                        className="ml-2 flex-shrink-0"
                      >
                        {copied["0"] ? (
                          <Check className="h-4 w-4 text-green-500" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {copied["0"] ? t("copied") : t("copy")}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            ) : (
              // 多个 UUID 显示
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {generatedUUIDs.map((uuid, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between bg-gray-100 dark:bg-gray-800 p-3 rounded-md group"
                  >
                    <code className="font-mono text-sm break-all flex-1">
                      {uuid}
                    </code>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => copyToClipboard(uuid, index.toString())}
                            className="ml-2 flex-shrink-0 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
                          >
                            {copied[index.toString()] ? (
                              <Check className="h-4 w-4 text-green-500" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          {copied[index.toString()] ? t("copied") : t("copy")}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                ))}
              </div>
            )}

            {/* 批量文本区域 */}
            {generatedUUIDs.length > 1 && (
              <div className="mt-4">
                <Label className="mb-2 block">{t("batchOutput")}</Label>
                <Textarea
                  value={generatedUUIDs.join("\n")}
                  readOnly
                  rows={Math.min(generatedUUIDs.length, 10)}
                  className="font-mono text-sm"
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
