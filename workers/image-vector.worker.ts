import { ImageVectorError, VECTOR_LIMITS, VECTOR_RUNTIME_PATH, finishVectorSvg, prepareVectorPixels, rasterHeader, traceDimensions, vectorEngineOptions, vectorOptions, type VectorStage, type VectorWorkerRequest, type VectorWorkerResponse } from "../lib/image-vector-shared"

interface BrowserVectorEngine { initialize(): Promise<void>; vectorize_rgba(data: Uint8Array, width: number, height: number, options: ReturnType<typeof vectorEngineOptions>): string }
const scope = self as unknown as { location: Location; onmessage: ((event: MessageEvent<VectorWorkerRequest>) => void) | null; postMessage: (message: VectorWorkerResponse) => void }
scope.onmessage = async ({ data }) => {
  let bitmap: ImageBitmap | undefined
  try {
    const start = performance.now(), options = vectorOptions(data.options)
    const progress = (stage: VectorStage) => scope.postMessage({ type: "progress", stage })
    if (typeof createImageBitmap !== "function" || typeof OffscreenCanvas === "undefined") throw new ImageVectorError("unsupported")
    if (!data.file || data.file.size < 1 || data.file.size > VECTOR_LIMITS.fileBytes) throw new ImageVectorError("fileLimit")
    progress("reading")
    const bytes = new Uint8Array(await data.file.arrayBuffer()), header = rasterHeader(bytes)
    progress("decoding")
    try { bitmap = await createImageBitmap(new Blob([bytes], { type: header.mime })) } catch { throw new ImageVectorError("decode") }
    const sourceWidth = bitmap.width, sourceHeight = bitmap.height
    const { width, height } = traceDimensions(sourceWidth, sourceHeight, options.maxEdge)
    const canvas = new OffscreenCanvas(width, height), context = canvas.getContext("2d", { willReadFrequently: true })
    if (!context) throw new ImageVectorError("unsupported")
    context.drawImage(bitmap, 0, 0, width, height)
    bitmap.close(); bitmap = undefined
    progress("preparing")
    const { rgba, semiTransparentPixels } = prepareVectorPixels(context.getImageData(0, 0, width, height).data, width, height, options)
    canvas.width = canvas.height = 1
    const engine: BrowserVectorEngine = await import(/* webpackIgnore: true */ new URL(VECTOR_RUNTIME_PATH, scope.location.origin).href)
    await engine.initialize()
    progress("tracing")
    const raw = engine.vectorize_rgba(rgba, width, height, vectorEngineOptions(options))
    progress("finishing")
    const result = finishVectorSvg(raw, width, height, sourceWidth, sourceHeight)
    scope.postMessage({ type: "done", svg: result.svg, info: { sourceWidth, sourceHeight, width, height, paths: result.paths, bytes: result.bytes, elapsedMs: Math.round(performance.now() - start), semiTransparentPixels, animated: header.animated } })
  } catch (error) { scope.postMessage({ type: "error", code: error instanceof ImageVectorError ? error.code : "engine" }) }
  finally { bitmap?.close() }
}
