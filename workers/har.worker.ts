import { HAR_LIMITS, HarError, harDetail, harReport, parseHar, type HarData, type HarRequest } from "../lib/har-shared"
const scope = self as unknown as { onmessage: ((event: MessageEvent<{ id: number; request: HarRequest }>) => void) | null; postMessage(value: unknown): void }
let original: unknown, data: HarData | undefined
scope.onmessage = async ({ data: message }) => {
  const { id, request } = message
  try {
    if (request.action === "load") {
      original = undefined; data = undefined
      if (!request.file?.size || request.file.size > HAR_LIMITS.fileBytes) throw new HarError("fileLimit")
      let input: unknown
      try { input = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(await request.file.arrayBuffer()).replace(/^\ufeff/, "")) } catch { throw new HarError("format") }
      const parsed = parseHar(input); original = input; data = parsed; scope.postMessage({ id, response: { data: parsed } })
    } else if (request.action === "detail" && data) scope.postMessage({ id, response: { detail: harDetail(original, request.id, request.reveal) } })
    else if (request.action === "export" && data) {
      if (!Array.isArray(request.ids) || request.ids.length > HAR_LIMITS.entries || !["csv", "json"].includes(request.format)) throw new HarError("format")
      const byId = new Map(data.rows.map(row => [row.id, row]))
      const rows = request.ids.map(index => { const row = byId.get(index); if (!row) throw new HarError("format"); return row })
      scope.postMessage({ id, response: { output: harReport(rows, request.format, request.reveal) } })
    } else throw new HarError("format")
  } catch (error) { scope.postMessage({ id, error: error instanceof HarError ? error.code : "engine" }) }
}
scope.postMessage({ ready: true })
