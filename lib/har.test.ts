import { describe, expect, it, vi } from "vitest"
import { HAR_LIMITS, harDetail, harDisplayUrl, harReport, harSummary, parseHar } from "./har-shared"
import { createHarSession } from "./har-client"
const entry = (changes: Record<string, unknown> = {}) => ({ request: { method: "GET", url: "https://example.com/items?page=1" }, response: { status: 200, headersSize: 100, bodySize: 400, content: { size: 1200 } }, startedDateTime: "2026-09-06T10:00:00.000Z", time: 100, timings: { blocked: 0, dns: 5, connect: 20, ssl: 15, send: 5, wait: 60, receive: 10 }, ...changes })
const archive = (...entries: unknown[]) => ({ log: { version: "1.2", entries } })
const blobText = (blob: Blob): Promise<string> => new Promise(resolve => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.readAsText(blob) })
describe("HAR measurements and bounded details", () => {
  it("keeps unknown measurements distinct from recorded zero and never substitutes uncompressed content", () => {
    const rows = parseHar(archive(entry(), entry({ response: { status: 304, _transferSize: 0, headersSize: 100, bodySize: 0, content: { size: 1200 } }, time: 0 }), entry({ response: { status: 0, headersSize: -1, bodySize: -1, content: { size: 1200 } }, time: -1 }))).rows
    expect(rows.map(row => row.transfer)).toEqual([500, 0, null]); expect(rows.map(row => row.duration)).toEqual([100, 0, null]); expect(rows[0].timingMismatch).toBe(false)
    expect(rows[2].failed).toBe(true)
    expect(harSummary(rows)).toMatchObject({ requests: 3, timed: 2, median: 50, p95: 100, transfer: 500, transferUnknown: 1, failed: 1 })
  })
  it("matches repeats by method and full URL, retaining query differences and invalid-record counts", () => {
    const parsed = parseHar(archive(entry(), entry(), entry({ request: { method: "GET", url: "https://example.com/items?page=2" } }), entry({ request: { method: "POST", url: "https://example.com/items?page=1" } }), { request: {} }))
    expect(parsed.rows.map(row => row.repeats)).toEqual([2, 2, 1, 1]); expect(parsed.skipped).toBe(1); expect(harSummary(parsed.rows)).toMatchObject({ repeatedGroups: 1, extraRequests: 1 })
  })
  it("orders timestamps across timezones and treats missing timing/status fields as unknown", () => {
    const rows = parseHar(archive(entry({ startedDateTime: "2026-09-06T18:00:00+08:00" }), entry({ startedDateTime: "not-a-date", time: undefined, timings: {}, response: {} }))).rows
    expect(rows[0].start).toBe(Date.UTC(2026, 8, 6, 10)); expect(rows[1]).toMatchObject({ start: null, duration: null, status: null, transfer: null, failed: false }); expect(rows[1].timings.ssl).toBeNull()
    expect(() => parseHar({ entries: [] })).toThrow("format"); expect(() => parseHar(archive(...Array(HAR_LIMITS.entries + 1).fill(null)))).toThrow("entryLimit")
  })
  it("masks credentials, duplicate query values and sensitive headers, with explicit bounded body access", () => {
    const url = "https://user:password@example.com/items?a=one&a=two#private", masked = new URL(harDisplayUrl(url, false))
    expect(masked.username).toBe("hidden"); expect(masked.password).toBe("hidden"); expect(masked.searchParams.getAll("a")).toEqual(["[hidden]", "[hidden]"]); expect(masked.hash).toBe("#hidden")
    const input = archive(entry({ request: { method: "POST", url, headers: [{ name: "Authorization", value: "secret" }, { name: "Accept", value: "*/*" }], postData: { text: "request secret" } }, response: { headers: [{ name: "Set-Cookie", value: "session=secret" }], content: { encoding: "base64", text: "x".repeat(70000) } } }))
    const hidden = harDetail(input, 0, false); expect(hidden.query.map(pair => pair.value)).toEqual(["[hidden]", "[hidden]"]); expect(hidden.requestHeaders[0].value).toBe("[hidden]"); expect(hidden.requestBody).toBe(""); expect(hidden.responseBody).toBe("")
    const shown = harDetail(input, 0, true); expect(shown.requestBody).toBe("request secret"); expect(shown.responseBody.length).toBe(64000); expect(shown.responseLength).toBe(70000); expect(shown.encoding).toBe("base64")
  })
  it("exports filtered measurements only, masking URL values and keeping nulls in JSON", async () => {
    const rows = parseHar(archive(entry(), entry({ time: -1, response: {} }))).rows
    const report = JSON.parse(await blobText(harReport([rows[1]], "json", false)))
    expect(report.rows).toHaveLength(1); expect(report.rows[0]).toMatchObject({ index: 2, durationMs: null, transferBytes: null }); expect(JSON.stringify(report)).not.toContain("headers"); expect(new URL(report.rows[0].url).searchParams.get("page")).toBe("[hidden]")
    const csv = await blobText(harReport(rows, "csv", true)); expect(csv).toContain('"https://example.com/items?page=1"'); expect(csv).toContain('"durationMs"')
  })
})
describe("HAR session lifecycle", () => {
  it("waits for worker readiness and ignores superseded details", async () => {
    const worker = { onmessage: null as ((event: MessageEvent) => void) | null, onerror: null, postMessage: vi.fn(), terminate: vi.fn() }
    const session = createHarSession(() => worker as unknown as Worker)
    const first = session.run({ action: "detail", id: 0, reveal: false }).catch(error => error.code)
    expect(worker.postMessage).not.toHaveBeenCalled(); worker.onmessage!({ data: { ready: true } } as MessageEvent)
    const second = session.run({ action: "detail", id: 1, reveal: false }); expect(await first).toBe("cancelled")
    worker.onmessage!({ data: { id: 1, response: { detail: "stale" } } } as MessageEvent)
    worker.onmessage!({ data: { id: 2, response: { detail: "current" } } } as MessageEvent)
    expect(await second).toEqual({ detail: "current" }); session.dispose(); expect(worker.terminate).toHaveBeenCalledOnce()
  })
})
