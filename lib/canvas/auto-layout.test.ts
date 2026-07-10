import { describe, expect, it } from "vitest"
import {
  autoLayoutNodes,
  calculateNodeLayers,
  DEFAULT_AUTO_LAYOUT_OPTIONS,
} from "./auto-layout"
import type { Edge, NodeInstance } from "./types"

function node(id: string, x = -1, y = -1): NodeInstance {
  return { id, type: "test", position: { x, y }, config: {} }
}

function edge(id: string, source: string, target: string): Edge {
  return {
    id,
    source,
    sourcePort: "out",
    target,
    targetPort: "in",
  }
}

describe("calculateNodeLayers", () => {
  it("按最长依赖路径决定层级", () => {
    const nodes = [node("d"), node("b"), node("a"), node("c")]
    const edges = [
      edge("ab", "a", "b"),
      edge("ac", "a", "c"),
      edge("bd", "b", "d"),
      edge("cd", "c", "d"),
    ]

    expect(Object.fromEntries(calculateNodeLayers(nodes, edges))).toEqual({
      d: 2,
      b: 1,
      a: 0,
      c: 1,
    })
  })

  it("忽略悬空边，孤立节点位于起始层", () => {
    const nodes = [node("a"), node("isolated")]
    const edges = [edge("dangling", "missing", "a")]

    expect(Object.fromEntries(calculateNodeLayers(nodes, edges))).toEqual({
      a: 0,
      isolated: 0,
    })
  })

  it("环内节点共享一层，同时保留环前后的依赖层级", () => {
    const nodes = [node("before"), node("a"), node("b"), node("after")]
    const edges = [
      edge("before-a", "before", "a"),
      edge("a-b", "a", "b"),
      edge("b-a", "b", "a"),
      edge("b-after", "b", "after"),
    ]
    const layers = calculateNodeLayers(nodes, edges)

    expect(layers.get("before")).toBe(0)
    expect(layers.get("a")).toBe(1)
    expect(layers.get("b")).toBe(1)
    expect(layers.get("after")).toBe(2)
  })
})

describe("autoLayoutNodes", () => {
  it("空输入稳定返回空数组", () => {
    expect(autoLayoutNodes([], [])).toEqual([])
  })

  it("默认从左到右排列线性依赖", () => {
    const result = autoLayoutNodes(
      [node("a"), node("b"), node("c")],
      [edge("ab", "a", "b"), edge("bc", "b", "c")]
    )

    const step =
      DEFAULT_AUTO_LAYOUT_OPTIONS.nodeWidth +
      DEFAULT_AUTO_LAYOUT_OPTIONS.horizontalGap
    expect(result.map(({ position }) => position)).toEqual([
      {
        x: DEFAULT_AUTO_LAYOUT_OPTIONS.originX,
        y: DEFAULT_AUTO_LAYOUT_OPTIONS.originY,
      },
      {
        x: DEFAULT_AUTO_LAYOUT_OPTIONS.originX + step,
        y: DEFAULT_AUTO_LAYOUT_OPTIONS.originY,
      },
      {
        x: DEFAULT_AUTO_LAYOUT_OPTIONS.originX + step * 2,
        y: DEFAULT_AUTO_LAYOUT_OPTIONS.originY,
      },
    ])
  })

  it("同层节点保持输入顺序且纵向不重叠", () => {
    const result = autoLayoutNodes([node("second"), node("first")], [])
    const gapStep =
      DEFAULT_AUTO_LAYOUT_OPTIONS.nodeHeight +
      DEFAULT_AUTO_LAYOUT_OPTIONS.verticalGap

    expect(result[0].position).toEqual({
      x: DEFAULT_AUTO_LAYOUT_OPTIONS.originX,
      y: DEFAULT_AUTO_LAYOUT_OPTIONS.originY,
    })
    expect(result[1].position).toEqual({
      x: DEFAULT_AUTO_LAYOUT_OPTIONS.originX,
      y: DEFAULT_AUTO_LAYOUT_OPTIONS.originY + gapStep,
    })
  })

  it("孤立节点与根节点统一稳定排列", () => {
    const result = autoLayoutNodes(
      [node("root"), node("isolated"), node("target")],
      [edge("root-target", "root", "target")]
    )
    const byId = new Map(result.map((item) => [item.id, item.position]))

    expect(byId.get("root")!.x).toBe(byId.get("isolated")!.x)
    expect(byId.get("isolated")!.y).toBeGreaterThan(byId.get("root")!.y)
    expect(byId.get("target")!.x).toBeGreaterThan(byId.get("root")!.x)
  })

  it("环形工作流仍为每个节点生成互不重叠的位置", () => {
    const result = autoLayoutNodes(
      [node("before"), node("a"), node("b"), node("after")],
      [
        edge("before-a", "before", "a"),
        edge("a-b", "a", "b"),
        edge("b-a", "b", "a"),
        edge("b-after", "b", "after"),
      ]
    )
    const byId = new Map(result.map((item) => [item.id, item.position]))
    const uniquePositions = new Set(
      result.map((item) => `${item.position.x}:${item.position.y}`)
    )

    expect(result).toHaveLength(4)
    expect(uniquePositions.size).toBe(4)
    expect(byId.get("a")!.x).toBe(byId.get("b")!.x)
    expect(byId.get("before")!.x).toBeLessThan(byId.get("a")!.x)
    expect(byId.get("after")!.x).toBeGreaterThan(byId.get("a")!.x)
  })

  it("支持自定义原点、间距和逐节点尺寸", () => {
    const nodes = [node("short"), node("wide"), node("target")]
    const result = autoLayoutNodes(
      nodes,
      [edge("short-target", "short", "target")],
      {
        origin: { x: 10, y: 20 },
        horizontalGap: 30,
        verticalGap: 15,
        getNodeSize: (item) => {
          if (item.id === "short") return { width: 120, height: 100 }
          if (item.id === "wide") return { width: 250, height: 200 }
          return { width: 80, height: 90 }
        },
      }
    )
    const byId = new Map(result.map((item) => [item.id, item.position]))

    expect(byId.get("short")).toEqual({ x: 10, y: 20 })
    expect(byId.get("wide")).toEqual({ x: 10, y: 135 })
    expect(byId.get("target")).toEqual({ x: 290, y: 20 })
  })

  it("不修改输入节点，并保持输出顺序和业务数据", () => {
    const nodes = [
      {
        ...node("a", 900, 800),
        type: "hash",
        config: { algorithm: "sha256" },
      },
    ]
    const originalPosition = { ...nodes[0].position }
    const result = autoLayoutNodes(nodes, [])

    expect(nodes[0].position).toEqual(originalPosition)
    expect(result[0]).not.toBe(nodes[0])
    expect(result[0].id).toBe("a")
    expect(result[0].type).toBe("hash")
    expect(result[0].config).toEqual({ algorithm: "sha256" })
  })

  it("相同输入始终产生相同结果", () => {
    const nodes = [node("c"), node("a"), node("b")]
    const edges = [edge("a-b", "a", "b"), edge("b-c", "b", "c")]

    expect(autoLayoutNodes(nodes, edges)).toEqual(autoLayoutNodes(nodes, edges))
  })
})
