import { strFromU8, strToU8, unzipSync, zipSync } from "fflate"
import { tableCellValue, validateTableCells } from "./image-table-shared"

/** Explicit string types prevent OCR text from becoming formulas or losing identifier precision. */
export async function tableXlsx(cells: string[][], numbers = false): Promise<Uint8Array<ArrayBuffer>> {
  validateTableCells(cells)
  const { utils, write } = await import("xlsx")
  const rows = cells.map(row => row.map(text => { const value = tableCellValue(text, numbers); return typeof value === "number" ? { t: "n", v: value, z: "0.###############" } : { t: "s", v: value, z: "@" } }))
  const sheet = utils.aoa_to_sheet(rows)
  const lineWidth = (line: string) => [...line].reduce((n, char) => n + (char.charCodeAt(0) > 255 ? 2 : 1), 0)
  const widths = cells[0].map((_, c) => Math.max(12, Math.min(60, ...cells.map(row => Math.max(...row[c].split("\n").map(lineWidth)) + 2))))
  sheet["!cols"] = widths.map(wch => ({ wch }))
  sheet["!rows"] = cells.map(row => ({ hpt: Math.min(409, 18 * Math.max(...row.map((text, c) => text.split("\n").reduce((count, line) => count + Math.max(1, Math.ceil(lineWidth(line) / (widths[c] - 2))), 0)))) }))
  const workbook = utils.book_new(); utils.book_append_sheet(workbook, sheet, "Table")
  const files = unzipSync(new Uint8Array(write(workbook, { type: "array", bookType: "xlsx" })))
  // SheetJS CE omits alignment on export. Add it to our own generated cell formats.
  // OpenXML alignment: https://learn.microsoft.com/en-us/dotnet/api/documentformat.openxml.spreadsheet.alignment
  const styles = strFromU8(files["xl/styles.xml"]).replace(/<cellXfs\b([^>]*)>([\s\S]*?)<\/cellXfs>/, (_, attributes: string, formats: string) => `<cellXfs${attributes}>${formats.replace(/<xf\b([^>]*?)\/>/g, '<xf$1 applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>')}</cellXfs>`)
  files["xl/styles.xml"] = strToU8(styles)
  return new Uint8Array(zipSync(files, { level: 6 }))
}
