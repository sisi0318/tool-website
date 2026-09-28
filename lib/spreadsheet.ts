import type * as XLSX from "xlsx"
import { readWorkbookCsv, readWorkbookSheets, type SpreadsheetCsv, type SpreadsheetRequest, type SpreadsheetSheet } from "./spreadsheet-shared"
import { runWorkerTask, workerTaskCancelledError } from "./worker-task"

export type { SpreadsheetCsv, SpreadsheetSheet }

type WorkerFactory = () => Worker

const defaultFactory: WorkerFactory = () => new Worker(new URL("../workers/spreadsheet.worker.ts", import.meta.url), { type: "module" })

/**
 * 在 Worker 里解析 Excel / CSV。以前 XLSX.read 和逐表转换都在主线程上，
 * 几十 MB 的表格会让页面冻结好几秒。建不了 Worker 的环境退回主线程解析。
 */
async function runSpreadsheetTask<Result>(
  request: SpreadsheetRequest,
  context: { signal?: AbortSignal },
  factory: WorkerFactory,
  onMainThread: (xlsx: typeof XLSX, data: ArrayBuffer) => Result,
): Promise<Result> {
  if (context.signal?.aborted) throw workerTaskCancelledError()

  let worker: Worker
  try {
    worker = factory()
  } catch {
    const [xlsx, data] = await Promise.all([import("xlsx"), request.file.arrayBuffer()])
    if (context.signal?.aborted) throw workerTaskCancelledError()
    return onMainThread(xlsx, data)
  }
  return runWorkerTask<Result>(worker, request, context)
}

/** 每个工作表的行（Office 预览页用） */
export function readSpreadsheet(file: Blob, context: { signal?: AbortSignal } = {}, factory = defaultFactory): Promise<SpreadsheetSheet[]> {
  return runSpreadsheetTask({ file, output: "sheets" }, context, factory, readWorkbookSheets)
}

/** 第一个工作表的 CSV（画布、旅程的 Office 节点用） */
export function readSpreadsheetCsv(file: Blob, context: { signal?: AbortSignal } = {}, factory = defaultFactory): Promise<SpreadsheetCsv> {
  return runSpreadsheetTask({ file, output: "csv" }, context, factory, readWorkbookCsv)
}
