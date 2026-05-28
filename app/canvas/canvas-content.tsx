"use client"

import { useEffect } from "react"
import { ReactFlowProvider } from "@xyflow/react"
import { Canvas } from "@/components/canvas/Canvas"
import { NodePalette } from "@/components/canvas/NodePalette"
import { PropertyPanel } from "@/components/canvas/PropertyPanel"
import { useCanvasStore } from "@/lib/canvas/store"
import { registerAllAdapters } from "@/lib/adapters"

registerAllAdapters()

if (typeof window !== "undefined") {
  (window as any).__ZUSTAND_STORE__ = useCanvasStore
}

export default function CanvasContent() {
  const loadFromLocalStorage = useCanvasStore((s) => s.loadFromLocalStorage)

  useEffect(() => {
    loadFromLocalStorage()
  }, [loadFromLocalStorage])

  return (
    <div className="flex h-screen">
      <ReactFlowProvider>
        <NodePalette />
        <div className="flex-1">
          <Canvas />
        </div>
        <PropertyPanel />
      </ReactFlowProvider>
    </div>
  )
}
