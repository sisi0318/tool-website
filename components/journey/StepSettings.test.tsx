import { act, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { clearRegistry, getNodeDefinition, registerNode } from "@/lib/canvas/registry"
import type { JourneyStep } from "@/lib/journey/types"
import { LIVE_RERUN_DELAY_MS, StepSettings, canRerunLive, type StepSettingsResult } from "./StepSettings"

vi.mock("@/hooks/use-translations", () => ({ useTranslations: () => (key: string) => key }))

const caseStep: JourneyStep = { tool: "test-case", config: { mode: "upper" }, outputPort: "output" }
const applied: StepSettingsResult = { status: "applied" }

function registerTools() {
  const ports = { outputs: [{ id: "output", name: "Output", dataType: "string" as const }], execute: async () => ({ output: "" }) }
  const fields = [
    { id: "input", name: "Input", dataType: "string" as const, hasInput: true },
    { id: "mode", name: "Mode", dataType: "string" as const, defaultValue: "upper", options: [{ label: "Upper", value: "upper" }, { label: "Lower", value: "lower" }] },
  ]
  registerNode({ type: "test-case", label: "Case", category: "text", icon: (() => null) as never, config: fields, ...ports })
  registerNode({ type: "test-remote", label: "Remote", category: "dev", network: true, icon: (() => null) as never, config: fields, ...ports })
  registerNode({ type: "test-plain", label: "Plain", category: "text", icon: (() => null) as never, config: [fields[0]], ...ports })
}

const wait = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms) })

beforeEach(() => {
  vi.useFakeTimers()
  clearRegistry()
  registerTools()
})
afterEach(() => vi.useRealTimers())

describe("changing a step's settings in place", () => {
  it("re-runs a short while after the last change, with the whole configuration", async () => {
    const onChange = vi.fn(async () => applied)
    render(<StepSettings step={caseStep} input="abc" busy={false} onChange={onChange} />)

    fireEvent.change(screen.getByRole("combobox", { name: "Mode" }), { target: { value: "lower" } })
    await wait(LIVE_RERUN_DELAY_MS - 50)
    expect(onChange).not.toHaveBeenCalled()
    await wait(50)
    expect(onChange).toHaveBeenCalledExactlyOnceWith({ mode: "lower" }, "output", { live: true })
  })

  it("only sends the last of several quick changes", async () => {
    const onChange = vi.fn(async () => applied)
    render(<StepSettings step={caseStep} input="abc" busy={false} onChange={onChange} />)
    const mode = screen.getByRole("combobox", { name: "Mode" })

    fireEvent.change(mode, { target: { value: "lower" } })
    await wait(100)
    fireEvent.change(mode, { target: { value: "upper" } })
    await wait(LIVE_RERUN_DELAY_MS)
    expect(onChange).toHaveBeenCalledExactlyOnceWith({ mode: "upper" }, "output", { live: true })
  })

  it("explains a failure next to the form, keeps what was typed, and clears the message once a change works", async () => {
    const onChange = vi.fn<() => Promise<StepSettingsResult>>().mockResolvedValueOnce({ status: "failed", message: "bad mode" }).mockResolvedValue(applied)
    render(<StepSettings step={caseStep} input="abc" busy={false} onChange={onChange} />)
    const mode = screen.getByRole("combobox", { name: "Mode" })

    fireEvent.change(mode, { target: { value: "lower" } })
    await wait(LIVE_RERUN_DELAY_MS)
    expect(screen.getByRole("alert")).toHaveTextContent("bad mode")
    expect(mode).toHaveValue("lower")

    fireEvent.change(mode, { target: { value: "upper" } })
    await wait(LIVE_RERUN_DELAY_MS)
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })

  it("ignores the outcome of a run that a newer change has replaced", async () => {
    let failFirst: (result: StepSettingsResult) => void = () => {}
    const onChange = vi.fn<() => Promise<StepSettingsResult>>()
      .mockImplementationOnce(() => new Promise((resolve) => { failFirst = resolve }))
      .mockResolvedValue(applied)
    render(<StepSettings step={caseStep} input="abc" busy={false} onChange={onChange} />)
    const mode = screen.getByRole("combobox", { name: "Mode" })

    fireEvent.change(mode, { target: { value: "lower" } })
    await wait(LIVE_RERUN_DELAY_MS)
    fireEvent.change(mode, { target: { value: "upper" } })
    await wait(LIVE_RERUN_DELAY_MS)
    await act(async () => { failFirst({ status: "failed", message: "stale" }) })
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })

  it("hands over a change that is still waiting when the panel goes away", async () => {
    const onChange = vi.fn(async () => applied)
    const { unmount } = render(<StepSettings step={caseStep} input="abc" busy={false} onChange={onChange} />)
    fireEvent.change(screen.getByRole("combobox", { name: "Mode" }), { target: { value: "lower" } })
    unmount()
    expect(onChange).toHaveBeenCalledExactlyOnceWith({ mode: "lower" }, "output", { live: true })
  })

  it("waits for an explicit run when the tool reaches the network", async () => {
    const onChange = vi.fn(async () => applied)
    render(<StepSettings step={{ ...caseStep, tool: "test-remote" }} input="abc" busy={false} onChange={onChange} />)

    fireEvent.change(screen.getByRole("combobox", { name: "Mode" }), { target: { value: "lower" } })
    await wait(LIVE_RERUN_DELAY_MS * 2)
    expect(onChange).not.toHaveBeenCalled()
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "rerunStep" })) })
    expect(onChange).toHaveBeenCalledExactlyOnceWith({ mode: "lower" }, "output", { live: false })
  })

  it("shows nothing for a step that has nothing to adjust", () => {
    const { container } = render(<StepSettings step={{ tool: "test-plain", config: {}, outputPort: "output" }} input="abc" busy={false} onChange={vi.fn()} />)
    expect(container).toBeEmptyDOMElement()
  })
})

describe("which steps re-run as you type", () => {
  it("leaves out tools that reach the network, need a manual run, or declare themselves slow", () => {
    const base = getNodeDefinition("test-case")!
    expect(canRerunLive(base, "abc")).toBe(true)
    expect(canRerunLive({ ...base, network: true }, "abc")).toBe(false)
    expect(canRerunLive({ ...base, executionMode: "manual" }, "abc")).toBe(false)
    expect(canRerunLive({ ...base, executionTimeoutMs: 120_000 }, "abc")).toBe(false)
    expect(canRerunLive(undefined, "abc")).toBe(false)
  })

  it("leaves out files and very large text", () => {
    const base = getNodeDefinition("test-case")!
    expect(canRerunLive(base, new File(["x"], "a.txt"))).toBe(false)
    expect(canRerunLive(base, "x".repeat(200_001))).toBe(false)
    expect(canRerunLive(base, { a: 1 })).toBe(true)
  })
})
