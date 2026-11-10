"use client"

import { useCallback, useRef, useState } from "react"
import { useReactFlow } from "@xyflow/react"
import { useCanvasStore } from "@/lib/canvas/store"
import {
  createClipboardPayload,
  instantiateClipboardPayload,
  type CanvasClipboardPayload,
} from "@/lib/canvas/clipboard"

interface Point {
  x: number
  y: number
}

/** 画布底部那条一闪而过的提示 */
export type CanvasNotify = (message: string, tone?: "error" | "success") => void

/** 让这批节点的中心落在画布坐标 center 上，需要整体挪多少 */
function getOffsetToCenter(payload: CanvasClipboardPayload, center: Point): Point {
  if (payload.nodes.length === 0) return { x: 0, y: 0 }
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const node of payload.nodes) {
    minX = Math.min(minX, node.position.x)
    minY = Math.min(minY, node.position.y)
    maxX = Math.max(maxX, node.position.x)
    maxY = Math.max(maxY, node.position.y)
  }
  return {
    x: center.x - (minX + maxX) / 2,
    y: center.y - (minY + maxY) / 2,
  }
}

function insertPayload(payload: CanvasClipboardPayload, offset: Point): number {
  const pasted = instantiateClipboardPayload(payload, offset)
  if (pasted.nodes.length === 0) return 0

  const { addSubgraph, selectNodes } = useCanvasStore.getState()
  addSubgraph(pasted)
  selectNodes(pasted.nodes.map((node) => node.id))
  return pasted.nodes.length
}

/**
 * 节点的复制、粘贴和创建副本。剪贴板只存在这张画布的内存里，不经过系统剪贴板。
 * 三个操作都在调用时才读 store，所以引用不随节点变化而变。
 */
export function useCanvasClipboard(notify: CanvasNotify, t: (key: string) => string) {
  const { screenToFlowPosition } = useReactFlow()
  const clipboardRef = useRef<CanvasClipboardPayload | null>(null)
  const pasteSequenceRef = useRef(0)
  const lastPasteOffsetRef = useRef<Point | null>(null)
  const [hasClipboard, setHasClipboard] = useState(false)

  const copySelection = useCallback(() => {
    const { nodes, edges, selectedNodeIds } = useCanvasStore.getState()
    if (selectedNodeIds.length === 0) return false

    const payload = createClipboardPayload(nodes, edges, new Set(selectedNodeIds))
    if (payload.nodes.length === 0) return false

    clipboardRef.current = payload
    pasteSequenceRef.current = 0
    lastPasteOffsetRef.current = null
    setHasClipboard(true)
    notify(t("nodesCopied").replace("{count}", String(payload.nodes.length)), "success")
    return true
  }, [notify, t])

  /**
   * 快捷键粘贴：第一次落在视口中央，接着再粘就逐次错开。
   * 右键菜单粘贴会带上 at（画布坐标），落在右键的位置。
   */
  const pasteSelection = useCallback((at?: Point) => {
    const payload = clipboardRef.current
    if (!payload) return false
    const offset = at
      ? getOffsetToCenter(payload, at)
      : pasteSequenceRef.current === 0 || !lastPasteOffsetRef.current
        ? getOffsetToCenter(payload, screenToFlowPosition({
            x: window.innerWidth / 2,
            y: window.innerHeight / 2,
          }))
        : {
            x: lastPasteOffsetRef.current.x + 40,
            y: lastPasteOffsetRef.current.y + 40,
          }
    pasteSequenceRef.current += 1
    lastPasteOffsetRef.current = offset
    const count = insertPayload(payload, offset)
    if (count === 0) return false

    notify(t("nodesPasted").replace("{count}", String(count)), "success")
    return true
  }, [notify, screenToFlowPosition, t])

  const duplicateSelection = useCallback(() => {
    const { nodes, edges, selectedNodeIds } = useCanvasStore.getState()
    if (selectedNodeIds.length === 0) return false
    const payload = createClipboardPayload(nodes, edges, new Set(selectedNodeIds))
    const count = insertPayload(payload, { x: 40, y: 40 })
    if (count === 0) return false

    notify(t("nodesDuplicated").replace("{count}", String(count)), "success")
    return true
  }, [notify, t])

  return { copySelection, pasteSelection, duplicateSelection, hasClipboard }
}
