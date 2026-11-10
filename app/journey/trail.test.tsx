import React from "react"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import JourneyPage from "./page"
import { clearRegistry, registerNode } from "@/lib/canvas/registry"
import { appendNode, createJourney, getTrail } from "@/lib/journey/tree"
import { loadDraft, saveDraft } from "@/lib/journey/serialize"
import type { Journey, JourneyNode } from "@/lib/journey/types"

// 步骤列表、详情、参数区、建议都是真的；只换掉和这里无关的重组件
vi.mock("@/lib/adapters", () => ({ registerAllAdapters: () => undefined }))
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }))
vi.mock("@/hooks/use-translations", () => { const t = (key: string) => key; return { useTranslations: () => t } })
vi.mock("@/components/tools/send-to-menu", () => ({ SendToMenu: () => null }))
vi.mock("@/components/journey/ValueCard", () => ({ ValueCard: ({ node }: { node: JourneyNode }) => <p data-testid="value">{node.valueMissing ? "missing" : String(node.value)}</p> }))

const MODES = [{ label: "Upper", value: "upper" }, { label: "Lower", value: "lower" }, { label: "Explode", value: "explode" }]

/** 输入 abc → 大写 ABC → 加感叹号 ABC!；选中的是末端 */
function path(): { journey: Journey; ids: { caseStep: string; exclaim: string } } {
  const base = createJourney("Path", "abc", "Input")
  const caseStep = appendNode(base, base.rootId, { tool: "test-case", config: { mode: "upper" }, outputPort: "output" }, "ABC", "Case")
  const exclaim = appendNode(caseStep.journey, caseStep.nodeId, { tool: "test-exclaim", config: {}, outputPort: "output" }, "ABC!", "Exclaim")
  return { journey: exclaim.journey, ids: { caseStep: caseStep.nodeId, exclaim: exclaim.nodeId } }
}

const steps = () => screen.getAllByRole("button").filter((button) => button.hasAttribute("data-journey-step"))
const stepTitles = () => steps().map((button) => button.querySelector("span.font-medium")?.textContent)

beforeEach(() => {
  window.localStorage.clear()
  window.history.replaceState(null, "", "/journey")
  clearRegistry()
  const outputs = [{ id: "output", name: "Output", dataType: "string" as const }]
  const input = { id: "input", name: "Input", dataType: "string" as const, hasInput: true }
  registerNode({
    type: "test-case", label: "Case", category: "text", icon: (() => null) as never, outputs,
    config: [input, { id: "mode", name: "Mode", dataType: "string", defaultValue: "upper", options: MODES }],
    execute: async (inputs, config) => {
      if (config.mode === "explode") throw new Error("mode exploded")
      const text = String(inputs.input)
      return { output: config.mode === "lower" ? text.toLowerCase() : text.toUpperCase() }
    },
  })
  registerNode({ type: "test-exclaim", label: "Exclaim", category: "text", icon: (() => null) as never, outputs, config: [input], execute: async (inputs) => ({ output: `${String(inputs.input)}!` }) })
})

describe("walking back along the trail", () => {
  it("keeps the later steps on screen while an earlier one is open", () => {
    saveDraft(path().journey)
    render(<JourneyPage />)
    expect(stepTitles()).toEqual(["trailInput", "Case", "Exclaim"])
    expect(screen.getByTestId("value")).toHaveTextContent("ABC!")

    fireEvent.click(steps()[1])
    expect(screen.getByTestId("value")).toHaveTextContent("ABC")
    // 以前这里只剩“输入 → Case”，后面的步骤要去分支抽屉里找
    expect(stepTitles()).toEqual(["trailInput", "Case", "Exclaim"])
    expect(steps()[1]).toHaveAttribute("aria-current", "step")
  })

  it("starts another path when a step is added from the middle, and keeps the old one", async () => {
    const { journey, ids } = path()
    saveDraft(journey)
    render(<JourneyPage />)

    fireEvent.click(steps()[0])
    expect(screen.getByText("continueForkHint")).toBeInTheDocument()
    // 从“输入”直接加感叹号：这是第二条路
    const suggestion = screen.getAllByRole("button", { name: /Exclaim/ }).find((button) => !button.hasAttribute("data-journey-step"))!
    await act(async () => { fireEvent.click(suggestion) })

    await waitFor(() => expect(screen.getByTestId("value")).toHaveTextContent("abc!"))
    expect(stepTitles()).toEqual(["trailInput", "Exclaim"])
    expect(screen.getByRole("button", { name: "forkHere" })).toBeInTheDocument()
    await waitFor(() => {
      const draft = loadDraft()!
      expect(Object.keys(draft.nodes)).toHaveLength(4)
      expect(draft.nodes[ids.exclaim].value).toBe("ABC!")
    }, { timeout: 2000 })
  })

  it("remembers where the path ended after a reload", async () => {
    const { journey } = path()
    saveDraft(journey)
    const first = render(<JourneyPage />)
    fireEvent.click(steps()[1])
    await waitFor(() => expect(loadDraft()?.tipId).toBeDefined(), { timeout: 2000 })
    first.unmount()

    render(<JourneyPage />)
    expect(stepTitles()).toEqual(["trailInput", "Case", "Exclaim"])
    expect(steps()[1]).toHaveAttribute("aria-current", "step")
  })
})

describe("changing a step where it stands", () => {
  it("re-runs the step and everything after it without leaving the page", async () => {
    const { journey, ids } = path()
    saveDraft(journey)
    render(<JourneyPage />)
    fireEvent.click(steps()[1])

    fireEvent.change(screen.getByRole("combobox", { name: "Mode" }), { target: { value: "lower" } })
    await waitFor(() => expect(screen.getByTestId("value")).toHaveTextContent("abc"), { timeout: 2000 })
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    await waitFor(() => {
      const draft = loadDraft()!
      expect(draft.nodes[ids.caseStep].via?.config.mode).toBe("lower")
      // 后面那一步跟着重算了
      expect(draft.nodes[ids.exclaim].value).toBe("abc!")
    }, { timeout: 2000 })
    expect(getTrail(loadDraft()!).map((node) => node.value)).toEqual(["abc", "abc", "abc!"])
  })

  it("explains a failing setting in place and leaves the last good result alone", async () => {
    const { journey, ids } = path()
    saveDraft(journey)
    render(<JourneyPage />)
    fireEvent.click(steps()[1])

    fireEvent.change(screen.getByRole("combobox", { name: "Mode" }), { target: { value: "explode" } })
    expect(await screen.findByRole("alert", {}, { timeout: 2000 })).toHaveTextContent("mode exploded")
    expect(screen.getByTestId("value")).toHaveTextContent("ABC")
    expect(screen.getByRole("combobox", { name: "Mode" })).toHaveValue("explode")
    const draft = loadDraft()!
    expect(draft.nodes[ids.caseStep].via?.config.mode).toBe("upper")
    expect(draft.nodes[ids.exclaim].value).toBe("ABC!")
  })
})
