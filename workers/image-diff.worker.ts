import { checkOcrDimensions, OCR_LIMITS, OcrError, ocrImageHeader } from "../lib/ocr-shared"
import { compareImagePixels, IMAGE_DIFF_LIMITS, type ImageDiffRequest, type ImageDiffStage } from "../lib/image-diff-shared"

const scope = self as unknown as { onmessage: ((event: MessageEvent<ImageDiffRequest>) => void) | null; postMessage(value: unknown): void }
const progress = (stage: ImageDiffStage) => scope.postMessage({ stage })
async function decode(file: File) {
  if (!file?.size || file.size > OCR_LIMITS.fileBytes) throw new OcrError("fileLimit")
  const header = ocrImageHeader(new Uint8Array(await file.arrayBuffer())); checkOcrDimensions(header.width, header.height)
  let bitmap: ImageBitmap | undefined, canvas: OffscreenCanvas | undefined
  try {
    try { bitmap = await createImageBitmap(file, { imageOrientation: "from-image" }) } catch { throw new OcrError("decode") }
    const { width, height } = bitmap; checkOcrDimensions(width, height)
    canvas = new OffscreenCanvas(width, height); const ctx = canvas.getContext("2d", { willReadFrequently: true }); if (!ctx) throw new OcrError("unsupported")
    ctx.drawImage(bitmap, 0, 0)
    return { width, height, data: ctx.getImageData(0, 0, width, height).data, animated: header.animated }
  } finally { bitmap?.close(); if (canvas) canvas.width = canvas.height = 1 }
}
async function preview(canvas: OffscreenCanvas) {
  const scale = Math.min(1, 1800 / Math.max(canvas.width, canvas.height)), thumb = new OffscreenCanvas(Math.max(1, Math.round(canvas.width * scale)), Math.max(1, Math.round(canvas.height * scale)))
  try { thumb.getContext("2d")!.drawImage(canvas, 0, 0, thumb.width, thumb.height); return await thumb.convertToBlob({ type: "image/png" }) } finally { thumb.width = thumb.height = 1 }
}
scope.onmessage = async ({ data }) => {
  let canvas: OffscreenCanvas | undefined
  try {
    if (data.action === "prepare") {
      const source = await decode(data.file); canvas = new OffscreenCanvas(source.width, source.height)
      canvas.getContext("2d")!.putImageData(new ImageData(source.data, source.width, source.height), 0, 0)
      scope.postMessage({ response: { source: { width: source.width, height: source.height, animated: source.animated, preview: await preview(canvas) } } })
    } else if (data.action === "compare") {
      progress("readingA"); const a = await decode(data.a); progress("readingB"); const b = await decode(data.b)
      progress("comparing"); const { pixels, layout, stats } = compareImagePixels(a, b, data.options)
      progress("encoding"); canvas = new OffscreenCanvas(layout.width, layout.height); canvas.getContext("2d")!.putImageData(new ImageData(pixels, layout.width, layout.height), 0, 0)
      const output = await canvas.convertToBlob({ type: "image/png" }); if (output.size > IMAGE_DIFF_LIMITS.outputBytes) throw new OcrError("outputLimit")
      scope.postMessage({ response: { result: { layout, stats, output, preview: await preview(canvas) } } })
    } else throw new OcrError("options")
  } catch (error) { scope.postMessage({ error: error instanceof OcrError ? error.code : "engine" }) }
  finally { if (canvas) canvas.width = canvas.height = 1 }
}
scope.postMessage({ ready: true })
