import { beforeEach, describe, expect, it } from "vitest"
import { exportPathToCanvas } from "./to-canvas"
import { createJourney, getPath } from "./tree"

const draft = (text: string) => JSON.stringify({ version: 1, nodes: [{ id: "original", type: "string", position: { x: 0, y: 0 }, config: { value: text } }], edges: [] })
function path() { const journey = createJourney("new", "replacement", "Input"); return getPath(journey, journey.rootId) }
beforeEach(() => localStorage.clear())

describe("journey canvas replacement guard", () => {
  it("opens a journey in an absent or empty canvas without confirmation", () => {
    expect(exportPathToCanvas(path()).ok).toBe(true)
    localStorage.setItem("canvas-state", JSON.stringify({ nodes: [], edges: [] }))
    expect(exportPathToCanvas(path()).ok).toBe(true)
  })
  it("keeps an existing draft until that exact snapshot is explicitly approved", () => {
    const original = draft("keep me")
    localStorage.setItem("canvas-state", original)
    expect(exportPathToCanvas(path())).toMatchObject({ ok: false, conflict: original })
    expect(localStorage.getItem("canvas-state")).toBe(original)
    expect(exportPathToCanvas(path(), original).ok).toBe(true)
    expect(JSON.parse(localStorage.getItem("canvas-state")!).nodes[0].config.value).toBe("replacement")
  })
  it("requires new confirmation if another tab changes the draft while the dialog is open", () => {
    const original = draft("first"), changed = draft("newer edit")
    localStorage.setItem("canvas-state", changed)
    expect(exportPathToCanvas(path(), original)).toMatchObject({ ok: false, conflict: changed })
    expect(localStorage.getItem("canvas-state")).toBe(changed)
  })
  it("does not silently discard unreadable canvas data", () => {
    localStorage.setItem("canvas-state", "invalid persisted data")
    expect(exportPathToCanvas(path())).toMatchObject({ ok: false, conflict: "invalid persisted data" })
    const malformed = JSON.stringify({ nodes: [{ damaged: true }], edges: [] })
    localStorage.setItem("canvas-state", malformed)
    expect(exportPathToCanvas(path())).toMatchObject({ ok: false, conflict: malformed })
  })
})
