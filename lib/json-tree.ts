export type JsonTreeValue = string | number | boolean | null | JsonTreeValue[] | { [key: string]: JsonTreeValue }
export interface JsonTreeEntry {
  id: string
  path: string
  key: string
  parent: string | null
  depth: number
  value: JsonTreeValue
  type: "array" | "object" | "string" | "number" | "boolean" | "null"
  childCount: number
  children: string[]
}
export interface JsonTreeIndex { entries: JsonTreeEntry[]; byId: Map<string, JsonTreeEntry>; limited: boolean }
export const JSON_TREE_MAX_NODES = 20_000
const MAX_DEPTH = 128
const isContainer = (value: JsonTreeValue): value is JsonTreeValue[] | Record<string, JsonTreeValue> => value !== null && typeof value === "object"
const childId = (parent: string, key: string) => `${parent}/${key.replace(/~/g, "~0").replace(/\//g, "~1")}`
const childPath = (parent: string, key: string, array: boolean) => array ? `${parent}[${key}]` : /^[A-Za-z_$][\w$]*$/.test(key) ? `${parent}.${key}` : `${parent}[${JSON.stringify(key)}]`
export const isInJsonSubtree = (id: string, root: string) => id === root || root === "" || id.startsWith(`${root}/`)

/** Iterative, bounded indexing. IDs are JSON Pointers, so dots and slashes in keys cannot collide. */
export function indexJsonTree(value: JsonTreeValue, maxNodes = JSON_TREE_MAX_NODES): JsonTreeIndex {
  const entries: JsonTreeEntry[] = []
  const byId = new Map<string, JsonTreeEntry>()
  let limited = false
  const stack: Array<{ entry: JsonTreeEntry; keys: string[] | null; next: number }> = []
  const add = (value: JsonTreeValue, key: string, parent: JsonTreeEntry | null) => {
    const array = Array.isArray(value)
    const keys = isContainer(value) && !array ? Object.keys(value) : null
    const entry: JsonTreeEntry = {
      id: parent ? childId(parent.id, key) : "", path: parent ? childPath(parent.path, key, parent.type === "array") : "$", key,
      parent: parent?.id ?? null, depth: parent ? parent.depth + 1 : 0, value,
      type: array ? "array" : value === null ? "null" : typeof value as JsonTreeEntry["type"],
      childCount: array ? value.length : keys?.length ?? 0, children: [],
    }
    entries.push(entry)
    byId.set(entry.id, entry)
    if (parent) parent.children.push(entry.id)
    if (entry.childCount > 0) {
      if (entry.depth >= MAX_DEPTH) limited = true
      else stack.push({ entry, keys, next: 0 })
    }
  }
  add(value, "$", null)
  while (stack.length) {
    const frame = stack[stack.length - 1]
    if (frame.next >= frame.entry.childCount) { stack.pop(); continue }
    if (entries.length >= maxNodes) { limited = true; break }
    const key = frame.keys ? frame.keys[frame.next++] : String(frame.next++)
    add((frame.entry.value as Record<string, JsonTreeValue>)[key], key, frame.entry)
  }
  return { entries, byId, limited }
}

export function expandJsonTreeToDepth(index: JsonTreeIndex, depth: number, scope = ""): Set<string> {
  const rootDepth = index.byId.get(scope)?.depth ?? 0
  return new Set(index.entries.filter((entry) => entry.childCount > 0 && entry.depth - rootDepth < depth && isInJsonSubtree(entry.id, scope)).map((entry) => entry.id))
}

export function visibleJsonTreeEntries(index: JsonTreeIndex, expanded: ReadonlySet<string>, scope = "", query = "", searchCollapsed: ReadonlySet<string> = new Set()): { entries: JsonTreeEntry[]; matches: Set<string> } {
  const scoped = index.entries.filter((entry) => isInJsonSubtree(entry.id, scope))
  const needle = query.trim().toLowerCase()
  const matches = new Set<string>()
  const included = new Set<string>()
  if (needle) {
    let matchedContainerDepth: number | null = null
    for (const entry of scoped) {
      if (matchedContainerDepth !== null && entry.depth <= matchedContainerDepth) matchedContainerDepth = null
      const matched = entry.key.toLowerCase().includes(needle) || (!isContainer(entry.value) && String(entry.value).toLowerCase().includes(needle))
      if (matched) matches.add(entry.id)
      if (matched || matchedContainerDepth !== null) {
        let current: JsonTreeEntry | undefined = entry
        while (current && isInJsonSubtree(current.id, scope) && !included.has(current.id)) {
          included.add(current.id)
          current = current.parent === null ? undefined : index.byId.get(current.parent)
        }
      }
      if (matched && entry.childCount > 0 && matchedContainerDepth === null) matchedContainerDepth = entry.depth
    }
  }
  let hiddenBelow: number | null = null
  const entries = scoped.filter((entry) => {
    if (hiddenBelow !== null && entry.depth <= hiddenBelow) hiddenBelow = null
    if (hiddenBelow !== null || (needle && !included.has(entry.id))) return false
    if (entry.childCount > 0 && (needle ? searchCollapsed.has(entry.id) : !expanded.has(entry.id))) hiddenBelow = entry.depth
    return true
  })
  return { entries, matches }
}

export function jsonTreePreview(value: JsonTreeValue, limit = 120): string {
  if (Array.isArray(value)) return `[${value.length}]`
  if (value !== null && typeof value === "object") return `{${Object.keys(value).length}}`
  if (typeof value === "string") return JSON.stringify(value.slice(0, limit)) + (value.length > limit ? "…" : "")
  return String(value)
}
