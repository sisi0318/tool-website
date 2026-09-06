"use client"

import { useEffect, useRef, useState } from "react"
import { FileImage, Loader2, Play, Upload, Workflow } from "lucide-react"
import { type JourneyTemplate, validateTemplateImage } from "@/lib/journey/templates"
import { useTranslations } from "@/hooks/use-translations"
import { useObjectUrl } from "@/hooks/use-object-url"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

export interface TemplateRunProgress { current: number; total: number; tool: string }
export function TemplateStage({ template, starting, progress, hasDraft, onStart, onCancel, onExit, onOpenTemplates }: {
  template: JourneyTemplate; starting: boolean; progress: TemplateRunProgress | null; hasDraft: boolean
  onStart: (value: unknown) => void; onCancel: () => void; onExit: () => void; onOpenTemplates: () => void
}) {
  const t = useTranslations("workflowTemplates"), ot = useTranslations("ocrTools")
  const [text, setText] = useState(template.sampleText ?? ""), [file, setFile] = useState<File | null>(null), [loading, setLoading] = useState(false), [notice, setNotice] = useState("")
  const input = useRef<HTMLInputElement>(null), version = useRef(0), preview = useObjectUrl(file), busy = starting || loading
  useEffect(() => () => { version.current++ }, [])
  const load = async (incoming: File | Promise<File>) => {
    const ticket = ++version.current; setLoading(true); setNotice(""); setFile(null)
    try {
      const next = await incoming
      if (template.input === "image") { await validateTemplateImage(next); if (ticket === version.current) setFile(next) }
      else {
        if (!next.size || next.size > 4 * 1024 * 1024) throw new Error("textLimit")
        const value = new TextDecoder("utf-8", { fatal: true }).decode(await next.arrayBuffer()).replace(/^\ufeff/, "")
        if (value.length > (template.maxChars ?? 1_000_000)) throw new Error("textLimit")
        if (ticket === version.current) setText(value)
      }
    } catch { if (ticket === version.current) setNotice(template.input === "image" ? t("imageLimit") : t("textLimit").replace("{count}", String(template.maxChars))) }
    finally { if (ticket === version.current) setLoading(false) }
  }
  const sample = async () => {
    if (template.input === "text") { setText(template.sampleText ?? ""); setNotice(""); return }
    const create = template.id === "scan-text" ? import("@/lib/ocr-samples").then(module => module.createOcrSample("document")) : import("@/lib/image-diff").then(module => module.createDiffSamples()).then(files => files[0])
    await load(create)
  }
  return <div className="mx-auto max-w-3xl space-y-4 px-4 pb-24 pt-6">
    <div className="flex flex-wrap items-center gap-2"><Button variant="ghost" disabled={busy} onClick={onExit}>{t(hasDraft ? "restore" : "back")}</Button><Button variant="outline" disabled={busy} onClick={onOpenTemplates}><Workflow />{t("change")}</Button></div>
    <section className="space-y-4 rounded-3xl border border-md-outline-variant bg-md-surface-container-lowest p-5 sm:p-7">
      <header><p className="text-xs font-medium text-md-primary">{t("title")}</p><h1 className="mt-2 text-2xl font-semibold">{t(`${template.id}_title`)}</h1><p className="mt-2 text-sm leading-6 text-md-on-surface-variant">{t(`${template.id}_description`)}</p></header>
      <ol className="space-y-2">{template.steps.map((step, index) => <li key={index} className={`flex items-center gap-3 rounded-xl p-3 text-sm ${starting && progress?.current === index + 1 ? "bg-md-primary-container text-md-on-primary-container" : "bg-md-surface-container-low"}`}><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-md-surface-container-high text-xs">{index + 1}</span><span>{t(`${template.id}_step${index + 1}`)}</span></li>)}</ol>
      <p className="text-xs leading-5 text-md-on-surface-variant">{t(`${template.id}_hint`)}</p>
      <div onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); if (!busy && event.dataTransfer.files[0]) void load(event.dataTransfer.files[0]) }} onPaste={event => { if (!busy && template.input === "image" && event.clipboardData.files[0]) { event.preventDefault(); void load(event.clipboardData.files[0]) } }}>
        {template.input === "text" ? <Textarea aria-label={t("inputText")} value={text} rows={7} disabled={busy} onChange={event => { if (event.target.value.length > (template.maxChars ?? 1_000_000)) { setNotice(t("textLimit").replace("{count}", String(template.maxChars))); return }; setText(event.target.value); setNotice("") }} className="rounded-2xl font-mono text-sm" /> : <div className="flex min-h-48 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-md-outline-variant p-5">{file && preview ? <><img src={preview} alt={t("imagePreview")} className="max-h-60 max-w-full rounded-lg object-contain" /><p className="break-all text-xs text-md-on-surface-variant">{file.name} · {(file.size / 1048576).toFixed(2)} MB</p></> : <><FileImage className="h-10 w-10 text-md-primary" /><p className="text-sm text-md-on-surface-variant">{t("dropImage")}</p></>}</div>}
        <div className="mt-3 flex flex-wrap gap-2"><Button variant="outline" disabled={busy} onClick={() => input.current?.click()}><Upload />{t(template.input === "image" ? "chooseImage" : "chooseText")}</Button><Button variant="ghost" disabled={busy} onClick={() => void sample()}>{t("sample")}</Button></div>
        <input ref={input} type="file" className="hidden" aria-label={t(template.input === "image" ? "chooseImage" : "chooseText")} accept={template.input === "image" ? "image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp" : ".txt,.csv,.tsv,.json,.yaml,.yml,.log,text/*,application/json"} onChange={event => { if (!busy && event.target.files?.[0]) void load(event.target.files[0]); event.target.value = "" }} />
      </div>
      {template.id === "scan-text" && <p className="text-xs leading-5 text-md-on-surface-variant">{ot("downloadHint")}</p>}
      {notice && <p role="alert" className="text-sm text-md-error">{notice}</p>}{hasDraft && <p className="text-xs leading-5 text-md-on-surface-variant">{t("draftHint")}</p>}
      <div className="flex flex-wrap items-center gap-3"><Button disabled={busy || (template.input === "image" ? !file : !text.trim())} onClick={() => onStart(template.input === "image" ? file : text)}><Play />{t("run")}</Button>{busy && <p role="status" className="flex items-center gap-2 text-sm"><Loader2 className="h-4 w-4 animate-spin" />{loading ? t("reading") : t("progress").replace("{current}", String(progress?.current ?? 1)).replace("{total}", String(template.steps.length))}</p>}{starting && <Button variant="outline" onClick={onCancel}>{t("cancel")}</Button>}</div>
      <p className="text-xs leading-5 text-md-on-surface-variant">{t("resultHint")}</p>
    </section>
  </div>
}
