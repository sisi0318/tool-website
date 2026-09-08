import React from "react"
import { act, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import JourneyPage from "./page"
import { clearRegistry, registerNode } from "@/lib/canvas/registry"
import { createJourney } from "@/lib/journey/tree"
import { loadDraft, saveDraft } from "@/lib/journey/serialize"
import { toolTransfers, toolTransferUrl } from "@/lib/tool-transfer"
import type { JourneyNode } from "@/lib/journey/types"

const calls = vi.hoisted(() => ({ execute: vi.fn(async (inputs: Record<string, unknown>) => ({ output: inputs.input })), toast: vi.fn(), navigate: vi.fn() }))
vi.mock("@/lib/adapters", () => ({ registerAllAdapters: () => undefined }))
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: calls.navigate }) }))
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: calls.toast }) }))
vi.mock("@/hooks/use-translations", () => { const t = (key: string) => key; return { useTranslations: () => t } })
vi.mock("@/components/journey/BranchDrawer", () => ({ BranchDrawer: () => null }))
vi.mock("@/components/journey/InputStage", () => ({ InputStage: () => <div data-testid="input-stage" /> }))
vi.mock("@/components/journey/JourneyTrail", () => ({ JourneyTrail: () => null }))
vi.mock("@/components/journey/SuggestionChips", () => ({ SuggestionChips: () => null }))
vi.mock("@/components/journey/ToolPickerSheet", () => ({ ToolPickerSheet: () => null }))
vi.mock("@/components/journey/JourneyDialogs", () => ({ ConfirmNewDialog: () => null, ConfirmOverwriteDialog: () => null, OpenJourneyDialog: () => null, ReplayDialog: () => null, ShareDialog: () => null }))
vi.mock("@/components/journey/ValueCard", () => ({ ValueCard: ({ node }: { node: JourneyNode }) => <div data-testid="current-value">{node.valueType === "bytes" ? `bytes:${(node.value as File).size}` : JSON.stringify(node.value)}</div> }))
vi.mock("@/components/journey/StepSheet", () => ({ StepSheet: ({ open, creating, onRerun }: { open: boolean; creating: boolean; onRerun: (config: Record<string, unknown>, port: string) => void }) => open ? <button onClick={() => onRerun({}, "output")}>{creating ? "Run new step" : "Rerun"}</button> : null }))

beforeEach(() => {
  toolTransfers.clear()
  window.localStorage.clear()
  window.history.replaceState(null, "", "/journey")
  clearRegistry()
  calls.execute.mockClear()
  calls.toast.mockClear()
  calls.navigate.mockClear()
  registerNode({ type: "test-effect", label: "Test effect", category: "dev", network: true, icon: (() => null) as never, config: [{ id: "input", name: "Input", dataType: "string", hasInput: true }], outputs: [{ id: "output", name: "Output", dataType: "string" }], execute: calls.execute })
})
afterEach(() => { toolTransfers.clear(); window.history.replaceState(null, "", "/") })

describe("journey tool transfer intake", () => {
  it("requires replacement confirmation for an existing canvas and preserves it on cancel", () => {
    saveDraft(createJourney("Journey", "replacement", "Input"))
    const original = JSON.stringify({ nodes: [{ id: "original", type: "string", position: { x: 0, y: 0 }, config: { value: "keep me" } }], edges: [] })
    localStorage.setItem("canvas-state", original)
    render(<JourneyPage />)
    fireEvent.click(screen.getByRole("button", { name: "openInCanvas" }))
    expect(screen.getByRole("alertdialog")).toHaveTextContent("canvasReplaceDescription")
    expect(calls.navigate).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: "cancel" }))
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
    expect(localStorage.getItem("canvas-state")).toBe(original)
    fireEvent.click(screen.getByRole("button", { name: "openInCanvas" }))
    fireEvent.click(screen.getByRole("button", { name: "canvasReplaceConfirm" }))
    expect(calls.navigate).toHaveBeenCalledWith("/canvas")
    expect(JSON.parse(localStorage.getItem("canvas-state")!).nodes[0].config.value).toBe("replacement")
  })
  it("opens an empty canvas immediately", () => {
    saveDraft(createJourney("Journey", "replacement", "Input"))
    localStorage.setItem("canvas-state", JSON.stringify({ nodes: [], edges: [] }))
    render(<JourneyPage />)
    fireEvent.click(screen.getByRole("button", { name: "openInCanvas" }))
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
    expect(calls.navigate).toHaveBeenCalledWith("/canvas")
  })
  it("loads JSON, removes the handle from the URL, and waits for explicit execution", async () => {
    const id = toolTransfers.put({ name: "Ada" }, "Source", "test-effect")
    window.history.replaceState(null, "", toolTransferUrl(id))
    render(<JourneyPage />)
    expect(screen.getByTestId("current-value")).toHaveTextContent('{"name":"Ada"}')
    expect(window.location.hash).toBe("")
    expect(calls.execute).not.toHaveBeenCalled()
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Run new step" })))
    expect(calls.execute).toHaveBeenCalledWith({ input: '{"name":"Ada"}' }, {}, { signal: expect.any(AbortSignal) })
  })
  it("keeps binary values as files", () => {
    window.history.replaceState(null, "", toolTransferUrl(toolTransfers.put(new Uint8Array([0, 255, 1]), "Wire payload")))
    render(<JourneyPage />)
    expect(screen.getByTestId("current-value")).toHaveTextContent("bytes:3")
  })
  it("preserves an unsaved draft until the user chooses to replace it", () => {
    saveDraft(createJourney("Existing", "keep me", "Original"))
    window.history.replaceState(null, "", toolTransferUrl(toolTransfers.put("incoming", "Source")))
    render(<JourneyPage />)
    expect(screen.getByText("draftConflict")).toBeInTheDocument()
    expect(loadDraft()?.name).toBe("Existing")
    fireEvent.click(screen.getByRole("button", { name: "restoreDraft" }))
    expect(screen.getByTestId("current-value")).toHaveTextContent('"keep me"')
  })
  it("handles an in-page transfer and an expired handle without replacing the draft", () => {
    saveDraft(createJourney("Existing", "keep me", "Original"))
    render(<JourneyPage />)
    act(() => {
      window.history.replaceState(null, "", "/journey#handoff=expired")
      window.dispatchEvent(new HashChangeEvent("hashchange"))
    })
    expect(calls.toast).toHaveBeenCalledWith({ title: "transferExpired", variant: "destructive" })
    expect(screen.getByTestId("current-value")).toHaveTextContent('"keep me"')
    act(() => {
      window.history.replaceState(null, "", toolTransferUrl(toolTransfers.put("new", "Source")))
      window.dispatchEvent(new HashChangeEvent("hashchange"))
    })
    fireEvent.click(screen.getByRole("button", { name: "startNew" }))
    expect(screen.getByTestId("current-value")).toHaveTextContent('"new"')
  })
})
