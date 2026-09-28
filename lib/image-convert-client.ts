import { convertImageFile, WORKER_CANVAS_UNAVAILABLE, type ImageConvertOptions, type ImageConvertResult } from "./image-convert"
import { runWorkerTask, workerTaskCancelledError } from "./worker-task"

/**
 * 在 Worker 里转换图片。解码、缩放、编码都不再占用主线程；GIF 的调色板量化和 LZW 压缩
 * 是纯 JavaScript，大图以前会让页面卡上好几秒。Worker 建不了或里面没有 OffscreenCanvas 时退回主线程。
 */
export async function convertImageInWorker(
  file: File,
  options: ImageConvertOptions,
  context: { signal?: AbortSignal } = {},
  factory: () => Worker = () => new Worker(new URL("../workers/image-convert.worker.ts", import.meta.url), { type: "module" }),
): Promise<ImageConvertResult> {
  if (context.signal?.aborted) throw workerTaskCancelledError()

  let worker: Worker
  try {
    worker = factory()
  } catch {
    return convertImageFile(file, options)
  }
  try {
    return await runWorkerTask<ImageConvertResult>(worker, { file, options }, context)
  } catch (error) {
    if (error instanceof Error && error.message === WORKER_CANVAS_UNAVAILABLE) return convertImageFile(file, options)
    throw error
  }
}
