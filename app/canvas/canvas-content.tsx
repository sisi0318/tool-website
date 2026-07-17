"use client"

import { useEffect, useState } from "react"
import { ReactFlowProvider } from "@xyflow/react"
import { Plus } from "lucide-react"
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
  const selectedNodeIds = useCanvasStore((s) => s.selectedNodeIds)
  const selectNode = useCanvasStore((s) => s.selectNode)
  const [showPalette, setShowPalette] = useState(false)
  const showPropertyPanel = Boolean(
    !showPalette && selectedNodeId && selectedNodeIds.length === 1
  )

  useEffect(() => {
    loadFromLocalStorage()
  }, [loadFromLocalStorage])

  return (
    <div className="canvas-shell flex h-[100dvh] overflow-hidden bg-[var(--md-sys-color-surface)]">
      <ReactFlowProvider>
        {(showPalette || showPropertyPanel) && (
          <button
            type="button"
            aria-label={t("close")}
            onClick={() => {
              if (showPalette) setShowPalette(false)
              else selectNode(null)
            }}
            className="fixed inset-0 z-30 bg-black/30 backdrop-blur-[1px] lg:hidden"
          />
        )}
        <div className={`${showPalette ? "fixed" : "hidden"} inset-y-0 left-0 z-40 h-full shadow-2xl lg:static lg:z-auto lg:flex lg:shadow-none`}>
          <NodePalette
            onNodeAdded={() => setShowPalette(false)}
            onRequestClose={() => setShowPalette(false)}
            onRequestOpen={() => setShowPalette(true)}
          />
        </div>
        <div className="relative min-w-0 flex-1">
          {!showPalette && selectedNodeIds.length < 2 && (
            <div className={`absolute left-14 z-50 flex gap-1 lg:hidden ${
              showPropertyPanel ? "top-16" : "bottom-3"
            }`}>
              <button
                type="button"
                onClick={() => setShowPalette(true)}
                aria-expanded={showPalette}
                aria-controls="canvas-node-palette"
                className="flex min-h-11 items-center gap-1.5 rounded-full bg-md-inverse-surface px-4 text-xs font-semibold text-md-inverse-on-surface shadow-lg transition-transform active:scale-95"
              >
                <Plus aria-hidden="true" className="h-4 w-4" />
                {t("palette")}
              </button>
            </div>
          )}
          <Canvas />
        </div>
        <div className={`${showPropertyPanel ? "fixed" : "hidden"} inset-x-0 bottom-0 z-40 max-h-[72dvh] lg:static lg:z-auto lg:flex lg:h-full lg:max-h-none`}>
          <PropertyPanel onClose={() => selectNode(null)} />
        </div>
      </ReactFlowProvider>
    </div>
  )
}
