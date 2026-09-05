// @vitest-environment node
import { describe, expect, it, vi } from "vitest"
import { exportTabular, parseTabular, queryTabular, TABULAR_LIMITS } from "./tabular-tools"

describe("tabular parsing", () => {
  it("keeps CSV identifiers and long integers as exact text", async () => {
    const data = await parseTabular('\uFEFFid;value;note\r\n0001;18446744073709551615;"a,b"\r\n0002;null;"line1\r\nline2"\r\n', { format: "csv" })
    expect(data.rows).toEqual([{ id: "0001", value: "18446744073709551615", note: "a,b" }, { id: "0002", value: "null", note: "line1\r\nline2" }])
    expect(data.lines).toEqual([2, 3]); expect(data.delimiter).toBe(";"); expect(data.errorCount).toBe(0)
  })
  it("reports original JSONL line numbers and skips malformed or unsafe records", async () => {
    const data = await parseTabular('\n{"a":1}\r\n\r\n{"bad":\n[]\n{"id":9007199254740993}\n{"n":1e400}\n{"id":"9007199254740993","s":"12345678901234567890"}', { format: "jsonl" })
    expect(data.lines).toEqual([2, 8]); expect(data.issues.map((issue) => [issue.line, issue.code])).toEqual([[4, "invalidJson"], [5, "objectRequired"], [6, "unsafeNumber"], [7, "unsafeNumber"]])
    expect(data.columns).toEqual(["a", "id", "s"])
  })
  it("tracks CSV error lines after blank and multiline records", async () => {
    const data = await parseTabular('a,b\n\n1,"two\nlines"\n2\n3,ok\n4,"unfinished', { format: "csv" })
    expect(data.lines).toEqual([3, 6]); expect(data.issues.map((issue) => [issue.line, issue.code])).toEqual([[5, "fieldCount"], [7, "invalidCsv"]])
  })
  it("uses numbered columns without a header and preserves dangerous key names safely", async () => {
    expect((await parseTabular('01\tx\n02\ty', { format: "csv", header: false })).rows).toEqual([{ 1: "01", 2: "x" }, { 1: "02", 2: "y" }])
    const data = await parseTabular('__proto__,constructor,\na,b,c', { format: "csv" })
    expect(Object.hasOwn(data.rows[0], "__proto__")).toBe(true)
    expect(data.rows[0].__proto__).toBe("a"); expect(data.rows[0][""]).toBe("c")
    await expect(parseTabular('a,a\n1,2', { format: "csv" })).rejects.toMatchObject({ code: "invalidHeader" })
  })
  it("reads Blob slices and handles multibyte characters, quote escapes and CRLF across chunk boundaries", async () => {
    const text = 'a,b\r\n"' + "x".repeat(65527) + '中文""end\r\nnext",ok\r\n2,last'
    const file = new Blob([text])
    const wholeRead = vi.spyOn(file, "arrayBuffer")
    const slices = vi.spyOn(file, "slice")
    const data = await parseTabular(file, { format: "csv" })
    expect(data.rows[0]).toEqual({ a: "x".repeat(65527) + '中文"end\r\nnext', b: "ok" })
    expect(data.lines).toEqual([2, 4]); expect(data.errorCount).toBe(0)
    expect(wholeRead).not.toHaveBeenCalled(); expect(slices).toHaveBeenCalledTimes(2)
    const jsonl = '{"a":"' + "x".repeat(65525) + '"}\r\n{"a":2}\r\n{bad}'
    const split = await parseTabular(new Blob([jsonl]), { format: "jsonl" })
    expect(split.lines).toEqual([1, 2]); expect(split.issues[0].line).toBe(3)
  })
  it("rejects invalid or truncated UTF-8", async () => {
    for (const bytes of [[0xff], [0xe4, 0xb8]]) await expect(parseTabular(new Blob([new Uint8Array(bytes)]), { format: "jsonl" })).rejects.toMatchObject({ code: "invalidUtf8" })
  })
  it("bounds records, input size and diagnostic retention", async () => {
    await expect(parseTabular("x".repeat(TABULAR_LIMITS.recordChars + 1), { format: "jsonl" })).rejects.toMatchObject({ code: "recordLimit" })
    const file = new Blob([]); Object.defineProperty(file, "size", { value: TABULAR_LIMITS.bytes + 1 })
    await expect(parseTabular(file, { format: "csv" })).rejects.toMatchObject({ code: "inputLimit" })
    const data = await parseTabular("bad\n".repeat(1005), { format: "jsonl" })
    expect(data.errorCount).toBe(1005); expect(data.issues).toHaveLength(1000)
  })
  it("cancels between chunks and on empty input", async () => {
    const controller = new AbortController()
    await expect(parseTabular('a,b\n1,2\n'.repeat(10000), { format: "csv", signal: controller.signal, onProgress: () => controller.abort() })).rejects.toMatchObject({ code: "cancelled" })
    await expect(parseTabular("", { format: "jsonl", signal: controller.signal })).rejects.toMatchObject({ code: "cancelled" })
  })
  it("bounds the JSON expansion caused by repeating long CSV header names", async () => {
    const columns = Array.from({ length: 128 }, (_, index) => "x".repeat(4096) + index).join(",")
    const row = Array.from({ length: 128 }, () => "1").join(",")
    await expect(parseTabular(columns + "\n" + (row + "\n").repeat(70), { format: "csv" })).rejects.toMatchObject({ code: "outputLimit" })
  })
})

describe("tabular queries and exports", () => {
  const source = '{"service":"api","status":200,"id":"001"}\n{"service":"api","status":500,"id":"002"}\n{"service":"web","status":502,"id":"003"}\n{"service":"api","status":503,"id":"004"}'
  it("combines filters, projects columns and sorts numerically without losing source lines", async () => {
    const data = await parseTabular(source, { format: "jsonl" })
    const result = await queryTabular(data, { filters: [{ column: "status", operator: "gte", value: "500" }, { column: "service", operator: "eq", value: "api" }], columns: ["id", "status"], sortColumn: "status", descending: true })
    expect(result.rows).toEqual([{ id: "004", status: 503 }, { id: "002", status: 500 }]); expect(result.lines).toEqual([4, 2]); expect(result.matchedRows).toBe(2)
    expect(data.rows[0].service).toBe("api")
  })
  it("counts filtered groups, handles count name collisions and sorts by count", async () => {
    const data = await parseTabular(source, { format: "jsonl" })
    const result = await queryTabular(data, { filters: [{ column: "status", operator: "gte", value: "500" }], groupBy: ["service"], sortColumn: "count", descending: true })
    expect(result.rows).toEqual([{ service: "api", count: 2 }, { service: "web", count: 1 }]); expect(result.lines).toEqual([2, 3]); expect(result.matchedRows).toBe(3)
    const collision = await queryTabular(await parseTabular('{"count":"a"}\n{"count":"a"}', { format: "jsonl" }), { groupBy: ["count"] })
    expect(collision.rows).toEqual([{ count: "a", _count: 2 }])
  })
  it("distinguishes missing, null and typed group keys, and canonicalizes object keys", async () => {
    const data = await parseTabular('{}\n{"x":null}\n{"x":"null"}\n{"x":1}\n{"x":"1"}\n{"x":{"a":1,"b":2}}\n{"x":{"b":2,"a":1}}', { format: "jsonl" })
    const result = await queryTabular(data, { groupBy: ["x"] })
    expect(result.rows).toHaveLength(6); expect(result.rows[5].count).toBe(2)
    expect((await queryTabular(data, { filters: [{ column: "x", operator: "missing" }] })).lines).toEqual([1])
    expect((await queryTabular(data, { filters: [{ column: "x", operator: "exists" }] })).rows).toHaveLength(6)
  })
  it("uses a stable total order for mixed numbers, text and missing fields", async () => {
    const data = await parseTabular('{"x":"2"}\n{"x":"10"}\n{"x":"1x"}\n{}\n{"x":"2"}', { format: "jsonl" })
    expect((await queryTabular(data, { sortColumn: "x" })).lines).toEqual([1, 5, 2, 3, 4])
    expect((await queryTabular(data, { sortColumn: "x", descending: true })).lines).toEqual([3, 2, 1, 5, 4])
  })
  it("does not coerce blank, booleans or unsafe integer strings in numeric filters", async () => {
    const data = await parseTabular('{"x":""}\n{"x":true}\n{"x":"9007199254740993"}\n{"x":10}', { format: "jsonl" })
    expect((await queryTabular(data, { filters: [{ column: "x", operator: "gte", value: "0" }] })).lines).toEqual([4])
  })
  it("never reads prototype properties as missing column values", async () => {
    const data = await parseTabular('{"toString":"value","__proto__":"safe"}\n{"id":2}', { format: "jsonl" })
    const result = await queryTabular(data, { sortColumn: "toString" })
    expect(result.lines).toEqual([1, 2])
    expect(exportTabular(result, "csv").split("\r\n")[2]).toBe(",,2")
  })
  it("exports all rows and union columns with valid CSV quoting and JSONL", async () => {
    const data = await parseTabular(Array.from({ length: 120 }, (_, index) => JSON.stringify(index % 2 ? { a: index, note: 'a,"b"\nnext' } : { a: index, extra: { ok: true } })).join("\n"), { format: "jsonl" })
    const result = await queryTabular(data)
    expect(JSON.parse(exportTabular(result, "json"))).toEqual(data.rows)
    expect(exportTabular(result, "jsonl").split("\n").map((line) => JSON.parse(line))).toEqual(data.rows)
    const csv = await parseTabular(exportTabular(result, "csv"), { format: "csv" })
    expect(csv.rows).toHaveLength(120); expect(csv.columns).toEqual(["a", "extra", "note"]); expect(csv.rows[1].note).toBe('a,"b"\nnext'); expect(csv.rows[0].extra).toBe('{"ok":true}')
  })
  it("rejects invalid query fields and responds to cancellation", async () => {
    const data = await parseTabular(source, { format: "jsonl" })
    await expect(queryTabular(data, { columns: ["unknown"] })).rejects.toMatchObject({ code: "invalidQuery" })
    await expect(queryTabular(data, { filters: [{ column: "status", operator: "bad" as "eq" }] })).rejects.toMatchObject({ code: "invalidQuery" })
    const controller = new AbortController(); controller.abort()
    await expect(queryTabular(data, {}, controller.signal)).rejects.toMatchObject({ code: "cancelled" })
  })
})
