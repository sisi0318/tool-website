"use client"

import { useCallback, useRef, useState } from "react"
import { createPortal } from "react-dom"
import {
  ChevronDown,
  CopyPlus,
  Download,
  Eraser,
  FilePlus,
  FolderOpen,
  Save,
  Upload,
} from "lucide-react"
import { hasUnsavedCanvasChanges, useCanvasStore } from "@/lib/canvas/store"
import {
  getWorkflowList,
  loadWorkflow,
  parseWorkflowFile,
  restoreWorkflow,
  saveWorkflow,
  serializeWorkflow,
  takeWorkflow,
} from "@/lib/canvas/workflow"
import { downloadBlob } from "@/lib/object-url"
import { useTranslations } from "@/hooks/use-translations"
import { zhCanvas } from "@/lib/translations/zh-namespaces/canvas"
import { useToast } from "@/hooks/use-toast"
import { ToastAction } from "@/components/ui/toast"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { requestCanvasFit } from "../canvas-events"
import { MenuShortcut } from "../CanvasContextMenu"
import { formatShortcut } from "../chrome"
import { ConfirmDialog } from "./ConfirmDialog"
import { LoadDialog } from "./LoadDialog"
import { NewCanvasConfirm } from "./NewCanvasConfirm"
import { SaveDialog } from "./SaveDialog"
import { requestWorkflowSave } from "./WorkflowSaveController"

const MAX_WORKFLOW_FILE_SIZE = 2 * 1024 * 1024

/** 文件名里只留字母、数字、下划线、连字符和汉字（“一”到“鿿”是 CJK 基本区 U+4E00–U+9FFF） */
function safeFileName(value: string): string {
  return value.trim().replace(/[^a-zA-Z0-9一-鿿_-]+/g, "-").replace(/^-+|-+$/g, "") || "workflow"
}

type WorkflowDialog =
  /** 新建前有没保存的内容 */
  | { kind: "confirmNew" }
  /** 选了“保存”，但这张画布还没有名字 */
  | { kind: "nameBeforeNew" }
  | { kind: "load" }
  /** 读取会替换没保存的内容 */
  | { kind: "confirmLoad"; name: string }
  /** 导入会替换没保存的内容 */
  | { kind: "confirmImport"; file: File }
  | { kind: "confirmClear" }

/**
 * 画布左上角的工作流名称，点开是新建、保存、另存为、读取、导出、导入和清空。
 * 菜单一关就卸载，所以各个对话框的状态放在这个常驻的组件里，而不是菜单项里。
 */
export function WorkflowMenu() {
  const t = useTranslations("canvas", zhCanvas)
  const { toast } = useToast()
  const workflowName = useCanvasStore((state) => state.currentWorkflow?.name)
  const unsaved = useCanvasStore(hasUnsavedCanvasChanges)
  const hasNodes = useCanvasStore((state) => state.nodes.length > 0)
  const [dialog, setDialog] = useState<WorkflowDialog | null>(null)
  const [workflows, setWorkflows] = useState<string[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const requestNew = () => {
    const state = useCanvasStore.getState()
    if (hasUnsavedCanvasChanges(state)) setDialog({ kind: "confirmNew" })
    else state.clearCanvas()
  }

  // 保存失败时绝不能继续 clearCanvas,否则用户的画布就真的没了。
  const saveThenStartOver = (name: string) => {
    const { nodes, edges, clearCanvas } = useCanvasStore.getState()
    if (saveWorkflow(name, { nodes, edges }) === "failed") {
      toast({ title: t("workflowSaveFailed"), variant: "destructive" })
      return
    }
    clearCanvas()
    setDialog(null)
  }

  // 确认框里点“保存”：已命名的工作流直接覆盖保存，不再让人重新起名
  const saveBeforeNew = () => {
    const current = useCanvasStore.getState().currentWorkflow
    if (current) saveThenStartOver(current.name)
    else setDialog({ kind: "nameBeforeNew" })
  }

  const openLoad = () => {
    setWorkflows(getWorkflowList())
    setDialog({ kind: "load" })
  }

  const loadNow = (name: string) => {
    const data = loadWorkflow(name)
    if (!data) {
      setDialog({ kind: "load" })
      return
    }
    const { replaceWorkflow, setCurrentWorkflow } = useCanvasStore.getState()
    replaceWorkflow(data)
    setCurrentWorkflow(name)
    requestCanvasFit()
    setDialog(null)
  }

  // 有未保存的改动时先确认，不直接替换当前画布
  const requestLoad = (name: string) => {
    if (hasUnsavedCanvasChanges(useCanvasStore.getState())) setDialog({ kind: "confirmLoad", name })
    else loadNow(name)
  }

  // 一点即删,提示里可以撤销:工作流只存在本机
  const deleteSaved = useCallback((name: string) => {
    const taken = takeWorkflow(name)
    setWorkflows(getWorkflowList())
    if (!taken) return
    toast({
      title: t("workflowDeleted").replace("{name}", name),
      duration: 8000,
      action: (
        <ToastAction altText={t("undo")} onClick={() => { if (restoreWorkflow(name, taken)) setWorkflows(getWorkflowList()) }}>
          {t("undo")}
        </ToastAction>
      ),
    })
  }, [t, toast])

  // 文件名跟当前工作流走
  const exportWorkflow = () => {
    const { nodes, edges, currentWorkflow } = useCanvasStore.getState()
    const name = currentWorkflow?.name ?? "workflow"
    downloadBlob(
      new Blob([serializeWorkflow(name, { nodes, edges })], { type: "application/json" }),
      `${safeFileName(name)}.tool-workflow.json`,
    )
    toast({ title: t("workflowExported") })
  }

  const importWorkflow = async (file: File) => {
    if (file.size > MAX_WORKFLOW_FILE_SIZE) {
      toast({ title: t("workflowFileTooLarge"), variant: "destructive" })
      return
    }
    try {
      const imported = parseWorkflowFile(await file.text())
      useCanvasStore.getState().replaceWorkflow(imported.data)
      requestCanvasFit()
      toast({ title: t("workflowImported") })
    } catch (error) {
      const code = error instanceof Error ? error.message : "INVALID_WORKFLOW"
      toast({
        title: code === "UNSUPPORTED_VERSION" ? t("workflowVersionUnsupported") : t("workflowImportInvalid"),
        variant: "destructive",
      })
    }
  }

  const requestImport = (file: File) => {
    if (hasUnsavedCanvasChanges(useCanvasStore.getState())) setDialog({ kind: "confirmImport", file })
    else void importWorkflow(file)
  }

  // 这几个对话框自己用 position: fixed 铺满屏幕；所在的工具条有 backdrop-filter，
  // 会让 fixed 改成相对工具条定位，所以挂到 body 上
  const overlay =
    dialog?.kind === "confirmNew" ? (
      <NewCanvasConfirm
        onCancel={() => setDialog(null)}
        onDiscard={() => {
          useCanvasStore.getState().clearCanvas()
          setDialog(null)
        }}
        onSave={saveBeforeNew}
      />
    ) : dialog?.kind === "nameBeforeNew" ? (
      <SaveDialog
        onSave={saveThenStartOver}
        onCancel={() => setDialog(null)}
        existingNames={getWorkflowList()}
      />
    ) : dialog?.kind === "load" ? (
      <LoadDialog
        workflows={workflows}
        onLoad={requestLoad}
        onDelete={deleteSaved}
        onClose={() => setDialog(null)}
      />
    ) : null

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            // 名称写明白，不靠各家读屏怎么拼接里面的几段文字
            aria-label={[t("workflow"), workflowName ?? t("untitledWorkflow"), ...(unsaved ? [t("unsavedChanges")] : [])].join(" · ")}
            title={t("workflow")}
            className="flex h-11 min-w-0 items-center gap-1.5 rounded-[var(--md-sys-shape-corner-medium)] px-2.5 text-sm font-medium text-md-on-surface transition-colors hover:bg-md-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-md-primary data-[state=open]:bg-md-hover sm:h-9"
          >
            <span className="min-w-0 truncate">{workflowName ?? t("untitledWorkflow")}</span>
            {unsaved && (
              <span className="shrink-0 text-xs text-md-primary">
                <span aria-hidden="true">●</span>
                <span className="sr-only">{t("unsavedChanges")}</span>
              </span>
            )}
            <ChevronDown aria-hidden="true" className="h-4 w-4 shrink-0 text-md-on-surface-variant" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          className="min-w-56"
          onCloseAutoFocus={(event) => {
            const dialog = document.querySelector<HTMLElement>('[role="dialog"], [role="alertdialog"]')
            if (!dialog) return
            // 菜单项打开了对话框：焦点该留在对话框里，不回到这个按钮上。
            // 菜单开着的时候焦点被它圈在自己里面，对话框当时的 focus() 没有生效，这里补一次
            event.preventDefault()
            if (!dialog.contains(document.activeElement)) {
              (dialog.querySelector<HTMLElement>("[data-autofocus]") ?? dialog).focus()
            }
          }}
        >
          <DropdownMenuItem onSelect={requestNew}>
            <FilePlus aria-hidden="true" className="text-md-on-surface-variant" />
            {t("newCanvas")}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => requestWorkflowSave(false)}>
            <Save aria-hidden="true" className="text-md-on-surface-variant" />
            {t("save")}
            <MenuShortcut>{formatShortcut("mod+s")}</MenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => requestWorkflowSave(true)}>
            <CopyPlus aria-hidden="true" className="text-md-on-surface-variant" />
            {t("saveAs")}
            <MenuShortcut>{formatShortcut("mod+shift+s")}</MenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={openLoad}>
            <FolderOpen aria-hidden="true" className="text-md-on-surface-variant" />
            {t("load")}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={exportWorkflow}>
            <Download aria-hidden="true" className="text-md-on-surface-variant" />
            {t("exportWorkflow")}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => fileInputRef.current?.click()}>
            <Upload aria-hidden="true" className="text-md-on-surface-variant" />
            {t("importWorkflow")}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            disabled={!hasNodes}
            onSelect={() => setDialog({ kind: "confirmClear" })}
            className="text-md-error focus:text-md-error"
          >
            <Eraser aria-hidden="true" />
            {t("clearCanvasTitle")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        className="sr-only"
        tabIndex={-1}
        aria-label={t("importWorkflow")}
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) requestImport(file)
          event.target.value = ""
        }}
      />

      {overlay && createPortal(overlay, document.body)}
      {dialog?.kind === "confirmLoad" && (
        <ConfirmDialog
          title={t("replaceCanvasTitle")}
          message={t("replaceCanvasMessage")}
          confirmLabel={t("replaceCanvas")}
          onConfirm={() => loadNow(dialog.name)}
          onCancel={() => setDialog({ kind: "load" })}
        />
      )}
      {dialog?.kind === "confirmImport" && (
        <ConfirmDialog
          title={t("replaceCanvasTitle")}
          message={t("replaceCanvasMessage")}
          confirmLabel={t("replaceCanvas")}
          onConfirm={() => {
            const { file } = dialog
            setDialog(null)
            void importWorkflow(file)
          }}
          onCancel={() => setDialog(null)}
        />
      )}
      {dialog?.kind === "confirmClear" && (
        <ConfirmDialog
          title={t("clearCanvasTitle")}
          message={t("clearCanvasMessage")}
          confirmLabel={t("clearCanvas")}
          onConfirm={() => {
            useCanvasStore.getState().clearCanvas()
            setDialog(null)
          }}
          onCancel={() => setDialog(null)}
        />
      )}
    </>
  )
}
