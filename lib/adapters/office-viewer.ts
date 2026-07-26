import { FileSpreadsheet } from "lucide-react"
import type { ToolAdapter } from "./types"
import { registerNode } from "../canvas/registry"

const MAX_FILE_SIZE = 20 * 1024 * 1024

function htmlToText(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html")
  return (doc.body.textContent ?? "").replace(/\n{3,}/g, "\n\n").trim()
}

export const officeViewerAdapter: ToolAdapter = {
  type: "office-viewer",
  category: "viewer",
  label: "Office Viewer",
  icon: FileSpreadsheet,
  description: "Extracts text from DOCX and table data from XLSX/CSV",
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
    { id: "text", name: "Text", dataType: "string" },
    { id: "info", name: "Info", dataType: "json" },
  ],
  async execute(inputs, config) {
    const file = (inputs.file ?? config.file) as File | null
    if (!file || !(file instanceof Blob)) {
      throw new Error("No file provided")
    }
    if (file.size > MAX_FILE_SIZE) {
      throw new Error("File is too large (max 20MB)")
    }

    const info = {
      name: file.name,
      size: file.size,
      type: file.type,
      lastModified: new Date(file.lastModified).toISOString(),
    }

    const ext = file.name.split(".").pop()?.toLowerCase() ?? ""

    if (ext === "docx") {
      const [{ default: mammoth }, arrayBuffer] = await Promise.all([
        import("mammoth"),
        file.arrayBuffer(),
      ])
      const result = await mammoth.convertToHtml({ arrayBuffer })
      return { text: htmlToText(result.value), info }
    }

    if (ext === "xlsx" || ext === "xls" || ext === "csv") {
      const [XLSX, arrayBuffer] = await Promise.all([import("xlsx"), file.arrayBuffer()])
      const workbook = XLSX.read(arrayBuffer, { type: "array" })
      const sheetName = workbook.SheetNames[0]
      if (!sheetName) throw new Error("Workbook contains no sheets")
      const csv = XLSX.utils.sheet_to_csv(workbook.Sheets[sheetName])
      return {
        text: csv,
        info: { ...info, sheets: workbook.SheetNames, firstSheet: sheetName },
      }
    }

    throw new Error("Unsupported file type — expected docx, xlsx, xls or csv")
  },
}

export function registerOfficeViewerAdapter(): void {
  registerNode(officeViewerAdapter)
}
