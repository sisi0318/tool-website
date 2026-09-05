export type StructuredFormat = "json" | "yaml"
export type StructuredValue = null | boolean | number | string | StructuredValue[] | { [key: string]: StructuredValue }
export type StructuredDiffErrorCode = "invalidInput" | "inputLimit" | "structureLimit" | "unsafeNumber" | "circular" | "invalidIgnore" | "missingKey" | "duplicateKey"

export class StructuredDiffError extends Error {
  constructor(public readonly code: StructuredDiffErrorCode, public readonly path = "", public side?: "left" | "right", public readonly detail = "") {
    super(`Structured diff ${code}${path ? ` at ${path}` : ""}`)
    this.name = "StructuredDiffError"
  }
}

export interface StructuredChange {
  type: "added" | "removed" | "changed"
  path: string
  oldPath?: string
  newPath?: string
  oldValue?: StructuredValue
  newValue?: StructuredValue
}
export interface StructuredDiffOptions { ignorePaths?: string[]; arrayKey?: string }
export interface StructuredDiffResult { equal: boolean; added: number; removed: number; changed: number; unchanged: number; changes: StructuredChange[] }

const MAX_INPUT = 2 * 1024 * 1024
const MAX_NODES = 50_000
const MAX_DEPTH = 80
const MAX_CHANGES = 10_000
const ABSENT = Symbol("absent")
const isRecord = (value: unknown): value is Record<string, StructuredValue> => !!value && typeof value === "object" && !Array.isArray(value)
const pointer = (path: string[]) => path.length ? `/${path.map((key) => key.replace(/~/g, "~0").replace(/\//g, "~1")).join("/")}` : ""
const displayKey = (parent: string, key: string) => /^[A-Za-z_$][\w$]*$/.test(key) ? `${parent}.${key}` : `${parent}[${JSON.stringify(key)}]`

function validateValue(value: unknown): asserts value is StructuredValue {
  let nodes = 0
  const ancestors = new WeakSet<object>()
  const visit = (item: unknown, path: string[], depth: number) => {
    if (++nodes > MAX_NODES || depth > MAX_DEPTH) throw new StructuredDiffError("structureLimit", pointer(path))
    if (typeof item === "number" && (!Number.isFinite(item) || (Number.isInteger(item) && !Number.isSafeInteger(item)))) throw new StructuredDiffError("unsafeNumber", pointer(path))
    if (item === undefined || (item !== null && !["boolean", "number", "string", "object"].includes(typeof item))) throw new StructuredDiffError("invalidInput", pointer(path))
    if (item && typeof item === "object") {
      if (ancestors.has(item)) throw new StructuredDiffError("circular", pointer(path))
      ancestors.add(item)
      for (const [key, child] of Object.entries(item)) visit(child, [...path, key], depth + 1)
      ancestors.delete(item)
    }
  }
  visit(value, [], 0)
}

export async function parseStructuredData(input: string, format: StructuredFormat): Promise<StructuredValue> {
  if (input.length > MAX_INPUT) throw new StructuredDiffError("inputLimit")
  if (!input.trim()) throw new StructuredDiffError("invalidInput")
  let value: unknown
  try {
    if (format === "yaml") {
      const yaml = await import("js-yaml")
      // JSON_SCHEMA leaves timestamps as strings and excludes language-specific tags.
      value = yaml.load(input, { schema: yaml.JSON_SCHEMA })
    } else value = JSON.parse(input)
  } catch (error) {
    throw new StructuredDiffError(error instanceof RangeError ? "structureLimit" : "invalidInput", "", undefined, error instanceof Error ? error.message.slice(0, 300) : "")
  }
  validateValue(value)
  return value
}

function compileIgnores(paths: string[]): (path: string[]) => boolean {
  if (paths.length > 100 || paths.some((path) => path.length > 1000)) throw new StructuredDiffError("invalidIgnore")
  const patterns = paths.map((path) => {
    const text = path.trim()
    if (text === "$" || text === "") return []
    if (text.startsWith("/")) {
      if (/~(?![01])/.test(text)) throw new StructuredDiffError("invalidIgnore")
      return text.slice(1).split("/").map((part) => part.replace(/~1/g, "/").replace(/~0/g, "~"))
    }
    return text.replace(/^\$\./, "").split(".")
  })
  let work = 0
  return (path) => patterns.some((pattern) => {
    const memo = new Map<string, boolean>()
    const matches = (i: number, j: number): boolean => {
      if (++work > 2_000_000) throw new StructuredDiffError("structureLimit")
      const key = `${i}:${j}`
      if (memo.has(key)) return memo.get(key)!
      const result = i === pattern.length ? j === path.length
        : pattern[i] === "**" ? matches(i + 1, j) || (j < path.length && matches(i, j + 1))
          : j < path.length && (pattern[i] === "*" || pattern[i] === path[j]) && matches(i + 1, j + 1)
      memo.set(key, result)
      return result
    }
    return matches(0, 0)
  })
}

export function compareStructuredValues(left: StructuredValue, right: StructuredValue, options: StructuredDiffOptions = {}): StructuredDiffResult {
  validateValue(left)
  validateValue(right)
  const ignored = compileIgnores(options.ignorePaths ?? [])
  const arrayKey = options.arrayKey?.trim() ?? ""
  const changes: StructuredChange[] = []
  let unchanged = 0
  let work = 0

  const withoutIgnored = (value: StructuredValue, path: string[]): StructuredValue => {
    if (Array.isArray(value)) return value.flatMap((item, index) => ignored([...path, String(index)]) ? [] : [withoutIgnored(item, [...path, String(index)])])
    if (isRecord(value)) return Object.fromEntries(Object.entries(value).filter(([key]) => !ignored([...path, key])).map(([key, item]) => [key, withoutIgnored(item, [...path, key])]))
    return value
  }

  const emit = (a: StructuredValue | typeof ABSENT, b: StructuredValue | typeof ABSENT, oldPath: string[], newPath: string[], path: string) => {
    if (changes.length >= MAX_CHANGES) throw new StructuredDiffError("structureLimit", path)
    changes.push({ type: a === ABSENT ? "added" : b === ABSENT ? "removed" : "changed", path,
      ...(a !== ABSENT ? { oldPath: pointer(oldPath), oldValue: withoutIgnored(a, oldPath) } : {}),
      ...(b !== ABSENT ? { newPath: pointer(newPath), newValue: withoutIgnored(b, newPath) } : {}),
    })
  }

  const keyedItems = (items: StructuredValue[], path: string[], side: "left" | "right") => {
    const result = new Map<string, { value: StructuredValue; index: number; id: string | number | boolean }>()
    items.forEach((value, index) => {
      const id = isRecord(value) && Object.hasOwn(value, arrayKey) ? value[arrayKey] : undefined
      if (typeof id !== "string" && typeof id !== "number" && typeof id !== "boolean") throw new StructuredDiffError("missingKey", pointer([...path, String(index)]), side)
      const key = `${typeof id}:${id}`
      if (result.has(key)) throw new StructuredDiffError("duplicateKey", pointer([...path, String(index)]), side)
      result.set(key, { value, index, id })
    })
    return result
  }

  const walk = (a: StructuredValue | typeof ABSENT, b: StructuredValue | typeof ABSENT, oldPath: string[], newPath: string[], path: string) => {
    if (++work > MAX_NODES * 2) throw new StructuredDiffError("structureLimit", path)
    if (ignored(oldPath) || ignored(newPath)) return
    if (a === b) { unchanged++; return }
    if ((isRecord(a) || a === ABSENT) && (isRecord(b) || b === ABSENT)) {
      const oldObject = a === ABSENT ? {} : a
      const newObject = b === ABSENT ? {} : b
      const keys = new Set([...Object.keys(oldObject), ...Object.keys(newObject)])
      if (!keys.size) { if (a === ABSENT || b === ABSENT) emit(a, b, oldPath, newPath, path); else unchanged++; return }
      for (const key of keys) walk(Object.hasOwn(oldObject, key) ? oldObject[key] : ABSENT, Object.hasOwn(newObject, key) ? newObject[key] : ABSENT, [...oldPath, key], [...newPath, key], displayKey(path, key))
    } else if ((Array.isArray(a) || a === ABSENT) && (Array.isArray(b) || b === ABSENT)) {
      const oldArray = a === ABSENT ? [] : a
      const newArray = b === ABSENT ? [] : b
      if (!oldArray.length && !newArray.length) { if (a === ABSENT || b === ABSENT) emit(a, b, oldPath, newPath, path); else unchanged++; return }
      if (arrayKey && [...oldArray, ...newArray].some(isRecord)) {
        const oldItems = keyedItems(oldArray, oldPath, "left")
        const newItems = keyedItems(newArray, newPath, "right")
        for (const key of new Set([...oldItems.keys(), ...newItems.keys()])) {
          const oldItem = oldItems.get(key)
          const newItem = newItems.get(key)
          walk(oldItem?.value ?? ABSENT, newItem?.value ?? ABSENT, [...oldPath, String(oldItem?.index ?? newItem!.index)], [...newPath, String(newItem?.index ?? oldItem!.index)], `${path}[${arrayKey}=${JSON.stringify((oldItem ?? newItem)!.id)}]`)
        }
      } else {
        for (let index = 0; index < Math.max(oldArray.length, newArray.length); index++) walk(index < oldArray.length ? oldArray[index] : ABSENT, index < newArray.length ? newArray[index] : ABSENT, [...oldPath, String(index)], [...newPath, String(index)], `${path}[${index}]`)
      }
    } else emit(a, b, oldPath, newPath, path)
  }
  walk(left, right, [], [], "$")
  return { equal: changes.length === 0, changes, unchanged, added: changes.filter((change) => change.type === "added").length, removed: changes.filter((change) => change.type === "removed").length, changed: changes.filter((change) => change.type === "changed").length }
}

export async function compareStructuredText(left: string, right: string, format: StructuredFormat, options: StructuredDiffOptions = {}): Promise<StructuredDiffResult> {
  const parse = async (text: string, side: "left" | "right") => {
    try { return await parseStructuredData(text, format) } catch (error) { if (error instanceof StructuredDiffError) error.side = side; throw error }
  }
  return compareStructuredValues(await parse(left, "left"), await parse(right, "right"), options)
}
