"use client"

import { useState } from "react"
import { takeInputFiles } from "@/lib/file-input"
import { Binary, Download, FileUp, X } from "lucide-react"

import { UtilityWorkbench } from "@/components/tools/utility-workbench"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useTranslations } from "@/hooks/use-translations"
import { zhHexBinaryTools } from "@/lib/translations/zh-namespaces/hexBinaryTools"
import { decodeBinaryInput, type BinaryEncoding } from "@/lib/compression"
import {
  FILE_SIZE_LIMITS,
  formatFileSizeLimit,
  isFileWithinLimit,
} from "@/lib/file-limits"
import { HEX_PREVIEW_BYTES, hexBinaryOutputBlob, processHexBinaryBytes, type HexBinaryOperation, type HexBinaryResult } from "@/lib/hex-binary-tools"
import { downloadBlob } from "@/lib/object-url"
import { fileBaseName } from "@/lib/output-name"
import { formatBinarySize } from "@/components/tools/binary-file-result"
import { useToolDraft } from "@/hooks/use-tool-draft"

const SAMPLE_PNG = "89504e470d0a1a0a0000000d49484452"

export default function HexBinaryPage() {
  const t = useTranslations("hexBinaryTools", zhHexBinaryTools)
  const [input, setInput] = useToolDraft("hex-binary")
  const [output, setOutput] = useState("")
  const [operation, setOperation] = useState<HexBinaryOperation>("hexdump")
  const [encoding, setEncoding] = useState<BinaryEncoding>("text")
  const [width, setWidth] = useState("16")
  const [result, setResult] = useState<HexBinaryResult | null>(null)
  const [error, setError] = useState("")
  // 选中的文件原样保留，不再先转成 Base64 塞进输入框（10 MB 的文件是约 1400 万字符）
  const [file, setFile] = useState<File | null>(null)
  // 输出只放前 64 KB 的结果；完整结果按需生成、下载
  const [fullBytes, setFullBytes] = useState<Uint8Array | null>(null)

  const reset = () => { setOutput(""); setResult(null); setFullBytes(null); setError("") }

  const run = async () => {
    try {
      const bytes = file ? new Uint8Array(await file.arrayBuffer()) : decodeBinaryInput(input, encoding)
      const next = processHexBinaryBytes(bytes, operation, Number(width))
      setFullBytes(next.truncated ? bytes : null)
      const localizedSignature = {
        ...next.signature,
        name: t(`signatures.${next.signature.id}`),
      }
      setResult({ ...next, signature: localizedSignature })
      setOutput(operation === "signature" ? JSON.stringify(localizedSignature, null, 2) : next.output)
      setError("")
    } catch {
      setResult(null)
      setOutput("")
      setFullBytes(null)
      setError(t("failed"))
    }
  }

  const downloadFull = () => {
    if (!fullBytes || operation === "signature") return
    const suffix = operation === "hexdump" ? "hexdump.txt" : operation === "to-hex" ? "hex.txt" : operation === "to-base64" ? "base64.txt" : "txt"
    downloadBlob(hexBinaryOutputBlob(fullBytes, operation, Number(width)), `${fileBaseName(file?.name, "binary")}.${suffix}`)
  }

  const loadFile = async (file: File) => {
    if (!isFileWithinLimit(file, FILE_SIZE_LIMITS.binaryTool)) {
      setError(t("fileTooLarge").replace(
        "{size}",
        formatFileSizeLimit(FILE_SIZE_LIMITS.binaryTool),
      ))
      return
    }

    setFile(file)
    setInput("")
    setOperation("hexdump")
    reset()
  }

  return (
    <UtilityWorkbench onIncomingFile={(file) => void loadFile(file)}
      title={t("title")}
      description={t("description")}
      icon={<Binary className="h-6 w-6" />}
      input={input}
      output={output}
      operation={operation}
      operations={[
        { value: "hexdump", label: t("hexdump") }, { value: "signature", label: t("signature") },
        { value: "to-text", label: t("toText") }, { value: "to-hex", label: t("toHex") }, { value: "to-base64", label: t("toBase64") },
      ]}
      onInputChange={setInput}
      onOperationChange={(value) => { setOperation(value as HexBinaryOperation); setOutput(""); setFullBytes(null) }}
      onRun={run}
      onClear={() => { setInput(""); setFile(null); reset() }}
      onSample={() => { setFile(null); setInput(SAMPLE_PNG); setEncoding("hex"); setOperation("signature"); reset() }}
      inputDisabled={file !== null}
      canRun={file !== null || input.trim().length > 0}
      additionalInput={file && (
        <div className="flex min-w-0 items-center gap-2 rounded-xl bg-[var(--md-sys-color-surface-container-high)] px-3 py-2 text-xs">
          <span className="min-w-0 flex-1 break-all font-mono">{file.name} · {formatBinarySize(file.size)}</span>
          <Button type="button" variant="ghost" size="icon" aria-label={t("removeFile")} onClick={() => { setFile(null); reset() }}><X className="h-4 w-4" /></Button>
        </div>
      )}
      error={error}
      inputPlaceholder={encoding === "text" ? t("textPlaceholder") : t("encodedPlaceholder")}
      controls={(
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{t("inputEncoding")}</Label>
              <Select value={encoding} onValueChange={(value) => setEncoding(value as BinaryEncoding)}>
                <SelectTrigger className="mt-2 min-h-11" aria-label={t("inputEncoding")}><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="text">{t("text")}</SelectItem><SelectItem value="hex">Hex</SelectItem><SelectItem value="base64">Base64</SelectItem></SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t("rowWidth")}</Label>
              <Select value={width} onValueChange={setWidth} disabled={operation !== "hexdump"}>
                <SelectTrigger className="mt-2 min-h-11" aria-label={t("rowWidth")}><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="8">8</SelectItem><SelectItem value="16">16</SelectItem><SelectItem value="32">32</SelectItem></SelectContent>
              </Select>
            </div>
          </div>
          <Button type="button" variant="outline" asChild className="min-h-11 gap-2">
            <label><FileUp className="h-4 w-4" />{t("chooseFile")}<input type="file" className="sr-only" onChange={(event) => { const [file] = takeInputFiles(event); if (file) void loadFile(file) }} /></label>
          </Button>
        </div>
      )}
      footer={result && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full bg-[var(--md-sys-color-surface-container-high)] px-3 py-1.5">{result.byteLength} {t("bytes")}</span>
          <span className="rounded-full bg-[var(--md-sys-color-primary-container)] px-3 py-1.5 text-[var(--md-sys-color-on-primary-container)]">{result.signature.name}</span>
          {fullBytes && (
            <>
              <span className="text-[var(--md-sys-color-on-surface-variant)]">{t("previewTruncated").replace("{size}", formatBinarySize(HEX_PREVIEW_BYTES))}</span>
              <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5" onClick={downloadFull}><Download className="h-4 w-4" />{t("downloadFull")}</Button>
            </>
          )}
        </div>
      )}
    />
  )
}
