import { Type, Hash, FileJson, File } from "lucide-react"
import type { ToolAdapter } from "./types"
import { registerNode } from "../canvas/registry"

export const stringNode: ToolAdapter = {
  type: "string",
  category: "basic",
  label: "String",
  icon: Type,
  inputs: [],
  outputs: [{ id: "value", name: "Value", dataType: "string" }],
  config: [{ id: "value", name: "Value", dataType: "string", defaultValue: "" }],
  async execute(inputs, config) {
    return { value: String(config.value ?? "") }
  },
}

export const numberNode: ToolAdapter = {
  type: "number",
  category: "basic",
  label: "Number",
  icon: Hash,
  inputs: [],
  outputs: [{ id: "value", name: "Value", dataType: "number" }],
  config: [{ id: "value", name: "Value", dataType: "number", defaultValue: 0 }],
  async execute(inputs, config) {
    return { value: Number(config.value ?? 0) }
  },
}

export const jsonNode: ToolAdapter = {
  type: "json",
  category: "basic",
  label: "JSON",
  icon: FileJson,
  inputs: [],
  outputs: [{ id: "value", name: "Value", dataType: "json" }],
  config: [
    { id: "value", name: "Value", dataType: "string", defaultValue: "{}" },
    { id: "typename", name: "Typename", dataType: "string", defaultValue: "" },
  ],
  async execute(inputs, config) {
    try {
      const parsed = JSON.parse(String(config.value ?? "{}"))
      return { value: parsed }
    } catch {
      throw new Error("Invalid JSON")
    }
  },
}

export const fileNode: ToolAdapter = {
  type: "file",
  category: "basic",
  label: "File",
  icon: File,
  inputs: [],
  outputs: [{ id: "content", name: "Content", dataType: "bytes" }],
  config: [],
  async execute(inputs, config) {
    return { content: null }
  },
}

export function registerBasicNodes(): void {
  registerNode(stringNode)
  registerNode(numberNode)
  registerNode(jsonNode)
  registerNode(fileNode)
}
