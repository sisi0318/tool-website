// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest"
import { SqliteWorkerClient, type SqliteWorkerRequest } from "./sqlite-worker-client"

const info = { version: "test", objects: [], wal: false, truncated: false, pageSize: 4096, pageCount: 1, userVersion: 0 }
class FakeWorker {
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: ((event: ErrorEvent) => void) | null = null
  messages: SqliteWorkerRequest[] = []
  terminated = false
  postMessage(message: SqliteWorkerRequest) { this.messages.push(message); if (message.type === "open") queueMicrotask(() => this.reply(message.id, { info })) }
  terminate() { this.terminated = true }
  reply(id: number, value: unknown) { this.onmessage?.({ data: { id, ok: true, value } } as MessageEvent) }
}
afterEach(() => vi.useRealTimers())
describe("SQLite worker client", () => {
  it("terminates cancelled queries, ignores stale replies and reopens the same file", async () => {
    const workers: FakeWorker[] = [], client = new SqliteWorkerClient(new File(["fixture"], "data.sqlite"), () => { const worker = new FakeWorker(); workers.push(worker); return worker as unknown as Worker })
    await client.open()
    const abort = new AbortController(), pending = client.query("SELECT 1", 100, abort.signal)
    const rejected = expect(pending).rejects.toMatchObject({ code: "cancelled" })
    await vi.waitFor(() => expect(workers[0].messages.some((message) => message.type === "query")).toBe(true))
    const oldId = workers[0].messages.at(-1)!.id
    abort.abort(); await rejected
    expect(workers[0].terminated).toBe(true)
    const next = client.query("SELECT 2")
    await vi.waitFor(() => expect(workers[1]?.messages.at(-1)?.type).toBe("query"))
    workers[0].reply(oldId, { columns: ["old"], rows: [[1]] })
    workers[0].onerror?.({ message: "stale worker", preventDefault: () => {} } as ErrorEvent)
    const result = { columns: ["value"], rows: [[2]], truncated: false, rowLimit: 1000, durationMs: 1 }
    workers[1].reply(workers[1].messages.at(-1)!.id, result)
    expect(await next).toEqual(result); expect(client.sourceFile?.name).toBe("data.sqlite")
    client.close(); expect(workers[1].terminated).toBe(true)
  })
  it("bounds worker waits and does not reuse a timed-out worker", async () => {
    vi.useFakeTimers()
    const worker = new FakeWorker(), client = new SqliteWorkerClient(new File(["fixture"], "data.sqlite"), () => worker as unknown as Worker)
    await client.open()
    const pending = client.query("SELECT 1"), rejected = expect(pending).rejects.toMatchObject({ code: "timeout" })
    await Promise.resolve(); await vi.advanceTimersByTimeAsync(15000); await rejected
    expect(worker.terminated).toBe(true); client.close()
  })
})
