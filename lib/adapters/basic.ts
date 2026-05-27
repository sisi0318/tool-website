import { Type, Hash, FileJson, File } from "lucide-react"
import type { ToolAdapter } from "./types"
import { registerNode } from "../canvas/registry"

export const stringNode: ToolAdapter = {
  type: "string",
  category: "basic",
  label: "String",
  icon: Type,
  config: [
    {
      id: "value",
      name: "Value",
      dataType: "string",
      defaultValue: "",
      hasInput: true,
      hasOutput: true,
    },
  ],
  outputs: [],
  async execute(inputs, config) {
    return { value: inputs.value ?? config.value ?? "" }
  },
}

export const numberNode: ToolAdapter = {
  type: "number",
  category: "basic",
  label: "Number",
  icon: Hash,
  config: [
    {
      id: "value",
      name: "Value",
      dataType: "number",
      defaultValue: 0,
      hasInput: true,
      hasOutput: true,
    },
  ],
  outputs: [],
  async execute(inputs, config) {
    return { value: inputs.value ?? config.value ?? 0 }
  },
}

export const jsonNode: ToolAdapter = {
  type: "json",
  category: "basic",
  label: "JSON",
  icon: FileJson,
  config: [
    {
      id: "value",
      name: "Value",
      dataType: "string",
      defaultValue: "{}",
      multiline: true,
      hasInput: true,
      hasOutput: false,
    },
  ],
  outputs: [
    { id: "parsed", name: "Parsed", dataType: "json" },
  ],
  async execute(inputs, config) {
    const input = String(inputs.value ?? config.value ?? "{}")
    try {
      const parsed = JSON.parse(input)
      return { parsed }
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
  config: [
    {
      id: "file",
      name: "File",
      dataType: "bytes",
      hasInput: true,
      hasOutput: true,
    },
  ],
  outputs: [],
  async execute(inputs, config) {
    return { file: (inputs.file ?? config.file) ?? null }
  },
}

export function registerBasicNodes(): void {
  registerNode(stringNode)
  registerNode(numberNode)
  registerNode(jsonNode)
  registerNode(fileNode)
}
