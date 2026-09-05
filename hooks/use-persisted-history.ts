"use client"

import { useCallback, useEffect, useState } from "react"

import { readLocalStorage, removeLocalStorage, writeLocalStorage } from "@/lib/safe-storage"

/**
 * 工具的历史记录:内存态 + localStorage。
 *
 * 首屏一律是空数组,挂载后再读存储 —— 服务端没有 localStorage,初始 state 直接读会造成
 * 水合不一致(time 页踩过的坑)。存储里的记录按 isItem 逐条过滤,坏数据当作没有。
 * 清空后直接删掉键,不留一个 "[]" 在设置页的数据一览里占位。
 */
export function usePersistedHistory<T>(
  key: string,
  limit: number,
  isItem: (value: unknown) => value is T,
): [T[], (update: T[] | ((previous: T[]) => T[])) => void] {
  const [history, setHistoryState] = useState<T[]>([])

  useEffect(() => {
    try {
      const parsed: unknown = JSON.parse(readLocalStorage(key) ?? "[]")
      if (Array.isArray(parsed)) setHistoryState(parsed.filter(isItem).slice(0, limit))
    } catch {
      // 损坏的记录直接当作没有
    }
    // isItem 是无状态的守卫函数,按 key 读一次即可
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, limit])

  const setHistory = useCallback(
    (update: T[] | ((previous: T[]) => T[])) => {
      setHistoryState((previous) => {
        const next = (typeof update === "function" ? update(previous) : update).slice(0, limit)
        if (next.length === 0) removeLocalStorage(key)
        else writeLocalStorage(key, JSON.stringify(next))
        return next
      })
    },
    [key, limit],
  )

  return [history, setHistory]
}
