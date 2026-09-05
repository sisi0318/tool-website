"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { ArrowRightLeft, Binary, Download, X } from "lucide-react"
import { UtilityWorkbench } from "@/components/tools/utility-workbench"
import { JsonTreeView } from "@/components/json-tree-view"
import { SendToMenu } from "@/components/tools/send-to-menu"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useTranslations } from "@/hooks/use-translations"
import { useObjectUrl } from "@/hooks/use-object-url"
import { bytesToBase64, bytesToHex } from "@/lib/binary"
import { BINARY_CODEC_LIMITS, BinaryCodecError, encodeBinaryJson, type BinaryCodecFormat, type BinaryJson } from "@/lib/binary-codecs"
import { processBinaryCodec, type BinaryCodecResult } from "@/lib/binary-codec-tools"

export default function BinaryCodecPage() {
  const t = useTranslations("binaryCodecTools")
  const [input, setInput] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [format, setFormat] = useState<BinaryCodecFormat>("msgpack")
  const [operation, setOperation] = useState<"encode" | "decode">("decode")
  const [encoding, setEncoding] = useState<"hex" | "base64">("hex")
  const [result, setResult] = useState<BinaryCodecResult | null>(null)
  const [error, setError] = useState("")
  const [running, setRunning] = useState(false)
  const version = useRef(0)
  const controller = useRef<AbortController | null>(null)
  const reset = () => { version.current++; controller.current?.abort(); setResult(null); setError(""); setRunning(false) }
  useEffect(() => () => { version.current++; controller.current?.abort() }, [])
  const run = async () => {
    reset()
    const current = version.current, abort = new AbortController()
    controller.current = abort; setRunning(true)
    try {
      await new Promise((resolve) => setTimeout(resolve, 0))
      const next = await processBinaryCodec(operation === "decode" && file ? file : input, { format, operation, encoding, signal: abort.signal })
      if (version.current === current && !abort.signal.aborted) setResult(next)
    } catch (cause) { if (version.current === current && !abort.signal.aborted) setError(cause instanceof BinaryCodecError ? t("errors." + cause.code) + (operation === "decode" ? ` · ${t("offset")} ${cause.offset}` : "") : t("failed")) }
    finally { if (version.current === current) setRunning(false) }
  }
  const outputFile = useMemo(() => result ? operation === "encode" ? result.file : new File([result.output], "decoded.json", { type: "application/json" }) : null, [result, operation])
  const url = useObjectUrl(outputFile)
  const sample = () => {
    reset(); setFile(null)
    const value: BinaryJson = { name: "Ada", id: { $bigint: "18446744073709551615" }, bytes: { $binary: "AP8BgA==" }, detail: format === "msgpack" ? { $msgpackExt: { type: 1, data: "AQID" } } : { $cborTag: { tag: "24", value: { $binary: "oWFhAQ==" } } } }
    if (operation === "encode") setInput(JSON.stringify(value, null, 2))
    else { const bytes = encodeBinaryJson(value, format); setInput(encoding === "hex" ? bytesToHex(bytes) : bytesToBase64(bytes)) }
  }
  const reverse = () => { if (!result) return; const previous = result; reset(); if (operation === "encode") { setFile(previous.file); setInput(""); setOperation("decode") } else { setFile(null); setInput(previous.output); setOperation("encode") } }
  const choice = (label: string, value: string, items: Array<[string, string]>, onChange: (value: string) => void) => <div className="space-y-2"><Label>{label}</Label><Select value={value} onValueChange={onChange}><SelectTrigger aria-label={label}><SelectValue /></SelectTrigger><SelectContent>{items.map(([key, name]) => <SelectItem key={key} value={key}>{name}</SelectItem>)}</SelectContent></Select></div>
  return <UtilityWorkbench title={t("title")} description={t("description")} icon={<Binary className="h-6 w-6" />} input={input} output={result?.output ?? ""} operation={operation} operations={[["decode", t("decode")], ["encode", t("encode")]].map(([value, label]) => ({ value, label }))} onInputChange={(value) => { reset(); setInput(value) }} onOperationChange={(value) => { reset(); setOperation(value as "encode" | "decode"); if (value === "encode") setFile(null) }} onRun={run} onClear={() => { reset(); setInput(""); setFile(null) }} onSample={sample} running={running} inputDisabled={file !== null && operation === "decode"} canRun={Boolean(operation === "decode" && file) || input.trim().length > 0} error={error} inputPlaceholder={operation === "encode" ? t("jsonPlaceholder") : t("binaryPlaceholder")} controls={<div className="space-y-4"><div className="grid gap-3 sm:grid-cols-2">{choice(t("format"), format, [["msgpack", "MessagePack"], ["cbor", "CBOR"]], (value) => { reset(); setFormat(value as BinaryCodecFormat) })}{choice(t("encoding"), encoding, [["hex", "Hex"], ["base64", "Base64"]], (value) => { reset(); setEncoding(value as "hex" | "base64") })}</div><p className="text-xs leading-relaxed text-md-on-surface-variant">{t("limits")}</p><details><summary className="cursor-pointer text-sm text-md-on-surface-variant">{t("extendedJson")}</summary><div className="mt-3 space-y-2 text-xs text-md-on-surface-variant"><p>{t("tagHelp")}</p><pre className="overflow-auto rounded-xl bg-md-surface-container-low p-3 font-mono leading-relaxed">{'{"$binary":"AP8="}\n{"$bigint":"18446744073709551615"}\n{"$number":"NaN"}\n{"$map":[[1,"number"],["1","text"]]}\n{"$msgpackExt":{"type":1,"data":"AQID"}}\n{"$cborTag":{"tag":"24","value":{"$binary":"oA=="}}}\n{"$cborSimple":32}\n{"$undefined":true}\n{"$object":{"$binary":"literal text"}}'}</pre><p>{t("reencodeHelp")}</p></div></details></div>} additionalInput={operation === "decode" && <div className="space-y-2"><Label htmlFor="binary-codec-file">{t("chooseFile")}</Label><Input id="binary-codec-file" type="file" accept=".msgpack,.mpk,.cbor,.bin" onChange={(event) => { const selected = event.target.files?.[0]; event.target.value = ""; if (selected) { reset(); setFile(null); if (selected.size > BINARY_CODEC_LIMITS.bytes) { setError(t("errors.limit")); return }; setFile(selected); setInput(""); if (/\.cbor$/i.test(selected.name)) setFormat("cbor"); else if (/\.(msgpack|mpk)$/i.test(selected.name)) setFormat("msgpack") } }} />{file && <div className="flex min-w-0 items-center gap-2 text-xs"><span className="min-w-0 flex-1 break-all font-mono">{file.name} · {file.size} B</span><Button variant="ghost" size="icon" aria-label={t("removeFile")} onClick={() => { reset(); setFile(null) }}><X /></Button></div>}</div>} result={result ? <div className="min-w-0 space-y-4"><div className="flex flex-wrap items-center justify-between gap-3"><span role="status" className="text-sm text-md-on-surface-variant">{result.byteLength} {t("bytes")}</span><div className="flex flex-wrap gap-2">{url && outputFile && <Button asChild variant="outline" size="sm"><a href={url} download={outputFile.name}><Download />{operation === "encode" ? t("downloadBinary") : t("downloadJson")}</a></Button>}<Button variant="outline" size="sm" onClick={reverse}><ArrowRightLeft />{t("reverse")}</Button></div></div>{operation === "encode" ? <><SendToMenu value={result.file} source={t("binaryFile")} /><pre className="max-h-96 overflow-auto whitespace-pre-wrap break-all rounded-xl bg-md-surface-container-low p-3 font-mono text-xs">{result.output.slice(0, 65536)}</pre><p className="text-xs text-md-on-surface-variant">{t("previewHelp")}</p></> : result.output.length <= 10_000_000 ? <JsonTreeView jsonText={result.output} /> : <><pre className="max-h-96 overflow-auto whitespace-pre-wrap break-all rounded-xl bg-md-surface-container-low p-3 font-mono text-xs">{result.output.slice(0, 65536)}</pre><p className="text-xs text-md-on-surface-variant">{t("previewHelp")}</p></>}</div> : undefined} />
}
