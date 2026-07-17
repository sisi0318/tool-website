export type ImageCoordinateFormat = "pixel" | "percent" | "permille" | "permyriad"

export interface ImageCoordinate {
  x: number
  y: number
  pixelX: number
  pixelY: number
}

export interface ImageDimensions {
  width: number
  height: number
}

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.max(minimum, Math.min(value, maximum))

const percentToPixel = (percent: number, size: number) =>
  clamp(Math.floor((percent / 100) * size), 0, size - 1)

const pixelToPercent = (pixel: number, size: number) =>
  size > 1 ? (pixel / (size - 1)) * 100 : 0

export function coordinateFromRelativePosition(
  offsetX: number,
  offsetY: number,
  displayWidth: number,
  displayHeight: number,
  imageSize: ImageDimensions,
): ImageCoordinate | null {
  if (
    displayWidth <= 0 ||
    displayHeight <= 0 ||
    imageSize.width <= 0 ||
    imageSize.height <= 0
  ) {
    return null
  }

  const x = clamp(offsetX, 0, displayWidth)
  const y = clamp(offsetY, 0, displayHeight)
  const percentX = (x / displayWidth) * 100
  const percentY = (y / displayHeight) * 100

  return {
    x: percentX,
    y: percentY,
    pixelX: percentToPixel(percentX, imageSize.width),
    pixelY: percentToPixel(percentY, imageSize.height),
  }
}

export function coordinateFromManualInput(
  inputX: number,
  inputY: number,
  format: ImageCoordinateFormat,
  imageSize: ImageDimensions,
): ImageCoordinate | null {
  if (
    !Number.isFinite(inputX) ||
    !Number.isFinite(inputY) ||
    imageSize.width <= 0 ||
    imageSize.height <= 0
  ) {
    return null
  }

  if (format === "pixel") {
    const pixelX = clamp(Math.round(inputX), 0, imageSize.width - 1)
    const pixelY = clamp(Math.round(inputY), 0, imageSize.height - 1)
    return {
      x: pixelToPercent(pixelX, imageSize.width),
      y: pixelToPercent(pixelY, imageSize.height),
      pixelX,
      pixelY,
    }
  }

  const divisor = format === "permille" ? 10 : format === "permyriad" ? 100 : 1
  const percentX = clamp(inputX / divisor, 0, 100)
  const percentY = clamp(inputY / divisor, 0, 100)
  return {
    x: percentX,
    y: percentY,
    pixelX: percentToPixel(percentX, imageSize.width),
    pixelY: percentToPixel(percentY, imageSize.height),
  }
}
