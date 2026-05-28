import { describe, it, expect } from "vitest"
import { topologicalSort } from "./engine"
import type { NodeInstance, Edge } from "./types"

describe("topologicalSort", () => {
  it("无依赖的节点按原顺序返回", () => {
    const nodes: NodeInstance[] = [
      { id: "a", type: "string", position: { x: 0, y: 0 }, config: {} },
      { id: "b", type: "number", position: { x: 0, y: 0 }, config: {} },
    ]
    const { sorted, hasCycle } = topologicalSort(nodes, [])
    expect(sorted.map((n) => n.id)).toEqual(["a", "b"])
    expect(hasCycle).toBe(false)
  })

  it("有依赖的节点按拓扑序返回", () => {
    const nodes: NodeInstance[] = [
      { id: "b", type: "hash", position: { x: 0, y: 0 }, config: {} },
      { id: "a", type: "string", position: { x: 0, y: 0 }, config: {} },
    ]
    const edges: Edge[] = [
      { id: "e1", source: "a", sourcePort: "out", target: "b", targetPort: "data" },
    ]
    const { sorted, hasCycle } = topologicalSort(nodes, edges)
    expect(sorted.map((n) => n.id)).toEqual(["a", "b"])
    expect(hasCycle).toBe(false)
  })

  it("环形依赖时只返回无环部分并标记", () => {
    const nodes: NodeInstance[] = [
      { id: "a", type: "x", position: { x: 0, y: 0 }, config: {} },
      { id: "b", type: "x", position: { x: 0, y: 0 }, config: {} },
    ]
    const edges: Edge[] = [
      { id: "e1", source: "a", sourcePort: "o", target: "b", targetPort: "i" },
      { id: "e2", source: "b", sourcePort: "o", target: "a", targetPort: "i" },
    ]
    const { sorted, hasCycle } = topologicalSort(nodes, edges)
    expect(sorted.length).toBe(0)
    expect(hasCycle).toBe(true)
  })
})
