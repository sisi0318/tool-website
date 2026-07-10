"use client"

import { useCallback, useEffect, useMemo, useState } from "react"

const FAVORITES_STORAGE_KEY = "tool_favorite_ids"
const RECENTS_STORAGE_KEY = "tool_recent_ids"
const MAX_RECENT_TOOLS = 8

function readStoredIds(key: string, validIds: Set<string>): string[] {
  if (typeof window === "undefined") return []

  try {
    const value = JSON.parse(window.localStorage.getItem(key) ?? "[]")
    if (!Array.isArray(value)) return []
    return [...new Set(value.filter((id): id is string => typeof id === "string" && validIds.has(id)))]
  } catch {
    return []
  }
}

export function useToolPreferences(toolIds: string[]) {
  const validIds = useMemo(() => new Set(toolIds), [toolIds])
  const [favoriteIds, setFavoriteIds] = useState<string[]>([])
  const [recentIds, setRecentIds] = useState<string[]>([])

  useEffect(() => {
    const load = () => {
      setFavoriteIds(readStoredIds(FAVORITES_STORAGE_KEY, validIds))
      setRecentIds(readStoredIds(RECENTS_STORAGE_KEY, validIds))
    }

    load()
    window.addEventListener("storage", load)
    return () => window.removeEventListener("storage", load)
  }, [validIds])

  const toggleFavorite = useCallback((toolId: string) => {
    if (!validIds.has(toolId)) return

    setFavoriteIds((current) => {
      const next = current.includes(toolId)
        ? current.filter((id) => id !== toolId)
        : [...current, toolId]
      window.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }, [validIds])

  const recordRecent = useCallback((toolId: string) => {
    if (!validIds.has(toolId)) return

    setRecentIds((current) => {
      const next = [toolId, ...current.filter((id) => id !== toolId)].slice(0, MAX_RECENT_TOOLS)
      window.localStorage.setItem(RECENTS_STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }, [validIds])

  return { favoriteIds, recentIds, toggleFavorite, recordRecent }
}
