import { describe, expect, it } from "vitest"

import { INITIAL_SESSION, currentJourney, journeySessionReducer, type JourneyAction, type JourneySession } from "./session"
import { createJourney } from "./tree"
import type { SharedJourneyPath } from "./types"

const shared: SharedJourneyPath = { v: 1, name: "shared", steps: [] }
const play = (actions: JourneyAction[], from: JourneySession = INITIAL_SESSION) => actions.reduce(journeySessionReducer, from)

describe("journey session", () => {
  it("starts on the input screen with nothing open", () => {
    expect(INITIAL_SESSION.screen.kind).toBe("input")
    expect(currentJourney(INITIAL_SESSION)).toBeNull()
  })

  it("opens a journey, optionally with an overlay already up", () => {
    const journey = createJourney("a", "data", "Input")
    const plain = play([{ type: "opened", journey }])
    expect(currentJourney(plain)).toBe(journey)
    expect(plain.overlay).toBeNull()

    const withStep = play([{ type: "opened", journey, overlay: { kind: "newStep", step: { tool: "hash", config: {}, outputPort: "hash" } } }])
    expect(withStep.overlay?.kind).toBe("newStep")
  })

  it("applies changes to the journey and keeps identity when nothing changed", () => {
    const journey = createJourney("a", "data", "Input")
    const opened = play([{ type: "opened", journey }])
    expect(journeySessionReducer(opened, { type: "changed", update: (current) => current })).toBe(opened)
    const renamed = journeySessionReducer(opened, { type: "changed", update: (current) => ({ ...current, name: "b" }) })
    expect(currentJourney(renamed)?.name).toBe("b")
    // 不在旅程这一屏时没有可改的东西
    expect(journeySessionReducer(INITIAL_SESSION, { type: "changed", update: (current) => ({ ...current, name: "x" }) })).toBe(INITIAL_SESSION)
  })

  it("parks the current journey behind an import and closes whatever was open", () => {
    const journey = createJourney("mine", "data", "Input")
    const importing = play([
      { type: "opened", journey },
      { type: "overlayOpened", overlay: { kind: "share" } },
      { type: "importRequested", shared, review: [], template: null, stored: null },
    ])
    expect(importing.screen.kind).toBe("import")
    expect(importing.parked).toBe(journey)
    expect(importing.overlay).toBeNull()
    expect(currentJourney(importing)).toBeNull()
  })

  it("keeps the originally parked journey when another link or template arrives during an import", () => {
    const journey = createJourney("mine", "data", "Input")
    const stored = createJourney("stored", "old", "Input")
    const twice = play([
      { type: "opened", journey },
      { type: "importRequested", shared, review: [], template: null, stored },
      { type: "importRequested", shared: { ...shared, name: "second" }, review: [], template: null, stored },
    ])
    expect(twice.parked).toBe(journey)
    expect(twice.screen.kind === "import" && twice.screen.shared.name).toBe("second")
  })

  it("parks the stored draft when a link is opened on a fresh page", () => {
    const stored = createJourney("stored", "old", "Input")
    const importing = play([{ type: "importRequested", shared, review: [], template: null, stored }])
    expect(importing.parked).toBe(stored)
  })

  it("returns to the parked journey when the import is abandoned, or to the input screen if there was none", () => {
    const journey = createJourney("mine", "data", "Input")
    const back = play([
      { type: "opened", journey },
      { type: "importRequested", shared, review: [], template: null, stored: null },
      { type: "parkedRestored" },
    ])
    expect(currentJourney(back)).toBe(journey)
    expect(back.parked).toBeNull()

    const nothingParked = play([{ type: "importRequested", shared, review: [], template: null, stored: null }, { type: "parkedRestored" }])
    expect(nothingParked.screen.kind).toBe("input")
  })

  it("drops the parked journey once the imported path actually starts", () => {
    const journey = createJourney("mine", "data", "Input")
    const started = play([
      { type: "opened", journey },
      { type: "importRequested", shared, review: [], template: null, stored: null },
      { type: "opened", journey: createJourney("imported", "new", "Input") },
    ])
    expect(currentJourney(started)?.name).toBe("imported")
    expect(started.parked).toBeNull()
  })

  it("holds incoming data on its own screen with the unsaved journey parked", () => {
    const journey = createJourney("mine", "data", "Input")
    const transfer = { value: "incoming", valueType: "string" as const, source: "Hash" }
    const held = play([{ type: "opened", journey }, { type: "transferHeld", transfer, parked: journey }])
    expect(held.screen.kind).toBe("transfer")
    expect(held.parked).toBe(journey)
    // 这一屏上没有可操作的旅程,连模板选择器也不开
    expect(journeySessionReducer(held, { type: "overlayOpened", overlay: { kind: "templates" } }).overlay).toBeNull()
  })

  it("only opens journey overlays while a journey is on screen, but templates from anywhere else", () => {
    expect(journeySessionReducer(INITIAL_SESSION, { type: "overlayOpened", overlay: { kind: "share" } })).toBe(INITIAL_SESSION)
    expect(journeySessionReducer(INITIAL_SESSION, { type: "overlayOpened", overlay: { kind: "templates" } }).overlay?.kind).toBe("templates")
  })

  it("resets to the input screen and forgets everything", () => {
    const journey = createJourney("mine", "data", "Input")
    const cleared = play([{ type: "opened", journey }, { type: "overlayOpened", overlay: { kind: "branches" } }, { type: "reset" }])
    expect(cleared).toEqual(INITIAL_SESSION)
  })

  it("tracks a run without touching the screen", () => {
    const journey = createJourney("mine", "data", "Input")
    const running = play([{ type: "opened", journey }, { type: "runStarted", progress: { current: 1, total: 3, tool: "ocr" } }, { type: "runProgressed", progress: { current: 2, total: 3, tool: "hash" } }])
    expect(running.run).toEqual({ current: 2, total: 3, tool: "hash" })
    expect(currentJourney(running)).toBe(journey)
    const done = journeySessionReducer(running, { type: "runFinished" })
    expect(done.run).toBeNull()
    expect(journeySessionReducer(done, { type: "runFinished" })).toBe(done)
  })
})
