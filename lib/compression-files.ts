import { AsyncDeflate, AsyncGzip, AsyncGunzip, AsyncInflate, AsyncUnzlib, AsyncZlib, type AsyncFlateStreamHandler } from "fflate"

export const MAX_BINARY_FILE_BYTES = 64 * 1024 * 1024
export const MAX_EXPANDED_BYTES = 128 * 1024 * 1024
export type FileCompressionFormat = "gzip" | "zlib" | "deflate" | "brotli"
export type BinaryFileErrorCode = "invalidZip" | "unsupportedZip" | "encrypted" | "unsupportedMethod" | "unsafePath" | "duplicatePath" | "notFound" | "inputLimit" | "outputLimit" | "entryLimit" | "corrupt" | "nameEncoding" | "cancelled" | "invalidInput"
export class BinaryFileError extends Error {
  constructor(public readonly code: BinaryFileErrorCode, public readonly entry = "", public readonly detail = "") { super([code, entry, detail].filter(Boolean).join(": ")); this.name = "BinaryFileError" }
}
export const assertNotAborted = (signal?: AbortSignal) => { if (signal?.aborted) throw new BinaryFileError("cancelled") }

const CRC_TABLE = Uint32Array.from({ length: 256 }, (_, value) => {
  let crc = value
  for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1
  return crc >>> 0
})
const updateCrc32 = (crc: number, bytes: Uint8Array) => { for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 255] ^ (crc >>> 8); return crc >>> 0 }
export const crc32 = (bytes: Uint8Array) => (updateCrc32(0xffffffff, bytes) ^ 0xffffffff) >>> 0
export function concatByteChunks(chunks: Uint8Array[], length: number): Uint8Array<ArrayBuffer> {
  const result = new Uint8Array(length)
  let offset = 0
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length }
  return result
}

interface AsyncByteStream {
  push: (chunk: Uint8Array, final?: boolean) => void
  terminate: () => void
  ondrain?: (size: number) => void
  onmember?: (offset: number) => void
}

async function runBrotliStream(source: Uint8Array, compress: boolean, level: number, maxOutput: number, signal?: AbortSignal): Promise<Uint8Array<ArrayBuffer>> {
  const brotli = await (await import("brotli-wasm")).default
  assertNotAborted(signal)
  const stream = compress ? new brotli.CompressStream(level) : new brotli.DecompressStream()
  const chunks: Uint8Array[] = []
  let offset = 0
  let total = 0
  let rounds = 0
  try {
    while (true) {
      assertNotAborted(signal)
      const input = source.subarray(offset, Math.min(offset + 64 * 1024, source.length))
      const result = stream instanceof brotli.CompressStream ? stream.compress(offset < source.length ? input : undefined, 64 * 1024) : stream.decompress(input, 64 * 1024)
      let code: number
      let consumed: number
      let output: Uint8Array
      try { code = result.code; consumed = result.input_offset; output = result.buf } finally { result.free() }
      offset += consumed
      total += output.length
      if (total > maxOutput) throw new BinaryFileError("outputLimit")
      if (output.length) chunks.push(output)
      if (code === brotli.BrotliStreamResultCode.ResultSuccess) {
        if (offset !== source.length) throw new BinaryFileError("corrupt")
        return concatByteChunks(chunks, total)
      }
      if (!compress && code === brotli.BrotliStreamResultCode.NeedsMoreInput && offset === source.length) throw new BinaryFileError("corrupt")
      if (!consumed && !output.length) throw new BinaryFileError("corrupt")
      // Yield between bounded WASM batches so cancel and other UI input can be handled.
      if (++rounds % 8 === 0) await new Promise((resolve) => setTimeout(resolve, 0))
    }
  } finally { stream.free() }
}

/** Streams through one worker with backpressure; inputs are copied before transfer to the worker. */
export async function transformFileBytes(source: Uint8Array, options: { format: FileCompressionFormat; operation: "compress" | "decompress"; level?: number; maxOutput?: number; signal?: AbortSignal; onProgress?: (bytes: number) => void }): Promise<Uint8Array<ArrayBuffer>> {
  const { format, signal } = options
  assertNotAborted(signal)
  if (options.operation !== "compress" && options.operation !== "decompress") throw new BinaryFileError("invalidInput")
  if (source.length > MAX_BINARY_FILE_BYTES) throw new BinaryFileError("inputLimit")
  const maxOutput = Math.min(options.maxOutput ?? MAX_EXPANDED_BYTES, MAX_EXPANDED_BYTES)
  const level = Math.max(0, Math.min(11, Math.round(options.level ?? 6)))
  const compress = options.operation === "compress"
  if (!["gzip", "zlib", "deflate", "brotli"].includes(format)) throw new BinaryFileError("invalidInput")
  try {
    if (format === "brotli") return await runBrotliStream(source, compress, level, maxOutput, signal)
    return await new Promise<Uint8Array<ArrayBuffer>>((resolve, reject) => {
      let stream: AsyncByteStream
      let ended = false
      let offset = 0
      let total = 0
      let memberBytes = 0
      let memberCrc = 0xffffffff
      let adlerA = 1
      let adlerB = 0
      const chunks: Uint8Array[] = []
      const cleanup = () => { signal?.removeEventListener("abort", cancel); stream?.terminate() }
      const fail = (error: unknown) => { if (ended) return; ended = true; cleanup(); reject(error instanceof BinaryFileError ? error : new BinaryFileError("corrupt")) }
      const cancel = () => fail(new BinaryFileError("cancelled"))
      const checkGzipMember = (end: number) => {
        if (end < 8 || end > source.length) throw new BinaryFileError("corrupt")
        const view = new DataView(source.buffer, source.byteOffset + end - 8, 8)
        if (view.getUint32(0, true) !== ((memberCrc ^ 0xffffffff) >>> 0) || view.getUint32(4, true) !== memberBytes) throw new BinaryFileError("corrupt")
        memberCrc = 0xffffffff
        memberBytes = 0
      }
      const output: AsyncFlateStreamHandler = (error, data, final) => {
        if (ended) return
        if (error) { fail(error); return }
        try {
          total += data.length
          if (total > maxOutput) throw new BinaryFileError("outputLimit")
          if (data.length) chunks.push(data)
          if (!compress && format === "gzip") { memberBytes += data.length; memberCrc = updateCrc32(memberCrc, data) }
          if (!compress && format === "zlib") for (const byte of data) { adlerA = (adlerA + byte) % 65521; adlerB = (adlerB + adlerA) % 65521 }
          if (final) {
            if (!compress && format === "gzip") checkGzipMember(source.length)
            if (!compress && format === "zlib") {
              if (source.length < 6 || new DataView(source.buffer, source.byteOffset + source.length - 4, 4).getUint32(0) !== (((adlerB << 16) | adlerA) >>> 0)) throw new BinaryFileError("corrupt")
            }
            ended = true
            cleanup()
            resolve(concatByteChunks(chunks, total))
          }
        } catch (error) { fail(error) }
      }
      const deflateLevel = Math.min(9, level) as 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9
      stream = compress ? format === "gzip" ? new AsyncGzip({ level: deflateLevel }, output) : format === "zlib" ? new AsyncZlib({ level: deflateLevel }, output) : new AsyncDeflate({ level: deflateLevel }, output)
        : format === "gzip" ? new AsyncGunzip(output) : format === "zlib" ? new AsyncUnzlib(output) : new AsyncInflate(output)
      if (!compress && format === "gzip") stream.onmember = (end) => { try { checkGzipMember(end) } catch (error) { fail(error) } }
      const pushNext = () => {
        if (ended) return
        try {
          assertNotAborted(signal)
          const end = Math.min(offset + (compress ? 256 * 1024 : 8 * 1024), source.length)
          const chunk = source.slice(offset, end)
          offset = end
          stream.push(chunk, offset === source.length)
          options.onProgress?.(offset)
        } catch (error) { fail(error) }
      }
      stream.ondrain = () => { if (offset < source.length) pushNext() }
      signal?.addEventListener("abort", cancel, { once: true })
      pushNext()
    })
  } catch (error) { throw error instanceof BinaryFileError ? error : new BinaryFileError("corrupt", "", error instanceof Error ? error.message : String(error)) }
}
