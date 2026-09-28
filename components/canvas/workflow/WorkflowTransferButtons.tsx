"use client"

import { useRef, useState } from "react"
import { Download, Upload } from "lucide-react"

import { useTranslations } from "@/hooks/use-translations"
import { zhCanvas } from "@/lib/translations/zh-namespaces/canvas"
import { hasUnsavedCanvasChanges, useCanvasStore } from "@/lib/canvas/store"
import { ConfirmDialog } from "./ConfirmDialog"
import { parseWorkflowFile, serializeWorkflow } from "@/lib/canvas/workflow"
import { downloadBlob } from "@/lib/object-url"

const MAX_WORKFLOW_FILE_SIZE = 2 * 1024 * 1024

function safeFileName(value: string): string {
  return value.trim().replace(/[^a-zA-Z0-9\u4e00-\u9fff_-]+/g, "-").replace(/^-+|-+$/g, "") || "workflow"
}

export function WorkflowTransferButtons() {
  const t = useTranslations("canvas", zhCanvas)
  const nodes = useCanvasStore((state) => state.nodes)
  const edges = useCanvasStore((state) => state.edges)
  const replaceWorkflow = useCanvasStore((state) => state.replaceWorkflow)
  const currentName = useCanvasStore((state) => state.currentWorkflow?.name)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState("")
  const [pendingImport, setPendingImport] = useState<File | null>(null)

  // 文件名跟当前工作流走；以前一律叫 workflow.tool-workflow.json
  const exportWorkflow = () => {
    const name = currentName ?? "workflow"
    const contents = serializeWorkflow(name, { nodes, edges })
    downloadBlob(
      new Blob([contents], { type: "application/json" }),
      `${safeFileName(name)}.tool-workflow.json`,
    )
    setMessage(t("workflowExported"))
  }

  // 有未保存的改动时先确认，以前导入会直接替换当前画布
  const requestImport = (file: File) => {
    if (hasUnsavedCanvasChanges(useCanvasStore.getState())) setPendingImport(file)
    else void importWorkflow(file)
  }

  const importWorkflow = async (file: File) => {
    if (file.size > MAX_WORKFLOW_FILE_SIZE) {
      setMessage(t("workflowFileTooLarge"))
      return
    }

    try {
      const imported = parseWorkflowFile(await file.text())
      replaceWorkflow(imported.data)
      setMessage(t("workflowImported"))
    } catch (error) {
      const code = error instanceof Error ? error.message : "INVALID_WORKFLOW"
      setMessage(code === "UNSUPPORTED_VERSION" ? t("workflowVersionUnsupported") : t("workflowImportInvalid"))
    }
  }

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={exportWorkflow}
        className="flex min-h-11 w-full items-center gap-2 rounded-[var(--md-sys-shape-corner-small)] px-2 py-1.5 text-left text-sm text-md-on-surface transition-colors hover:bg-[var(--md-sys-color-on-surface)]/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-md-primary"
      >
        <Download aria-hidden="true" className="h-4 w-4 text-md-on-surface-variant" />
        {t("exportWorkflow")}
      </button>
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        className="flex min-h-11 w-full items-center gap-2 rounded-[var(--md-sys-shape-corner-small)] px-2 py-1.5 text-left text-sm text-md-on-surface transition-colors hover:bg-[var(--md-sys-color-on-surface)]/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-md-primary"
      >
        <Upload aria-hidden="true" className="h-4 w-4 text-md-on-surface-variant" />
        {t("importWorkflow")}
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        className="sr-only"
        aria-label={t("importWorkflow")}
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) requestImport(file)
          event.target.value = ""
        }}
      />
      {message && <p role="status" className="px-2 pt-1 text-xs text-md-on-surface-variant">{message}</p>}
      {pendingImport && (
        <ConfirmDialog
          title={t("replaceCanvasTitle")}
          message={t("replaceCanvasMessage")}
          confirmLabel={t("replaceCanvas")}
          onConfirm={() => { const file = pendingImport; setPendingImport(null); void importWorkflow(file) }}
          onCancel={() => setPendingImport(null)}
        />
      )}
    </div>
  )
}
