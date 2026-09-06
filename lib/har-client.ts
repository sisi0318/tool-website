import { HAR_LIMITS, HarError, type HarRequest, type HarResponse } from "./har-shared"

/** Keep the parsed archive in a worker; only compact rows and one bounded detail enter the UI. */
export function createHarSession(factory = () => new Worker(new URL("../workers/har.worker.ts", import.meta.url), { type: "module" })) {
  let worker: Worker
  try { worker = factory() } catch { throw new HarError("unsupported") }
  let ready = false, disposed = false, nextId = 0, pending: { id: number; request: HarRequest; resolve: (value: HarResponse) => void; reject: (error: HarError) => void; timer: ReturnType<typeof setTimeout> } | null = null
  const rejectPending = (code: HarError["code"]) => { if (!pending) return; clearTimeout(pending.timer); pending.reject(new HarError(code)); pending = null }
  const dispose = () => { if (disposed) return; disposed = true; rejectPending("cancelled"); worker.onmessage = null; worker.onerror = null; worker.terminate() }
  const send = () => { if (!pending || !ready || disposed) return; try { worker.postMessage({ id: pending.id, request: pending.request }) } catch { rejectPending("engine"); dispose() } }
  worker.onerror = event => { event.preventDefault(); rejectPending("engine"); dispose() }
  worker.onmessage = ({ data }: MessageEvent<{ ready?: boolean; id?: number; response?: HarResponse; error?: HarError["code"] }>) => {
    if (disposed) return
    if (data.ready) { if (!ready) { ready = true; send() } return }
    if (!pending || data.id !== pending.id) return
    if (data.error || !data.response) { rejectPending(data.error ?? "engine"); return }
    const current = pending; pending = null; clearTimeout(current.timer); current.resolve(data.response)
  }
  return {
    run(request: HarRequest): Promise<HarResponse> {
      if (disposed) return Promise.reject(new HarError("cancelled"))
      rejectPending("cancelled")
      return new Promise((resolve, reject) => { const id = ++nextId, timer = setTimeout(() => { rejectPending("timeout"); dispose() }, HAR_LIMITS.timeout); pending = { id, request, resolve, reject, timer }; send() })
    },
    dispose,
  }
}

export function createHarSample(): File {
  const started = Date.UTC(2026, 8, 6, 10), rows = [
    ["GET", "https://example.com/", 200, 0, 280, 4000, "text/html"],
    ["GET", "https://example.com/app.js", 200, 100, 1700, 180000, "application/javascript"],
    ["GET", "https://example.com/styles.css", 200, 110, 180, 24000, "text/css"],
    ["GET", "https://api.example.com/items?page=1&token=example-token", 200, 320, 1300, 12000, "application/json"],
    ["GET", "https://api.example.com/items?page=1&token=example-token", 200, 1800, 1100, 12000, "application/json"],
    ["GET", "https://example.com/missing.png", 404, 400, 120, 240, "text/html"],
    ["POST", "https://api.example.com/save", 500, 1200, 2400, 800, "application/json"],
    ["GET", "https://cdn.example.com/banner.webp", 0, 800, 500, -1, "image/webp"],
    ["GET", "https://example.com/favicon.ico", 304, 200, 80, 0, "image/x-icon"],
  ] as const
  const entries = rows.map(([method, url, status, offset, time, bodySize, mime]) => ({ startedDateTime: new Date(started + offset).toISOString(), time, pageref: "page_1", request: { method, url, httpVersion: "HTTP/2", headers: [{ name: "Accept", value: "*/*" }, { name: "Authorization", value: "Bearer example-secret" }], queryString: [...new URL(url).searchParams].map(([name, value]) => ({ name, value })), ...(method === "POST" ? { postData: { mimeType: "application/json", text: '{"name":"示例用户"}' } } : {}) }, response: { status, statusText: status >= 400 ? "Error" : "OK", headersSize: status === 0 ? -1 : 120, bodySize, headers: [{ name: "Content-Type", value: mime }, { name: "Set-Cookie", value: "session=example-secret; HttpOnly" }], content: { size: bodySize < 0 ? -1 : bodySize * 2, mimeType: mime, ...(mime === "application/json" ? { text: '{"message":"示例响应"}' } : {}) } }, timings: { blocked: 0, dns: 10, connect: 30, ssl: 20, send: 2, wait: time - 62, receive: 20 }, ...(status === 0 ? { _error: "net::ERR_CONNECTION_RESET" } : {}) }))
  return new File([JSON.stringify({ log: { version: "1.2", creator: { name: "Tool Station sample", version: "1.0" }, pages: [{ id: "page_1", title: "Example dashboard", startedDateTime: new Date(started).toISOString(), pageTimings: { onContentLoad: 1850, onLoad: 2900 } }], entries } }, null, 2)], "example-network.har", { type: "application/json" })
}
