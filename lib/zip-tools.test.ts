import { describe, expect, it } from "vitest"
import { strToU8, unzipSync, zipSync } from "fflate"
import { createZip, extractZipEntries, extractZipEntry, inspectZip, normalizeZipPath } from "./zip-tools"
import { crc32, MAX_BINARY_FILE_BYTES } from "./compression-files"

describe("ZIP file tools", () => {
  it.each([0, 6])("packs and selectively extracts Unicode paths with level %i", async (level) => {
    const sources = [{ name: "中文/notes.txt", data: strToU8("hello ZIP") }, { name: "raw.bin", data: Uint8Array.from([0, 255, 1]) }, { name: "empty/", data: new Uint8Array() }]
    const archive = await createZip(sources, { level })
    expect(Object.fromEntries(Object.entries(unzipSync(archive)).map(([name, data]) => [name, Array.from(data)]))).toEqual(Object.fromEntries(sources.map((source) => [source.name, Array.from(source.data)])))
    const inspected = inspectZip(archive)
    expect(inspected.entries.map((entry) => entry.path)).toEqual(sources.map((source) => source.name))
    expect(inspected.totalBytes).toBe(12)
    const result = await extractZipEntries(inspected, [1])
    expect(result).toHaveLength(1)
    expect(Array.from(result[0].data)).toEqual(Array.from(sources[1].data))
    expect(sources[1].data).toHaveLength(3)
  })
  it("lists empty ZIP files and zero-byte entries", async () => {
    expect(inspectZip(zipSync({})).entries).toEqual([])
    const zip = inspectZip(zipSync({ "empty.txt": new Uint8Array() }))
    expect(await extractZipEntry(zip, 0)).toHaveLength(0)
  })
  it("detects data corruption using CRC32", async () => {
    const bytes = zipSync({ "test.txt": [strToU8("hello"), { level: 0 }] })
    const archive = inspectZip(bytes)
    bytes[archive.entries[0].dataOffset] ^= 1
    await expect(extractZipEntry(archive, 0)).rejects.toMatchObject({ code: "corrupt" })
  })
  it("rejects truncated archives and inconsistent central-directory counts", () => {
    const zip = zipSync({ "a.txt": strToU8("one"), "b.txt": strToU8("two") })
    expect(() => inspectZip(zip.subarray(0, zip.length - 1))).toThrow()
    const view = new DataView(zip.buffer)
    view.setUint16(zip.length - 14, 1, true); view.setUint16(zip.length - 12, 1, true)
    expect(() => inspectZip(zip)).toThrow(/invalidZip/)
  })
  it("allows metadata inspection but blocks encrypted, unsupported, oversized and traversal entries", async () => {
    const zip = zipSync({ "../evil.txt": strToU8("data") })
    expect(inspectZip(zip).entries[0].blocked).toBe("unsafePath")
    await expect(extractZipEntry(inspectZip(zip), 0)).rejects.toMatchObject({ code: "unsafePath" })
    const bytes = zipSync({ "ok.txt": strToU8("data") })
    const view = new DataView(bytes.buffer)
    const central = view.getUint32(bytes.length - 6, true)
    view.setUint16(6, 1, true); view.setUint16(central + 8, 1, true)
    expect(inspectZip(bytes).entries[0].blocked).toBe("encrypted")
    view.setUint16(6, 0, true); view.setUint16(central + 8, 0, true)
    view.setUint16(8, 99, true); view.setUint16(central + 10, 99, true)
    expect(inspectZip(bytes).entries[0].blocked).toBe("unsupportedMethod")
    view.setUint16(8, 8, true); view.setUint16(central + 10, 8, true)
    view.setUint32(central + 24, MAX_BINARY_FILE_BYTES + 1, true)
    expect(inspectZip(bytes).entries[0].blocked).toBe("outputLimit")
  })
  it("reads legacy CP437 file names", () => {
    const bytes = zipSync({ "e.txt": strToU8("x") })
    const view = new DataView(bytes.buffer)
    const central = view.getUint32(bytes.length - 6, true)
    bytes[30] = 0x82; bytes[central + 46] = 0x82
    expect(inspectZip(bytes).entries[0].name).toBe("é.txt")
    expect(() => inspectZip(bytes, "utf-8")).toThrow(/nameEncoding/)
  })
  it("supports ZIP64 directory records and extended size fields", async () => {
    const ordinary = zipSync({ "a.txt": strToU8("zip64") })
    const old = new DataView(ordinary.buffer)
    const central = old.getUint32(ordinary.length - 6, true)
    const extra = central + 46 + old.getUint16(central + 28, true)
    const record = ordinary.length - 22 + 28
    const bytes = new Uint8Array(ordinary.length + 28 + 56 + 20)
    bytes.set(ordinary.subarray(0, extra)); bytes.set(ordinary.subarray(extra, ordinary.length - 22), extra + 28)
    const view = new DataView(bytes.buffer)
    view.setUint16(central + 30, 28, true)
    view.setUint32(central + 20, 0xffffffff, true); view.setUint32(central + 24, 0xffffffff, true); view.setUint32(central + 42, 0xffffffff, true)
    view.setUint16(extra, 1, true); view.setUint16(extra + 2, 24, true)
    view.setBigUint64(extra + 4, BigInt(5), true); view.setBigUint64(extra + 12, BigInt(old.getUint32(central + 20, true)), true); view.setBigUint64(extra + 20, BigInt(0), true)
    view.setUint32(record, 0x06064b50, true); view.setBigUint64(record + 4, BigInt(44), true)
    view.setUint16(record + 12, 45, true); view.setUint16(record + 14, 45, true)
    view.setBigUint64(record + 24, BigInt(1), true); view.setBigUint64(record + 32, BigInt(1), true)
    view.setBigUint64(record + 40, BigInt(old.getUint32(ordinary.length - 10, true) + 28), true); view.setBigUint64(record + 48, BigInt(central), true)
    view.setUint32(record + 56, 0x07064b50, true); view.setBigUint64(record + 64, BigInt(record), true); view.setUint32(record + 72, 1, true)
    const eocd = record + 76
    view.setUint32(eocd, 0x06054b50, true); view.setUint16(eocd + 8, 0xffff, true); view.setUint16(eocd + 10, 0xffff, true)
    view.setUint32(eocd + 12, 0xffffffff, true); view.setUint32(eocd + 16, 0xffffffff, true)
    expect(new TextDecoder().decode(unzipSync(bytes)["a.txt"])).toBe("zip64")
    expect(new TextDecoder().decode(await extractZipEntry(inspectZip(bytes), 0))).toBe("zip64")
  })
  it("honors a validated Unicode path extra field", () => {
    const ordinary = zipSync({ "old.txt": strToU8("data") })
    const old = new DataView(ordinary.buffer)
    const central = old.getUint32(ordinary.length - 6, true)
    const extra = central + 46 + old.getUint16(central + 28, true)
    const name = strToU8("新名字.txt")
    const length = 9 + name.length
    const bytes = new Uint8Array(ordinary.length + length)
    bytes.set(ordinary.subarray(0, extra)); bytes.set(ordinary.subarray(extra), extra + length)
    const view = new DataView(bytes.buffer)
    view.setUint16(central + 30, length, true); view.setUint16(extra, 0x7075, true); view.setUint16(extra + 2, length - 4, true)
    bytes[extra + 4] = 1; view.setUint32(extra + 5, crc32(strToU8("old.txt")), true); bytes.set(name, extra + 9)
    view.setUint32(bytes.length - 10, old.getUint32(ordinary.length - 10, true) + length, true)
    expect(inspectZip(bytes).entries[0].name).toBe("新名字.txt")
    expect(inspectZip(bytes, "cp437").entries[0].name).toBe("old.txt")
  })
  it("can cancel between files without producing a partial archive", async () => {
    const controller = new AbortController()
    await expect(createZip([{ name: "a", data: strToU8("first") }, { name: "b", data: strToU8("second") }], { signal: controller.signal, onProgress: () => controller.abort() })).rejects.toMatchObject({ code: "cancelled" })
  })
  it("normalizes safe paths and refuses duplicate or conflicting packed names", async () => {
    expect(normalizeZipPath("./folder\\note.txt")).toBe("folder/note.txt")
    for (const name of ["../x", "/x", "C:\\x", "bad\0name"]) expect(() => normalizeZipPath(name)).toThrow(/unsafePath/)
    await expect(createZip([{ name: "a", data: new Uint8Array() }, { name: "./a", data: new Uint8Array() }])).rejects.toMatchObject({ code: "duplicatePath" })
    await expect(createZip([{ name: "a", data: new Uint8Array() }, { name: "a/b.txt", data: new Uint8Array() }])).rejects.toMatchObject({ code: "duplicatePath" })
  })
})
