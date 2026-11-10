"use client"

import { useRef } from "react"
import { Plus } from "lucide-react"
import { useTranslations } from "@/hooks/use-translations"
import { zhCanvas } from "@/lib/translations/zh-namespaces/canvas"
import { requestAppendNode } from "../canvas-events"

interface NodeAppendZoneProps {
  nodeId: string
  /** 主输出端口的 id：从“+”上拖出来的连线，就是从这个端口拖出来的 */
  portId: string
  /** 选中的那个节点上“+”一直显示；其余节点悬停时才出现 */
  pinned: boolean
}

/** “+”自己的半径（屏幕像素）：跟随时不让它探出这块区域 */
const GLYPH_RADIUS = 16
/** 按下后移动超过这么多算拖线，不算点击 */
const DRAG_SLOP = 3

/**
 * 节点右侧的“+”：接着往下加节点。
 *
 * 它不是一个固定的小按钮，而是节点右边一整条看不见的区域（样式在 app/globals.css 的
 * .canvas-append-zone）。鼠标进到这条区域里，“+”就滑到鼠标所在的高度跟着走，离开后回到
 * 中间。所以从节点的哪个高度靠过去都够得着，不用去对准边缘中点的一个小圆。
 *
 * 点一下：打开能接在这个节点后面的节点列表。
 * 按住拖：从主输出端口拉出一条连线，和直接拖那个端口一样。
 */
export function NodeAppendZone({ nodeId, portId, pinned }: NodeAppendZoneProps) {
  const t = useTranslations("canvas", zhCanvas)
  const zoneRef = useRef<HTMLDivElement>(null)
  const glyphRef = useRef<HTMLSpanElement>(null)
  const pressRef = useRef<{ x: number; y: number; dragged: boolean } | null>(null)

  // 位置直接写到元素的 CSS 变量上，不经过 React：鼠标每动一下都要更新
  const follow = (event: React.PointerEvent) => {
    const zone = zoneRef.current
    if (!zone) return
    const bounds = zone.getBoundingClientRect()
    if (bounds.width === 0 || bounds.height === 0) return
    // 圆心离这块区域的边至少一个半径；换算成百分比，和画布缩放到多少无关
    const share = (value: number, size: number) => {
      const inside = size <= GLYPH_RADIUS * 2 ? size / 2 : Math.min(Math.max(value, GLYPH_RADIUS), size - GLYPH_RADIUS)
      return `${Math.round((inside / size) * 10000) / 100}%`
    }
    zone.style.setProperty("--append-x", share(event.clientX - bounds.left, bounds.width))
    zone.style.setProperty("--append-y", share(event.clientY - bounds.top, bounds.height))

    const press = pressRef.current
    if (press && Math.hypot(event.clientX - press.x, event.clientY - press.y) > DRAG_SLOP) press.dragged = true
  }

  const rest = () => {
    zoneRef.current?.style.removeProperty("--append-x")
    zoneRef.current?.style.removeProperty("--append-y")
  }

  const open = () => {
    const glyph = glyphRef.current?.getBoundingClientRect()
    if (glyph) requestAppendNode(nodeId, { x: glyph.right, y: glyph.top })
  }

  /**
   * 把这次按下转交给真正的输出端口。接着拖动，React Flow 就从那个端口拉出连线；
   * 原地松开它什么也不做（要移动超过 1px 才算开始连线），交给 onClick 打开列表。
   * 这样不用在节点里放第二个同名端口，也不用自己实现一遍拖线。
   */
  const startConnection = (event: React.MouseEvent) => {
    if (event.button !== 0) return
    pressRef.current = { x: event.clientX, y: event.clientY, dragged: false }
    const node = zoneRef.current?.closest(".react-flow__node")
    const port = Array.from(node?.querySelectorAll<HTMLElement>(".react-flow__handle.source") ?? [])
      .find((handle) => handle.dataset.handleid === portId)
    port?.dispatchEvent(new MouseEvent("mousedown", {
      bubbles: true,
      cancelable: true,
      button: 0,
      clientX: event.clientX,
      clientY: event.clientY,
    }))
  }

  return (
    <div
      ref={zoneRef}
      role="button"
      tabIndex={0}
      aria-label={t("appendNextNode")}
      title={t("appendNextNode")}
      data-testid="node-append-button"
      data-pinned={pinned ? "true" : undefined}
      className="canvas-append-zone nodrag nopan"
      onPointerMove={follow}
      onPointerLeave={rest}
      onMouseDown={startConnection}
      onClick={() => {
        const dragged = pressRef.current?.dragged
        pressRef.current = null
        // 拖出去又拖回来松手：那是一次连线，React Flow 已经处理过了
        if (!dragged) open()
      }}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return
        event.preventDefault()
        event.stopPropagation()
        open()
      }}
    >
      <span ref={glyphRef} aria-hidden="true" className="canvas-append-glyph">
        <Plus className="h-4 w-4" />
      </span>
    </div>
  )
}
