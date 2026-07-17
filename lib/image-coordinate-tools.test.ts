import { describe, expect, it } from "vitest"

import {
  coordinateFromManualInput,
  coordinateFromRelativePosition,
} from "./image-coordinate-tools"

describe("image coordinate helpers", () => {
  it("maps the visible bottom-right edge to the last source pixel", () => {
    expect(coordinateFromRelativePosition(200, 100, 200, 100, { width: 20, height: 10 })).toEqual({
      x: 100,
      y: 100,
      pixelX: 19,
      pixelY: 9,
    })
  })

  it("keeps pixel input and percentage endpoints consistent", () => {
    expect(coordinateFromManualInput(19, 9, "pixel", { width: 20, height: 10 })).toEqual({
      x: 100,
      y: 100,
      pixelX: 19,
      pixelY: 9,
    })
  })

  it("converts per-mille and clamps values outside the image", () => {
    expect(coordinateFromManualInput(500, 1200, "permille", { width: 100, height: 100 })).toEqual({
      x: 50,
      y: 100,
      pixelX: 50,
      pixelY: 99,
    })
  })

  it("rejects invalid dimensions and non-finite input", () => {
    expect(coordinateFromRelativePosition(1, 1, 0, 10, { width: 10, height: 10 })).toBeNull()
    expect(coordinateFromManualInput(Number.NaN, 1, "percent", { width: 10, height: 10 })).toBeNull()
  })
})
