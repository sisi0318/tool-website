import React from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { hasUnsavedCanvasChanges, useCanvasStore } from "@/lib/canvas/store"
import { getWorkflowList, loadWorkflow, saveWorkflow } from "@/lib/canvas/workflow"
import { WorkflowMenu } from "./WorkflowMenu"
import { WorkflowSaveController } from "./WorkflowSaveController"

const toast = vi.hoisted(() => vi.fn())
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast }) }))
vi.mock("@/hooks/use-translations", () => { const translate = (key: string) => key; return { useTranslations: () => translate } })

const node = (id: string, x = 0) => ({ id, type: "string", position: { x, y: 0 }, config: { value: id } })

/** 点开左上角的工作流名称，再选一项 */
function choose(item: string | RegExp) {
  fireEvent.pointerDown(screen.getByRole("button", { name: /^workflow · / }), { button: 0, ctrlKey: false })
  fireEvent.click(screen.getByRole("menuitem", { name: item }))
}

beforeEach(() => {
  localStorage.clear()
  toast.mockClear()
  useCanvasStore.setState({ nodes: [], edges: [], currentWorkflow: null, autoRun: false })
  saveWorkflow("Saved", { nodes: [node("saved")], edges: [] })
})

describe("the workflow name", () => {
  it("shows a placeholder until the canvas is saved, and marks unsaved changes", () => {
    render(<WorkflowMenu />)
    const trigger = screen.getByRole("button", { name: "workflow · untitledWorkflow" })
    expect(trigger).toHaveTextContent("untitledWorkflow")
    expect(trigger).not.toHaveTextContent("unsavedChanges")
  })

  it("names the open workflow and flags edits made since it was saved", () => {
    useCanvasStore.setState({ nodes: [node("a")] })
    useCanvasStore.getState().setCurrentWorkflow("Daily")
    const { rerender } = render(<WorkflowMenu />)
    const trigger = screen.getByRole("button", { name: "workflow · Daily" })
    expect(trigger).not.toHaveTextContent("unsavedChanges")

    useCanvasStore.setState({ nodes: [node("a", 60)] })
    rerender(<WorkflowMenu />)
    expect(trigger).toHaveTextContent("unsavedChanges")
    expect(trigger).toHaveAccessibleName("workflow · Daily · unsavedChanges")
  })
})

describe("load", () => {
  it("opens a workflow straight away when nothing would be lost, and remembers its name", () => {
    render(<WorkflowMenu />)
    choose("load")
    fireEvent.click(screen.getByRole("button", { name: "Saved" }))
    expect(useCanvasStore.getState().nodes.map((item) => item.id)).toEqual(["saved"])
    expect(useCanvasStore.getState().currentWorkflow?.name).toBe("Saved")
    expect(hasUnsavedCanvasChanges(useCanvasStore.getState())).toBe(false)
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("asks before replacing unsaved work, and cancelling returns to the list", () => {
    useCanvasStore.setState({ nodes: [node("draft")] })
    render(<WorkflowMenu />)
    choose("load")
    fireEvent.click(screen.getByRole("button", { name: "Saved" }))
    expect(screen.getByRole("alertdialog", { name: "replaceCanvasTitle" })).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "cancel" }))
    expect(useCanvasStore.getState().nodes.map((item) => item.id)).toEqual(["draft"])
    fireEvent.click(screen.getByRole("button", { name: "Saved" }))
    fireEvent.click(screen.getByRole("button", { name: "replaceCanvas" }))
    expect(useCanvasStore.getState().nodes.map((item) => item.id)).toEqual(["saved"])
  })
})

describe("new", () => {
  it("starts over without asking right after a save", () => {
    useCanvasStore.setState({ nodes: [node("a")] })
    useCanvasStore.getState().setCurrentWorkflow("Saved")
    render(<WorkflowMenu />)
    choose("newCanvas")
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(useCanvasStore.getState().nodes).toEqual([])
  })

  it("saves changes to the named workflow without asking for a name again", () => {
    useCanvasStore.setState({ nodes: [node("a")] })
    useCanvasStore.getState().setCurrentWorkflow("Saved")
    useCanvasStore.setState({ nodes: [node("a", 60)] })
    render(<WorkflowMenu />)
    choose("newCanvas")
    fireEvent.click(screen.getByRole("button", { name: "save" }))
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument()
    expect(loadWorkflow("Saved")?.nodes[0].position).toEqual({ x: 60, y: 0 })
    expect(useCanvasStore.getState().nodes).toEqual([])
  })

  it("asks for a name first when the canvas was never saved, and keeps the canvas if that is cancelled", () => {
    useCanvasStore.setState({ nodes: [node("a")] })
    render(<WorkflowMenu />)
    choose("newCanvas")
    fireEvent.click(screen.getByRole("button", { name: "save" }))
    fireEvent.click(screen.getByRole("button", { name: "cancel" }))
    expect(useCanvasStore.getState().nodes.map((item) => item.id)).toEqual(["a"])

    choose("newCanvas")
    fireEvent.click(screen.getByRole("button", { name: "save" }))
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Fresh" } })
    fireEvent.click(screen.getByRole("button", { name: "confirm" }))
    expect(loadWorkflow("Fresh")?.nodes.map((item) => item.id)).toEqual(["a"])
    expect(useCanvasStore.getState().nodes).toEqual([])
  })

  it("throws the canvas away only when told to", () => {
    useCanvasStore.setState({ nodes: [node("a")] })
    render(<WorkflowMenu />)
    choose("newCanvas")
    fireEvent.click(screen.getByRole("button", { name: "dontSave" }))
    expect(useCanvasStore.getState().nodes).toEqual([])
    expect(getWorkflowList()).toEqual(["Saved"])
  })
})

describe("save, clear and import", () => {
  it("hands Save and Save as to the controller that owns the name dialog", () => {
    useCanvasStore.setState({ nodes: [node("a")] })
    render(<><WorkflowSaveController /><WorkflowMenu /></>)
    // 这两项的名称里带着快捷键
    choose(/^save(?!As)/)
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Daily" } })
    fireEvent.click(screen.getByRole("button", { name: "confirm" }))
    expect(useCanvasStore.getState().currentWorkflow?.name).toBe("Daily")

    choose(/^saveAs/)
    expect(screen.getByRole("textbox")).toHaveValue("Daily")
  })

  it("clears the canvas only after confirming, and has nothing to clear on an empty one", () => {
    const { rerender } = render(<WorkflowMenu />)
    fireEvent.pointerDown(screen.getByRole("button", { name: /^workflow · / }), { button: 0, ctrlKey: false })
    expect(screen.getByRole("menuitem", { name: "clearCanvasTitle" })).toHaveAttribute("data-disabled")
    fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" })

    useCanvasStore.setState({ nodes: [node("a")] })
    rerender(<WorkflowMenu />)
    choose("clearCanvasTitle")
    fireEvent.click(screen.getByRole("button", { name: "cancel" }))
    expect(useCanvasStore.getState().nodes).toHaveLength(1)

    choose("clearCanvasTitle")
    fireEvent.click(screen.getByRole("button", { name: "clearCanvas" }))
    expect(useCanvasStore.getState().nodes).toEqual([])
  })

  it("rejects a file that is not a workflow and says so", async () => {
    render(<WorkflowMenu />)
    const input = screen.getByLabelText("importWorkflow") as HTMLInputElement
    const file = new File(["not json"], "broken.json", { type: "application/json" })
    fireEvent.change(input, { target: { files: [file] } })
    await vi.waitFor(() => expect(toast).toHaveBeenCalledWith({ title: "workflowImportInvalid", variant: "destructive" }))
    expect(useCanvasStore.getState().nodes).toEqual([])
  })
})
