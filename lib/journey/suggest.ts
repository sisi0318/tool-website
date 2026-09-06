import { detectData, type DetectedDataType } from "../data-detector"
import { getAllNodes, getNodeDefinition } from "../canvas/registry"
import { isTypeCompatible } from "../canvas/validation"
import type { DataType, NodeDefinition } from "../canvas/types"
import { getMainInputPort, resolveOutputPort } from "./engine"
import type { JourneySuggestion } from "./types"

interface CuratedEntry {
  tool: string
  label: string
  config?: Record<string, unknown>
  outputPort?: string
  score: number
}

/**
 * 识别类型 → 精选建议。条目在运行时经注册表校验(存在、主输入端口类型匹配),
 * 不符即静默丢弃,保证矩阵中的"猜测"永远安全降级。
 */
const CURATED: Partial<Record<DetectedDataType, CuratedEntry[]>> = {
  base64: [
    { tool: "encoding", label: "Base64 decode", config: { encoding: "base64", mode: "decode" }, score: 100 },
    { tool: "base64-to-file", label: "Base64 to file", score: 70 },
  ],
  jwt: [{ tool: "jwt", label: "Decode JWT", outputPort: "payload", score: 100 }],
  json: [
    { tool: "json-format", label: "Format JSON", outputPort: "formatted", score: 100 },
    { tool: "json-path", label: "Extract with JSON Path", score: 80 },
    { tool: "json-to-yaml", label: "JSON to YAML", score: 70 },
  ],
  "url-encoded": [
    { tool: "encoding", label: "URL decode", config: { encoding: "url", mode: "decode" }, score: 100 },
  ],
  hex: [
    { tool: "encoding", label: "Hex decode", config: { encoding: "hex", mode: "decode" }, score: 100 },
    { tool: "base-converter", label: "Convert base", config: { fromBase: "16" }, score: 60 },
  ],
  xml: [{ tool: "xml", label: "Format XML", score: 90 }],
  timestamp: [{ tool: "time", label: "Convert timestamp", score: 90 }],
  pem: [{ tool: "certificate", label: "Inspect certificate", score: 100 }],
  csv: [{ tool: "tabular", label: "Query CSV rows", config: { format: "csv" }, outputPort: "rows", score: 95 }, { tool: "csv", label: "Parse CSV", score: 90 }],
  uuid: [],
  gzip: [
    {
      tool: "compression",
      label: "Decompress",
      // 识别器只在 base64 文本上判定 gzip,因此必须显式声明输入编码与格式。
      config: { operation: "decompress", format: "gzip", inputEncoding: "base64", outputEncoding: "text" },
      score: 90,
    },
  ],
  zip: [
    {
      tool: "compression",
      label: "Extract archive",
      config: { operation: "decompress", format: "zip", inputEncoding: "base64", outputEncoding: "text" },
      score: 90,
    },
  ],
  "plain-text": [
    { tool: "hash", label: "Hash", score: 60 },
    { tool: "encoding", label: "Base64 encode", config: { encoding: "base64", mode: "encode" }, score: 55 },
    { tool: "case-converter", label: "Change case", score: 50 },
    { tool: "text-stats", label: "Text statistics", score: 45 },
    { tool: "qrcode", label: "Generate QR code", score: 40 },
  ],
}

const BYTES_CURATED: CuratedEntry[] = [
  { tool: "exif-viewer", label: "Read EXIF", score: 90 },
  { tool: "qrcode-decode", label: "Decode QR code", score: 85 },
  { tool: "image-compress", label: "Compress image", score: 80 },
  { tool: "image-convert", label: "Convert format", score: 75 },
  { tool: "meme-splitter", label: "Split grid image", score: 70 },
  { tool: "file-to-base64", label: "File to Base64", score: 60 },
  { tool: "file-to-string", label: "File to text", score: 55 },
]

// hash 的主输入是 string,bytes 无法直接喂进去;要哈希文件先经 file-to-string / file-to-base64。
const GENERIC_BYTES: CuratedEntry[] = [
  { tool: "file-to-base64", label: "File to Base64", score: 60 },
  { tool: "file-to-string", label: "File to text", score: 55 },
]

/** 供测试遍历:每条精选建议都应能在真实注册表下通过校验并成功执行。 */
export const CURATED_MATRIX = { byDetection: CURATED, imageBytes: BYTES_CURATED, genericBytes: GENERIC_BYTES }

const EXCLUDED_CATEGORIES = new Set(["basic"])

function isChainable(definition: NodeDefinition): boolean {
  if (EXCLUDED_CATEGORIES.has(definition.category)) return false
  if (definition.type.endsWith("-preview")) return false
  if (definition.executionMode === "manual") return false
  return getMainInputPort(definition) !== null
}

function validateEntry(entry: CuratedEntry, valueType: DataType): JourneySuggestion | null {
  const definition = getNodeDefinition(entry.tool)
  if (!definition || !isChainable(definition)) return null
  const mainPort = getMainInputPort(definition)!
  if (!isTypeCompatible(valueType, mainPort.dataType)) return null
  return {
    tool: entry.tool,
    label: entry.label,
    config: entry.config ?? {},
    outputPort: entry.outputPort ?? resolveOutputPort(definition),
    reason: "detection",
    score: entry.score,
  }
}

/** 全部可作为下一步的适配器(选择器用),按主输入端口与当前类型的兼容性过滤 */
export function getCompatibleTools(valueType: DataType): NodeDefinition[] {
  return getAllNodes()
    .filter(isChainable)
    .filter((definition) => isTypeCompatible(valueType, getMainInputPort(definition)!.dataType))
    .sort((a, b) => a.label.localeCompare(b.label))
}

/** 建议 = 识别驱动精选(高分) + 类型兼容兜底(低分),按分数排序去重 */
export function suggestNext(value: unknown, valueType: DataType, limit = 6): JourneySuggestion[] {
  const suggestions = new Map<string, JourneySuggestion>()

  const pushEntry = (entry: CuratedEntry, detectionType?: string) => {
    const suggestion = validateEntry(entry, valueType)
    if (!suggestion) return
    if (detectionType) suggestion.detectionType = detectionType
    const key = `${suggestion.tool}:${JSON.stringify(suggestion.config)}`
    const existing = suggestions.get(key)
    if (!existing || existing.score < suggestion.score) suggestions.set(key, suggestion)
  }

  if (valueType === "bytes") {
    const mime = typeof Blob !== "undefined" && value instanceof Blob ? value.type : ""
    const filename = typeof File !== "undefined" && value instanceof File ? value.name : ""
    if (/\.pdf$/i.test(filename) || mime === "application/pdf") pushEntry({ tool: "pdf", label: "Inspect PDF pages", config: { operation: "inspect" }, outputPort: "info", score: 110 })
    if (["image/png", "image/jpeg"].includes(mime)) pushEntry({ tool: "images-to-pdf", label: "Image to PDF", outputPort: "file", score: 65 })
    if (["image/png", "image/jpeg", "image/webp"].includes(mime) || /\.(png|jpe?g|webp)$/i.test(filename)) pushEntry({ tool: "image-to-svg", label: "Trace image to SVG", outputPort: "file", score: 75 })
    if (/\.(sqlite|sqlite3|db|db3|s3db)$/i.test(filename) || mime === "application/vnd.sqlite3") pushEntry({ tool: "sqlite", label: "Inspect SQLite database", config: { operation: "inspect" }, outputPort: "result", score: 110 })
    if (/\.(cbor|msgpack|mpk)$/i.test(filename) || ["application/cbor", "application/msgpack", "application/x-msgpack"].includes(mime)) {
      pushEntry({ tool: "binary-codec-file", label: "Decode MessagePack / CBOR file", config: { format: /\.cbor$/i.test(filename) || mime === "application/cbor" ? "cbor" : "msgpack" }, outputPort: "value", score: 110 })
    }
    if (/\.(csv|tsv|jsonl|ndjson)$/i.test(filename) || ["text/csv", "text/tab-separated-values", "application/x-ndjson"].includes(mime)) {
      pushEntry({ tool: "tabular-file", label: "Query CSV / JSONL file", config: { format: /\.(jsonl|ndjson)$/i.test(filename) || mime === "application/x-ndjson" ? "jsonl" : "csv" }, outputPort: "rows", score: 110 })
    }
    if (mime === "application/zip" || /\.(zip|jar|apk|docx|xlsx|pptx)$/i.test(filename)) {
      pushEntry({ tool: "zip-directory", label: "Browse ZIP directory", outputPort: "entries", score: 110 })
    }
    if (["application/gzip", "application/zip"].includes(mime) || /\.(gz|zip|br|zlib|deflate)$/i.test(filename)) {
      pushEntry({ tool: "compression-file", label: "Decompress file", config: { operation: "decompress", format: "auto" }, outputPort: "file", score: 100 })
    }
    const curated = mime.startsWith("image/") ? BYTES_CURATED : GENERIC_BYTES
    curated.forEach((entry) => pushEntry(entry))
  } else if (typeof value === "string" && value.trim().length > 0) {
    if (/^(?:https?|wss?|ftp|file):\/\//i.test(value.trim())) pushEntry({ tool: "url", label: "Inspect URL parameters", outputPort: "components", score: 2000 })
    if (/[\r\n]/.test(value)) pushEntry({ tool: "text-lines", label: "Process text lines", config: { operation: "dedupe" }, outputPort: "output", score: 65 })
    if (/[\u00a0\u0300-\u036f\u2000-\u200f\u2028-\u202f\u2060-\u206f\ufeff]/.test(value)) {
      pushEntry({ tool: "unicode", label: "Inspect Unicode characters", config: { operation: "inspect" }, outputPort: "report", score: 70 })
    }
    const sampleLines = value.slice(0, 8192).trim().split(/\r?\n/)
    if (sampleLines.length >= 2 && sampleLines.slice(0, 2).every((line) => { try { const row: unknown = JSON.parse(line); return row !== null && typeof row === "object" && !Array.isArray(row) } catch { return false } })) {
      pushEntry({ tool: "tabular", label: "Query JSONL logs", config: { format: "jsonl" }, outputPort: "rows", score: 2000 })
    }
    const detection = detectData(value)
    // 按识别置信度加权:同一识别矩阵内保持相对分,不同识别按 confidence 排先后
    const ranked = [...detection.matches].sort((a, b) => b.confidence - a.confidence)
    ranked.forEach((match, index) => {
      const entries = CURATED[match.type] ?? []
      entries.forEach((entry) =>
        pushEntry({ ...entry, score: entry.score + (ranked.length - index) * 200 }, match.type),
      )
    })
  } else if (valueType === "json") {
    ;(CURATED.json ?? []).forEach((entry) => pushEntry(entry, "json"))
  }

  // 兼容兜底:未进精选的可链接工具,低分补齐
  for (const definition of getCompatibleTools(valueType)) {
    const key = `${definition.type}:{}`
    if ([...suggestions.values()].some((s) => s.tool === definition.type)) continue
    suggestions.set(key, {
      tool: definition.type,
      label: definition.label,
      config: {},
      outputPort: resolveOutputPort(definition),
      reason: "compatible",
      score: 10,
    })
  }

  return [...suggestions.values()].sort((a, b) => b.score - a.score).slice(0, limit)
}
