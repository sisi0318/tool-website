import { fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { APPEND_NODE_EVENT, type AppendNodeRequest } from "../canvas-events"
import { NodeAppendZone } from "./NodeAppendZone"

vi.mock("@/hooks/use-translations", () => { const translate = (key: string) => key; return { useTranslations: () => translate } })

const rect = (left: number, top: number, width: number, height: number): DOMRect => ({
  left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => undefined,
})

const requests: AppendNodeRequest[] = []
const record = (event: Event) => requests.push((event as CustomEvent<AppendNodeRequest>).detail)

/** 像 React Flow 那样把它放在节点里，旁边是真正的输出端口；这条区域在屏幕上是 40×200，左上角在 (100, 200) */
function mount(pinned = false) {
  render(
    <div className="react-flow__node">
      <div className="react-flow__handle source" data-handleid="mode" data-testid="other-port" />
      <div className="react-flow__handle source" data-handleid="output" data-testid="port" />
      <NodeAppendZone nodeId="encode" portId="output" pinned={pinned} />
    </div>
  )
  const zone = screen.getByRole("button", { name: "appendNextNode" })
  vi.spyOn(zone, "getBoundingClientRect").mockReturnValue(rect(100, 200, 40, 200))
  vi.spyOn(zone.firstElementChild!, "getBoundingClientRect").mockReturnValue(rect(104, 284, 32, 32))
  return zone
}

const position = (zone: HTMLElement) => [zone.style.getPropertyValue("--append-x"), zone.style.getPropertyValue("--append-y")]

beforeEach(() => {
  requests.length = 0
  window.addEventListener(APPEND_NODE_EVENT, record)
})
afterEach(() => window.removeEventListener(APPEND_NODE_EVENT, record))

describe("NodeAppendZone", () => {
  it("moves the + to the pointer while it is inside the strip, and back to the middle when it leaves", () => {
    const zone = mount()
    expect(position(zone)).toEqual(["", ""])

    fireEvent.pointerMove(zone, { clientX: 120, clientY: 260 })
    expect(position(zone)).toEqual(["50%", "30%"])

    fireEvent.pointerMove(zone, { clientX: 122, clientY: 350 })
    expect(position(zone)).toEqual(["55%", "75%"])

    fireEvent.pointerLeave(zone)
    expect(position(zone)).toEqual(["", ""])
  })

  it("keeps the whole + inside the strip at its edges", () => {
    const zone = mount()
    // 贴着上边和左边：圆心离边至少一个半径（16px）
    fireEvent.pointerMove(zone, { clientX: 101, clientY: 203 })
    expect(position(zone)).toEqual(["40%", "8%"])
    fireEvent.pointerMove(zone, { clientX: 139, clientY: 399 })
    expect(position(zone)).toEqual(["60%", "92%"])
  })

  it("asks the canvas for the next-node list when clicked, anchored at the +", () => {
    const zone = mount()
    fireEvent.mouseDown(zone, { button: 0, clientX: 120, clientY: 300 })
    fireEvent.click(zone)
    expect(requests).toEqual([{ nodeId: "encode", anchor: { x: 136, y: 284 } }])
  })

  it("opens from the keyboard as well", () => {
    const zone = mount()
    fireEvent.keyDown(zone, { key: "Enter" })
    fireEvent.keyDown(zone, { key: " " })
    fireEvent.keyDown(zone, { key: "a" })
    expect(requests).toHaveLength(2)
  })

  it("hands a press over to the node's result port, so dragging pulls a connection from it", () => {
    const zone = mount()
    const port = screen.getByTestId("port")
    const other = screen.getByTestId("other-port")
    const received: Array<{ x: number; y: number; button: number }> = []
    port.addEventListener("mousedown", (event) => received.push({ x: event.clientX, y: event.clientY, button: event.button }))
    const onOther = vi.fn()
    other.addEventListener("mousedown", onOther)

    fireEvent.mouseDown(zone, { button: 0, clientX: 121, clientY: 310 })
    expect(received).toEqual([{ x: 121, y: 310, button: 0 }])
    // 只交给主输出，不是节点上随便哪个能往外连的端口
    expect(onOther).not.toHaveBeenCalled()

    // 右键不拉线（那是平移画布和右键菜单的）
    fireEvent.mouseDown(zone, { button: 2, clientX: 121, clientY: 310 })
    expect(received).toHaveLength(1)
  })

  it("does not also open the list when the press turned into a drag", () => {
    const zone = mount()
    fireEvent.mouseDown(zone, { button: 0, clientX: 120, clientY: 260 })
    fireEvent.pointerMove(zone, { clientX: 124, clientY: 300 })
    fireEvent.click(zone)
    expect(requests).toEqual([])

    // 下一次单纯的点击照常
    fireEvent.mouseDown(zone, { button: 0, clientX: 120, clientY: 260 })
    fireEvent.pointerMove(zone, { clientX: 121, clientY: 261 })
    fireEvent.click(zone)
    expect(requests).toHaveLength(1)
  })

  it("marks the + as always shown on the selected node", () => {
    expect(mount(true)).toHaveAttribute("data-pinned", "true")
  })
})
