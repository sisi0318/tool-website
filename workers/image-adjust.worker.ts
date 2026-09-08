import { adjustImagePixels, IMAGE_ADJUST_LIMITS, type ImageAdjustOptions } from "../lib/image-adjust-shared"
const scope = self as unknown as { onmessage: ((event: MessageEvent<{ file: File; options: ImageAdjustOptions }>) => void) | null; postMessage(value: unknown): void }
scope.onmessage = async ({ data }) => {
  let bitmap: ImageBitmap | undefined, canvas: OffscreenCanvas | undefined
  try {
    if (!data.file?.size || data.file.size > IMAGE_ADJUST_LIMITS.bytes) throw new Error("Image must be nonempty and at most 20 MB")
    bitmap = await createImageBitmap(data.file, { imageOrientation: "from-image" })
    if (bitmap.width * bitmap.height > IMAGE_ADJUST_LIMITS.pixels || bitmap.width > IMAGE_ADJUST_LIMITS.side || bitmap.height > IMAGE_ADJUST_LIMITS.side) throw new Error("Image exceeds 20 million pixels or a 32768-pixel side")
    canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
    const context = canvas.getContext("2d", { willReadFrequently: true }); if (!context) throw new Error("Image editing is not supported")
    context.drawImage(bitmap, 0, 0); bitmap.close(); bitmap = undefined
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height); adjustImagePixels(pixels.data, data.options); context.putImageData(pixels, 0, 0)
    const blob = await canvas.convertToBlob({ type: "image/png" }); if (blob.size > IMAGE_ADJUST_LIMITS.outputBytes) throw new Error("Edited image exceeds 64 MB")
    const base = data.file.name.replace(/\.[^.]+$/, "").replace(/[\\/\u0000-\u001f]/g, "_").slice(0, 100) || "image"
    scope.postMessage({ file: new File([blob], `${base}-edited.png`, { type: blob.type }) })
  } catch (error) { scope.postMessage({ error: error instanceof Error ? error.message : "Image editing failed" }) }
  finally { bitmap?.close(); if (canvas) canvas.width = canvas.height = 1 }
}
scope.postMessage({ ready: true })
