import { OcrError, type OcrErrorCode } from "./ocr-shared"
import { IMAGE_DIFF_LIMITS, type ImageDiffRequest, type ImageDiffResponse, type ImageDiffStage } from "./image-diff-shared"

export function runImageDiff(request: ImageDiffRequest, context: { signal?: AbortSignal; onProgress?: (stage: ImageDiffStage) => void } = {}, factory = () => new Worker(new URL("../workers/image-diff.worker.ts", import.meta.url), { type: "module" })): Promise<ImageDiffResponse> {
  if (context.signal?.aborted) return Promise.reject(new OcrError("cancelled"))
  let worker: Worker
  try { worker = factory() } catch { return Promise.reject(new OcrError("unsupported")) }
  return new Promise((resolve, reject) => {
    let done = false, sent = false
    const cleanup = () => { clearTimeout(timer); context.signal?.removeEventListener("abort", abort); worker.onmessage = null; worker.onerror = null; worker.terminate() }
    const fail = (code: OcrErrorCode) => { if (done) return; done = true; cleanup(); reject(new OcrError(code)) }
    const abort = () => fail("cancelled"), timer = setTimeout(() => fail("timeout"), IMAGE_DIFF_LIMITS.timeout)
    context.signal?.addEventListener("abort", abort, { once: true }); worker.onerror = event => { event.preventDefault(); fail("engine") }
    worker.onmessage = ({ data }: MessageEvent<{ ready?: boolean; response?: ImageDiffResponse; error?: OcrErrorCode; stage?: ImageDiffStage }>) => {
      if (done) return
      if (data.ready) { if (!sent) { sent = true; try { worker.postMessage(request) } catch { fail("engine") } } return }
      if (data.stage) { context.onProgress?.(data.stage); return }
      if (data.error || !data.response) { fail(data.error ?? "engine"); return }
      done = true; cleanup(); resolve(data.response)
    }
    if (context.signal?.aborted) abort()
  })
}

export async function createDiffSamples(): Promise<[File, File]> {
  const files: File[] = []
  for (let i = 0; i < 2; i++) {
    const canvas = document.createElement("canvas"); canvas.width = 1000; canvas.height = 600
    const ctx = canvas.getContext("2d")!; ctx.fillStyle = "#f3f5fa"; ctx.fillRect(0, 0, 1000, 600); ctx.fillStyle = "#fff"; ctx.fillRect(50, 40, 900, 520)
    ctx.fillStyle = "#24334a"; ctx.font = 'bold 36px Arial, "Microsoft YaHei", sans-serif'; ctx.fillText("Project overview", 90, 110)
    ctx.font = '25px Arial, "Microsoft YaHei", sans-serif'; ctx.fillStyle = "#66758d"; ctx.fillText("September 2026", 90, 158)
    ctx.fillStyle = i ? "#17826c" : "#365db4"; ctx.fillRect(i ? 590 : 620, 80, 280, 75); ctx.fillStyle = "#fff"; ctx.fillText(i ? "Ready to share" : "Draft preview", i ? 623 : 665, 125)
    ctx.fillStyle = "#eaf0fa"; ctx.fillRect(90, 215, 810, 250); ctx.fillStyle = "#446897"
    ;[110, 170, i ? 140 : 210, 130, 190].forEach((height, index) => ctx.fillRect(150 + index * 145, 430 - height, 80, height))
    if (i) { ctx.fillStyle = "#ef4444"; ctx.beginPath(); ctx.arc(900, 505, 12, 0, Math.PI * 2); ctx.fill() }
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new OcrError("engine")), "image/png"))
    files.push(new File([blob], `design-${i ? "after" : "before"}.png`, { type: "image/png" }))
  }
  return files as [File, File]
}
