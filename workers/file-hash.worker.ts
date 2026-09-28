import { digestFileChunks, type FileHashRequest } from "../lib/file-hash-shared"
import { serveWorkerTask } from "../lib/worker-task"

serveWorkerTask<FileHashRequest, string[]>((request, progress) => {
  let reported = -1
  return digestFileChunks(request, {
    // 进度按整数百分比报，同一个百分比不重复发
    onProgress: (percent) => {
      if (percent === reported) return
      reported = percent
      progress(percent)
    },
  })
})
