export interface RgbaFrame {
  data: Uint8Array | Uint8ClampedArray
  width: number
  height: number
}

interface IndexedFrame {
  palette: Uint8Array
  pixels: Uint8Array
  transparentIndex?: number
}

interface HistogramColor {
  key: number
  count: number
  red: number
  green: number
  blue: number
}

interface ColorBox {
  colors: HistogramColor[]
  count: number
  redTotal: number
  greenTotal: number
  blueTotal: number
  score: number
  splitChannel: "red" | "green" | "blue"
}

const MAX_GIF_DIMENSION = 0xffff
const COLOR_TABLE_SIZE = 256
const TRANSPARENCY_THRESHOLD = 128
const HISTOGRAM_CHANNEL_BITS = 5
const HISTOGRAM_CHANNEL_SHIFT = 8 - HISTOGRAM_CHANNEL_BITS
const HISTOGRAM_SIZE = 1 << (HISTOGRAM_CHANNEL_BITS * 3)

class ByteBuffer {
  private bytes: Uint8Array
  private used = 0

  constructor(initialCapacity = 1024) {
    this.bytes = new Uint8Array(Math.max(16, initialCapacity))
  }

  get length(): number {
    return this.used
  }

  push(value: number): void {
    this.ensureCapacity(this.used + 1)
    this.bytes[this.used] = value
    this.used += 1
  }

  append(values: ArrayLike<number>): void {
    this.ensureCapacity(this.used + values.length)
    this.bytes.set(values, this.used)
    this.used += values.length
  }

  finish(): Uint8Array {
    return this.bytes.slice(0, this.used)
  }

  private ensureCapacity(required: number): void {
    if (required <= this.bytes.length) return

    let capacity = this.bytes.length
    while (capacity < required) capacity *= 2
    const next = new Uint8Array(capacity)
    next.set(this.bytes.subarray(0, this.used))
    this.bytes = next
  }
}

function writeUint16(buffer: ByteBuffer, value: number): void {
  buffer.push(value & 0xff)
  buffer.push((value >>> 8) & 0xff)
}

function colorKey(red: number, green: number, blue: number): number {
  return (red << 16) | (green << 8) | blue
}

function writePaletteColor(palette: Uint8Array, index: number, key: number): void {
  const offset = index * 3
  palette[offset] = (key >>> 16) & 0xff
  palette[offset + 1] = (key >>> 8) & 0xff
  palette[offset + 2] = key & 0xff
}

function histogramKey(red: number, green: number, blue: number): number {
  return (
    ((red >>> HISTOGRAM_CHANNEL_SHIFT) << (HISTOGRAM_CHANNEL_BITS * 2)) |
    ((green >>> HISTOGRAM_CHANNEL_SHIFT) << HISTOGRAM_CHANNEL_BITS) |
    (blue >>> HISTOGRAM_CHANNEL_SHIFT)
  )
}

function buildHistogram(frame: RgbaFrame, pixelCount: number): HistogramColor[] {
  const counts = new Float64Array(HISTOGRAM_SIZE)
  const redTotals = new Float64Array(HISTOGRAM_SIZE)
  const greenTotals = new Float64Array(HISTOGRAM_SIZE)
  const blueTotals = new Float64Array(HISTOGRAM_SIZE)

  for (let pixel = 0; pixel < pixelCount; pixel += 1) {
    const offset = pixel * 4
    if (frame.data[offset + 3] < TRANSPARENCY_THRESHOLD) continue

    const red = frame.data[offset]
    const green = frame.data[offset + 1]
    const blue = frame.data[offset + 2]
    const key = histogramKey(red, green, blue)
    counts[key] += 1
    redTotals[key] += red
    greenTotals[key] += green
    blueTotals[key] += blue
  }

  const colors: HistogramColor[] = []
  for (let key = 0; key < HISTOGRAM_SIZE; key += 1) {
    const count = counts[key]
    if (count === 0) continue
    colors.push({
      key,
      count,
      red: redTotals[key] / count,
      green: greenTotals[key] / count,
      blue: blueTotals[key] / count,
    })
  }
  return colors
}

function createColorBox(colors: HistogramColor[]): ColorBox {
  let count = 0
  let redTotal = 0
  let greenTotal = 0
  let blueTotal = 0

  for (const color of colors) {
    count += color.count
    redTotal += color.red * color.count
    greenTotal += color.green * color.count
    blueTotal += color.blue * color.count
  }

  const redAverage = redTotal / count
  const greenAverage = greenTotal / count
  const blueAverage = blueTotal / count
  let redError = 0
  let greenError = 0
  let blueError = 0

  for (const color of colors) {
    redError += color.count * (color.red - redAverage) ** 2
    greenError += color.count * (color.green - greenAverage) ** 2
    blueError += color.count * (color.blue - blueAverage) ** 2
  }

  const splitChannel = redError >= greenError && redError >= blueError
    ? "red"
    : greenError >= blueError
      ? "green"
      : "blue"

  return {
    colors,
    count,
    redTotal,
    greenTotal,
    blueTotal,
    score: redError + greenError + blueError,
    splitChannel,
  }
}

function splitColorBox(box: ColorBox): [ColorBox, ColorBox] {
  const channel = box.splitChannel
  const colors = [...box.colors].sort((left, right) => (
    left[channel] - right[channel] || left.key - right.key
  ))
  const midpoint = box.count / 2
  let accumulated = 0
  let splitIndex = colors.length - 1

  for (let index = 0; index < colors.length - 1; index += 1) {
    accumulated += colors[index].count
    if (accumulated >= midpoint) {
      splitIndex = index + 1
      break
    }
  }

  return [
    createColorBox(colors.slice(0, splitIndex)),
    createColorBox(colors.slice(splitIndex)),
  ]
}

function quantizeHistogram(colors: HistogramColor[], colorLimit: number): ColorBox[] {
  if (colors.length === 0) return []

  const boxes = [createColorBox(colors)]
  while (boxes.length < colorLimit) {
    let candidateIndex = -1
    let candidateScore = -1

    for (let index = 0; index < boxes.length; index += 1) {
      const box = boxes[index]
      if (box.colors.length < 2) continue
      if (box.score > candidateScore) {
        candidateIndex = index
        candidateScore = box.score
      }
    }

    if (candidateIndex < 0) break
    const [left, right] = splitColorBox(boxes[candidateIndex])
    boxes.splice(candidateIndex, 1, left, right)
  }
  return boxes
}

function buildAdaptivePalette(
  frame: RgbaFrame,
  pixelCount: number,
  palette: Uint8Array,
  pixels: Uint8Array,
  hasTransparency: boolean,
): void {
  const colorLimit = hasTransparency ? COLOR_TABLE_SIZE - 1 : COLOR_TABLE_SIZE
  const boxes = quantizeHistogram(buildHistogram(frame, pixelCount), colorLimit)
  const paletteOffset = hasTransparency ? 1 : 0
  const histogramIndexes = new Uint8Array(HISTOGRAM_SIZE)

  for (let boxIndex = 0; boxIndex < boxes.length; boxIndex += 1) {
    const box = boxes[boxIndex]
    const paletteIndex = paletteOffset + boxIndex
    const offset = paletteIndex * 3
    palette[offset] = Math.round(box.redTotal / box.count)
    palette[offset + 1] = Math.round(box.greenTotal / box.count)
    palette[offset + 2] = Math.round(box.blueTotal / box.count)
    for (const color of box.colors) histogramIndexes[color.key] = paletteIndex
  }

  for (let pixel = 0; pixel < pixelCount; pixel += 1) {
    const offset = pixel * 4
    if (hasTransparency && frame.data[offset + 3] < TRANSPARENCY_THRESHOLD) {
      pixels[pixel] = 0
      continue
    }
    pixels[pixel] = histogramIndexes[histogramKey(
      frame.data[offset],
      frame.data[offset + 1],
      frame.data[offset + 2],
    )]
  }
}

function buildIndexedFrame(frame: RgbaFrame): IndexedFrame {
  const pixelCount = frame.width * frame.height
  const exactColors = new Map<number, number>()
  let hasTransparency = false

  for (let pixel = 0; pixel < pixelCount; pixel += 1) {
    const offset = pixel * 4
    if (frame.data[offset + 3] < TRANSPARENCY_THRESHOLD) {
      hasTransparency = true
      continue
    }

    if (exactColors.size <= COLOR_TABLE_SIZE) {
      const key = colorKey(frame.data[offset], frame.data[offset + 1], frame.data[offset + 2])
      if (!exactColors.has(key)) exactColors.set(key, exactColors.size)
    }
  }

  const palette = new Uint8Array(COLOR_TABLE_SIZE * 3)
  const pixels = new Uint8Array(pixelCount)
  const exactColorLimit = hasTransparency ? COLOR_TABLE_SIZE - 1 : COLOR_TABLE_SIZE

  if (exactColors.size <= exactColorLimit) {
    const colorIndexes = new Map<number, number>()
    let nextIndex = hasTransparency ? 1 : 0
    for (const key of exactColors.keys()) {
      colorIndexes.set(key, nextIndex)
      writePaletteColor(palette, nextIndex, key)
      nextIndex += 1
    }

    for (let pixel = 0; pixel < pixelCount; pixel += 1) {
      const offset = pixel * 4
      if (hasTransparency && frame.data[offset + 3] < TRANSPARENCY_THRESHOLD) {
        pixels[pixel] = 0
        continue
      }

      const key = colorKey(frame.data[offset], frame.data[offset + 1], frame.data[offset + 2])
      pixels[pixel] = colorIndexes.get(key) ?? 0
    }
  } else {
    buildAdaptivePalette(frame, pixelCount, palette, pixels, hasTransparency)
  }

  return {
    palette,
    pixels,
    transparentIndex: hasTransparency ? 0 : undefined,
  }
}

function encodeLzw(pixels: Uint8Array): Uint8Array {
  const minimumCodeSize = 8
  const clearCode = 1 << minimumCodeSize
  const endCode = clearCode + 1
  const dictionary = new Map<number, number>()
  const output = new ByteBuffer(Math.max(256, Math.ceil(pixels.length * 0.75)))
  let codeSize = minimumCodeSize + 1
  let nextCode = endCode + 1
  let bitBuffer = 0
  let bitCount = 0

  const writeCode = (code: number) => {
    bitBuffer |= code << bitCount
    bitCount += codeSize

    while (bitCount >= 8) {
      output.push(bitBuffer & 0xff)
      bitBuffer >>>= 8
      bitCount -= 8
    }
  }

  const writeDataCode = (code: number) => {
    writeCode(code)
    // The decoder adds the previous dictionary entry after reading this code,
    // so the wider code size applies to the following code.
    if (codeSize < 12 && nextCode === (1 << codeSize)) codeSize += 1
  }

  writeCode(clearCode)
  let prefix = pixels[0]

  for (let index = 1; index < pixels.length; index += 1) {
    const suffix = pixels[index]
    const key = (prefix << 8) | suffix
    const existingCode = dictionary.get(key)

    if (existingCode !== undefined) {
      prefix = existingCode
      continue
    }

    writeDataCode(prefix)

    if (nextCode < 4096) {
      dictionary.set(key, nextCode)
      nextCode += 1
    } else {
      writeCode(clearCode)
      dictionary.clear()
      codeSize = minimumCodeSize + 1
      nextCode = endCode + 1
    }

    prefix = suffix
  }

  writeDataCode(prefix)
  writeCode(endCode)
  if (bitCount > 0) output.push(bitBuffer & 0xff)
  return output.finish()
}

/** Encode RGBA pixels as a standards-compliant, non-animated GIF89a image. */
export function encodeSingleFrameGif(frame: RgbaFrame): Uint8Array {
  if (
    !Number.isInteger(frame.width) ||
    !Number.isInteger(frame.height) ||
    frame.width < 1 ||
    frame.height < 1 ||
    frame.width > MAX_GIF_DIMENSION ||
    frame.height > MAX_GIF_DIMENSION
  ) {
    throw new Error("INVALID_GIF_DIMENSIONS")
  }

  const pixelCount = frame.width * frame.height
  if (!Number.isSafeInteger(pixelCount) || frame.data.length < pixelCount * 4) {
    throw new Error("INVALID_GIF_PIXEL_DATA")
  }

  const indexed = buildIndexedFrame(frame)
  const imageData = encodeLzw(indexed.pixels)
  const output = new ByteBuffer(6 + 7 + indexed.palette.length + imageData.length)

  output.append([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]) // GIF89a
  writeUint16(output, frame.width)
  writeUint16(output, frame.height)
  output.push(0xf7) // Global color table, 8-bit color resolution, 256 entries
  output.push(0x00) // Background color index
  output.push(0x00) // Pixel aspect ratio
  output.append(indexed.palette)

  if (indexed.transparentIndex !== undefined) {
    output.append([
      0x21, 0xf9, 0x04, 0x01,
      0x00, 0x00,
      indexed.transparentIndex,
      0x00,
    ])
  }

  output.push(0x2c) // Image descriptor
  writeUint16(output, 0)
  writeUint16(output, 0)
  writeUint16(output, frame.width)
  writeUint16(output, frame.height)
  output.push(0x00) // Use the global palette; no interlacing
  output.push(0x08) // LZW minimum code size

  for (let offset = 0; offset < imageData.length; offset += 255) {
    const block = imageData.subarray(offset, offset + 255)
    output.push(block.length)
    output.append(block)
  }
  output.push(0x00) // Image data terminator
  output.push(0x3b) // GIF trailer

  return output.finish()
}
