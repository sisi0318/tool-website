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

const MAX_GIF_DIMENSION = 0xffff
const COLOR_TABLE_SIZE = 256
const TRANSPARENCY_THRESHOLD = 128

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

function quantizeChannel(value: number, levels: number): number {
  return Math.min(levels - 1, Math.round((value * (levels - 1)) / 255))
}

function channelValue(level: number, levels: number): number {
  return Math.round((level * 255) / (levels - 1))
}

function buildFixedPalette(palette: Uint8Array, hasTransparency: boolean): void {
  if (hasTransparency) {
    // Reserve index 0 for transparency and use a 6 x 7 x 6 RGB cube (252 colors).
    for (let red = 0; red < 6; red += 1) {
      for (let green = 0; green < 7; green += 1) {
        for (let blue = 0; blue < 6; blue += 1) {
          const index = 1 + (red * 7 + green) * 6 + blue
          const offset = index * 3
          palette[offset] = channelValue(red, 6)
          palette[offset + 1] = channelValue(green, 7)
          palette[offset + 2] = channelValue(blue, 6)
        }
      }
    }
    return
  }

  // A 3-3-2 RGB palette fills all 256 available GIF color entries.
  for (let red = 0; red < 8; red += 1) {
    for (let green = 0; green < 8; green += 1) {
      for (let blue = 0; blue < 4; blue += 1) {
        const index = (red * 8 + green) * 4 + blue
        const offset = index * 3
        palette[offset] = channelValue(red, 8)
        palette[offset + 1] = channelValue(green, 8)
        palette[offset + 2] = channelValue(blue, 4)
      }
    }
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
    buildFixedPalette(palette, hasTransparency)

    for (let pixel = 0; pixel < pixelCount; pixel += 1) {
      const offset = pixel * 4
      if (hasTransparency && frame.data[offset + 3] < TRANSPARENCY_THRESHOLD) {
        pixels[pixel] = 0
        continue
      }

      if (hasTransparency) {
        const red = quantizeChannel(frame.data[offset], 6)
        const green = quantizeChannel(frame.data[offset + 1], 7)
        const blue = quantizeChannel(frame.data[offset + 2], 6)
        pixels[pixel] = 1 + (red * 7 + green) * 6 + blue
      } else {
        const red = quantizeChannel(frame.data[offset], 8)
        const green = quantizeChannel(frame.data[offset + 1], 8)
        const blue = quantizeChannel(frame.data[offset + 2], 4)
        pixels[pixel] = (red * 8 + green) * 4 + blue
      }
    }
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
