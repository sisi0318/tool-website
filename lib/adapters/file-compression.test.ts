import { beforeEach, describe, expect, it } from "vitest"
import { gzipSync, strToU8, zipSync } from "fflate"
import { fileCompressionAdapter, registerFileCompressionAdapters, zipDirectoryAdapter } from "./file-compression"
import { suggestNext } from "../journey/suggest"
import { clearRegistry } from "../canvas/registry"

function inputFile(data: Uint8Array, name: string, type = "application/octet-stream") {
  const file = new File([data.slice()], name, { type })
  Object.defineProperty(file, "arrayBuffer", { value: async () => data.slice().buffer })
  return file
}
async function read(file: File): Promise<Uint8Array> {
  return new Promise((resolve) => { const reader = new FileReader(); reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer)); reader.readAsArrayBuffer(file) })
}
beforeEach(() => { clearRegistry(); registerFileCompressionAdapters() })

describe("file compression adapters", () => {
  it("auto-detects GZip and retains File output without encoding it as text", async () => {
    const result = await fileCompressionAdapter.execute({ file: inputFile(gzipSync(strToU8("hello")), "payload.bin") }, {})
    expect(result.file).toBeInstanceOf(File)
    expect(new TextDecoder().decode(await read(result.file as File))).toBe("hello")
    expect(result.outputBytes).toBe(5)
  })
  it("lists ZIP metadata and requires a selection for multiple entries", async () => {
    const file = inputFile(zipSync({ "a.txt": strToU8("a"), "nested/b.txt": strToU8("bb") }), "sample.zip", "application/zip")
    const listed = await zipDirectoryAdapter.execute({ file }, {})
    expect(listed).toMatchObject({ fileCount: 2, originalBytes: 3 })
    await expect(fileCompressionAdapter.execute({ file }, {})).rejects.toMatchObject({ code: "entryRequired" })
    const extracted = await fileCompressionAdapter.execute({ file }, { entryPath: "nested/b.txt" })
    expect((extracted.file as File).name).toBe("b.txt")
    expect(new TextDecoder().decode(await read(extracted.file as File))).toBe("bb")
  })
  it("offers ZIP inspection and decompression for matching files", () => {
    const suggestions = suggestNext(new File([], "archive.zip", { type: "application/zip" }), "bytes")
    expect(suggestions[0].tool).toBe("zip-directory")
    expect(suggestions.some((item) => item.tool === "compression-file")).toBe(true)
  })
  it("rejects unknown binary formats and honours cancellation", async () => {
    await expect(fileCompressionAdapter.execute({ file: inputFile(strToU8("not compressed"), "data.bin") }, {})).rejects.toMatchObject({ code: "formatRequired" })
    const controller = new AbortController(); controller.abort()
    await expect(fileCompressionAdapter.execute({ file: inputFile(strToU8("data"), "data.txt") }, { operation: "compress" }, { signal: controller.signal })).rejects.toMatchObject({ code: "cancelled" })
  })
})
