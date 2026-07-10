"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Upload, FileText, FileSpreadsheet, X } from "lucide-react"
import { renderAsync } from "docx-preview"
import * as XLSX from "xlsx"
import { useTranslations } from "@/hooks/use-translations"

export default function DocViewerPage() {
    const t = useTranslations("docViewer")
    const [file, setFile] = useState<File | null>(null)
    const [error, setError] = useState<string>("")
    const [loading, setLoading] = useState(false)
    const [htmlContent, setHtmlContent] = useState<string>("") // For Excel/HTML

    // Custom Dropzone Implementation (since we might not have react-dropzone)
    const onDragOver = (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
    }

    const onDrop = (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        const droppedFile = e.dataTransfer.files[0]
        if (droppedFile) handleFile(droppedFile)
    }

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0]
        if (selectedFile) handleFile(selectedFile)
    }

    const handleFile = async (selectedFile: File) => {
        setFile(selectedFile)
        setError("")
        setLoading(true)
        setHtmlContent("")

        // Reset container for docx
        const container = document.getElementById("doc-container")
        if (container) container.innerHTML = ""

        try {
            const ext = selectedFile.name.split('.').pop()?.toLowerCase()

            if (ext === 'docx') {
                if (!container) throw new Error("Container not found")
                const arrayBuffer = await selectedFile.arrayBuffer()
                await renderAsync(arrayBuffer, container, undefined, {
                    inWrapper: false,
                    ignoreWidth: false,
                    ignoreHeight: false,
                    className: "docx-wrapper"
                })
            }
            else if (ext === 'xlsx' || ext === 'xls') {
                const arrayBuffer = await selectedFile.arrayBuffer()
                const workbook = XLSX.read(arrayBuffer)
                const sheetName = workbook.SheetNames[0]
                const sheet = workbook.Sheets[sheetName]
                const html = XLSX.utils.sheet_to_html(sheet)
                setHtmlContent(html)
            }
            else {
                setError(t("unsupported"))
            }
        } catch (err) {
            console.error(err)
            setError(t("renderError"))
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="container mx-auto px-4 py-8 max-w-6xl">
            <div className="text-center mb-8">
                <h1 className="mb-4 flex items-center justify-center gap-2 text-3xl font-bold text-[var(--md-sys-color-on-surface)]">
                    <FileText className="h-8 w-8 text-[var(--md-sys-color-primary)]" />
                    {t("title")}
                </h1>
                <p className="text-[var(--md-sys-color-on-surface-variant)]">
                    {t("description")}
                </p>
            </div>

            <Card className="card-modern mb-8">
                <CardContent className="pt-6">
                    <div
                        className="cursor-pointer rounded-2xl border-2 border-dashed border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container-low)] p-8 text-center transition-colors hover:border-[var(--md-sys-color-primary)] hover:bg-[var(--md-sys-color-surface-container)] sm:p-12"
                        onDragOver={onDragOver}
                        onDrop={onDrop}
                        onClick={() => document.getElementById('file-upload')?.click()}
                    >
                        <input
                            type="file"
                            id="file-upload"
                            className="hidden"
                            accept=".docx,.xlsx,.xls"
                            onChange={handleFileSelect}
                            aria-label={t("chooseFile")}
                        />
                        <div className="flex flex-col items-center gap-4">
                            <div className="rounded-full bg-[var(--md-sys-color-primary-container)] p-4">
                                <Upload className="h-8 w-8 text-[var(--md-sys-color-on-primary-container)]" />
                            </div>
                            <div>
                                <p className="text-lg font-medium text-[var(--md-sys-color-on-surface)]">
                                    {t("dropHint")}
                                </p>
                                <p className="mt-1 text-sm text-[var(--md-sys-color-on-surface-variant)]">
                                    {t("formats")}
                                </p>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Viewer Area */}
            {file && (
                <Card className="card-modern min-h-[500px]">
                    <CardHeader className="flex flex-row items-center justify-between border-b pb-4">
                        <CardTitle className="text-base flex items-center gap-2">
                            {file.name.endsWith('docx') ? (
                                <FileText className="h-5 w-5 text-[var(--md-sys-color-primary)]" />
                            ) : (
                                <FileSpreadsheet className="h-5 w-5 text-green-600" />
                            )}
                            {file.name}
                        </CardTitle>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setFile(null)}
                            aria-label={t("removeFile")}
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    </CardHeader>
                    <CardContent className="relative min-h-[600px] overflow-auto bg-[var(--md-sys-color-surface-container-lowest)] p-0">
                        {loading && (
                            <div className="absolute inset-0 flex items-center justify-center bg-white/80 dark:bg-black/50 z-10">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                            </div>
                        )}

                        {error ? (
                            <div className="p-8 text-center text-red-500">
                                {error}
                            </div>
                        ) : (
                            <>
                                <div id="doc-container" className="docx-container p-8" />
                                {htmlContent && (
                                    <div
                                        className="excel-container p-4"
                                        dangerouslySetInnerHTML={{ __html: htmlContent }}
                                    />
                                )}
                            </>
                        )}
                    </CardContent>
                </Card>
            )}
        </div>
    )
}
