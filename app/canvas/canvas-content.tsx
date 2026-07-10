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
  const selectedNodeIds = useCanvasStore((s) => s.selectedNodeIds)
  const selectNode = useCanvasStore((s) => s.selectNode)
  const [showPalette, setShowPalette] = useState(false)
  const showPropertyPanel = Boolean(selectedNodeId && selectedNodeIds.length === 1)

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
              setShowPalette(false)
              selectNode(null)
            }}
            className="fixed inset-0 z-30 bg-black/30 backdrop-blur-[1px] lg:hidden"
          />
        )}
        <div className={`${showPalette ? "fixed" : "hidden"} inset-y-0 left-0 z-40 h-full shadow-2xl lg:static lg:z-auto lg:flex lg:shadow-none`}>
          <NodePalette
            onNodeAdded={() => setShowPalette(false)}
            onRequestClose={() => setShowPalette(false)}
          />
        </div>
        <div className="relative min-w-0 flex-1">
          {!showPalette && selectedNodeIds.length < 2 && (
            <div className="absolute bottom-3 left-14 z-20 flex gap-1 lg:hidden">
            <button
              type="button"
              onClick={() => {
                selectNode(null)
                setShowPalette(true)
              }}
              aria-expanded={showPalette}
              className="min-h-11 rounded-full bg-[var(--md-sys-color-inverse-surface)] px-4 text-xs font-semibold text-[var(--md-sys-color-inverse-on-surface)] shadow-lg"
            >
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
