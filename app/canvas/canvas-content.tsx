"use client"

import { useEffect, useState } from "react"
import { ReactFlowProvider } from "@xyflow/react"
import { Canvas } from "@/components/canvas/Canvas"
import { NodePalette } from "@/components/canvas/NodePalette"
import { PropertyPanel } from "@/components/canvas/PropertyPanel"
import { useCanvasStore } from "@/lib/canvas/store"
import { useTranslations } from "@/hooks/use-translations"
import { registerAllAdapters } from "@/lib/adapters"

registerAllAdapters()

if (typeof window !== "undefined") {
  (window as any).__ZUSTAND_STORE__ = useCanvasStore
}

export default function CanvasContent() {
  const t = useTranslations("canvas")
  const loadFromLocalStorage = useCanvasStore((s) => s.loadFromLocalStorage)
  const selectedNodeId = useCanvasStore((s) => s.selectedNodeId)
  const [showPalette, setShowPalette] = useState(true)

  useEffect(() => {
    loadFromLocalStorage()
  }, [loadFromLocalStorage])

  return (
    <div className="canvas-shell flex h-[100dvh] overflow-hidden bg-[var(--md-sys-color-surface)]">
      <ReactFlowProvider>
        <div className={`${showPalette ? "flex" : "hidden"} lg:flex h-full`}>
          <NodePalette />
        </div>
        <div className="flex-1 relative">
          <div className="lg:hidden absolute top-2 left-2 z-10 flex gap-1">
            <button
              onClick={() => setShowPalette((v) => !v)}
              aria-expanded={showPalette}
              className="min-h-11 rounded-full bg-[var(--md-sys-color-inverse-surface)] px-4 text-xs font-semibold text-[var(--md-sys-color-inverse-on-surface)] shadow-lg"
            >
              {showPalette ? t("hidePalette") : t("palette")}
            </button>
          </div>
          <Canvas />
        </div>
        <div className={`${selectedNodeId ? "flex" : "hidden"} lg:flex h-full`}>
          <PropertyPanel />
        </div>
      </ReactFlowProvider>
    </div>
  )
}
