export type ImageOutputFormat = "jpeg" | "png" | "webp" | "avif"

export interface ImageConvertOptions {
  format: ImageOutputFormat
  quality: number
  maxWidth?: number
  maxHeight?: number
}

export interface ImageConvertResult {
  file: File
  width: number
  height: number
  originalWidth: number
  originalHeight: number
  mimeType: string
}

const MIME_TYPES: Record<ImageOutputFormat, string> = {
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  avif: "image/avif",
}

function calculateDimensions(width: number, height: number, maxWidth?: number, maxHeight?: number) {
  const widthScale = maxWidth && maxWidth > 0 ? maxWidth / width : 1
  const heightScale = maxHeight && maxHeight > 0 ? maxHeight / height : 1
  const scale = Math.min(1, widthScale, heightScale)
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}

async function canvasToBlob(
  source: CanvasImageSource,
  width: number,
  height: number,
  mimeType: string,
  quality: number,
): Promise<Blob> {
  if (typeof OffscreenCanvas !== "undefined") {
    const canvas = new OffscreenCanvas(width, height)
    const context = canvas.getContext("2d")
    if (!context) throw new Error("CANVAS_UNAVAILABLE")
    if (mimeType === "image/jpeg") {
      context.fillStyle = "#ffffff"
      context.fillRect(0, 0, width, height)
    }
    context.drawImage(source, 0, 0, width, height)
    return canvas.convertToBlob({ type: mimeType, quality })
  }

  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext("2d")
  if (!context) throw new Error("CANVAS_UNAVAILABLE")
  if (mimeType === "image/jpeg") {
    context.fillStyle = "#ffffff"
    context.fillRect(0, 0, width, height)
  }
  context.drawImage(source, 0, 0, width, height)
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, mimeType, quality))
  if (!blob) throw new Error("CONVERSION_FAILED")
  return blob
}

export async function convertImageFile(file: File, options: ImageConvertOptions): Promise<ImageConvertResult> {
  if (!file.type.startsWith("image/")) throw new Error("INVALID_IMAGE")
  if (typeof createImageBitmap === "undefined") throw new Error("IMAGE_DECODER_UNAVAILABLE")

  const bitmap = await createImageBitmap(file)
  try {
    const dimensions = calculateDimensions(bitmap.width, bitmap.height, options.maxWidth, options.maxHeight)
    const mimeType = MIME_TYPES[options.format]
    const quality = Math.min(1, Math.max(0.1, options.quality))
    const blob = await canvasToBlob(bitmap, dimensions.width, dimensions.height, mimeType, quality)
    if (blob.type && blob.type !== mimeType) throw new Error("FORMAT_NOT_SUPPORTED")

    const baseName = file.name.replace(/\.[^.]+$/, "") || "image"
    const extension = options.format === "jpeg" ? "jpg" : options.format
    return {
      file: new File([blob], `${baseName}.${extension}`, { type: mimeType }),
      width: dimensions.width,
      height: dimensions.height,
      originalWidth: bitmap.width,
      originalHeight: bitmap.height,
      mimeType,
    }
  } finally {
    bitmap.close()
  }
}
