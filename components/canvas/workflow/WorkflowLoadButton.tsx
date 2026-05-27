"use client"

import { useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { FolderOpen } from "lucide-react"
import { useCanvasStore } from "@/lib/canvas/store"
import { LoadDialog } from "./LoadDialog"
import { getWorkflowList, loadWorkflow, deleteWorkflow } from "@/lib/canvas/workflow"

export function WorkflowLoadButton() {
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
    <Button onClick={handleOpen} variant="outline" size="sm" className="flex-1">
      <FolderOpen className="w-4 h-4 mr-1" /> 读取
    </Button>
  )
}
