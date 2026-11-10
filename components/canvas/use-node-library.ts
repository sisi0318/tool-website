"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { getAllNodes } from "@/lib/canvas/registry"
import {
  loadNodeLibraryPreferences,
  recordRecentNodeType,
  saveFavoriteNodeTypes,
  saveRecentNodeTypes,
  searchNodeDefinitions,
  toggleFavoriteNodeType,
} from "@/lib/canvas/node-library"
import type { NodeDefinition } from "@/lib/canvas/types"
import { useTranslations } from "@/hooks/use-translations"
import { zhCanvas } from "@/lib/translations/zh-namespaces/canvas"
import { useNodeLabel } from "@/hooks/use-node-label"
import { CATEGORY_IDS, CATEGORY_KEYS, type NodeCategory } from "./node-categories"

function getBrowserStorage(): Storage | undefined {
  if (typeof window === "undefined") return undefined
  try {
    return window.localStorage
  } catch {
    return undefined
  }
}

export interface NodeGroup {
  id: string
  label: string
  nodes: NodeDefinition[]
}

export interface NodeLibrary {
  allNodes: NodeDefinition[]
  favorites: NodeDefinition[]
  recent: NodeDefinition[]
  /** 八个分类，各带自己的节点；没有节点的分类不出现 */
  categories: NodeGroup[]
  isFavorite: (type: string) => boolean
  toggleFavorite: (type: string) => void
  /** 用过一次：排到“最近使用”最前面 */
  recordUse: (type: string) => void
  search: (query: string) => NodeDefinition[]
  categoryLabel: (category: NodeCategory) => string
}

/**
 * 节点库的数据：全部节点、收藏、最近使用和搜索。
 * 左侧节点栏和双击画布弹出的菜单用的是同一份，所以放在画布这一层，
 * 在哪边添加过节点，另一边的“最近使用”都跟着变。
 */
export function useNodeLibrary(): NodeLibrary {
  const t = useTranslations("canvas", zhCanvas)
  const nodeLabel = useNodeLabel()
  const allNodes = useMemo(() => getAllNodes(), [])
  const definitionByType = useMemo(
    () => new Map(allNodes.map((definition) => [definition.type, definition])),
    [allNodes]
  )
  const [favoriteTypes, setFavoriteTypes] = useState<string[]>([])
  const [recentTypes, setRecentTypes] = useState<string[]>([])

  useEffect(() => {
    const preferences = loadNodeLibraryPreferences(allNodes, getBrowserStorage())
    setFavoriteTypes(preferences.favorites)
    setRecentTypes(preferences.recent)
  }, [allNodes])

  const categoryLabel = useCallback(
    (category: NodeCategory) => t(CATEGORY_KEYS[category]),
    [t]
  )

  const toDefinitions = useCallback(
    (types: string[]) => types.flatMap((type) => {
      const definition = definitionByType.get(type)
      return definition ? [definition] : []
    }),
    [definitionByType]
  )

  const favorites = useMemo(() => toDefinitions(favoriteTypes), [favoriteTypes, toDefinitions])
  const recent = useMemo(() => toDefinitions(recentTypes), [recentTypes, toDefinitions])

  const categories = useMemo<NodeGroup[]>(
    () => CATEGORY_IDS.flatMap((category) => {
      const nodes = allNodes.filter((definition) => definition.category === category)
      return nodes.length > 0 ? [{ id: category, label: categoryLabel(category), nodes }] : []
    }),
    [allNodes, categoryLabel]
  )

  const isFavorite = useCallback((type: string) => favoriteTypes.includes(type), [favoriteTypes])

  const toggleFavorite = useCallback((type: string) => {
    setFavoriteTypes((current) => {
      const next = toggleFavoriteNodeType(current, type)
      saveFavoriteNodeTypes(next, getBrowserStorage())
      return next
    })
  }, [])

  const recordUse = useCallback((type: string) => {
    setRecentTypes((current) => {
      const next = recordRecentNodeType(current, type)
      saveRecentNodeTypes(next, getBrowserStorage())
      return next
    })
  }, [])

  const search = useCallback(
    (query: string) => searchNodeDefinitions(allNodes, query, categoryLabel, nodeLabel),
    [allNodes, categoryLabel, nodeLabel]
  )

  return useMemo(
    () => ({ allNodes, favorites, recent, categories, isFavorite, toggleFavorite, recordUse, search, categoryLabel }),
    [allNodes, favorites, recent, categories, isFavorite, toggleFavorite, recordUse, search, categoryLabel]
  )
}
