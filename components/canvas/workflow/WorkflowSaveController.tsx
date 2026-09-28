"use client"

import { useCallback, useEffect, useState } from "react"
import { useCanvasStore } from "@/lib/canvas/store"
import { getWorkflowList, saveWorkflow } from "@/lib/canvas/workflow"
import { useToast } from "@/hooks/use-toast"
import { useTranslations } from "@/hooks/use-translations"
import { zhCanvas } from "@/lib/translations/zh-namespaces/canvas"
import { SaveDialog } from "./SaveDialog"

/** 工作流面板的“保存 / 另存为”发出这个事件；面板可以折叠卸载，保存逻辑放在常驻的控制器里 */
export const SAVE_WORKFLOW_EVENT = "canvas:save-workflow"

export function requestWorkflowSave(saveAs = false) {
  window.dispatchEvent(new CustomEvent(SAVE_WORKFLOW_EVENT, { detail: { saveAs } }))
}

/**
 * 画布的保存入口：已命名的工作流直接覆盖保存（Ctrl/⌘+S），未命名或“另存为”（Ctrl/⌘+Shift+S）才弹出命名对话框。
 * 以前每次保存都要重新输入名字，保存成功也没有任何反馈。
 */
export function WorkflowSaveController() {
  const t = useTranslations("canvas", zhCanvas)
  const { toast } = useToast()
  const [naming, setNaming] = useState(false)
  const currentName = useCanvasStore((state) => state.currentWorkflow?.name ?? "")

  const save = useCallback((name: string) => {
    const { nodes, edges, setCurrentWorkflow } = useCanvasStore.getState()
    if (saveWorkflow(name, { nodes, edges }) === "failed") {
      toast({ title: t("workflowSaveFailed"), variant: "destructive" })
      return false
    }
    setCurrentWorkflow(name)
    toast({ title: t("workflowSaved").replace("{name}", name) })
    return true
  }, [t, toast])

  useEffect(() => {
    const handle = (saveAs: boolean) => {
      const current = useCanvasStore.getState().currentWorkflow
      if (current && !saveAs) save(current.name)
      else setNaming(true)
    }
    const onRequest = (event: Event) => handle(Boolean((event as CustomEvent<{ saveAs?: boolean }>).detail?.saveAs))
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "s" || !(event.ctrlKey || event.metaKey) || event.altKey) return
      event.preventDefault()
      handle(event.shiftKey)
    }
    window.addEventListener(SAVE_WORKFLOW_EVENT, onRequest)
    window.addEventListener("keydown", onKeyDown)
    return () => {
      window.removeEventListener(SAVE_WORKFLOW_EVENT, onRequest)
      window.removeEventListener("keydown", onKeyDown)
    }
  }, [save])

  if (!naming) return null
  return (
    <SaveDialog
      initialName={currentName}
      onSave={(name) => { if (save(name)) setNaming(false) }}
      onCancel={() => setNaming(false)}
      existingNames={getWorkflowList()}
    />
  )
}
