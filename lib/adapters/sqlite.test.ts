import { describe, expect, it, vi } from "vitest"
import { sqliteAdapter, registerSqliteAdapter } from "./sqlite"
import { suggestNext } from "../journey/suggest"

const state = vi.hoisted(() => ({ close: vi.fn(), open: vi.fn(), query: vi.fn() }))
vi.mock("../sqlite-worker-client", () => ({ SqliteWorkerClient: class { open = state.open; query = state.query; close = state.close } }))
describe("SQLite adapter", () => {
  it("exports returned query rows and closes the worker", async () => {
    state.open.mockResolvedValue({ objects: [], truncated: false })
    state.query.mockResolvedValue({ columns: ["id"], rows: [[{ $bigint: "9007199254740993" }]], truncated: true, rowLimit: 1, durationMs: 2 })
    const abort = new AbortController()
    const result = await sqliteAdapter.execute({ file: new File(["fixture"], "data.sqlite") }, { operation: "query", sql: "SELECT id FROM events", rowLimit: 1, exportFormat: "csv" }, { signal: abort.signal })
    expect(result.output).toBe("id\r\n9007199254740993"); expect(result.truncated).toBe(true)
    expect(state.query).toHaveBeenCalledWith("SELECT id FROM events", 1, abort.signal)
    expect(state.close).toHaveBeenCalled()
  })
  it("closes the worker after failure and suggests schema inspection for database files", async () => {
    state.close.mockClear(); state.open.mockRejectedValueOnce(new Error("bad file"))
    await expect(sqliteAdapter.execute({ file: new File(["bad"], "bad.db") }, {})).rejects.toThrow("bad file")
    expect(state.close).toHaveBeenCalled()
    registerSqliteAdapter()
    expect(suggestNext(new File(["fixture"], "data.sqlite"), "bytes")[0]).toMatchObject({ tool: "sqlite", outputPort: "result" })
  })
})
