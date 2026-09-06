import { OcrError, type OcrErrorCode } from "./ocr-shared"
import { REDACT_LIMITS, type RedactRequest, type RedactResult } from "./image-redact-shared"

export function runRedactImage(request: RedactRequest, signal?: AbortSignal, factory = () => new Worker(new URL("../workers/image-redact.worker.ts", import.meta.url), { type: "module" })): Promise<RedactResult> {
  if (signal?.aborted) return Promise.reject(new OcrError("cancelled"))
  let worker: Worker
  try { worker = factory() } catch { return Promise.reject(new OcrError("unsupported")) }
  return new Promise((resolve, reject) => {
    let done = false, sent = false
    const cleanup = () => { clearTimeout(timer); signal?.removeEventListener("abort", abort); worker.onmessage = null; worker.onerror = null; worker.terminate() }
    const fail = (code: OcrErrorCode) => { if (done) return; done = true; cleanup(); reject(new OcrError(code)) }
    const abort = () => fail("cancelled"), timer = setTimeout(() => fail("timeout"), REDACT_LIMITS.timeout)
    signal?.addEventListener("abort", abort, { once: true })
    worker.onerror = event => { event.preventDefault(); fail("engine") }
    worker.onmessage = ({ data }: MessageEvent<{ ready?: boolean; result?: RedactResult; error?: OcrErrorCode }>) => {
      if (done) return
      if (data.ready) { if (!sent) { sent = true; try { worker.postMessage(request) } catch { fail("engine") } } return }
      if (data.error || !data.result) { fail(data.error ?? "engine"); return }
      done = true; cleanup(); resolve(data.result)
    }
    if (signal?.aborted) abort()
  })
}

export async function createRedactSample(): Promise<File> {
  const canvas = document.createElement("canvas"); canvas.width = 1000; canvas.height = 560
  const ctx = canvas.getContext("2d")!
  ctx.fillStyle = "#f3f5fa"; ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = "#fff"; ctx.fillRect(36, 36, 928, 488)
  ctx.fillStyle = "#17243a"; ctx.font = 'bold 34px Arial, "Microsoft YaHei", sans-serif'
  ctx.fillText("Contact card / 联系卡（示例）", 76, 100)
  ctx.font = '28px Arial, "Microsoft YaHei", sans-serif'
  ;["Name: Example User", "Phone: 138 0013 8000", "Email: hello@example.com", "ID: 110101199001011234", "Share this image after redaction."].forEach((line, i) => ctx.fillText(line, 76, 176 + i * 64))
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new OcrError("engine")), "image/png"))
  return new File([blob], "privacy-example.png", { type: "image/png" })
}
