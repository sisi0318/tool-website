import { afterEach, expect, it, vi } from "vitest"
import { imageCompressAdapter } from "./image-compress"
afterEach(() => vi.unstubAllGlobals())
it("uses actual PNG MIME and extension when Original GIF encoding falls back", async () => {
  vi.stubGlobal("createImageBitmap", async () => ({ width: 2, height: 2, close: vi.fn() }))
  vi.stubGlobal("OffscreenCanvas", class { width = 2; height = 2; getContext() { return { drawImage: vi.fn() } }; async convertToBlob() { return new Blob([new Uint8Array([137, 80, 78, 71])], { type: "image/png" }) } })
  const result = await imageCompressAdapter.execute({}, { file: new File(["gif"], "red.gif", { type: "image/gif" }), outputFormat: "original" })
  expect((result.file as File).name).toBe("red.png"); expect((result.file as File).type).toBe("image/png"); expect(result.info).toMatchObject({ format: "image/png", requestedFormat: "image/gif", formatFallback: true })
})
