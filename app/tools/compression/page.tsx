"use client"

import { useState } from "react"
import { Archive, FileUp } from "lucide-react"

import { UtilityWorkbench } from "@/components/tools/utility-workbench"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useTranslations } from "@/hooks/use-translations"
import { bytesToBase64, transformCompression, type BinaryEncoding, type CompressionFormat, type CompressionOperation, type CompressionResult } from "@/lib/compression"

const SAMPLE = "Compression works best when text contains repeated text. ".repeat(8)

export default function CompressionPage() {
  const t = useTranslations("compression")
  const [input, setInput] = useState("")
  const [output, setOutput] = useState("")
  const [operation, setOperation] = useState<CompressionOperation>("compress")
  const [format, setFormat] = useState<CompressionFormat>("gzip")
  const [inputEncoding, setInputEncoding] = useState<BinaryEncoding>("text")
  const [outputEncoding, setOutputEncoding] = useState<BinaryEncoding>("base64")
  const [level, setLevel] = useState(6)
  const [filename, setFilename] = useState("data.txt")
  const [result, setResult] = useState<CompressionResult | null>(null)
  const [error, setError] = useState("")
  const [running, setRunning] = useState(false)

  const run = async () => {
    setRunning(true)
    try {
      const next = await transformCompression(input, { operation, format, inputEncoding, outputEncoding, level, filename })
      setResult(next)
      setOutput(next.output)
      setError("")
    } catch (cause) {
      setResult(null)
      setOutput("")
      setError(cause instanceof Error ? cause.message : t("failed"))
    } finally {
      setRunning(false)
    }
  }

  const changeOperation = (value: string) => {
    const next = value as CompressionOperation
    setOperation(next)
    setInputEncoding(next === "compress" ? "text" : "base64")
    setOutputEncoding(next === "compress" ? "base64" : "text")
    setOutput("")
    setResult(null)
  }

  const loadFile = async (file: File) => {
    setInput(bytesToBase64(new Uint8Array(await file.arrayBuffer())))
    setInputEncoding("base64")
    setFilename(file.name)
    setOutput("")
  }

  const selectControl = (label: string, value: string, onChange: (value: string) => void, items: Array<[string, string]>) => (
    <div>
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="mt-2 min-h-11"><SelectValue /></SelectTrigger>
        <SelectContent>{items.map(([itemValue, itemLabel]) => <SelectItem key={itemValue} value={itemValue}>{itemLabel}</SelectItem>)}</SelectContent>
      </Select>
    </div>
  )

  return (
    <UtilityWorkbench
      title={t("title")}
      description={t("description")}
      icon={<Archive className="h-6 w-6" />}
      input={input}
      output={output}
      operation={operation}
      operations={[
        { value: "compress", label: t("compress") },
        { value: "decompress", label: t("decompress") },
      ]}
      onInputChange={setInput}
      onOperationChange={changeOperation}
      onRun={run}
      onClear={() => { setInput(""); setOutput(""); setResult(null); setError("") }}
      onSample={() => { setInput(SAMPLE); setInputEncoding("text"); setOperation("compress") }}
      running={running}
      error={error}
      inputPlaceholder={operation === "compress" ? t("textPlaceholder") : t("encodedPlaceholder")}
      controls={(
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            {selectControl(t("format"), format, (value) => setFormat(value as CompressionFormat), [
              ["gzip", "GZip"], ["zlib", "Zlib"], ["deflate", "Deflate"], ["brotli", "Brotli"], ["zip", "ZIP"],
            ])}
            {selectControl(t("inputEncoding"), inputEncoding, (value) => setInputEncoding(value as BinaryEncoding), [["text", t("text")], ["base64", "Base64"], ["hex", "Hex"]])}
            {selectControl(t("outputEncoding"), outputEncoding, (value) => setOutputEncoding(value as BinaryEncoding), [["text", t("text")], ["base64", "Base64"], ["hex", "Hex"]])}
          </div>
          <div className="grid gap-3 sm:grid-cols-[1fr_9rem]">
            <div>
              <Label htmlFor="compression-filename">{t("filename")}</Label>
              <Input id="compression-filename" value={filename} onChange={(event) => setFilename(event.target.value)} className="mt-2 min-h-11" />
            </div>
            <div>
              <Label htmlFor="compression-level">{t("level")}</Label>
              <Input id="compression-level" type="number" min={0} max={11} value={level} onChange={(event) => setLevel(Math.max(0, Math.min(11, Number(event.target.value) || 0)))} className="mt-2 min-h-11" />
            </div>
          </div>
          <Button type="button" variant="outline" asChild className="min-h-11 gap-2">
            <label><FileUp className="h-4 w-4" />{t("chooseFile")}<input type="file" className="sr-only" onChange={(event) => event.target.files?.[0] && void loadFile(event.target.files[0])} /></label>
          </Button>
        </div>
      )}
      footer={result && (
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className="rounded-xl bg-[var(--md-sys-color-surface-container-low)] p-3"><strong className="block text-base">{result.inputBytes}</strong>{t("inputBytes")}</div>
          <div className="rounded-xl bg-[var(--md-sys-color-surface-container-low)] p-3"><strong className="block text-base">{result.outputBytes}</strong>{t("outputBytes")}</div>
          <div className="rounded-xl bg-[var(--md-sys-color-surface-container-low)] p-3"><strong className="block text-base">{(result.ratio * 100).toFixed(1)}%</strong>{t("ratio")}</div>
        </div>
      )}
    />
  )
}
