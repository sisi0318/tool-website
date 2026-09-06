import { OcrError, OCR_LIMITS, OCR_ROOT, checkOcrDimensions, mapOcrLine, ocrImageHeader, ocrOptions, ocrTiles, orderOcrLines, type OcrLine, type OcrPoint, type OcrProgress, type OcrRequest, type OcrResponse } from "../lib/ocr-shared"

interface Core {
  initialize(): Promise<unknown>
  predict(source: ImageData, options: Record<string, unknown>): Promise<Array<{ items: Array<{ text: string; score: number; poly: OcrPoint[] }> }>>
  dispose(): Promise<void>
}
interface Cv { matFromImageData(source: ImageData): { delete(): void } }
interface Runtime { PaddleOCRCore: new (options: Record<string, unknown>) => Core; normalizeOcrPipelineConfig(config: unknown): unknown }
const scope = self as unknown as { location: Location; onmessage: ((event: MessageEvent<OcrRequest>) => void) | null; postMessage(message: OcrResponse): void }
scope.onmessage = async ({ data }) => {
  let bitmap: ImageBitmap | undefined, core: Core | undefined
  const progress = (value: OcrProgress) => scope.postMessage({ type: "progress", progress: value })
  try {
    const started = performance.now(), options = ocrOptions(data.options)
    if (typeof createImageBitmap !== "function" || typeof OffscreenCanvas === "undefined") throw new OcrError("unsupported")
    if (!data.file || data.file.size < 1 || data.file.size > OCR_LIMITS.fileBytes) throw new OcrError("fileLimit")
    progress({ stage: "reading" })
    const header = ocrImageHeader(new Uint8Array(await data.file.arrayBuffer()))
    try { bitmap = await createImageBitmap(data.file, { imageOrientation: "from-image" }) } catch { throw new OcrError("decode") }
    checkOcrDimensions(bitmap.width, bitmap.height)
    const width = options.rotation % 180 ? bitmap.height : bitmap.width, height = options.rotation % 180 ? bitmap.width : bitmap.height
    const source = new OffscreenCanvas(width, height), context = source.getContext("2d")
    if (!context) throw new OcrError("unsupported")
    context.fillStyle = "#fff"; context.fillRect(0, 0, width, height)
    context.translate(width / 2, height / 2); context.rotate(options.rotation * Math.PI / 180)
    context.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2)
    bitmap.close(); bitmap = undefined
    const previewScale = Math.min(1, 1800 / Math.max(width, height)), previewCanvas = new OffscreenCanvas(Math.max(1, Math.round(width * previewScale)), Math.max(1, Math.round(height * previewScale)))
    previewCanvas.getContext("2d")!.drawImage(source, 0, 0, previewCanvas.width, previewCanvas.height)
    const preview = await previewCanvas.convertToBlob({ type: "image/png" })
    previewCanvas.width = previewCanvas.height = 1
    progress({ stage: "runtime" })
    const root = new URL(`${OCR_ROOT}/`, scope.location.origin).href
    try {
      const runtime: Runtime = await import(/* webpackIgnore: true */ `${root}paddle.mjs`)
      const loaded = new Map<string, number>(), total = 9891840 + 21319680
      let lastProgress = 0
      const trackedFetch: typeof fetch = async (input, init) => {
        const response = await fetch(input, init)
        if (!response.ok) throw new OcrError("model")
        if (!response.body) return response
        const key = String(input), reader = response.body.getReader()
        return new Response(new ReadableStream({
          async pull(controller) {
            const { done, value } = await reader.read()
            if (done) { controller.close(); return }
            loaded.set(key, (loaded.get(key) ?? 0) + value.byteLength)
            const completed = [...loaded.values()].reduce((a, b) => a + b, 0)
            if (performance.now() - lastProgress > 100 || completed === total) { progress({ stage: "models", completed, total }); lastProgress = performance.now() }
            controller.enqueue(value)
          }, cancel: reason => reader.cancel(reason),
        }), { status: response.status, headers: response.headers })
      }
      progress({ stage: "models", completed: 0, total })
      core = new runtime.PaddleOCRCore({
        pipelineConfig: runtime.normalizeOcrPipelineConfig({ pipeline_name: "OCR", SubModules: {
          TextDetection: { model_name: "PP-OCRv6_small_det", model_dir: { url: `${root}models/PP-OCRv6_small_det.tar` }, batch_size: 1 },
          TextRecognition: { model_name: "PP-OCRv6_small_rec", model_dir: { url: `${root}models/PP-OCRv6_small_rec.tar` }, batch_size: 4 },
        } }),
        ortOptions: { backend: "wasm", numThreads: 1, wasmPaths: `${root}ort/`, proxy: false }, fetch: trackedFetch,
        sourceToMat(cv: Cv, image: ImageData) { const mat = cv.matFromImageData(image); return { width: image.width, height: image.height, mat, dispose() { mat.delete() } } },
      })
      await core.initialize()
    } catch { throw new OcrError("model") }
    const tiles = ocrTiles(width, height), lines: Array<Omit<OcrLine, "id">> = []
    for (const [index, tile] of tiles.entries()) {
      progress({ stage: "recognizing", completed: index, total: tiles.length })
      const scale = options.enhanceSmallText ? Math.min(2, Math.max(1, 1600 / Math.max(tile.width, tile.height))) : 1
      const canvas = new OffscreenCanvas(Math.round(tile.width * scale), Math.round(tile.height * scale)), ctx = canvas.getContext("2d", { willReadFrequently: true })!
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high"
      ctx.drawImage(source, tile.x, tile.y, tile.width, tile.height, 0, 0, canvas.width, canvas.height)
      const [result] = await core.predict(ctx.getImageData(0, 0, canvas.width, canvas.height), { textDetLimitSideLen: 2048, textDetLimitType: "max", textDetMaxSideLimit: 2560, textRecScoreThresh: 0 })
      for (const raw of result.items) { const line = mapOcrLine(raw, tile, canvas.width / tile.width, canvas.height / tile.height, width, height); if (line) lines.push(line) }
      if (lines.length > OCR_LIMITS.lines) throw new OcrError("outputLimit")
      canvas.width = canvas.height = 1
    }
    source.width = source.height = 1
    progress({ stage: "finishing" })
    const ordered = orderOcrLines(lines)
    scope.postMessage({ type: "done", result: { text: ordered.map(line => line.text).join("\n"), lines: ordered, preview, info: { width, height, rotation: options.rotation, tiles: tiles.length, elapsedMs: Math.round(performance.now() - started), animated: header.animated } } })
  } catch (error) { scope.postMessage({ type: "error", code: error instanceof OcrError ? error.code : "engine" }) }
  finally { bitmap?.close(); await core?.dispose().catch(() => {}) }
}
