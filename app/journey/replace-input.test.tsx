import React from "react"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import JourneyPage from "./page"
import { clearRegistry, registerNode } from "@/lib/canvas/registry"
import { appendNode, createJourney } from "@/lib/journey/tree"
import { loadDraft, saveDraft } from "@/lib/journey/serialize"
import type { Journey, JourneyNode } from "@/lib/journey/types"

const calls = vi.hoisted(() => ({ toast: vi.fn() }))
vi.mock("@/lib/adapters", () => ({ registerAllAdapters: () => undefined }))
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: calls.toast }) }))
vi.mock("@/hooks/use-translations", () => { const t = (key: string) => key; return { useTranslations: () => t } })
vi.mock("@/components/journey/BranchDrawer", () => ({ BranchDrawer: () => null }))
vi.mock("@/components/journey/JourneyTrail", () => ({ JourneyTrail: () => null }))
vi.mock("@/components/journey/SuggestionChips", () => ({ SuggestionChips: () => null }))
vi.mock("@/components/journey/ToolPickerSheet", () => ({ ToolPickerSheet: () => null }))
vi.mock("@/components/journey/StepSheet", () => ({ StepSheet: () => null }))
vi.mock("@/components/journey/ValueCard", () => ({
  ValueCard: ({ node, onEditInput }: { node: JourneyNode; onEditInput?: () => void }) => (
    <div>
      <p data-testid="value">{String(node.value)}</p>
      {onEditInput && <button type="button" onClick={onEditInput}>editInput</button>}
    </div>
  ),
}))

const step = (tool: string) => ({ tool, config: {}, outputPort: "output" })

/** 输入 → 大写 → 感叹号，另一支是输入 → 感叹号；当前停在第二支 */
function branchedJourney(): { journey: Journey; ids: Record<"upper" | "upperExclaim" | "exclaim", string> } {
  const base = createJourney("Branches", "abc", "Input")
  const upper = appendNode(base, base.rootId, step("test-upper"), "ABC", "Upper")
  const upperExclaim = appendNode(upper.journey, upper.nodeId, step("test-exclaim"), "ABC!", "Exclaim")
  const exclaim = appendNode(upperExclaim.journey, base.rootId, step("test-exclaim"), "abc!", "Exclaim")
  return { journey: exclaim.journey, ids: { upper: upper.nodeId, upperExclaim: upperExclaim.nodeId, exclaim: exclaim.nodeId } }
}

beforeEach(() => {
  window.localStorage.clear()
  window.history.replaceState(null, "", "/journey")
  clearRegistry()
  calls.toast.mockClear()
  const port = { config: [{ id: "input", name: "Input", dataType: "string" as const, hasInput: true }], outputs: [{ id: "output", name: "Output", dataType: "string" as const }] }
  registerNode({ type: "test-upper", label: "Upper", category: "text", icon: (() => null) as never, ...port, execute: async (inputs) => ({ output: String(inputs.input).toUpperCase() }) })
  registerNode({ type: "test-exclaim", label: "Exclaim", category: "text", icon: (() => null) as never, ...port, execute: async (inputs) => ({ output: `${String(inputs.input)}!` }) })
})

describe("applying a journey to new data", () => {
  it("recomputes every branch in place and offers undo", async () => {
    const { journey, ids } = branchedJourney()
    saveDraft(journey)
    render(<JourneyPage />)
    expect(screen.getByTestId("value")).toHaveTextContent("abc!")

    fireEvent.click(screen.getByRole("button", { name: "replayTitle" }))
    expect(screen.getByRole("dialog", { name: "replayTitle" })).toHaveTextContent("replayHint")
    fireEvent.change(screen.getByRole("textbox", { name: "replayTitle" }), { target: { value: "xyz" } })
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "replayRun" })) })

    await waitFor(() => expect(screen.getByTestId("value")).toHaveTextContent("xyz!"))
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    await waitFor(() => {
      const draft = loadDraft()!
      expect(draft.rootId).toBe(journey.rootId)
      expect(draft.nodes[draft.rootId].value).toBe("xyz")
      expect(draft.nodes[ids.upper].value).toBe("XYZ")
      expect(draft.nodes[ids.upperExclaim].value).toBe("XYZ!")
      expect(draft.nodes[ids.exclaim].value).toBe("xyz!")
    }, { timeout: 2000 })

    const undoToast = calls.toast.mock.calls.at(-1)![0]
    expect(undoToast.title).toBe("inputReplaced")
    act(() => undoToast.action.props.onClick())
    expect(screen.getByTestId("value")).toHaveTextContent("abc!")
  })

  it("lets the input be edited from the root card, prefilled with the current input", () => {
    const { journey } = branchedJourney()
    saveDraft({ ...journey, activeId: journey.rootId })
    render(<JourneyPage />)

    fireEvent.click(screen.getByRole("button", { name: "editInput" }))
    expect(screen.getByRole("textbox", { name: "editInput" })).toHaveValue("abc")
  })
})
