"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Archive, ArrowUp, ChevronLeft, ChevronRight, Eye, File as FileIcon, FilePlus2, Folder, FolderOpen, Loader2, PackageOpen, Trash2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { BinaryFileDownload, BinaryFileResult, formatBinarySize } from "@/components/tools/binary-file-result"
import { useBinaryFileTask } from "@/hooks/use-binary-file-task"
import { useTranslations } from "@/hooks/use-translations"
import { BinaryFileError, MAX_BINARY_FILE_BYTES, MAX_EXPANDED_BYTES, transformFileBytes, type FileCompressionFormat } from "@/lib/compression-files"
import { browseZipFolder, createZip, extractZipEntries, extractZipEntry, inspectZip, MAX_ZIP_ENTRIES, type ZipArchive, type ZipNameEncoding, type ZipSource } from "@/lib/zip-tools"
import { createBinaryFile } from "@/lib/file-signature"
import { createClientId } from "@/lib/client-id"


const PAGE_SIZE = 50
function Choice({ label, value, onChange, items, disabled = false }: { label: string; value: string; onChange: (value: string) => void; items: Array<[string, string]>; disabled?: boolean }) {
  return <div className="min-w-0 space-y-1.5"><Label>{label}</Label><Select value={value} onValueChange={onChange} disabled={disabled}><SelectTrigger aria-label={label} className="rounded-xl border-md-outline-variant bg-md-surface"><SelectValue /></SelectTrigger><SelectContent>{items.map(([id, name]) => <SelectItem value={id} key={id}>{name}</SelectItem>)}</SelectContent></Select></div>
}

function Picker({ label, onFiles, disabled = false, multiple = false, directory = false, accept }: { label: string; onFiles: (files: File[]) => void; disabled?: boolean; multiple?: boolean; directory?: boolean; accept?: string }) {
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => { if (directory) input.current?.setAttribute("webkitdirectory", "") }, [directory])
  return <><Button type="button" variant="outline" disabled={disabled} onClick={() => input.current?.click()}>{directory ? <FolderOpen /> : <FilePlus2 />}{label}</Button><input ref={input} type="file" className="hidden" multiple={multiple || directory} accept={accept} onChange={(event) => { const files = Array.from(event.target.files ?? []); event.target.value = ""; if (files.length) onFiles(files) }} /></>
}

function TaskStatus({ task }: { task: ReturnType<typeof useBinaryFileTask> }) {
  const t = useTranslations("compressionFiles")
  return <>{task.running && <div role="status" className="flex items-center gap-2 text-sm text-md-on-surface-variant"><Loader2 className="h-4 w-4 animate-spin" />{task.progress || t("processing")}<Button variant="ghost" size="sm" onClick={task.cancel}><X />{t("cancel")}</Button></div>}{task.error && <div role="alert" className="break-all rounded-xl bg-md-error-container p-3 text-sm text-md-on-error-container">{task.error}</div>}</>
}

function Pager({ page, count, onPage }: { page: number; count: number; onPage: (page: number) => void }) {
  const t = useTranslations("compressionFiles")
  const pages = Math.max(1, Math.ceil(count / PAGE_SIZE))
  return pages > 1 ? <div className="flex items-center justify-end gap-2 text-xs text-md-on-surface-variant"><Button variant="ghost" size="icon" aria-label={t("previousPage")} disabled={page === 0} onClick={() => onPage(page - 1)}><ChevronLeft /></Button><span>{page + 1} / {pages}</span><Button variant="ghost" size="icon" aria-label={t("nextPage")} disabled={page + 1 >= pages} onClick={() => onPage(page + 1)}><ChevronRight /></Button></div> : null
}

function ZipBrowser() {
  const t = useTranslations("compressionFiles")
  const task = useBinaryFileTask()
  const [source, setSource] = useState<File | null>(null)
  const [archive, setArchive] = useState<ZipArchive | null>(null)
  const [encoding, setEncoding] = useState<ZipNameEncoding>("auto")
  const [folder, setFolder] = useState("")
  const [query, setQuery] = useState("")
  const [selected, setSelected] = useState(new Set<number>())
  const [page, setPage] = useState(0)
  const [extracted, setExtracted] = useState<Array<{ id: number; path: string; file: File }>>([])
  const [extractedPage, setExtractedPage] = useState(0)
  const [preview, setPreview] = useState<{ file: File; path: string } | null>(null)
  const [bundle, setBundle] = useState<File | null>(null)
  const rows = useMemo(() => archive ? browseZipFolder(archive.entries, folder, query) : [], [archive, folder, query])
  const allowed = useMemo(() => new Set(archive?.entries.filter((entry) => !entry.directory && !entry.blocked).map((entry) => entry.id) ?? []), [archive])
  const visibleIds = rows.flatMap((row) => row.ids).filter((id) => allowed.has(id))
  const isChecked = (ids: number[]) => { const values = ids.filter((id) => allowed.has(id)); const count = values.filter((id) => selected.has(id)).length; return count === 0 ? false : count === values.length ? true : "indeterminate" as const }
  const toggle = (ids: number[], checked: boolean) => { setBundle(null); setSelected((previous) => { const next = new Set(previous); ids.filter((id) => allowed.has(id)).forEach((id) => checked ? next.add(id) : next.delete(id)); return next }) }
  const enter = (path: string) => { setFolder(path); setQuery(""); setPage(0) }

  const load = (file: File, nameEncoding = encoding) => {
    setSource(file); setArchive(null); setExtracted([]); setPreview(null); setBundle(null); setSelected(new Set()); enter("")
    void task.run(async () => { if (file.size > MAX_BINARY_FILE_BYTES) throw new BinaryFileError("inputLimit"); return inspectZip(new Uint8Array(await file.arrayBuffer()), nameEncoding) }, setArchive)
  }
  const viewEntry = (id: number) => {
    if (!archive) return
    const cached = extracted.find((item) => item.id === id)
    if (cached) { setPreview(cached); return }
    const entry = archive.entries.find((entry) => entry.id === id)!
    setPreview(null)
    void task.run(async (signal) => createBinaryFile(await extractZipEntry(archive, id, signal), entry.path, entry.modifiedAt), (file) => setPreview({ file, path: entry.path }))
  }
  const extract = (asZip: boolean) => {
    if (!archive || !selected.size) return
    const ids = [...selected]
    setExtractedPage(0)
    setBundle(null); setPreview(null); setExtracted([])
    void task.run(async (signal, report) => {
      const files = await extractZipEntries(archive, ids, signal, (count) => report(t("extracting") + " " + count + " / " + ids.length))
      if (asZip) return { bundle: createBinaryFile(await createZip(files, { level: 0, signal }), "selected-files.zip"), files: [] }
      return { bundle: null, files: files.map((item, index) => ({ id: ids[index], path: item.name, file: createBinaryFile(item.data, item.name, item.modifiedAt) })) }
    }, (result) => { setBundle(result.bundle); setExtracted(result.files); if (result.files[0]) setPreview(result.files[0]) })
  }
  const sample = () => {
    setSource(null); setArchive(null); setExtracted([]); setPreview(null); setBundle(null); setSelected(new Set()); setEncoding("auto"); enter("")
    void task.run(async () => {
      const bytes = await createZip([{ name: "notes/hello.txt", data: new TextEncoder().encode("Hello ZIP · 你好\n") }, { name: "data.json", data: new TextEncoder().encode('{"local":true,"count":2}') }, { name: "empty/", data: new Uint8Array() }])
      return { file: createBinaryFile(bytes, "example.zip"), archive: inspectZip(bytes) }
    }, (result) => { setSource(result.file); setArchive(result.archive) })
  }

  return <div className="space-y-4">
    <Button variant="ghost" size="sm" disabled={task.running} onClick={sample}>{t("exampleZip")}</Button>
    <div className="flex flex-wrap items-center gap-3 rounded-xl border-2 border-dashed border-md-outline-variant bg-md-surface-container-low p-5" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); if (!task.running && event.dataTransfer.files[0]) load(event.dataTransfer.files[0]) }}>
      <PackageOpen className="h-7 w-7 text-md-primary" /><div className="min-w-0 flex-1"><p className="break-all text-sm font-medium">{source?.name || t("dropZip")}</p><p className="text-xs text-md-on-surface-variant">{t("zipLimit")}</p></div><Picker label={t("chooseZip")} accept=".zip,.jar,.apk,.docx,.xlsx,.pptx,application/zip" disabled={task.running} onFiles={(files) => load(files[0])} />
    </div>
    <div className="flex flex-wrap items-end gap-3"><div className="w-56"><Choice label={t("nameEncoding")} value={encoding} disabled={task.running} onChange={(value) => { setEncoding(value as ZipNameEncoding); if (source) load(source, value as ZipNameEncoding) }} items={[["auto", t("autoNames")], ["utf-8", "UTF-8"], ["cp437", "CP437"], ["gb18030", "GB18030 / GBK"]]} /></div>{source && <Button variant="ghost" disabled={task.running} onClick={() => { setSource(null); setArchive(null); setExtracted([]); setPreview(null); setBundle(null); task.clearError() }}><Trash2 />{t("clear")}</Button>}</div>
    <TaskStatus task={task} />
    {archive && <>
      <p className="text-sm text-md-on-surface-variant">{archive.entries.length} {t("entries")} · {t("archiveSize")} {formatBinarySize(archive.bytes.length)} · {t("unpackedSize")} {formatBinarySize(archive.totalBytes)}</p>
      <div className="flex flex-wrap items-center gap-2"><Button variant="outline" size="sm" onClick={() => enter("")}><FolderOpen />{t("rootFolder")}</Button>{folder && <Button variant="ghost" size="sm" onClick={() => enter(folder.slice(0, folder.slice(0, -1).lastIndexOf("/") + 1))}><ArrowUp />{t("parent")}</Button>}<code className="min-w-0 flex-1 break-all text-xs text-md-on-surface-variant">{folder || "/"}</code><Input aria-label={t("searchFiles")} placeholder={t("searchFiles")} value={query} onChange={(event) => { setQuery(event.target.value); setPage(0) }} className="h-9 w-full sm:w-56" /></div>
      <div className="flex flex-wrap items-center gap-2"><label className="mr-auto flex items-center gap-2 text-sm"><Checkbox aria-label={t("selectScope")} checked={isChecked(visibleIds)} disabled={task.running || !visibleIds.length} onCheckedChange={(checked) => toggle(visibleIds, checked === true)} />{t("selectScope")} · {selected.size} {t("selected")}</label><Button size="sm" disabled={task.running || !selected.size} onClick={() => extract(false)}><PackageOpen />{t("extractSelected")}</Button><Button size="sm" variant="outline" disabled={task.running || !selected.size} onClick={() => extract(true)}><Archive />{t("bundleSelected")}</Button></div>
      <div className="overflow-x-auto rounded-xl border border-md-outline-variant"><table className="w-full min-w-[30rem] text-left text-sm"><thead className="bg-md-surface-container"><tr><th className="w-10 p-3"><span className="sr-only">{t("selected")}</span></th><th className="p-3">{t("path")}</th><th className="whitespace-nowrap p-3">{t("unpackedSize")}</th><th className="p-3">{t("preview")}</th></tr></thead><tbody>
        {rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map((row) => <tr key={row.key} className="border-t border-md-outline-variant hover:bg-md-surface-container-low"><td className="p-3"><Checkbox aria-label={t("selectFile") + " " + row.path} checked={isChecked(row.ids)} disabled={task.running || !row.ids.some((id) => allowed.has(id))} onCheckedChange={(checked) => toggle(row.ids, checked === true)} /></td><td className="p-3"><button type="button" className="flex max-w-full items-center gap-2 text-left text-md-primary hover:underline disabled:text-md-on-surface-variant" disabled={task.running || !!row.entry?.blocked} onClick={() => row.directory ? enter(row.path) : viewEntry(row.entry!.id)}>{row.directory ? <Folder className="h-4 w-4 shrink-0" /> : <FileIcon className="h-4 w-4 shrink-0" />}<span className="break-all font-mono text-xs">{row.name}</span></button>{row.entry?.blocked && <p className="mt-1 text-xs text-md-error">{t("errors." + row.entry.blocked)}</p>}</td><td className="whitespace-nowrap p-3 font-mono text-xs">{formatBinarySize(row.originalSize)}</td><td className="p-3">{!row.directory && <Button variant="ghost" size="icon" aria-label={t("previewFile") + " " + row.path} disabled={task.running || !!row.entry?.blocked} onClick={() => viewEntry(row.entry!.id)}><Eye /></Button>}</td></tr>)}
      </tbody></table>{!rows.length && <p className="p-6 text-center text-sm text-md-on-surface-variant">{t("emptyFolder")}</p>}</div>
      <Pager page={page} count={rows.length} onPage={setPage} />
    </>}
    {extracted.length > 1 && <div className="space-y-2 rounded-xl border border-md-outline-variant p-3"><h3 className="text-sm font-semibold">{t("extractedFiles")} · {extracted.length}</h3>{extracted.slice(extractedPage * PAGE_SIZE, (extractedPage + 1) * PAGE_SIZE).map((item) => <div key={item.id} className="flex items-center gap-2"><button className="min-w-0 flex-1 truncate text-left font-mono text-xs text-md-primary hover:underline" onClick={() => setPreview(item)}>{item.path}</button><span className="text-xs text-md-on-surface-variant">{formatBinarySize(item.file.size)}</span><BinaryFileDownload file={item.file} label={t("downloadFile") + " " + item.path} compact /></div>)}<Pager page={extractedPage} count={extracted.length} onPage={setExtractedPage} /></div>}
    {preview && <BinaryFileResult file={preview.file} source={"ZIP " + preview.path} />}
    {bundle && <BinaryFileResult file={bundle} source={t("bundleSelected")} />}
  </div>
}

function ZipBuilder() {
  const t = useTranslations("compressionFiles")
  const task = useBinaryFileTask()
  const [files, setFiles] = useState<Array<{ id: string; file: File; path: string }>>([])
  const [filename, setFilename] = useState("archive.zip")
  const [level, setLevel] = useState("6")
  const [page, setPage] = useState(0)
  const [result, setResult] = useState<File | null>(null)
  const total = files.reduce((sum, item) => sum + item.file.size, 0)
  const add = (added: File[]) => {
    setResult(null)
    void task.run(async () => {
      if (files.length + added.length > MAX_ZIP_ENTRIES) throw new BinaryFileError("entryLimit")
      if (added.some((file) => file.size > MAX_BINARY_FILE_BYTES) || total + added.reduce((sum, file) => sum + file.size, 0) > MAX_EXPANDED_BYTES) throw new BinaryFileError("inputLimit")
      return added.map((file) => ({ id: createClientId("zip-file"), file, path: file.webkitRelativePath || file.name }))
    }, (next) => setFiles((previous) => [...previous, ...next]))
  }
  const pack = () => {
    setResult(null)
    void task.run(async (signal, report) => {
      const sources: ZipSource[] = []
      for (const item of files) { if (signal.aborted) throw new BinaryFileError("cancelled"); sources.push({ name: item.path, data: new Uint8Array(await item.file.arrayBuffer()), modifiedAt: item.file.lastModified }) }
      const bytes = await createZip(sources, { level: Number(level), signal, onProgress: (count) => report(t("packing") + " " + count + " / " + sources.length) })
      return createBinaryFile(bytes, filename.trim().toLowerCase().endsWith(".zip") ? filename.trim() : (filename.trim() || "archive") + ".zip")
    }, setResult)
  }
  return <div className="space-y-4">
    <Button variant="ghost" size="sm" disabled={task.running} onClick={() => add([new File(["Hello ZIP\n"], "hello.txt", { type: "text/plain" }), new File(['{"local":true}'], "data.json", { type: "application/json" })])}>{t("exampleFiles")}</Button>
    <div className="space-y-3 rounded-xl border-2 border-dashed border-md-outline-variant bg-md-surface-container-low p-5" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); if (!task.running) add(Array.from(event.dataTransfer.files)) }}><p className="text-sm font-medium">{t("dropFiles")}</p><div className="flex flex-wrap gap-2"><Picker label={t("chooseFiles")} multiple disabled={task.running} onFiles={add} /><Picker label={t("chooseFolder")} directory disabled={task.running} onFiles={add} /></div><p className="text-xs text-md-on-surface-variant">{t("packHelp")}</p></div>
    <div className="grid gap-3 sm:grid-cols-2"><div className="space-y-1.5"><Label htmlFor="zip-download-name">{t("zipFilename")}</Label><Input id="zip-download-name" value={filename} onChange={(event) => { setFilename(event.target.value); setResult(null) }} disabled={task.running} className="h-10" /></div><Choice label={t("level")} value={level} disabled={task.running} onChange={(value) => { setLevel(value); setResult(null) }} items={[["0", t("storeOnly")], ["1", t("fast")], ["6", t("balanced")], ["9", t("smallest")]]} /></div>
    <div className="flex flex-wrap items-center gap-2"><p className="mr-auto text-sm text-md-on-surface-variant">{files.length} {t("files")} · {formatBinarySize(total)}</p><Button disabled={task.running || !files.length} onClick={pack}><Archive />{t("createZip")}</Button><Button variant="ghost" disabled={task.running || !files.length} onClick={() => { setFiles([]); setResult(null); setPage(0); task.clearError() }}><Trash2 />{t("clear")}</Button></div>
    <TaskStatus task={task} />
    {files.length > 0 && <div className="space-y-2 rounded-xl border border-md-outline-variant p-3">{files.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map((item) => <div className="flex items-center gap-2" key={item.id}><Input aria-label={t("archivePath") + " " + item.file.name} value={item.path} maxLength={2048} disabled={task.running} className="h-9 min-w-0 flex-1 font-mono text-xs" onChange={(event) => { setFiles((previous) => previous.map((row) => row.id === item.id ? { ...row, path: event.target.value } : row)); setResult(null) }} /><span className="text-xs text-md-on-surface-variant">{formatBinarySize(item.file.size)}</span><Button variant="ghost" size="icon" disabled={task.running} aria-label={t("removeFile") + " " + item.path} onClick={() => { setFiles((previous) => previous.filter((row) => row.id !== item.id)); setResult(null); setPage(0) }}><X /></Button></div>)}<Pager page={page} count={files.length} onPage={setPage} /></div>}
    {result && <BinaryFileResult file={result} source={t("createZip")} />}
  </div>
}

function FileCodec() {
  const t = useTranslations("compressionFiles")
  const task = useBinaryFileTask()
  const [file, setFile] = useState<File | null>(null)
  const [operation, setOperation] = useState("compress")
  const [format, setFormat] = useState<FileCompressionFormat>("gzip")
  const [result, setResult] = useState<File | null>(null)
  const run = (sourceFile = file, direction = operation) => {
    if (!sourceFile) return
    setResult(null)
    void task.run(async (signal, report) => {
      if (sourceFile.size > MAX_BINARY_FILE_BYTES) throw new BinaryFileError("inputLimit")
      const source = new Uint8Array(await sourceFile.arrayBuffer())
      const data = await transformFileBytes(source, { operation: direction as "compress" | "decompress", format, signal, onProgress: (count) => report(Math.round(count / Math.max(1, source.length) * 100) + "%") })
      const suffix = { gzip: ".gz", zlib: ".zlib", deflate: ".deflate", brotli: ".br" }[format]
      return createBinaryFile(data, direction === "compress" ? sourceFile.name + suffix : sourceFile.name.toLowerCase().endsWith(suffix) ? sourceFile.name.slice(0, -suffix.length) || "output.bin" : sourceFile.name + ".out")
    }, setResult)
  }
  return <div className="space-y-4">
    <Button variant="ghost" size="sm" disabled={task.running} onClick={() => { setFile(new File(["File compression example · 本地压缩\n".repeat(40)], "example.txt", { type: "text/plain" })); setResult(null); task.clearError() }}>{t("exampleFile")}</Button>
    <p className="text-sm text-md-on-surface-variant">{t("fileCodecHelp")}</p><div className="flex flex-wrap items-center gap-3 rounded-xl border-2 border-dashed border-md-outline-variant p-5" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); if (!task.running && event.dataTransfer.files[0]) { setFile(event.dataTransfer.files[0]); setResult(null) } }}><FileIcon className="h-6 w-6 text-md-primary" /><span className="min-w-0 flex-1 break-all text-sm">{file ? file.name + " · " + formatBinarySize(file.size) : t("chooseSourceFile")}</span><Picker label={t("chooseSourceFile")} disabled={task.running} onFiles={(files) => { setFile(files[0]); setResult(null); task.clearError() }} /></div>
    <div className="grid gap-3 sm:grid-cols-2"><Choice label={t("operation")} value={operation} disabled={task.running} onChange={(value) => { setOperation(value); setResult(null) }} items={[["compress", t("compress")], ["decompress", t("decompress")]]} /><Choice label={t("format")} value={format} disabled={task.running} onChange={(value) => { setFormat(value as FileCompressionFormat); setResult(null) }} items={[["gzip", "GZip"], ["zlib", "Zlib"], ["deflate", "Deflate"], ["brotli", "Brotli"]]} /></div>
    <div className="flex flex-wrap gap-2"><Button disabled={!file || task.running} onClick={() => run()}><Archive />{operation === "compress" ? t("compress") : t("decompress")}</Button><Button variant="ghost" disabled={task.running || !file} onClick={() => { setFile(null); setResult(null); task.clearError() }}><Trash2 />{t("clear")}</Button></div><TaskStatus task={task} />{result && <div className="space-y-3"><BinaryFileResult file={result} source={format} /><Button variant="outline" disabled={task.running} onClick={() => { const direction = operation === "compress" ? "decompress" : "compress"; setFile(result); setOperation(direction); run(result, direction) }}>{t("reverseResult")}</Button></div>}
  </div>
}

export default function FileCompressionPanel() {
  const t = useTranslations("compressionFiles")
  const [mode, setMode] = useState("browse")
  return <div className="mx-auto max-w-6xl space-y-5 px-1 py-2 sm:px-3"><div className="space-y-2"><h1 className="flex items-center gap-2 text-2xl font-bold"><Archive className="h-6 w-6 text-md-primary" />{t("title")}</h1><p className="text-sm text-md-on-surface-variant">{t("description")}</p></div><Tabs value={mode} onValueChange={setMode}><TabsList className="mb-4 grid h-auto w-full grid-cols-3"><TabsTrigger value="browse" className="py-2 text-xs sm:text-sm">{t("browseZip")}</TabsTrigger><TabsTrigger value="create" className="py-2 text-xs sm:text-sm">{t("createZip")}</TabsTrigger><TabsTrigger value="codec" className="py-2 text-xs sm:text-sm">{t("fileCodec")}</TabsTrigger></TabsList><TabsContent value="browse" forceMount className="data-[state=inactive]:hidden"><ZipBrowser /></TabsContent><TabsContent value="create" forceMount className="data-[state=inactive]:hidden"><ZipBuilder /></TabsContent><TabsContent value="codec" forceMount className="data-[state=inactive]:hidden"><FileCodec /></TabsContent></Tabs></div>
}
