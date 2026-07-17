export interface MemeImageData {
  data: Uint8ClampedArray
  width: number
  height: number
}

export interface MemeBounds {
  left: number
  top: number
  width: number
  height: number
}

export interface MemeGridCell {
  x: number
  y: number
  width: number
  height: number
  index: number
}

export interface MemeGridLayout {
  cells: MemeGridCell[]
  horizontal: number[]
  vertical: number[]
}

export interface MemeGridDetection {
  bounds: MemeBounds
  rows: number
  cols: number
  background: { red: number; green: number; blue: number; alpha: number }
  score: number
}

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value))

function histogramMedian(histogram: Uint32Array, sampleCount: number): number {
  const midpoint = Math.max(0, Math.floor(sampleCount / 2))
  let seen = 0

  for (let value = 0; value < histogram.length; value += 1) {
    seen += histogram[value]
    if (seen > midpoint) return value
  }

  return 0
}

function estimateBackground(source: MemeImageData) {
  const red = new Uint32Array(256)
  const green = new Uint32Array(256)
  const blue = new Uint32Array(256)
  const alpha = new Uint32Array(256)
  const sampleWidth = Math.max(1, Math.min(40, Math.round(source.width * 0.08)))
  const sampleHeight = Math.max(1, Math.min(40, Math.round(source.height * 0.08)))
  let sampleCount = 0

  const sample = (x: number, y: number) => {
    const index = (y * source.width + x) * 4
    red[source.data[index]] += 1
    green[source.data[index + 1]] += 1
    blue[source.data[index + 2]] += 1
    alpha[source.data[index + 3]] += 1
    sampleCount += 1
  }

  for (let y = 0; y < sampleHeight; y += 1) {
    for (let x = 0; x < sampleWidth; x += 1) {
      sample(x, y)
      sample(source.width - 1 - x, y)
      sample(x, source.height - 1 - y)
      sample(source.width - 1 - x, source.height - 1 - y)
    }
  }

  return {
    red: histogramMedian(red, sampleCount),
    green: histogramMedian(green, sampleCount),
    blue: histogramMedian(blue, sampleCount),
    alpha: histogramMedian(alpha, sampleCount),
  }
}

function minimumDensityAround(
  densities: Uint32Array,
  position: number,
  radius: number,
  perpendicularLength: number,
): number {
  let minimum = 1
  const start = clamp(Math.round(position) - radius, 0, densities.length - 1)
  const end = clamp(Math.round(position) + radius, 0, densities.length - 1)

  for (let index = start; index <= end; index += 1) {
    minimum = Math.min(minimum, densities[index] / Math.max(1, perpendicularLength))
  }

  return minimum
}

function separatorScore(
  bounds: MemeBounds,
  rows: number,
  cols: number,
  rowDensity: Uint32Array,
  colDensity: Uint32Array,
): number {
  let score = 0
  let separators = 0
  const rowRadius = Math.max(1, Math.round(bounds.height * 0.004))
  const colRadius = Math.max(1, Math.round(bounds.width * 0.004))

  for (let row = 1; row < rows; row += 1) {
    score += minimumDensityAround(
      rowDensity,
      bounds.top + (bounds.height * row) / rows,
      rowRadius,
      bounds.width,
    )
    separators += 1
  }

  for (let col = 1; col < cols; col += 1) {
    score += minimumDensityAround(
      colDensity,
      bounds.left + (bounds.width * col) / cols,
      colRadius,
      bounds.height,
    )
    separators += 1
  }

  return separators > 0 ? score / separators : 1
}

function commonGridBonus(rows: number, cols: number): number {
  const key = `${rows}x${cols}`
  if (["4x6", "6x4"].includes(key)) return 0.12
  if (["3x4", "4x3", "3x3", "4x4"].includes(key)) return 0.09
  if (["4x5", "5x4", "2x4", "4x2"].includes(key)) return 0.05
  return 0
}

export function analyzeMemeGrid(
  source: MemeImageData,
  sensitivity = 50,
): MemeGridDetection {
  if (
    !Number.isInteger(source.width) ||
    !Number.isInteger(source.height) ||
    source.width <= 0 ||
    source.height <= 0 ||
    source.data.length < source.width * source.height * 4
  ) {
    throw new Error("invalid-image-data")
  }

  const background = estimateBackground(source)
  const colDensity = new Uint32Array(source.width)
  const rowDensity = new Uint32Array(source.height)
  const colorThreshold = 24 + (100 - clamp(sensitivity, 0, 100)) * 0.45

  for (let y = 0; y < source.height; y += 1) {
    for (let x = 0; x < source.width; x += 1) {
      const index = (y * source.width + x) * 4
      const alpha = source.data[index + 3]
      const distance =
        Math.abs(source.data[index] - background.red) +
        Math.abs(source.data[index + 1] - background.green) +
        Math.abs(source.data[index + 2] - background.blue)

      const alphaDistance = Math.abs(alpha - background.alpha)
      if (alpha >= 16 && (distance >= colorThreshold || alphaDistance >= 48)) {
        rowDensity[y] += 1
        colDensity[x] += 1
      }
    }
  }

  const minimumColumnContent = Math.max(1, source.height * 0.01)
  const minimumRowContent = Math.max(1, source.width * 0.01)
  let left = 0
  let right = source.width - 1
  let top = 0
  let bottom = source.height - 1
  let foundColumn = false
  let foundRow = false

  for (let x = 0; x < source.width; x += 1) {
    if (colDensity[x] >= minimumColumnContent) {
      left = x
      foundColumn = true
      break
    }
  }
  for (let x = source.width - 1; x >= 0; x -= 1) {
    if (colDensity[x] >= minimumColumnContent) {
      right = x
      break
    }
  }
  for (let y = 0; y < source.height; y += 1) {
    if (rowDensity[y] >= minimumRowContent) {
      top = y
      foundRow = true
      break
    }
  }
  for (let y = source.height - 1; y >= 0; y -= 1) {
    if (rowDensity[y] >= minimumRowContent) {
      bottom = y
      break
    }
  }

  if (!foundColumn || !foundRow || right < left || bottom < top) {
    left = 0
    top = 0
    right = source.width - 1
    bottom = source.height - 1
  } else {
    const margin = Math.max(1, Math.round(Math.min(source.width, source.height) * 0.004))
    left = Math.max(0, left - margin)
    top = Math.max(0, top - margin)
    right = Math.min(source.width - 1, right + margin)
    bottom = Math.min(source.height - 1, bottom + margin)
  }

  const bounds: MemeBounds = {
    left,
    top,
    width: right - left + 1,
    height: bottom - top + 1,
  }

  const ratio = bounds.width / bounds.height
  let bestRows = ratio >= 1 ? 4 : 6
  let bestCols = ratio >= 1 ? 6 : 4
  let bestScore = Number.POSITIVE_INFINITY
  const maxRows = 8
  const maxCols = 10

  for (let rows = 1; rows <= maxRows; rows += 1) {
    for (let cols = 1; cols <= maxCols; cols += 1) {
      if (rows === 1 && cols === 1) continue
      if (ratio >= 1.15 && cols < rows) continue
      if (ratio <= 0.85 && rows < cols) continue
      if (rows === 1 && ratio < 1.8) continue
      if (cols === 1 && ratio > 0.56) continue

      const cellRatio = bounds.width / cols / (bounds.height / rows)
      if (cellRatio < 0.58 || cellRatio > 1.72) continue

      const squareError = Math.abs(Math.log(cellRatio))
      const gutters = separatorScore(bounds, rows, cols, rowDensity, colDensity)
      const cellCount = rows * cols
      const countPenalty =
        cellCount < 4 ? 0.18 : Math.abs(cellCount - 20) * 0.0025 + Math.max(0, cellCount - 64) * 0.01
      const score =
        gutters * 1.55 +
        squareError * 0.72 +
        countPenalty -
        commonGridBonus(rows, cols)

      if (score < bestScore) {
        bestScore = score
        bestRows = rows
        bestCols = cols
      }
    }
  }

  return {
    bounds,
    rows: bestRows,
    cols: bestCols,
    background,
    score: bestScore,
  }
}

export function createMemeGrid(
  bounds: MemeBounds,
  rows: number,
  cols: number,
  imageWidth: number,
  imageHeight: number,
): MemeGridLayout {
  const safeRows = clamp(Math.round(rows), 1, Math.max(1, Math.floor(imageHeight)))
  const safeCols = clamp(Math.round(cols), 1, Math.max(1, Math.floor(imageWidth)))
  const left = clamp(Math.floor(bounds.left), 0, Math.max(0, imageWidth - 1))
  const top = clamp(Math.floor(bounds.top), 0, Math.max(0, imageHeight - 1))
  const right = clamp(Math.ceil(bounds.left + bounds.width), left + 1, imageWidth)
  const bottom = clamp(Math.ceil(bounds.top + bounds.height), top + 1, imageHeight)
  const width = right - left
  const height = bottom - top
  const horizontal = Array.from(
    { length: safeRows + 1 },
    (_, index) => top + Math.round((height * index) / safeRows),
  )
  const vertical = Array.from(
    { length: safeCols + 1 },
    (_, index) => left + Math.round((width * index) / safeCols),
  )
  const cells: MemeGridCell[] = []

  for (let row = 0; row < safeRows; row += 1) {
    for (let col = 0; col < safeCols; col += 1) {
      cells.push({
        x: vertical[col],
        y: horizontal[row],
        width: vertical[col + 1] - vertical[col],
        height: horizontal[row + 1] - horizontal[row],
        index: cells.length,
      })
    }
  }

  return { cells, horizontal, vertical }
}

export function mapMemeBounds(
  bounds: MemeBounds,
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number,
): MemeBounds {
  const scaleX = targetWidth / sourceWidth
  const scaleY = targetHeight / sourceHeight
  const left = clamp(Math.floor(bounds.left * scaleX), 0, Math.max(0, targetWidth - 1))
  const top = clamp(Math.floor(bounds.top * scaleY), 0, Math.max(0, targetHeight - 1))
  const right = clamp(
    Math.ceil((bounds.left + bounds.width) * scaleX),
    left + 1,
    targetWidth,
  )
  const bottom = clamp(
    Math.ceil((bounds.top + bounds.height) * scaleY),
    top + 1,
    targetHeight,
  )

  return { left, top, width: right - left, height: bottom - top }
}

export function getConstrainedImageSize(
  width: number,
  height: number,
  maximumDimension: number,
  maximumPixels: number,
) {
  const dimensionScale = Math.min(1, maximumDimension / Math.max(width, height))
  const pixelScale = Math.min(1, Math.sqrt(maximumPixels / Math.max(1, width * height)))
  const scale = Math.min(dimensionScale, pixelScale)

  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
    scale,
  }
}

export function safeMemeFileBase(fileName: string): string {
  const withoutExtension = fileName.replace(/\.[^/.]+$/, "")
  const sanitized = withoutExtension
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80)

  return sanitized || "meme"
}
