"use client"

import { useState, useCallback } from "react"
import { useDropzone } from "react-dropzone" // Need to check if this is available or implement custom
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Upload, FileText, FileSpreadsheet, FileIcon, X } from "lucide-react"
import { renderAsync } from "docx-preview"
import * as XLSX from "xlsx"

export default function DocViewerPage() {
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
                setError("Unsupported file type. Please upload .docx or .xlsx")
            }
        } catch (err) {
            console.error(err)
            setError("Failed to render file. It might be corrupted or encrypted.")
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="container mx-auto px-4 py-8 max-w-6xl">
            <div className="text-center mb-8">
                <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-200 mb-4 flex items-center justify-center gap-2">
                    <FileText className="h-8 w-8 text-blue-600" />
                    Document Viewer
                </h1>
                <p className="text-gray-600 dark:text-gray-400">
                    Secure, client-side preview for Word and Excel files. Your files never leave your browser.
                </p>
            </div>

            <Card className="card-modern mb-8">
                <CardContent className="pt-6">
                    <div
                        className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl p-12 text-center cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
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
                        />
                        <div className="flex flex-col items-center gap-4">
                            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-full">
                                <Upload className="h-8 w-8 text-blue-600" />
                            </div>
                            <div>
                                <p className="text-lg font-medium text-gray-900 dark:text-gray-100">
                                    Click or drag file to this area to upload
                                </p>
                                <p className="text-sm text-gray-500 mt-1">
                                    Supports .docx, .xlsx, .xls
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
                                <FileText className="h-5 w-5 text-blue-600" />
                            ) : (
                                <FileSpreadsheet className="h-5 w-5 text-green-600" />
                            )}
                            {file.name}
                        </CardTitle>
                        <Button variant="ghost" size="icon" onClick={() => setFile(null)}>
                            <X className="h-4 w-4" />
                        </Button>
                    </CardHeader>
                    <CardContent className="p-0 overflow-auto bg-white dark:bg-gray-900 min-h-[600px] relative">
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
