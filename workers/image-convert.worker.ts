import { convertImageFile, WORKER_CANVAS_UNAVAILABLE, type ImageConvertOptions, type ImageConvertResult } from "../lib/image-convert"
import { serveWorkerTask } from "../lib/worker-task"

serveWorkerTask<{ file: File; options: ImageConvertOptions }, ImageConvertResult>(async ({ file, options }) => {
  if (typeof OffscreenCanvas === "undefined" || typeof createImageBitmap !== "function") throw new Error(WORKER_CANVAS_UNAVAILABLE)
  return convertImageFile(file, options)
})
