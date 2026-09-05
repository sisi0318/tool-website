import { describe, expect, it, vi } from "vitest"
import { createRequire } from "node:module"
import { gzipSync, strToU8, zlibSync } from "fflate"
import { BinaryFileError, concatByteChunks, crc32, transformFileBytes } from "./compression-files"

// The package's ESM entry fetches a browser WASM URL. Use its real Node WASM entry in Vitest.
vi.mock("brotli-wasm", () => ({ default: Promise.resolve(createRequire(import.meta.url)("brotli-wasm")) }))

describe("binary file compression", () => {
  it.each(["gzip", "zlib", "deflate", "brotli"] as const)("round-trips %s while preserving the source bytes", async (format) => {
    const bytes = strToU8("hello 压缩\u0000".repeat(1000))
    const original = bytes.slice()
    const compressed = await transformFileBytes(bytes, { operation: "compress", format })
    expect(bytes).toEqual(original)
    expect(Array.from(await transformFileBytes(compressed, { operation: "decompress", format }))).toEqual(Array.from(bytes))
  })
  it.each(["gzip", "zlib", "deflate", "brotli"] as const)("round-trips an empty %s file", async (format) => {
    const compressed = await transformFileBytes(new Uint8Array(), { operation: "compress", format })
    expect(await transformFileBytes(compressed, { operation: "decompress", format })).toHaveLength(0)
  })
  it("validates CRCs for every member of a concatenated GZip file", async () => {
    const a = gzipSync(strToU8("first"))
    const b = gzipSync(strToU8("second"))
    const compressed = concatByteChunks([a, b], a.length + b.length)
    expect(new TextDecoder().decode(await transformFileBytes(compressed, { operation: "decompress", format: "gzip" }))).toBe("firstsecond")
    compressed[a.length - 8] ^= 1
    await expect(transformFileBytes(compressed, { operation: "decompress", format: "gzip" })).rejects.toMatchObject({ code: "corrupt" })
  })
  it("validates the Zlib checksum and bounds expansion before returning data", async () => {
    const bytes = zlibSync(strToU8("x".repeat(100_000)))
    await expect(transformFileBytes(bytes, { operation: "decompress", format: "zlib", maxOutput: 100 })).rejects.toMatchObject({ code: "outputLimit" })
    bytes[bytes.length - 1] ^= 1
    await expect(transformFileBytes(bytes, { operation: "decompress", format: "zlib" })).rejects.toMatchObject({ code: "corrupt" })
  })
  it("supports cancellation and rejects truncated input", async () => {
    const controller = new AbortController(); controller.abort()
    await expect(transformFileBytes(new Uint8Array(), { operation: "compress", format: "gzip", signal: controller.signal })).rejects.toMatchObject({ code: "cancelled" })
    await expect(transformFileBytes(new Uint8Array([31, 139]), { operation: "decompress", format: "gzip" })).rejects.toThrow(BinaryFileError)
  })
  it("terminates active worker processing when cancelled", async () => {
    const controller = new AbortController()
    await expect(transformFileBytes(new Uint8Array(1024 * 1024), { operation: "compress", format: "gzip", signal: controller.signal, onProgress: () => controller.abort() })).rejects.toMatchObject({ code: "cancelled" })
  })
  it("matches the standard CRC-32 check vector", () => expect(crc32(strToU8("123456789"))).toBe(0xcbf43926))
})
