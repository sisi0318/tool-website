import { describe, expect, it } from "vitest"
import { transformCompression } from "./compression"

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

  it("rejects malformed hexadecimal input", async () => {
    await expect(transformCompression("abc", {
      operation: "compress",
      format: "gzip",
      inputEncoding: "hex",
      outputEncoding: "base64",
    })).rejects.toThrow("Invalid hexadecimal")
  })
})
