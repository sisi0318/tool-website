import { Braces } from "lucide-react"
import type { ToolAdapter } from "./types"
import { registerNode } from "../canvas/registry"

function getByPath(obj: unknown, path: string): unknown {
  if (path === "$") return obj
  if (!path.startsWith("$")) throw new Error("Path must start with $")

  const parts = path
    .replace(/^\$\.?/, "")
    .split(/\.|\[|\]/)
    .filter(Boolean)

  let current = obj
  for (const part of parts) {
    if (current == null) return undefined
    if (/^\d+$/.test(part)) {
      const index = parseInt(part)
      if (!Array.isArray(current)) throw new Error("Cannot index non-array")
      current = current[index]
    } else {
      if (typeof current !== "object") throw new Error("Cannot access property of non-object")
      current = (current as Record<string, unknown>)[part]
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
      number: typeof result === "number" ? result : Number(result) || 0,
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
