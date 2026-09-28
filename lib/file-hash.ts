import { digestFileChunks, hashCancelledError, type FileHashRequest } from "./file-hash-shared"
import { runWorkerTask } from "./worker-task"

export type { FileHashRequest }

/**
 * 在 Worker 里计算文件哈希。以前在主线程上每读 2 MB 就同步喂给所选的算法，
 * “显示所有算法结果”时一块要算二十来种，界面每读一块就卡一下；现在主线程只收进度。
 * 取消时直接终止 Worker。建不了 Worker 的环境（测试、极旧的浏览器）退回主线程分块计算。
 */
export function hashFile(
  request: FileHashRequest,
  context: { signal?: AbortSignal; onProgress?: (percent: number) => void } = {},
  factory: () => Worker = () => new Worker(new URL("../workers/file-hash.worker.ts", import.meta.url), { type: "module" }),
): Promise<string[]> {
  if (context.signal?.aborted) return Promise.reject(hashCancelledError())

  let worker: Worker
  try {
    worker = factory()
  } catch {
    return digestFileChunks(request, {
      onProgress: context.onProgress,
      isCancelled: () => Boolean(context.signal?.aborted),
      afterChunk: () => new Promise((resolve) => setTimeout(resolve, 0)),
    })
  }
  return runWorkerTask<string[]>(worker, request, context)
}
