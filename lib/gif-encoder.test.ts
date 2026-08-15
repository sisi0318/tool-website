import { describe, expect, it } from "vitest"

import { encodeSingleFrameGif } from "./gif-encoder"

interface DecodedGif {
  width: number
  height: number
  palette: Uint8Array
  pixels: Uint8Array
  transparentIndex?: number
}

function readUint16(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8)
}

function decodeLzw(data: Uint8Array, minimumCodeSize: number): Uint8Array {
  const clearCode = 1 << minimumCodeSize
  const endCode = clearCode + 1
  let dictionary: number[][] = []
  let codeSize = minimumCodeSize + 1
  let nextCode = endCode + 1
  let bitOffset = 0
  let previous: number[] | undefined
  const output: number[] = []

  const reset = () => {
    dictionary = Array.from({ length: clearCode }, (_, index) => [index])
    codeSize = minimumCodeSize + 1
    nextCode = endCode + 1
    previous = undefined
  }

  const readCode = (): number | undefined => {
    if (bitOffset + codeSize > data.length * 8) return undefined
    let code = 0
    for (let bit = 0; bit < codeSize; bit += 1) {
      code |= ((data[bitOffset >>> 3] >>> (bitOffset & 7)) & 1) << bit
      bitOffset += 1
    }
    return code
  }

  reset()
  while (true) {
    const code = readCode()
    if (code === undefined) throw new Error("Unexpected end of GIF LZW data")
    if (code === clearCode) {
      reset()
      continue
    }
    if (code === endCode) break

    let entry = dictionary[code]
    if (!entry && code === nextCode && previous) entry = [...previous, previous[0]]
    if (!entry) throw new Error(`Invalid GIF LZW code: ${code}`)
    output.push(...entry)

    if (previous && nextCode < 4096) {
      dictionary[nextCode] = [...previous, entry[0]]
      nextCode += 1
      if (codeSize < 12 && nextCode === (1 << codeSize)) codeSize += 1
    }
    previous = entry
  }

  return Uint8Array.from(output)
}

function decodeSingleFrameGif(bytes: Uint8Array): DecodedGif {
  expect(String.fromCharCode(...bytes.subarray(0, 6))).toBe("GIF89a")
  const width = readUint16(bytes, 6)
  const height = readUint16(bytes, 8)
  const logicalScreenPacked = bytes[10]
  expect(logicalScreenPacked & 0x80).toBe(0x80)

  const globalColorCount = 2 << (logicalScreenPacked & 0x07)
  let offset = 13
  const palette = bytes.slice(offset, offset + globalColorCount * 3)
  offset += globalColorCount * 3
  let transparentIndex: number | undefined

  while (offset < bytes.length) {
    const marker = bytes[offset]
    offset += 1

    if (marker === 0x21) {
      const label = bytes[offset]
      offset += 1
      if (label === 0xf9) {
        const blockSize = bytes[offset]
        offset += 1
        if ((bytes[offset] & 0x01) !== 0) transparentIndex = bytes[offset + 3]
        offset += blockSize
        expect(bytes[offset]).toBe(0)
        offset += 1
        continue
      }

      while (bytes[offset] !== 0) offset += bytes[offset] + 1
      offset += 1
      continue
    }

    if (marker === 0x2c) {
      const imageWidth = readUint16(bytes, offset + 4)
      const imageHeight = readUint16(bytes, offset + 6)
      const imagePacked = bytes[offset + 8]
      expect(imageWidth).toBe(width)
      expect(imageHeight).toBe(height)
      offset += 9

      if ((imagePacked & 0x80) !== 0) {
        const localColorCount = 2 << (imagePacked & 0x07)
        offset += localColorCount * 3
      }

      const minimumCodeSize = bytes[offset]
      offset += 1
      const compressed: number[] = []
      while (bytes[offset] !== 0) {
        const blockSize = bytes[offset]
        offset += 1
        compressed.push(...bytes.subarray(offset, offset + blockSize))
        offset += blockSize
      }
      offset += 1
      expect(bytes[offset]).toBe(0x3b)

      return {
        width,
        height,
        palette,
        pixels: decodeLzw(Uint8Array.from(compressed), minimumCodeSize),
        transparentIndex,
      }
    }

    throw new Error(`Unexpected GIF block marker: ${marker}`)
  }

  throw new Error("GIF image descriptor not found")
}

describe("single-frame GIF encoder", () => {
  it("encodes exact opaque colors into one decodable GIF89a frame", () => {
    const encoded = encodeSingleFrameGif({
      width: 2,
      height: 1,
      data: new Uint8ClampedArray([
        255, 0, 0, 255,
        0, 255, 0, 255,
      ]),
    })
    const decoded = decodeSingleFrameGif(encoded)

    expect(decoded.width).toBe(2)
    expect(decoded.height).toBe(1)
    expect(Array.from(decoded.palette.subarray(0, 6))).toEqual([255, 0, 0, 0, 255, 0])
    expect(Array.from(decoded.pixels)).toEqual([0, 1])
    expect(decoded.transparentIndex).toBeUndefined()
  })

  it("preserves binary transparency with a GIF graphics control extension", () => {
    const decoded = decodeSingleFrameGif(encodeSingleFrameGif({
      width: 2,
      height: 1,
      data: new Uint8ClampedArray([
        10, 20, 30, 0,
        0, 0, 255, 255,
      ]),
    }))

    expect(decoded.transparentIndex).toBe(0)
    expect(Array.from(decoded.palette.subarray(3, 6))).toEqual([0, 0, 255])
    expect(Array.from(decoded.pixels)).toEqual([0, 1])
  })

  it("quantizes images with more than 256 colors", () => {
    const width = 300
    const data = new Uint8ClampedArray(width * 4)
    for (let pixel = 0; pixel < width; pixel += 1) {
      const offset = pixel * 4
      data[offset] = pixel & 0xff
      data[offset + 1] = (pixel >>> 8) & 0xff
      data[offset + 2] = (pixel * 17) & 0xff
      data[offset + 3] = 255
    }

    const decoded = decodeSingleFrameGif(encodeSingleFrameGif({ width, height: 1, data }))
    expect(decoded.pixels).toHaveLength(width)
    expect(Math.max(...decoded.pixels)).toBeLessThan(256)
  })

  it("preserves dominant dark tones instead of shifting them toward purple", () => {
    const width = 1_200
    const data = new Uint8ClampedArray(width * 4)
    for (let pixel = 0; pixel < width; pixel += 1) {
      const offset = pixel * 4
      if (pixel < 900) {
        data[offset] = 62
        data[offset + 1] = 54
        data[offset + 2] = 51
      } else {
        const accent = pixel - 900
        data[offset] = (accent * 47) & 0xff
        data[offset + 1] = (accent * 83) & 0xff
        data[offset + 2] = (accent * 131) & 0xff
      }
      data[offset + 3] = 255
    }

    const decoded = decodeSingleFrameGif(encodeSingleFrameGif({ width, height: 1, data }))
    const paletteOffset = decoded.pixels[0] * 3
    const dominantColor = Array.from(decoded.palette.subarray(paletteOffset, paletteOffset + 3))
    const expectedDominantColor = [62, 54, 51]

    expectedDominantColor.forEach((expected, channel) => {
      expect(Math.abs(dominantColor[channel] - expected)).toBeLessThanOrEqual(4)
    })
    expect(Math.abs(dominantColor[2] - dominantColor[0])).toBeLessThan(16)
  })

  it("keeps LZW code-width growth and dictionary resets decodable", () => {
    const width = 12_000
    const data = new Uint8ClampedArray(width * 4)
    let state = 0x12345678
    for (let pixel = 0; pixel < width; pixel += 1) {
      state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0
      const value = state >>> 24
      const offset = pixel * 4
      data[offset] = value
      data[offset + 1] = value
      data[offset + 2] = value
      data[offset + 3] = 255
    }

    const decoded = decodeSingleFrameGif(encodeSingleFrameGif({ width, height: 1, data }))
    expect(decoded.pixels).toHaveLength(width)
    for (let pixel = 0; pixel < width; pixel += 1) {
      const paletteOffset = decoded.pixels[pixel] * 3
      expect(decoded.palette[paletteOffset]).toBe(data[pixel * 4])
    }
  })

  it("rejects dimensions that GIF cannot represent", () => {
    expect(() => encodeSingleFrameGif({
      width: 65_536,
      height: 1,
      data: new Uint8ClampedArray(4),
    })).toThrow("INVALID_GIF_DIMENSIONS")
  })
})
