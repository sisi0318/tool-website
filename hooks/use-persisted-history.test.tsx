import { act, renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it } from "vitest"

import { usePersistedHistory } from "./use-persisted-history"

interface Entry {
  id: string
  value: number
}

const isEntry = (value: unknown): value is Entry =>
  typeof value === "object" && value !== null && typeof (value as Entry).id === "string" && typeof (value as Entry).value === "number"

const KEY = "test-history"

describe("usePersistedHistory", () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it("首屏为空,挂载后从存储恢复并过滤掉坏记录", async () => {
    window.localStorage.setItem(
      KEY,
      JSON.stringify([{ id: "a", value: 1 }, { id: 2 }, "junk", { id: "b", value: 2 }]),
    )
    // renderHook 返回时 effect 已经跑过,首帧的值要在渲染函数里截下来看
    const firstRenders: Entry[][] = []
    const { result } = renderHook(() => {
      const state = usePersistedHistory<Entry>(KEY, 10, isEntry)
      firstRenders.push(state[0])
      return state
    })
    expect(firstRenders[0]).toEqual([])
    await waitFor(() => expect(result.current[0]).toEqual([{ id: "a", value: 1 }, { id: "b", value: 2 }]))
  })

  it("损坏的 JSON 当作没有历史", async () => {
    window.localStorage.setItem(KEY, "{not json")
    const { result } = renderHook(() => usePersistedHistory<Entry>(KEY, 10, isEntry))
    await waitFor(() => expect(result.current[0]).toEqual([]))
  })

  it("写入时同步到存储并按上限裁剪,清空后删除键", async () => {
    const { result } = renderHook(() => usePersistedHistory<Entry>(KEY, 2, isEntry))

    act(() => result.current[1]((previous) => [{ id: "c", value: 3 }, ...previous]))
    act(() => result.current[1]((previous) => [{ id: "d", value: 4 }, ...previous]))
    act(() => result.current[1]((previous) => [{ id: "e", value: 5 }, ...previous]))

    expect(result.current[0].map((entry) => entry.id)).toEqual(["e", "d"])
    expect(JSON.parse(window.localStorage.getItem(KEY)!)).toEqual([
      { id: "e", value: 5 },
      { id: "d", value: 4 },
    ])

    act(() => result.current[1]([]))
    expect(result.current[0]).toEqual([])
    expect(window.localStorage.getItem(KEY)).toBeNull()
  })
})
