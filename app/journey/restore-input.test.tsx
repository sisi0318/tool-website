import React from "react"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import JourneyPage from "./page"
import { clearRegistry, registerNode } from "@/lib/canvas/registry"
import { appendNode, createJourney } from "@/lib/journey/tree"
import { loadDraft, saveDraft } from "@/lib/journey/serialize"
import type { Journey, JourneyNode } from "@/lib/journey/types"

const calls = vi.hoisted(() => ({ execute: vi.fn(async (inputs: Record<string, unknown>) => ({ output: String(inputs.input).toUpperCase() })), toast: vi.fn() }))
vi.mock("@/lib/adapters", () => ({ registerAllAdapters: () => undefined }))
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: calls.toast }) }))
vi.mock("@/hooks/use-translations", () => { const t = (key: string) => key; return { useTranslations: () => t } })
vi.mock("@/components/journey/BranchDrawer", () => ({ BranchDrawer: () => null }))
vi.mock("@/components/journey/InputStage", () => ({ InputStage: () => <div data-testid="input-stage" /> }))
vi.mock("@/components/journey/JourneyTrail", () => ({ JourneyTrail: () => null }))
vi.mock("@/components/journey/SuggestionChips", () => ({ SuggestionChips: () => null }))
vi.mock("@/components/journey/ToolPickerSheet", () => ({ ToolPickerSheet: () => null }))
vi.mock("@/components/journey/StepSheet", () => ({ StepSheet: () => null }))
vi.mock("@/components/journey/JourneyDialogs", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/components/journey/JourneyDialogs")>()),
  ConfirmNewDialog: () => null, ConfirmOverwriteDialog: () => null, OpenJourneyDialog: () => null, ReplayDialog: () => null, ShareDialog: () => null,
}))
vi.mock("@/components/journey/ValueCard", () => ({
  ValueCard: ({ node, inputMissing, onRerunFromRoot }: { node: JourneyNode; inputMissing?: boolean; onRerunFromRoot: () => void }) => (
    <div>
      <output>{node.valueMissing ? "missing" : String(node.value)}</output>
      <button type="button" onClick={onRerunFromRoot}>{inputMissing ? "restoreInput" : "rerunFromRoot"}</button>
    </div>
  ),
}))

/** 输入是大文本（或文件）时保存后的样子：根节点和后续节点都没有值 */
function savedWithoutInput(): Journey {
  const base = createJourney("Big input", "too large to keep", "Input")
  const { journey } = appendNode(base, base.rootId, { tool: "test-upper", config: {}, outputPort: "output" }, "TOO LARGE TO KEEP", "Upper")
  const nodes = Object.fromEntries(Object.entries(journey.nodes).map(([id, node]) => [id, { ...node, value: null, valueMissing: true }]))
  return { ...journey, nodes }
}

beforeEach(() => {
  window.localStorage.clear()
  window.history.replaceState(null, "", "/journey")
  clearRegistry()
  calls.execute.mockClear()
  calls.toast.mockClear()
  registerNode({ type: "test-upper", label: "Upper", category: "text", icon: (() => null) as never, config: [{ id: "input", name: "Input", dataType: "string", hasInput: true }], outputs: [{ id: "output", name: "Output", dataType: "string" }], execute: calls.execute })
})

describe("journey whose input was not saved", () => {
  it("asks for the input again instead of looping on 're-run from start', then recomputes in place", async () => {
    saveDraft(savedWithoutInput())
    render(<JourneyPage />)
    expect(screen.getByRole("status")).toHaveTextContent("missing")

    fireEvent.click(screen.getByRole("button", { name: "restoreInput" }))
    expect(calls.toast).not.toHaveBeenCalled()
    fireEvent.change(screen.getByRole("textbox", { name: "restoreInputTitle" }), { target: { value: "hello again" } })
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "restoreInputRun" })) })

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("HELLO AGAIN"))
    expect(calls.execute).toHaveBeenCalledTimes(1)
    await waitFor(() => {
      const draft = loadDraft()!
      expect(draft.nodes[draft.rootId].value).toBe("hello again")
      expect(Object.keys(draft.nodes)).toHaveLength(2)
    })
  })
})
