import React, { memo } from "react"
import { act, render, screen } from "@testing-library/react"
import { ReactFlowProvider } from "@xyflow/react"
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import { useCanvasStore } from "@/lib/canvas/store"
import { clearRegistry, registerNode } from "@/lib/canvas/registry"
import { Canvas } from "./Canvas"

const renders = vi.hoisted(() => new Map<string, number>())
// 节点组件换成只计数的 memo 组件：data 引用不变就不该重渲染
vi.mock("./nodes/BaseNode", () => ({
  BaseNode: memo(function CountingNode({ data }: { data: { id: string } }) {
    renders.set(data.id, (renders.get(data.id) ?? 0) + 1)
    return <div data-testid={`node-${data.id}`} />
  }),
}))
vi.mock("@/hooks/use-translations", () => { const translate = (key: string) => key; return { useTranslations: () => translate } })

beforeAll(() => {
  // React Flow 在 jsdom 里要用到的浏览器接口
  class DOMMatrixStub { m22 = 1; constructor() {} }
  vi.stubGlobal("DOMMatrixReadOnly", DOMMatrixStub)
})

beforeEach(() => {
  renders.clear()
  clearRegistry()
  registerNode({ type: "string", label: "Text", category: "basic", icon: (() => null) as never, config: [{ id: "value", name: "Value", dataType: "string", hasOutput: true }], outputs: [], execute: async (_inputs, config) => ({ value: config.value }) })
  useCanvasStore.setState({
    nodes: [
      { id: "a", type: "string", position: { x: 0, y: 0 }, config: { value: "a" } },
      { id: "b", type: "string", position: { x: 300, y: 0 }, config: { value: "b" } },
    ],
    edges: [],
    selectedNodeIds: [],
    selectedNodeId: null,
    autoRun: false,
  })
})

describe("canvas rendering", () => {
  it("re-renders only the node that changed", async () => {
    render(<ReactFlowProvider><Canvas /></ReactFlowProvider>)
    await screen.findByTestId("node-b")
    const before = renders.get("b")

    act(() => useCanvasStore.getState().updateNodePosition("a", { x: 40, y: 40 }))
    act(() => useCanvasStore.getState().updateNodeConfig("a", { value: "changed" }))
    expect(renders.get("a")).toBeGreaterThan(1)
    expect(renders.get("b")).toBe(before)
  })
})
