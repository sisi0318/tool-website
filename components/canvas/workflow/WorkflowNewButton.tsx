"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
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
            <Button variant="outline" size="sm" onClick={() => setShowConfirm(false)}>取消</Button>
            <Button variant="outline" size="sm" onClick={handleDiscard}>不保存</Button>
            <Button size="sm" onClick={() => { setShowConfirm(false); setShowSaveDialog(true) }}>保存</Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <Button onClick={handleClick} variant="outline" size="sm" className="flex-1">
      <FilePlus className="w-4 h-4 mr-1" /> 新建
    </Button>
  )
}
