import initSqlite, { type Sqlite3Static } from "@sqlite.org/sqlite-wasm"
import { createSqliteSample, SqliteDatabase, SqliteToolError } from "../lib/sqlite-tools"
import type { SqliteWorkerRequest, SqliteWorkerResponse } from "../lib/sqlite-worker-client"

const scope = self as unknown as { onmessage: ((event: MessageEvent<SqliteWorkerRequest>) => void) | null; postMessage: (message: SqliteWorkerResponse, transfer?: Transferable[]) => void }
let runtimePromise: Promise<Sqlite3Static> | undefined
let database: SqliteDatabase | null = null
const runtime = () => runtimePromise ??= initSqlite().catch((error) => { runtimePromise = undefined; throw error })
async function handle(request: SqliteWorkerRequest) {
  try {
    if (request.type === "open" || request.type === "sample") {
      database?.close(); database = null
      const sqlite = await runtime()
      const bytes = request.type === "sample" ? createSqliteSample(sqlite) : request.bytes
      database = new SqliteDatabase(sqlite, bytes)
      const info = database.inspect()
      scope.postMessage({ id: request.id, ok: true, value: request.type === "sample" ? { info, bytes } : { info } }, request.type === "sample" ? [bytes.buffer as ArrayBuffer] : [])
    } else {
      if (!database) throw new SqliteToolError("closed")
      scope.postMessage({ id: request.id, ok: true, value: request.type === "columns" ? database.columns(request.name) : database.query(request.sql, request.rowLimit) })
    }
  } catch (cause) {
    if (request.type === "open" || request.type === "sample") { database?.close(); database = null }
    const error = cause instanceof SqliteToolError ? cause : new SqliteToolError("loadFailed", cause instanceof Error ? cause.message : "")
    scope.postMessage({ id: request.id, ok: false, error: { code: error.code, detail: error.detail.slice(0, 2048) } })
  }
}
let queue = Promise.resolve()
scope.onmessage = (event) => { queue = queue.then(() => handle(event.data)) }
