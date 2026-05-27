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
      dataType: "string",
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
    { id: "result", name: "Result", dataType: "json" },
  ],
  async execute(inputs, config) {
    const jsonStr = String(inputs.json ?? config.json ?? "{}")
    const path = String(inputs.path ?? config.path ?? "$")

    let parsed: unknown
    try {
      parsed = JSON.parse(jsonStr)
    } catch {
      throw new Error("Invalid JSON")
    }

    const result = getByPath(parsed, path)
    return { result }
  },
}

export function registerJsonPathAdapter(): void {
  registerNode(jsonPathAdapter)
}
