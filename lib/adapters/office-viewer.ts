import { FileSpreadsheet } from "lucide-react"
import type { ToolAdapter } from "./types"
import { registerNode } from "../canvas/registry"

export const officeViewerAdapter: ToolAdapter = {
  type: "office-viewer",
  category: "viewer",
  label: "Office Viewer",
  icon: FileSpreadsheet,
  inputs: [
    { id: "file", name: "File", dataType: "bytes", required: true },
  ],
  outputs: [
    { id: "info", name: "Info", dataType: "json" },
  ],
  config: [],
  async execute(inputs, config) {
    const file = inputs.file as File | null
    if (!file) {
      throw new Error("No file provided")
    }

    return {
      info: {
        name: file.name,
        size: file.size,
        type: file.type,
        lastModified: new Date(file.lastModified).toISOString(),
      },
    }
  },
}

export function registerOfficeViewerAdapter(): void {
  registerNode(officeViewerAdapter)
}
