"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
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
    <Button onClick={() => setShowDialog(true)} variant="outline" size="sm" className="flex-1">
      <Save className="w-4 h-4 mr-1" /> 保存
    </Button>
  )
}
