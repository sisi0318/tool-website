// @vitest-environment node
import { describe, expect, it, vi } from "vitest"
import { imageToSvgAdapter } from "./image-to-svg"
const mocks = vi.hoisted(() => ({ run: vi.fn() }))
vi.mock("../image-vector-worker-client", () => ({ vectorizeImage: mocks.run }))
describe("image-to-svg adapter", () => {
  it("preserves a binary primary output and forwards cancellation and fidelity settings", async () => {
    const input = new File(["png"], "input.png"), output = new File(["<svg/>"], "input.svg", { type: "image/svg+xml" }), controller = new AbortController()
    mocks.run.mockResolvedValue({ file: output, svg: "<svg/>", info: { paths: 2 } })
    const result = await imageToSvgAdapter.execute({ file: input }, { tracing: "smooth", maxEdge: 768 }, { signal: controller.signal })
    expect(result.file).toBe(output)
    expect(mocks.run).toHaveBeenCalledWith(input, expect.objectContaining({ tracing: "smooth", maxEdge: 768 }), { signal: controller.signal })
  })
  it("rejects unknown options before execution", async () => {
    await expect(imageToSvgAdapter.execute({ file: new File(["x"], "input.png") }, { tracing: "invalid" })).rejects.toMatchObject({ code: "options" })
  })
})
