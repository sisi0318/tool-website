import { describe, expect, it } from "vitest"
import { strToU8, zipSync } from "fflate"
import { bytesToBase64, transformCompression } from "./compression"

describe("transformCompression", () => {
  it.each(["gzip", "zlib", "deflate"] as const)("round-trips %s", async (format) => {
    const compressed = await transformCompression("hello 压缩 world", {
      operation: "compress",
      format,
      inputEncoding: "text",
      outputEncoding: "base64",
    })
    const decompressed = await transformCompression(compressed.output, {
      operation: "decompress",
      format,
      inputEncoding: "base64",
      outputEncoding: "text",
    })
    expect(decompressed.output).toBe("hello 压缩 world")
  })

  it("creates and extracts a ZIP archive", async () => {
    const compressed = await transformCompression("zip content", {
      operation: "compress",
      format: "zip",
      inputEncoding: "text",
      outputEncoding: "base64",
      filename: "note.txt",
    })
    const decompressed = await transformCompression(compressed.output, {
      operation: "decompress",
      format: "zip",
      inputEncoding: "base64",
      outputEncoding: "text",
    })
    expect(decompressed.output).toBe("zip content")
    expect(decompressed.files).toEqual(["note.txt"])
  })

  it("returns every entry from a multi-file ZIP archive", async () => {
    const archive = zipSync({
      "a.txt": strToU8("alpha"),
      "nested/b.txt": strToU8("beta"),
    })
    const decompressed = await transformCompression(bytesToBase64(archive), {
      operation: "decompress",
      format: "zip",
      inputEncoding: "base64",
      outputEncoding: "text",
    })

    expect(decompressed.files).toEqual(["a.txt", "nested/b.txt"])
    expect(decompressed.entries).toEqual({
      "a.txt": "alpha",
      "nested/b.txt": "beta",
    })
    expect(JSON.parse(decompressed.output)).toEqual(decompressed.entries)
  })

  it("rejects malformed hexadecimal input", async () => {
    await expect(transformCompression("abc", {
      operation: "compress",
      format: "gzip",
      inputEncoding: "hex",
      outputEncoding: "base64",
    })).rejects.toThrow("Invalid hexadecimal")
  })
})
