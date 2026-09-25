import { createClientId } from "./client-id"
import { inferDataType } from "./journey/tree"
import type { DataType } from "./canvas/types"
import { detectFileSignature } from "./file-signature"

export interface ToolTransfer {
  value: unknown
  valueType: DataType
  source: string
  targetTool?: string
}
export class ToolTransferError extends Error {
  constructor(public readonly code: "tooLarge" | "invalidValue") { super(code); this.name = "ToolTransferError" }
}

/** File/Blob and typed byte ranges stay binary; structured values are copied at send time. */
export function normalizeTransferValue(value: unknown, filename = "tool-output.bin"): { value: unknown; size: number } {
  if (typeof Blob !== "undefined" && value instanceof Blob) {
    if (value.size > 64 * 1024 * 1024) throw new ToolTransferError("tooLarge")
    return { value: value instanceof File ? value : new File([value], filename, { type: value.type || "application/octet-stream" }), size: value.size }
  }
  if (value instanceof ArrayBuffer || ArrayBuffer.isView(value)) {
    const bytes = value instanceof ArrayBuffer ? new Uint8Array(value) : new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
    if (bytes.byteLength > 64 * 1024 * 1024) throw new ToolTransferError("tooLarge")
    return { value: new File([new Uint8Array(bytes).buffer], filename, { type: detectFileSignature(bytes).mime }), size: bytes.byteLength }
  }
  if (typeof value === "string") {
    if (value.length > 8 * 1024 * 1024) throw new ToolTransferError("tooLarge")
    return { value, size: value.length * 2 }
  }
  try {
    const serialized = JSON.stringify(value, (_key, item) => {
      if (["undefined", "function", "symbol", "bigint"].includes(typeof item) || (typeof item === "number" && !Number.isFinite(item))) throw new ToolTransferError("invalidValue")
      return item
    })
    if (serialized === undefined) throw new ToolTransferError("invalidValue")
    if (serialized.length > 8 * 1024 * 1024) throw new ToolTransferError("tooLarge")
    return { value: JSON.parse(serialized), size: serialized.length * 2 }
  } catch (error) { throw error instanceof ToolTransferError ? error : new ToolTransferError("invalidValue") }
}

export class ToolTransferStore {
  private entries = new Map<string, { transfer: ToolTransfer; size: number; expires: number; timer: ReturnType<typeof setTimeout> }>()
  constructor(private readonly ttl = 5 * 60_000, private readonly maxEntries = 8, private readonly maxBytes = 128 * 1024 * 1024) {}

  put(value: unknown, source: string, targetTool?: string, filename?: string): string {
    const normalized = normalizeTransferValue(value, filename)
    if (normalized.size > this.maxBytes) throw new ToolTransferError("tooLarge")
    let total = 0
    for (const [id, entry] of this.entries) { if (entry.expires <= Date.now()) this.remove(id); else total += entry.size }
    while (this.entries.size >= this.maxEntries || total + normalized.size > this.maxBytes) {
      const oldest = this.entries.entries().next().value
      if (!oldest) break
      total -= oldest[1].size
      this.remove(oldest[0])
    }
    const id = createClientId("transfer")
    const transfer = { value: normalized.value, valueType: inferDataType(normalized.value), source: source.slice(0, 160), ...(targetTool ? { targetTool } : {}) }
    this.entries.set(id, { transfer, size: normalized.size, expires: Date.now() + this.ttl, timer: setTimeout(() => this.remove(id), this.ttl) })
    return id
  }

  take(id: string): ToolTransfer | null {
    const entry = this.entries.get(id)
    this.remove(id)
    return entry && entry.expires > Date.now() ? entry.transfer : null
  }
  remove(id: string): void { const entry = this.entries.get(id); if (entry) clearTimeout(entry.timer); this.entries.delete(id) }
  clear(): void { for (const id of this.entries.keys()) this.remove(id) }
}

// Deliberately memory-only. URLs carry an opaque, single-use handle, never the data.
export const toolTransfers = new ToolTransferStore()
export const toolTransferUrl = (id: string) => `/journey#handoff=${encodeURIComponent(id)}`
export const toolTransferIdFromHash = (hash: string) => new URLSearchParams(hash.replace(/^#/, "")).get("handoff")

/** 发往某个工具页（独立页）；工作台里改为就地开标签，不走 URL */
export const toolPageTransferUrl = (toolId: string, id: string) => `/tools/${encodeURIComponent(toolId)}#handoff=${encodeURIComponent(id)}`

const TRANSFER_CHANNEL = "tool-transfer"
interface TransferMessage { type: "request" | "response"; id: string; transfer?: ToolTransfer | null }

/**
 * 让另一个浏览器标签取走这份数据：工作台里发往旅程时在新标签打开旅程，
 * 数据留在发出方的内存里，由这里通过 BroadcastChannel 应答一次。被取走或过期后停止应答。
 */
export function offerTransferToOtherTabs(id: string, store: ToolTransferStore = toolTransfers, ttl = 5 * 60_000): void {
  if (typeof BroadcastChannel === "undefined") return
  const channel = new BroadcastChannel(TRANSFER_CHANNEL)
  const stop = () => { clearTimeout(timer); channel.close() }
  const timer = setTimeout(stop, ttl)
  channel.onmessage = (event: MessageEvent<TransferMessage>) => {
    if (event.data?.type !== "request" || event.data.id !== id) return
    const transfer = store.take(id)
    channel.postMessage({ type: "response", id, transfer } satisfies TransferMessage)
    stop()
  }
}

/** 取交接数据：先查本标签的内存，没有再向其它标签要（在新标签里打开的旅程就是这种情况） */
export async function receiveTransfer(id: string, store: ToolTransferStore = toolTransfers, timeoutMs = 1500): Promise<ToolTransfer | null> {
  const local = store.take(id)
  if (local || typeof BroadcastChannel === "undefined") return local
  return new Promise((resolve) => {
    const channel = new BroadcastChannel(TRANSFER_CHANNEL)
    const finish = (transfer: ToolTransfer | null) => { clearTimeout(timer); channel.close(); resolve(transfer) }
    const timer = setTimeout(() => finish(null), timeoutMs)
    channel.onmessage = (event: MessageEvent<TransferMessage>) => {
      if (event.data?.type === "response" && event.data.id === id) finish(event.data.transfer ?? null)
    }
    channel.postMessage({ type: "request", id } satisfies TransferMessage)
  })
}

/** 交接数据的大类，对应工具目录里的 accepts：文本（含 JSON 值）、图片文件、其它文件 */
export type TransferKind = "text" | "image" | "file"

export function transferKind(value: unknown): TransferKind {
  if (typeof Blob !== "undefined" && value instanceof Blob) return value.type.startsWith("image/") ? "image" : "file"
  if (value instanceof ArrayBuffer || ArrayBuffer.isView(value)) return "file"
  return "text"
}

/** 文本类工具收到的值：字符串原样，JSON 值格式化成文本；文件返回 null */
export function transferText(value: unknown): string | null {
  if (typeof value === "string") return value
  if (transferKind(value) !== "text") return null
  return JSON.stringify(value, null, 2) ?? null
}
