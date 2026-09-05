import Papa from "papaparse"
import { detectCsvDelimiter } from "./csv-tools"

export type TabularFormat = "csv" | "jsonl"
export type TabularRow = Record<string, unknown>
export type FilterOperator = "eq" | "ne" | "contains" | "notContains" | "gt" | "gte" | "lt" | "lte" | "exists" | "missing"
export interface TabularFilter { column: string; operator: FilterOperator; value?: string }
export interface TabularQuery { filters?: TabularFilter[]; columns?: string[]; sortColumn?: string; descending?: boolean; groupBy?: string[] }
export interface TabularIssue { line: number; code: "invalidJson" | "objectRequired" | "unsafeNumber" | "invalidCsv" | "fieldCount"; detail?: string }
export interface TabularData { rows: TabularRow[]; lines: number[]; columns: string[]; issues: TabularIssue[]; errorCount: number; delimiter: string }
export interface TabularResult { rows: TabularRow[]; lines: number[]; columns: string[]; matchedRows: number; countColumn?: string }
export class TabularError extends Error {
  constructor(public code: "inputLimit" | "recordLimit" | "rowLimit" | "columnLimit" | "cellLimit" | "outputLimit" | "invalidUtf8" | "invalidHeader" | "invalidQuery" | "cancelled", public detail = "") { super([code, detail].filter(Boolean).join(": ")); this.name = "TabularError" }
}
export const TABULAR_LIMITS = { bytes: 64 * 1024 * 1024, recordChars: 1024 * 1024, rows: 100_000, columns: 256, cells: 1_000_000, jsonChars: 32 * 1024 * 1024, exportChars: 64 * 1024 * 1024, issues: 1000 } as const
const check = (signal?: AbortSignal) => { if (signal?.aborted) throw new TabularError("cancelled") }
const yieldTask = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

async function* textChunks(source: string | Blob, signal?: AbortSignal, progress?: (bytes: number, total: number) => void) {
  const size = typeof source === "string" ? source.length : source.size
  if (size > TABULAR_LIMITS.bytes) throw new TabularError("inputLimit")
  const decoder = new TextDecoder("utf-8", { fatal: true })
  let byteCount = 0
  for (let offset = 0; offset < size; offset += 65536) {
    check(signal)
    let part: string
    if (typeof source === "string") {
      part = source.slice(offset, offset + 65536)
      byteCount += new TextEncoder().encode(part).length
      if (byteCount > TABULAR_LIMITS.bytes) throw new TabularError("inputLimit")
    } else {
      const buffer = await source.slice(offset, offset + 65536).arrayBuffer()
      check(signal)
      try { part = decoder.decode(buffer, { stream: true }) } catch { throw new TabularError("invalidUtf8") }
    }
    yield offset === 0 ? part.replace(/^\uFEFF/, "") : part
    progress?.(Math.min(offset + 65536, size), size)
    await yieldTask()
  }
  if (typeof source !== "string") { try { const tail = decoder.decode(); if (tail) yield tail } catch { throw new TabularError("invalidUtf8") } }
  check(signal)
}

// JSON.parse would silently round these tokens. Reject them before parsing.
function hasUnsafeJsonNumber(text: string): boolean {
  const tokens = text.replace(/"(?:[^"\\]|\\[\s\S])*"/g, '""').match(/-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g) ?? []
  return tokens.some((token) => { const value = Number(token); return !Number.isFinite(value) || (Number.isInteger(value) && !Number.isSafeInteger(value)) })
}

function validateRowBudget(value: unknown): number {
  let count = 0
  const pending: Array<[unknown, number]> = [[value, 0]]
  while (pending.length) {
    const [next, depth] = pending.pop()!
    if (++count > TABULAR_LIMITS.cells || depth > 64) throw new TabularError("cellLimit")
    if (next && typeof next === "object") for (const child of Object.values(next)) pending.push([child, depth + 1])
  }
  return count
}

export async function parseTabular(source: string | Blob, options: { format: TabularFormat; delimiter?: string; header?: boolean; signal?: AbortSignal; onProgress?: (bytes: number, total: number) => void }): Promise<TabularData> {
  if (!["csv", "jsonl"].includes(options.format) || (options.delimiter && ![",", "\t", ";", "|"].includes(options.delimiter))) throw new TabularError("invalidQuery")
  const data: TabularData = { rows: [], lines: [], columns: [], issues: [], errorCount: 0, delimiter: options.delimiter || "" }
  const columnSet = new Set<string>()
  let record = "", inQuotes = false, line = 1, startLine = 1, previousCR = false, skipLF = false, records = 0, cells = 0, jsonChars = 0, headerRead = false
  const issue = (code: TabularIssue["code"], detail?: string) => { data.errorCount++; if (data.issues.length < TABULAR_LIMITS.issues) data.issues.push({ line: startLine, code, detail }) }
  const accept = () => {
    if (!record.trim()) return
    if (++records > TABULAR_LIMITS.rows + (options.format === "csv" && options.header !== false ? 1 : 0)) throw new TabularError("rowLimit")
    let row: TabularRow
    if (options.format === "jsonl") {
      try { row = JSON.parse(record) } catch { issue("invalidJson"); return }
      if (!row || typeof row !== "object" || Array.isArray(row)) { issue("objectRequired"); return }
      if (hasUnsafeJsonNumber(record)) { issue("unsafeNumber"); return }
    } else {
      const parsed = Papa.parse<string[]>(record, { delimiter: data.delimiter, header: false, dynamicTyping: false, skipEmptyLines: false })
      if (parsed.errors.length || parsed.data.length !== 1 || inQuotes) { if (!headerRead && options.header !== false) throw new TabularError("invalidHeader"); issue("invalidCsv", parsed.errors[0]?.message); return }
      const fields = parsed.data[0]
      if (fields.length > TABULAR_LIMITS.columns) throw new TabularError("columnLimit")
      if (!headerRead) {
        headerRead = true
        data.columns = options.header === false ? fields.map((_, index) => String(index + 1)) : fields
        if (new Set(data.columns).size !== data.columns.length) throw new TabularError("invalidHeader")
        data.columns.forEach((key) => columnSet.add(key))
        if (options.header !== false) return
      }
      if (fields.length !== data.columns.length) { issue("fieldCount", `${fields.length} / ${data.columns.length}`); return }
      row = Object.fromEntries(data.columns.map((key, index) => [key, fields[index]]))
    }
    cells += validateRowBudget(row)
    if (cells > TABULAR_LIMITS.cells) throw new TabularError("cellLimit")
    jsonChars += JSON.stringify(row).length
    if (jsonChars > TABULAR_LIMITS.jsonChars) throw new TabularError("outputLimit")
    for (const key of Object.keys(row)) { if (!columnSet.has(key)) { columnSet.add(key); data.columns.push(key) } }
    if (data.columns.length > TABULAR_LIMITS.columns) throw new TabularError("columnLimit")
    data.rows.push(row); data.lines.push(startLine)
  }
  for await (const chunk of textChunks(source, options.signal, options.onProgress)) {
    if (!data.delimiter && options.format === "csv") data.delimiter = detectCsvDelimiter(chunk)
    for (const character of chunk) {
      if (skipLF) { skipLF = false; if (character === "\n") { previousCR = false; continue } }
      const newline = character === "\r" || character === "\n"
      if (options.format === "csv" && character === '"') inQuotes = !inQuotes
      if (newline && !inQuotes) {
        accept(); record = ""
        if (character === "\r" || !previousCR) line++
        startLine = line; skipLF = character === "\r"
      } else {
        record += character
        if (record.length > TABULAR_LIMITS.recordChars) throw new TabularError("recordLimit")
        if (newline && (character === "\r" || !previousCR)) line++
      }
      previousCR = character === "\r"
    }
  }
  accept()
  return data
}

export const tabularCellText = (value: unknown): string => value === undefined ? "" : typeof value === "string" ? value : JSON.stringify(value)
const own = (row: TabularRow, column: string) => Object.hasOwn(row, column)
function numeric(value: unknown): number | null {
  if (typeof value !== "number" && typeof value !== "string") return null
  if (typeof value === "string" && !/^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/.test(value.trim())) return null
  const number = Number(value)
  return Number.isFinite(number) && (!Number.isInteger(number) || Number.isSafeInteger(number)) ? number : null
}
function matches(row: TabularRow, filter: TabularFilter): boolean {
  const exists = own(row, filter.column)
  if (filter.operator === "exists") return exists
  if (filter.operator === "missing") return !exists
  if (!exists) return false
  const value = tabularCellText(row[filter.column]), expected = filter.value ?? ""
  if (filter.operator === "eq") return value === expected
  if (filter.operator === "ne") return value !== expected
  if (filter.operator === "contains") return value.includes(expected)
  if (filter.operator === "notContains") return !value.includes(expected)
  const left = numeric(row[filter.column]), right = numeric(expected)
  if (left === null || right === null) return false
  return filter.operator === "gt" ? left > right : filter.operator === "gte" ? left >= right : filter.operator === "lt" ? left < right : left <= right
}
function canonical(value: unknown): string {
  if (value === undefined) return "undefined"
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]"
  if (value && typeof value === "object") return "{" + Object.keys(value).sort().map((key) => JSON.stringify(key) + ":" + canonical((value as TabularRow)[key])).join(",") + "}"
  return JSON.stringify(value)
}

export async function queryTabular(data: TabularData, query: TabularQuery = {}, signal?: AbortSignal): Promise<TabularResult> {
  const filters = query.filters ?? [], columns = query.columns ?? data.columns, groupBy = query.groupBy ?? []
  const allowed = new Set(data.columns)
  const operators = ["eq", "ne", "contains", "notContains", "gt", "gte", "lt", "lte", "exists", "missing"]
  if (!Array.isArray(filters) || filters.length > 50 || !Array.isArray(columns) || !Array.isArray(groupBy) || new Set(columns).size !== columns.length || new Set(groupBy).size !== groupBy.length || [...columns, ...groupBy].some((column) => !allowed.has(column)) || filters.some((filter) => !filter || !allowed.has(filter.column) || !operators.includes(filter.operator) || (filter.value !== undefined && typeof filter.value !== "string"))) throw new TabularError("invalidQuery")
  let countColumn: string | undefined
  if (groupBy.length) { countColumn = "count"; while (groupBy.includes(countColumn)) countColumn = "_" + countColumn }
  const result: TabularResult = { rows: [], lines: [], columns: countColumn ? [...groupBy, countColumn] : columns, matchedRows: 0, countColumn }
  if (query.sortColumn !== undefined && !result.columns.includes(query.sortColumn)) throw new TabularError("invalidQuery", query.sortColumn)
  const groups = new Map<string, number>()
  for (let index = 0; index < data.rows.length; index++) {
    if (index % 1024 === 0) { check(signal); await yieldTask() }
    const row = data.rows[index]
    if (!filters.every((filter) => matches(row, filter))) continue
    result.matchedRows++
    if (countColumn) {
      const key = canonical(groupBy.map((column) => [own(row, column), own(row, column) ? row[column] : undefined]))
      const previous = groups.get(key)
      if (previous !== undefined) { result.rows[previous][countColumn] = Number(result.rows[previous][countColumn]) + 1; continue }
      groups.set(key, result.rows.length)
      result.rows.push(Object.fromEntries([...groupBy.filter((column) => own(row, column)).map((column) => [column, row[column]]), [countColumn, 1]]))
      result.lines.push(data.lines[index])
    } else { result.rows.push(Object.fromEntries(columns.filter((column) => own(row, column)).map((column) => [column, row[column]]))); result.lines.push(data.lines[index]) }
  }
  check(signal)
  if (query.sortColumn !== undefined) {
    const column = query.sortColumn
    const order = result.rows.map((_, index) => index).sort((a, b) => {
      const left = own(result.rows[a], column) ? result.rows[a][column] : undefined, right = own(result.rows[b], column) ? result.rows[b][column] : undefined
      if (left === undefined || right === undefined) return left === right ? a - b : left === undefined ? 1 : -1
      const ln = numeric(left), rn = numeric(right)
      const l = tabularCellText(left), r = tabularCellText(right)
      const compared = ln !== null && rn !== null ? ln - rn : ln !== null ? -1 : rn !== null ? 1 : l < r ? -1 : l > r ? 1 : 0
      return (query.descending ? -compared : compared) || a - b
    })
    result.rows = order.map((index) => result.rows[index]); result.lines = order.map((index) => result.lines[index])
  }
  check(signal)
  return result
}

export function exportTabular(result: TabularResult, format: "csv" | "json" | "jsonl"): string {
  if (!["csv", "json", "jsonl"].includes(format)) throw new TabularError("invalidQuery")
  const parts: string[] = []
  let size = 2
  const append = (part: string) => { size += part.length + 2; if (size > TABULAR_LIMITS.exportChars) throw new TabularError("outputLimit"); parts.push(part) }
  if (format === "csv") append(Papa.unparse([result.columns]))
  for (const row of result.rows) append(format === "csv" ? Papa.unparse([result.columns.map((column) => tabularCellText(own(row, column) ? row[column] : undefined))]) : JSON.stringify(row))
  return format === "json" ? "[" + parts.join(",\n") + "]" : parts.join(format === "csv" ? "\r\n" : "\n")
}
