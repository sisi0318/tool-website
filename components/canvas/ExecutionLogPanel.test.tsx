import { fireEvent, render, screen, within } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { useCanvasStore } from "@/lib/canvas/store"
import { ExecutionLogPanel } from "./ExecutionLogPanel"

vi.mock("@/hooks/use-translations", () => ({
  useTranslations: () => (key: string) => ({
    executionLog: "Execution log",
    clearExecutionLog: "Clear execution log",
    close: "Close",
    executionLogEmpty: "No runs yet",
    executionStatusRunning: "Running",
    executionStatusSuccess: "Succeeded",
    executionStatusError: "Failed",
    executionStatusCancelled: "Cancelled",
    executionStatusSkipped: "Skipped",
  }[key] ?? key),
}))

vi.mock("@/lib/canvas/registry", () => ({
  getNodeDefinition: (type: string) => type === "hash"
    ? { label: "Hash" }
    : undefined,
}))

describe("ExecutionLogPanel", () => {
  beforeEach(() => {
    useCanvasStore.setState({
      nodes: [{ id: "node-1", type: "hash", position: { x: 0, y: 0 }, config: {} }],
      executionLog: [],
    })
  })

  it("does not render while closed and shows an empty state when opened", () => {
    const onClose = vi.fn()
    const { rerender } = render(
      <ExecutionLogPanel open={false} onClose={onClose} />
    )
    expect(screen.queryByRole("region", { name: "Execution log" })).not.toBeInTheDocument()

    rerender(<ExecutionLogPanel open onClose={onClose} />)
    expect(screen.getByText("No runs yet")).toBeInTheDocument()
    const panel = screen.getByRole("region", { name: "Execution log" })
    expect(panel).toHaveFocus()
    fireEvent.keyDown(panel, { key: "Escape" })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it("shows newest records first with status, duration and errors", () => {
    useCanvasStore.setState({
      executionLog: [
        {
          id: 1,
          nodeId: "node-1",
          nodeType: "hash",
          status: "success",
          startedAt: 1_000,
          durationMs: 24,
        },
        {
          id: 2,
          nodeId: "missing",
          nodeType: "unknown",
          status: "error",
          startedAt: 2_000,
          durationMs: 1_250,
          error: "bad input",
        },
      ],
    })

    render(<ExecutionLogPanel open onClose={vi.fn()} />)
    const items = screen.getAllByRole("listitem")
    expect(within(items[0]).getByText("unknown")).toBeInTheDocument()
    expect(within(items[0]).getByText("Failed")).toBeInTheDocument()
    expect(within(items[0]).getByText("1.25 s")).toBeInTheDocument()
    expect(within(items[0]).getByText("bad input")).toBeInTheDocument()
    expect(within(items[1]).getByText("Hash")).toBeInTheDocument()
  })

  it("clears records and lets an existing node be selected", () => {
    const onSelectNode = vi.fn()
    useCanvasStore.setState({
      executionLog: [{
        id: 3,
        nodeId: "node-1",
        nodeType: "hash",
        status: "success",
        startedAt: 3_000,
        durationMs: 10,
      }],
    })

    render(
      <ExecutionLogPanel open onClose={vi.fn()} onSelectNode={onSelectNode} />
    )
    fireEvent.click(screen.getByRole("button", { name: /Hash/ }))
    expect(onSelectNode).toHaveBeenCalledWith("node-1")

    fireEvent.click(screen.getByRole("button", { name: "Clear execution log" }))
    expect(screen.getByText("No runs yet")).toBeInTheDocument()
  })
})
