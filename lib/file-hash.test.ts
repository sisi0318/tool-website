// @vitest-environment node
import { describe, expect, it, vi } from "vitest"
import { hashFile } from "./file-hash"
import { digestFileChunks, FILE_HASH_CHUNK_BYTES, type FileHashRequest } from "./file-hash-shared"
import { hashBytes } from "./hash-algorithms"

const bytes = Uint8Array.from({ length: FILE_HASH_CHUNK_BYTES + 1234 }, (_, index) => (index * 31) % 251)
const request = (file: Blob = new Blob([bytes])): FileHashRequest => ({
  file,
  algorithms: [{ algorithm: "md5" }, { algorithm: "sha2", size: 256 }, { algorithm: "crc32" }],
  fallbackSize: 256,
  outputFormat: "hex",
})

describe("file hashing", () => {
  it("reads the file once in chunks and matches hashing the whole buffer", async () => {
    const progress: number[] = []
    const digests = await digestFileChunks(request(), { onProgress: (percent) => progress.push(percent) })
    expect(digests).toEqual([
      await hashBytes(bytes, "md5", undefined, "hex"),
      await hashBytes(bytes, "sha2", 256, "hex"),
      await hashBytes(bytes, "crc32", undefined, "hex"),
    ])
    expect(progress.length).toBe(2)
    expect(progress.at(-1)).toBe(100)
  })

  it("hands the request to the worker", async () => {
    const worker = { onmessage: null as null | ((event: MessageEvent) => void), onerror: null, postMessage: vi.fn(), terminate: vi.fn() }
    const job = request()
    const pending = hashFile(job, {}, () => worker as unknown as Worker)
    worker.onmessage!({ data: { ready: true } } as MessageEvent)
    expect(worker.postMessage).toHaveBeenCalledWith(job, [])
    worker.onmessage!({ data: { result: ["a", "b", "c"] } } as MessageEvent)
    await expect(pending).resolves.toEqual(["a", "b", "c"])
  })

  it("falls back to hashing on the main thread when no worker can be created", async () => {
    const digests = await hashFile(request(), {}, () => { throw new ReferenceError("Worker is not defined") })
    expect(digests[0]).toBe(await hashBytes(bytes, "md5", undefined, "hex"))
  })
})
