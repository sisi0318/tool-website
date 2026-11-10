import type { HTMLAttributes, ReactNode } from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { PORT_PICKER_EVENT, type PortPickerRequest } from "../canvas-events"
import { NodePort } from "./NodePort"

vi.mock("@/hooks/use-translations", () => { const translate = (key: string) => key; return { useTranslations: () => translate } })

// React Flow 的 Handle 要在它的节点上下文里才能用；这里只关心我们往上面加的东西
vi.mock("@xyflow/react", () => ({
  Position: { Left: "left", Right: "right" },
  Handle: ({ type, position, id, children, ...rest }: HTMLAttributes<HTMLDivElement> & { type: string; position: string; id: string; children?: ReactNode }) => (
    <div data-handleid={id} data-handlepos={position} data-handletype={type} {...rest}>{children}</div>
  ),
}))

const rect = (left: number, top: number, width: number, height: number): DOMRect => ({
  left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => undefined,
})

const requests: PortPickerRequest[] = []
const record = (event: Event) => requests.push((event as CustomEvent<PortPickerRequest>).detail)

/** 感应区在屏幕上是 28×26，左上角在 (100, 200)，中心 (114, 213) */
function mount(side: "source" | "target") {
  render(<NodePort nodeId="encode" side={side} port={{ id: "output", name: "Output", dataType: "string" }} />)
  const port = screen.getByRole("button")
  const zone = port.firstElementChild as HTMLElement
  vi.spyOn(zone, "getBoundingClientRect").mockReturnValue(rect(100, 200, 28, 26))
  return { port, zone }
}

const lean = (zone: HTMLElement) => [zone.style.getPropertyValue("--port-x"), zone.style.getPropertyValue("--port-y")]

beforeEach(() => {
  requests.length = 0
  window.addEventListener(PORT_PICKER_EVENT, record)
})
afterEach(() => window.removeEventListener(PORT_PICKER_EVENT, record))

describe("NodePort", () => {
  it("is a source handle on the right or a target handle on the left, named for what clicking it does", () => {
    const { port } = mount("source")
    expect(port).toHaveAttribute("data-handletype", "source")
    expect(port).toHaveAttribute("data-handlepos", "right")
    expect(port).toHaveAttribute("data-handleid", "output")
    expect(port).toHaveAccessibleName("appendNextNode: Output")
    // 颜色按数据类型
    expect(port.style.getPropertyValue("--port-color")).toBe("#3b82f6")
  })

  it("names an input port for adding a node before it", () => {
    const { port } = mount("target")
    expect(port).toHaveAttribute("data-handletype", "target")
    expect(port).toHaveAttribute("data-handlepos", "left")
    expect(port).toHaveAccessibleName("prependNode: Output")
  })

  it("leans toward the pointer while it is near, by half the distance, and settles when it leaves", () => {
    const { port, zone } = mount("source")
    expect(lean(zone)).toEqual(["", ""])

    // 圆心右边 7px、下边 6.5px：分别是感应区宽、高的四分之一，跟过去一半
    fireEvent.pointerMove(port, { clientX: 121, clientY: 219.5 })
    expect(lean(zone)).toEqual(["12.5%", "12.5%"])

    fireEvent.pointerMove(port, { clientX: 100, clientY: 213 })
    expect(lean(zone)).toEqual(["-25%", "0%"])

    // 再远也不超过感应区边上的那一半
    fireEvent.pointerMove(port, { clientX: 400, clientY: -300 })
    expect(lean(zone)).toEqual(["25%", "-25%"])

    fireEvent.pointerLeave(port)
    expect(lean(zone)).toEqual(["", ""])
  })

  it("asks for the nodes that can follow when an output port is clicked", () => {
    const { port } = mount("source")
    fireEvent.mouseDown(port, { button: 0, clientX: 114, clientY: 213 })
    fireEvent.click(port, { clientX: 114, clientY: 213 })
    // 列表贴着端口朝外的那一边
    expect(requests).toEqual([{ nodeId: "encode", portId: "output", side: "source", anchor: { x: 128, y: 200 } }])
  })

  it("asks for the nodes that can feed it when an input port is clicked", () => {
    const { port } = mount("target")
    fireEvent.click(port, { clientX: 114, clientY: 213 })
    expect(requests).toEqual([{ nodeId: "encode", portId: "output", side: "target", anchor: { x: 100, y: 200 } }])
  })

  it("does not open the list when the press was the start of a connection drag", () => {
    const { port } = mount("source")
    fireEvent.mouseDown(port, { button: 0, clientX: 114, clientY: 213 })
    fireEvent.click(port, { clientX: 120, clientY: 213 })
    expect(requests).toEqual([])

    // 手稍微抖一下还算点击
    fireEvent.mouseDown(port, { button: 0, clientX: 114, clientY: 213 })
    fireEvent.click(port, { clientX: 115, clientY: 214 })
    expect(requests).toHaveLength(1)
  })
})
