export const HAR_LIMITS = { fileBytes: 64 * 1024 * 1024, entries: 20_000, pages: 2000, detailChars: 64_000, pairs: 300, timeout: 60_000 } as const
export class HarError extends Error { constructor(public code: "fileLimit" | "format" | "entryLimit" | "cancelled" | "timeout" | "unsupported" | "engine") { super(code); this.name = "HarError" } }
export const HAR_PHASES = ["blocked", "dns", "connect", "send", "wait", "receive"] as const
export type HarPhase = typeof HAR_PHASES[number]
export interface HarRow {
  id: number; method: string; url: string; host: string; status: number | null; statusText: string; mime: string; page: string
  start: number | null; duration: number | null; timings: Record<HarPhase | "ssl", number | null>; transfer: number | null; body: number | null; content: number | null
  error: string; failed: boolean; repeats: number; timingMismatch: boolean
}
export interface HarPage { id: string; title: string; start: number | null; contentLoad: number | null; load: number | null }
export interface HarData { rows: HarRow[]; pages: HarPage[]; creator: string; version: string; skipped: number }
export interface HarPair { name: string; value: string }
export interface HarDetail {
  requestHeaders: HarPair[]; responseHeaders: HarPair[]; query: HarPair[]; headersTruncated: boolean
  requestBody: string; requestLength: number; responseBody: string; responseLength: number; encoding: string; mime: string; ip: string; connection: string
}
export interface HarSummary { requests: number; failed: number; slow: number; repeatedGroups: number; extraRequests: number; median: number | null; p95: number | null; timed: number; transfer: number | null; transferUnknown: number; start: number | null; span: number | null }
export type HarRequest = { action: "load"; file: File } | { action: "detail"; id: number; reveal: boolean } | { action: "export"; ids: number[]; format: "csv" | "json"; reveal: boolean }
export type HarResponse = { data: HarData } | { detail: HarDetail } | { output: Blob }

type Obj = Record<string, unknown>
export const harObject = (value: unknown): Obj => value && typeof value === "object" && !Array.isArray(value) ? value as Obj : {}
const string = (value: unknown, limit = 1024) => typeof value === "string" ? value.slice(0, limit) : ""
const nonnegative = (value: unknown): number | null => typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= Number.MAX_SAFE_INTEGER ? value : null
const bytes = (value: unknown): number | null => Number.isSafeInteger(value) && (value as number) >= 0 ? value as number : null
const date = (value: unknown) => { const number = typeof value === "string" ? Date.parse(value) : NaN; return Number.isFinite(number) ? number : null }

/** Tolerate incomplete entries while retaining unavailable measurements as null, never zero. */
export function parseHar(input: unknown): HarData {
  const log = harObject(harObject(input).log)
  if (!Array.isArray(log.entries)) throw new HarError("format")
  if (log.entries.length > HAR_LIMITS.entries || Array.isArray(log.pages) && log.pages.length > HAR_LIMITS.pages) throw new HarError("entryLimit")
  const rows: HarRow[] = []; let skipped = 0
  log.entries.forEach((item, id) => {
    const entry = harObject(item), request = harObject(entry.request), response = harObject(entry.response), content = harObject(response.content), timing = harObject(entry.timings)
    if (typeof request.url !== "string" || !request.url || request.url.length > 65536 || typeof request.method !== "string" || !request.method || request.method.length > 32) { skipped++; return }
    let host = ""
    try { host = new URL(request.url).host } catch { /* Keep the literal URL readable, without making it a link. */ }
    const timings = Object.fromEntries([...HAR_PHASES, "ssl"].map(key => [key, nonnegative(timing[key])])) as HarRow["timings"]
    const status = Number.isInteger(response.status) && (response.status as number) >= 0 && (response.status as number) <= 999 ? response.status as number : null
    const duration = nonnegative(entry.time), headers = bytes(response.headersSize), body = bytes(response.bodySize), extension = bytes(response._transferSize)
    const combined = headers !== null && body !== null && Number.isSafeInteger(headers + body) ? headers + body : null
    const error = string(entry._error ?? response._error)
    const sum = HAR_PHASES.reduce((total, key) => total + (timings[key] ?? 0), 0)
    const timingMismatch = duration !== null && HAR_PHASES.some(key => timings[key] !== null) && Math.abs(sum - duration) > Math.max(1, duration * 0.02)
    rows.push({ id, method: request.method.toUpperCase(), url: request.url, host, status, statusText: string(response.statusText, 128), mime: string(content.mimeType, 256).split(";")[0], page: string(entry.pageref), start: date(entry.startedDateTime), duration, timings, transfer: extension ?? combined, body, content: bytes(content.size), error, failed: !!error || status === 0 || status !== null && status >= 400, repeats: 1, timingMismatch })
  })
  const groups = new Map<string, number>()
  for (const row of rows) { const key = JSON.stringify([row.method, row.url]); groups.set(key, (groups.get(key) ?? 0) + 1) }
  for (const row of rows) row.repeats = groups.get(JSON.stringify([row.method, row.url]))!
  const pages: HarPage[] = (Array.isArray(log.pages) ? log.pages : []).flatMap(item => { const page = harObject(item), timings = harObject(page.pageTimings); return typeof page.id === "string" ? [{ id: string(page.id), title: string(page.title), start: date(page.startedDateTime), contentLoad: nonnegative(timings.onContentLoad), load: nonnegative(timings.onLoad) }] : [] })
  const creator = harObject(log.creator)
  return { rows, pages, skipped, creator: [string(creator.name, 128), string(creator.version, 128)].filter(Boolean).join(" "), version: string(log.version, 32) }
}

export function harSummary(rows: HarRow[], slowMs = 1000): HarSummary {
  const durations = rows.flatMap(row => row.duration === null ? [] : [row.duration]).sort((a, b) => a - b), groups = new Map<string, number>()
  let start = Infinity, end = -Infinity, transfer = 0, transferUnknown = 0
  for (const row of rows) {
    if (row.start !== null) { start = Math.min(start, row.start); end = Math.max(end, row.start + (row.duration ?? 0)) }
    if (row.transfer === null) transferUnknown++; else transfer += row.transfer
    const key = JSON.stringify([row.method, row.url]); groups.set(key, (groups.get(key) ?? 0) + 1)
  }
  const repeated = [...groups.values()].filter(count => count > 1)
  return { requests: rows.length, failed: rows.filter(row => row.failed).length, slow: durations.filter(duration => duration >= slowMs).length, repeatedGroups: repeated.length, extraRequests: repeated.reduce((total, count) => total + count - 1, 0), timed: durations.length, median: durations.length ? durations.length % 2 ? durations[Math.floor(durations.length / 2)] : (durations[durations.length / 2 - 1] + durations[durations.length / 2]) / 2 : null, p95: durations.length ? durations[Math.ceil(durations.length * 0.95) - 1] : null, transfer: Number.isSafeInteger(transfer) ? transfer : null, transferUnknown, start: Number.isFinite(start) ? start : null, span: Number.isFinite(start) && Number.isFinite(end) ? end - start : null }
}

export function harDisplayUrl(url: string, reveal: boolean) {
  if (reveal) return url
  try {
    const parsed = new URL(url)
    if (!["http:", "https:", "ws:", "wss:"].includes(parsed.protocol)) return `${parsed.protocol}[hidden]`
    if (parsed.username) parsed.username = "hidden"; if (parsed.password) parsed.password = "hidden"
    const params = new URLSearchParams(); parsed.searchParams.forEach((_, name) => params.append(name, "[hidden]")); parsed.search = params.toString(); if (parsed.hash) parsed.hash = "hidden"
    return parsed.toString()
  } catch { return "[invalid URL hidden]" }
}
function pairs(value: unknown, reveal: boolean, all = false): HarPair[] {
  return (Array.isArray(value) ? value : []).slice(0, HAR_LIMITS.pairs).flatMap(item => {
    const pair = harObject(item); if (typeof pair.name !== "string" || typeof pair.value !== "string") return []
    const name = string(pair.name, 1024), value = !reveal && (all || /authorization|cookie|token|secret|api[-_]?key/i.test(name)) ? "[hidden]" : !reveal && /^(referer|location)$/i.test(name) ? harDisplayUrl(pair.value, false) : string(pair.value, 8192)
    return [{ name, value }]
  })
}
export function harDetail(input: unknown, id: number, reveal: boolean): HarDetail {
  const entries = harObject(harObject(input).log).entries
  if (!Array.isArray(entries) || !Number.isInteger(id) || id < 0 || id >= entries.length) throw new HarError("format")
  const entry = harObject(entries[id]), request = harObject(entry.request), response = harObject(entry.response), post = harObject(request.postData), content = harObject(response.content)
  const requestText = typeof post.text === "string" ? post.text : Array.isArray(post.params) ? post.params.slice(0, HAR_LIMITS.pairs).map(item => { const pair = harObject(item); return `${string(pair.name)}=${string(pair.value, HAR_LIMITS.detailChars)}` }).join("\n") : ""
  const responseText = typeof content.text === "string" ? content.text : ""
  let query = request.queryString
  if (!Array.isArray(query)) { try { query = [...new URL(String(request.url)).searchParams].map(([name, value]) => ({ name, value })) } catch { query = [] } }
  const headersTruncated = [request.headers, response.headers, query, post.params].some(value => Array.isArray(value) && (value.length > HAR_LIMITS.pairs || value.some(item => { const pair = harObject(item); return typeof pair.name === "string" && pair.name.length > 1024 || typeof pair.value === "string" && pair.value.length > 8192 })))
  return { requestHeaders: pairs(request.headers, reveal), responseHeaders: pairs(response.headers, reveal), query: pairs(query, reveal, true), headersTruncated, requestBody: reveal ? requestText.slice(0, HAR_LIMITS.detailChars) : "", requestLength: requestText.length, responseBody: reveal ? responseText.slice(0, HAR_LIMITS.detailChars) : "", responseLength: responseText.length, encoding: string(content.encoding, 32), mime: string(content.mimeType, 256), ip: string(entry.serverIPAddress, 128), connection: string(entry.connection, 128) }
}

export function harReport(rows: HarRow[], format: "csv" | "json", reveal: boolean): Blob {
  const values = rows.map(row => ({ index: row.id + 1, method: row.method, url: harDisplayUrl(row.url, reveal), host: row.host, status: row.status, durationMs: row.duration, transferBytes: row.transfer, responseBodyBytes: row.body, contentBytes: row.content, start: row.start === null ? null : new Date(row.start).toISOString(), page: row.page, mime: row.mime, failed: row.failed, repeatsInFile: row.repeats, timingsMs: row.timings }))
  if (format === "json") return new Blob([JSON.stringify({ urlValuesHidden: !reveal, rows: values }, null, 2)], { type: "application/json" })
  const keys = ["index", "method", "url", "host", "status", "durationMs", "transferBytes", "responseBodyBytes", "contentBytes", "start", "page", "mime", "failed", "repeatsInFile"] as const
  const quote = (value: unknown) => { const text = value === null || value === undefined ? "" : String(value); return `"${(/^[\s\u0000-\u001f]*[=+\-@]/.test(text) ? "'" + text : text).replace(/"/g, '""')}"` }
  return new Blob(["\ufeff" + [keys.map(quote).join(","), ...values.map(row => keys.map(key => quote(row[key])).join(","))].join("\r\n") + "\r\n"], { type: "text/csv;charset=utf-8" })
}
