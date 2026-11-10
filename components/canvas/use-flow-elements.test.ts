import { renderHook } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import type { Edge, NodeInstance } from "@/lib/canvas/types"
import { ACTIVE_EDGE_CLASS, useFlowElements } from "./use-flow-elements"

vi.mock("@/lib/canvas/registry", () => ({
  getNodeDefinition: (type: string) =>
    type === "missing"
      ? undefined
      : {
          type,
          label: type,
          category: type === "hash" ? "crypto" : "basic",
          icon: () => null,
          config: [{ id: "value", name: "Value", dataType: type === "number" ? "number" : "string", hasInput: true, hasOutput: true }],
          outputs: [{ id: "result", name: "Result", dataType: "json" }],
        },
}))

const node = (id: string, type = "string"): NodeInstance => ({ id, type, position: { x: 0, y: 0 }, config: {} })
const edge = (id: string, source: string, target: string, sourcePort = "value"): Edge => ({ id, source, sourcePort, target, targetPort: "value" })

const NODES = [node("a"), node("b", "hash"), node("c", "number"), node("d", "hash")]
const EDGES = [edge("ab", "a", "b"), edge("cd", "c", "d"), edge("bd", "b", "d", "result")]

interface Input {
  nodes: NodeInstance[]
  edges: Edge[]
  selectedNodeIds: string[]
  nodeRunning: Record<string, boolean>
}

const render = (initial: Partial<Input> = {}) =>
  renderHook((input: Input) => useFlowElements(input), {
    initialProps: { nodes: NODES, edges: EDGES, selectedNodeIds: [], nodeRunning: {}, ...initial },
  })

describe("useFlowElements", () => {
  it("maps store nodes to flow nodes, choosing the card by category", () => {
    const { result } = render({ nodes: [...NODES, node("x", "missing")], selectedNodeIds: ["b"] })
    expect(result.current.flowNodes.map((flow) => [flow.id, flow.type, flow.selected])).toEqual([
      ["a", "base", false],
      ["b", "tool", true],
      ["c", "base", false],
      ["d", "tool", false],
      // 没注册的类型也照样画出来（节点卡片自己提示“未知节点”）
      ["x", "tool", false],
    ])
  })

  it("colours each edge by the data type of the port it leaves from", () => {
    const { result } = render()
    const stroke = Object.fromEntries(result.current.flowEdges.map((flow) => [flow.id, flow.style?.stroke]))
    expect(stroke.ab).toBe("#3b82f6")
    expect(stroke.cd).toBe("#22c55e")
    expect(stroke.bd).toBe("#a855f7")
    // 粗细交给样式表，行内样式里不能再写，否则悬停和选中的加粗不生效
    expect(result.current.flowEdges.every((flow) => flow.style?.strokeWidth === undefined)).toBe(true)
  })

  it("marks only the edges attached to a selected node", () => {
    const { result, rerender } = render()
    const active = () => result.current.flowEdges.filter((flow) => flow.className === ACTIVE_EDGE_CLASS).map((flow) => flow.id)
    expect(active()).toEqual([])

    rerender({ nodes: NODES, edges: EDGES, selectedNodeIds: ["b"], nodeRunning: {} })
    expect(active()).toEqual(["ab", "bd"])

    rerender({ nodes: NODES, edges: EDGES, selectedNodeIds: ["a", "c"], nodeRunning: {} })
    expect(active()).toEqual(["ab", "cd"])
  })

  it("animates the edges on either side of a running node", () => {
    const { result } = render({ nodeRunning: { d: true } })
    expect(result.current.flowEdges.filter((flow) => flow.animated).map((flow) => flow.id)).toEqual(["cd", "bd"])
  })

  it("keeps the same objects for nodes and edges that did not change", () => {
    const { result, rerender } = render()
    const before = result.current

    rerender({ nodes: NODES, edges: EDGES, selectedNodeIds: ["a"], nodeRunning: {} })
    const after = result.current
    // 只有 a 和连着它的那条线换了新对象；其余的引用不变，对应的组件不用重渲染
    expect(after.flowNodes[0]).not.toBe(before.flowNodes[0])
    expect(after.flowNodes.slice(1)).toEqual(before.flowNodes.slice(1))
    after.flowNodes.slice(1).forEach((flow, index) => expect(flow).toBe(before.flowNodes[index + 1]))
    expect(after.flowEdges[0]).not.toBe(before.flowEdges[0])
    expect(after.flowEdges[1]).toBe(before.flowEdges[1])
    expect(after.flowEdges[2]).toBe(before.flowEdges[2])
  })
})
