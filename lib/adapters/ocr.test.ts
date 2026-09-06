// @vitest-environment node
import { describe, expect, it, vi } from "vitest"
import { ocrAdapter } from "./ocr"
import { recognizeImage } from "../ocr-worker-client"
vi.mock("../ocr-worker-client", () => ({ recognizeImage: vi.fn() }))
describe("OCR workflow adapter", () => {
  it("forwards images and cancellation and returns usable text and geometry", async () => {
    const file = new File(["image"], "sample.png"), signal = new AbortController().signal
    vi.mocked(recognizeImage).mockResolvedValue({ text: "你好", lines: [], preview: new Blob(), info: { width: 2, height: 3, rotation: 90, tiles: 1, elapsedMs: 2, animated: false } })
    const result = await ocrAdapter.execute({ file }, { rotation: "90", enhanceSmallText: false }, { signal })
    expect(recognizeImage).toHaveBeenCalledWith(file, { rotation: 90, enhanceSmallText: false }, { signal })
    expect(result.text).toBe("你好"); expect(result).not.toHaveProperty("preview")
  })
  it("rejects missing images and unsupported rotations", async () => {
    await expect(ocrAdapter.execute({}, {})).rejects.toMatchObject({ code: "format" })
    await expect(ocrAdapter.execute({ file: new File(["image"], "sample.png") }, { rotation: 45 })).rejects.toMatchObject({ code: "options" })
  })
})
