import { act, renderHook } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { useBinaryFileTask } from "./use-binary-file-task"

vi.mock("@/hooks/use-translations", () => { const translate = (key: string) => key; return { useTranslations: () => translate } })

describe("binary file tasks", () => {
  it("cancels old work and never commits a stale result", async () => {
    const { result } = renderHook(() => useBinaryFileTask())
    let resolveOld!: (value: string) => void
    let oldSignal!: AbortSignal
    const commit = vi.fn()
    let oldRun!: Promise<void>
    act(() => { oldRun = result.current.run((signal) => { oldSignal = signal; return new Promise((resolve) => { resolveOld = resolve }) }, commit) })
    await act(async () => { await result.current.run(async () => "new", commit) })
    expect(oldSignal.aborted).toBe(true)
    await act(async () => { resolveOld("old"); await oldRun })
    expect(commit).toHaveBeenCalledTimes(1)
    expect(commit).toHaveBeenLastCalledWith("new")
    expect(result.current.running).toBe(false)
  })
  it("aborts active work on unmount", () => {
    const { result, unmount } = renderHook(() => useBinaryFileTask())
    let signal!: AbortSignal
    act(() => { void result.current.run((next) => { signal = next; return new Promise(() => {}) }, vi.fn()) })
    unmount()
    expect(signal.aborted).toBe(true)
  })
})
