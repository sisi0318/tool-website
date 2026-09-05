import { SQLITE_LIMITS, SqliteToolError, type SqliteInfo, type SqliteQueryResult } from "./sqlite-tools"

export type SqliteWorkerRequest = { id: number } & ({ type: "open"; bytes: Uint8Array } | { type: "sample" } | { type: "query"; sql: string; rowLimit: number } | { type: "columns"; name: string })
export type SqliteWorkerResponse = { id: number; ok: true; value: unknown } | { id: number; ok: false; error: { code: SqliteToolError["code"]; detail: string } }
interface Pending { resolve: (value: unknown) => void; reject: (error: Error) => void; cleanup: () => void }
type RequestPayload = SqliteWorkerRequest extends infer T ? T extends { id: number } ? Omit<T, "id"> : never : never

export class SqliteWorkerClient {
  private worker: Worker | null = null
  private pending = new Map<number, Pending>()
  private nextId = 0
  private generation = 0
  private disposed = false
  private loaded = false
  private info: SqliteInfo | null = null
  private opening: Promise<SqliteInfo> | null = null
  constructor(private file: File | null = null, private factory: () => Worker = () => new Worker(new URL("../workers/sqlite.worker.ts", import.meta.url), { type: "module" })) {}
  get sourceFile(): File | null { return this.file }
  private reset(error: SqliteToolError): void {
    this.generation++; this.loaded = false; this.opening = null
    const worker = this.worker; this.worker = null; worker?.terminate()
    for (const job of this.pending.values()) { job.cleanup(); job.reject(error) }
    this.pending.clear()
  }
  cancel(): void { this.reset(new SqliteToolError("cancelled")) }
  close(): void { this.disposed = true; this.reset(new SqliteToolError("closed")); this.file = null; this.info = null }
  private getWorker(): Worker {
    if (this.worker) return this.worker
    const worker = this.factory()
    worker.onmessage = (event: MessageEvent<SqliteWorkerResponse>) => {
      const response = event.data, job = this.pending.get(response.id)
      if (!job) return
      this.pending.delete(response.id); job.cleanup()
      if (response.ok) job.resolve(response.value); else job.reject(new SqliteToolError(response.error.code, response.error.detail))
    }
    worker.onerror = (event) => { if (this.worker !== worker) return; event.preventDefault(); this.reset(new SqliteToolError("loadFailed", event.message)) }
    this.worker = worker
    return worker
  }
  private request<T>(payload: RequestPayload, signal?: AbortSignal, transfer: Transferable[] = []): Promise<T> {
    if (this.disposed) return Promise.reject(new SqliteToolError("closed"))
    if (signal?.aborted) return Promise.reject(new SqliteToolError("cancelled"))
    let worker: Worker
    try { worker = this.getWorker() } catch (cause) { return Promise.reject(new SqliteToolError("loadFailed", cause instanceof Error ? cause.message : "")) }
    const id = ++this.nextId
    return new Promise<T>((resolve, reject) => {
      const abort = () => this.cancel()
      const timer = setTimeout(() => this.reset(new SqliteToolError("timeout")), payload.type === "open" || payload.type === "sample" ? 30000 : 15000)
      const cleanup = () => { clearTimeout(timer); signal?.removeEventListener("abort", abort) }
      this.pending.set(id, { resolve: (value) => resolve(value as T), reject, cleanup })
      signal?.addEventListener("abort", abort, { once: true })
      try { worker.postMessage({ id, ...payload }, transfer) }
      catch (cause) { this.reset(new SqliteToolError("loadFailed", cause instanceof Error ? cause.message : "")) }
    })
  }
  open(signal?: AbortSignal): Promise<SqliteInfo> {
    if (this.disposed) return Promise.reject(new SqliteToolError("closed"))
    if (signal?.aborted) return Promise.reject(new SqliteToolError("cancelled"))
    if (this.loaded && this.info) return Promise.resolve(this.info)
    if (this.opening) return this.opening
    const generation = this.generation
    const opening = (async () => {
      let response: { info: SqliteInfo; bytes?: Uint8Array<ArrayBuffer> }
      if (this.file) {
        if (this.file.size > SQLITE_LIMITS.fileBytes) throw new SqliteToolError("fileLimit")
        const buffer = await this.file.arrayBuffer()
        if (generation !== this.generation || signal?.aborted) throw new SqliteToolError("cancelled")
        response = await this.request({ type: "open", bytes: new Uint8Array(buffer) }, signal, [buffer])
      } else response = await this.request({ type: "sample" }, signal)
      if (generation !== this.generation || signal?.aborted) throw new SqliteToolError("cancelled")
      if (response.bytes) this.file = new File([response.bytes], "sample.sqlite", { type: "application/vnd.sqlite3" })
      this.loaded = true; this.info = response.info
      return response.info
    })().finally(() => { if (this.opening === opening) this.opening = null })
    this.opening = opening
    return opening
  }
  async query(sql: string, rowLimit = 1000, signal?: AbortSignal): Promise<SqliteQueryResult> { await this.open(signal); return this.request({ type: "query", sql, rowLimit }, signal) }
  async columns(name: string, signal?: AbortSignal): Promise<SqliteQueryResult> { await this.open(signal); return this.request({ type: "columns", name }, signal) }
}
