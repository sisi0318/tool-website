import { afterEach, describe, expect, it, vi } from "vitest"
import { ToolTransferStore, normalizeTransferValue, toolTransferIdFromHash, toolTransferUrl } from "./tool-transfer"

const store = new ToolTransferStore()
afterEach(() => { store.clear(); vi.useRealTimers() })

describe("tool value transfer", () => {
  it("copies structured values and transfers each handle once without data in the URL", () => {
    const value = { token: "private test data", nested: [1, 2] }
    const id = store.put(value, "JSON subtree", "json-format")
    value.nested.push(3)
    expect(toolTransferUrl(id)).not.toContain("private")
    expect(toolTransferIdFromHash(toolTransferUrl(id).split("#")[1])).toBe(id)
    expect(store.take(id)).toEqual({ value: { token: "private test data", nested: [1, 2] }, valueType: "json", source: "JSON subtree", targetTool: "json-format" })
    expect(store.take(id)).toBeNull()
  })
  it("preserves nulls and primitives", () => {
    for (const value of [null, false, 0, ""]) expect(store.take(store.put(value, "value"))?.value).toBe(value)
  })
  it("preserves a typed byte subrange as an independent File", async () => {
    const original = Uint8Array.from([10, 20, 30, 40])
    const result = store.take(store.put(original.subarray(1, 3), "payload", undefined, "payload.bin"))!
    original[1] = 99
    expect(result.valueType).toBe("bytes")
    const file = result.value as File
    expect(file.name).toBe("payload.bin")
    const bytes = await new Promise<ArrayBuffer>((resolve) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result as ArrayBuffer); reader.readAsArrayBuffer(file) })
    expect([...new Uint8Array(bytes)]).toEqual([20, 30])
  })
  it("retains existing files and normalizes Blobs for file adapters", () => {
    const file = new File(["data"], "source.bin")
    expect(normalizeTransferValue(file).value).toBe(file)
    expect(normalizeTransferValue(new Blob(["data"])).value).toBeInstanceOf(File)
  })
  it("tags recognized raw bytes so journey suggestions can offer decompression", () => {
    const transferred = store.take(store.put(new Uint8Array([0x1f, 0x8b, 8, 0]), "payload"))!
    expect((transferred.value as File).type).toBe("application/gzip")
  })
  it("expires unconsumed data", () => {
    vi.useFakeTimers()
    const id = store.put("data", "source")
    vi.advanceTimersByTime(5 * 60_000 + 1)
    expect(store.take(id)).toBeNull()
  })
  it("bounds pending transfers by count and total size", () => {
    const bounded = new ToolTransferStore(1000, 2, 10)
    const first = bounded.put("aaa", "first")
    const second = bounded.put("bbb", "second")
    expect(bounded.take(first)).toBeNull()
    expect(bounded.take(second)?.source).toBe("second")
    expect(() => bounded.put("123456", "too much")).toThrow(/tooLarge/)
    bounded.clear()
    const ids = Array.from({ length: 9 }, (_, index) => store.put(index, "source"))
    expect(store.take(ids[0])).toBeNull()
  })
  it("rejects values that JSON serialization would silently alter", () => {
    const loop: Record<string, unknown> = {}; loop.self = loop
    for (const value of [loop, { value: undefined }, NaN, BigInt(1)]) expect(() => store.put(value, "invalid")).toThrow(/invalidValue/)
    expect(() => store.put("x".repeat(8 * 1024 * 1024 + 1), "large")).toThrow(/tooLarge/)
  })
})
