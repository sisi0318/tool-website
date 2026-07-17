import type { ConfigField, NodeDefinition } from "./types"
import { validateConnection } from "./validation"

export const CANVAS_FAVORITE_NODES_KEY = "canvas-favorite-nodes"
export const CANVAS_RECENT_NODES_KEY = "canvas-recent-nodes"
export const MAX_RECENT_NODES = 6

export interface NodeLibraryPreferences {
  favorites: string[]
  recent: string[]
}

export interface AutoConnectPlan {
  sourcePortId: string
  targetPortId: string
}

type ReadableStorage = Pick<Storage, "getItem">
type WritableStorage = Pick<Storage, "setItem">
type CategoryLabelResolver = (category: NodeDefinition["category"]) => string

function normalizeSearchValue(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase()
}

function fuzzySubsequenceScore(value: string, query: string): number | null {
  if (query.length < 2 || value.length < query.length) return null

  let cursor = 0
  let firstIndex = -1
  let previousIndex = -1
  let gaps = 0
  for (const character of query) {
    const index = value.indexOf(character, cursor)
    if (index < 0) return null
    if (firstIndex < 0) firstIndex = index
    if (previousIndex >= 0) gaps += Math.max(0, index - previousIndex - 1)
    previousIndex = index
    cursor = index + 1
  }

  return Math.max(1, 36 - firstIndex - gaps)
}

function parseStoredTypes(value: string | null, availableTypes: ReadonlySet<string>): string[] {
  if (!value) return []

  try {
    const parsed: unknown = JSON.parse(value)
    if (!Array.isArray(parsed)) return []

    return [...new Set(parsed)].filter(
      (type): type is string => typeof type === "string" && availableTypes.has(type)
    )
  } catch {
    return []
  }
}

export function loadNodeLibraryPreferences(
  definitions: readonly NodeDefinition[],
  storage?: ReadableStorage
): NodeLibraryPreferences {
  if (!storage) return { favorites: [], recent: [] }

  const availableTypes = new Set(definitions.map((definition) => definition.type))
  try {
    return {
      favorites: parseStoredTypes(
        storage.getItem(CANVAS_FAVORITE_NODES_KEY),
        availableTypes
      ),
      recent: parseStoredTypes(
        storage.getItem(CANVAS_RECENT_NODES_KEY),
        availableTypes
      ).slice(0, MAX_RECENT_NODES),
    }
  } catch {
    return { favorites: [], recent: [] }
  }
}

export function saveFavoriteNodeTypes(
  favorites: readonly string[],
  storage?: WritableStorage
): void {
  if (!storage) return
  try {
    storage.setItem(CANVAS_FAVORITE_NODES_KEY, JSON.stringify([...new Set(favorites)]))
  } catch {
    // Storage can be unavailable in private browsing or hardened environments.
  }
}

export function saveRecentNodeTypes(
  recent: readonly string[],
  storage?: WritableStorage
): void {
  if (!storage) return
  try {
    storage.setItem(
      CANVAS_RECENT_NODES_KEY,
      JSON.stringify([...new Set(recent)].slice(0, MAX_RECENT_NODES))
    )
  } catch {
    // Recent nodes are an optional convenience; adding a node must still work.
  }
}

export function toggleFavoriteNodeType(
  favorites: readonly string[],
  type: string
): string[] {
  return favorites.includes(type)
    ? favorites.filter((favorite) => favorite !== type)
    : [...favorites, type]
}

export function recordRecentNodeType(
  recent: readonly string[],
  type: string,
  limit = MAX_RECENT_NODES
): string[] {
  return [type, ...recent.filter((item) => item !== type)].slice(0, limit)
}

/**
 * Searches all visible metadata and ranks exact names and prefixes before
 * description-only matches. Every query token must match somewhere, which
 * keeps multi-word searches predictable without requiring exact phrases.
 */
export function searchNodeDefinitions(
  definitions: readonly NodeDefinition[],
  query: string,
  getCategoryLabel?: CategoryLabelResolver
): NodeDefinition[] {
  const normalizedQuery = normalizeSearchValue(query.trim())
  if (!normalizedQuery) return [...definitions]

  const tokens = normalizedQuery.split(/\s+/).filter(Boolean)
  return definitions
    .map((definition, index) => {
      const label = normalizeSearchValue(definition.label)
      const type = normalizeSearchValue(definition.type)
      const category = normalizeSearchValue(definition.category)
      const categoryLabel = normalizeSearchValue(
        getCategoryLabel?.(definition.category) ?? ""
      )
      const description = normalizeSearchValue(definition.description ?? "")
      const fields = [label, type, category, categoryLabel, description]
      const fuzzyFields = [label, type, categoryLabel]

      if (!tokens.every((token) =>
        fields.some((field) => field.includes(token)) ||
        fuzzyFields.some((field) => fuzzySubsequenceScore(field, token) !== null)
      )) {
        return null
      }

      let score = 0
      if (label === normalizedQuery) score += 1_000
      if (type === normalizedQuery) score += 900
      if (label.startsWith(normalizedQuery)) score += 500
      if (type.startsWith(normalizedQuery)) score += 400

      for (const token of tokens) {
        if (label === token) score += 160
        else if (label.startsWith(token)) score += 120
        else if (label.includes(token)) score += 90
        else if (type.includes(token)) score += 70
        else if (categoryLabel.includes(token) || category.includes(token)) score += 40
        else if (description.includes(token)) score += 20
        else {
          score += Math.max(
            ...fuzzyFields.map((field) => fuzzySubsequenceScore(field, token) ?? 0)
          )
        }
      }

      return { definition, index, score }
    })
    .filter(
      (result): result is { definition: NodeDefinition; index: number; score: number } =>
        result !== null
    )
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(({ definition }) => definition)
}

/**
 * Chooses a deterministic connection for the explicit "add after" action.
 * Exact data types win, followed by adapter port order so primary ports remain
 * the natural default.
 */
export function getAutoConnectPlan(
  sourceDefinition: NodeDefinition,
  targetDefinition: NodeDefinition
): AutoConnectPlan | null {
  const sourcePorts: ConfigField[] = [
    ...sourceDefinition.config.filter((field) => field.hasOutput),
    ...sourceDefinition.outputs,
  ]
  const targetPorts = targetDefinition.config.filter((field) => field.hasInput)

  const candidates = sourcePorts.flatMap((source, sourceIndex) =>
    targetPorts.flatMap((target, targetIndex) => {
      if (!validateConnection(source, target).valid) return []
      return [{
        source,
        target,
        sourceIndex,
        targetIndex,
        exact: source.dataType === target.dataType,
      }]
    })
  )

  candidates.sort(
    (a, b) =>
      Number(b.exact) - Number(a.exact) ||
      a.sourceIndex - b.sourceIndex ||
      a.targetIndex - b.targetIndex
  )

  const best = candidates[0]
  return best
    ? { sourcePortId: best.source.id, targetPortId: best.target.id }
    : null
}
