import React from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { hasUnsavedCanvasChanges, useCanvasStore } from "@/lib/canvas/store"
import { loadWorkflow, saveWorkflow } from "@/lib/canvas/workflow"
import { WorkflowLoadButton } from "./WorkflowLoadButton"
import { WorkflowNewButton } from "./WorkflowNewButton"

vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }))
vi.mock("@/hooks/use-translations", () => ({ useTranslations: () => (key: string) => key }))

const node = (id: string, x = 0) => ({ id, type: "string", position: { x, y: 0 }, config: { value: id } })

beforeEach(() => {
  localStorage.clear()
  useCanvasStore.setState({ nodes: [], edges: [], currentWorkflow: null, autoRun: false })
  saveWorkflow("Saved", { nodes: [node("saved")], edges: [] })
})

describe("WorkflowLoadButton", () => {
  it("opens a workflow straight away when nothing would be lost, and remembers its name", () => {
    render(<WorkflowLoadButton />)
    fireEvent.click(screen.getByRole("button", { name: "load" }))
    fireEvent.click(screen.getByRole("button", { name: "Saved" }))
    expect(useCanvasStore.getState().nodes.map((item) => item.id)).toEqual(["saved"])
    expect(useCanvasStore.getState().currentWorkflow?.name).toBe("Saved")
    expect(hasUnsavedCanvasChanges(useCanvasStore.getState())).toBe(false)
  })

  it("asks before replacing unsaved work", () => {
    useCanvasStore.setState({ nodes: [node("draft")] })
    render(<WorkflowLoadButton />)
    fireEvent.click(screen.getByRole("button", { name: "load" }))
    fireEvent.click(screen.getByRole("button", { name: "Saved" }))
    expect(screen.getByRole("alertdialog", { name: "replaceCanvasTitle" })).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "cancel" }))
    expect(useCanvasStore.getState().nodes.map((item) => item.id)).toEqual(["draft"])
    fireEvent.click(screen.getByRole("button", { name: "Saved" }))
    fireEvent.click(screen.getByRole("button", { name: "replaceCanvas" }))
    expect(useCanvasStore.getState().nodes.map((item) => item.id)).toEqual(["saved"])
  })
})

describe("WorkflowNewButton", () => {
  it("starts over without asking right after a save", () => {
    useCanvasStore.setState({ nodes: [node("a")] })
    useCanvasStore.getState().setCurrentWorkflow("Saved")
    render(<WorkflowNewButton />)
    fireEvent.click(screen.getByRole("button", { name: "newCanvas" }))
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(useCanvasStore.getState().nodes).toEqual([])
  })

  it("saves changes to the named workflow without asking for a name again", () => {
    useCanvasStore.setState({ nodes: [node("a")] })
    useCanvasStore.getState().setCurrentWorkflow("Saved")
    useCanvasStore.setState({ nodes: [node("a", 60)] })
    render(<WorkflowNewButton />)
    fireEvent.click(screen.getByRole("button", { name: "newCanvas" }))
    fireEvent.click(screen.getByRole("button", { name: "save" }))
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument()
    expect(loadWorkflow("Saved")?.nodes[0].position).toEqual({ x: 60, y: 0 })
    expect(useCanvasStore.getState().nodes).toEqual([])
  })
})
