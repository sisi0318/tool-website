"use client"

import { useState } from "react"
import { Save } from "lucide-react"
import { useCanvasStore } from "@/lib/canvas/store"
import { SaveDialog } from "./SaveDialog"
import { saveWorkflow, getWorkflowList } from "@/lib/canvas/workflow"

export function WorkflowSaveButton() {
  const nodes = useCanvasStore((s) => s.nodes)
  const edges = useCanvasStore((s) => s.edges)
  const [showDialog, setShowDialog] = useState(false)

  const handleSave = (name: string) => {
    saveWorkflow(name, { nodes, edges })
    setShowDialog(false)
  }

  if (showDialog) {
    return (
      <SaveDialog
        onSave={handleSave}
        onCancel={() => setShowDialog(false)}
        existingNames={getWorkflowList()}
      />
    )
  }

  return (
    <div
      onClick={() => setShowDialog(true)}
      className="flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
    >
      <Save className="w-4 h-4 text-gray-600 dark:text-gray-400" />
      <span className="text-sm text-gray-700 dark:text-gray-300">保存</span>
    </div>
  )
}
