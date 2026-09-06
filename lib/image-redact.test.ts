// @vitest-environment node
import { describe, expect, it, vi } from "vitest"
import { detectRedactRegions, redactRect, sensitiveKinds } from "./image-redact-shared"
import { runRedactImage } from "./image-redact"

describe("privacy candidates and pixel geometry", () => {
  it("recognizes formatted and full-width contact details without matching longer numbers", () => {
    expect(sensitiveKinds("电话：＋８６ １３８－００１３－８０００；hello @ example.com")).toEqual(["email", "phone"])
    expect(sensitiveKinds("+1 (415) 555-0136")).toEqual(["phone"])
    expect(sensitiveKinds("ID: 110101199001011234")).toEqual(["identity"])
    expect(sensitiveKinds("Order 9138001380005 ; a@localhost ; example.com")).toEqual([])
  })
  it("covers the full matching line with margin, clips at edges and respects categories", () => {
    const line = { id: 3, text: "Email: hello@example.com", score: 0.7, poly: [[1, 2], [190, 3], [188, 20], [2, 22]] as [number, number][] }
    expect(detectRedactRegions([line], 200, 100, ["phone"])).toEqual([])
    expect(detectRedactRegions([line], 200, 100, ["email"])[0]).toMatchObject({ x: 0, y: 0, width: 194, height: 26, selected: true })
  })
  it("rounds outward to full pixels and fails closed on invalid or empty masks", () => {
    expect(redactRect({ x: 10.8, y: 3.1, width: 20.4, height: 7.1 }, 100, 100)).toEqual({ x: 10, y: 3, width: 22, height: 8 })
    expect(redactRect({ x: -5, y: 90, width: 15, height: 25 }, 100, 100)).toEqual({ x: 0, y: 90, width: 10, height: 10 })
    for (const rect of [{ x: NaN, y: 1, width: 2, height: 2 }, { x: 1, y: 1, width: 0, height: 2 }, { x: 110, y: 1, width: 2, height: 2 }]) expect(() => redactRect(rect, 100, 100)).toThrow("options")
  })
  it("terminates cancelled pixel work and ignores a late result", async () => {
    const worker = { onmessage: null as null | ((event: MessageEvent) => void), onerror: null, terminate: vi.fn(), postMessage: vi.fn() }, controller = new AbortController()
    const pending = runRedactImage({ action: "prepare", file: new File(["image"], "image.png") }, controller.signal, () => worker as unknown as Worker)
    const late = worker.onmessage!, rejected = expect(pending).rejects.toMatchObject({ code: "cancelled" })
    late({ data: { ready: true } } as MessageEvent); expect(worker.postMessage).toHaveBeenCalledOnce()
    controller.abort(); await rejected; late({ data: { result: {} } } as MessageEvent)
    expect(worker.terminate).toHaveBeenCalledOnce()
  })
})
