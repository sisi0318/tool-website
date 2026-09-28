import React from "react"
import { act, fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { useCanvasStore } from "@/lib/canvas/store"
import { loadWorkflow } from "@/lib/canvas/workflow"
import { requestWorkflowSave, WorkflowSaveController } from "./WorkflowSaveController"

const toast = vi.hoisted(() => vi.fn())
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast }) }))
vi.mock("@/hooks/use-translations", () => ({ useTranslations: () => (key: string) => key }))

const node = { id: "a", type: "string", position: { x: 0, y: 0 }, config: { value: "hello" } }

beforeEach(() => {
  localStorage.clear()
  toast.mockClear()
  useCanvasStore.setState({ nodes: [node], edges: [], currentWorkflow: null, autoRun: false })
})

describe("WorkflowSaveController", () => {
  it("asks for a name the first time, then Ctrl+S saves over it with feedback", () => {
    render(<WorkflowSaveController />)
    fireEvent.keyDown(window, { key: "s", ctrlKey: true })
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Daily report" } })
    fireEvent.click(screen.getByRole("button", { name: "confirm" }))
    expect(useCanvasStore.getState().currentWorkflow?.name).toBe("Daily report")
    expect(toast).toHaveBeenLastCalledWith({ title: "workflowSaved" })
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument()

    useCanvasStore.setState({ nodes: [{ ...node, position: { x: 80, y: 0 } }] })
    fireEvent.keyDown(window, { key: "s", ctrlKey: true })
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument()
    expect(loadWorkflow("Daily report")?.nodes[0].position).toEqual({ x: 80, y: 0 })
    expect(toast).toHaveBeenCalledTimes(2)
  })

  it("opens the name dialog prefilled for Save as", () => {
    useCanvasStore.getState().setCurrentWorkflow("Daily report")
    render(<WorkflowSaveController />)
    act(() => requestWorkflowSave(true))
    expect(screen.getByRole("textbox")).toHaveValue("Daily report")
  })
})
