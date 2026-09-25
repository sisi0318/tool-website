"use client"

import { useCallback, useEffect, useState } from "react"
import { readLocalStorage, writeLocalStorage } from "@/lib/safe-storage"

/** 已在 lib/storage/app-storage.ts 登记的前缀：每个工具一个键，值是 { 选项名: 值 } */
export const TOOL_PREFS_PREFIX = "tool-prefs:"

export type ToolPrefValue = string | number | boolean

/** 字面量默认值（20、true、"-"）推断出的类型拓宽回 number / boolean / string */
type Widen<T> = T extends string ? string : T extends number ? number : T extends boolean ? boolean : never

function readToolPrefs(toolId: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(readLocalStorage(TOOL_PREFS_PREFIX + toolId) ?? "{}")
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

/**
 * 记住工具的某个选项（格式、长度、质量、开关……），下次打开沿用。
 * 只用于选项：输入内容、密钥和文件不要放进来。
 *
 * 首帧用默认值、挂载后再读，避免服务端渲染与首帧不一致；存储里类型对不上
 * 或 isValid 不认可的值直接忽略。同一工具的选项存在同一个键里，设置页可以统计和清除。
 */
export function useToolPref<T extends ToolPrefValue>(
  toolId: string,
  name: string,
  initial: T,
  isValid?: (value: Widen<T>) => boolean,
): [Widen<T>, (value: Widen<T> | ((current: Widen<T>) => Widen<T>)) => void] {
  type Value = Widen<T>
  const [value, setValue] = useState<Value>(initial as unknown as Value)

  useEffect(() => {
    const stored = readToolPrefs(toolId)[name]
    const sameType = typeof stored === typeof initial && (typeof stored !== "number" || Number.isFinite(stored))
    if (sameType && (!isValid || isValid(stored as Value))) setValue(stored as Value)
    // 只在挂载时读一次；initial 与 isValid 通常是字面量或模块级函数
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toolId, name])

  const update = useCallback(
    (next: Value | ((current: Value) => Value)) => {
      setValue((current) => {
        const resolved = typeof next === "function" ? next(current) : next
        writeLocalStorage(TOOL_PREFS_PREFIX + toolId, JSON.stringify({ ...readToolPrefs(toolId), [name]: resolved }))
        return resolved
      })
    },
    [toolId, name],
  )

  return [value, update]
}
