import { act, renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it } from "vitest"
import { TOOL_PREFS_PREFIX, useToolPref } from "./use-tool-pref"

beforeEach(() => window.localStorage.clear())

describe("useToolPref", () => {
  it("starts from the default and then picks up the stored value", () => {
    window.localStorage.setItem(`${TOOL_PREFS_PREFIX}demo`, JSON.stringify({ length: 32 }))
    const { result } = renderHook(() => useToolPref("demo", "length", 20))
    expect(result.current[0]).toBe(32)
  })

  it("ignores stored values of the wrong type or rejected by the validator", () => {
    window.localStorage.setItem(`${TOOL_PREFS_PREFIX}demo`, JSON.stringify({ length: "32", format: "gif" }))
    const length = renderHook(() => useToolPref("demo", "length", 20)).result
    const format = renderHook(() => useToolPref("demo", "format", "png", (value) => ["png", "webp"].includes(value))).result
    expect(length.current[0]).toBe(20)
    expect(format.current[0]).toBe("png")
  })

  it("keeps each tool's options together in one key", () => {
    const length = renderHook(() => useToolPref("demo", "length", 20)).result
    const symbols = renderHook(() => useToolPref("demo", "symbols", true)).result
    act(() => length.current[1](24))
    act(() => symbols.current[1]((current) => !current))
    expect(JSON.parse(window.localStorage.getItem(`${TOOL_PREFS_PREFIX}demo`)!)).toEqual({ length: 24, symbols: false })
    expect(renderHook(() => useToolPref("demo", "length", 20)).result.current[0]).toBe(24)
  })

  it("survives corrupted storage", () => {
    window.localStorage.setItem(`${TOOL_PREFS_PREFIX}demo`, "{not json")
    const { result } = renderHook(() => useToolPref("demo", "length", 20))
    expect(result.current[0]).toBe(20)
    act(() => result.current[1](22))
    expect(JSON.parse(window.localStorage.getItem(`${TOOL_PREFS_PREFIX}demo`)!)).toEqual({ length: 22 })
  })
})
