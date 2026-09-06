import { describe, expect, it } from "vitest"
import { detectTableRules, inferTableGrid, populateTable, tableCellValue, tableCsv, tableGrid, validateTableCells } from "./image-table-shared"
import type { OcrLine } from "./ocr-shared"
import { tableXlsx } from "./image-table-export"
import { read, utils } from "xlsx"
import { strFromU8, unzipSync } from "fflate"

function line(text: string, x: number, y: number, width = 35, height = 16, score = 0.99): OcrLine { return { id: 0, text, score, poly: [[x, y], [x + width, y], [x + width, y + height], [x, y + height]] } }
describe("table structure and text preservation", () => {
  it("detects continuous grid rules without treating transparent pixels as black", () => {
    const width = 300, height = 200, pixels = new Uint8ClampedArray(width * height * 4)
    for (const x of [10, 130, 290]) for (let y = 10; y <= 190; y++) pixels[(y * width + x) * 4 + 3] = 255
    for (const y of [10, 100, 190]) for (let x = 10; x <= 290; x++) pixels[(y * width + x) * 4 + 3] = 255
    expect(detectTableRules(pixels, width, height)).toEqual({ x: [10, 130, 290], y: [10, 100, 190] })
  })
  it("keeps blank and multiline cells, flags crossings and counts excluded text", () => {
    const grid = tableGrid({ x: [0, 100, 200], y: [0, 70, 140] }, 200, 180)
    const data = populateTable([line("第一行", 10, 10), line("第二行", 10, 35), line("00123", 110, 10), line("跨格", 80, 85, 50), line("outside", 0, 155)], grid)
    expect(data.cells.map(row => row.map(cell => cell.text))).toEqual([["第一行\n第二行", "00123"], ["", "跨格"]])
    expect(data.uncertain).toBe(1); expect(data.outside).toBe(1)
  })
  it("infers aligned borderless rows and columns with an empty cell", () => {
    const lines = [line("Name", 20, 20), line("Count", 150, 20), line("键盘", 20, 60), line("12", 150, 60), line("空白", 20, 100)]
    const grid = inferTableGrid(lines, 250, 140, { x: [], y: [] })
    expect(populateTable(lines, grid).cells.map(row => row.map(cell => cell.text))).toEqual([["Name", "Count"], ["键盘", "12"], ["空白", ""]])
  })
  it("quotes CSV cells, keeps Unicode and line breaks, and guards formula prefixes", () => {
    expect(tableCsv([["中文,\"引号\"", "a\nb", ""], ["00123", "  =1+1", "@SUM(1)"]])).toBe('\ufeff"中文,""引号""","a\nb",""\r\n"00123","\'  =1+1","\'@SUM(1)"\r\n')
    expect(tableCsv([["=1+1"]], false)).toBe('\ufeff"=1+1"\r\n')
  })
  it("only converts explicitly enabled, precision-safe plain numbers", () => {
    for (const text of ["00123", "1234567890123456", "=1+1", "+12", "-0", "2026-09-06", " 12", "1e3"]) expect(tableCellValue(text, true)).toBe(text)
    expect(tableCellValue("12.50", true)).toBe(12.5); expect(tableCellValue("-12", true)).toBe(-12); expect(tableCellValue("12", false)).toBe("12")
  })
  it("rejects crossing boundaries, excessive grids and oversized export cells", () => {
    expect(() => tableGrid({ x: [0, 100, 99], y: [0, 100] }, 200, 100)).toThrow("options")
    expect(() => tableGrid({ x: Array.from({ length: 41 }, (_, i) => i * 4), y: Array.from({ length: 101 }, (_, i) => i * 4) }, 200, 500)).toThrow("outputLimit")
    expect(() => validateTableCells([["x".repeat(32768)]])).toThrow("outputLimit")
  })
  it("round-trips XLSX identifiers, literal formulas, blank cells and wrapping styles", async () => {
    const values = [["编号", "数量", "备注"], ["00123", "12.50", "第一行\n第二行"], ["12345678901234567890", "", "=SUM(1,2)"]]
    const bytes = await tableXlsx(values), workbook = read(bytes, { type: "array" }), sheet = workbook.Sheets.Table
    expect(utils.sheet_to_json(sheet, { header: 1, defval: "" })).toEqual(values)
    expect(sheet.C3.f).toBeUndefined(); expect(sheet.A3.t).toBe("s")
    const styles = new DOMParser().parseFromString(strFromU8(unzipSync(bytes)["xl/styles.xml"]), "application/xml")
    expect(styles.querySelector("parsererror")).toBeNull()
    expect(styles.querySelector(`cellXfs xf:nth-child(${Number(sheet.C2.s ?? 1) + 1}) alignment`)?.getAttribute("wrapText")).toBe("1")
    const numeric = read(await tableXlsx(values, true), { type: "array" }).Sheets.Table
    expect(numeric.B2.v).toBe(12.5); expect(numeric.B2.t).toBe("n"); expect(numeric.A2.v).toBe("00123"); expect(numeric.A3.v).toBe(values[2][0]); expect(numeric.C3.f).toBeUndefined()
  })
})
