import React from "react"
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import JourneyPage from "./page"
import { clearRegistry, registerNode } from "@/lib/canvas/registry"
import { appendNode, createJourney } from "@/lib/journey/tree"
import { saveDraft } from "@/lib/journey/serialize"
import type { Journey, JourneyNode } from "@/lib/journey/types"

const calls = vi.hoisted(() => ({ toast: vi.fn(), started: 0 }))
vi.mock("@/lib/adapters", () => ({ registerAllAdapters: () => undefined }))
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: calls.toast }) }))
vi.mock("@/hooks/use-translations", () => { const t = (key: string) => key; return { useTranslations: () => t } })
vi.mock("@/components/journey/BranchDrawer", () => ({ BranchDrawer: () => null }))
vi.mock("@/components/journey/JourneyTrail", () => ({ JourneyTrail: () => null }))
vi.mock("@/components/journey/SuggestionChips", () => ({ SuggestionChips: () => null }))
vi.mock("@/components/journey/ToolPickerSheet", () => ({ ToolPickerSheet: () => null }))
vi.mock("@/components/journey/ValueCard", () => ({
  ValueCard: ({ node, onRerunFromRoot, onOpenStepSheet }: { node: JourneyNode; onRerunFromRoot: () => void; onOpenStepSheet: () => void }) => (
    <div>
      <p data-testid="value">{node.valueMissing ? "missing" : String(node.value)}</p>
      <button type="button" onClick={onRerunFromRoot}>rerunFromRoot</button>
      <button type="button" onClick={onOpenStepSheet}>openStep</button>
    </div>
  ),
}))

/** 输入 → 一个只能靠取消结束的慢步骤（例如 OCR） */
function journeyWithSlowStep(stepValue: Partial<JourneyNode>): Journey {
  const base = createJourney("Slow", "hello", "Input")
  const { journey, nodeId } = appendNode(base, base.rootId, { tool: "test-slow", config: {}, outputPort: "output" }, "OLD", "Slow")
  return { ...journey, nodes: { ...journey.nodes, [nodeId]: { ...journey.nodes[nodeId], ...stepValue } } }
}

beforeEach(() => {
  window.localStorage.clear()
  window.history.replaceState(null, "", "/journey")
  clearRegistry()
  calls.toast.mockClear()
  calls.started = 0
  registerNode({
    type: "test-slow", label: "Slow", category: "text", icon: (() => null) as never,
    config: [{ id: "input", name: "Input", dataType: "string", hasInput: true }],
    outputs: [{ id: "output", name: "Output", dataType: "string" }],
    execute: (_inputs, _config, context) => new Promise((_resolve, reject) => {
      calls.started += 1
      context?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")))
    }),
  })
})

describe("cancelling journey runs", () => {
  it("shows the running step and cancels a re-run from the start", async () => {
    saveDraft(journeyWithSlowStep({ value: null, valueMissing: true }))
    render(<JourneyPage />)

    fireEvent.click(screen.getByRole("button", { name: "rerunFromRoot" }))
    expect(await screen.findByText("applying · Slow")).toBeInTheDocument()
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "cancel" })) })

    await waitFor(() => expect(calls.toast).toHaveBeenCalledWith({ title: "cancelled" }))
    expect(screen.queryByText("applying · Slow")).not.toBeInTheDocument()
    expect(screen.getByTestId("value")).toHaveTextContent("missing")
    expect(screen.getByRole("button", { name: "rerunFromRoot" })).toBeEnabled()
  })

  it("cancels a step re-run from inside the step sheet and leaves the journey unchanged", async () => {
    saveDraft(journeyWithSlowStep({}))
    render(<JourneyPage />)

    fireEvent.click(screen.getByRole("button", { name: "openStep" }))
    fireEvent.click(await screen.findByRole("button", { name: "rerunPath" }))
    // 步骤面板是模态的：取消按钮要在面板里，页面上那份点不到
    expect(await within(screen.getByRole("dialog")).findByText("applying · Slow")).toBeInTheDocument()
    expect(calls.started).toBe(1)
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "cancel" })) })

    await waitFor(() => expect(calls.toast).toHaveBeenCalledWith({ title: "runCancelled" }))
    expect(screen.getByRole("button", { name: "rerunPath" })).toBeEnabled()
    expect(screen.getByTestId("value")).toHaveTextContent("OLD")
  })
})
