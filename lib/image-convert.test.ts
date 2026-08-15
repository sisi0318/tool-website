import { afterEach, describe, expect, it, vi } from "vitest"

import { convertImageFile } from "./image-convert"

afterEach(() => {
  vi.unstubAllGlobals()
})

function readFileBytes(file: File): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(reader.error ?? new Error("FILE_READ_FAILED"))
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer))
    reader.readAsArrayBuffer(file)
  })
}

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
  })

  it("encodes GIF output itself instead of relying on canvas MIME support", async () => {
    const close = vi.fn()
    const convertToBlob = vi.fn()
    vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue({ width: 2, height: 1, close }))
    vi.stubGlobal("OffscreenCanvas", class MockOffscreenCanvas {
      constructor(_width: number, _height: number) {}
      getContext() {
        return {
          drawImage: vi.fn(),
          getImageData: vi.fn().mockReturnValue({
            width: 2,
            height: 1,
            data: new Uint8ClampedArray([
              255, 0, 0, 255,
              0, 0, 0, 0,
            ]),
          }),
        }
      }
      convertToBlob = convertToBlob
    })

    const result = await convertImageFile(new File(["image"], "photo.png", { type: "image/png" }), {
      format: "gif",
      quality: 0.8,
    })
    const signature = new TextDecoder().decode((await readFileBytes(result.file)).subarray(0, 6))

    expect(result.file.name).toBe("photo.gif")
    expect(result.file.type).toBe("image/gif")
    expect(signature).toBe("GIF89a")
    expect(convertToBlob).not.toHaveBeenCalled()
    expect(close).toHaveBeenCalledOnce()
  })

  it("rejects non-image files", async () => {
    await expect(convertImageFile(new File(["text"], "note.txt", { type: "text/plain" }), {
      format: "png",
      quality: 1,
    })).rejects.toThrow("INVALID_IMAGE")
  })
})
