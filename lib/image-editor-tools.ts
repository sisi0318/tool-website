export interface ImageCropRect {
  x: number
  y: number
  width: number
  height: number
}

export interface ImageEditorState {
  rotation: number
  flipHorizontal: boolean
  flipVertical: boolean
  crop: ImageCropRect | null
  brightness: number
  contrast: number
  saturation: number
  blur: number
  grayscale: boolean
  sepia: boolean
  invert: boolean
}

export interface ImageRenderGeometry {
  crop: ImageCropRect
  rotation: number
  outputWidth: number
  outputHeight: number
}

export const DEFAULT_IMAGE_EDITOR_STATE: ImageEditorState = {
  rotation: 0,
  flipHorizontal: false,
  flipVertical: false,
  crop: null,
  brightness: 100,
  contrast: 100,
  saturation: 100,
  blur: 0,
  grayscale: false,
  sepia: false,
  invert: false,
}

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value))

export function normalizeImageCrop(
  crop: ImageCropRect,
  imageWidth: number,
  imageHeight: number,
): ImageCropRect {
  const firstX = clamp(Math.min(crop.x, crop.x + crop.width), 0, imageWidth)
  const secondX = clamp(Math.max(crop.x, crop.x + crop.width), 0, imageWidth)
  const firstY = clamp(Math.min(crop.y, crop.y + crop.height), 0, imageHeight)
  const secondY = clamp(Math.max(crop.y, crop.y + crop.height), 0, imageHeight)
  const left = Math.min(firstX, Math.max(0, imageWidth - 1))
  const top = Math.min(firstY, Math.max(0, imageHeight - 1))
  const right = Math.max(left + 1, secondX)
  const bottom = Math.max(top + 1, secondY)

  return {
    x: left,
    y: top,
    width: Math.min(imageWidth, right) - left,
    height: Math.min(imageHeight, bottom) - top,
  }
}

export function isFullImageCrop(
  crop: ImageCropRect,
  imageWidth: number,
  imageHeight: number,
): boolean {
  const normalized = normalizeImageCrop(crop, imageWidth, imageHeight)
  return (
    normalized.x <= 0.5 &&
    normalized.y <= 0.5 &&
    Math.abs(normalized.width - imageWidth) <= 0.5 &&
    Math.abs(normalized.height - imageHeight) <= 0.5
  )
}

export function normalizeImageRotation(rotation: number): number {
  const normalized = rotation % 360
  return normalized < 0 ? normalized + 360 : normalized
}

export function getImageRenderGeometry(
  imageWidth: number,
  imageHeight: number,
  state: Pick<ImageEditorState, "rotation" | "crop">,
): ImageRenderGeometry {
  const crop = state.crop
    ? normalizeImageCrop(state.crop, imageWidth, imageHeight)
    : { x: 0, y: 0, width: imageWidth, height: imageHeight }
  const rotation = normalizeImageRotation(state.rotation)
  const radians = (rotation * Math.PI) / 180
  const rawCosine = Math.abs(Math.cos(radians))
  const rawSine = Math.abs(Math.sin(radians))
  const cosine = rawCosine < 1e-10 ? 0 : rawCosine
  const sine = rawSine < 1e-10 ? 0 : rawSine

  return {
    crop,
    rotation,
    outputWidth: Math.max(1, Math.ceil(crop.width * cosine + crop.height * sine - 1e-9)),
    outputHeight: Math.max(1, Math.ceil(crop.width * sine + crop.height * cosine - 1e-9)),
  }
}

export function getImageRenderScale(
  width: number,
  height: number,
  maximumDimension: number,
  maximumPixels: number,
): number {
  const dimensionScale = Math.min(1, maximumDimension / Math.max(width, height))
  const pixelScale = Math.min(1, Math.sqrt(maximumPixels / Math.max(1, width * height)))
  return Math.min(dimensionScale, pixelScale)
}

export function buildImageFilter(state: ImageEditorState): string {
  const filters: string[] = []
  if (state.brightness !== 100) filters.push(`brightness(${state.brightness}%)`)
  if (state.contrast !== 100) filters.push(`contrast(${state.contrast}%)`)
  if (state.saturation !== 100) filters.push(`saturate(${state.saturation}%)`)
  if (state.blur > 0) filters.push(`blur(${state.blur}px)`)
  if (state.grayscale) filters.push("grayscale(100%)")
  if (state.sepia) filters.push("sepia(100%)")
  if (state.invert) filters.push("invert(100%)")
  return filters.length > 0 ? filters.join(" ") : "none"
}

export function safeEditedImageBase(fileName: string): string {
  const withoutExtension = fileName.replace(/\.[^/.]+$/, "")
  const sanitized = withoutExtension
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80)
  return sanitized || "image"
}
