import { useRef } from "react"

import { downloadBlob } from "@/lib/object-url"

interface FileEditorProps {
  disabled: boolean
  file: File | null
  onFileChange: (file: File | null) => void
}

export function FileEditor({ disabled, file, onFileChange }: FileEditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDownload = () => {
    if (!file) return
    downloadBlob(file, file.name)
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFileChange(e.target.files?.[0] ?? null)
  }

  return (
    <div className="px-3 py-2 border-t border-gray-200 dark:border-gray-700 space-y-2" data-testid="inline-editor-file">
      {!disabled ? (
        <div 
          className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded p-2 text-center cursor-pointer hover:border-gray-400 dark:hover:border-gray-500"
          onClick={() => fileInputRef.current?.click()}
          data-testid="file-upload-area"
        >
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileSelect}
            className="hidden"
            data-testid="file-input"
          />
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {file ? file.name : "Click to upload file"}
          </span>
        </div>
      ) : (
        <div className="text-xs text-gray-500 dark:text-gray-400" data-testid="file-name-display">
          {file?.name ?? "No file"}
        </div>
      )}

      <button
        onClick={handleDownload}
        disabled={!file}
        data-testid="file-download-btn"
        className="w-full px-2 py-1 text-xs bg-blue-500 text-white rounded
                   hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Download
      </button>
    </div>
  )
}
