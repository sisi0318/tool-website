import { FileOutput } from "lucide-react"
import type { ToolAdapter } from "./types"
import { registerNode } from "../canvas/registry"

export const stringToFileAdapter: ToolAdapter = {
  type: "string-to-file",
  category: "data",
  label: "String To File",
  icon: FileOutput,
  config: [
    {
      id: "content",
      name: "Content",
      dataType: "string",
      defaultValue: "",
      multiline: true,
      hasInput: true,
      hasOutput: false,
    },
    {
      id: "filename",
      name: "Filename",
      dataType: "string",
      defaultValue: "file.txt",
      hasInput: true,
      hasOutput: false,
    },
  ],
  outputs: [
    { id: "file", name: "File", dataType: "bytes" },
  ],
  async execute(inputs, config) {
    const content = String(inputs.content ?? config.content ?? "")
    const filename = String(inputs.filename ?? config.filename ?? "file.txt")

    const file = new File([content], filename, { type: "text/plain" })
    return { file }
  },
}

export function registerStringToFileAdapter(): void {
  registerNode(stringToFileAdapter)
}
