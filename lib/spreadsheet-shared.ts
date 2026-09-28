import type * as XLSX from "xlsx"

export interface SpreadsheetSheet {
  name: string
  /** 每个单元格都是表格里显示的文字；空单元格是空串，不留空洞，列才对得齐 */
  rows: string[][]
  /** 最宽那一行的列数 */
  columnCount: number
}

export interface SpreadsheetCsv {
  sheetNames: string[]
  /** 第一个工作表 */
  csv: string
}

export type SpreadsheetRequest = { file: Blob; output: "sheets" } | { file: Blob; output: "csv" }

/**
 * 把工作簿读成每个工作表的行，按单元格显示的格式取文字（日期不再显示成 45292 这样的序号）。
 * 列数在这里顺手算好：以前页面上用 Math.max(...每行长度)，几十万行时参数太多会直接报错。
 */
export function readWorkbookSheets(xlsx: typeof XLSX, data: ArrayBuffer): SpreadsheetSheet[] {
  const workbook = xlsx.read(data, { type: "array" })
  return workbook.SheetNames.map((name) => {
    const raw = xlsx.utils.sheet_to_json<unknown[]>(workbook.Sheets[name], { header: 1, raw: false })
    let columnCount = 0
    const rows = raw.map((row) => {
      if (row.length > columnCount) columnCount = row.length
      return Array.from(row, (cell) => (cell === undefined || cell === null ? "" : String(cell)))
    })
    return { name, rows, columnCount }
  })
}

/** 第一个工作表转成 CSV，画布和旅程里的 Office 节点用 */
export function readWorkbookCsv(xlsx: typeof XLSX, data: ArrayBuffer): SpreadsheetCsv {
  const workbook = xlsx.read(data, { type: "array" })
  const first = workbook.SheetNames[0]
  if (!first) throw new Error("Workbook contains no sheets")
  return { sheetNames: workbook.SheetNames, csv: xlsx.utils.sheet_to_csv(workbook.Sheets[first]) }
}
