/**
 * 用户正则的受保护执行。
 *
 * 匹配循环里的迭代上限只能防「匹配次数无限」，防不住单次 exec() 内部的灾难性
 * 回溯 —— `(a+)+$` 配一长串 a 再加一个不匹配的字符，一次调用就是指数级耗时，
 * 主线程上无法中断，整个标签页（连同画布里未保存的状态）一起冻结。
 *
 * 这里把执行放进 Web Worker，超时就 terminate()。Worker 不可用时（SSR、测试环境）
 * 退回主线程同步执行。
 */

export interface RegexMatchInfo {
  index: number
  match: string
  groups: (string | undefined)[]
  namedGroups?: Record<string, string>
  length: number
}

export interface RegexRunResult {
  matches: RegexMatchInfo[]
  /** 传了 replacement 时的替换结果 */
  replaced?: string
  /** 匹配次数触顶（多半是零宽匹配造成的无限循环） */
  hitIterationLimit: boolean
  durationMs: number
}

export interface RegexRunOptions {
  pattern: string
  flags: string
  text: string
  replacement?: string
  /** 匹配次数上限 */
  maxMatches?: number
  /** 超时毫秒数，仅 Worker 路径生效 */
  timeoutMs?: number
}

export class RegexTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`Regex execution exceeded ${timeoutMs}ms (possible catastrophic backtracking)`)
    this.name = "RegexTimeoutError"
  }
}

export const DEFAULT_MAX_MATCHES = 10000
export const DEFAULT_TIMEOUT_MS = 2000

/**
 * 核心实现。必须保持自包含：不引用模块作用域的任何东西，因为它的源码会被
 * toString() 后塞进 Worker。语法也尽量保守，避免编译器注入辅助函数。
 */
export function runRegexSync(
  pattern: string,
  flags: string,
  text: string,
  replacement: string | undefined,
  maxMatches: number,
): RegexRunResult {
  const startedAt = typeof performance !== "undefined" ? performance.now() : Date.now()
  const regex = new RegExp(pattern, flags)
  const matches: RegexMatchInfo[] = []
  let hitIterationLimit = false

  if (flags.indexOf("g") >= 0) {
    let match: RegExpExecArray | null
    let count = 0
    while ((match = regex.exec(text)) !== null) {
      matches.push({
        index: match.index,
        match: match[0],
        groups: match.slice(1),
        namedGroups: match.groups ? Object.assign({}, match.groups) : undefined,
        length: match[0].length,
      })
      count += 1
      if (count >= maxMatches) {
        hitIterationLimit = true
        break
      }
      // 零宽匹配不推进 lastIndex 会原地打转
      if (match.index === regex.lastIndex) regex.lastIndex += 1
    }
  } else {
    const match = regex.exec(text)
    if (match) {
      matches.push({
        index: match.index,
        match: match[0],
        groups: match.slice(1),
        namedGroups: match.groups ? Object.assign({}, match.groups) : undefined,
        length: match[0].length,
      })
    }
  }

  let replaced: string | undefined
  if (replacement !== undefined) {
    regex.lastIndex = 0
    replaced = text.replace(regex, replacement)
  }

  const endedAt = typeof performance !== "undefined" ? performance.now() : Date.now()
  return { matches, replaced, hitIterationLimit, durationMs: endedAt - startedAt }
}

/** Worker 脚本：把核心函数的源码原样带进去，收到消息就调用并回传。 */
function buildWorkerSource(): string {
  return [
    `const run = ${runRegexSync.toString()};`,
    "self.onmessage = (event) => {",
    "  const { id, pattern, flags, text, replacement, maxMatches } = event.data;",
    "  try {",
    "    const result = run(pattern, flags, text, replacement, maxMatches);",
    "    self.postMessage({ id, ok: true, result });",
    "  } catch (error) {",
    "    self.postMessage({ id, ok: false, message: error && error.message ? error.message : String(error) });",
    "  }",
    "};",
  ].join("\n")
}

interface PendingRun {
  resolve: (result: RegexRunResult) => void
  reject: (error: Error) => void
  timer: ReturnType<typeof setTimeout>
}

let worker: Worker | null = null
let workerUrl: string | null = null
let nextId = 0
const pending = new Map<number, PendingRun>()

function ensureWorker(): Worker {
  if (worker) return worker
  if (!workerUrl) {
    workerUrl = URL.createObjectURL(new Blob([buildWorkerSource()], { type: "text/javascript" }))
  }
  const created = new Worker(workerUrl)
  created.onmessage = (event: MessageEvent) => {
    const { id, ok, result, message } = event.data as {
      id: number
      ok: boolean
      result?: RegexRunResult
      message?: string
    }
    const entry = pending.get(id)
    if (!entry) return
    pending.delete(id)
    clearTimeout(entry.timer)
    if (ok && result) entry.resolve(result)
    else entry.reject(new Error(message ?? "Regex execution failed"))
  }
  created.onerror = (event) => {
    // Worker 本身出错：让所有等待者失败并丢弃它，下次调用重建
    const error = new Error(event.message || "Regex worker crashed")
    for (const [id, entry] of pending) {
      clearTimeout(entry.timer)
      entry.reject(error)
      pending.delete(id)
    }
    disposeWorker()
  }
  worker = created
  return created
}

function disposeWorker(): void {
  if (worker) {
    worker.terminate()
    worker = null
  }
}

export function isRegexWorkerAvailable(): boolean {
  return typeof Worker !== "undefined" && typeof URL !== "undefined" && typeof Blob !== "undefined"
}

/**
 * 在 Worker 里执行；超过 timeoutMs 就终止 Worker 并抛 RegexTimeoutError。
 * 终止后所有在飞的其它调用也会以超时失败 —— 它们共享同一个 Worker，
 * 而一个被卡死的 Worker 无法再处理任何消息。
 */
export function runRegex(options: RegexRunOptions): Promise<RegexRunResult> {
  const maxMatches = options.maxMatches ?? DEFAULT_MAX_MATCHES
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS

  if (!isRegexWorkerAvailable()) {
    return new Promise((resolve, reject) => {
      try {
        resolve(runRegexSync(options.pattern, options.flags, options.text, options.replacement, maxMatches))
      } catch (error) {
        reject(error instanceof Error ? error : new Error(String(error)))
      }
    })
  }

  return new Promise((resolve, reject) => {
    const id = ++nextId
    const timer = setTimeout(() => {
      pending.delete(id)
      // 卡死的 Worker 救不回来，直接杀掉；其它等待者一并按超时处理
      for (const [otherId, entry] of pending) {
        clearTimeout(entry.timer)
        entry.reject(new RegexTimeoutError(timeoutMs))
        pending.delete(otherId)
      }
      disposeWorker()
      reject(new RegexTimeoutError(timeoutMs))
    }, timeoutMs)

    pending.set(id, { resolve, reject, timer })
    ensureWorker().postMessage({
      id,
      pattern: options.pattern,
      flags: options.flags,
      text: options.text,
      replacement: options.replacement,
      maxMatches,
    })
  })
}
