// @vitest-environment node
import { afterEach, beforeAll, describe, expect, it } from "vitest"
import initSqlite, { type Sqlite3Static } from "@sqlite.org/sqlite-wasm"
import { createSqliteSample, exportSqliteResult, quoteSqliteIdentifier, SqliteDatabase, validateSqliteQuery } from "./sqlite-tools"

let sqlite: Sqlite3Static, sample: Uint8Array, opened: SqliteDatabase[] = []
beforeAll(async () => { sqlite = await initSqlite(); sample = createSqliteSample(sqlite) })
afterEach(() => { opened.forEach((db) => db.close()); opened = [] })
function open(bytes = sample) { const db = new SqliteDatabase(sqlite, bytes); opened.push(db); return db }

describe("SQLite WASM reader", () => {
  it("opens the database and lists tables, views, indexes and columns", () => {
    const db = open(), info = db.inspect()
    expect(info.objects.map((item) => [item.type, item.name])).toEqual([["index", "events_status"], ["table", "events"], ["view", "errors"]])
    expect(info.userVersion).toBe(1); expect(info.pageSize).toBeGreaterThan(0)
    expect(db.columns("events").rows.map((row) => row[1])).toEqual(["id", "service", "status", "payload", "elapsed"])
  })
  it("preserves large integers, raw blobs and duplicate result column names", () => {
    const result = open().query("SELECT id, payload, service AS x, status AS x FROM events ORDER BY id")
    expect(result.columns).toEqual(["id", "payload", "x", "x"])
    expect(result.rows[0]).toEqual([1, { $binary: "AP8BgA==" }, "api", 200])
    expect(result.rows[2][0]).toEqual({ $bigint: "9007199254740993" }); expect(result.rows[2][1]).toBeNull()
    expect(JSON.parse(exportSqliteResult(result, "json"))).toEqual({ columns: result.columns, rows: result.rows })
    expect(exportSqliteResult(result, "csv")).toContain("9007199254740993,,api,500")
  })
  it("preserves embedded NUL, BOM and invalid UTF-8 text bytes", () => {
    const result = open().query("SELECT 'a' || char(0) || 'b', char(65279) || '中', CAST(X'FF00FF' AS TEXT)")
    expect(result.rows[0]).toEqual(["a\0b", "\uFEFF中", { $textBytes: "/wD/" }])
  })
  it("reads UTF-16 databases and quotes unusual table names", () => {
    const source = new sqlite.oo1.DB(":memory:", "c")
    try {
      const name = 'odd";name', quoted = quoteSqliteIdentifier(name)
      source.exec("PRAGMA encoding='UTF-16le'; CREATE TABLE " + quoted + "(value TEXT); INSERT INTO " + quoted + " VALUES ('中' || char(0) || '文')")
      const db = open(sqlite.capi.sqlite3_js_db_export(source))
      expect(db.query("SELECT * FROM " + quoted).rows).toEqual([["中\0文"]])
      expect(db.columns(name).rows[0][1]).toBe("value")
    } finally { source.close() }
  })
  it("rejects writes, PRAGMA setters and attachment while allowing metadata reads", () => {
    const db = open()
    for (const sql of ["DELETE FROM events", "UPDATE events SET status=0", "CREATE TABLE bad(a)", "PRAGMA user_version=2", "PRAGMA query_only=OFF", "ATTACH ':memory:' AS other", "WITH x AS (SELECT 1) DELETE FROM events"]) expect(() => db.query(sql), sql).toThrow("readOnly")
    expect(db.query("SELECT count(*) FROM events").rows).toEqual([[3]])
    expect(db.query("PRAGMA user_version").rows).toEqual([[1]])
  })
  it("reports truncation without silently pretending to export the full table", () => {
    expect(open().query("SELECT * FROM events", 2)).toMatchObject({ truncated: true, rowLimit: 2, rows: expect.any(Array) })
    expect(open().query("SELECT * FROM events LIMIT 2", 2).truncated).toBe(false)
  })
  it("reads a WAL-mode main-file snapshot without altering the supplied bytes", () => {
    const bytes = sample.slice(); bytes[18] = 2; bytes[19] = 2
    const db = open(bytes)
    expect(db.inspect().wal).toBe(true); expect(db.query("SELECT count(*) FROM events").rows).toEqual([[3]])
    expect(bytes[18]).toBe(2); expect(bytes[19]).toBe(2)
  })
  it("bounds large result cells and interrupts runaway queries, then remains usable", () => {
    const db = open()
    expect(() => db.query("SELECT zeroblob(1048577)")).toThrow("resultLimit")
    expect(() => db.query("WITH RECURSIVE t(x) AS (VALUES(1) UNION ALL SELECT x+1 FROM t) SELECT sum(x) FROM t")).toThrow("timeout")
    expect(db.query("SELECT 1").rows).toEqual([[1]])
  })
  it("rejects non-database inputs and closes idempotently", () => {
    expect(() => open(new Uint8Array(100))).toThrow("invalidFile")
    const db = open(); db.close(); db.close(); expect(() => db.query("SELECT 1")).toThrow("closed")
  })
})

describe("SQLite SQL helpers", () => {
  it("allows quoted semicolons and comments but rejects multiple statements", () => {
    for (const sql of ["SELECT ';' AS x; -- comment", "/* before */ SELECT 'it''s; ok'; /* after */", 'SELECT 1 AS "x;y";', "SELECT 1 AS [x;y]", "SELECT 1 AS `x;y`"]) expect(() => validateSqliteQuery(sql)).not.toThrow()
    expect(() => validateSqliteQuery("SELECT 1; /* comment */ SELECT 2")).toThrow("singleQuery")
    expect(() => validateSqliteQuery("SELECT 1\0; DELETE FROM events")).toThrow("queryFailed")
    expect(quoteSqliteIdentifier('a"; DROP TABLE t;--')).toBe('"a""; DROP TABLE t;--"')
  })
})
