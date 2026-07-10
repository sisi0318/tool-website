"use client"

import { useState } from "react"
import { Binary, FileUp } from "lucide-react"

import { UtilityWorkbench } from "@/components/tools/utility-workbench"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useTranslations } from "@/hooks/use-translations"
import { bytesToBase64, type BinaryEncoding } from "@/lib/compression"
import { processHexBinary, type HexBinaryOperation, type HexBinaryResult } from "@/lib/hex-binary-tools"

const SAMPLE_PNG = "89504e470d0a1a0a0000000d49484452"

export default function HexBinaryPage() {
  const t = useTranslations("hexBinaryTools")
  const [input, setInput] = useState("")
  const [output, setOutput] = useState("")
  const [operation, setOperation] = useState<HexBinaryOperation>("hexdump")
  const [encoding, setEncoding] = useState<BinaryEncoding>("text")
  const [width, setWidth] = useState("16")
  const [result, setResult] = useState<HexBinaryResult | null>(null)
  const [error, setError] = useState("")

  const run = () => {
    try {
      const next = processHexBinary(input, operation, encoding, Number(width))
      setResult(next)
      setOutput(next.output)
      setError("")
    } catch (cause) {
      setResult(null)
      setOutput("")
      setError(cause instanceof Error ? cause.message : t("failed"))
    }
  }

  const loadFile = async (file: File) => {
    setInput(bytesToBase64(new Uint8Array(await file.arrayBuffer())))
    setEncoding("base64")
    setOperation("hexdump")
    setOutput("")
    setResult(null)
  }

  return (
    <UtilityWorkbench
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
      onOperationChange={(value) => { setOperation(value as HexBinaryOperation); setOutput("") }}
      onRun={run}
      onClear={() => { setInput(""); setOutput(""); setResult(null); setError("") }}
      onSample={() => { setInput(SAMPLE_PNG); setEncoding("hex"); setOperation("signature"); setOutput(""); setResult(null) }}
      error={error}
      inputPlaceholder={encoding === "text" ? t("textPlaceholder") : t("encodedPlaceholder")}
      controls={(
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>{t("inputEncoding")}</Label>
              <Select value={encoding} onValueChange={(value) => setEncoding(value as BinaryEncoding)}>
                <SelectTrigger className="mt-2 min-h-11"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="text">{t("text")}</SelectItem><SelectItem value="hex">Hex</SelectItem><SelectItem value="base64">Base64</SelectItem></SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t("rowWidth")}</Label>
              <Select value={width} onValueChange={setWidth} disabled={operation !== "hexdump"}>
                <SelectTrigger className="mt-2 min-h-11"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="8">8</SelectItem><SelectItem value="16">16</SelectItem><SelectItem value="32">32</SelectItem></SelectContent>
              </Select>
            </div>
          </div>
          <Button type="button" variant="outline" asChild className="min-h-11 gap-2">
            <label><FileUp className="h-4 w-4" />{t("chooseFile")}<input type="file" className="sr-only" onChange={(event) => event.target.files?.[0] && void loadFile(event.target.files[0])} /></label>
          </Button>
        </div>
      )}
      footer={result && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full bg-[var(--md-sys-color-surface-container-high)] px-3 py-1.5">{result.byteLength} {t("bytes")}</span>
          <span className="rounded-full bg-[var(--md-sys-color-primary-container)] px-3 py-1.5 text-[var(--md-sys-color-on-primary-container)]">{result.signature.name}</span>
        </div>
      )}
    />
  )
}
