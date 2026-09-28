import * as XLSX from "xlsx"
import { readWorkbookCsv, readWorkbookSheets, type SpreadsheetCsv, type SpreadsheetRequest, type SpreadsheetSheet } from "../lib/spreadsheet-shared"
import { serveWorkerTask } from "../lib/worker-task"

serveWorkerTask<SpreadsheetRequest, SpreadsheetSheet[] | SpreadsheetCsv>(async (request) => {
  const data = await request.file.arrayBuffer()
  return request.output === "csv" ? readWorkbookCsv(XLSX, data) : readWorkbookSheets(XLSX, data)
})
