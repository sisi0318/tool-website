"use client"

import { useState, useCallback } from "react"
import { FolderOpen } from "lucide-react"
import { useCanvasStore } from "@/lib/canvas/store"
import { useTranslations } from "@/hooks/use-translations"
import { LoadDialog } from "./LoadDialog"
import { getWorkflowList, loadWorkflow, deleteWorkflow } from "@/lib/canvas/workflow"

export function WorkflowLoadButton() {
  const t = useTranslations("canvas")
  const [showDialog, setShowDialog] = useState(false)
  const [workflows, setWorkflows] = useState<string[]>([])

  const handleOpen = useCallback(() => {
    setWorkflows(getWorkflowList())
    setShowDialog(true)
  }, [])

  const handleDelete = useCallback((name: string) => {
    deleteWorkflow(name)
    setWorkflows(getWorkflowList())
  }, [])

  const handleLoad = useCallback((name: string) => {
    const data = loadWorkflow(name)
    if (data) {
      useCanvasStore.setState({
        nodes: data.nodes,
        edges: data.edges,
        nodeOutputs: {},
        nodeErrors: {},
        nodeRunning: {},
        selectedNodeId: null,
      })
      setShowDialog(false)
    }
  }, [])

  if (showDialog) {
    return (
      <LoadDialog
        workflows={workflows}
        onLoad={handleLoad}
        onDelete={handleDelete}
        onClose={() => setShowDialog(false)}
      />
    )
  }

  return (
    <div
      onClick={handleOpen}
      className="flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
    >
      <FolderOpen className="w-4 h-4 text-gray-600 dark:text-gray-400" />
      <span className="text-sm text-gray-700 dark:text-gray-300">{t("load")}</span>
    </div>
  )
}
