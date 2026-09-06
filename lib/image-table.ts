import { OcrError, type OcrErrorCode } from "./ocr-shared"
import { TABLE_LIMITS, type TableRequest, type TableResponse } from "./image-table-shared"

export function runImageTable(request: TableRequest, signal?: AbortSignal, factory = () => new Worker(new URL("../workers/image-table.worker.ts", import.meta.url), { type: "module" })): Promise<TableResponse> {
  if (signal?.aborted) return Promise.reject(new OcrError("cancelled"))
  let worker: Worker
  try { worker = factory() } catch { return Promise.reject(new OcrError("unsupported")) }
  return new Promise((resolve, reject) => {
    let done = false, sent = false
    const cleanup = () => { clearTimeout(timer); signal?.removeEventListener("abort", abort); worker.onmessage = null; worker.onerror = null; worker.terminate() }
    const fail = (code: OcrErrorCode) => { if (done) return; done = true; cleanup(); reject(new OcrError(code)) }
    const abort = () => fail("cancelled"), timer = setTimeout(() => fail("timeout"), TABLE_LIMITS.timeout)
    signal?.addEventListener("abort", abort, { once: true }); worker.onerror = event => { event.preventDefault(); fail("engine") }
    worker.onmessage = ({ data }: MessageEvent<{ ready?: boolean; result?: TableResponse; error?: OcrErrorCode }>) => {
      if (done) return
      if (data.ready) { if (!sent) { sent = true; try { worker.postMessage(request) } catch { fail("engine") } } return }
      if (data.error || !data.result) { fail(data.error ?? "engine"); return }
      done = true; cleanup(); resolve(data.result)
    }
    if (signal?.aborted) abort()
  })
}

export async function createTableSample(): Promise<File> {
  const canvas = document.createElement("canvas"); canvas.width = 1100; canvas.height = 440
  const ctx = canvas.getContext("2d")!; ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, 1100, 440)
  const x = [40, 210, 510, 690, 1060], y = [40, 112, 184, 256, 328, 400]
  ctx.fillStyle = "#eaf0fa"; ctx.fillRect(40, 40, 1020, 72)
  ctx.strokeStyle = "#42516a"; ctx.lineWidth = 2
  for (const value of x) { ctx.beginPath(); ctx.moveTo(value, 40); ctx.lineTo(value, 400); ctx.stroke() }
  for (const value of y) { ctx.beginPath(); ctx.moveTo(40, value); ctx.lineTo(1060, value); ctx.stroke() }
  ctx.fillStyle = "#17243a"; ctx.font = '26px Arial, "Microsoft YaHei", sans-serif'
  const rows = [["编号", "商品名称", "数量", "备注"], ["00123", "无线键盘", "12", "中文示例"], ["00456", "便携鼠标", "8", ""], ["00789", "显示器", "2", "第一行\n第二行"], ["01024", "连接线", "30", "核对后导出"]]
  rows.forEach((row, r) => row.forEach((text, c) => text.split("\n").forEach((line, i, lines) => ctx.fillText(line, x[c] + 18, y[r] + (lines.length > 1 ? 28 : 45) + i * 30))))
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new OcrError("engine")), "image/png"))
  return new File([blob], "table-example.png", { type: "image/png" })
}
