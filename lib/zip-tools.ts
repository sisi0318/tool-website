import { AsyncZipDeflate, Zip, ZipPassThrough } from "fflate"
import { assertNotAborted, BinaryFileError, concatByteChunks, crc32, MAX_BINARY_FILE_BYTES, MAX_EXPANDED_BYTES, transformFileBytes, type BinaryFileErrorCode } from "./compression-files"

export const MAX_ZIP_ENTRIES = 2000
export type ZipNameEncoding = "auto" | "utf-8" | "cp437" | "gb18030"
export interface ZipEntry {
  id: number; name: string; path: string; directory: boolean; compressedSize: number; originalSize: number; method: number; crc: number; dataOffset: number; modifiedAt: number; blocked?: BinaryFileErrorCode
}
export interface ZipArchive { bytes: Uint8Array; entries: ZipEntry[]; totalBytes: number }
export interface ZipSource { name: string; data: Uint8Array<ArrayBuffer>; modifiedAt?: number }

// CP437 mapping: https://www.unicode.org/Public/MAPPINGS/VENDORS/MICSFT/PC/CP437.TXT
const CP437 = "ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜ¢£¥₧ƒáíóúñÑªº¿⌐¬½¼¡«»░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀αßΓπΣσµτΦΘΩδ∞φε∩≡±≥≤⌠⌡÷≈°∙·√ⁿ²■\u00a0"

export function normalizeZipPath(name: string): string {
  const path = name.replace(/\\/g, "/")
  if (!path || path.length > 2048 || path.startsWith("/") || /^[a-z]:/i.test(path) || /[\x00-\x1f\x7f]/.test(path)) throw new BinaryFileError("unsafePath", name)
  const parts = path.split("/").filter((part) => part && part !== ".")
  if (!parts.length || parts.length > 64 || parts.includes("..")) throw new BinaryFileError("unsafePath", name)
  return parts.join("/") + (path.endsWith("/") ? "/" : "")
}

function decodeName(bytes: Uint8Array, encoding: Exclude<ZipNameEncoding, "auto">): string {
  try {
    return encoding === "cp437" ? Array.from(bytes, (byte) => byte < 128 ? String.fromCharCode(byte) : CP437[byte - 128]).join("") : new TextDecoder(encoding, { fatal: true }).decode(bytes)
  } catch { throw new BinaryFileError("nameEncoding") }
}

/** Read metadata before inflating anything. Layout follows PKWARE APPNOTE sections 4.3 / 4.5.3 / 4.6.9. */
export function inspectZip(bytes: Uint8Array, nameEncoding: ZipNameEncoding = "auto"): ZipArchive {
  if (bytes.length > MAX_BINARY_FILE_BYTES) throw new BinaryFileError("inputLimit")
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const bounds = (offset: number, length: number, end = bytes.length) => { if (!Number.isSafeInteger(offset) || offset < 0 || length < 0 || offset + length > end) throw new BinaryFileError("invalidZip") }
  const u16 = (offset: number) => { bounds(offset, 2); return view.getUint16(offset, true) }
  const u32 = (offset: number) => { bounds(offset, 4); return view.getUint32(offset, true) }
  const u64 = (offset: number, end = bytes.length) => { bounds(offset, 8, end); const value = view.getBigUint64(offset, true); if (value > BigInt(Number.MAX_SAFE_INTEGER)) throw new BinaryFileError("outputLimit"); return Number(value) }
  let eocd = -1
  for (let offset = bytes.length - 22; offset >= Math.max(0, bytes.length - 65557); offset--) {
    if (u32(offset) === 0x06054b50 && offset + 22 + u16(offset + 20) === bytes.length) { eocd = offset; break }
  }
  if (eocd < 0) throw new BinaryFileError("invalidZip")
  if (u16(eocd + 4) || u16(eocd + 6) || u16(eocd + 8) !== u16(eocd + 10)) throw new BinaryFileError("unsupportedZip")
  let count = u16(eocd + 10)
  let centralSize = u32(eocd + 12)
  let centralOffset = u32(eocd + 16)
  let centralBoundary = eocd
  if (count === 0xffff || centralSize === 0xffffffff || centralOffset === 0xffffffff) {
    const locator = eocd - 20
    if (locator < 0 || u32(locator) !== 0x07064b50 || u32(locator + 4) !== 0 || u32(locator + 16) !== 1) throw new BinaryFileError("unsupportedZip")
    const record = u64(locator + 8)
    bounds(record, 56, locator)
    bounds(record, 12 + u64(record + 4), locator)
    if (u32(record) !== 0x06064b50 || u64(record + 4) < 44 || u32(record + 16) || u32(record + 20) || u64(record + 24) !== u64(record + 32)) throw new BinaryFileError("unsupportedZip")
    count = u64(record + 32)
    centralSize = u64(record + 40)
    centralOffset = u64(record + 48)
    centralBoundary = record
  }
  if (count > MAX_ZIP_ENTRIES) throw new BinaryFileError("entryLimit")
  let base = 0
  if (count && (centralOffset + 4 > bytes.length || u32(centralOffset) !== 0x02014b50)) {
    // Some self-extracting archives store offsets relative to their appended ZIP data.
    base = centralBoundary - centralSize - centralOffset
    if (base < 0) throw new BinaryFileError("invalidZip")
    centralOffset += base
  }
  bounds(centralOffset, centralSize, centralBoundary)
  const end = centralOffset + centralSize
  const entries: ZipEntry[] = []
  let offset = centralOffset
  let totalBytes = 0
  for (let id = 0; id < count; id++) {
    bounds(offset, 46, end)
    if (u32(offset) !== 0x02014b50) throw new BinaryFileError("invalidZip")
    const flags = u16(offset + 8)
    const method = u16(offset + 10)
    let compressedSize = u32(offset + 20)
    let originalSize = u32(offset + 24)
    let localOffset = u32(offset + 42)
    let disk = u16(offset + 34)
    const nameLength = u16(offset + 28)
    const extraStart = offset + 46 + nameLength
    const extraEnd = extraStart + u16(offset + 30)
    const next = extraEnd + u16(offset + 32)
    bounds(offset, next - offset, end)
    const rawName = bytes.subarray(offset + 46, extraStart)
    let unicodeName: string | undefined
    for (let extra = extraStart; extra < extraEnd;) {
      bounds(extra, 4, extraEnd)
      const type = u16(extra)
      const data = extra + 4
      const extraLimit = data + u16(extra + 2)
      bounds(data, extraLimit - data, extraEnd)
      if (type === 1) {
        let cursor = data
        if (originalSize === 0xffffffff) { originalSize = u64(cursor, extraLimit); cursor += 8 }
        if (compressedSize === 0xffffffff) { compressedSize = u64(cursor, extraLimit); cursor += 8 }
        if (localOffset === 0xffffffff) { localOffset = u64(cursor, extraLimit); cursor += 8 }
        if (disk === 0xffff) { bounds(cursor, 4, extraLimit); disk = u32(cursor) }
      }
      if (type === 0x7075 && extraLimit - data >= 5 && bytes[data] === 1 && u32(data + 1) === crc32(rawName)) unicodeName = decodeName(bytes.subarray(data + 5, extraLimit), "utf-8")
      extra = extraLimit
    }
    if (disk || localOffset === 0xffffffff || compressedSize === 0xffffffff || originalSize === 0xffffffff) throw new BinaryFileError("unsupportedZip")
    const name = nameEncoding === "auto" ? flags & 0x800 ? decodeName(rawName, "utf-8") : unicodeName ?? decodeName(rawName, "cp437") : decodeName(rawName, nameEncoding)
    let path = name
    let blocked: BinaryFileErrorCode | undefined
    try { path = normalizeZipPath(name) } catch { blocked = "unsafePath" }
    const directory = path.endsWith("/") || (u32(offset + 38) & 0x10) !== 0 || ((u32(offset + 38) >>> 16) & 0xf000) === 0x4000
    if (directory && !path.endsWith("/")) path += "/"
    if (flags & 0x2041) blocked = "encrypted"
    else if (method !== 0 && method !== 8) blocked = "unsupportedMethod"
    else if (originalSize > MAX_BINARY_FILE_BYTES) blocked = "outputLimit"
    localOffset += base
    bounds(localOffset, 30, centralOffset)
    if (u32(localOffset) !== 0x04034b50 || u16(localOffset + 8) !== method) throw new BinaryFileError("invalidZip")
    const localNameLength = u16(localOffset + 26)
    const dataOffset = localOffset + 30 + localNameLength + u16(localOffset + 28)
    bounds(localOffset, dataOffset - localOffset + compressedSize, centralOffset)
    if (localNameLength !== rawName.length || rawName.some((byte, index) => bytes[localOffset + 30 + index] !== byte)) throw new BinaryFileError("invalidZip")
    if ((u16(localOffset + 6) & 0x2041) !== (flags & 0x2041)) throw new BinaryFileError("invalidZip")
    const date = u16(offset + 14)
    const time = u16(offset + 12)
    const modifiedAt = new Date(1980 + (date >>> 9), ((date >>> 5) & 15) - 1, date & 31, time >>> 11, (time >>> 5) & 63, (time & 31) * 2).getTime()
    entries.push({ id, name, path, directory, compressedSize, originalSize, method, crc: u32(offset + 16), dataOffset, modifiedAt, ...(blocked ? { blocked } : {}) })
    totalBytes += originalSize
    if (!Number.isSafeInteger(totalBytes)) throw new BinaryFileError("outputLimit")
    offset = next
  }
  if (offset !== end && (offset + 6 > end || u32(offset) !== 0x05054b50 || offset + 6 + u16(offset + 4) !== end)) throw new BinaryFileError("invalidZip")
  return { bytes, entries, totalBytes }
}

export async function extractZipEntry(archive: ZipArchive, id: number, signal?: AbortSignal): Promise<Uint8Array<ArrayBuffer>> {
  assertNotAborted(signal)
  const entry = archive.entries.find((entry) => entry.id === id)
  if (!entry) throw new BinaryFileError("notFound")
  if (entry.blocked) throw new BinaryFileError(entry.blocked, entry.name)
  const compressed = archive.bytes.subarray(entry.dataOffset, entry.dataOffset + entry.compressedSize)
  const result = entry.method === 0 ? compressed.slice() : await transformFileBytes(compressed, { operation: "decompress", format: "deflate", maxOutput: MAX_BINARY_FILE_BYTES, signal })
  assertNotAborted(signal)
  if (result.length !== entry.originalSize || crc32(result) !== entry.crc) throw new BinaryFileError("corrupt", entry.name)
  return result
}

export async function extractZipEntries(archive: ZipArchive, ids: number[], signal?: AbortSignal, onProgress?: (count: number) => void): Promise<ZipSource[]> {
  const selected = [...new Set(ids)].map((id) => { const entry = archive.entries.find((entry) => entry.id === id); if (!entry) throw new BinaryFileError("notFound"); return entry })
  if (selected.reduce((sum, entry) => sum + entry.originalSize, 0) > MAX_EXPANDED_BYTES) throw new BinaryFileError("outputLimit")
  const result: ZipSource[] = []
  let actualSize = 0
  for (const entry of selected) {
    const data = await extractZipEntry(archive, entry.id, signal)
    actualSize += data.length
    if (actualSize > MAX_EXPANDED_BYTES) throw new BinaryFileError("outputLimit")
    result.push({ name: entry.path, data, modifiedAt: entry.modifiedAt })
    onProgress?.(result.length)
  }
  return result
}

/** Sequential file compression avoids spawning one worker per large file at once. */
export async function createZip(sources: ZipSource[], options: { level?: number; signal?: AbortSignal; onProgress?: (count: number) => void } = {}): Promise<Uint8Array<ArrayBuffer>> {
  assertNotAborted(options.signal)
  if (sources.length > MAX_ZIP_ENTRIES) throw new BinaryFileError("entryLimit")
  const names = sources.map((source) => normalizeZipPath(source.name))
  const unique = new Set(names)
  if (unique.size !== names.length) throw new BinaryFileError("duplicatePath")
  const files = new Set(names.filter((name) => !name.endsWith("/")))
  for (const name of names) {
    const parts = name.replace(/\/$/, "").split("/")
    for (let end = 1; end < parts.length; end++) if (files.has(parts.slice(0, end).join("/"))) throw new BinaryFileError("duplicatePath", name)
    if (name.endsWith("/") && files.has(name.slice(0, -1))) throw new BinaryFileError("duplicatePath", name)
  }
  if (sources.some((source) => source.data.length > MAX_BINARY_FILE_BYTES) || sources.reduce((sum, source) => sum + source.data.length, 0) > MAX_EXPANDED_BYTES) throw new BinaryFileError("inputLimit")
  return new Promise((resolve, reject) => {
    const chunks: Uint8Array[] = []
    let total = 0
    let done = false
    let rejectFile: ((error: unknown) => void) | undefined
    const fail = (error: unknown) => { if (done) return; done = true; zip.terminate(); options.signal?.removeEventListener("abort", cancel); rejectFile?.(error); reject(error instanceof BinaryFileError ? error : new BinaryFileError("corrupt")) }
    const cancel = () => fail(new BinaryFileError("cancelled"))
    const zip = new Zip((error, data, final) => {
      if (done) return
      if (error) { fail(error); return }
      total += data.length
      if (total > MAX_EXPANDED_BYTES) { fail(new BinaryFileError("outputLimit")); return }
      chunks.push(data)
      if (final) { done = true; options.signal?.removeEventListener("abort", cancel); resolve(concatByteChunks(chunks, total)) }
    })
    options.signal?.addEventListener("abort", cancel, { once: true })
    void (async () => {
      try {
        for (let index = 0; index < sources.length; index++) {
          assertNotAborted(options.signal)
          if (done) return
          const source = sources[index]
          const level = Math.min(9, Math.max(0, Math.round(options.level ?? 6))) as 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9
          const file = level === 0 || names[index].endsWith("/") ? new ZipPassThrough(names[index]) : new AsyncZipDeflate(names[index], { level })
          file.mtime = new Date(Math.max(new Date(1980, 0, 1).getTime(), Math.min(new Date(2107, 11, 31).getTime(), source.modifiedAt ?? Date.now())))
          zip.add(file)
          if (done) return
          await new Promise<void>((resolveFile, rejectCurrent) => {
            rejectFile = rejectCurrent
            const emit = file.ondata
            file.ondata = (error, data, final) => { emit(error, data, final); if (error) rejectCurrent(error); else if (final) resolveFile() }
            file.push(source.data.slice(), true)
          })
          rejectFile = undefined
          options.onProgress?.(index + 1)
        }
        assertNotAborted(options.signal)
        if (!done) zip.end()
      } catch (error) { fail(error) }
    })()
  })
}
