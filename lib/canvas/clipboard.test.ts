import { describe, expect, it } from "vitest"
import { createClipboardPayload, instantiateClipboardPayload } from "./clipboard"
import type { Edge, NodeInstance } from "./types"

const nodes: NodeInstance[] = [
  { id: "a", type: "string", position: { x: 10, y: 20 }, config: { value: "a" } },
  { id: "b", type: "hash", position: { x: 300, y: 20 }, config: { algorithm: "md5" } },
  { id: "c", type: "string-preview", position: { x: 600, y: 20 }, config: {} },
]

const edges: Edge[] = [
  { id: "a-b", source: "a", sourcePort: "value", target: "b", targetPort: "data" },
  { id: "b-c", source: "b", sourcePort: "hash", target: "c", targetPort: "content" },
]

describe("canvas clipboard", () => {
  it("只复制所选节点以及选择内部的连线", () => {
    const payload = createClipboardPayload(nodes, edges, new Set(["a", "b"]))

    expect(payload.nodes.map((node) => node.id)).toEqual(["a", "b"])
    expect(payload.edges).toEqual([edges[0]])
  })

  it("粘贴时生成新 id、保持内部连线并应用偏移", () => {
    const payload = createClipboardPayload(nodes, edges, new Set(["a", "b"]))
    const pasted = instantiateClipboardPayload(payload, { x: 48, y: 64 })

    expect(pasted.nodes).toHaveLength(2)
    expect(pasted.nodes[0].id).not.toBe("a")
    expect(pasted.nodes[1].id).not.toBe("b")
    expect(pasted.nodes[0].position).toEqual({ x: 58, y: 84 })
    expect(pasted.edges).toHaveLength(1)
    expect(pasted.edges[0]).toMatchObject({
      source: pasted.nodes[0].id,
      target: pasted.nodes[1].id,
      sourcePort: "value",
      targetPort: "data",
    })
  })

  it("没有选择时返回空载荷", () => {
    expect(createClipboardPayload(nodes, edges, new Set())).toEqual({ nodes: [], edges: [] })
  })
})
