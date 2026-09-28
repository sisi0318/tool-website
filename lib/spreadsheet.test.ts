// @vitest-environment node
import * as XLSX from "xlsx"
import { describe, expect, it, vi } from "vitest"
import { readSpreadsheet, readSpreadsheetCsv } from "./spreadsheet"
import { readWorkbookSheets } from "./spreadsheet-shared"

function workbookBytes(): ArrayBuffer {
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([["name", "age"], ["Ada", 36], ["Linus"]]), "People")
  // 中间那格没有值：读出来要留空串，不然后面的列会往左错位
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([["a", null, "c"]]), "Gaps")
  return XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer
}

const expected = [
  { name: "People", rows: [["name", "age"], ["Ada", "36"], ["Linus"]], columnCount: 2 },
  { name: "Gaps", rows: [["a", "", "c"]], columnCount: 3 },
]

const noWorker = () => { throw new ReferenceError("Worker is not defined") }

describe("spreadsheet reading", () => {
  it("reads every sheet as text rows with no holes and counts the widest row", () => {
    expect(readWorkbookSheets(XLSX, workbookBytes())).toEqual(expected)
  })

  it("shows dates as they are formatted in the sheet, not as serial numbers", () => {
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([[new Date(2024, 0, 2)]]), "Dates")
    const [sheet] = readWorkbookSheets(XLSX, XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer)
    expect(sheet.rows[0][0]).toMatch(/^\d{1,2}\/\d{1,2}\/\d{2,4}$/)
  })

  it("hands the file to the worker", async () => {
    const worker = { onmessage: null as null | ((event: MessageEvent) => void), onerror: null, postMessage: vi.fn(), terminate: vi.fn() }
    const file = new Blob([workbookBytes()])
    const pending = readSpreadsheet(file, {}, () => worker as unknown as Worker)
    await Promise.resolve()
    worker.onmessage!({ data: { ready: true } } as MessageEvent)
    expect(worker.postMessage).toHaveBeenCalledWith({ file, output: "sheets" }, [])
    worker.onmessage!({ data: { result: expected } } as MessageEvent)
    await expect(pending).resolves.toEqual(expected)
  })

  it("parses on the main thread when no worker can be created", async () => {
    await expect(readSpreadsheet(new Blob([workbookBytes()]), {}, noWorker)).resolves.toEqual(expected)
    await expect(readSpreadsheetCsv(new Blob([workbookBytes()]), {}, noWorker)).resolves.toEqual({
      sheetNames: ["People", "Gaps"],
      csv: "name,age\nAda,36\nLinus,",
    })
  })
})
