import { describe, expect, it, vi } from "vitest"

import { convertImageFile } from "./image-convert"

describe("image conversion", () => {
  it("resizes within both maximum dimensions and changes the extension", async () => {
    const close = vi.fn()
    vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue({ width: 1600, height: 900, close }))
    vi.stubGlobal("OffscreenCanvas", class MockOffscreenCanvas {
      width: number
      height: number
      constructor(width: number, height: number) { this.width = width; this.height = height }
      getContext() { return { fillStyle: "", fillRect: vi.fn(), drawImage: vi.fn() } }
      async convertToBlob(options: BlobPropertyBag) { return new Blob(["converted"], options) }
    })

    const result = await convertImageFile(new File(["image"], "photo.png", { type: "image/png" }), {
      format: "webp",
      quality: 0.8,
      maxWidth: 800,
      maxHeight: 800,
    })

    expect(result.width).toBe(800)
    expect(result.height).toBe(450)
    expect(result.file.name).toBe("photo.webp")
    expect(result.file.type).toBe("image/webp")
    expect(close).toHaveBeenCalledOnce()
    vi.unstubAllGlobals()
  })

  it("rejects non-image files", async () => {
    await expect(convertImageFile(new File(["text"], "note.txt", { type: "text/plain" }), {
      format: "png",
      quality: 1,
    })).rejects.toThrow("INVALID_IMAGE")
  })
})
