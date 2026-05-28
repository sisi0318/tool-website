"use client"

import { useState } from "react"
import { FilePlus } from "lucide-react"
import { useCanvasStore } from "@/lib/canvas/store"
import { SaveDialog } from "./SaveDialog"
import { saveWorkflow, getWorkflowList } from "@/lib/canvas/workflow"

export function WorkflowNewButton() {
  const nodes = useCanvasStore((s) => s.nodes)
  const edges = useCanvasStore((s) => s.edges)
  const clearCanvas = useCanvasStore((s) => s.clearCanvas)
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const handleClick = () => {
    if (nodes.length > 0) {
      setShowConfirm(true)
    } else {
      clearCanvas()
    }
  }

  const handleSave = (name: string) => {
    saveWorkflow(name, { nodes, edges })
    setShowSaveDialog(false)
    clearCanvas()
    setShowConfirm(false)
  }

  const handleDiscard = () => {
    clearCanvas()
    setShowConfirm(false)
  }

  if (showSaveDialog) {
    return (
      <SaveDialog
        onSave={handleSave}
        onCancel={() => setShowSaveDialog(false)}
        existingNames={getWorkflowList()}
      />
    )
  }

  if (showConfirm) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 w-80">
          <h3 className="text-sm font-semibold mb-2">新建画布</h3>
          <p className="text-xs text-gray-500 mb-4">
            当前画布有未保存的内容，是否保存？
          </p>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowConfirm(false)}
              className="px-3 py-1.5 text-sm border rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              取消
            </button>
            <button
              onClick={handleDiscard}
              className="px-3 py-1.5 text-sm border rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              不保存
            </button>
            <button
              onClick={() => { setShowConfirm(false); setShowSaveDialog(true) }}
              className="px-3 py-1.5 text-sm bg-blue-500 text-white rounded-md hover:bg-blue-600"
            >
              保存
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      onClick={handleClick}
      className="flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
    >
      <FilePlus className="w-4 h-4 text-gray-600 dark:text-gray-400" />
      <span className="text-sm text-gray-700 dark:text-gray-300">新建</span>
    </div>
  )
}
