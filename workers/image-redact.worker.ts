import { OCR_LIMITS, OcrError, checkOcrDimensions, ocrImageHeader } from "../lib/ocr-shared"
import { REDACT_LIMITS, redactRect, type RedactRequest, type RedactResult } from "../lib/image-redact-shared"

const scope = self as unknown as { onmessage: ((event: MessageEvent<RedactRequest>) => void) | null; postMessage(value: unknown): void }
scope.onmessage = async ({ data }) => {
  let bitmap: ImageBitmap | undefined, canvas: OffscreenCanvas | undefined, thumb: OffscreenCanvas | undefined
  try {
    if (typeof createImageBitmap !== "function" || typeof OffscreenCanvas === "undefined") throw new OcrError("unsupported")
    if (!data.file?.size || data.file.size > OCR_LIMITS.fileBytes) throw new OcrError("fileLimit")
    const header = ocrImageHeader(new Uint8Array(await data.file.arrayBuffer()))
    checkOcrDimensions(header.width, header.height)
    try { bitmap = await createImageBitmap(data.file, { imageOrientation: "from-image" }) } catch { throw new OcrError("decode") }
    const { width, height } = bitmap; checkOcrDimensions(width, height)
    canvas = new OffscreenCanvas(width, height)
    const ctx = canvas.getContext("2d")
    if (!ctx) throw new OcrError("unsupported")
    if (data.action === "render" && data.format === "jpeg") { ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, width, height) }
    ctx.drawImage(bitmap, 0, 0); bitmap.close(); bitmap = undefined
    let output: File | undefined
    if (data.action === "render") {
      if (width !== data.width || height !== data.height || !["black", "white"].includes(data.color) || !["png", "jpeg"].includes(data.format) || !Array.isArray(data.regions) || !data.regions.length || data.regions.length > REDACT_LIMITS.regions) throw new OcrError("options")
      ctx.fillStyle = data.color === "black" ? "#000000" : "#ffffff"
      for (const region of data.regions) { const r = redactRect(region, width, height); ctx.fillRect(r.x, r.y, r.width, r.height) }
      const blob = await canvas.convertToBlob({ type: `image/${data.format}`, quality: 0.95 })
      if (!blob.size || blob.size > REDACT_LIMITS.outputBytes) throw new OcrError("outputLimit")
      if (blob.type !== `image/${data.format}`) throw new OcrError("unsupported")
      const name = data.file.name.replace(/\.[^.]*$/, "").replace(/[\\/\u0000-\u001f]/g, "_").slice(0, 100) || "image"
      output = new File([blob], `${name}-redacted.${data.format === "jpeg" ? "jpg" : "png"}`, { type: blob.type })
    } else if (data.action !== "prepare") throw new OcrError("options")
    const scale = Math.min(1, 2000 / Math.max(width, height))
    thumb = new OffscreenCanvas(Math.max(1, Math.round(width * scale)), Math.max(1, Math.round(height * scale)))
    thumb.getContext("2d")!.drawImage(canvas, 0, 0, thumb.width, thumb.height)
    const preview = await thumb.convertToBlob({ type: "image/png" })
    scope.postMessage({ result: { width, height, animated: header.animated, preview, output } satisfies RedactResult })
  } catch (error) { scope.postMessage({ error: error instanceof OcrError ? error.code : "engine" }) }
  finally { bitmap?.close(); if (canvas) canvas.width = canvas.height = 1; if (thumb) thumb.width = thumb.height = 1 }
}
scope.postMessage({ ready: true })
