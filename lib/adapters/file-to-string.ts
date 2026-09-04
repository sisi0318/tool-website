import { FileType } from "lucide-react"
import type { ToolAdapter } from "./types"
import { registerNode } from "../canvas/registry"
import { asFile } from "../canvas/persist"

export const fileToStringAdapter: ToolAdapter = {
  type: "file-to-string",
  category: "data",
  label: "File To String",
  icon: FileType,
  config: [
    {
      id: "file",
      name: "File",
      dataType: "bytes",
      hasInput: true,
      hasOutput: false,
    },
  ],
  outputs: [
    { id: "content", name: "Content", dataType: "string" },
  ],
  async execute(inputs, config) {
    const file = asFile(inputs.file ?? config.file)
    if (!file) throw new Error("No file provided")

    const content = await file.text()
    return { content }
  },
}

export function registerFileToStringAdapter(): void {
  registerNode(fileToStringAdapter)
}
