"use client"

import { useCallback, useEffect, useState } from "react"
import { readSessionStorage, removeSessionStorage, writeSessionStorage } from "@/lib/safe-storage"

/** 已在 lib/storage/app-storage.ts 登记的前缀（sessionStorage） */
export const TOOL_DRAFT_PREFIX = "tool-draft:"

/** 超过这个长度不存：几 MB 的内容没必要写进存储，也可能超出配额 */
export const MAX_TOOL_DRAFT_CHARS = 256 * 1024

/**
 * 工具主输入的草稿，存在 sessionStorage：刷新页面、跳到数据旅程再返回都还在，
 * 关闭标签页即消失。以前这些输入只在组件状态里，任何一次离开都要重新粘贴。
 *
 * 只给普通文本输入用；可能粘贴私钥、密钥的工具不要用。
 * 挂载后才恢复草稿，而且只在输入仍是初始值时恢复 —— 链接里的 ?input= 等更明确的来源优先。
 */
export function useToolDraft(toolId: string, initial = ""): [string, (value: string | ((current: string) => string)) => void] {
  const key = TOOL_DRAFT_PREFIX + toolId
  const [value, setValue] = useState(initial)

  useEffect(() => {
    const stored = readSessionStorage(key)
    if (stored !== null) setValue((current) => (current === initial ? stored : current))
    // 只在挂载时恢复一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  const update = useCallback(
    (next: string | ((current: string) => string)) => {
      setValue((current) => {
        const resolved = typeof next === "function" ? next(current) : next
        if (!resolved || resolved.length > MAX_TOOL_DRAFT_CHARS) removeSessionStorage(key)
        else writeSessionStorage(key, resolved)
        return resolved
      })
    },
    [key],
  )

  return [value, update]
}
