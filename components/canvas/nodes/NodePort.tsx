"use client"

import { useRef, type CSSProperties } from "react"
import { Handle, Position } from "@xyflow/react"
import { Plus } from "lucide-react"
import { TYPE_COLORS } from "@/lib/canvas/types/primitives"
import type { DataType } from "@/lib/canvas/types"
import { useTranslations } from "@/hooks/use-translations"
import { zhCanvas } from "@/lib/translations/zh-namespaces/canvas"
import { requestPortPicker } from "../canvas-events"

interface NodePortProps {
  nodeId: string
  /** target：左侧的输入端口；source：右侧的输出端口 */
  side: "target" | "source"
  port: { id: string; name: string; dataType: DataType }
}

/** “+”向鼠标偏过去的幅度：鼠标离圆心多远，它就跟过去这么大的比例 */
const PULL = 0.5
/** 按下和松开相距超过这么多（屏幕像素）算拖线，不算点击 */
const DRAG_SLOP = 3

type PortStyle = CSSProperties & { "--port-color": string }

/**
 * 节点边上的一个连接点。
 *
 * 平时是一个按数据类型上色的小圆点。鼠标靠近时它长成一个“+”，并朝鼠标偏过去一点，
 * 所以不用对准那个 12px 的圆点（样式在 app/globals.css 的 .canvas-port）。
 *
 * 按住拖：拉连线，这是 React Flow 的 Handle 本来就做的事。
 * 点一下：右侧的输出端口问“接下来做什么”，左侧的输入端口问“数据从哪来”，
 * 选了节点就加上并连好线。
 */
export function NodePort({ nodeId, side, port }: NodePortProps) {
  const t = useTranslations("canvas", zhCanvas)
  const zoneRef = useRef<HTMLSpanElement>(null)
  const pressRef = useRef<{ x: number; y: number } | null>(null)
  const isSource = side === "source"
  const label = `${isSource ? t("appendNextNode") : t("prependNode")}: ${port.name}`

  // 直接写到元素的 CSS 变量上，不经过 React：鼠标每动一下都要更新
  const lean = (event: React.PointerEvent) => {
    const zone = zoneRef.current
    if (!zone) return
    const bounds = zone.getBoundingClientRect()
    if (bounds.width === 0 || bounds.height === 0) return
    // 换算成这块区域的百分比，和画布缩放到多少无关
    const share = (offset: number, size: number) =>
      `${Math.round(Math.max(-0.5, Math.min(0.5, offset / size)) * PULL * 1000) / 10}%`
    zone.style.setProperty("--port-x", share(event.clientX - (bounds.left + bounds.width / 2), bounds.width))
    zone.style.setProperty("--port-y", share(event.clientY - (bounds.top + bounds.height / 2), bounds.height))
  }

  const settle = () => {
    zoneRef.current?.style.removeProperty("--port-x")
    zoneRef.current?.style.removeProperty("--port-y")
  }

  const style: PortStyle = {
    "--port-color": TYPE_COLORS[port.dataType] ?? "#94a3b8",
    // 端口坐在卡片的边线上：它所在的那一格在卡片里面，往外挪 12px
    position: "relative",
    transform: "none",
    ...(isSource ? { right: -12 } : { left: -12 }),
  }

  return (
    <Handle
      type={side}
      position={isSource ? Position.Right : Position.Left}
      id={port.id}
      className="canvas-port"
      style={style}
      role="button"
      // 不进 Tab 序列：一个节点有好几个端口，键盘从节点的右键菜单走
      tabIndex={-1}
      aria-label={label}
      title={label}
      onPointerMove={lean}
      onPointerLeave={settle}
      onMouseDown={(event) => {
        pressRef.current = { x: event.clientX, y: event.clientY }
      }}
      // 传了 onClick，React Flow 自带的“点一个端口再点另一个来连线”就不再生效
      onClick={(event) => {
        const press = pressRef.current
        pressRef.current = null
        // 拖出一小段又在原处松手：那是一次拖线，React Flow 已经处理过了
        if (press && Math.hypot(event.clientX - press.x, event.clientY - press.y) > DRAG_SLOP) return
        const bounds = (zoneRef.current ?? event.currentTarget).getBoundingClientRect()
        requestPortPicker({
          nodeId,
          portId: port.id,
          side,
          anchor: { x: isSource ? bounds.right : bounds.left, y: bounds.top },
        })
      }}
    >
      <span ref={zoneRef} aria-hidden="true" className="canvas-port-zone">
        <span className="canvas-port-dot">
          <Plus />
        </span>
      </span>
    </Handle>
  )
}
