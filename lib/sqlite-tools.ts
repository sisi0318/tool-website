import type { Database, PreparedStatement, Sqlite3Static, SqlValue, WasmPointer } from "@sqlite.org/sqlite-wasm"
import { bytesToBase64 } from "./binary"

export const SQLITE_LIMITS = { fileBytes: 64 * 1024 * 1024, sqlChars: 65536, rows: 10_000, columns: 256, cellBytes: 1024 * 1024, resultChars: 16 * 1024 * 1024, objects: 2000, timeoutMs: 10_000 } as const
export type SqliteCell = null | string | number | { $bigint: string } | { $binary: string } | { $number: string } | { $textBytes: string }
export interface SqliteQueryResult { columns: string[]; rows: SqliteCell[][]; truncated: boolean; durationMs: number; rowLimit: number }
export interface SqliteObject { type: string; name: string; tableName: string; sql: string }
export interface SqliteInfo { version: string; objects: SqliteObject[]; truncated: boolean; wal: boolean; pageSize: number; pageCount: number; userVersion: number }
export class SqliteToolError extends Error {
  constructor(public code: "invalidFile" | "fileLimit" | "sqlLimit" | "singleQuery" | "readOnly" | "resultLimit" | "columnLimit" | "timeout" | "queryFailed" | "loadFailed" | "cancelled" | "closed", public detail = "") { super([code, detail].filter(Boolean).join(": ")); this.name = "SqliteToolError" }
}
export function validateSqliteFile(bytes: Uint8Array): void {
  if (bytes.length > SQLITE_LIMITS.fileBytes) throw new SqliteToolError("fileLimit")
  const magic = "SQLite format 3\0"
  if (bytes.length < 100 || [...magic].some((character, index) => bytes[index] !== character.charCodeAt(0))) throw new SqliteToolError("invalidFile")
}
export function quoteSqliteIdentifier(name: string): string { return '"' + name.replace(/"/g, '""') + '"' }

// Accept one statement, allowing quoted semicolons and trailing comments.
export function validateSqliteQuery(sql: string): void {
  if (sql.length > SQLITE_LIMITS.sqlChars) throw new SqliteToolError("sqlLimit")
  if (!sql.trim() || sql.includes("\0")) throw new SqliteToolError("queryFailed")
  let quote = "", lineComment = false, blockComment = false, ended = false, hasContent = false
  for (let index = 0; index < sql.length; index++) {
    const char = sql[index], next = sql[index + 1]
    if (lineComment) { if (char === "\n" || char === "\r") lineComment = false; continue }
    if (blockComment) { if (char === "*" && next === "/") { blockComment = false; index++ }; continue }
    if (quote) { if (char === quote) { if (next === quote && quote !== "]") index++; else quote = "" }; continue }
    if (char === "-" && next === "-") { lineComment = true; index++; continue }
    if (char === "/" && next === "*") { blockComment = true; index++; continue }
    if (/\s/.test(char)) continue
    if (char === ";") { if (hasContent) ended = true; continue }
    if (ended) throw new SqliteToolError("singleQuery")
    hasContent = true
    if (["'", '"', "`", "["].includes(char)) quote = char === "[" ? "]" : char
  }
  if (!hasContent) throw new SqliteToolError("queryFailed")
}
export function sqliteCell(value: SqlValue): SqliteCell {
  if (typeof value === "bigint") return { $bigint: value.toString() }
  if (value instanceof Uint8Array) return { $binary: bytesToBase64(value) }
  if (typeof value === "number" && (!Number.isFinite(value) || !Number.isSafeInteger(value) && Number.isInteger(value) || Object.is(value, -0))) return { $number: Object.is(value, -0) ? "-0" : String(value) }
  return value as null | string | number
}
export function sqliteCellText(value: SqliteCell): string {
  if (value === null) return ""
  if (typeof value !== "object") return String(value)
  return "$bigint" in value ? value.$bigint : "$number" in value ? value.$number : "$textBytes" in value ? "text-base64:" + value.$textBytes : "base64:" + value.$binary
}

export class SqliteDatabase {
  private db: Database | null = null
  private allocation: WasmPointer = 0
  readonly wal: boolean
  constructor(private sqlite: Sqlite3Static, bytes: Uint8Array) {
    validateSqliteFile(bytes)
    this.wal = bytes[18] === 2 || bytes[19] === 2
    const { capi, wasm } = sqlite
    try {
      this.db = new sqlite.oo1.DB(":memory:", "c")
      this.db.exec("PRAGMA hard_heap_limit=134217728; PRAGMA temp_store=MEMORY; PRAGMA cache_size=-8192;")
      this.allocation = wasm.alloc(bytes.length)
      // Fetch the heap after allocation, since allocation can grow WASM memory.
      wasm.heap8u().set(bytes, this.allocation)
      if (this.wal) { wasm.heap8u()[this.allocation + 18] = 1; wasm.heap8u()[this.allocation + 19] = 1 }
      this.db.checkRc(capi.sqlite3_deserialize(this.db, "main", this.allocation, bytes.length, bytes.length, capi.SQLITE_DESERIALIZE_READONLY))
      this.db.checkRc(capi.sqlite3_db_config(this.db, capi.SQLITE_DBCONFIG_DEFENSIVE, 1))
      this.db.checkRc(capi.sqlite3_db_config(this.db, capi.SQLITE_DBCONFIG_TRUSTED_SCHEMA, 0))
      capi.sqlite3_limit(this.db, capi.SQLITE_LIMIT_LENGTH, 8 * 1024 * 1024)
      capi.sqlite3_limit(this.db, capi.SQLITE_LIMIT_SQL_LENGTH, SQLITE_LIMITS.sqlChars)
      capi.sqlite3_limit(this.db, capi.SQLITE_LIMIT_EXPR_DEPTH, 200)
      capi.sqlite3_limit(this.db, capi.SQLITE_LIMIT_COMPOUND_SELECT, 50)
      capi.sqlite3_limit(this.db, capi.SQLITE_LIMIT_VDBE_OP, 250_000)
      capi.sqlite3_limit(this.db, capi.SQLITE_LIMIT_ATTACHED, 0)
      const allow = new Set<number>([capi.SQLITE_SELECT, capi.SQLITE_READ, capi.SQLITE_RECURSIVE])
      const pragmas = new Set(["table_info", "table_xinfo", "index_list", "index_info", "index_xinfo", "foreign_key_list", "table_list", "database_list", "collation_list", "compile_options", "integrity_check", "quick_check", "page_size", "page_count", "freelist_count", "user_version", "schema_version", "encoding", "application_id"])
      const parameterized = new Set(["table_info", "table_xinfo", "index_list", "index_info", "index_xinfo", "foreign_key_list"])
      this.db.checkRc(capi.sqlite3_set_authorizer(this.db, (_arg, action, first, second) => {
        if (allow.has(action)) return capi.SQLITE_OK
        if (action === capi.SQLITE_FUNCTION) return ["load_extension", "readfile", "writefile"].includes(String(second).toLowerCase()) ? capi.SQLITE_DENY : capi.SQLITE_OK
        if (action === capi.SQLITE_PRAGMA) { const name = String(first).toLowerCase(); return pragmas.has(name) && (second === 0 || parameterized.has(name)) ? capi.SQLITE_OK : capi.SQLITE_DENY }
        return capi.SQLITE_DENY
      }, 0))
    } catch (cause) { this.close(); throw cause instanceof SqliteToolError ? cause : new SqliteToolError("invalidFile", cause instanceof Error ? cause.message : "") }
  }
  query(sql: string, rowLimit = 1000): SqliteQueryResult {
    validateSqliteQuery(sql)
    if (!Number.isInteger(rowLimit) || rowLimit < 1 || rowLimit > SQLITE_LIMITS.rows) throw new SqliteToolError("resultLimit")
    if (!this.db) throw new SqliteToolError("closed")
    const { capi } = this.sqlite, started = Date.now(), deadline = started + SQLITE_LIMITS.timeoutMs
    let statement: PreparedStatement | null = null, checks = 0, interrupted = false
    capi.sqlite3_progress_handler(this.db, 1000, () => { if (++checks > 10_000 || Date.now() > deadline) { interrupted = true; return 1 }; return 0 }, 0)
    try {
      statement = this.db.prepare(sql)
      if (!capi.sqlite3_stmt_readonly(statement)) throw new SqliteToolError("readOnly")
      if (statement.columnCount > SQLITE_LIMITS.columns) throw new SqliteToolError("columnLimit")
      const columns = statement.getColumnNames(), rows: SqliteCell[][] = []
      let chars = JSON.stringify(columns).length, truncated = false
      while (statement.step()) {
        if (rows.length >= rowLimit) { truncated = true; break }
        const row: SqliteCell[] = []
        for (let index = 0; index < columns.length; index++) {
          const type = capi.sqlite3_column_type(statement, index)
          if ((type === capi.SQLITE_TEXT || type === capi.SQLITE_BLOB) && capi.sqlite3_column_bytes(statement, index) > SQLITE_LIMITS.cellBytes) throw new SqliteToolError("resultLimit")
          let cell: SqliteCell
          if (type === capi.SQLITE_TEXT) {
            // getString() uses a zero-terminated C string. Reading its UTF-8 bytes
            // instead preserves embedded NUL and lets invalid text remain exact.
            const bytes = statement.getBlob(index)!
            try { cell = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes) }
            catch { cell = { $textBytes: bytesToBase64(bytes) } }
          } else cell = sqliteCell(statement.get(index))
          chars += JSON.stringify(cell).length + 1
          if (chars > SQLITE_LIMITS.resultChars) throw new SqliteToolError("resultLimit")
          row.push(cell)
        }
        rows.push(row)
      }
      return { columns, rows, truncated, rowLimit, durationMs: Date.now() - started }
    } catch (cause) {
      if (cause instanceof SqliteToolError) throw cause
      const code = Number((cause as { resultCode?: number })?.resultCode) & 255
      throw new SqliteToolError(interrupted || code === capi.SQLITE_INTERRUPT ? "timeout" : new Set<number>([capi.SQLITE_AUTH, capi.SQLITE_READONLY]).has(code) ? "readOnly" : new Set<number>([capi.SQLITE_NOMEM, capi.SQLITE_TOOBIG]).has(code) ? "resultLimit" : "queryFailed", cause instanceof Error ? cause.message : "")
    } finally { statement?.finalize(); capi.sqlite3_progress_handler(this.db, 0, 0, 0) }
  }
  inspect(): SqliteInfo {
    const objects = this.query("SELECT type, name, tbl_name, coalesce(sql, '') AS sql FROM sqlite_schema ORDER BY type, name", SQLITE_LIMITS.objects)
    const number = (pragma: string) => Number(this.query("PRAGMA " + pragma, 1).rows[0]?.[0] ?? 0)
    return { version: this.sqlite.version.libVersion, objects: objects.rows.map((row) => ({ type: String(row[0]), name: String(row[1]), tableName: String(row[2]), sql: String(row[3]) })), truncated: objects.truncated, wal: this.wal, pageSize: number("page_size"), pageCount: number("page_count"), userVersion: number("user_version") }
  }
  columns(name: string): SqliteQueryResult { return this.query("PRAGMA table_xinfo(" + quoteSqliteIdentifier(name) + ")", 2000) }
  close(): void { try { this.db?.close() } finally { this.db = null; if (this.allocation) { this.sqlite.wasm.dealloc(this.allocation); this.allocation = 0 } } }
}

export function createSqliteSample(sqlite: Sqlite3Static): Uint8Array<ArrayBuffer> {
  const db = new sqlite.oo1.DB(":memory:", "c")
  try {
    db.exec("CREATE TABLE events (id INTEGER PRIMARY KEY, service TEXT NOT NULL, status INTEGER, payload BLOB, elapsed REAL); INSERT INTO events VALUES (1, 'api', 200, X'00FF0180', 12.5), (2, 'web', 502, X'48656C6C6F', 43.2), (9007199254740993, 'api', 500, NULL, 98.1); CREATE INDEX events_status ON events(status); CREATE VIEW errors AS SELECT id, service, status FROM events WHERE status >= 500; PRAGMA user_version=1;")
    return sqlite.capi.sqlite3_js_db_export(db)
  } finally { db.close() }
}

export function exportSqliteResult(result: SqliteQueryResult, format: "json" | "csv"): string {
  if (format === "json") return JSON.stringify({ columns: result.columns, rows: result.rows }, null, 2)
  const csv = (value: string) => /[",\r\n]/.test(value) ? '"' + value.replace(/"/g, '""') + '"' : value
  return [result.columns.map(csv).join(","), ...result.rows.map((row) => row.map((cell) => csv(sqliteCellText(cell))).join(","))].join("\r\n")
}
