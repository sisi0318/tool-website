import { createIncrementalHasher } from "./hash-algorithms"

export interface FileHashRequest {
  file: Blob
  /** 每项一个算法；可配置长度的算法带上 size */
  algorithms: Array<{ algorithm: string; size?: number }>
  /** 可配置算法没给 size 时用的长度 */
  fallbackSize: number
  outputFormat: string
}

/** 每次读入的块：够大，来回次数少；又不会一次占太多内存 */
export const FILE_HASH_CHUNK_BYTES = 4 * 1024 * 1024

export function hashCancelledError(): DOMException {
  return new DOMException("Hash calculation cancelled", "AbortError")
}

/**
 * 分块读文件，每块同时喂给所有算法，整个文件只读一遍。Worker 里和退回主线程时共用这一份。
 * 返回的摘要与 request.algorithms 一一对应。
 */
export async function digestFileChunks(
  request: FileHashRequest,
  hooks: { onProgress?: (percent: number) => void; isCancelled?: () => boolean; afterChunk?: () => Promise<void> } = {},
): Promise<string[]> {
  const hashers = await Promise.all(
    request.algorithms.map(({ algorithm, size }) => createIncrementalHasher(algorithm, size, request.fallbackSize, request.outputFormat)),
  )
  const { file } = request
  if (file.size === 0) hooks.onProgress?.(100)

  for (let offset = 0; offset < file.size; offset += FILE_HASH_CHUNK_BYTES) {
    if (hooks.isCancelled?.()) throw hashCancelledError()
    const chunk = new Uint8Array(await file.slice(offset, Math.min(file.size, offset + FILE_HASH_CHUNK_BYTES)).arrayBuffer())
    for (const hasher of hashers) hasher.update(chunk)
    hooks.onProgress?.(Math.min(100, Math.round(((offset + chunk.byteLength) / file.size) * 100)))
    await hooks.afterChunk?.()
  }

  if (hooks.isCancelled?.()) throw hashCancelledError()
  return hashers.map((hasher) => hasher.digest())
}
