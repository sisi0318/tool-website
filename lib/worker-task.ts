/**
 * 一次性的 Worker 任务：一个 Worker 只做一件事，做完就终止。
 *
 * 约定：Worker 加载好后先发 { ready: true }，页面这时才发请求；之后 Worker 可以发若干 { progress }，
 * 最后发 { result } 或 { error }。取消时页面直接终止 Worker，之后收到的消息一律丢弃。
 */

type WorkerTaskMessage<Result> = { ready?: boolean; progress?: number; result?: Result; error?: string }

export function workerTaskCancelledError(): DOMException {
  return new DOMException("Worker task cancelled", "AbortError")
}

/** 页面这一端：把请求交给已经建好的 Worker，等结果 */
export function runWorkerTask<Result>(
  worker: Worker,
  request: unknown,
  context: { signal?: AbortSignal; onProgress?: (progress: number) => void; transfer?: Transferable[] } = {},
): Promise<Result> {
  return new Promise((resolve, reject) => {
    let done = false
    let sent = false
    const settle = (finish: () => void) => {
      if (done) return
      done = true
      context.signal?.removeEventListener("abort", abort)
      worker.onmessage = null
      worker.onerror = null
      worker.terminate()
      finish()
    }
    const abort = () => settle(() => reject(workerTaskCancelledError()))

    worker.onerror = (event) => {
      event.preventDefault()
      settle(() => reject(new Error(event.message || "Worker task failed")))
    }
    worker.onmessage = ({ data }: MessageEvent<WorkerTaskMessage<Result>>) => {
      if (done) return
      if (data.ready) {
        if (sent) return
        sent = true
        try {
          worker.postMessage(request, context.transfer ?? [])
        } catch (error) {
          settle(() => reject(error instanceof Error ? error : new Error(String(error))))
        }
        return
      }
      if (typeof data.progress === "number") {
        context.onProgress?.(data.progress)
        return
      }
      if ("result" in data) settle(() => resolve(data.result as Result))
      else settle(() => reject(new Error(data.error ?? "Worker task failed")))
    }

    if (context.signal?.aborted) abort()
    else context.signal?.addEventListener("abort", abort, { once: true })
  })
}

/** Worker 这一端：收到请求就交给 handle，结果或错误发回页面；可以用 progress 报进度 */
export function serveWorkerTask<Request, Result>(
  handle: (request: Request, progress: (value: number) => void) => Promise<Result>,
  options: { transfer?: (result: Result) => Transferable[] } = {},
): void {
  const scope = self as unknown as { onmessage: ((event: MessageEvent<Request>) => void) | null; postMessage(value: unknown, transfer?: Transferable[]): void }
  scope.onmessage = async ({ data }) => {
    try {
      const result = await handle(data, (value) => scope.postMessage({ progress: value }))
      scope.postMessage({ result }, options.transfer?.(result) ?? [])
    } catch (error) {
      scope.postMessage({ error: error instanceof Error ? error.message : String(error) })
    }
  }
  scope.postMessage({ ready: true })
}
