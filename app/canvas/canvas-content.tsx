"use client"

import { useEffect, useState } from "react"
import { ReactFlowProvider } from "@xyflow/react"
import { Canvas } from "@/components/canvas/Canvas"
import { WorkflowSaveController } from "@/components/canvas/workflow/WorkflowSaveController"
import { stopPendingCanvasWork, useCanvasStore } from "@/lib/canvas/store"
import { registerAllAdapters } from "@/lib/adapters"

registerAllAdapters()

// e2e 用的调试钩子。生产包里不应该暴露内部 store,只在显式开启时挂载。
if (typeof window !== "undefined" && process.env.NEXT_PUBLIC_E2E === "true") {
  (window as any).__ZUSTAND_STORE__ = useCanvasStore
}

/**
 * 画布页：画布铺满整屏，工具条、节点库、属性卡片都浮在它上面（见 components/canvas/Canvas.tsx）。
 * 以前左右各有一条 288px 的固定面板，选中节点时 1280 宽的屏幕上画布只剩 704px。
 */
export default function CanvasContent() {
  const loadFromLocalStorage = useCanvasStore((s) => s.loadFromLocalStorage)
  // 先读回上次的画布再挂画布组件：它挂上的那一刻要知道画布上有没有节点（决定要不要适应视野）
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    loadFromLocalStorage()
    setLoaded(true)
    // 防抖的自动执行与自动保存挂在模块作用域,卸载时必须清掉,
    // 否则离开画布后仍会触发执行(含网络请求)并写回 store。
    return () => stopPendingCanvasWork()
  }, [loadFromLocalStorage])

  return (
    <div className="canvas-shell relative h-[100dvh] overflow-hidden bg-[var(--md-sys-color-surface)]">
      <ReactFlowProvider>
        <WorkflowSaveController />
        {loaded && <Canvas />}
      </ReactFlowProvider>
    </div>
  )
}
