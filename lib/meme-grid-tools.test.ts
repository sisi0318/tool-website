import { describe, expect, it } from "vitest"
import {
  analyzeMemeGrid,
  createMemeGrid,
  getConstrainedImageSize,
  mapMemeBounds,
  safeMemeFileBase,
} from "./meme-grid-tools"

function createGridImage(rows: number, cols: number) {
  const cellSize = 24
  const gap = 4
  const margin = 10
  const width = margin * 2 + cols * cellSize + (cols - 1) * gap
  const height = margin * 2 + rows * cellSize + (rows - 1) * gap
  const data = new Uint8ClampedArray(width * height * 4)

  for (let index = 0; index < width * height; index += 1) {
    data[index * 4] = 250
    data[index * 4 + 1] = 250
    data[index * 4 + 2] = 250
    data[index * 4 + 3] = 255
  }

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const left = margin + col * (cellSize + gap)
      const top = margin + row * (cellSize + gap)
      for (let y = top; y < top + cellSize; y += 1) {
        for (let x = left; x < left + cellSize; x += 1) {
          const index = (y * width + x) * 4
          data[index] = 40 + row * 12
          data[index + 1] = 80 + col * 8
          data[index + 2] = 180
        }
      }
    }
  }

  return { data, width, height }
}

describe("meme grid tools", () => {
  it("detects a grid from real low-density gutters", () => {
    const result = analyzeMemeGrid(createGridImage(3, 4), 50)

    expect(result.rows).toBe(3)
    expect(result.cols).toBe(4)
    expect(result.bounds.left).toBeLessThanOrEqual(10)
    expect(result.bounds.top).toBeLessThanOrEqual(10)
    expect(result.bounds.left + result.bounds.width).toBeGreaterThan(110)
  })

  it("detects opaque dark cells on a transparent background", () => {
    const source = createGridImage(2, 3)
    for (let y = 0; y < source.height; y += 1) {
      for (let x = 0; x < source.width; x += 1) {
        const index = (y * source.width + x) * 4
        const isWhite =
          source.data[index] === 250 &&
          source.data[index + 1] === 250 &&
          source.data[index + 2] === 250
        if (isWhite) {
          source.data[index] = 0
          source.data[index + 1] = 0
          source.data[index + 2] = 0
          source.data[index + 3] = 0
        } else {
          source.data[index] = 0
          source.data[index + 1] = 0
          source.data[index + 2] = 0
        }
      }
    }

    const result = analyzeMemeGrid(source)
    expect(result.rows).toBe(2)
    expect(result.cols).toBe(3)
  })

  it("builds contiguous cells that cover the complete bounded area", () => {
    const result = createMemeGrid(
      { left: 3, top: 5, width: 101, height: 59 },
      3,
      4,
      120,
      80,
    )

    expect(result.cells).toHaveLength(12)
    expect(result.vertical[0]).toBe(3)
    expect(result.vertical.at(-1)).toBe(104)
    expect(result.horizontal[0]).toBe(5)
    expect(result.horizontal.at(-1)).toBe(64)
    expect(result.cells.every((cell) => cell.width > 0 && cell.height > 0)).toBe(true)
  })

  it("maps an analysis bound back to original-image pixels", () => {
    expect(
      mapMemeBounds({ left: 10, top: 5, width: 80, height: 40 }, 100, 50, 1000, 500),
    ).toEqual({ left: 100, top: 50, width: 800, height: 400 })
  })

  it("constrains both dimensions and total pixel allocation", () => {
    const size = getConstrainedImageSize(12000, 8000, 1600, 2_500_000)

    expect(Math.max(size.width, size.height)).toBeLessThanOrEqual(1600)
    expect(size.width * size.height).toBeLessThanOrEqual(2_500_000)
    expect(size.scale).toBeLessThan(1)
  })

  it("creates safe and useful download names", () => {
    expect(safeMemeFileBase('  a<b>:"c".png')).toBe("a_b___c_")
    expect(safeMemeFileBase(".png")).toBe("meme")
  })
})
