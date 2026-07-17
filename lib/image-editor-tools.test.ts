import { describe, expect, it } from "vitest"
import {
  DEFAULT_IMAGE_EDITOR_STATE,
  buildImageFilter,
  getImageRenderGeometry,
  getImageRenderScale,
  isFullImageCrop,
  normalizeImageCrop,
  safeEditedImageBase,
} from "./image-editor-tools"

describe("image editor tools", () => {
  it("normalizes a crop dragged up and to the left", () => {
    expect(
      normalizeImageCrop({ x: 80, y: 70, width: -50, height: -30 }, 100, 80),
    ).toEqual({ x: 30, y: 40, width: 50, height: 30 })
  })

  it("swaps cropped dimensions at a quarter turn", () => {
    const geometry = getImageRenderGeometry(1000, 800, {
      rotation: 90,
      crop: { x: 100, y: 50, width: 600, height: 300 },
    })

    expect(geometry.outputWidth).toBe(300)
    expect(geometry.outputHeight).toBe(600)
  })

  it("allocates enough output space for an arbitrary rotation", () => {
    const geometry = getImageRenderGeometry(100, 100, {
      rotation: 45,
      crop: null,
    })

    expect(geometry.outputWidth).toBe(142)
    expect(geometry.outputHeight).toBe(142)
  })

  it("recognizes a full-image crop within subpixel tolerance", () => {
    expect(
      isFullImageCrop({ x: 0.2, y: 0.1, width: 999.7, height: 799.8 }, 1000, 800),
    ).toBe(true)
  })

  it("constrains preview allocation without changing small images", () => {
    expect(getImageRenderScale(800, 600, 1600, 2_000_000)).toBe(1)
    const scale = getImageRenderScale(12000, 8000, 1600, 2_000_000)
    expect(12000 * scale).toBeLessThanOrEqual(1600)
    expect(12000 * 8000 * scale * scale).toBeLessThanOrEqual(2_000_000)
  })

  it("builds filters and safe output names", () => {
    expect(
      buildImageFilter({
        ...DEFAULT_IMAGE_EDITOR_STATE,
        brightness: 120,
        grayscale: true,
      }),
    ).toBe("brightness(120%) grayscale(100%)")
    expect(safeEditedImageBase(' report<final>?.png')).toBe("report_final__")
  })
})
