import { Braces } from "lucide-react"
import type { ToolAdapter } from "./types"
import { registerNode } from "../canvas/registry"

interface PathSegment {
  key: string
  /** 方括号里的纯数字才是数组下标;点号后的数字仍是对象键名 */
  isIndex: boolean
}

/**
 * 解析 JSONPath 的下标表达式。
 * 之前直接按 /\.|\[|\]/ 切分,含点的键名(`$["a.b"]`)会被切成两段,
 * 引号也不会被剥掉,导致取值结果错误。
 */
export function parseJsonPath(path: string): PathSegment[] {
  if (!path.startsWith("$")) throw new Error("Path must start with $")

  const segments: PathSegment[] = []
  let index = 1

  while (index < path.length) {
    const char = path[index]

    if (char === ".") {
      index += 1
      let key = ""
      while (index < path.length && path[index] !== "." && path[index] !== "[") {
        key += path[index]
        index += 1
      }
      if (key === "") throw new Error(`Empty path segment in ${path}`)
      segments.push({ key, isIndex: false })
      continue
    }

    if (char === "[") {
      const close = findClosingBracket(path, index)
      const raw = path.slice(index + 1, close).trim()
      index = close + 1

      const isQuoted =
        raw.length >= 2 && (raw[0] === "'" || raw[0] === '"') && raw[raw.length - 1] === raw[0]
      if (isQuoted) {
        segments.push({ key: raw.slice(1, -1), isIndex: false })
        continue
      }
      if (!/^-?\d+$/.test(raw)) throw new Error(`Invalid array index: [${raw}]`)
      segments.push({ key: raw, isIndex: true })
      continue
    }

    throw new Error(`Unexpected character '${char}' in ${path}`)
  }

  return segments
}

function findClosingBracket(path: string, open: number): number {
  let quote: string | null = null
  for (let i = open + 1; i < path.length; i += 1) {
    const char = path[i]
    if (quote) {
      if (char === quote) quote = null
      continue
    }
    if (char === "'" || char === '"') {
      quote = char
      continue
    }
    if (char === "]") return i
  }
  throw new Error(`Unclosed '[' in ${path}`)
}

/** 只有真正能解释成数字的标量才转换,其余返回 NaN 以示"不是数字"。 */
function toFiniteNumber(value: unknown): number {
  if (typeof value === "boolean") return value ? 1 : 0
  if (typeof value !== "string") return Number.NaN
  const trimmed = value.trim()
  if (trimmed === "") return Number.NaN
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : Number.NaN
}

function getByPath(obj: unknown, path: string): unknown {
  if (path === "$") return obj

  let current = obj
  for (const segment of parseJsonPath(path)) {
    if (current == null) return undefined
    if (segment.isIndex) {
      if (!Array.isArray(current)) throw new Error("Cannot index non-array")
      current = current[Number(segment.key)]
    } else {
      if (typeof current !== "object") throw new Error("Cannot access property of non-object")
      current = (current as Record<string, unknown>)[segment.key]
    }
  }
  return current
}

export const jsonPathAdapter: ToolAdapter = {
  type: "json-path",
  category: "data",
  label: "JSON Path",
  icon: Braces,
  config: [
    {
      id: "json",
      name: "JSON",
      dataType: "json",
      defaultValue: "{}",
      multiline: true,
      hasInput: true,
      hasOutput: false,
    },
    {
      id: "path",
      name: "Path",
      dataType: "string",
      defaultValue: "$",
      hasInput: true,
      hasOutput: false,
    },
  ],
  outputs: [
    { id: "string", name: "String", dataType: "string" },
    { id: "number", name: "Number", dataType: "number" },
    { id: "boolean", name: "Boolean", dataType: "boolean" },
    { id: "object", name: "Object", dataType: "json" },
    { id: "array", name: "Array", dataType: "json" },
    { id: "type", name: "Type", dataType: "string" },
  ],
  async execute(inputs, config) {
    const json = inputs.json ?? config.json ?? {}
    const path = String(inputs.path ?? config.path ?? "$")

    let parsed: unknown
    if (typeof json === "string") {
      try {
        parsed = JSON.parse(json)
      } catch {
        throw new Error("Invalid JSON")
      }
    } else {
      parsed = json
    }

    const result = getByPath(parsed, path)
    const type = Array.isArray(result) ? "array" : (result === null ? "null" : typeof result)

    return {
      string: typeof result === "string" ? result : JSON.stringify(result),
      // Number([]) 是 0、Number("") 也是 0,用 || 0 会把"取不到值"伪装成合法的 0。
      number: typeof result === "number" ? result : toFiniteNumber(result),
      boolean: typeof result === "boolean" ? result : Boolean(result),
      object: typeof result === "object" && !Array.isArray(result) ? result : null,
      array: Array.isArray(result) ? result : null,
      type,
    }
  },
}

export function registerJsonPathAdapter(): void {
  registerNode(jsonPathAdapter)
}
