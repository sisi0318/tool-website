import { act, renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it } from "vitest"

import { useToolPreferences } from "./use-tool-preferences"

const toolIds = ["hash", "json", "encoding"]

describe("useToolPreferences", () => {
  beforeEach(() => window.localStorage.clear())

  it("persists favorites and removes them again", async () => {
    const { result } = renderHook(() => useToolPreferences(toolIds))
    await waitFor(() => expect(result.current.favoriteIds).toEqual([]))

    act(() => result.current.toggleFavorite("hash"))
    expect(result.current.favoriteIds).toEqual(["hash"])
    expect(JSON.parse(window.localStorage.getItem("tool_favorite_ids")!)).toEqual(["hash"])

    act(() => result.current.toggleFavorite("hash"))
    expect(result.current.favoriteIds).toEqual([])
  })

  it("keeps recent tools unique and ordered", async () => {
    const { result } = renderHook(() => useToolPreferences(toolIds))
    await waitFor(() => expect(result.current.recentIds).toEqual([]))

    act(() => {
      result.current.recordRecent("hash")
      result.current.recordRecent("json")
      result.current.recordRecent("hash")
    })

    expect(result.current.recentIds).toEqual(["hash", "json"])
  })

  it("ignores unknown tool ids from storage and updates", async () => {
    window.localStorage.setItem("tool_favorite_ids", JSON.stringify(["hash", "missing"]))
    const { result } = renderHook(() => useToolPreferences(toolIds))
    await waitFor(() => expect(result.current.favoriteIds).toEqual(["hash"]))

    act(() => result.current.toggleFavorite("missing"))
    expect(result.current.favoriteIds).toEqual(["hash"])
  })
})
