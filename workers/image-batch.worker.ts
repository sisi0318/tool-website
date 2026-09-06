import { convertImageFile } from "../lib/image-convert"
import { batchOptions, ImageBatchError, IMAGE_BATCH_LIMITS, type ImageBatchOptions } from "../lib/image-batch-shared"
import { OCR_LIMITS, checkOcrDimensions, OcrError, ocrImageHeader } from "../lib/ocr-shared"
const scope = self as unknown as { onmessage: ((event: MessageEvent<{ file: File; base: string; options: ImageBatchOptions }>) => void) | null; postMessage(value: unknown): void }
scope.onmessage = async ({ data }) => {
  try {
    const options = batchOptions(data.options)
    if (!data.file.size || data.file.size > OCR_LIMITS.fileBytes) throw new ImageBatchError("fileLimit")
    const header = ocrImageHeader(new Uint8Array(await data.file.arrayBuffer()))
    checkOcrDimensions(header.width, header.height)
    const result = await convertImageFile(new File([data.file], `${data.base}.source`, { type: header.mime }), { format: options.format, quality: options.quality / 100, maxWidth: options.maxWidth || undefined, maxHeight: options.maxHeight || undefined })
    if (result.file.size > IMAGE_BATCH_LIMITS.fileOutputBytes) throw new ImageBatchError("outputLimit")
    scope.postMessage({ result: { files: [result.file], width: result.width, height: result.height, animated: header.animated } })
  } catch (error) { scope.postMessage({ error: error instanceof OcrError ? `ocr:${error.code}` : error instanceof ImageBatchError ? `batch:${error.code}` : `batch:${error instanceof Error && /UNAVAILABLE|NOT_SUPPORTED/.test(error.message) ? "unsupported" : "convert"}` }) }
}
scope.postMessage({ ready: true })
