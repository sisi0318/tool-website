import { beforeEach, describe, expect, it } from "vitest"
import { hasUnsavedCanvasChanges, useCanvasStore } from "./store"

const node = (id: string, x = 0) => ({ id, type: "string", position: { x, y: 0 }, config: { value: id } })

beforeEach(() => {
  localStorage.clear()
  useCanvasStore.setState({ nodes: [], edges: [], currentWorkflow: null, autoRun: false })
})

describe("current workflow", () => {
  it("is unsaved when an unnamed canvas has nodes, and clean right after saving", () => {
    expect(hasUnsavedCanvasChanges(useCanvasStore.getState())).toBe(false)
    useCanvasStore.setState({ nodes: [node("a")] })
    expect(hasUnsavedCanvasChanges(useCanvasStore.getState())).toBe(true)

    useCanvasStore.getState().setCurrentWorkflow("Daily report")
    expect(hasUnsavedCanvasChanges(useCanvasStore.getState())).toBe(false)
    useCanvasStore.setState({ nodes: [node("a", 40)] })
    expect(hasUnsavedCanvasChanges(useCanvasStore.getState())).toBe(true)
  })

  it("remembers the name across a reload and forgets it for a new or replaced canvas", () => {
    useCanvasStore.setState({ nodes: [node("a")] })
    useCanvasStore.getState().saveToLocalStorage()
    useCanvasStore.getState().setCurrentWorkflow("Daily report")
    useCanvasStore.setState({ currentWorkflow: null })

    useCanvasStore.getState().loadFromLocalStorage()
    expect(useCanvasStore.getState().currentWorkflow?.name).toBe("Daily report")

    useCanvasStore.getState().replaceWorkflow({ nodes: [node("b")], edges: [] })
    expect(useCanvasStore.getState().currentWorkflow).toBeNull()
    useCanvasStore.getState().setCurrentWorkflow("Other")
    useCanvasStore.getState().clearCanvas()
    expect(useCanvasStore.getState().currentWorkflow).toBeNull()
    expect(localStorage.getItem("canvas-current-workflow")).toBeNull()
  })
})
