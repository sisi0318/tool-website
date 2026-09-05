function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function isBinary(value: unknown): value is ArrayBuffer | ArrayBufferView {
  return value instanceof ArrayBuffer || ArrayBuffer.isView(value)
}

/** 文件 / 二进制块只给摘要,不把字节逐个展开成 {"0":12,"1":34,…} */
function summarizeOpaque(value: unknown): string | null {
  if (typeof File !== "undefined" && value instanceof File) {
    return `${value.name} (${formatSize(value.size)})`
  }
  if (typeof Blob !== "undefined" && value instanceof Blob) return `Blob (${formatSize(value.size)})`
  if (isBinary(value)) return `bytes (${formatSize(value.byteLength)})`
  return null
}

/** 完整文本:复制、下载、导出用。大值会整个序列化,展示请用 previewCanvasValue。 */
export function formatCanvasValue(value: unknown, pretty = false): string {
  if (value === undefined) return ""
  if (value === null) return "null"

  const opaque = summarizeOpaque(value)
  if (opaque !== null) return opaque

  if (typeof value !== "object") return String(value)

  const seen = new WeakSet<object>()
  try {
    return JSON.stringify(
      value,
      (_key, nestedValue: unknown) => {
        if (typeof nestedValue !== "object" || nestedValue === null) return nestedValue
        const summary = summarizeOpaque(nestedValue)
        if (summary !== null) return summary
        if (seen.has(nestedValue)) return "[Circular]"
        seen.add(nestedValue)
        return nestedValue
      },
      pretty ? 2 : undefined
    )
  } catch {
    return String(value)
  }
}

export interface ValuePreview {
  /** 最多 maxChars 个字符 */
  text: string
  truncated: boolean
  /** 完整文本的字符数;对象在预算内没写完时无从得知 */
  fullLength?: number
}

class BoundedWriter {
  private readonly chunks: string[] = []
  private length = 0

  constructor(private readonly max: number) {}

  get remaining(): number {
    return this.max - this.length
  }

  /** 写入并返回是否还有预算;超出的部分被丢弃 */
  push(text: string): boolean {
    if (text.length <= this.remaining) {
      this.chunks.push(text)
      this.length += text.length
      return true
    }
    this.chunks.push(text.slice(0, this.remaining))
    this.length = this.max
    return false
  }

  toString(): string {
    return this.chunks.join("")
  }
}

/**
 * 与 JSON.stringify(value, null, pretty ? 2 : undefined) 产出一致,
 * 但预算用完就立刻停,不会为了展示前 100 个字符先把 50MB 的对象整个序列化一遍。
 */
function writeBounded(
  value: unknown,
  out: BoundedWriter,
  seen: WeakSet<object>,
  indent: string,
  pretty: boolean,
): boolean {
  if (typeof value === "string") {
    // 转义只会更长:先按剩余预算切一刀,免得为一个 5MB 的字符串整个转义
    const slice = value.length > out.remaining ? value.slice(0, out.remaining + 1) : value
    return out.push(JSON.stringify(slice))
  }
  if (typeof value === "bigint") return out.push(String(value))
  if (value === null || typeof value !== "object") {
    const json = JSON.stringify(value)
    return out.push(json === undefined ? "null" : json)
  }

  const opaque = summarizeOpaque(value)
  if (opaque !== null) return out.push(JSON.stringify(opaque))
  if (value instanceof Date) return out.push(JSON.stringify(value))
  if (seen.has(value)) return out.push('"[Circular]"')
  seen.add(value)

  const nl = pretty ? "\n" : ""
  const childIndent = pretty ? `${indent}  ` : ""
  let complete: boolean

  if (Array.isArray(value)) {
    if (value.length === 0) return out.push("[]")
    complete = out.push(`[${nl}`)
    for (let i = 0; complete && i < value.length; i += 1) {
      complete =
        out.push(childIndent) &&
        writeBounded(value[i], out, seen, childIndent, pretty) &&
        out.push(`${i < value.length - 1 ? "," : ""}${nl}`)
    }
    complete = complete && out.push(`${indent}]`)
  } else {
    const entries = Object.entries(value as Record<string, unknown>).filter(
      ([, nested]) => nested !== undefined && typeof nested !== "function",
    )
    if (entries.length === 0) return out.push("{}")
    complete = out.push(`{${nl}`)
    for (let i = 0; complete && i < entries.length; i += 1) {
      const [key, nested] = entries[i]
      complete =
        out.push(`${childIndent}${JSON.stringify(key)}${pretty ? ": " : ":"}`) &&
        writeBounded(nested, out, seen, childIndent, pretty) &&
        out.push(`${i < entries.length - 1 ? "," : ""}${nl}`)
    }
    complete = complete && out.push(`${indent}}`)
  }

  seen.delete(value)
  return complete
}

/**
 * 给节点卡片、属性面板用的有界预览:输出最多 maxChars 个字符,代价也只与 maxChars 有关。
 * 节点卡片在拖动、缩放时会反复渲染,这里若把整个大值格式化一遍,画布就会卡死。
 */
export function previewCanvasValue(value: unknown, maxChars: number, pretty = false): ValuePreview {
  if (typeof value === "string") {
    return value.length <= maxChars
      ? { text: value, truncated: false, fullLength: value.length }
      : { text: value.slice(0, maxChars), truncated: true, fullLength: value.length }
  }
  if (value === null || typeof value !== "object" || summarizeOpaque(value) !== null) {
    const text = formatCanvasValue(value, pretty)
    return text.length <= maxChars
      ? { text, truncated: false, fullLength: text.length }
      : { text: text.slice(0, maxChars), truncated: true, fullLength: text.length }
  }

  // 多留一个字符的预算,才能区分"刚好写满"与"没写完"
  const out = new BoundedWriter(maxChars + 1)
  const complete = writeBounded(value, out, new WeakSet(), "", pretty)
  const text = out.toString()
  if (complete && text.length <= maxChars) return { text, truncated: false, fullLength: text.length }
  return { text: text.slice(0, maxChars), truncated: true }
}
