import { FileSpreadsheet } from "lucide-react"
import type { ToolAdapter } from "./types"
import { registerNode } from "../canvas/registry"
import { asFile } from "../canvas/persist"
import { MISSING_FILE_ERROR } from "../canvas/node-errors"
import { readSpreadsheetCsv } from "../spreadsheet"

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
  async execute(inputs, config, context) {
    const file = asFile(inputs.file ?? config.file)
    if (!file || !(file instanceof Blob)) {
      throw new Error(MISSING_FILE_ERROR)
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
      // 在 Worker 里解析，大表格不再卡住画布
      const { sheetNames, csv } = await readSpreadsheetCsv(file, { signal: context?.signal })
      return {
        text: csv,
        info: { ...info, sheets: sheetNames, firstSheet: sheetNames[0] },
      }
    }

    throw new Error("Unsupported file type — expected docx, xlsx, xls or csv")
  },
}

export function registerOfficeViewerAdapter(): void {
  registerNode(officeViewerAdapter)
}
